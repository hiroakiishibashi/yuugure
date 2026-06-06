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
      <div className="box-title mail-title">
        <span className="mail-icon">✉</span>
        <strong>宛のメール</strong>
        <span className="mail-subject">（{r.title}）</span>
        <span className="box-actions">
          <button type="button" className="mini-btn" onClick={() => setI((x) => (x - 1 + total) % total)}>
            まえ
          </button>
          <button type="button" className="mini-btn" onClick={() => setI((x) => (x + 1) % total)}>
            つぎ
          </button>
          <button type="button" className="mini-btn">削除</button>
          <button type="button" className="mini-btn">閉じる</button>
        </span>
      </div>

      <div className="mail-meta">
        <span className="mail-room">
          {r.roomNo} 号室 <em className="mail-new">NEW!</em>
        </span>
        <span>差出人：{r.name}さん</span>
        <span className="mail-stars">評価：{'★'.repeat(stars)}{'☆'.repeat(5 - stars)}</span>
        <span>日時：2006/7/{String(1 + i).padStart(2, '0')} /08:36</span>
        <span className="mail-count">
          {i + 1}/999通
        </span>
      </div>

      <div className="mail-body">
        {r.lines.map((line, k) => (
          <p key={k}>・{line}</p>
        ))}
        <p className="mail-sig">── {r.name}（{r.roomNo}号室）</p>
      </div>

      <button type="button" className="btn btn-primary visit-btn" onClick={() => void game.enterRoom(r)}>
        この へやを たずねる
      </button>
    </div>
  );
}
