/**
 * PixelCharacter - The on-screen creature, rendered as the original animated
 * pixel-art GIF (200×200, transparent) via a DOM <img> layered over the PixiJS
 * canvas. Using the GIF directly preserves the ドット絵 perfectly (native
 * animation, `image-rendering: pixelated`) and makes per-room swaps trivial —
 * just change the image source.
 *
 * Only idle GIFs survived from the original art, so the same clip plays for all
 * states; mood (glad/sad) is suggested with a CSS filter via the `data-mood`
 * attribute rather than a separate animation. The AnimationSystem still tracks
 * the logical state (idle/talk/glad/sad) coming from NML <anim>.
 */

import { AnimationSystem, mapAnimName, type AnimState } from './AnimationSystem';
import { getCharacter } from '../../game/characters';

export class PixelCharacter {
  readonly el: HTMLImageElement;
  private readonly anim = new AnimationSystem();
  private charId = '';

  constructor(initialCharacterId: string) {
    this.el = document.createElement('img');
    this.el.className = 'nml-character';
    this.el.alt = '';
    this.el.draggable = false;
    this.setCharacter(initialCharacterId);
    this.applyMood();
  }

  /** Swap the whole creature (used when entering a different room). */
  setCharacter(id: string): void {
    if (id === this.charId) return;
    const def = getCharacter(id);
    if (!def) return;
    this.charId = id;
    this.el.src = def.gif;
  }

  get characterId(): string {
    return this.charId;
  }

  /** Set animation state from an NML <anim> value (idle/paku/glad/sad/…). */
  setAnim(name: string): void {
    this.setState(mapAnimName(name));
  }

  setState(state: AnimState): void {
    this.anim.setState(state);
    this.applyMood();
  }

  get state(): AnimState {
    return this.anim.current;
  }

  private applyMood(): void {
    this.el.dataset.mood = this.anim.current;
  }
}
