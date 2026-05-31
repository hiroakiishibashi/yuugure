import { describe, it, expect } from 'vitest';
import { RESIDENTS, RESIDENT_FLOORS, residentsOnFloor, getResident } from './residents';
import { getCharacter } from './characters';
import { getRoomItem } from './roomItems';

describe('residents (dummy apartment)', () => {
  it('has residents with unique room numbers and speakable greetings', () => {
    expect(RESIDENTS.length).toBeGreaterThanOrEqual(8);
    const ids = RESIDENTS.map((r) => r.roomNo);
    expect(new Set(ids).size).toBe(ids.length); // unique
    for (const r of RESIDENTS) {
      expect(r.name.length).toBeGreaterThan(0);
      expect(r.lines.length).toBeGreaterThan(0);
    }
  });

  it('every resident maps to a real salvaged creature', () => {
    for (const r of RESIDENTS) {
      expect(getCharacter(r.characterId), `${r.roomNo} ${r.characterId}`).toBeDefined();
    }
  });

  it('every declared room item exists in the furniture catalogue', () => {
    for (const r of RESIDENTS) {
      for (const id of r.items ?? []) expect(getRoomItem(id), id).toBeDefined();
    }
  });

  it('floors are listed high → low and group residents', () => {
    expect(RESIDENT_FLOORS.length).toBeGreaterThanOrEqual(1);
    expect([...RESIDENT_FLOORS]).toEqual([...RESIDENT_FLOORS].sort((a, b) => b - a));
    const top = RESIDENT_FLOORS[0]!;
    expect(residentsOnFloor(top).length).toBeGreaterThan(0);
  });

  it('getResident resolves by room number', () => {
    expect(getResident(RESIDENTS[0]!.roomNo)).toEqual(RESIDENTS[0]);
    expect(getResident('Z999')).toBeUndefined();
  });
});
