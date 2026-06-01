/**
 * MailBox — the "NMLの小箱" panel from the original screen: read other
 * residents' NML like mail (subject, sender, ★ rating, date, NEW!, 1/N通) with
 * prev/next navigation, and a button to visit that resident's room.
 */

import { useState } from 'react';
import { useGame } from '../GameContext';
import { RESIDENTS } from '../../game/residents';

function ratingFor(roomNo: string): number {
  // deterministic 2–5 stars from the room number
  const n = [...roomNo].reduce((a, c) => a + c.charCodeAt(0), 0);
  return 2 + (n % 4);
}

export function MailBox(): JSX.Element {
  const game = useGame();
  const [i, setI] = useState(0);
  const total = RESIDENTS.length;
  const r = RESIDENTS[i]!;
  const stars = ratingFor(r.roomNo);

  return (
    <div className="mail">
      <div className="mail-head">
        <span className="mail-subject">✉ {r.title}（NMLタイトル）</span>
        <span className="mail-nav">
          <button type="button" className="apt-btn" onClick={() => setI((x) => (x - 1 + total) % total)}>
            ◀ まえ
          </button>
          <button type="button" className="apt-btn" onClick={() => setI((x) => (x + 1) % total)}>
            つぎ ▶
          </button>
          <span className="mail-count">
            {i + 1}/{total}通
          </span>
        </span>
      </div>

      <div className="mail-meta">
        <span className="mail-room">
          {r.roomNo}号室 <em className="mail-new">NEW!</em>
        </span>
        <span>差出人：{r.name}さん</span>
        <span className="mail-stars">評価：{'★'.repeat(stars)}{'☆'.repeat(5 - stars)}</span>
      </div>

      <div className="mail-body">
        {r.lines.map((line, k) => (
          <p key={k}>・{line}</p>
        ))}
        <p className="mail-sig">── {r.name}（{r.roomNo}号室）</p>
      </div>

      <button type="button" className="btn btn-primary" onClick={() => void game.visitRoom(r)}>
        この へやを たずねる →
      </button>
    </div>
  );
}
