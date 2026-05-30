/**
 * TagSpec - The authoritative NML tag registry.
 *
 * This single source of truth drives the parser (which tags are blocks vs.
 * void, how a bare positional argument maps to a named attribute), the
 * validator (known/required attributes), and the executor (dispatch).
 *
 * Adding support for a new tag = add an entry here.
 */

import type { LifeChange } from '../NMLTypes';

export type TagKind =
  | 'void' // standalone, no closing tag: <speed>, <set>, <goto>, <clear>, ...
  | 'block' // has children + a closing tag: <if>, <input>, <option>, <nml>
  | 'marker'; // standalone separator inside a block: <else>

export interface TagSpec {
  name: string;
  kind: TagKind;
  /**
   * Canonical attribute name a bare positional value maps to.
   * e.g. `<goto "load_ok">` and `<goto 2>` => attrs.value, so positional: 'value'.
   * `<get "user_id">` => attrs.name, so positional: 'name'.
   */
  positional?: string;
  /** Known attribute names (anything else triggers a validator warning). */
  attrs?: readonly string[];
  /** Attributes that must be present (validator error otherwise). The positional
   *  form counts as supplying its mapped attribute. */
  required?: readonly string[];
  desc?: string;
}

const VALUE = 'value';

/**
 * Registry of every supported NML tag (union of the 2003 game + 2010 spec
 * dialects). Names are lowercase; the tokenizer lowercases tag names.
 */
export const TAG_SPECS: Record<string, TagSpec> = {
  // ---- root / structure -------------------------------------------------
  nml: { name: 'nml', kind: 'block', desc: 'Program root (unwrapped by the parser).' },

  // ---- text & character -------------------------------------------------
  title: { name: 'title', kind: 'void', positional: VALUE, attrs: [VALUE], desc: 'Title text shown first.' },
  speed: { name: 'speed', kind: 'void', positional: VALUE, attrs: [VALUE], desc: 'Typewriter speed.' },
  blank: { name: 'blank', kind: 'void', positional: VALUE, attrs: [VALUE], desc: 'Pause for N frames (15fps).' },
  voice: { name: 'voice', kind: 'void', positional: VALUE, attrs: [VALUE], desc: 'Voice/SE volume.' },
  anim: { name: 'anim', kind: 'void', positional: VALUE, attrs: [VALUE], desc: 'Play a character animation.' },
  click: { name: 'click', kind: 'void', desc: 'Wait for a click, then clear.' },
  clear: { name: 'clear', kind: 'void', desc: 'Clear the on-screen text.' },
  br: { name: 'br', kind: 'void', desc: 'Insert a line break in the text.' },
  life: { name: 'life', kind: 'void', positional: VALUE, attrs: [VALUE], desc: 'Change the life/mental-power meter.' },
  lifetext: {
    name: 'lifetext',
    kind: 'void',
    attrs: ['prefix', 'up', 'down', 'set'],
    desc: 'Template strings for life-change messages.',
  },

  // ---- state & flow -----------------------------------------------------
  set: {
    name: 'set',
    kind: 'void',
    attrs: ['name', VALUE, 'global'],
    required: ['name'],
    desc: 'Assign a variable (global="true" persists to the server).',
  },
  get: {
    name: 'get',
    kind: 'void',
    positional: 'name',
    attrs: ['name'],
    required: ['name'],
    desc: 'Inline-print a variable value.',
  },
  if: {
    name: 'if',
    kind: 'block',
    attrs: ['name', VALUE],
    required: ['name'],
    desc: 'Conditional block; string-equality test of name against value.',
  },
  else: { name: 'else', kind: 'marker', desc: 'Else separator inside <if>.' },
  goto: {
    name: 'goto',
    kind: 'void',
    positional: VALUE,
    attrs: [VALUE],
    required: [VALUE],
    desc: 'Jump to a label / numeric anchor.',
  },
  label: {
    name: 'label',
    kind: 'void',
    positional: VALUE,
    attrs: [VALUE],
    required: [VALUE],
    desc: 'Named jump target (2003 dialect).',
  },
  a: {
    name: 'a',
    kind: 'void',
    positional: VALUE,
    attrs: [VALUE],
    required: [VALUE],
    desc: 'Numeric anchor / jump target (2010 dialect).',
  },

  // ---- input & choices --------------------------------------------------
  input: {
    name: 'input',
    kind: 'block',
    positional: VALUE,
    attrs: [VALUE],
    required: [VALUE],
    desc: 'Free-text input stored to a variable; may route via <key>.',
  },
  key: {
    name: 'key',
    kind: 'void',
    attrs: ['label', VALUE],
    required: ['label', VALUE],
    desc: 'Keyword route inside <input>.',
  },
  option: { name: 'option', kind: 'block', desc: 'Multiple-choice menu (line-based sub-grammar).' },

  // ---- assets -----------------------------------------------------------
  image: {
    name: 'image',
    kind: 'void',
    attrs: ['src', 'level', 'state', 'time'],
    desc: 'Show/hide a layered image (state="in"/"out").',
  },
  preload: {
    name: 'preload',
    kind: 'void',
    attrs: ['src', 'flag'],
    required: ['src'],
    desc: 'Preload an asset; sets `flag` variable to "true" when ready.',
  },
  geturl: {
    name: 'geturl',
    kind: 'void',
    positional: VALUE,
    attrs: [VALUE, 'width', 'height', 'menubar', 'location'],
    desc: 'Open an external URL (popup).',
  },

  // ---- user & items -----------------------------------------------------
  makeuser: {
    name: 'makeuser',
    kind: 'void',
    attrs: ['name', 'passwd'],
    required: ['name'],
    desc: 'Create a user account.',
  },
  login: {
    name: 'login',
    kind: 'void',
    attrs: ['name', 'passwd', 'autologin'],
    required: ['name'],
    desc: 'Authenticate a user.',
  },
  item: {
    name: 'item',
    kind: 'void',
    attrs: ['type', 'action'],
    required: ['type', 'action'],
    desc: 'Grant/consume an inventory item.',
  },
  mail: { name: 'mail', kind: 'void', positional: VALUE, attrs: [VALUE], desc: 'Send mail to the author.' },
  end: { name: 'end', kind: 'void', attrs: ['evaluate'], desc: 'Terminate the script (evaluate="false" skips scoring).' },
};

/** Block tags that own children and require a matching close tag. */
export const BLOCK_TAGS = new Set(
  Object.values(TAG_SPECS)
    .filter((s) => s.kind === 'block')
    .map((s) => s.name),
);

export function getTagSpec(name: string): TagSpec | undefined {
  return TAG_SPECS[name.toLowerCase()];
}

export function isBlockTag(name: string): boolean {
  return BLOCK_TAGS.has(name.toLowerCase());
}

export function isKnownTag(name: string): boolean {
  return name.toLowerCase() in TAG_SPECS;
}

// ---------------------------------------------------------------------------
// Value parsers
// ---------------------------------------------------------------------------

/** Parse a boolean-ish NML attribute. "true"/"1"/"yes"/"on" => true. */
export function parseBool(raw: string | undefined, fallback = false): boolean {
  if (raw == null) return fallback;
  const v = raw.trim().toLowerCase();
  if (v === 'true' || v === '1' || v === 'yes' || v === 'on') return true;
  if (v === 'false' || v === '0' || v === 'no' || v === 'off' || v === '') return false;
  return fallback;
}

/** Parse a numeric NML attribute, tolerating surrounding whitespace. */
export function parseNumber(raw: string | undefined, fallback = 0): number {
  if (raw == null) return fallback;
  const n = Number(raw.trim());
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Parse a `<life value="...">` argument into a structured change.
 *   "5"        -> { absolute: 5 }
 *   "+1"/"-3"  -> { relative: ±n }
 *   "0,10,-5"  -> { range: clamp to [0,10] then delta -5 }
 */
export function parseLifeValue(raw: string): LifeChange {
  const v = raw.trim();
  if (v.includes(',')) {
    const parts = v.split(',').map((p) => Number(p.trim()));
    const [min = 0, max = 0, delta = 0] = parts;
    return { kind: 'range', min, max, delta };
  }
  if (v.startsWith('+') || v.startsWith('-')) {
    return { kind: 'relative', delta: Number(v) || 0 };
  }
  return { kind: 'absolute', value: Number(v) || 0 };
}

/** How a `<speed>` value is interpreted as characters-per-second. */
export type SpeedMode =
  | 'fpc' // 2003 game dialect: value = frames-per-character delay; <=0 means instant
  | 'cpf'; // 2010 spec dialect: value = characters-per-frame

export interface SpeedOptions {
  mode?: SpeedMode;
  /** original engine ran at 15fps */
  fps?: number;
  /** chars-per-second used when a computed rate would be non-positive */
  minCps?: number;
}

/**
 * Convert an NML <speed> value to characters-per-second for the Typewriter.
 *
 * The two dialects disagree on direction, so the mode is explicit:
 *  - 'fpc' (default, matches のけものがたり where "-2" is described as fastest):
 *      speed <= 0  -> Infinity (reveal instantly)
 *      speed  > 0  -> fps / speed   (bigger value = slower)
 *  - 'cpf' (matches NML_spec20101015, default 0.3 chars/frame):
 *      cps = max(minCps, speed) * fps
 */
export function speedToCps(speed: number, opts: SpeedOptions = {}): number {
  const { mode = 'fpc', fps = 15, minCps = 1 } = opts;
  if (mode === 'cpf') {
    return Math.max(minCps, speed) * fps;
  }
  // 'fpc'
  if (speed <= 0) return Infinity;
  return Math.max(minCps, fps / speed);
}
