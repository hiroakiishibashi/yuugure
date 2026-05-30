import { describe, it, expect } from 'vitest';
import { ItemManager } from './ItemManager';

describe('ItemManager', () => {
  it('applies NML <item> get/use actions', () => {
    const inv = new ItemManager();
    inv.apply('kagi', 'get');
    expect(inv.has('kagi')).toBe(true);
    expect(inv.count('kagi')).toBe(1);
    inv.apply('kagi', 'use');
    expect(inv.has('kagi')).toBe(false);
  });

  it('stacks counts and removes down to zero', () => {
    const inv = new ItemManager();
    inv.add('hon', 3);
    expect(inv.count('hon')).toBe(3);
    expect(inv.remove('hon', 2)).toBe(true);
    expect(inv.count('hon')).toBe(1);
    expect(inv.remove('hon')).toBe(true);
    expect(inv.remove('hon')).toBe(false); // already empty
  });

  it('lists only owned items with catalogue names', () => {
    const inv = new ItemManager();
    inv.apply('kagi', 'get');
    inv.apply('hana', 'get');
    const list = inv.list();
    expect(list.map((e) => e.def.id).sort()).toEqual(['hana', 'kagi']);
    expect(inv.def('kagi').name).toBe('カギ');
  });

  it('notifies subscribers on change (and immediately on subscribe)', () => {
    const inv = new ItemManager();
    const seen: number[] = [];
    const unsub = inv.subscribe((entries) => seen.push(entries.length));
    inv.apply('kagi', 'get');
    inv.apply('hana', 'get');
    unsub();
    inv.apply('hon', 'get');
    expect(seen).toEqual([0, 1, 2]); // initial 0, then 1, then 2; no more after unsub
  });

  it('learns unknown items on the fly', () => {
    const inv = new ItemManager();
    inv.apply('mystery', 'get');
    expect(inv.has('mystery')).toBe(true);
    expect(inv.def('mystery').name).toBe('mystery');
  });
});
