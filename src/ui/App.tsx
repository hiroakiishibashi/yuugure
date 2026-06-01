/**
 * App - The tabbed shell below the persistent PixiJS scene.
 * Tabs: ブログ (write → the character speaks), 部屋 (decorate), ギャラリー (doors).
 */

import { useState } from 'react';
import { useGame } from './GameContext';
import { BlogPanel } from './blog/BlogPanel';
import { RoomView } from './room/RoomView';
import { DoorGallery } from './gallery/DoorGallery';
import { MailBox } from './mail/MailBox';

type Tab = 'gallery' | 'mail' | 'blog' | 'room';

const TABS: { id: Tab; label: string }[] = [
  { id: 'gallery', label: '青空アパート' },
  { id: 'mail', label: 'NMLの小箱' },
  { id: 'blog', label: 'じぶんの小箱' },
  { id: 'room', label: 'へや' },
];

export function App(): JSX.Element {
  const [tab, setTab] = useState<Tab>('gallery');
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
        {tab === 'gallery' && <DoorGallery />}
        {tab === 'mail' && <MailBox />}
        {tab === 'blog' && <BlogPanel />}
        {tab === 'room' && <RoomView />}
      </div>
    </div>
  );
}
