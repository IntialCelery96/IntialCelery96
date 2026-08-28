import {
  DEFAULT_RATING,
  type GameModeId,
  type Score,
  applyGameResult,
  isProvisional,
} from '@connect4gg/engine';
import { prisma } from '../lib/db.js';

/**
 * Rating storage. Every rated result flows through `recordRatedResult`, which
 * updates both players' Rating rows and appends to their RatingHistory inside a
 * single transaction — a partially applied rating change would be very hard to
 * spot after the fact and impossible to reconcile.
 */

export interface RatingSnapshot {
  mode: GameModeId;
  rating: number;
  games: number;
  wins: number;
  losses: number;
  draws: number;
  peak: number;
  provisional: boolean;
}

function toSnapshot(row: {
  mode: string;
  rating: number;
  games: number;
  wins: number;
  losses: number;
  draws: number;
  peak: number;
}): RatingSnapshot {
  return {
    mode: row.mode as GameModeId,
    rating: row.rating,
    games: row.games,
    wins: row.wins,
    losses: row.losses,
    draws: row.draws,
    peak: row.peak,
    provisional: isProvisional(row.games),
  };
}

/** Reads a rating, creating the default row on first use in a mode. */
export async function getOrCreateRating(userId: string, mode: GameModeId): Promise<RatingSnapshot> {
  const row = await prisma.rating.upsert({
    where: { userId_mode: { userId, mode } },
    create: { userId, mode, rating: DEFAULT_RATING, peak: DEFAULT_RATING },
    update: {},
  });
  return toSnapshot(row);
}

export async function getRatings(userId: string): Promise<RatingSnapshot[]> {
  const rows = await prisma.rating.findMany({ where: { userId } });
  return rows.map(toSnapshot);
}

export type Outcome = 'player1' | 'player2' | 'draw';

export interface RatedResultInput {
  gameId: string;
  mode: GameModeId;
  player1Id: string;
  player2Id: string;
  outcome: Outcome;
}

export interface RatedResultOutput {
  player1: { before: number; after: number; delta: number };
  player2: { before: number; after: number; delta: number };
}

function scoreForOutcome(outcome: Outcome): Score {
  if (outcome === 'player1') return 1;
  if (outcome === 'player2') return 0;
  return 0.5;
}

/**
 * Applies a finished rated game to both players' ratings and history.
 *
 * Returns the before/after/delta pairs the post-game screen animates. Callers
 * are responsible for having already decided the game is rated and complete —
 * see `shouldRate`.
 */
export async function recordRatedResult(input: RatedResultInput): Promise<RatedResultOutput> {
  const { gameId, mode, player1Id, player2Id, outcome } = input;

  const [before1, before2] = await Promise.all([
    getOrCreateRating(player1Id, mode),
    getOrCreateRating(player2Id, mode),
  ]);

  const result = applyGameResult(
    { rating: before1.rating, games: before1.games },
    { rating: before2.rating, games: before2.games },
    scoreForOutcome(outcome),
  );

  const tally = (who: 'player1' | 'player2') => ({
    wins: outcome === who ? 1 : 0,
    losses: outcome !== 'draw' && outcome !== who ? 1 : 0,
    draws: outcome === 'draw' ? 1 : 0,
  });

  const t1 = tally('player1');
  const t2 = tally('player2');

  await prisma.$transaction([
    prisma.rating.update({
      where: { userId_mode: { userId: player1Id, mode } },
      data: {
        rating: result.ratingA,
        games: { increment: 1 },
        wins: { increment: t1.wins },
        losses: { increment: t1.losses },
        draws: { increment: t1.draws },
        peak: Math.max(before1.peak, result.ratingA),
      },
    }),
    prisma.rating.update({
      where: { userId_mode: { userId: player2Id, mode } },
      data: {
        rating: result.ratingB,
        games: { increment: 1 },
        wins: { increment: t2.wins },
        losses: { increment: t2.losses },
        draws: { increment: t2.draws },
        peak: Math.max(before2.peak, result.ratingB),
      },
    }),
    prisma.ratingHistory.create({
      data: {
        userId: player1Id,
        mode,
        rating: result.ratingA,
        delta: result.deltaA,
        gameId,
      },
    }),
    prisma.ratingHistory.create({
      data: {
        userId: player2Id,
        mode,
        rating: result.ratingB,
        delta: result.deltaB,
        gameId,
      },
    }),
  ]);

  return {
    player1: { before: before1.rating, after: result.ratingA, delta: result.deltaA },
    player2: { before: before2.rating, after: result.ratingB, delta: result.deltaB },
  };
}

/**
 * Whether a finished game should move ratings.
 *
 * A game is only rated when both sides are real accounts, the mode is a rated
 * pool, the players opted into a rated game, and at least one move was played.
 * That last condition is what stops an abort at move zero from counting — a
 * player who never got to move should not lose rating for it.
 */
export function shouldRate(game: {
  rated: boolean;
  moveCount: number;
  player1Id: string | null;
  player2Id: string | null;
}): boolean {
  return (
    game.rated && game.moveCount > 0 && game.player1Id !== null && game.player2Id !== null
  );
}

export interface HistoryPoint {
  rating: number;
  delta: number;
  at: string;
}

/** Rating history for the profile graph, oldest first. */
export async function getRatingHistory(
  userId: string,
  mode: GameModeId,
  limit = 200,
): Promise<HistoryPoint[]> {
  const rows = await prisma.ratingHistory.findMany({
    where: { userId, mode },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  return rows
    .reverse()
    .map((row) => ({ rating: row.rating, delta: row.delta, at: row.createdAt.toISOString() }));
}
