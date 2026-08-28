import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { COLS, GAME_MODES, type GameModeId } from '@connect4gg/engine';
import { useAuth } from '../context/AuthContext';
import {
  getSocket,
  type LiveGamePayload,
  type Player,
  type RatingChange,
} from '../lib/socket';
import { describeReason, formatRatingDelta } from '../lib/format';
import { Board } from '../components/Board';
import { PlayerBar } from '../components/PlayerBar';

/**
 * The live game.
 *
 * All state comes from the server: this screen never computes a board position
 * itself. A click emits a column and waits for the authoritative `game:state`
 * to come back. That costs one round trip of latency and buys immunity from
 * every class of client/server desync.
 */
export function GamePage() {
  const { gameId } = useParams<{ gameId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [game, setGame] = useState<LiveGamePayload | null>(null);
  const [ratings, setRatings] = useState<RatingChange | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [spectating, setSpectating] = useState(false);
  const [rematchSent, setRematchSent] = useState(false);
  const [rematchOffered, setRematchOffered] = useState(false);

  // Tracks the previous move count so a landing disc can be highlighted.
  const previousMovesRef = useRef(0);

  useEffect(() => {
    if (!gameId) return;
    const socket = getSocket();

    const onState = (payload: LiveGamePayload) => {
      if (payload.id !== gameId) return;
      setGame(payload);
      setNotFound(false);
    };

    const onOver = (payload: { game: LiveGamePayload; ratings: RatingChange | null }) => {
      if (payload.game.id !== gameId) return;
      setGame(payload.game);
      setRatings(payload.ratings);
    };

    const onNotFound = (payload: { gameId: string }) => {
      if (payload.gameId !== gameId) return;
      // Finished games are no longer live; fall back to the replay view.
      navigate(`/replay/${gameId}`, { replace: true });
    };

    const onRejected = (payload: { message: string }) => setMessage(payload.message);
    const onSpectating = () => setSpectating(true);
    const onRateLimit = (payload: { message: string }) => setMessage(payload.message);
    const onRematchOffered = (payload: { gameId: string }) => {
      if (payload.gameId === gameId) setRematchOffered(true);
    };
    const onMatched = (payload: { gameId: string }) => navigate(`/game/${payload.gameId}`);

    socket.on('game:state', onState);
    socket.on('game:over', onOver);
    socket.on('game:notFound', onNotFound);
    socket.on('game:rejected', onRejected);
    socket.on('game:spectating', onSpectating);
    socket.on('error:rate', onRateLimit);
    socket.on('game:rematchOffered', onRematchOffered);
    socket.on('game:matched', onMatched);

    socket.emit('game:join', { gameId });

    // Re-join after a reconnect, so a dropped socket restores the room.
    const onConnect = () => socket.emit('game:join', { gameId });
    socket.on('connect', onConnect);

    return () => {
      socket.emit('game:leave', { gameId });
      socket.off('game:state', onState);
      socket.off('game:over', onOver);
      socket.off('game:notFound', onNotFound);
      socket.off('game:rejected', onRejected);
      socket.off('game:spectating', onSpectating);
      socket.off('error:rate', onRateLimit);
      socket.off('game:rematchOffered', onRematchOffered);
      socket.off('game:matched', onMatched);
      socket.off('connect', onConnect);
    };
  }, [gameId, navigate, setNotFound]);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), 4_000);
    return () => clearTimeout(timer);
  }, [message]);

  const mySeat = useMemo<Player | null>(() => {
    if (!game || !user) return null;
    if (game.players[1].userId === user.id) return 1;
    if (game.players[2].userId === user.id) return 2;
    return null;
  }, [game, user]);

  const myTurn = Boolean(game && mySeat !== null && game.turn === mySeat && !game.over);

  const lastMoveIndex = useMemo(() => {
    if (!game || game.moves.length === 0) return undefined;
    // Re-derive where the last disc landed by counting discs in that column.
    const column = Number(game.moves[game.moves.length - 1]);
    for (let row = 5; row >= 0; row--) {
      const index = row * COLS + column;
      if (game.board[index] !== 0) return index;
    }
    return undefined;
  }, [game]);

  useEffect(() => {
    if (game) previousMovesRef.current = game.moves.length;
  }, [game]);

  const drop = useCallback(
    (column: number) => {
      if (!gameId || !myTurn) return;
      getSocket().emit('game:move', { gameId, column });
    },
    [gameId, myTurn],
  );

  // Keyboard play: 1-7 drops in that column, which is much faster in blitz.
  useEffect(() => {
    if (!myTurn) return;
    const onKey = (event: KeyboardEvent) => {
      const column = Number(event.key) - 1;
      if (Number.isInteger(column) && column >= 0 && column < COLS) drop(column);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [myTurn, drop]);

  if (notFound) {
    return <p className="text-center text-slate-400">That game could not be found.</p>;
  }

  if (!game) {
    return (
      <div className="flex justify-center py-20">
        <p className="text-slate-400">Loading game…</p>
      </div>
    );
  }

  const opponentSeat: Player = mySeat === 1 ? 2 : 1;
  const topSeat: Player = mySeat === 2 ? 1 : 2;
  const bottomSeat: Player = mySeat === 2 ? 2 : 1;
  const modeInfo = GAME_MODES[game.mode as GameModeId];

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
      <section className="flex flex-col items-center">
        <div className="mb-3 w-full max-w-xl space-y-2">
          <PlayerBar
            seat={game.players[topSeat]}
            player={topSeat}
            clock={game.clock}
            isYou={mySeat === topSeat}
            active={game.turn === topSeat && !game.over}
          />
        </div>

        <Board
          board={game.board}
          onDrop={myTurn ? drop : undefined}
          legalMoves={game.legalMoves}
          previewPlayer={mySeat ?? undefined}
          highlight={game.winningLine ?? undefined}
          lastMove={lastMoveIndex}
          flipped={mySeat === 2}
          disabled={Boolean(game.over)}
          label={`Connect 4 game, ${modeInfo?.name ?? game.mode}`}
        />

        <div className="mt-3 w-full max-w-xl space-y-2">
          <PlayerBar
            seat={game.players[bottomSeat]}
            player={bottomSeat}
            clock={game.clock}
            isYou={mySeat === bottomSeat}
            active={game.turn === bottomSeat && !game.over}
          />
        </div>

        {message && (
          <p className="mt-3 rounded-lg bg-slate-800 px-3 py-1.5 text-sm text-amber-300" role="alert">
            {message}
          </p>
        )}

        {!game.over && (
          <p className="mt-3 text-sm text-slate-400" role="status">
            {spectating
              ? 'You are spectating.'
              : myTurn
                ? 'Your move — click a column, or press 1-7.'
                : 'Waiting for your opponent…'}
          </p>
        )}
      </section>

      <aside className="space-y-4">
        <div className="card">
          <div className="flex items-baseline justify-between">
            <h2 className="font-semibold">{modeInfo?.name ?? game.mode}</h2>
            <span className="font-mono text-sm text-slate-400">{modeInfo?.label}</span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {game.rated ? 'Rated' : 'Unrated'} · {game.moves.length} moves
          </p>
        </div>

        {game.over ? (
          <GameOverPanel
            game={game}
            ratings={ratings}
            mySeat={mySeat}
            rematchSent={rematchSent}
            rematchOffered={rematchOffered}
            onRematch={() => {
              setRematchSent(true);
              getSocket().emit('game:rematch', { gameId: game.id });
            }}
          />
        ) : (
          mySeat !== null && (
            <GameControls
              gameId={game.id}
              drawOfferFrom={game.drawOfferFrom}
              mySeat={mySeat}
              canOfferDraw={game.players[opponentSeat].botId === null}
            />
          )
        )}

        <div className="card">
          <h2 className="mb-2 text-sm font-semibold text-slate-300">Share</h2>
          <p className="mb-2 text-xs text-slate-500">Anyone with this link can watch.</p>
          <input
            readOnly
            value={`${window.location.origin}/watch/${game.id}`}
            onFocus={(event) => event.currentTarget.select()}
            className="input font-mono text-xs"
            aria-label="Spectator link"
          />
        </div>
      </aside>
    </div>
  );
}

function GameControls({
  gameId,
  drawOfferFrom,
  mySeat,
  canOfferDraw,
}: {
  gameId: string;
  drawOfferFrom: Player | null;
  mySeat: Player;
  canOfferDraw: boolean;
}) {
  const [confirmResign, setConfirmResign] = useState(false);
  const socket = getSocket();

  const theyOffered = drawOfferFrom !== null && drawOfferFrom !== mySeat;
  const youOffered = drawOfferFrom === mySeat;

  return (
    <div className="card space-y-2">
      {theyOffered && (
        <div className="rounded-lg border border-sky-700 bg-sky-950/40 p-3">
          <p className="mb-2 text-sm">Your opponent offers a draw.</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => socket.emit('game:offerDraw', { gameId })}
              className="btn-primary flex-1 text-xs"
            >
              Accept
            </button>
            <button
              type="button"
              onClick={() => socket.emit('game:declineDraw', { gameId })}
              className="btn-secondary flex-1 text-xs"
            >
              Decline
            </button>
          </div>
        </div>
      )}

      {canOfferDraw && !theyOffered && (
        <button
          type="button"
          onClick={() => socket.emit('game:offerDraw', { gameId })}
          className="btn-secondary w-full text-sm"
          disabled={youOffered}
        >
          {youOffered ? 'Draw offered' : 'Offer draw'}
        </button>
      )}

      {confirmResign ? (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => socket.emit('game:resign', { gameId })}
            className="btn-danger flex-1 text-sm"
          >
            Confirm resign
          </button>
          <button
            type="button"
            onClick={() => setConfirmResign(false)}
            className="btn-secondary text-sm"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirmResign(true)}
          className="btn-secondary w-full text-sm"
        >
          Resign
        </button>
      )}
    </div>
  );
}

function GameOverPanel({
  game,
  ratings,
  mySeat,
  rematchSent,
  rematchOffered,
  onRematch,
}: {
  game: LiveGamePayload;
  ratings: RatingChange | null;
  mySeat: Player | null;
  rematchSent: boolean;
  rematchOffered: boolean;
  onRematch: () => void;
}) {
  const over = game.over!;

  const headline = (() => {
    if (over.outcome === 'draw') return 'Draw';
    if (over.outcome === 'aborted') return 'Game aborted';
    if (mySeat === null) {
      return `${game.players[over.winner!].username} wins`;
    }
    return over.winner === mySeat ? 'You won' : 'You lost';
  })();

  const myChange =
    ratings && mySeat !== null ? (mySeat === 1 ? ratings.player1 : ratings.player2) : null;

  return (
    <div className="card animate-fadeUp">
      <h2 className="text-xl font-bold">{headline}</h2>
      <p className="mt-1 text-sm text-slate-400">{describeReason(over.reason)}</p>

      {myChange && (
        <div className="mt-4 flex items-baseline gap-2">
          <span className="text-3xl font-bold tabular-nums">{myChange.after}</span>
          <span
            className={`text-lg font-semibold ${
              myChange.delta > 0
                ? 'text-emerald-400'
                : myChange.delta < 0
                  ? 'text-rose-400'
                  : 'text-slate-400'
            }`}
          >
            {formatRatingDelta(myChange.delta)}
          </span>
        </div>
      )}

      {!ratings && game.rated && over.outcome !== 'aborted' && (
        <p className="mt-2 text-xs text-slate-500">Rating update pending…</p>
      )}
      {!game.rated && <p className="mt-2 text-xs text-slate-500">Casual game — no rating change.</p>}

      <div className="mt-4 space-y-2">
        <button
          type="button"
          onClick={onRematch}
          className="btn-primary w-full"
          disabled={rematchSent}
        >
          {rematchSent ? 'Rematch offered…' : rematchOffered ? 'Accept rematch' : 'Rematch'}
        </button>
        <Link to={`/replay/${game.id}`} className="btn-secondary w-full">
          Analyze game
        </Link>
        <Link to="/play" className="btn-ghost w-full">
          Back to lobby
        </Link>
      </div>
    </div>
  );
}
