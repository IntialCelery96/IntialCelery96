/**
 * Game modes (time controls).
 *
 * Each mode is its own rated pool, the way Bullet/Blitz/Rapid/Classical are on
 * a chess site. Adding a mode means adding one entry here — matchmaking,
 * ratings, leaderboards and the UI all read from this table, so nothing else
 * needs to change.
 */

export type GameModeId = 'blitz' | 'rapid' | 'classical' | 'casual';

export interface GameMode {
  id: GameModeId;
  name: string;
  /** One-line description shown on the play screen. */
  blurb: string;
  /** Starting clock per player, in milliseconds. 0 means untimed. */
  initialMs: number;
  /** Added to a player's clock after each of their moves, in milliseconds. */
  incrementMs: number;
  /** Whether results in this mode move ratings. */
  rated: boolean;
  /** Short label like "1+2" (minutes + increment seconds). */
  label: string;
}

export const GAME_MODES: Record<GameModeId, GameMode> = {
  blitz: {
    id: 'blitz',
    name: 'Blitz',
    blurb: 'One minute each, two seconds a move. Think fast.',
    initialMs: 60_000,
    incrementMs: 2_000,
    rated: true,
    label: '1+2',
  },
  rapid: {
    id: 'rapid',
    name: 'Rapid',
    blurb: 'Five minutes each with a five second increment.',
    initialMs: 300_000,
    incrementMs: 5_000,
    rated: true,
    label: '5+5',
  },
  classical: {
    id: 'classical',
    name: 'Classical',
    blurb: 'Fifteen minutes each. Room to calculate properly.',
    initialMs: 900_000,
    incrementMs: 0,
    rated: true,
    label: '15+0',
  },
  casual: {
    id: 'casual',
    name: 'Casual',
    blurb: 'No clock, no rating. Just a game.',
    initialMs: 0,
    incrementMs: 0,
    rated: false,
    label: '∞',
  },
};

export const MODE_IDS = Object.keys(GAME_MODES) as GameModeId[];

/** Modes that carry a rating, and therefore a leaderboard and rating history. */
export const RATED_MODE_IDS = MODE_IDS.filter((id) => GAME_MODES[id].rated);

export function isGameModeId(value: unknown): value is GameModeId {
  return typeof value === 'string' && value in GAME_MODES;
}

export function getMode(id: GameModeId): GameMode {
  return GAME_MODES[id];
}

export function isTimed(id: GameModeId): boolean {
  return GAME_MODES[id].initialMs > 0;
}

/**
 * Matchmaking rating bands: how far apart two players may be, as a function of
 * how long the earlier one has been waiting. The search widens over time and
 * eventually accepts anyone, so a queue never deadlocks on a thin population.
 */
export interface RatingBand {
  /** Seconds waited before this band applies. */
  afterSeconds: number;
  /** Maximum rating difference, or null for "anyone". */
  maxDelta: number | null;
}

export const MATCHMAKING_BANDS: readonly RatingBand[] = [
  { afterSeconds: 0, maxDelta: 50 },
  { afterSeconds: 10, maxDelta: 100 },
  { afterSeconds: 30, maxDelta: 200 },
  { afterSeconds: 60, maxDelta: null },
];

/** The widest band unlocked after waiting `waitedSeconds`. */
export function bandFor(waitedSeconds: number): RatingBand {
  let current = MATCHMAKING_BANDS[0]!;
  for (const band of MATCHMAKING_BANDS) {
    if (waitedSeconds >= band.afterSeconds) current = band;
  }
  return current;
}

/**
 * Whether two waiting players may be paired. Uses the more generous of the two
 * bands so the player who has waited longer pulls the other one in, rather than
 * both being held back by whoever just joined.
 */
export function canPair(
  ratingA: number,
  waitedA: number,
  ratingB: number,
  waitedB: number,
): boolean {
  const a = bandFor(waitedA).maxDelta;
  const b = bandFor(waitedB).maxDelta;
  if (a === null || b === null) return true;
  return Math.abs(ratingA - ratingB) <= Math.max(a, b);
}
