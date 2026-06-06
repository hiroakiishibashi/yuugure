/**
 * GameContext - Creates the single GameController (which boots PixiJS) once and
 * shares it with the React tree, then lays out the top "scene".
 *
 * The scene shows one of two spaces, switched by the controller's sceneMode:
 *   • 部屋の中 (inside)  — the persistent PixiJS room + creature + a HUD to step
 *                         out and to rearrange furniture (もようがえ).
 *   • 部屋の外 (outside) — the 青空アパート DOOR SELECT (doors + floor nav).
 * Moving between them plays a sliding-door transition. The PixiJS canvas mounts
 * into a persistent `.stage` element so the room stays alive across switches.
 */

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { GameController, type SceneMode } from '../game/GameController';
import { DoorGallery } from './gallery/DoorGallery';

const GameCtx = createContext<GameController | null>(null);

export function useGame(): GameController {
  const game = useContext(GameCtx);
  if (!game) throw new Error('useGame must be used within <GameProvider>');
  return game;
}

// transition timing: doors slide shut, the scene swaps behind them, doors open
const CLOSE_MS = 320;
const SWAP_MS = 90;

export function GameProvider({ children }: { children: ReactNode }): JSX.Element {
  const stageRef = useRef<HTMLDivElement>(null);
  const [game, setGame] = useState<GameController | null>(null);
  const [displayMode, setDisplayMode] = useState<SceneMode>('inside');
  const [curtainClosed, setCurtainClosed] = useState(false);
  const displayModeRef = useRef<SceneMode>('inside');

  useEffect(() => {
    let cancelled = false;
    let controller: GameController | null = null;

    GameController.create(stageRef.current!).then((c) => {
      if (cancelled) {
        c.destroy();
        return;
      }
      controller = c;
      setGame(c);
      void c.intro();
    });

    return () => {
      cancelled = true;
      controller?.destroy();
    };
  }, []);

  // Orchestrate the sliding-door transition whenever the scene mode changes.
  useEffect(() => {
    if (!game) return;
    let alive = true;
    const timers: number[] = [];
    const unsub = game.subscribeMode((next) => {
      if (next === displayModeRef.current) return; // initial sync / no-op
      setCurtainClosed(true); // doors slide shut over the current view
      timers.push(
        window.setTimeout(() => {
          if (!alive) return;
          displayModeRef.current = next;
          setDisplayMode(next); // swap the scene behind the closed doors
          timers.push(window.setTimeout(() => alive && setCurtainClosed(false), SWAP_MS));
        }, CLOSE_MS),
      );
    });
    return () => {
      alive = false;
      unsub();
      timers.forEach((t) => clearTimeout(t));
    };
  }, [game]);

  const inside = displayMode === 'inside';

  return (
    <div className="app">
      <div className={`scene scene-${displayMode}`}>
        {/* INSIDE — the persistent PixiJS room + the in-room HUD */}
        <div className="scene-layer scene-inside" style={{ display: inside ? 'block' : 'none' }}>
          <div className="stage" ref={stageRef} />
          {game && (
            <GameCtx.Provider value={game}>
              <InsideControls />
            </GameCtx.Provider>
          )}
        </div>

        {/* OUTSIDE — the apartment doors */}
        {game && (
          <div className="scene-layer scene-outside" style={{ display: inside ? 'none' : 'block' }}>
            <GameCtx.Provider value={game}>
              <DoorGallery />
            </GameCtx.Provider>
          </div>
        )}

        {/* sliding-door transition curtain */}
        <div className={`curtain${curtainClosed ? ' is-closed' : ''}`} aria-hidden="true">
          <span className="curtain-half left" />
          <span className="curtain-half right" />
        </div>
      </div>

      {game ? (
        <GameCtx.Provider value={game}>{children}</GameCtx.Provider>
      ) : (
        <div className="loading">よみこみ中…</div>
      )}
    </div>
  );
}

/** Compact in-room HUD over the scene: leave the room and toggle furniture edit. */
function InsideControls(): JSX.Element {
  const game = useGame();
  const [own, setOwn] = useState(game.isOwnRoom);
  const [editing, setEditing] = useState(game.editing);

  useEffect(() => game.subscribeMode(() => setOwn(game.isOwnRoom)), [game]);
  useEffect(() => game.subscribeEdit(setEditing), [game]);

  return (
    <div className="room-hud">
      <div className="hud-bar">
        <button type="button" className="hud-btn" onClick={() => game.goOutside()}>
          EXIT
        </button>
        {own && (
          <button
            type="button"
            className={`hud-btn${editing ? ' on' : ''}`}
            onClick={() => game.setEditMode(!editing)}
          >
            {editing ? 'EDIT ON' : 'EDIT'}
          </button>
        )}
      </div>
    </div>
  );
}
