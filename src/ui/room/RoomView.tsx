/**
 * RoomView - The へや tab. The PixiJS room + character live in the persistent
 * stage above; here the player picks owned items to place onto the isometric
 * floor. Placing an item consumes one and drops a token on the next free cell.
 */

import { useEffect, useRef, useState } from 'react';
import { useGame } from '../GameContext';
import { ItemPanel } from './ItemPanel';
import type { InventoryEntry } from '../../engine/items/ItemManager';

export function RoomView(): JSX.Element {
  const game = useGame();
  const [items, setItems] = useState<InventoryEntry[]>([]);
  const placedCount = useRef(0);

  useEffect(() => game.items.subscribe(setItems), [game]);

  const place = async (entry: InventoryEntry): Promise<void> => {
    const n = placedCount.current++;
    const col = n % 5;
    const row = Math.floor(n / 5) % 5;
    await game.placeItem(entry.def.id, col, row);
    game.items.remove(entry.def.id);
  };

  return (
    <div className="room-panel">
      <p className="blog-hint">アイテムを　えらんで　へやに　おこう。おいた　かぐは　ドラッグで　うごかせるよ</p>
      <ItemPanel items={items} onPlace={place} />
    </div>
  );
}
