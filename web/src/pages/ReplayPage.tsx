import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { COLS, GAME_MODES, type GameModeId, dropRow, parseMoves, replay } from '@connect4gg/engine';
import { ApiError, api, type GameAnalysis, type GameSummary, type MoveAnalysis } from '../lib/api';
import { describeReason, formatDate, formatRatingDelta, playerName } from '../lib/format';
import { Board } from '../components/Board';
import { Avatar } from '../components/Avatar';
import { AnalysisPanel, QUALITY_STYLE } from '../components/AnalysisPanel';

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
  const [analysis, setAnalysis] = useState<GameAnalysis | null>(null);
  const [analysing, setAnalysing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

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

  /**
   * The verdict on the move that produced the position on screen. `ply` counts
   * moves played, so ply 3 shows the board after move index 2.
   */
  const currentMove = useMemo(
    () => analysis?.moves.find((move) => move.ply === ply - 1) ?? null,
    [analysis, ply],
  );

  /** Verdicts keyed by ply, for annotating the move list. */
  const byPly = useMemo(() => {
    const map = new Map<number, MoveAnalysis>();
    for (const move of analysis?.moves ?? []) map.set(move.ply, move);
    return map;
  }, [analysis]);

  /**
   * Where the engine's preferred move would have landed, in the position the
   * player faced. Null when they played it, or when there is no analysis.
   */
  const suggestionIndex = useMemo(() => {
    if (!currentMove || currentMove.column === currentMove.bestColumn) return undefined;
    const before = replay(columns.slice(0, ply - 1));
    const row = dropRow(before.board, currentMove.bestColumn);
    return row === -1 ? undefined : row * COLS + currentMove.bestColumn;
  }, [currentMove, columns, ply]);

  const lastMoveIndex = useMemo(() => {
    if (ply === 0) return undefined;
    const column = columns[ply - 1]!;
    for (let row = 5; row >= 0; row--) {
      const index = row * COLS + column;
      if (position.board[index] !== 0) return index;
    }
    return undefined;
  }, [columns, ply, position]);

  async function runAnalysis(): Promise<void> {
    if (!gameId || analysing) return;
    setAnalysing(true);
    setAnalysisError(null);
    try {
      const data = await api.get<{ analysis: GameAnalysis }>(`/api/games/${gameId}/analysis`);
      setAnalysis(data.analysis);
    } catch (caught) {
      setAnalysisError(
        caught instanceof ApiError ? caught.message : 'Could not analyse this game.',
      );
    } finally {
      setAnalysing(false);
    }
  }

  if (error) return <p className="text-center text-ink-3">{error}</p>;
  if (!game) return <p className="text-center text-ink-3">Loading…</p>;

  const modeInfo = GAME_MODES[game.mode as GameModeId];
  const atEnd = ply === columns.length;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <section className="flex flex-col items-center">
        <Board
          board={position.board}
          highlight={atEnd ? (position.winningLine ?? undefined) : undefined}
          lastMove={lastMoveIndex}
          suggestion={suggestionIndex}
          label="Game replay"
        />

        {suggestionIndex !== undefined && currentMove && (
          <p className="mt-2 text-xs text-accent-text">
            ★ marks where column {currentMove.bestColumn + 1} would have landed.
          </p>
        )}

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
            className="w-full accent-accent"
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

          <p className="mt-2 text-center text-sm text-ink-3">
            Move {ply} of {columns.length}
            {ply > 0 && ` — column ${columns[ply - 1]! + 1}`}
          </p>
        </div>
      </section>

      <aside className="space-y-4">
        <div className="card">
          <h1 className="mb-3 font-semibold">
            {modeInfo?.name ?? game.mode}
            <span className="ml-2 text-sm font-normal text-ink-3">
              {game.rated ? 'Rated' : 'Casual'}
            </span>
          </h1>

          <div className="space-y-2">
            <ReplaySide side={game.player1} player={1} isWinner={game.result === 'PLAYER1_WIN'} />
            <ReplaySide side={game.player2} player={2} isWinner={game.result === 'PLAYER2_WIN'} />
          </div>

          <p className="mt-3 border-t border-surface-2 pt-3 text-sm text-ink-3">
            {game.result === 'DRAW'
              ? 'Drawn'
              : game.result === 'ABORTED'
                ? 'Aborted'
                : `Won ${describeReason(game.endReason)}`}
          </p>
          <p className="mt-1 text-xs text-ink-4">{formatDate(game.startedAt)}</p>
        </div>

        <div className="card">
          <h2 className="mb-2 text-sm font-semibold text-ink-2">Moves</h2>
          <ol className="grid grid-cols-6 gap-1 font-mono text-xs">
            {columns.map((column, index) => {
              const verdict = byPly.get(index);
              const notable = verdict ? QUALITY_STYLE[verdict.quality].notable : false;
              return (
                <li key={index} className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      setPlaying(false);
                      setPly(index + 1);
                    }}
                    title={verdict ? `${QUALITY_STYLE[verdict.quality].label}` : undefined}
                    className={`w-full rounded px-1 py-0.5 ${
                      ply === index + 1
                        ? 'bg-accent text-on-accent'
                        : index % 2 === 0
                          ? 'bg-p1/20 text-p1 hover:bg-p1/30'
                          : 'bg-p2/20 text-p2 hover:bg-p2/30'
                    }`}
                  >
                    {column + 1}
                  </button>
                  {/* A dot rather than a recolour: the red/yellow already
                      encodes whose move it was, and that must stay readable. */}
                  {notable && verdict && (
                    <span
                      className={`pointer-events-none absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full ${
                        QUALITY_STYLE[verdict.quality].dot
                      }`}
                    />
                  )}
                </li>
              );
            })}
          </ol>
          {columns.length === 0 && <p className="text-xs text-ink-4">No moves were played.</p>}
        </div>

        {analysis ? (
          <AnalysisPanel
            analysis={analysis}
            current={currentMove}
            player1Name={game.player1.user?.username ?? game.player1.botName ?? playerName(1)}
            player2Name={game.player2.user?.username ?? game.player2.botName ?? playerName(2)}
            onSelectPly={(target) => {
              setPlaying(false);
              setPly(target);
            }}
          />
        ) : (
          <div className="card">
            <h2 className="mb-1 text-sm font-semibold text-ink-2">Analysis</h2>
            <p className="mb-3 text-xs text-ink-4">
              Have the engine check every move for missed wins and blunders.
            </p>
            <button
              type="button"
              onClick={() => void runAnalysis()}
              className="btn-primary w-full"
              disabled={analysing || columns.length === 0}
            >
              {analysing ? 'Analysing…' : 'Analyze this game'}
            </button>
            {analysisError && (
              <p className="mt-2 text-xs text-bad" role="alert">
                {analysisError}
              </p>
            )}
          </div>
        )}

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
          player === 1 ? 'bg-p1' : 'bg-p2'
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
        <Link to={`/profile/${name}`} className="flex-1 truncate text-sm hover:text-accent-text">
          {name}
        </Link>
      ) : (
        <span className="flex-1 truncate text-sm">{name}</span>
      )}
      {side.rating !== null && <span className="text-xs text-ink-3">{side.rating}</span>}
      {side.ratingDelta !== null && (
        <span
          className={`text-xs font-medium ${
            side.ratingDelta > 0 ? 'text-good' : 'text-bad'
          }`}
        >
          {formatRatingDelta(side.ratingDelta)}
        </span>
      )}
      {isWinner && <span className="chip bg-good/15 text-good">won</span>}
    </div>
  );
}
