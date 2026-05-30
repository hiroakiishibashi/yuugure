/**
 * DoorGallery - The ギャラリー tab: each door is a different creature's room
 * (realising "部屋ごとにキャラが入れ替わる"). Visiting swaps the on-screen
 * pixel-art creature to that room's resident and plays a short scene.
 * Doors show the creature's actual GIF as a pixel-art thumbnail.
 */

import { useGame } from '../GameContext';
import { GALLERY_ROOM_IDS, getCharacter, type CharacterDef } from '../../game/characters';

export function DoorGallery(): JSX.Element {
  const game = useGame();

  const visit = (c: CharacterDef): void => {
    game.setCharacter(c.id);
    void game.runNML(`<nml><clear><anim idle>${c.name}の　へや…\nそっと　はいってみよう<end></nml>`);
  };

  const rooms = GALLERY_ROOM_IDS.map((id) => getCharacter(id)).filter((c): c is CharacterDef => !!c);

  return (
    <div>
      <p className="blog-hint">だれかの　へやの　とびら（クリックで　おとずれる）</p>
      <div className="doors">
        {rooms.map((c) => (
          <button key={c.id} type="button" className="door" onClick={() => visit(c)}>
            <img className="door-thumb" src={c.gif} alt="" draggable={false} />
            <span className="door-name">{c.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
