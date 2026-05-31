/**
 * ItemManager - The player's inventory (no PixiJS/React, so it is unit-testable).
 *
 * Driven by the NML `<item type="..." action="...">` tag via the host:
 *   action="get"  → add one
 *   action="use" / "lose" → remove one
 * Other code (the room-decoration UI) reads the inventory to offer placeable
 * items and consumes them on placement.
 */

export interface ItemDef {
  id: string;
  /** display label (Japanese) */
  name: string;
  /** short flavour / category */
  note?: string;
  /** served path to the item's pixel-art sprite (room decoration) */
  art?: string;
}

export interface InventoryEntry {
  def: ItemDef;
  count: number;
}

export type InventoryListener = (entries: InventoryEntry[]) => void;

/** A small starter catalogue; extend as the game grows. */
export const DEFAULT_ITEM_CATALOGUE: Record<string, ItemDef> = {
  kagi: { id: 'kagi', name: 'カギ', note: 'どこかの扉をあける' },
  isu: { id: 'isu', name: 'いす', note: '部屋におけるかぐ' },
  hon: { id: 'hon', name: 'ほん', note: 'だれかの きおく' },
  ranpu: { id: 'ranpu', name: 'ランプ', note: 'ほのかな あかり' },
  hana: { id: 'hana', name: 'はな', note: 'かれない はな' },
};

export class ItemManager {
  private readonly counts = new Map<string, number>();
  private readonly catalogue: Record<string, ItemDef>;
  private readonly listeners = new Set<InventoryListener>();

  constructor(catalogue: Record<string, ItemDef> = DEFAULT_ITEM_CATALOGUE) {
    this.catalogue = { ...catalogue };
  }

  /** Apply an NML <item> action. Unknown actions are ignored. */
  apply(type: string, action: string): void {
    switch (action) {
      case 'get':
        this.add(type);
        break;
      case 'use':
      case 'lose':
        this.remove(type);
        break;
      default:
        break;
    }
  }

  add(id: string, n = 1): void {
    if (!this.catalogue[id]) this.catalogue[id] = { id, name: id };
    this.counts.set(id, this.count(id) + n);
    this.emit();
  }

  /** Remove up to n; returns true if at least one was removed. */
  remove(id: string, n = 1): boolean {
    const current = this.count(id);
    if (current <= 0) return false;
    const next = Math.max(0, current - n);
    if (next === 0) this.counts.delete(id);
    else this.counts.set(id, next);
    this.emit();
    return true;
  }

  has(id: string): boolean {
    return this.count(id) > 0;
  }

  count(id: string): number {
    return this.counts.get(id) ?? 0;
  }

  def(id: string): ItemDef {
    return this.catalogue[id] ?? { id, name: id };
  }

  /** Owned items (count > 0), in catalogue order. */
  list(): InventoryEntry[] {
    return Object.keys(this.catalogue)
      .filter((id) => this.has(id))
      .map((id) => ({ def: this.def(id), count: this.count(id) }));
  }

  /** Current counts, for persistence. */
  snapshot(): Record<string, number> {
    return Object.fromEntries(this.counts);
  }

  /** Replace the inventory with saved counts. */
  loadCounts(counts: Record<string, number>): void {
    this.counts.clear();
    for (const [id, n] of Object.entries(counts)) if (n > 0) this.counts.set(id, n);
    this.emit();
  }

  subscribe(fn: InventoryListener): () => void {
    this.listeners.add(fn);
    fn(this.list());
    return () => {
      this.listeners.delete(fn);
    };
  }

  private emit(): void {
    const entries = this.list();
    for (const fn of this.listeners) fn(entries);
  }
}
