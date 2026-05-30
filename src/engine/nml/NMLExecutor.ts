/**
 * NMLExecutor - Compiles an NML AST into a flat instruction stream and runs it.
 *
 * Why a flat instruction stream rather than walking the AST directly?
 * NML is a sequential script with <goto>/<label> jumps that cross block
 * boundaries (a <goto> inside an <if> can target a <label> after it). That maps
 * naturally onto a program counter over a linear instruction array, so the
 * compiler lowers <if>/<else> into conditional jumps and resolves every
 * label/anchor to an instruction index (see compileNML()).
 *
 * The runtime is async: <click>, <blank>, <input> and <option> suspend until
 * the host (the renderer/UI, or a test/headless host) resolves them. Everything
 * the engine cannot do on its own is delegated through the NMLHost interface,
 * which Phase 2's PixiJS renderer will implement.
 */

import {
  getTagSpec,
  parseBool,
  parseLifeValue,
  parseNumber,
  speedToCps,
  type SpeedMode,
  type SpeedOptions,
} from './tags/TagSpec';
import { LocalState } from '../state/LocalState';
import { GlobalState } from '../state/GlobalState';
import type {
  CompiledProgram,
  IfNode,
  InputNode,
  Instruction,
  LifeChange,
  LifeText,
  NMLDiagnostic,
  NMLNode,
  NMLProgram,
  OptionNode,
  ResolvedChoice,
  ResolvedKey,
  TagNode,
} from './NMLTypes';

// ---------------------------------------------------------------------------
// Host interface (the renderer / UI / test boundary)
// ---------------------------------------------------------------------------

export interface TextContext {
  /** current <speed> value */
  speed: number;
  /** derived characters-per-second for the Typewriter (Infinity = instant) */
  cps: number;
}

export interface ImageCommand {
  src?: string;
  level: number;
  /** "in" shows/transitions in, "out" hides */
  state: 'in' | 'out';
  /** transition duration in frames (15fps) */
  timeFrames: number;
}

export interface LifeUpdate {
  /** life value after applying the change */
  value: number;
  /** signed delta actually applied (0 for an absolute set with no net change) */
  delta: number;
  change: LifeChange;
  text: LifeText;
}

/**
 * Everything the NML engine cannot do by itself. All methods may be sync or
 * async; the executor awaits them. Only the four core methods are required.
 */
export interface NMLHost {
  // --- text (required) ---
  printText(text: string, ctx: TextContext): void | Promise<void>;
  clearText(): void | Promise<void>;
  // --- pacing (required) ---
  waitClick(): void | Promise<void>;
  waitBlank(frames: number): void | Promise<void>;

  // --- optional ---
  setTitle?(title: string): void | Promise<void>;
  lineBreak?(): void | Promise<void>;
  playAnim?(name: string): void | Promise<void>;
  setVoice?(level: number): void | Promise<void>;
  changeLife?(update: LifeUpdate): void | Promise<void>;
  setLifeText?(text: LifeText): void | Promise<void>;
  image?(cmd: ImageCommand): void | Promise<void>;
  /** Preload an asset; resolve true on success. Sets the `flag` variable. */
  preload?(src: string): boolean | Promise<boolean>;
  geturl?(url: string, opts: Record<string, string>): void | Promise<void>;
  /** Free-text input; resolve with what the player typed. */
  requestInput?(variable: string): string | Promise<string>;
  /** Multiple-choice menu; resolve with the chosen index. */
  requestChoice?(choices: ResolvedChoice[]): number | Promise<number>;
  makeUser?(name: string, passwd: string): boolean | Promise<boolean>;
  login?(name: string, passwd: string, autologin: boolean): boolean | Promise<boolean>;
  item?(type: string, action: string): void | Promise<void>;
  mail?(address: string): void | Promise<void>;
  onEnd?(evaluate: boolean): void | Promise<void>;
}

export interface RunOptions {
  /** seed variables (e.g. preloaded global values) before the run */
  initialVars?: Record<string, string>;
  /** starting life/mental-power value */
  startLife?: number;
  /** how <speed> maps to characters-per-second */
  speedMode?: SpeedMode;
  fps?: number;
  /** initial <speed> before the script sets one */
  initialSpeed?: number;
  /** keyword routing: 'contains' (default, blog-style) or 'exact' */
  keywordMatch?: 'contains' | 'exact';
  /** cooperative cancellation */
  signal?: AbortSignal;
}

export interface RunResult {
  ended: boolean; // reached <end> / lose
  evaluate: boolean; // whether the run counts toward evaluation/scoring
  life: number;
  vars: Record<string, string>;
  diagnostics: NMLDiagnostic[];
}

// ---------------------------------------------------------------------------
// Compiler: AST -> flat instruction stream
// ---------------------------------------------------------------------------

class Compiler {
  private readonly instrs: Instruction[] = [];
  private readonly labels = new Map<string, number>();
  private readonly patches: Array<() => void> = [];
  private readonly diagnostics: NMLDiagnostic[] = [];

  compile(nodes: NMLNode[]): CompiledProgram {
    this.emitNodes(nodes);
    for (const patch of this.patches) patch();
    return { instructions: this.instrs, labels: this.labels, diagnostics: this.diagnostics };
  }

  private push(instr: Instruction): number {
    this.instrs.push(instr);
    return this.instrs.length - 1;
  }

  private emitNodes(nodes: NMLNode[]): void {
    for (const node of nodes) this.emitNode(node);
  }

  private emitNode(node: NMLNode): void {
    switch (node.kind) {
      case 'text':
        this.push({ op: 'text', text: node.text });
        break;
      case 'if':
        this.emitIf(node);
        break;
      case 'input':
        this.emitInput(node);
        break;
      case 'option':
        this.emitOption(node);
        break;
      case 'tag':
        this.emitTag(node);
        break;
    }
  }

  private emitTag(node: TagNode): void {
    const name = node.name;
    if (name === 'label' || name === 'a') {
      const key = node.attrs.value ?? node.positional ?? '';
      const idx = this.push({ op: 'label', name: key });
      if (key) {
        if (this.labels.has(key)) {
          this.diagnostics.push({ severity: 'warning', message: `Duplicate label "${key}"`, pos: node.pos });
        }
        this.labels.set(key, idx);
      }
      return;
    }
    if (name === 'goto') {
      const target = node.attrs.value ?? node.positional ?? '';
      const jump = { op: 'jump' as const, target: -1 };
      this.push(jump);
      this.patches.push(() => {
        const t = this.labels.get(target);
        if (t === undefined) {
          this.diagnostics.push({ severity: 'warning', message: `<goto> unresolved label "${target}"`, pos: node.pos });
          jump.target = this.instrs.length; // jump past the end == stop
        } else {
          jump.target = t;
        }
      });
      return;
    }
    if (name === 'end') {
      this.push({ op: 'end', evaluate: parseBool(node.attrs.evaluate, true) });
      return;
    }
    const instr: Instruction = { op: 'tag', name, attrs: node.attrs };
    if (node.positional !== undefined) instr.positional = node.positional;
    this.push(instr);
  }

  private emitIf(node: IfNode): void {
    const f = { op: 'ifFalseJump' as const, name: node.name, value: node.value, target: -1 };
    this.push(f);
    this.emitNodes(node.then);
    if (node.otherwise) {
      const j = { op: 'jump' as const, target: -1 };
      this.push(j);
      f.target = this.instrs.length; // else branch starts here
      this.emitNodes(node.otherwise);
      j.target = this.instrs.length; // resume after else
    } else {
      f.target = this.instrs.length; // resume after then
    }
  }

  private emitInput(node: InputNode): void {
    const keys: ResolvedKey[] = node.keys.map((k) => ({ value: k.value, target: -1 }));
    this.push({ op: 'input', variable: node.variable, keys });
    node.keys.forEach((k, i) => {
      this.patches.push(() => {
        const t = this.labels.get(k.label);
        keys[i]!.target = t ?? -1;
        if (t === undefined && k.label) {
          this.diagnostics.push({ severity: 'warning', message: `<key> unresolved label "${k.label}"`, pos: k.pos });
        }
      });
    });
  }

  private emitOption(node: OptionNode): void {
    const choices: ResolvedChoice[] = node.choices.map((c) => ({
      text: c.text,
      powerChange: c.powerChange,
      action: c.action.type === 'anchor' ? { type: 'unresolved', label: c.action.target } : c.action,
    }));
    this.push({ op: 'option', choices });
    node.choices.forEach((c, i) => {
      if (c.action.type === 'anchor') {
        const label = c.action.target;
        this.patches.push(() => {
          const t = this.labels.get(label);
          if (t !== undefined) {
            choices[i]!.action = { type: 'jump', target: t };
          } else {
            this.diagnostics.push({ severity: 'warning', message: `option unresolved anchor "${label}"`, pos: c.pos });
          }
        });
      }
    });
  }
}

/** Compile a parsed program (or raw node list) to a flat instruction stream. */
export function compileNML(program: NMLProgram | NMLNode[]): CompiledProgram {
  const nodes = Array.isArray(program) ? program : program.nodes;
  const compiled = new Compiler().compile(nodes);
  if (!Array.isArray(program)) {
    compiled.diagnostics.unshift(...program.diagnostics);
  }
  return compiled;
}

// ---------------------------------------------------------------------------
// Executor (runtime)
// ---------------------------------------------------------------------------

const CONVENTION_LOGIN_VAR = 'user_login';

export class NMLExecutor {
  readonly local = new LocalState();
  life = 0;

  private lifeText: LifeText = {};
  private speed = 1;
  private stopped = false;
  private speedOpts: SpeedOptions = {};
  private keywordMatch: 'contains' | 'exact' = 'contains';

  constructor(
    private readonly host: NMLHost,
    private readonly global: GlobalState = new GlobalState(),
  ) {}

  /** Cooperatively stop a run in progress. */
  stop(): void {
    this.stopped = true;
  }

  async run(program: NMLProgram | CompiledProgram | NMLNode[], opts: RunOptions = {}): Promise<RunResult> {
    const compiled = toCompiled(program);
    this.stopped = false;
    this.speed = opts.initialSpeed ?? 1;
    this.keywordMatch = opts.keywordMatch ?? 'contains';
    this.speedOpts = { mode: opts.speedMode ?? 'fpc', fps: opts.fps ?? 15 };
    if (opts.startLife !== undefined) this.life = opts.startLife;
    if (opts.initialVars) this.local.load(opts.initialVars);

    const instrs = compiled.instructions;
    let pc = 0;
    let ended = false;
    let evaluate = true;

    while (pc < instrs.length) {
      if (this.stopped || opts.signal?.aborted) break;
      const instr = instrs[pc]!;
      switch (instr.op) {
        case 'text':
          await this.host.printText(instr.text, this.textCtx());
          pc++;
          break;
        case 'label':
          pc++;
          break;
        case 'jump':
          pc = instr.target;
          break;
        case 'ifFalseJump':
          pc = this.local.equals(instr.name, instr.value) ? pc + 1 : instr.target;
          break;
        case 'end':
          ended = true;
          evaluate = instr.evaluate;
          await this.host.onEnd?.(evaluate);
          pc = instrs.length;
          break;
        case 'input':
          pc = await this.execInput(instr, pc);
          break;
        case 'option': {
          const next = await this.execOption(instr, pc, instrs.length);
          if (next.lose) {
            ended = true;
            evaluate = false;
          }
          pc = next.pc;
          break;
        }
        case 'tag':
          await this.execTag(instr);
          pc++;
          break;
      }
    }

    return { ended, evaluate, life: this.life, vars: this.local.snapshot(), diagnostics: compiled.diagnostics };
  }

  private textCtx(): TextContext {
    return { speed: this.speed, cps: speedToCps(this.speed, this.speedOpts) };
  }

  private async execInput(instr: Extract<Instruction, { op: 'input' }>, pc: number): Promise<number> {
    const answer = (await this.host.requestInput?.(instr.variable)) ?? '';
    if (instr.variable) this.local.set(instr.variable, answer);
    for (const key of instr.keys) {
      if (key.value && this.matchesKeyword(answer, key.value) && key.target >= 0) {
        return key.target;
      }
    }
    return pc + 1;
  }

  private matchesKeyword(answer: string, keyword: string): boolean {
    const a = answer.trim();
    const k = keyword.trim();
    if (!k) return false;
    return this.keywordMatch === 'exact' ? a === k : a.includes(k);
  }

  private async execOption(
    instr: Extract<Instruction, { op: 'option' }>,
    pc: number,
    end: number,
  ): Promise<{ pc: number; lose?: boolean }> {
    const idx = (await this.host.requestChoice?.(instr.choices)) ?? 0;
    const choice = instr.choices[idx];
    if (!choice) return { pc: pc + 1 };
    if (choice.powerChange) this.applyLife({ kind: 'relative', delta: choice.powerChange });
    const action = choice.action;
    switch (action.type) {
      case 'jump':
        return { pc: action.target };
      case 'clear':
        await this.host.clearText();
        return { pc: pc + 1 };
      case 'lose':
        await this.host.onEnd?.(false);
        return { pc: end, lose: true };
      case 'url':
        await this.host.geturl?.(action.url, {});
        return { pc: pc + 1 };
      case 'sick':
        this.local.set('sick', action.id);
        return { pc: pc + 1 };
      case 'unresolved':
        return { pc: pc + 1 };
    }
  }

  private async execTag(instr: Extract<Instruction, { op: 'tag' }>): Promise<void> {
    const { name, attrs } = instr;
    switch (name) {
      case 'title':
        await this.host.setTitle?.(attrs.value ?? '');
        break;
      case 'speed':
        this.speed = parseNumber(attrs.value, this.speed);
        break;
      case 'blank':
        await this.host.waitBlank(parseNumber(attrs.value, 0));
        break;
      case 'click':
        await this.host.waitClick();
        break;
      case 'clear':
        await this.host.clearText();
        break;
      case 'br':
        if (this.host.lineBreak) await this.host.lineBreak();
        else await this.host.printText('\n', this.textCtx());
        break;
      case 'voice':
        await this.host.setVoice?.(parseNumber(attrs.value, 0));
        break;
      case 'anim':
        await this.host.playAnim?.(attrs.value ?? '');
        break;
      case 'get': {
        const varName = attrs.name ?? attrs.value ?? instr.positional ?? '';
        await this.host.printText(this.resolveVar(varName), this.textCtx());
        break;
      }
      case 'set':
        await this.execSet(attrs);
        break;
      case 'life':
        if (attrs.value !== undefined) this.applyLife(parseLifeValue(attrs.value));
        break;
      case 'lifetext':
        this.lifeText = {
          ...(attrs.prefix !== undefined ? { prefix: attrs.prefix } : {}),
          ...(attrs.up !== undefined ? { up: attrs.up } : {}),
          ...(attrs.down !== undefined ? { down: attrs.down } : {}),
          ...(attrs.set !== undefined ? { set: attrs.set } : {}),
        };
        await this.host.setLifeText?.(this.lifeText);
        break;
      case 'image':
        await this.host.image?.({
          ...(attrs.src !== undefined ? { src: attrs.src } : {}),
          level: parseNumber(attrs.level, 1),
          state: attrs.state === 'out' ? 'out' : 'in',
          timeFrames: parseNumber(attrs.time, 0),
        });
        break;
      case 'preload':
        await this.execPreload(attrs);
        break;
      case 'geturl':
        await this.host.geturl?.(attrs.value ?? '', attrs);
        break;
      case 'makeuser': {
        const ok = (await this.host.makeUser?.(attrs.name ?? '', attrs.passwd ?? '')) ?? false;
        if (ok) await this.setLogin(true);
        break;
      }
      case 'login': {
        const ok =
          (await this.host.login?.(attrs.name ?? '', attrs.passwd ?? '', parseBool(attrs.autologin))) ?? false;
        await this.setLogin(ok);
        break;
      }
      case 'item':
        await this.host.item?.(attrs.type ?? '', attrs.action ?? '');
        break;
      case 'mail':
        await this.host.mail?.(attrs.value ?? '');
        break;
      default:
        // Unknown/no-op tag (the validator already warns); ignore at runtime.
        if (!getTagSpec(name)) {
          /* genuinely unknown */
        }
        break;
    }
  }

  private async execSet(attrs: Record<string, string>): Promise<void> {
    const name = attrs.name;
    if (!name) return;
    const value = attrs.value ?? '';
    this.local.set(name, value);
    if (parseBool(attrs.global)) await this.global.set(name, value);
  }

  private async execPreload(attrs: Record<string, string>): Promise<void> {
    const src = attrs.src ?? '';
    let ok = true;
    if (this.host.preload) ok = await this.host.preload(src);
    if (attrs.flag) {
      const value = ok ? 'true' : 'false';
      this.local.set(attrs.flag, value);
    }
  }

  /**
   * Convention: a successful <login>/<makeuser> marks the session as logged in
   * via the `user_login` variable (which scripts like kagi_test.nml test). The
   * value is written through to global state so it survives across scripts.
   */
  private async setLogin(ok: boolean): Promise<void> {
    const value = ok ? 'true' : 'false';
    this.local.set(CONVENTION_LOGIN_VAR, value);
    await this.global.set(CONVENTION_LOGIN_VAR, value);
  }

  private resolveVar(name: string): string {
    if (this.local.has(name)) return this.local.getOrEmpty(name);
    return this.global.getCached(name) ?? '';
  }

  private applyLife(change: LifeChange): void {
    const before = this.life;
    switch (change.kind) {
      case 'absolute':
        this.life = change.value;
        break;
      case 'relative':
        this.life += change.delta;
        break;
      case 'range':
        this.life = Math.max(change.min, Math.min(change.max, this.life + change.delta));
        break;
    }
    void this.host.changeLife?.({ value: this.life, delta: this.life - before, change, text: this.lifeText });
  }
}

function toCompiled(program: NMLProgram | CompiledProgram | NMLNode[]): CompiledProgram {
  if (Array.isArray(program)) return compileNML(program);
  if ('instructions' in program) return program;
  return compileNML(program);
}
