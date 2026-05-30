/**
 * NMLTypes - Shared type definitions for the NML engine.
 *
 * NML (Nokemonogatari Markup Language) is the bespoke XML-*like* scripting
 * language that drove the original Flash game "夕暮れ / のけものがたり".
 *
 * It is deliberately NOT valid XML — see NMLParser.ts for the full rationale —
 * so the engine is built on a custom tokenizer/parser that produces the AST
 * defined here, and a compiler/executor that runs it (NMLExecutor.ts).
 *
 * Two dialects are supported as a union:
 *   - 2003 game dialect  (のけものがたり): <label "x">, <goto "x">, <input><key>,
 *     attribute form `name="value"`, `<set>/<get>/<if>/<image>/<login>` etc.
 *   - 2010 spec dialect   (NML_spec20101015): <a N>, <goto N>, <option>, <br>,
 *     bareword args `<anim idle>`, `<speed 2>`, `<blank 30>`.
 */

/** A position in the source text. line/col are 1-based, offset is 0-based. */
export interface SourcePos {
  line: number;
  col: number;
  offset: number;
}

// ---------------------------------------------------------------------------
// AST
// ---------------------------------------------------------------------------

export type NMLNode = TextNode | TagNode | IfNode | InputNode | OptionNode;

/** A run of dialogue text. Internal newlines and full-width spaces (　) are
 *  preserved verbatim; surrounding ASCII whitespace is trimmed by the parser. */
export interface TextNode {
  kind: 'text';
  text: string;
  pos: SourcePos;
}

/** A simple (non-block) tag: title/speed/blank/set/get/goto/label/anim/... */
export interface TagNode {
  kind: 'tag';
  /** lowercased tag name */
  name: string;
  /** resolved attributes; a bare positional value is also mapped here under
   *  its canonical key (e.g. `<goto "x">` => attrs.value === "x"). */
  attrs: Record<string, string>;
  /** raw positional value if the tag used the shorthand form, else undefined */
  positional?: string;
  selfClosing: boolean;
  pos: SourcePos;
}

/** `<if name=".." value="..">...<else>...</if>` */
export interface IfNode {
  kind: 'if';
  name: string;
  value: string;
  then: NMLNode[];
  /** body after `<else>`, or null when there is no else branch */
  otherwise: NMLNode[] | null;
  pos: SourcePos;
}

/** A `<key label=".." value="..">` route inside an `<input>`. */
export interface KeyDef {
  label: string;
  value: string;
  pos: SourcePos;
}

/** `<input value="var">...<key/>...</input>` — free-text input that is stored
 *  into `variable`, optionally routing to a label when it matches a keyword. */
export interface InputNode {
  kind: 'input';
  variable: string;
  keys: KeyDef[];
  pos: SourcePos;
}

/** What an `<option>` choice does when selected (2010 dialect). */
export type OptionAction =
  | { type: 'anchor'; target: string } // jump to <a N> / <label "x">
  | { type: 'clear' } // go to the "clear" ending
  | { type: 'lose' } // go to the "lose" ending
  | { type: 'url'; url: string } // open an external URL
  | { type: 'sick'; id: string }; // set illness id (定期健診 only)

export interface OptionChoice {
  text: string;
  action: OptionAction;
  /** 精神力 (mental power / life) delta applied when this choice is taken */
  powerChange: number;
  pos: SourcePos;
}

/** `<option>line >> action >> power;\n...</option>` multiple-choice menu. */
export interface OptionNode {
  kind: 'option';
  choices: OptionChoice[];
  pos: SourcePos;
}

// ---------------------------------------------------------------------------
// Diagnostics & program
// ---------------------------------------------------------------------------

export interface NMLDiagnostic {
  severity: 'error' | 'warning';
  message: string;
  pos?: SourcePos;
}

export interface NMLProgram {
  /** body of the <nml> element (the <nml> wrapper itself is stripped) */
  nodes: NMLNode[];
  /** issues found while parsing; the parser is lenient and never throws */
  diagnostics: NMLDiagnostic[];
}

// ---------------------------------------------------------------------------
// Value models (shared by parser, validator, executor)
// ---------------------------------------------------------------------------

/** Parsed `<life value="...">`:
 *  - "5"        => absolute
 *  - "+1"/"-1"  => relative
 *  - "0,10,-5"  => range (clamp to [min,max], then apply delta) */
export type LifeChange =
  | { kind: 'absolute'; value: number }
  | { kind: 'relative'; delta: number }
  | { kind: 'range'; min: number; max: number; delta: number };

/** `<lifetext prefix=".." up=".." down=".." set="..">` template strings. */
export interface LifeText {
  prefix?: string;
  up?: string;
  down?: string;
  set?: string;
}

// ---------------------------------------------------------------------------
// Compiled program (flat instruction stream consumed by the executor)
// ---------------------------------------------------------------------------

export interface ResolvedKey {
  value: string;
  /** instruction index to jump to on match, or -1 if the label is unresolved */
  target: number;
}

export interface ResolvedChoice {
  text: string;
  powerChange: number;
  /** anchor actions are pre-resolved to an instruction index; others stay symbolic */
  action:
    | { type: 'jump'; target: number }
    | { type: 'clear' }
    | { type: 'lose' }
    | { type: 'url'; url: string }
    | { type: 'sick'; id: string }
    | { type: 'unresolved'; label: string };
}

export type Instruction =
  | { op: 'text'; text: string }
  | { op: 'tag'; name: string; attrs: Record<string, string>; positional?: string }
  | { op: 'ifFalseJump'; name: string; value: string; target: number } // jump if var !== value
  | { op: 'jump'; target: number }
  | { op: 'input'; variable: string; keys: ResolvedKey[] }
  | { op: 'option'; choices: ResolvedChoice[] }
  | { op: 'end'; evaluate: boolean }
  | { op: 'label'; name: string }; // no-op marker, retained for debugging/inspection

export interface CompiledProgram {
  instructions: Instruction[];
  /** label / numeric-anchor name -> instruction index */
  labels: Map<string, number>;
  diagnostics: NMLDiagnostic[];
}
