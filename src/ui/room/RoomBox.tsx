import { useEffect, useRef, useState } from 'react';
import { useGame } from '../GameContext';
import { ItemPanel } from './ItemPanel';
import type { InventoryEntry } from '../../engine/items/ItemManager';

export function RoomBox(): JSX.Element {
  const game = useGame();
  const [own, setOwn] = useState(game.isOwnRoom);
  const [editing, setEditing] = useState(game.editing);
  const [items, setItems] = useState<InventoryEntry[]>([]);
  const placed = useRef(0);

  useEffect(() => game.subscribeMode(() => setOwn(game.isOwnRoom)), [game]);
  useEffect(() => game.subscribeEdit(setEditing), [game]);
  useEffect(() => game.items.subscribe(setItems), [game]);

  const place = async (entry: InventoryEntry): Promise<void> => {
    if (!own || !editing) return;
    const n = placed.current++;
    await game.placeItem(entry.def.id, n % 7, Math.floor(n / 7) % 5);
    game.items.remove(entry.def.id);
  };

  return (
    <div className="room-box">
      <div className="box-title">
        <span className="box-face">◎</span>
        <strong>自分の部屋</strong>
        <span className="box-actions">
          <button type="button" className="mini-btn" onClick={() => game.setEditMode(!editing)} disabled={!own}>
            {editing ? '保存' : '設定'}
          </button>
          <button type="button" className="mini-btn">ヘルプ</button>
          <button type="button" className="mini-btn" onClick={() => game.goOutside()}>
            出る
          </button>
        </span>
      </div>

      <div className="room-stats">
        <span className="stat-room">9999号室</span>
        <span>いしばしひろあき さん</span>
        <span>お金 <b>9999999円</b></span>
        <span>Lv <b>999</b></span>
        <span className="stat-exp">経験値: 1234567890</span>
      </div>

      <div className={`room-shelf${editing ? ' is-editing' : ''}`}>
        <ItemPanel items={items} onPlace={place} disabled={!own || !editing} />
      </div>
      <p className="box-hint">
        {own
          ? editing
            ? 'アイテムをクリックして置く。置いた家具は上の部屋でドラッグ移動できます。'
            : '設定を押すと、家具の設置と移動ができます。'
          : 'ほかの人の部屋では家具を動かせません。'}
      </p>
    </div>
  );
}
