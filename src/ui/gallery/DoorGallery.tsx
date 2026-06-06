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
  const totalResidents = 47 + floorIdx * 3;
  const emptyRooms = 257 - totalResidents;

  return (
    <div className="apt">
      <div className="apt-top">
        <span className="apt-logo">青空アパート</span>
        <strong className="apt-floor">{range} 号室</strong>
        <span className="apt-info">A棟　入居者:{totalResidents}名　空室:{emptyRooms}部屋</span>
        <span className="apt-nav">
          <button type="button" className="apt-link" onClick={() => setFloorIdx((i) => Math.min(i + 1, RESIDENT_FLOORS.length - 1))} disabled={floorIdx >= RESIDENT_FLOORS.length - 1}>
            ▼ 下の階
          </button>
          <button type="button" className="apt-link" onClick={() => setFloorIdx((i) => Math.max(i - 1, 0))} disabled={floorIdx <= 0}>
            ▲ 上の階
          </button>
          <button type="button" className="apt-link" onClick={() => game.goHome()}>
            自分の部屋
          </button>
        </span>
      </div>

      <div className="area-line" aria-hidden="true">
        {Array.from({ length: 42 }).map((_, i) => (
          <span key={i} className={i % 9 === 0 ? 'area-live' : i % 5 === 0 ? 'area-selected' : ''}>
            {i % 9 === 0 ? 'LIVE!' : '□'}
          </span>
        ))}
      </div>

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
            <span className="door-copy">{r.title}</span>
            <span className="door-win">
              <img className="door-thumb" src={characterGif(r.characterId, 'idle')} alt="" draggable={false} />
            </span>
            <span className="door-plate">
              <span className="door-code">000034</span>
              <span className="door-name">{r.name}</span>
            </span>
          </button>
        ))}
      </div>
      <p className="apt-hint">SELECT ROOM　　ドアをクリック</p>
    </div>
  );
}
