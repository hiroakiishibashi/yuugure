/** ItemPanel - The owned-items palette; clicking a chip places that item. */

import type { InventoryEntry } from '../../engine/items/ItemManager';

export function ItemPanel({
  items,
  onPlace,
}: {
  items: InventoryEntry[];
  onPlace: (entry: InventoryEntry) => void;
}): JSX.Element {
  if (items.length === 0) {
    return <div className="feed-empty">もちものが ない…（ブログや たんけんで てにはいる）</div>;
  }

  return (
    <div className="item-grid">
      {items.map((entry) => (
        <button key={entry.def.id} type="button" className="item-chip" onClick={() => onPlace(entry)}>
          <strong>{entry.def.name}</strong>
          {entry.def.note && <span className="note">{entry.def.note}</span>}
          <span className="count">×{entry.count}</span>
        </button>
      ))}
    </div>
  );
}
