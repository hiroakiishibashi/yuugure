/**
 * RecordingHost - A headless NMLHost for tests and CI.
 *
 * It resolves all waits instantly, records every host call as a structured
 * event, accumulates the printed text, and lets a test script the answers to
 * <input> / <option> / <login> up front. This makes executor behaviour fully
 * deterministic and synchronous-ish (awaits settle immediately).
 */

import type {
  ImageCommand,
  LifeUpdate,
  NMLHost,
  TextContext,
} from '../NMLExecutor';
import type { LifeText, ResolvedChoice } from '../NMLTypes';

export type HostEvent =
  | { type: 'title'; value: string }
  | { type: 'text'; value: string }
  | { type: 'lineBreak' }
  | { type: 'clear' }
  | { type: 'click' }
  | { type: 'blank'; frames: number }
  | { type: 'anim'; name: string }
  | { type: 'voice'; level: number }
  | { type: 'life'; value: number; delta: number }
  | { type: 'lifetext'; text: LifeText }
  | { type: 'image'; cmd: ImageCommand }
  | { type: 'preload'; src: string; ok: boolean }
  | { type: 'geturl'; url: string }
  | { type: 'input'; variable: string; answer: string }
  | { type: 'choice'; index: number }
  | { type: 'item'; itemType: string; action: string }
  | { type: 'mail'; address: string }
  | { type: 'login'; name: string; ok: boolean }
  | { type: 'makeuser'; name: string; ok: boolean }
  | { type: 'end'; evaluate: boolean };

export interface RecordingHostOptions {
  /** answers fed to successive <input> tags (queue), or a function */
  inputs?: string[] | ((variable: string, n: number) => string);
  /** choices fed to successive <option> tags (queue of indices), or a function */
  choices?: number[] | ((choices: ResolvedChoice[], n: number) => number);
  loginOk?: boolean | ((name: string, passwd: string) => boolean);
  makeUserOk?: boolean;
  preloadOk?: boolean;
}

export class RecordingHost implements NMLHost {
  readonly events: HostEvent[] = [];
  /** all text printed since the last clear */
  buffer = '';
  /** full transcript of printed text, ignoring clears */
  transcript = '';

  private inputN = 0;
  private choiceN = 0;

  constructor(private readonly opts: RecordingHostOptions = {}) {}

  printText(text: string, _ctx: TextContext): void {
    this.buffer += text;
    this.transcript += text;
    this.events.push({ type: 'text', value: text });
  }

  clearText(): void {
    this.buffer = '';
    this.events.push({ type: 'clear' });
  }

  waitClick(): void {
    this.events.push({ type: 'click' });
  }

  waitBlank(frames: number): void {
    this.events.push({ type: 'blank', frames });
  }

  setTitle(value: string): void {
    this.events.push({ type: 'title', value });
  }

  lineBreak(): void {
    this.buffer += '\n';
    this.transcript += '\n';
    this.events.push({ type: 'lineBreak' });
  }

  playAnim(name: string): void {
    this.events.push({ type: 'anim', name });
  }

  setVoice(level: number): void {
    this.events.push({ type: 'voice', level });
  }

  changeLife(update: LifeUpdate): void {
    this.events.push({ type: 'life', value: update.value, delta: update.delta });
  }

  setLifeText(text: LifeText): void {
    this.events.push({ type: 'lifetext', text });
  }

  image(cmd: ImageCommand): void {
    this.events.push({ type: 'image', cmd });
  }

  preload(src: string): boolean {
    const ok = this.opts.preloadOk ?? true;
    this.events.push({ type: 'preload', src, ok });
    return ok;
  }

  geturl(url: string): void {
    this.events.push({ type: 'geturl', url });
  }

  requestInput(variable: string): string {
    const { inputs } = this.opts;
    const answer = typeof inputs === 'function' ? inputs(variable, this.inputN) : (inputs?.[this.inputN] ?? '');
    this.inputN++;
    this.events.push({ type: 'input', variable, answer });
    return answer;
  }

  requestChoice(choices: ResolvedChoice[]): number {
    const { choices: c } = this.opts;
    const index = typeof c === 'function' ? c(choices, this.choiceN) : (c?.[this.choiceN] ?? 0);
    this.choiceN++;
    this.events.push({ type: 'choice', index });
    return index;
  }

  makeUser(name: string): boolean {
    const ok = this.opts.makeUserOk ?? true;
    this.events.push({ type: 'makeuser', name, ok });
    return ok;
  }

  login(name: string, passwd: string): boolean {
    const { loginOk } = this.opts;
    const ok = typeof loginOk === 'function' ? loginOk(name, passwd) : (loginOk ?? true);
    this.events.push({ type: 'login', name, ok });
    return ok;
  }

  item(itemType: string, action: string): void {
    this.events.push({ type: 'item', itemType, action });
  }

  mail(address: string): void {
    this.events.push({ type: 'mail', address });
  }

  onEnd(evaluate: boolean): void {
    this.events.push({ type: 'end', evaluate });
  }

  /** Convenience: every printed text segment, in order. */
  texts(): string[] {
    return this.events.filter((e): e is Extract<HostEvent, { type: 'text' }> => e.type === 'text').map((e) => e.value);
  }

  /** Convenience: event type names in order, for compact assertions. */
  eventTypes(): string[] {
    return this.events.map((e) => e.type);
  }
}
