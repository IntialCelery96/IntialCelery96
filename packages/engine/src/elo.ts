/**
 * ELO rating maths.
 *
 * Ratings are kept per game mode (Blitz/Rapid/Classical), mirroring how chess
 * sites keep a separate rating per time control. Players below
 * `PROVISIONAL_GAMES` games use a larger K-factor so a new account converges on
 * its true strength quickly; after that the rating settles down.
 */

export const DEFAULT_RATING = 1200;
export const PROVISIONAL_GAMES = 30;
export const K_PROVISIONAL = 40;
export const K_ESTABLISHED = 20;
export const MIN_RATING = 100;

/** 0 = loss, 0.5 = draw, 1 = win, from the perspective of the player. */
export type Score = 0 | 0.5 | 1;

export interface RatedPlayer {
  rating: number;
  /** Number of rated games already completed in this mode. */
  games: number;
}

export interface EloResult {
  ratingA: number;
  ratingB: number;
  deltaA: number;
  deltaB: number;
}

/** Probability that A beats B, on the standard 400-point logistic curve. */
export function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + 10 ** ((ratingB - ratingA) / 400));
}

export function kFactor(games: number): number {
  return games < PROVISIONAL_GAMES ? K_PROVISIONAL : K_ESTABLISHED;
}

export function isProvisional(games: number): boolean {
  return games < PROVISIONAL_GAMES;
}

/**
 * New rating for a single player after one game.
 * Rounded to a whole number, then floored at MIN_RATING so a long losing streak
 * can't drive a rating to absurd values.
 */
export function updateRating(player: RatedPlayer, opponentRating: number, score: Score): number {
  const expected = expectedScore(player.rating, opponentRating);
  const raw = player.rating + kFactor(player.games) * (score - expected);
  return Math.max(MIN_RATING, Math.round(raw));
}

/**
 * Both sides of a finished game. `scoreA` is A's result; B's is its complement,
 * so a draw gives each 0.5 and the pair always sums to 1.
 *
 * Note the two players can move by different amounts: they may have different
 * K-factors if one is still provisional. That is intentional and matches how
 * chess sites handle new accounts.
 */
export function applyGameResult(a: RatedPlayer, b: RatedPlayer, scoreA: Score): EloResult {
  const scoreB = (1 - scoreA) as Score;
  const ratingA = updateRating(a, b.rating, scoreA);
  const ratingB = updateRating(b, a.rating, scoreB);
  return {
    ratingA,
    ratingB,
    deltaA: ratingA - a.rating,
    deltaB: ratingB - b.rating,
  };
}

/** Maps a finished game's winner onto player A's score. */
export function scoreFor(winner: 'a' | 'b' | 'draw'): Score {
  if (winner === 'a') return 1;
  if (winner === 'b') return 0;
  return 0.5;
}

/** Coarse tier label used for badges and leaderboard styling. */
export type RatingTier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond' | 'master';

export function ratingTier(rating: number): RatingTier {
  if (rating < 900) return 'bronze';
  if (rating < 1200) return 'silver';
  if (rating < 1500) return 'gold';
  if (rating < 1800) return 'platinum';
  if (rating < 2100) return 'diamond';
  return 'master';
}
