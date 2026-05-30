/**
 * NMLParser - A custom tokenizer + parser for NML scripts.
 *
 * ── Why not fast-xml-parser / a standard XML parser? ────────────────────────
 * NML *looks* like XML but is not well-formed XML, so an XML parser cannot read
 * the real game scripts. The grammar requires bespoke handling:
 *
 *   1. Void tags are written without a self-closing slash and never closed:
 *        <title value="x">      (then free text follows, no </title>)
 *      An XML parser would nest the rest of the document inside <title>.
 *   2. Positional / shorthand arguments, with or without quotes:
 *        <goto "load_ok">   <a 1>   <blank 30>   <anim idle>
 *      These are not legal XML attributes (no attribute name).
 *   3. <else> is a bare separator inside <if>…</if>, not <else>…</else>.
 *   4. Comments routinely contain runs of dashes: <!------ title ------>.
 *   5. <option> bodies use a line-based `text >> action >> power;` sub-grammar,
 *      not nested tags.
 *
 * So we tokenize manually (quote-aware), then build the AST defined in
 * NMLTypes.ts. The parser is deliberately lenient: malformed input produces
 * diagnostics rather than exceptions, because the source scripts are 20-year-old
 * hand-authored files of varying quality.
 *
 * Encoding note: the original .nml files are Shift-JIS. Decode them to UTF-8
 * (the asset pipeline's job) before handing the string to this parser.
 */

import {
  getTagSpec,
  isBlockTag,
} from './tags/TagSpec';
import type {
  IfNode,
  InputNode,
  KeyDef,
  NMLDiagnostic,
  NMLNode,
  NMLProgram,
  OptionAction,
  OptionChoice,
  OptionNode,
  SourcePos,
  TagNode,
  TextNode,
} from './NMLTypes';

// ---------------------------------------------------------------------------
// Tokenizer
// ---------------------------------------------------------------------------

type Token =
  | { type: 'text'; raw: string; pos: SourcePos }
  | { type: 'comment'; raw: string; pos: SourcePos }
  | { type: 'tag'; tag: TagToken; pos: SourcePos };

interface TagToken {
  name: string;
  attrs: Record<string, string>;
  positional?: string;
  selfClosing: boolean;
  isClosing: boolean;
}

const ASCII_WS = /[ \t\r\n]/;

function isTagStartChar(c: string): boolean {
  return /[A-Za-z/!]/.test(c);
}

function isNameChar(c: string): boolean {
  return /[A-Za-z0-9_]/.test(c);
}

/** Strip only ASCII whitespace/newlines from the ends, preserving内部 newlines
 *  and full-width spaces (　, U+3000) which are meaningful in dialogue. */
function trimAsciiWs(s: string): string {
  let start = 0;
  let end = s.length;
  while (start < end && ASCII_WS.test(s[start]!)) start++;
  while (end > start && ASCII_WS.test(s[end - 1]!)) end--;
  return s.slice(start, end);
}

function isBlankAscii(s: string): boolean {
  return trimAsciiWs(s).length === 0;
}

class Tokenizer {
  private i = 0;
  private line = 1;
  private col = 1;
  readonly diagnostics: NMLDiagnostic[] = [];

  constructor(private readonly src: string) {}

  private pos(): SourcePos {
    return { line: this.line, col: this.col, offset: this.i };
  }

  private advance(n = 1): void {
    for (let k = 0; k < n; k++) {
      if (this.src[this.i] === '\n') {
        this.line++;
        this.col = 1;
      } else {
        this.col++;
      }
      this.i++;
    }
  }

  tokenize(): Token[] {
    const tokens: Token[] = [];
    const src = this.src;
    while (this.i < src.length) {
      const c = src[this.i]!;
      if (c === '<' && this.i + 1 < src.length && isTagStartChar(src[this.i + 1]!)) {
        if (src.startsWith('<!--', this.i)) {
          tokens.push(this.readComment());
        } else if (src[this.i + 1] === '!') {
          // <!DOCTYPE …> style — treat as a comment-ish skip to '>'
          tokens.push(this.readComment(true));
        } else {
          tokens.push(this.readTag());
        }
      } else {
        tokens.push(this.readText());
      }
    }
    return tokens;
  }

  private readComment(declaration = false): Token {
    const pos = this.pos();
    const start = this.i;
    const close = declaration ? '>' : '-->';
    const idx = this.src.indexOf(close, this.i + (declaration ? 1 : 4));
    if (idx === -1) {
      this.diagnostics.push({ severity: 'warning', message: 'Unterminated comment', pos });
      this.advance(this.src.length - this.i);
      return { type: 'comment', raw: this.src.slice(start), pos };
    }
    const endExclusive = idx + close.length;
    this.advance(endExclusive - this.i);
    return { type: 'comment', raw: this.src.slice(start, endExclusive), pos };
  }

  private readText(): Token {
    const pos = this.pos();
    const start = this.i;
    const src = this.src;
    while (this.i < src.length) {
      const c = src[this.i]!;
      if (c === '<' && this.i + 1 < src.length && isTagStartChar(src[this.i + 1]!)) break;
      this.advance();
    }
    return { type: 'text', raw: src.slice(start, this.i), pos };
  }

  /** Read `<...>` honoring quotes so a '>' inside an attribute value is safe. */
  private readTag(): Token {
    const pos = this.pos();
    this.advance(); // consume '<'
    const innerStart = this.i;
    const src = this.src;
    let quote: string | null = null;
    while (this.i < src.length) {
      const c = src[this.i]!;
      if (quote) {
        if (c === quote) quote = null;
      } else if (c === '"' || c === "'") {
        quote = c;
      } else if (c === '>') {
        break;
      }
      this.advance();
    }
    const inner = src.slice(innerStart, this.i);
    if (src[this.i] === '>') {
      this.advance(); // consume '>'
    } else {
      this.diagnostics.push({ severity: 'warning', message: `Unterminated tag <${inner.slice(0, 20)}…`, pos });
    }
    return { type: 'tag', tag: this.parseTagInner(inner), pos };
  }

  private parseTagInner(inner: string): TagToken {
    let s = inner;
    let isClosing = false;
    let selfClosing = false;

    if (s.startsWith('/')) {
      isClosing = true;
      s = s.slice(1);
    }
    if (s.endsWith('/')) {
      selfClosing = true;
      s = s.slice(0, -1);
    }
    s = s.trim();

    // tag name
    let p = 0;
    let name = '';
    while (p < s.length && isNameChar(s[p]!)) {
      name += s[p];
      p++;
    }
    name = name.toLowerCase();

    const attrs: Record<string, string> = {};
    let positional: string | undefined;

    // attributes
    while (p < s.length) {
      // skip whitespace
      while (p < s.length && ASCII_WS.test(s[p]!)) p++;
      if (p >= s.length) break;

      const c = s[p]!;
      if (c === '"' || c === "'") {
        // bare quoted positional: <goto "label">
        const { value, next } = readQuoted(s, p);
        if (positional === undefined) positional = value;
        p = next;
        continue;
      }

      // read a bareword (attribute key or bareword positional)
      let word = '';
      while (p < s.length && !ASCII_WS.test(s[p]!) && s[p] !== '=') {
        word += s[p];
        p++;
      }
      // skip whitespace before a possible '='
      let q = p;
      while (q < s.length && ASCII_WS.test(s[q]!)) q++;
      if (s[q] === '=') {
        // key = value
        q++;
        while (q < s.length && ASCII_WS.test(s[q]!)) q++;
        let value: string;
        if (s[q] === '"' || s[q] === "'") {
          const r = readQuoted(s, q);
          value = r.value;
          q = r.next;
        } else {
          let v = '';
          while (q < s.length && !ASCII_WS.test(s[q]!)) {
            v += s[q];
            q++;
          }
          value = v;
        }
        if (word) attrs[word.toLowerCase()] = value;
        p = q;
      } else {
        // bareword positional: <anim idle>, <speed 2>, <a 1>
        // (p has already advanced past the word)
        if (word && positional === undefined) positional = word;
      }
    }

    // Map a positional value onto its canonical attribute, per the registry.
    if (positional !== undefined) {
      const spec = getTagSpec(name);
      if (spec?.positional && attrs[spec.positional] === undefined) {
        attrs[spec.positional] = positional;
      }
    }

    return { name, attrs, positional, selfClosing, isClosing };
  }
}

function readQuoted(s: string, at: number): { value: string; next: number } {
  const quote = s[at]!;
  let p = at + 1;
  let value = '';
  while (p < s.length && s[p] !== quote) {
    value += s[p];
    p++;
  }
  if (s[p] === quote) p++; // consume closing quote
  return { value, next: p };
}

// ---------------------------------------------------------------------------
// Parser (tokens -> AST)
// ---------------------------------------------------------------------------

export class NMLParser {
  parse(source: string): NMLProgram {
    const tokenizer = new Tokenizer(source);
    const tokens = tokenizer.tokenize();
    const diagnostics: NMLDiagnostic[] = [...tokenizer.diagnostics];

    // Narrow to the <nml>…</nml> body if present (lenient: otherwise whole doc).
    const body = sliceProgramBody(tokens, diagnostics);

    const parser = new NodeParser(body, diagnostics);
    const nodes = parser.parseNodes(new Set());
    if (parser.cursor < body.length) {
      const tok = body[parser.cursor]!;
      diagnostics.push({
        severity: 'warning',
        message: `Unexpected trailing content after parsing (token #${parser.cursor})`,
        pos: tok.pos,
      });
    }
    return { nodes, diagnostics };
  }
}

/** Find the first `<nml>` open token and its matching `</nml>`. */
function sliceProgramBody(tokens: Token[], diagnostics: NMLDiagnostic[]): Token[] {
  let open = -1;
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]!;
    if (t.type === 'tag' && t.tag.name === 'nml' && !t.tag.isClosing) {
      open = i;
      break;
    }
  }
  if (open === -1) return tokens; // no wrapper — treat the whole document as body

  let depth = 0;
  for (let i = open; i < tokens.length; i++) {
    const t = tokens[i]!;
    if (t.type !== 'tag' || t.tag.name !== 'nml') continue;
    if (t.tag.isClosing) {
      depth--;
      if (depth === 0) return tokens.slice(open + 1, i);
    } else {
      depth++;
    }
  }
  diagnostics.push({ severity: 'warning', message: 'Missing </nml> close tag', pos: tokens[open]!.pos });
  return tokens.slice(open + 1);
}

class NodeParser {
  cursor = 0;
  constructor(
    private readonly tokens: Token[],
    private readonly diagnostics: NMLDiagnostic[],
  ) {}

  /** Parse a run of nodes until a closing tag whose name is in `stop`, or a
   *  marker name in `stop` (for <else>). The terminating token is left
   *  unconsumed so the caller can inspect it. */
  parseNodes(stop: Set<string>): NMLNode[] {
    const nodes: NMLNode[] = [];
    while (this.cursor < this.tokens.length) {
      const tok = this.tokens[this.cursor]!;

      if (tok.type === 'comment') {
        this.cursor++;
        continue;
      }

      if (tok.type === 'text') {
        if (!isBlankAscii(tok.raw)) {
          const node: TextNode = { kind: 'text', text: trimAsciiWs(tok.raw), pos: tok.pos };
          nodes.push(node);
        }
        this.cursor++;
        continue;
      }

      // tag token
      const tag = tok.tag;
      if (tag.isClosing) {
        if (stop.has(tag.name)) return nodes; // caller consumes the close tag
        this.diagnostics.push({ severity: 'warning', message: `Stray closing tag </${tag.name}>`, pos: tok.pos });
        this.cursor++;
        continue;
      }
      if (tag.name === 'else' && stop.has('else')) {
        return nodes; // caller (parseIf) handles the <else> marker
      }

      if (isBlockTag(tag.name)) {
        const node = this.parseBlock(tok, tag);
        if (node) nodes.push(node);
        continue;
      }

      // simple/void tag
      const tagNode: TagNode = {
        kind: 'tag',
        name: tag.name,
        attrs: tag.attrs,
        ...(tag.positional !== undefined ? { positional: tag.positional } : {}),
        selfClosing: tag.selfClosing,
        pos: tok.pos,
      };
      nodes.push(tagNode);
      this.cursor++;
    }
    return nodes;
  }

  private parseBlock(tok: Token & { type: 'tag' }, tag: TagToken): NMLNode | null {
    switch (tag.name) {
      case 'if':
        return this.parseIf(tok, tag);
      case 'input':
        return this.parseInput(tok, tag);
      case 'option':
        return this.parseOption(tok);
      case 'nml':
        // A stray nested <nml>; unwrap its children inline.
        this.cursor++;
        return null;
      default:
        this.cursor++;
        return null;
    }
  }

  private parseIf(tok: Token & { type: 'tag' }, tag: TagToken): IfNode {
    this.cursor++; // consume <if>
    const then = this.parseNodes(new Set(['if', 'else']));
    let otherwise: NMLNode[] | null = null;

    const sep = this.tokens[this.cursor];
    if (sep && sep.type === 'tag' && sep.tag.name === 'else' && !sep.tag.isClosing) {
      this.cursor++; // consume <else>
      otherwise = this.parseNodes(new Set(['if']));
    }

    const closer = this.tokens[this.cursor];
    if (closer && closer.type === 'tag' && closer.tag.name === 'if' && closer.tag.isClosing) {
      this.cursor++; // consume </if>
    } else {
      this.diagnostics.push({ severity: 'warning', message: 'Unclosed <if> (missing </if>)', pos: tok.pos });
    }

    return {
      kind: 'if',
      name: tag.attrs.name ?? '',
      value: tag.attrs.value ?? '',
      then,
      otherwise,
      pos: tok.pos,
    };
  }

  private parseInput(tok: Token & { type: 'tag' }, tag: TagToken): InputNode {
    this.cursor++; // consume <input>
    const children = this.parseNodes(new Set(['input']));

    const closer = this.tokens[this.cursor];
    if (closer && closer.type === 'tag' && closer.tag.name === 'input' && closer.tag.isClosing) {
      this.cursor++; // consume </input>
    } else {
      this.diagnostics.push({ severity: 'warning', message: 'Unclosed <input> (missing </input>)', pos: tok.pos });
    }

    const keys: KeyDef[] = [];
    for (const child of children) {
      if (child.kind === 'tag' && child.name === 'key') {
        keys.push({
          label: child.attrs.label ?? '',
          value: child.attrs.value ?? '',
          pos: child.pos,
        });
      } else if (child.kind !== 'text') {
        this.diagnostics.push({ severity: 'warning', message: 'Unexpected node inside <input>', pos: child.pos });
      }
    }

    const variable = tag.attrs.value ?? tag.positional ?? '';
    return { kind: 'input', variable, keys, pos: tok.pos };
  }

  private parseOption(tok: Token & { type: 'tag' }): OptionNode {
    this.cursor++; // consume <option>
    // The body is line-based text, not nested tags. Collect raw text up to
    // </option> (any stray tag is reported and skipped).
    let raw = '';
    while (this.cursor < this.tokens.length) {
      const t = this.tokens[this.cursor]!;
      if (t.type === 'tag' && t.tag.name === 'option' && t.tag.isClosing) {
        this.cursor++; // consume </option>
        return { kind: 'option', choices: parseOptionBody(raw, tok.pos), pos: tok.pos };
      }
      if (t.type === 'text') raw += t.raw;
      else if (t.type === 'comment') {
        /* ignore */
      } else {
        this.diagnostics.push({ severity: 'warning', message: `Unexpected <${t.tag.name}> inside <option>`, pos: t.pos });
      }
      this.cursor++;
    }
    this.diagnostics.push({ severity: 'warning', message: 'Unclosed <option> (missing </option>)', pos: tok.pos });
    return { kind: 'option', choices: parseOptionBody(raw, tok.pos), pos: tok.pos };
  }
}

/** Parse `text >> action >> power;` lines into option choices. */
function parseOptionBody(raw: string, pos: SourcePos): OptionChoice[] {
  const choices: OptionChoice[] = [];
  for (const line of raw.split('\n')) {
    const trimmed = line.replace(/[　\s]+$/u, '').replace(/^[　\s]+/u, '');
    if (!trimmed || !trimmed.includes('>>')) continue;
    const body = trimmed.replace(/;\s*$/, '');
    const parts = body.split('>>').map((p) => p.replace(/[　\s]+$/u, '').replace(/^[　\s]+/u, ''));
    const text = parts[0] ?? '';
    const actionRaw = parts[1] ?? '';
    const powerRaw = parts[2] ?? '0';
    choices.push({
      text,
      action: parseOptionAction(actionRaw),
      powerChange: Number(powerRaw) || 0,
      pos,
    });
  }
  return choices;
}

function parseOptionAction(raw: string): OptionAction {
  const v = raw.trim();
  if (/^https?:\/\//i.test(v)) return { type: 'url', url: v };
  if (v === 'clear') return { type: 'clear' };
  if (v === 'lose') return { type: 'lose' };
  const sick = /^sick_(.+)$/.exec(v);
  if (sick) return { type: 'sick', id: sick[1]! };
  return { type: 'anchor', target: v };
}

/** Convenience helper. */
export function parseNML(source: string): NMLProgram {
  return new NMLParser().parse(source);
}
