/**
 * LocalState - The per-session NML variable store.
 *
 * NML variables are untyped strings (set via <set>, read via <get> and
 * compared via <if>). This is the working set the executor reads and writes;
 * variables flagged global="true" are additionally written through to
 * GlobalState. Missing variables compare equal to "" (matching the original
 * engine's cookie-absent behaviour).
 */

export type StateListener = (name: string, value: string | undefined) => void;

export class LocalState {
  private readonly vars = new Map<string, string>();
  private readonly listeners = new Set<StateListener>();

  get(name: string): string | undefined {
    return this.vars.get(name);
  }

  /** Read for display/interpolation: missing variables render as "". */
  getOrEmpty(name: string): string {
    return this.vars.get(name) ?? '';
  }

  has(name: string): boolean {
    return this.vars.has(name);
  }

  set(name: string, value: string): void {
    this.vars.set(name, value);
    this.emit(name, value);
  }

  delete(name: string): void {
    if (this.vars.delete(name)) this.emit(name, undefined);
  }

  /** <if name=.. value=..> semantics: string equality, absent === "". */
  equals(name: string, value: string): boolean {
    return (this.vars.get(name) ?? '') === value;
  }

  snapshot(): Record<string, string> {
    return Object.fromEntries(this.vars);
  }

  /** Seed/merge variables (e.g. preloaded global values at script start). */
  load(values: Record<string, string>): void {
    for (const [k, v] of Object.entries(values)) this.set(k, v);
  }

  clear(): void {
    const keys = [...this.vars.keys()];
    this.vars.clear();
    for (const k of keys) this.emit(k, undefined);
  }

  /** Subscribe to changes (UI binding for life/etc.). Returns an unsubscribe fn. */
  subscribe(fn: StateListener): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private emit(name: string, value: string | undefined): void {
    for (const fn of this.listeners) fn(name, value);
  }
}
