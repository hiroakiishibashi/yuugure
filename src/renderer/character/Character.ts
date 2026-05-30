/**
 * Character - A procedural placeholder character rendered in PixiJS, driven by
 * the pure AnimationSystem. It stands in for the original SWF character until
 * real sprites are converted; the figure breathes (idle), lip-syncs (talk),
 * hops (glad) and droops (sad).
 *
 * Origin (0,0) is at the character's feet; the body extends upward.
 */

import { Container, Graphics } from 'pixi.js';
import { AnimationSystem, mapAnimName, type AnimState } from './AnimationSystem';

export class Character {
  readonly view = new Container();

  private readonly anim = new AnimationSystem();
  private readonly group = new Container();
  private readonly mouth = new Graphics();

  constructor() {
    const shadow = new Graphics();
    shadow.ellipse(0, 0, 42, 11).fill({ color: 0x000000, alpha: 0.28 });
    this.view.addChild(shadow);

    const body = new Graphics();
    body.roundRect(-34, -104, 68, 104, 22).fill(0x5b4b86).stroke({ width: 2, color: 0x2a2140 });

    const head = new Graphics();
    head.circle(0, -132, 30).fill(0xe7d8c4).stroke({ width: 2, color: 0x2a2140 });

    const eyes = new Graphics();
    eyes.circle(-11, -136, 3.2).circle(11, -136, 3.2).fill(0x2a2140);

    this.group.addChild(body, head, eyes, this.mouth);
    this.view.addChild(this.group);
    this.drawMouth(0);
  }

  /** Set animation from an NML <anim> value (idle/paku/glad/sad/smile/…). */
  setAnim(name: string): void {
    this.anim.setState(mapAnimName(name));
  }

  setState(state: AnimState): void {
    this.anim.setState(state);
  }

  get state(): AnimState {
    return this.anim.current;
  }

  /** Advance the animation by dtMs; call every frame from the host ticker. */
  update(dtMs: number): void {
    const f = this.anim.update(dtMs);
    this.group.y = f.bobY;
    this.group.x = f.lean;
    this.group.tint = f.tint;
    this.drawMouth(f.mouthOpen);
  }

  private drawMouth(open: number): void {
    const h = 1.5 + open * 8;
    this.mouth
      .clear()
      .roundRect(-9, -120 - h / 2, 18, h, Math.min(5, h / 2))
      .fill(0x7a3b4a);
  }
}
