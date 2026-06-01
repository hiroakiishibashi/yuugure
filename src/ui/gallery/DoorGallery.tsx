/**
 * 青空アパート DOOR SELECT — rebuilt to match the original screen, using the
 * salvaged door artwork (public/assets/ui/door01.png) as the door card, with the
 * room number, resident creature (in the door window) and name/title overlaid.
 * Navigation (floors / districts) is the bar at the top; clicking a door enters
 * that resident's room.
 */

import { useState } from 'react';
import { useGame } from '../GameContext';
import { RESIDENT_FLOORS, residentsOnFloor, type Resident } from '../../game/residents';
import { characterGif } from '../../game/characters';

const DOOR_IMG = `${import.meta.env.BASE_URL}assets/ui/door01.png`;

export function DoorGallery(): JSX.Element {
  const game = useGame();
  const [floorIdx, setFloorIdx] = useState(0); // 0 = top floor (RESIDENT_FLOORS is high→low)

  const floor = RESIDENT_FLOORS[floorIdx] ?? RESIDENT_FLOORS[0]!;
  const rooms = residentsOnFloor(floor);
  const range = rooms.length ? `${rooms[0]!.roomNo} – ${rooms[rooms.length - 1]!.roomNo}` : '';

  return (
    <div className="apt">
      <div className="apt-bar">
        <span className="apt-logo">🏢 青空アパート</span>
        <span className="apt-floor">{range} 号室</span>
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

      <p className="apt-hint">SELECT ROOM　──　ドアを クリック</p>

      <div className="doors">
        {rooms.map((r: Resident) => (
          <button
            key={r.roomNo}
            type="button"
            className="door"
            style={{ backgroundImage: `url(${DOOR_IMG})` }}
            onClick={() => void game.enterRoom(r)}
          >
            <span className="door-no">{r.roomNo}</span>
            <span className="door-win">
              <img className="door-thumb" src={characterGif(r.characterId, 'idle')} alt="" draggable={false} />
            </span>
            <span className="door-plate">
              <span className="door-title">{r.title}</span>
              <span className="door-name">{r.name}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
