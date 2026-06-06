import { describe, it, expect } from 'vitest';
import { basename } from 'node:path';
import { readdirSync } from 'node:fs';
import { ROOM_ITEMS, ROOM_ITEM_IDS, getRoomItem, STARTER_ITEM_IDS } from './roomItems';

const files = new Set(readdirSync('public/assets/room-items'));

describe('roomItems catalogue', () => {
  it('lists furniture with served art paths', () => {
    expect(ROOM_ITEMS.length).toBeGreaterThanOrEqual(80);
    for (const item of ROOM_ITEMS) {
      expect(item.art).toMatch(/^\/assets\/room-items\/.+\.png$/);
      expect(item.name.length).toBeGreaterThan(0);
    }
  });

  it('every item has a real PNG asset in public/assets/room-items/', () => {
    for (const item of ROOM_ITEMS) {
      expect(files.has(basename(item.art)), item.id).toBe(true);
    }
    expect(new Set(ROOM_ITEM_IDS).size).toBe(ROOM_ITEM_IDS.length);
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
