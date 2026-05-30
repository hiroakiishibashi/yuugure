/**
 * Phase 3 entry — boots the React UI. The engine + PixiJS renderer from Phases
 * 1 & 2 are driven by the GameController behind the React tree.
 *
 * StrictMode is intentionally omitted: its dev double-invoke of effects would
 * create and destroy two PixiJS Applications on mount.
 */

import { createRoot } from 'react-dom/client';
import { GameProvider } from './ui/GameContext';
import { App } from './ui/App';
import './ui/styles.css';

const el = document.getElementById('app');
if (!el) throw new Error('#app not found');

createRoot(el).render(
  <GameProvider>
    <App />
  </GameProvider>,
);
