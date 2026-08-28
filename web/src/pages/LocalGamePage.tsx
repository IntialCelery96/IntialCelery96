import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { COLS, applyMove, createGame, type GameState } from '@connect4gg/engine';
import { Board } from '../components/Board';

/**
 * Two players, one screen, no server.
 *
 * This runs the engine directly in the browser. It exists partly as a genuine
 * feature (playing someone next to you needs no account) and partly as a check
 * on the UI/engine contract: if the board works here, the only thing the
 * networked game adds is transport.
 */
export function LocalGamePage() {
  const [history, setHistory] = useState<GameState[]>([createGame()]);
  const state = history[history.length - 1]!;

  const drop = useCallback((column: number) => {
    setHistory((previous) => {
      const current = previous[previous.length - 1]!;
      if (current.status !== 'in_progress') return previous;
      try {
        return [...previous, applyMove(current, column)];
      } catch {
        // An illegal column is simply ignored; the board already prevents it.
        return previous;
      }
    });
  }, []);

  const undo = useCallback(() => {
    setHistory((previous) => (previous.length > 1 ? previous.slice(0, -1) : previous));
  }, []);

  const reset = useCallback(() => setHistory([createGame()]), []);

  const lastMove = useMemo(() => {
    if (state.moves.length === 0) return undefined;
    const column = state.moves[state.moves.length - 1]!;
    for (let row = 5; row >= 0; row--) {
      const index = row * COLS + column;
      if (state.board[index] !== 0) return index;
    }
    return undefined;
  }, [state]);

  const status =
    state.status === 'win'
      ? `${state.winner === 1 ? 'Red' : 'Yellow'} wins`
      : state.status === 'draw'
        ? 'Draw — the board is full'
        : `${state.turn === 1 ? 'Red' : 'Yellow'} to move`;

  return (
    <div className="flex flex-col items-center py-4">
      <h1 className="mb-1 text-2xl font-bold">Local game</h1>
      <p className="mb-5 text-sm text-slate-400">
        Two players, one device. Nothing is saved or rated.
      </p>

      <div className="mb-4 flex items-center gap-3">
        <span
          className={`h-4 w-4 rounded-full ${
            state.turn === 1
              ? 'bg-gradient-to-br from-red-disc to-red-discDark'
              : 'bg-gradient-to-br from-yellow-disc to-yellow-discDark'
          }`}
        />
        <span className="text-lg font-medium" role="status">
          {status}
        </span>
      </div>

      <Board
        board={state.board}
        onDrop={state.status === 'in_progress' ? drop : undefined}
        previewPlayer={state.turn}
        highlight={state.winningLine ?? undefined}
        lastMove={lastMove}
        label="Local Connect 4 game"
      />

      <div className="mt-5 flex gap-2">
        <button
          type="button"
          onClick={undo}
          className="btn-secondary"
          disabled={history.length === 1}
        >
          Undo
        </button>
        <button type="button" onClick={reset} className="btn-secondary">
          New game
        </button>
        <Link to="/play" className="btn-primary">
          Play online
        </Link>
      </div>

      <p className="mt-4 font-mono text-xs text-slate-600">
        {state.moves.map((m) => m + 1).join(' ') || 'No moves yet'}
      </p>
    </div>
  );
}
