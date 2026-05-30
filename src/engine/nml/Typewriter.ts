/**
 * Typewriter - A pure, framework-agnostic text-reveal timing model.
 *
 * It owns no DOM and no timer; it simply maps elapsed time to "how many
 * characters are visible". A host drives it from requestAnimationFrame (the
 * PixiJS TextBox in Phase 2) or from a test clock, and reads `visibleText`.
 *
 * Speed comes from NML's <speed> tag, converted to characters-per-second via
 * TagSpec.speedToCps(); `cps === Infinity` reveals instantly.
 */

export interface TypewriterOptions {
  /** characters per second; Infinity reveals instantly. Default 30. */
  cps?: number;
}

export class Typewriter {
  private full = '';
  private elapsedMs = 0;
  private cps: number;
  private finished = false;

  constructor(opts: TypewriterOptions = {}) {
    this.cps = opts.cps ?? 30;
  }

  /** Begin revealing a new string (optionally changing the speed). */
  start(text: string, cps?: number): void {
    this.full = text;
    this.elapsedMs = 0;
    if (cps !== undefined) this.cps = cps;
    this.finished = this.cps === Infinity || text.length === 0;
  }

  setCps(cps: number): void {
    this.cps = cps;
  }

  /** Advance the clock by `dtMs`; returns the now-visible substring. */
  tick(dtMs: number): string {
    if (!this.finished) {
      this.elapsedMs += dtMs;
      if (this.visibleCount() >= this.full.length) this.finished = true;
    }
    return this.visibleText;
  }

  /** Reveal the whole string immediately (e.g. user tapped to skip). */
  skip(): void {
    this.finished = true;
  }

  private visibleCount(): number {
    if (this.finished || this.cps === Infinity) return this.full.length;
    return Math.min(this.full.length, Math.floor((this.elapsedMs / 1000) * this.cps));
  }

  get visibleText(): string {
    return this.full.slice(0, this.visibleCount());
  }

  get fullText(): string {
    return this.full;
  }

  get isDone(): boolean {
    return this.finished || this.visibleCount() >= this.full.length;
  }
}
