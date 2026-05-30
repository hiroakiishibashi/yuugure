/**
 * LifeMeter - Visualises the life / 精神力 (mental-power) value the executor
 * tracks. Shows a bar (clamped to a display max) plus the numeric value and the
 * most recent <lifetext> message, so <life>/<lifetext> changes are legible.
 */

import { Container, Graphics, Text } from 'pixi.js';

export interface LifeMeterOptions {
  width?: number;
  /** value mapped to a full bar (display only; life itself is unbounded) */
  displayMax?: number;
}

export class LifeMeter {
  readonly view = new Container();

  private readonly width: number;
  private readonly displayMax: number;
  private readonly fill = new Graphics();
  private readonly label: Text;
  private readonly message: Text;

  constructor(opts: LifeMeterOptions = {}) {
    this.width = opts.width ?? 240;
    this.displayMax = opts.displayMax ?? 100;

    const track = new Graphics();
    track
      .roundRect(0, 0, this.width, 14, 7)
      .fill({ color: 0x1b1726, alpha: 0.9 })
      .stroke({ width: 1, color: 0x3a3350 });
    this.view.addChild(track, this.fill);

    this.label = new Text({
      text: '',
      style: { fontFamily: 'system-ui, sans-serif', fontSize: 13, fill: 0xcfc7dd },
    });
    this.label.position.set(0, 18);
    this.view.addChild(this.label);

    this.message = new Text({
      text: '',
      style: { fontFamily: 'system-ui, sans-serif', fontSize: 12, fill: 0x9a8fb8 },
    });
    this.message.position.set(0, 36);
    this.view.addChild(this.message);

    this.set(0);
  }

  /** Update the meter. `delta`/`message` are optional flavour from <life>/<lifetext>. */
  set(value: number, opts: { delta?: number; prefix?: string; message?: string } = {}): void {
    const ratio = Math.max(0, Math.min(1, value / this.displayMax));
    this.fill
      .clear()
      .roundRect(1, 1, Math.max(0, (this.width - 2) * ratio), 12, 6)
      .fill({ color: barColor(ratio) });

    const deltaText = opts.delta ? `  (${opts.delta > 0 ? '+' : ''}${opts.delta})` : '';
    this.label.text = `${opts.prefix ?? '精神力'}: ${value}${deltaText}`;
    if (opts.message !== undefined) this.message.text = opts.message;
  }
}

function barColor(ratio: number): number {
  if (ratio > 0.6) return 0x7bdc9a;
  if (ratio > 0.3) return 0xd8c46a;
  return 0xd87b7b;
}
