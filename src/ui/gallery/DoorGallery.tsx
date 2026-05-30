/**
 * DoorGallery - The ギャラリー tab: a wall of doors to other players' rooms
 * (mocked locally for now; real rooms arrive with the backend in Phase 4).
 * Visiting a door plays a short NML scene in the stage above.
 */

import { useGame } from '../GameContext';

interface Door {
  id: string;
  name: string;
}

const DOORS: Door[] = [
  { id: 'd1', name: 'あおい' },
  { id: 'd2', name: 'しずく' },
  { id: 'd3', name: 'とおく' },
  { id: 'd4', name: 'ゆきの' },
  { id: 'd5', name: 'なまえなし' },
  { id: 'd6', name: 'よあけ' },
];

export function DoorGallery(): JSX.Element {
  const game = useGame();

  const visit = (door: Door): void => {
    void game.runNML(
      `<nml><clear><anim idle>${door.name}の　へや…\nだれも　いない　みたいだ\nまた　こよう<end></nml>`,
    );
  };

  return (
    <div>
      <p className="blog-hint">だれかの　へやの　とびら（クリックで　おとずれる）</p>
      <div className="doors">
        {DOORS.map((door) => (
          <button key={door.id} type="button" className="door" onClick={() => visit(door)}>
            <span className="door-knob" />
            <span className="door-name">{door.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
