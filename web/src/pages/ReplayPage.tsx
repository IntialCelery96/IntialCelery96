import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { COLS, GAME_MODES, type GameModeId, parseMoves, replay } from '@connect4gg/engine';
import { api, type GameSummary } from '../lib/api';
import { describeReason, formatDate, formatRatingDelta } from '../lib/format';
import { Board } from '../components/Board';
import { Avatar } from '../components/Avatar';

/**
 * Replay and analysis.
 *
 * The position at each ply is recomputed from the stored move list with the
 * same engine the server uses, so a replay can never disagree with the game
 * that was actually played.
 */
export function ReplayPage() {
  const { gameId } = useParams<{ gameId: string }>();
  const [game, setGame] = useState<GameSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ply, setPly] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!gameId) return;
    api
      .get<{ game: GameSummary }>(`/api/games/${gameId}`)
      .then((data) => {
        setGame(data.game);
        setPly(data.game.moveCount);
      })
      .catch(() => setError('That game could not be found.'));
  }, [gameId]);

  const columns = useMemo(() => (game ? parseMoves(game.moves) : []), [game]);

  const position = useMemo(() => replay(columns.slice(0, ply)), [columns, ply]);

  // Auto-play steps forward once a second and stops at the end.
  useEffect(() => {
    if (!playing) return;
    if (ply >= columns.length) {
      setPlaying(false);
      return;
    }
    const timer = setTimeout(() => setPly((p) => p + 1), 900);
    return () => clearTimeout(timer);
  }, [playing, ply, columns.length]);

  const lastMoveIndex = useMemo(() => {
    if (ply === 0) return undefined;
    const column = columns[ply - 1]!;
    for (let row = 5; row >= 0; row--) {
      const index = row * COLS + column;
      if (position.board[index] !== 0) return index;
    }
    return undefined;
  }, [columns, ply, position]);

  if (error) return <p className="text-center text-slate-400">{error}</p>;
  if (!game) return <p className="text-center text-slate-400">Loading…</p>;

  const modeInfo = GAME_MODES[game.mode as GameModeId];
  const atEnd = ply === columns.length;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <section className="flex flex-col items-center">
        <Board
          board={position.board}
          highlight={atEnd ? (position.winningLine ?? undefined) : undefined}
          lastMove={lastMoveIndex}
          label="Game replay"
        />

        <div className="mt-4 w-full max-w-xl">
          <input
            type="range"
            min={0}
            max={columns.length}
            value={ply}
            onChange={(event) => {
              setPlaying(false);
              setPly(Number(event.target.value));
            }}
            className="w-full accent-sky-500"
            aria-label="Move number"
          />

          <div className="mt-2 flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => {
                setPlaying(false);
                setPly(0);
              }}
              className="btn-secondary text-sm"
              disabled={ply === 0}
              aria-label="Go to start"
            >
              ⏮
            </button>
            <button
              type="button"
              onClick={() => {
                setPlaying(false);
                setPly((p) => Math.max(0, p - 1));
              }}
              className="btn-secondary text-sm"
              disabled={ply === 0}
              aria-label="Previous move"
            >
              ◀
            </button>
            <button
              type="button"
              onClick={() => setPlaying((p) => !p)}
              className="btn-primary w-24 text-sm"
              disabled={atEnd}
            >
              {playing ? 'Pause' : 'Play'}
            </button>
            <button
              type="button"
              onClick={() => {
                setPlaying(false);
                setPly((p) => Math.min(columns.length, p + 1));
              }}
              className="btn-secondary text-sm"
              disabled={atEnd}
              aria-label="Next move"
            >
              ▶
            </button>
            <button
              type="button"
              onClick={() => {
                setPlaying(false);
                setPly(columns.length);
              }}
              className="btn-secondary text-sm"
              disabled={atEnd}
              aria-label="Go to end"
            >
              ⏭
            </button>
          </div>

          <p className="mt-2 text-center text-sm text-slate-400">
            Move {ply} of {columns.length}
            {ply > 0 && ` — column ${columns[ply - 1]! + 1}`}
          </p>
        </div>
      </section>

      <aside className="space-y-4">
        <div className="card">
          <h1 className="mb-3 font-semibold">
            {modeInfo?.name ?? game.mode}
            <span className="ml-2 text-sm font-normal text-slate-400">
              {game.rated ? 'Rated' : 'Casual'}
            </span>
          </h1>

          <div className="space-y-2">
            <ReplaySide side={game.player1} player={1} isWinner={game.result === 'PLAYER1_WIN'} />
            <ReplaySide side={game.player2} player={2} isWinner={game.result === 'PLAYER2_WIN'} />
          </div>

          <p className="mt-3 border-t border-slate-800 pt-3 text-sm text-slate-400">
            {game.result === 'DRAW'
              ? 'Drawn'
              : game.result === 'ABORTED'
                ? 'Aborted'
                : `Won ${describeReason(game.endReason)}`}
          </p>
          <p className="mt-1 text-xs text-slate-500">{formatDate(game.startedAt)}</p>
        </div>

        <div className="card">
          <h2 className="mb-2 text-sm font-semibold text-slate-300">Moves</h2>
          <ol className="grid grid-cols-6 gap-1 font-mono text-xs">
            {columns.map((column, index) => (
              <li key={index}>
                <button
                  type="button"
                  onClick={() => {
                    setPlaying(false);
                    setPly(index + 1);
                  }}
                  className={`w-full rounded px-1 py-0.5 ${
                    ply === index + 1
                      ? 'bg-sky-500 text-white'
                      : index % 2 === 0
                        ? 'bg-red-disc/20 text-red-300 hover:bg-red-disc/30'
                        : 'bg-yellow-disc/20 text-yellow-200 hover:bg-yellow-disc/30'
                  }`}
                >
                  {column + 1}
                </button>
              </li>
            ))}
          </ol>
          {columns.length === 0 && <p className="text-xs text-slate-500">No moves were played.</p>}
        </div>

        <Link to="/play" className="btn-secondary w-full">
          Play a game
        </Link>
      </aside>
    </div>
  );
}

function ReplaySide({
  side,
  player,
  isWinner,
}: {
  side: GameSummary['player1'];
  player: 1 | 2;
  isWinner: boolean;
}) {
  const name = side.user?.username ?? side.botName ?? 'Unknown';

  return (
    <div className="flex items-center gap-2">
      <span
        className={`h-3 w-3 shrink-0 rounded-full ${
          player === 1 ? 'bg-red-disc' : 'bg-yellow-disc'
        }`}
      />
      <Avatar
        username={name}
        avatarUrl={side.user?.avatarUrl}
        color={side.user?.avatarColor}
        size="xs"
        isBot={Boolean(side.botId)}
      />
      {side.user ? (
        <Link to={`/profile/${name}`} className="flex-1 truncate text-sm hover:text-sky-300">
          {name}
        </Link>
      ) : (
        <span className="flex-1 truncate text-sm">{name}</span>
      )}
      {side.rating !== null && <span className="text-xs text-slate-400">{side.rating}</span>}
      {side.ratingDelta !== null && (
        <span
          className={`text-xs font-medium ${
            side.ratingDelta > 0 ? 'text-emerald-400' : 'text-rose-400'
          }`}
        >
          {formatRatingDelta(side.ratingDelta)}
        </span>
      )}
      {isWinner && <span className="chip bg-emerald-500/15 text-emerald-300">won</span>}
    </div>
  );
}
