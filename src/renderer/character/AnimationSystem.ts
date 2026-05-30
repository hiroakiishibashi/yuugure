/**
 * AnimationSystem - A pure character-animation state machine (no PixiJS, so it
 * is unit-testable). It maps an animation state + elapsed time to a small set of
 * render parameters (bob, mouth, tint, lean) that the PixiJS Character applies.
 *
 * This stands in for the original SWF character animations. Per NML_spec:
 *   - idle  (idling)  : auto-played while waiting (click/blank/input)
 *   - talk  (口パク)  : auto-played while text is being typed
 *   - glad  (喜び)
 *   - sad   (悲しみ)
 */

export type AnimState = 'idle' | 'talk' | 'glad' | 'sad';

export interface AnimFrame {
  /** vertical bob offset in px (negative = up) */
  bobY: number;
  /** 0..1 mouth openness (drives the talk mouth) */
  mouthOpen: number;
  /** horizontal lean in px */
  lean: number;
  /** multiplicative tint as 0xRRGGBB (0xffffff = none) */
  tint: number;
}

/** Map an NML <anim> value to a known state. Covers both the 2010 spec keywords
 *  (idle/paku/glad/sad/1..4) and 2003 game values (smile/memo/false/…). */
export function mapAnimName(name: string): AnimState {
  switch (name.trim().toLowerCase()) {
    case 'idle':
    case '1':
    case 'false': // 2003: "turn animation off" → fall back to idle
    case 'memo':
      return 'idle';
    case 'paku':
    case 'talk':
    case '2':
      return 'talk';
    case 'glad':
    case 'smile':
    case '3':
      return 'glad';
    case 'sad':
    case '4':
      return 'sad';
    default:
      return 'idle';
  }
}

const TAU = Math.PI * 2;

export class AnimationSystem {
  private state: AnimState = 'idle';
  private elapsed = 0;

  get current(): AnimState {
    return this.state;
  }

  /** Switch state; restarts the local clock only when the state actually changes. */
  setState(state: AnimState): void {
    if (state !== this.state) {
      this.state = state;
      this.elapsed = 0;
    }
  }

  /** Advance time and compute the current frame parameters. */
  update(dtMs: number): AnimFrame {
    this.elapsed += dtMs;
    return this.frameFor(this.state, this.elapsed);
  }

  /** Pure mapping from (state, elapsed) to render params — exposed for testing. */
  frameFor(state: AnimState, elapsedMs: number): AnimFrame {
    const t = elapsedMs / 1000;
    switch (state) {
      case 'idle':
        // slow gentle breathing
        return { bobY: Math.sin(t * TAU * 0.5) * 2, mouthOpen: 0, lean: 0, tint: 0xffffff };
      case 'talk':
        // quicker bob + oscillating mouth
        return {
          bobY: Math.sin(t * TAU * 1.2) * 1.5,
          mouthOpen: (Math.sin(t * TAU * 6) + 1) / 2,
          lean: 0,
          tint: 0xffffff,
        };
      case 'glad':
        // a little hop + warm tint
        return { bobY: -Math.abs(Math.sin(t * TAU * 1.5)) * 6, mouthOpen: 0.3, lean: 0, tint: 0xfff0c0 };
      case 'sad':
        // droop forward + cool desaturated tint
        return { bobY: 2, mouthOpen: 0, lean: Math.sin(t * TAU * 0.3) * 3, tint: 0x9aa6c0 };
    }
  }
}
