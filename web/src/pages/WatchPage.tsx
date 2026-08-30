import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { COLS, GAME_MODES, type GameModeId } from '@connect4gg/engine';
import { getSocket, type LiveGamePayload } from '../lib/socket';
import { describeReason } from '../lib/format';
import { Board } from '../components/Board';
import { PlayerBar } from '../components/PlayerBar';

/**
 * Spectator view.
 *
 * Joins the same room as the players and receives the same broadcasts, minus
 * any ability to move — the server simply never finds a spectator a seat.
 */
export function WatchPage() {
  const { gameId } = useParams<{ gameId: string }>();
  const [game, setGame] = useState<LiveGamePayload | null>(null);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    if (!gameId) return;
    const socket = getSocket();

    const onState = (payload: LiveGamePayload) => {
      if (payload.id === gameId) setGame(payload);
    };
    const onOver = (payload: { game: LiveGamePayload }) => {
      if (payload.game.id === gameId) setGame(payload.game);
    };
    const onNotFound = (payload: { gameId: string }) => {
      if (payload.gameId === gameId) setGone(true);
    };

    socket.on('game:state', onState);
    socket.on('game:over', onOver);
    socket.on('game:notFound', onNotFound);
    socket.emit('game:join', { gameId });

    const onConnect = () => socket.emit('game:join', { gameId });
    socket.on('connect', onConnect);

    return () => {
      socket.emit('game:leave', { gameId });
      socket.off('game:state', onState);
      socket.off('game:over', onOver);
      socket.off('game:notFound', onNotFound);
      socket.off('connect', onConnect);
    };
  }, [gameId]);

  const lastMove = useMemo(() => {
    if (!game || game.moves.length === 0) return undefined;
    const column = Number(game.moves[game.moves.length - 1]);
    for (let row = 5; row >= 0; row--) {
      const index = row * COLS + column;
      if (game.board[index] !== 0) return index;
    }
    return undefined;
  }, [game]);

  if (gone) {
    return (
      <div className="py-16 text-center">
        <p className="text-ink-3">That game has finished.</p>
        <Link to={`/replay/${gameId}`} className="btn-secondary mt-4">
          Watch the replay
        </Link>
      </div>
    );
  }

  if (!game) return <p className="py-16 text-center text-ink-3">Connecting…</p>;

  const mode = GAME_MODES[game.mode as GameModeId];

  return (
    <div className="flex flex-col items-center">
      <span className="chip mb-3 bg-surface-2 text-ink-2">Spectating</span>

      <div className="mb-3 w-full max-w-xl">
        <PlayerBar
          seat={game.players[2]}
          player={2}
          clock={game.clock}
          isYou={false}
          active={game.turn === 2 && !game.over}
        />
      </div>

      <Board
        board={game.board}
        highlight={game.winningLine ?? undefined}
        lastMove={lastMove}
        label="Spectated game"
      />

      <div className="mt-3 w-full max-w-xl">
        <PlayerBar
          seat={game.players[1]}
          player={1}
          clock={game.clock}
          isYou={false}
          active={game.turn === 1 && !game.over}
        />
      </div>

      <p className="mt-4 text-sm text-ink-3">
        {mode?.name ?? game.mode} · {game.rated ? 'rated' : 'casual'}
        {game.over && ` · ${describeReason(game.over.reason)}`}
      </p>

      {game.over && (
        <Link to={`/replay/${game.id}`} className="btn-secondary mt-4">
          Replay this game
        </Link>
      )}
    </div>
  );
}
