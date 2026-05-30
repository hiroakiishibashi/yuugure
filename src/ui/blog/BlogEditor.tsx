/**
 * BlogEditor - The player writes a blog entry; the character speaks its
 * reaction (GameController.speakBlog → blogToNML → engine + PixiHost). This is
 * the core "夕暮れ" loop. The button is disabled while the character speaks.
 */

import { useState } from 'react';
import { useGame } from '../GameContext';

export function BlogEditor(): JSX.Element {
  const game = useGame();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (): Promise<void> => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    try {
      await game.speakBlog(trimmed);
      setText('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="blog">
      <textarea
        className="field"
        rows={3}
        placeholder="きょう　あった　ことを　かいてみよう…"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="blog-row">
        <button type="button" className="btn btn-primary" disabled={busy || !text.trim()} onClick={submit}>
          {busy ? 'はなしているよ…' : 'キャラに　はなす'}
        </button>
        <span className="blog-hint">「うれしい」「さみしい」などの ことばに キャラが はんのうするよ</span>
      </div>
    </div>
  );
}
