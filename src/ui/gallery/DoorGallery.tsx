/**
 * DoorGallery - The ギャラリー tab, restyled after the original game's
 * "DOOR SELECT" screen (newGate_doorSample): a row of numbered door cards
 * (A 011, A 012 …), each a different creature's room with the creature peeking
 * through the door window. Visiting swaps the on-screen creature and plays a
 * short scene ("部屋ごとにキャラが入れ替わる").
 */

import { useGame } from '../GameContext';
import { GALLERY_ROOM_IDS, getCharacter, characterGif, type CharacterDef } from '../../game/characters';

export function DoorGallery(): JSX.Element {
  const game = useGame();

  const visit = (c: CharacterDef): void => {
    game.setCharacter(c.id);
    void game.runNML(`<nml><clear><anim idle>${c.name}の　へや…\nそっと　はいってみよう<end></nml>`);
  };

  const rooms = GALLERY_ROOM_IDS.map((id) => getCharacter(id)).filter((c): c is CharacterDef => !!c);

  return (
    <div className="gallery">
      <div className="gallery-head">
        <span className="gallery-title">DOOR SELECT</span>
        <span className="gallery-sub">いる　へやを　えらんでください</span>
      </div>
      <div className="doors">
        {rooms.map((c, i) => (
          <button key={c.id} type="button" className="door" onClick={() => visit(c)}>
            <span className="door-id">A {String(11 + i).padStart(3, '0')}</span>
            <span className="door-window">
              <img className="door-thumb" src={characterGif(c.id, 'idle')} alt="" draggable={false} />
            </span>
            <span className="door-name">{c.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
