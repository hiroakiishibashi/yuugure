/**
 * Apartment door-select — restyled after the original game's 青空アパート
 * screen: a floor of doors (A5xx号室), navigate floors, click a door to enter
 * that resident's room. Entering swaps the on-screen creature to the resident,
 * decorates with their furniture and plays their greeting (they speak).
 */

import { useState } from 'react';
import { useGame } from '../GameContext';
import { RESIDENT_FLOORS, residentsOnFloor, type Resident } from '../../game/residents';
import { characterGif } from '../../game/characters';

export function DoorGallery(): JSX.Element {
  const game = useGame();
  const [floorIdx, setFloorIdx] = useState(0); // 0 = top floor (RESIDENT_FLOORS is high→low)

  const floor = RESIDENT_FLOORS[floorIdx] ?? RESIDENT_FLOORS[0]!;
  const rooms = residentsOnFloor(floor);
  const first = rooms[0]?.roomNo ?? '';
  const last = rooms[rooms.length - 1]?.roomNo ?? '';

  return (
    <div className="apt">
      <div className="apt-bar">
        <span className="apt-logo">青空アパート</span>
        <span className="apt-floor">
          {floor}F　{first} – {last}
        </span>
        <span className="apt-nav">
          <button type="button" className="apt-btn" disabled={floorIdx >= RESIDENT_FLOORS.length - 1} onClick={() => setFloorIdx((i) => i + 1)}>
            ▼ 下の階
          </button>
          <button type="button" className="apt-btn" disabled={floorIdx <= 0} onClick={() => setFloorIdx((i) => i - 1)}>
            ▲ 上の階
          </button>
          <button type="button" className="apt-btn apt-home" onClick={() => game.goHome()}>
            🏠 じぶんの へや
          </button>
        </span>
      </div>

      <p className="apt-hint">SELECT ROOM ── ドアを クリックして　おとなりを　たずねよう</p>

      <div className="doors">
        {rooms.map((r: Resident) => (
          <button key={r.roomNo} type="button" className="door" onClick={() => void game.visitRoom(r)}>
            <span className="door-id">{r.roomNo}</span>
            <span className="door-window">
              <img className="door-thumb" src={characterGif(r.characterId, 'idle')} alt="" draggable={false} />
            </span>
            <span className="door-name">{r.name}</span>
            <span className="door-title">{r.title}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
