import { describe, it, expect } from 'vitest';
import { readdirSync } from 'node:fs';
import {
  CHARACTERS,
  CHARACTER_IDS,
  getCharacter,
  HOME_CHARACTER_ID,
  GALLERY_ROOM_IDS,
} from './characters';

describe('characters registry', () => {
  it('has entries with served gif paths', () => {
    expect(CHARACTERS.length).toBeGreaterThan(20);
    for (const c of CHARACTERS) {
      expect(c.gif).toBe(`/characters/${c.id}.gif`);
      expect(c.name.length).toBeGreaterThan(0);
    }
  });

  it('every registered character has a real GIF asset in public/characters/', () => {
    const files = new Set(readdirSync('public/characters'));
    for (const id of CHARACTER_IDS) {
      expect(files.has(`${id}.gif`)).toBe(true);
    }
  });

  it('home and gallery ids resolve to known characters', () => {
    expect(getCharacter(HOME_CHARACTER_ID)).toBeDefined();
    for (const id of GALLERY_ROOM_IDS) {
      expect(getCharacter(id)).toBeDefined();
    }
  });

  it('getCharacter returns undefined for unknown ids', () => {
    expect(getCharacter('nope')).toBeUndefined();
  });
});
