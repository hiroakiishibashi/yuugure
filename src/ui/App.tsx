/**
 * App - The panel BELOW the scene. The spatial parts (青空アパート doors and the
 * room itself with furniture) now live in the top scene (see GameContext); this
 * panel holds the player's "small boxes": NMLの小箱 (mail) and じぶんの小箱 (blog,
 * the write → the creature speaks loop).
 */

import { useState } from 'react';
import { useGame } from './GameContext';
import { BlogPanel } from './blog/BlogPanel';
import { MailBox } from './mail/MailBox';
import { RoomBox } from './room/RoomBox';

type Tab = 'room' | 'mail' | 'blog';

const TABS: { id: Tab; label: string }[] = [
  { id: 'room', label: '自分の部屋' },
  { id: 'mail', label: 'NMLの小箱' },
  { id: 'blog', label: 'しあわせの箱' },
];

export function App(): JSX.Element {
  const [tab, setTab] = useState<Tab>('room');
  const game = useGame();

  return (
    <div className="panel-wrap">
      {!game.signedIn && (
        <a className="save-hint" href="/auth/login.html" target="_top" rel="noopener">
          ログインすると　きろくが　ほかの　デバイスにも　のこります →
        </a>
      )}
      <nav className="tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`tab${tab === t.id ? ' tab-active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>
      <div className="panel">
        {tab === 'room' && <RoomBox />}
        {tab === 'mail' && <MailBox />}
        {tab === 'blog' && <BlogPanel />}
      </div>
    </div>
  );
}
