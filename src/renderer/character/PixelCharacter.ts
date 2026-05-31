/**
 * PixelCharacter - The on-screen creature, rendered as the original animated
 * pixel-art GIFs salvaged from the Flash SWFs. A DOM <img> is layered over the
 * PixiJS canvas so the GIF animates natively and `image-rendering: pixelated`
 * keeps the ドット絵 crisp.
 *
 * Now state-aware: the logical animation state (idle/talk/glad/sad, from NML
 * <anim> and the dialogue flow) maps to a per-action GIF (idle/talk/joy/sad),
 * so the creature actually lip-syncs while talking and emotes on joy/sad.
 * Creatures lacking a given action fall back to idle; a CSS `data-mood` filter
 * still tints the fallback so the mood reads.
 */

import { AnimationSystem, mapAnimName, type AnimState } from './AnimationSystem';
import { characterGif } from '../../game/characters';
import type { CharAction } from '../../game/characterManifest';

const STATE_TO_ACTION: Record<AnimState, CharAction> = {
  idle: 'idle',
  talk: 'talk',
  glad: 'joy',
  sad: 'sad',
};

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
  }

  /** Swap the whole creature (entering a different room). */
  setCharacter(id: string): void {
    this.charId = id;
    this.applyState();
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
    this.applyState();
  }

  get state(): AnimState {
    return this.anim.current;
  }

  private applyState(): void {
    if (!this.charId) return;
    const action = STATE_TO_ACTION[this.anim.current];
    const src = characterGif(this.charId, action);
    if (this.el.getAttribute('src') !== src) this.el.src = src;
    this.el.dataset.mood = this.anim.current;
  }
}
