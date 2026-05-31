import { describe, it, expect } from 'vitest';
import { readdirSync } from 'node:fs';
import { ROOM_ITEMS, ROOM_ITEM_IDS, getRoomItem, STARTER_ITEM_IDS } from './roomItems';

const files = new Set(readdirSync('public/assets/room-items'));

describe('roomItems catalogue', () => {
  it('lists furniture with served art paths', () => {
    expect(ROOM_ITEMS.length).toBeGreaterThanOrEqual(10);
    for (const item of ROOM_ITEMS) {
      expect(item.art).toBe(`/assets/room-items/${item.id}.png`);
      expect(item.name.length).toBeGreaterThan(0);
    }
  });

  it('every item has a real PNG asset in public/assets/room-items/', () => {
    for (const id of ROOM_ITEM_IDS) {
      expect(files.has(`${id}.png`)).toBe(true);
    }
  });

  it('starter items resolve to known furniture', () => {
    for (const id of STARTER_ITEM_IDS) {
      expect(getRoomItem(id)).toBeDefined();
    }
  });

  it('getRoomItem returns undefined for unknown ids', () => {
    expect(getRoomItem('nope')).toBeUndefined();
  });
});
