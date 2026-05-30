/**
 * TextBox - The PixiJS dialogue box with a typewriter reveal.
 *
 * The reveal is driven by the shared host ticker: print() arms a Typewriter and
 * returns a Promise; update(dtMs) (called every frame by PixiHost) advances it
 * and resolves the Promise when the segment is fully shown. clicking mid-reveal
 * calls skip(). Text accumulates across segments until clear() (NML semantics).
 */

import { Container, Graphics, Text } from 'pixi.js';
import { Typewriter } from '../../engine/nml/Typewriter';

export interface TextBoxOptions {
  width?: number;
  height?: number;
  padding?: number;
}

export class TextBox {
  readonly view = new Container();

  private readonly text: Text;
  private readonly indicator: Text;
  private committed = '';
  private pending = '';
  private tw: Typewriter | null = null;
  private resolvePrint: (() => void) | null = null;
  private blinkClock = 0;

  constructor(opts: TextBoxOptions = {}) {
    const w = opts.width ?? 640;
    const h = opts.height ?? 180;
    const pad = opts.padding ?? 22;

    const panel = new Graphics();
    panel
      .roundRect(0, 0, w, h, 14)
      .fill({ color: 0x0a0810, alpha: 0.72 })
      .stroke({ width: 1, color: 0x3a3350 });
    this.view.addChild(panel);

    this.text = new Text({
      text: '',
      style: {
        fontFamily: '"Hiragino Kaku Gothic ProN", "Yu Gothic", system-ui, sans-serif',
        fontSize: 17,
        fill: 0xcfc7dd,
        lineHeight: 31,
        wordWrap: true,
        wordWrapWidth: w - pad * 2,
        breakWords: true,
      },
    });
    this.text.position.set(pad, pad);
    this.view.addChild(this.text);

    this.indicator = new Text({ text: '▼', style: { fontFamily: 'sans-serif', fontSize: 16, fill: 0xd8b4fe } });
    this.indicator.anchor.set(1, 1);
    this.indicator.position.set(w - 12, h - 8);
    this.indicator.visible = false;
    this.view.addChild(this.indicator);
  }

  /** Reveal a text segment; resolves when fully shown (or skipped). */
  print(segment: string, cps: number): Promise<void> {
    this.pending = segment;
    this.tw = new Typewriter({ cps });
    this.tw.start(segment);
    return new Promise((resolve) => {
      this.resolvePrint = resolve;
      if (this.tw!.isDone) this.finishPrint();
    });
  }

  skip(): void {
    this.tw?.skip();
  }

  get isTyping(): boolean {
    return this.tw !== null && !this.tw.isDone;
  }

  clear(): void {
    this.committed = '';
    this.text.text = '';
  }

  lineBreak(): void {
    this.committed += '\n';
    this.text.text = this.committed;
  }

  showIndicator(show: boolean): void {
    this.indicator.visible = show;
  }

  /** Advance per frame (called by the host ticker). */
  update(dtMs: number): void {
    if (this.tw) {
      this.tw.tick(dtMs);
      this.text.text = this.committed + this.tw.visibleText;
      if (this.tw.isDone) this.finishPrint();
    }
    if (this.indicator.visible) {
      this.blinkClock += dtMs;
      this.indicator.alpha = 0.35 + 0.65 * ((Math.sin(this.blinkClock / 320) + 1) / 2);
    }
  }

  private finishPrint(): void {
    if (!this.tw) return;
    this.committed += this.pending;
    this.text.text = this.committed;
    const resolve = this.resolvePrint;
    this.tw = null;
    this.resolvePrint = null;
    this.pending = '';
    resolve?.();
  }
}
