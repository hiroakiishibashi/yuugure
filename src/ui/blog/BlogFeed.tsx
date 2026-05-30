/**
 * BlogFeed - The player's own past entries, newest first, with the keyword the
 * character reacted to. (Other players' feeds arrive with the backend in Phase 4.)
 */

import { useEffect, useState } from 'react';
import { useGame } from '../GameContext';
import type { BlogPost } from '../../game/GameController';

export function BlogFeed(): JSX.Element {
  const game = useGame();
  const [posts, setPosts] = useState<BlogPost[]>([]);

  useEffect(() => game.subscribePosts(setPosts), [game]);

  if (posts.length === 0) {
    return <div className="feed-empty">まだ　なにも　かいていない…</div>;
  }

  return (
    <div className="feed">
      {posts.map((p) => (
        <div key={p.id} className="post">
          <div className="post-text">{p.text}</div>
          {p.matched && <span className="post-tag">「{p.matched}」に　はんのう</span>}
        </div>
      ))}
    </div>
  );
}
