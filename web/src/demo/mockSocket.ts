import {
  type GameState,
  applyMove,
  chooseMove,
  createGame,
  getBot,
  getMode,
  legalMoves,
  serializeMoves,
  thinkDelayMs,
  type GameModeId,
} from '@connect4gg/engine';
import * as fixtures from './fixtures';
import type { GameSocket, LiveGamePayload, Player, SeatPayload } from '../lib/socket';

/**
 * A socket that never leaves the page.
 *
 * The demo build has no server, so this stands in for the gateway: it runs the
 * same rules the server runs, drives bot replies with the engine, and emits the
 * same events with the same payload shapes. The game screen is the shipped
 * component and cannot tell the difference.
 *
 * Clocks tick down locally here rather than being reconciled against a server,
 * which is the one honest difference — a real game's clock is authoritative and
 * this one is not.
 */

interface Listener {
  event: string;
  fn: (payload: never) => void;
}

interface DemoGame {
  id: string;
  mode: GameModeId;
  rated: boolean;
  state: GameState;
  seats: Record<Player, SeatPayload>;
  /** The seat the human occupies. */
  humanSeat: Player;
  botId: string;
  clockMs: { 1: number; 2: number };
  lastTickAt: number;
  over: LiveGamePayload['over'];
  drawOfferFrom: Player | null;
  timer: number | null;
}

let counter = 0;

export function createMockSocket(): GameSocket {
  const listeners: Listener[] = [];
  let game: DemoGame | null = null;
  let queueTimer: number | null = null;
  let queueSeconds = 0;

  function emit(event: string, payload: unknown): void {
    for (const listener of listeners) {
      if (listener.event === event) {
        // Async, so an emit during a handler behaves like a real socket.
        setTimeout(() => listener.fn(payload as never), 0);
      }
    }
  }

  function seat(name: string, rating: number | null, botId: string | null): SeatPayload {
    return {
      userId: botId ? null : `u_${name}`,
      botId,
      username: name,
      avatarUrl: null,
      rating,
      connected: true,
      disconnectedAt: null,
    };
  }

  function settleClock(): void {
    if (!game || game.over) return;
    const mode = getMode(game.mode);
    if (mode.initialMs <= 0) return;
    const now = Date.now();
    const elapsed = now - game.lastTickAt;
    game.clockMs[game.state.turn] = Math.max(0, game.clockMs[game.state.turn] - elapsed);
    game.lastTickAt = now;
  }

  function payload(): LiveGamePayload {
    const g = game!;
    const mode = getMode(g.mode);
    const untimed = mode.initialMs <= 0;
    settleClock();

    return {
      id: g.id,
      mode: g.mode,
      rated: g.rated,
      moves: serializeMoves(g.state.moves),
      board: [...g.state.board],
      turn: g.state.turn,
      status: g.state.status,
      winningLine: g.state.winningLine ? [...g.state.winningLine] : null,
      legalMoves: legalMoves(g.state),
      clock: {
        player1Ms: g.clockMs[1],
        player2Ms: g.clockMs[2],
        running: g.over || untimed ? null : g.state.turn,
        untimed,
        at: Date.now(),
      },
      players: { 1: g.seats[1], 2: g.seats[2] },
      drawOfferFrom: g.drawOfferFrom,
      over: g.over,
      startedAt: Date.now(),
    };
  }

  function broadcast(): void {
    if (game) emit('game:state', payload());
  }

  function finish(over: NonNullable<LiveGamePayload['over']>): void {
    if (!game || game.over) return;
    settleClock();
    game.over = over;
    if (game.timer !== null) clearTimeout(game.timer);

    recordForReview(game, over);

    const won = over.winner === game.humanSeat;
    const swing = 12 + Math.floor(Math.random() * 10);
    const before = 1284;
    const delta = over.outcome === 'draw' ? 0 : won ? swing : -swing;

    // Only rated games move a rating, exactly as on the server.
    const ratings = game.rated
      ? {
          player1: {
            before,
            after: before + (game.humanSeat === 1 ? delta : -delta),
            delta: game.humanSeat === 1 ? delta : -delta,
          },
          player2: {
            before,
            after: before + (game.humanSeat === 2 ? delta : -delta),
            delta: game.humanSeat === 2 ? delta : -delta,
          },
        }
      : null;

    emit('game:over', { game: payload(), ratings });
  }

  function checkEnd(): boolean {
    const g = game!;
    if (g.state.status === 'win') {
      finish({
        outcome: g.state.winner === 1 ? 'player1' : 'player2',
        reason: 'CONNECT_FOUR',
        winner: g.state.winner,
      });
      return true;
    }
    if (g.state.status === 'draw') {
      finish({ outcome: 'draw', reason: 'BOARD_FULL', winner: null });
      return true;
    }
    return false;
  }

  function scheduleBot(): void {
    const g = game;
    if (!g || g.over || g.state.turn === g.humanSeat) return;

    const bot = getBot(g.botId);
    if (!bot) return;

    // The engine's own pause, so the bot never answers instantly.
    g.timer = window.setTimeout(() => {
      if (!game || game.over || game.state.turn === game.humanSeat) return;
      settleClock();
      try {
        const column = chooseMove(bot, game.state, { timeBudgetMs: 900 });
        game.state = applyMove(game.state, column);
      } catch {
        return;
      }
      game.drawOfferFrom = null;
      game.lastTickAt = Date.now();
      if (!checkEnd()) {
        broadcast();
        scheduleBot();
      }
    }, thinkDelayMs(bot));
  }

  /**
   * Files the finished game where the mock API can find it, so "Analyze game"
   * on the post-game screen leads somewhere. Without this the game a player
   * just finished is the one game on the site they cannot review.
   */
  function recordForReview(g: DemoGame, over: NonNullable<LiveGamePayload['over']>): void {
    const now = new Date();
    const started = new Date(now.getTime() - Math.max(30_000, g.state.moves.length * 8_000));

    const seatSummary = (seat: SeatPayload) => ({
      user: seat.botId
        ? null
        : {
            id: seat.userId ?? `u_${seat.username}`,
            username: seat.username,
            avatarUrl: seat.avatarUrl,
            avatarColor: fixtures.users.find((u) => u.username === seat.username)?.avatarColor
              ?? '#334155',
            bio: null,
            country: null,
            createdAt: started.toISOString(),
            isBot: false,
          },
      botId: seat.botId,
      botName: seat.botId ? (getBot(seat.botId)?.name ?? seat.botId) : null,
      rating: seat.rating,
      ratingDelta: null,
    });

    const winnerSeat = over.winner ? g.seats[over.winner] : null;

    fixtures.recordPlayedGame({
      id: g.id,
      mode: g.mode,
      rated: g.rated,
      moves: serializeMoves(g.state.moves),
      moveCount: g.state.moves.length,
      result:
        over.outcome === 'player1'
          ? 'PLAYER1_WIN'
          : over.outcome === 'player2'
            ? 'PLAYER2_WIN'
            : over.outcome === 'draw'
              ? 'DRAW'
              : 'ABORTED',
      endReason: over.reason,
      winnerId: winnerSeat && !winnerSeat.botId ? (winnerSeat.userId ?? null) : null,
      player1: seatSummary(g.seats[1]),
      player2: seatSummary(g.seats[2]),
      initialMs: getMode(g.mode).initialMs,
      incrementMs: getMode(g.mode).incrementMs,
      startedAt: started.toISOString(),
      endedAt: now.toISOString(),
    });
  }

  function start(options: {
    mode: GameModeId;
    botId: string;
    humanSeat: Player;
    rated: boolean;
    opponentName?: string;
    opponentRating?: number | null;
  }): DemoGame {
    const bot = getBot(options.botId)!;
    const mode = getMode(options.mode);
    const human = seat(fixtures.viewer.username ?? 'you', 1284, null);
    const opponent = options.opponentName
      ? seat(options.opponentName, options.opponentRating ?? bot.rating, null)
      : seat(bot.name, bot.rating, bot.id);

    const created: DemoGame = {
      id: `demo_${++counter}`,
      mode: options.mode,
      rated: options.rated,
      state: createGame(),
      seats:
        options.humanSeat === 1 ? { 1: human, 2: opponent } : { 1: opponent, 2: human },
      humanSeat: options.humanSeat,
      botId: options.botId,
      clockMs: { 1: mode.initialMs, 2: mode.initialMs },
      lastTickAt: Date.now(),
      over: null,
      drawOfferFrom: null,
      timer: null,
    };

    game = created;
    return created;
  }

  const socket = {
    connected: true,

    on(event: string, fn: (payload: never) => void) {
      listeners.push({ event, fn });
      return socket;
    },

    off(event: string, fn?: (payload: never) => void) {
      for (let i = listeners.length - 1; i >= 0; i--) {
        if (listeners[i]!.event === event && (!fn || listeners[i]!.fn === fn)) {
          listeners.splice(i, 1);
        }
      }
      return socket;
    },

    emit(event: string, data?: unknown) {
      const payloadIn = (data ?? {}) as Record<string, never>;

      switch (event) {
        case 'queue:join': {
          // No other players here, so a bot stands in — after a wait long
          // enough to show the queue widening its search, as it really does.
          queueSeconds = 0;
          const mode = (payloadIn as unknown as { mode: GameModeId }).mode;
          emit('queue:status', { mode, waitedSeconds: 0, maxDelta: 50, playersWaiting: 3 });

          queueTimer = window.setInterval(() => {
            queueSeconds += 1;
            const maxDelta = queueSeconds >= 10 ? 100 : 50;
            emit('queue:status', {
              mode,
              waitedSeconds: queueSeconds,
              maxDelta,
              playersWaiting: 3,
            });

            if (queueSeconds >= 4) {
              if (queueTimer !== null) clearInterval(queueTimer);
              const opponent = fixtures.users[3]!;
              const created = start({
                mode,
                botId: 'vex',
                humanSeat: Math.random() < 0.5 ? 1 : 2,
                rated: getMode(mode).rated,
                opponentName: opponent.username ?? 'opponent',
                opponentRating: 1622,
              });
              emit('game:matched', {
                gameId: created.id,
                mode,
                opponent: opponent.username ?? 'opponent',
              });
            }
          }, 1000);
          break;
        }

        case 'queue:leave': {
          if (queueTimer !== null) clearInterval(queueTimer);
          emit('queue:left', {});
          break;
        }

        case 'bot:play': {
          const { botId, mode, side } = payloadIn as unknown as {
            botId: string;
            mode: GameModeId;
            side: 'first' | 'second' | 'random';
          };
          const humanSeat: Player =
            side === 'first' ? 1 : side === 'second' ? 2 : Math.random() < 0.5 ? 1 : 2;
          const created = start({ mode, botId, humanSeat, rated: false });
          emit('game:matched', {
            gameId: created.id,
            mode,
            opponent: getBot(botId)?.name ?? botId,
          });
          break;
        }

        case 'game:join': {
          if (!game) {
            emit('game:notFound', { gameId: (payloadIn as unknown as { gameId: string }).gameId });
            break;
          }
          broadcast();
          scheduleBot();
          break;
        }

        case 'game:move': {
          const { column } = payloadIn as unknown as { column: number };
          if (!game || game.over || game.state.turn !== game.humanSeat) {
            emit('game:rejected', { message: 'Not your turn' });
            break;
          }
          if (!legalMoves(game.state).includes(column)) {
            emit('game:rejected', { message: 'That column is not playable' });
            break;
          }
          settleClock();
          game.state = applyMove(game.state, column);
          game.drawOfferFrom = null;
          game.lastTickAt = Date.now();
          if (!checkEnd()) {
            broadcast();
            scheduleBot();
          }
          break;
        }

        case 'game:resign': {
          if (!game || game.over) break;
          finish({
            outcome: game.humanSeat === 1 ? 'player2' : 'player1',
            reason: 'RESIGNATION',
            winner: game.humanSeat === 1 ? 2 : 1,
          });
          break;
        }

        case 'game:offerDraw': {
          if (!game || game.over) break;
          // The stand-in opponent declines, the way a bot does on the server.
          game.drawOfferFrom = game.humanSeat;
          broadcast();
          window.setTimeout(() => {
            if (game && !game.over) {
              game.drawOfferFrom = null;
              broadcast();
            }
          }, 1600);
          break;
        }

        case 'game:declineDraw': {
          if (game) {
            game.drawOfferFrom = null;
            broadcast();
          }
          break;
        }

        case 'game:rematch': {
          if (!game) break;
          const created = start({
            mode: game.mode,
            botId: game.botId,
            // Colours swap on a rematch, as they do on the server.
            humanSeat: game.humanSeat === 1 ? 2 : 1,
            rated: game.rated,
            ...(game.seats[game.humanSeat === 1 ? 2 : 1].botId
              ? {}
              : { opponentName: game.seats[game.humanSeat === 1 ? 2 : 1].username }),
          });
          emit('game:matched', {
            gameId: created.id,
            mode: created.mode,
            opponent: created.seats[created.humanSeat === 1 ? 2 : 1].username,
          });
          break;
        }

        case 'challenge:send': {
          emit('challenge:error', {
            message: 'Challenges need the server — try a bot or the queue.',
          });
          break;
        }

        default:
          break;
      }

      return socket;
    },

    close() {
      if (queueTimer !== null) clearInterval(queueTimer);
      if (game?.timer != null) clearTimeout(game.timer);
      listeners.length = 0;
      return socket;
    },
  };

  return socket as unknown as GameSocket;
}
