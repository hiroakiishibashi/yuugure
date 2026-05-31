/**
 * App - The tabbed shell below the persistent PixiJS scene.
 * Tabs: ブログ (write → the character speaks), 部屋 (decorate), ギャラリー (doors).
 */

import { useState } from 'react';
import { useGame } from './GameContext';
import { BlogPanel } from './blog/BlogPanel';
import { RoomView } from './room/RoomView';
import { DoorGallery } from './gallery/DoorGallery';

type Tab = 'blog' | 'room' | 'gallery';

const TABS: { id: Tab; label: string }[] = [
  { id: 'blog', label: 'ブログ' },
  { id: 'room', label: 'へや' },
  { id: 'gallery', label: 'アパート' },
];

export function App(): JSX.Element {
  const [tab, setTab] = useState<Tab>('blog');
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
        {tab === 'blog' && <BlogPanel />}
        {tab === 'room' && <RoomView />}
        {tab === 'gallery' && <DoorGallery />}
      </div>
    </div>
  );
}
