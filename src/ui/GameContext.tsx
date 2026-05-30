/**
 * GameContext - Creates the single GameController (which boots PixiJS) once and
 * shares it with the React tree. The PixiJS scene mounts into a persistent
 * `.stage` element so the room + character stay alive across tab switches.
 */

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { GameController } from '../game/GameController';

const GameCtx = createContext<GameController | null>(null);

export function useGame(): GameController {
  const game = useContext(GameCtx);
  if (!game) throw new Error('useGame must be used within <GameProvider>');
  return game;
}

export function GameProvider({ children }: { children: ReactNode }): JSX.Element {
  const stageRef = useRef<HTMLDivElement>(null);
  const [game, setGame] = useState<GameController | null>(null);

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

  return (
    <div className="app">
      <header className="app-header">
        <h1>夕暮れ</h1>
        <span className="app-sub">— のけものがたり —</span>
      </header>
      <div className="stage" ref={stageRef} />
      {game ? (
        <GameCtx.Provider value={game}>{children}</GameCtx.Provider>
      ) : (
        <div className="loading">よみこみ中…</div>
      )}
    </div>
  );
}
