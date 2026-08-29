import {
  type GameModeId,
  DEFAULT_RATING,
  getBot,
  getMode,
} from '@connect4gg/engine';
import { prisma } from '../lib/db.js';
import { createGameRow } from '../services/games.js';
import { getOrCreateRating, recordRatedResult, shouldRate } from '../services/ratings.js';
import { computeBotMove } from './engineWorker.js';
import { LiveGame, type EndReason, type GameOutcome, type LiveSeat } from './liveGame.js';

/**
 * Owns every game in progress.
 *
 * Live state is in memory (a Map of LiveGame) because a Connect 4 game is small
 * and moves are frequent; the database is written on creation and on
 * completion. A restart therefore loses in-flight games, which is the standard
 * trade-off for this kind of server — the alternative is a database write per
 * move for state nobody reads until the game ends.
 */

export interface GameEvents {
  /** Push the current state to everyone watching a game. */
  broadcast(game: LiveGame): void;
  /** Announce a finished game, including any rating movement. */
  broadcastOver(game: LiveGame, ratings: RatingChange | null): void;
}

export interface RatingChange {
  player1: { before: number; after: number; delta: number };
  player2: { before: number; after: number; delta: number };
}

export interface SeatSpec {
  userId: string | null;
  botId: string | null;
  username: string;
  avatarUrl: string | null;
  rating: number | null;
}

function toSeat(spec: SeatSpec): LiveSeat {
  return {
    userId: spec.userId,
    botId: spec.botId,
    username: spec.username,
    avatarUrl: spec.avatarUrl,
    rating: spec.rating,
    sockets: new Set(),
    disconnectedAt: null,
  };
}

export class GameManager {
  private readonly games = new Map<string, LiveGame>();
  /** userId -> gameId, so a reconnecting player can be sent back to their game. */
  private readonly activeByUser = new Map<string, string>();

  constructor(private readonly events: GameEvents) {}

  get(gameId: string): LiveGame | null {
    return this.games.get(gameId) ?? null;
  }

  activeGameFor(userId: string): LiveGame | null {
    const id = this.activeByUser.get(userId);
    if (!id) return null;
    const game = this.games.get(id);
    if (!game || game.over) {
      this.activeByUser.delete(userId);
      return null;
    }
    return game;
  }

  /** Creates a game, persists the row, and wires up its timers. */
  async create(options: {
    mode: GameModeId;
    rated: boolean;
    player1: SeatSpec;
    player2: SeatSpec;
  }): Promise<LiveGame> {
    const { mode, player1, player2 } = options;
    // A game against a bot never moves ratings, whatever the client asked for.
    const rated =
      options.rated &&
      getMode(mode).rated &&
      player1.botId === null &&
      player2.botId === null;

    const id = await createGameRow({
      mode,
      rated,
      player1Id: player1.userId,
      player2Id: player2.userId,
      player1BotId: player1.botId,
      player2BotId: player2.botId,
      player1RatingBefore: player1.rating,
      player2RatingBefore: player2.rating,
    });

    const game = new LiveGame({
      id,
      mode,
      rated,
      player1: toSeat(player1),
      player2: toSeat(player2),
    });

    game.onFlag = () => {
      if (game.checkFlag()) void this.finalise(game);
      else this.events.broadcast(game);
    };

    game.onAbort = () => {
      game.abort('ABANDONED');
      void this.finalise(game);
    };

    this.games.set(id, game);
    if (player1.userId) this.activeByUser.set(player1.userId, id);
    if (player2.userId) this.activeByUser.set(player2.userId, id);

    game.start();
    game.startAbortTimer();

    // If a bot has the first move, get it thinking straight away.
    this.maybeScheduleBot(game);

    return game;
  }

  /** Builds a seat for a human, reading their current rating in this mode. */
  async humanSeat(
    userId: string,
    mode: GameModeId,
    fallbackUsername = 'Player',
  ): Promise<SeatSpec> {
    const [user, rating] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { username: true, avatarUrl: true },
      }),
      getMode(mode).rated ? getOrCreateRating(userId, mode) : null,
    ]);

    return {
      userId,
      botId: null,
      username: user?.username ?? fallbackUsername,
      avatarUrl: user?.avatarUrl ?? null,
      rating: rating?.rating ?? null,
    };
  }

  botSeat(botId: string): SeatSpec {
    const bot = getBot(botId);
    if (!bot) throw new Error(`Unknown bot "${botId}"`);
    return {
      userId: null,
      botId: bot.id,
      username: bot.name,
      avatarUrl: null,
      rating: bot.rating,
    };
  }

  // --- Play -----------------------------------------------------------------

  playMove(game: LiveGame, userId: string, column: number): { ok: boolean; reason?: string } {
    const seat = game.seatOf(userId);
    if (seat === null) return { ok: false, reason: 'You are not playing in this game' };

    const result = game.playMove(seat, column);
    if (!result.ok) return result;

    if (game.over) {
      void this.finalise(game);
    } else {
      this.events.broadcast(game);
      this.maybeScheduleBot(game);
    }

    return { ok: true };
  }

  resign(game: LiveGame, userId: string): boolean {
    const seat = game.seatOf(userId);
    if (seat === null || game.over) return false;
    game.resign(seat);
    void this.finalise(game);
    return true;
  }

  offerDraw(game: LiveGame, userId: string): 'offered' | 'accepted' | 'noop' {
    const seat = game.seatOf(userId);
    if (seat === null || game.over) return 'noop';

    // Bots decline: there is no sensible way for a search bot to evaluate a
    // draw offer, and silently accepting would be exploitable.
    const opponentIsBot = game.isBotSeat(seat === 1 ? 2 : 1);
    if (opponentIsBot) return 'noop';

    const result = game.offerDraw(seat);
    if (result === 'accepted') void this.finalise(game);
    else this.events.broadcast(game);
    return result;
  }

  declineDraw(game: LiveGame, userId: string): void {
    const seat = game.seatOf(userId);
    if (seat === null) return;
    game.declineDraw(seat);
    this.events.broadcast(game);
  }

  forfeitDisconnected(game: LiveGame, player: 1 | 2): void {
    if (game.over) return;
    // Nobody has moved yet: treat it as an abandoned game rather than a loss.
    if (game.moveCount === 0) game.abort('ABANDONED');
    else {
      game.finish({
        outcome: player === 1 ? 'player2' : 'player1',
        reason: 'ABANDONED',
        winner: player === 1 ? 2 : 1,
      });
    }
    void this.finalise(game);
  }

  /** Queues the bot's reply if it is a bot's turn. */
  private maybeScheduleBot(game: LiveGame): void {
    if (game.over) return;
    if (!game.isBotSeat(game.state.turn)) return;

    game.scheduleBotMove(() => {
      void this.runBotMove(game);
    });
  }

  private async runBotMove(game: LiveGame): Promise<void> {
    if (game.over) return;

    const player = game.state.turn;
    const botId = game.seats[player].botId;
    if (!botId) return;

    const bot = getBot(botId);
    if (!bot) return;

    try {
      const column = await computeBotMove(bot, game.moves);
      // The position can move on while the search runs (a resignation, a
      // timeout); re-check before applying.
      if (game.over || game.state.turn !== player) return;

      const result = game.playMove(player, column);
      if (!result.ok) return;

      if (game.over) void this.finalise(game);
      else {
        this.events.broadcast(game);
        this.maybeScheduleBot(game);
      }
    } catch (error) {
      // A bot that cannot move would hang the game forever; end it cleanly.
      game.abort('ABORTED');
      void this.finalise(game);
      throw error;
    }
  }

  // --- Completion -----------------------------------------------------------

  /**
   * Persists a finished game and applies rating changes.
   *
   * Rating movement is computed here rather than at move time so an aborted or
   * unrated game costs nothing, and so both players' rows move together.
   */
  private async finalise(game: LiveGame): Promise<void> {
    const over = game.over;
    if (!over) return;

    // Drop it from the live registry first so a duplicate finalise is a no-op.
    if (!this.games.delete(game.id)) return;
    game.clearTimers();

    for (const player of [1, 2] as const) {
      const userId = game.seats[player].userId;
      if (userId && this.activeByUser.get(userId) === game.id) {
        this.activeByUser.delete(userId);
      }
    }

    const clock = game.clockSnapshot();
    let ratings: RatingChange | null = null;

    const rateable = shouldRate({
      rated: game.rated,
      moveCount: game.moveCount,
      player1Id: game.seats[1].userId,
      player2Id: game.seats[2].userId,
    });

    if (rateable && over.outcome !== 'aborted') {
      ratings = await recordRatedResult({
        gameId: game.id,
        mode: game.mode,
        player1Id: game.seats[1].userId!,
        player2Id: game.seats[2].userId!,
        outcome: over.outcome,
      }).catch(() => null);
    }

    await prisma.game
      .update({
        where: { id: game.id },
        data: {
          moves: game.moves,
          result: toPrismaResult(over.outcome),
          endReason: over.reason as EndReason,
          winnerId:
            over.winner !== null ? (game.seats[over.winner].userId ?? null) : null,
          player1TimeMs: clock.player1Ms,
          player2TimeMs: clock.player2Ms,
          player1RatingBefore: ratings?.player1.before ?? game.seats[1].rating,
          player2RatingBefore: ratings?.player2.before ?? game.seats[2].rating,
          player1RatingDelta: ratings?.player1.delta ?? null,
          player2RatingDelta: ratings?.player2.delta ?? null,
          endedAt: new Date(),
        },
      })
      .catch(() => undefined);

    this.events.broadcastOver(game, ratings);
  }

  /** Ends every live game. Used on shutdown so nothing is left dangling. */
  async shutdown(): Promise<void> {
    for (const game of [...this.games.values()]) {
      game.abort('ABORTED');
      await this.finalise(game);
    }
  }

  get liveCount(): number {
    return this.games.size;
  }
}

function toPrismaResult(outcome: GameOutcome): 'PLAYER1_WIN' | 'PLAYER2_WIN' | 'DRAW' | 'ABORTED' {
  switch (outcome) {
    case 'player1':
      return 'PLAYER1_WIN';
    case 'player2':
      return 'PLAYER2_WIN';
    case 'draw':
      return 'DRAW';
    default:
      return 'ABORTED';
  }
}

export { DEFAULT_RATING };
