import { describe, it, expect } from 'vitest';
import { readdirSync } from 'node:fs';
import {
  CHARACTERS,
  CHARACTER_IDS,
  getCharacter,
  characterGif,
  hasAction,
  HOME_CHARACTER_ID,
  GALLERY_ROOM_IDS,
} from './characters';

const files = new Set(readdirSync('public/characters'));

describe('characters registry (SWF-salvaged per-action)', () => {
  it('has many creatures, each with at least idle + talk', () => {
    expect(CHARACTERS.length).toBeGreaterThan(25);
    for (const c of CHARACTERS) {
      expect(c.actions).toContain('idle');
      expect(c.actions).toContain('talk');
      expect(c.name.length).toBeGreaterThan(0);
    }
  });

  it('every declared action has a real GIF asset in public/characters/', () => {
    for (const c of CHARACTERS) {
      for (const action of c.actions) {
        expect(files.has(`${c.id}_${action}.gif`)).toBe(true);
      }
    }
  });

  it('characterGif resolves to a declared action, falling back to idle', () => {
    // daifuku has joy; a creature without joy falls back to its idle
    expect(characterGif('daifuku', 'joy')).toBe('/characters/daifuku_joy.gif');
    const plain = CHARACTER_IDS.find((id) => !hasAction(id, 'joy'))!;
    expect(characterGif(plain, 'joy')).toBe(`/characters/${plain}_idle.gif`);
  });

  it('home and gallery ids resolve to known characters', () => {
    expect(getCharacter(HOME_CHARACTER_ID)).toBeDefined();
    for (const id of GALLERY_ROOM_IDS) expect(getCharacter(id)).toBeDefined();
  });

  it('at least a few creatures have joy/sad (expressive set salvaged)', () => {
    const joy = CHARACTERS.filter((c) => c.actions.includes('joy'));
    const sad = CHARACTERS.filter((c) => c.actions.includes('sad'));
    expect(joy.length).toBeGreaterThanOrEqual(3);
    expect(sad.length).toBeGreaterThanOrEqual(2);
  });
});
