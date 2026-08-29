import type { GameState } from '../types.js';
import { legalMoves } from '../board.js';
import { BALANCED_STYLE, type BotStyle } from './evaluate.js';
import { immediateThreats, immediateWins, search } from './search.js';

export * from './evaluate.js';
export * from './search.js';

/**
 * How a bot decides on a move.
 *
 * - `random`  — picks any legal column. A punching bag.
 * - `greedy`  — takes a win, blocks a loss, otherwise plays toward the centre.
 *               No lookahead, so it walks into double threats constantly.
 * - `search`  — negamax with alpha-beta to a fixed depth, shaped by its style.
 */
export type BotBrain = 'random' | 'greedy' | 'search';

/** How hard a bot is to beat, ordered easiest to hardest. */
export type BotDifficulty =
  | 'Beginner'
  | 'Easy'
  | 'Moderate'
  | 'Challenging'
  | 'Hard'
  | 'Expert';

export const BOT_DIFFICULTIES: readonly BotDifficulty[] = [
  'Beginner',
  'Easy',
  'Moderate',
  'Challenging',
  'Hard',
  'Expert',
];

export interface BotDefinition {
  id: string;
  name: string;
  /** Approximate human rating this bot plays at. Shown in the UI. */
  rating: number;
  /**
   * The bot's difficulty, and the only description of it shown to a player.
   * The playing style still differs between bots — that lives in `style` — but
   * it is left for the player to discover over the board rather than spelled
   * out on the card.
   */
  difficulty: BotDifficulty;
  avatar: string;
  brain: BotBrain;
  /** Search depth in plies. Ignored for the non-searching brains. */
  depth: number;
  /**
   * Chance per move of throwing away the calculated move and playing a random
   * legal one instead. This is what makes a strong engine play like a weak
   * human: it finds the right move and then sometimes doesn't play it.
   */
  blunderRate: number;
  style: BotStyle;
  /**
   * How long to pause before the move lands, in milliseconds.
   *
   * Nothing under about three quarters of a second: a reply that arrives the
   * instant you let go of your disc reads as a script rather than an opponent,
   * and the weakest bots compute their move in well under a millisecond. The
   * pause is on top of any search time, so the strongest bots feel slowest.
   */
  thinkMs: [min: number, max: number];
}

const style = (overrides: Partial<BotStyle>): BotStyle => ({ ...BALANCED_STYLE, ...overrides });

/**
 * The roster. Ordered easiest to hardest — the UI renders them in this order,
 * and `difficulty` runs in step with `BOT_DIFFICULTIES`.
 *
 * Skill comes from `depth` and `blunderRate`; style comes from `style`. That
 * separation means "a strong defensive bot" and "a weak defensive bot" are the
 * same character at different strengths, which is what makes the ladder feel
 * like climbing rather than facing six unrelated engines.
 */
export const BOTS: readonly BotDefinition[] = [
  {
    id: 'pip',
    name: 'Pip',
    rating: 600,
    difficulty: 'Beginner',
    avatar: '🐣',
    brain: 'random',
    depth: 0,
    blunderRate: 0,
    style: BALANCED_STYLE,
    thinkMs: [700, 1_300],
  },
  {
    id: 'rusty',
    name: 'Rusty',
    rating: 850,
    difficulty: 'Easy',
    avatar: '🤖',
    brain: 'greedy',
    depth: 0,
    blunderRate: 0.2,
    style: BALANCED_STYLE,
    thinkMs: [800, 1_500],
  },
  {
    id: 'nora',
    name: 'Nora',
    rating: 1100,
    difficulty: 'Moderate',
    avatar: '🦉',
    brain: 'search',
    depth: 3,
    blunderRate: 0.08,
    style: style({ center: 8 }),
    thinkMs: [900, 1_700],
  },
  {
    id: 'vex',
    name: 'Vex',
    rating: 1450,
    difficulty: 'Challenging',
    avatar: '🔥',
    brain: 'search',
    depth: 5,
    blunderRate: 0.04,
    style: style({ three: 60, liveThreat: 130, defense: 0.7, center: 7 }),
    thinkMs: [1_000, 1_900],
  },
  {
    id: 'bastion',
    name: 'Bastion',
    rating: 1650,
    difficulty: 'Hard',
    avatar: '🛡️',
    brain: 'search',
    depth: 7,
    blunderRate: 0.02,
    style: style({ defense: 1.25, three: 35, parity: 20 }),
    thinkMs: [1_100, 2_100],
  },
  {
    id: 'zenith',
    name: 'Zenith',
    rating: 2000,
    difficulty: 'Expert',
    avatar: '👑',
    brain: 'search',
    depth: 9,
    blunderRate: 0,
    style: style({ parity: 45, three: 50, liveThreat: 110, center: 9 }),
    thinkMs: [1_200, 2_400],
  },
];

/**
 * Ladder results, measured with `scripts/bot-ladder.mjs` over 10 alternating
 * -colour games per pairing. Every bot beats the one below it, which is what
 * makes the roster a ladder rather than six unrelated engines:
 *
 *   Rusty  > Pip     10-0-0      Vex     > Nora     9-1-0
 *   Nora   > Rusty    9-1-0      Bastion > Vex      8-2-0
 *   Zenith > Bastion  6-0-2
 *
 * Re-run the script after changing any depth, style or blunder rate.
 */

export const BOTS_BY_ID: Record<string, BotDefinition> = Object.fromEntries(
  BOTS.map((bot) => [bot.id, bot]),
);

export function getBot(id: string): BotDefinition | null {
  return BOTS_BY_ID[id] ?? null;
}

export function isBotId(value: unknown): value is string {
  return typeof value === 'string' && value in BOTS_BY_ID;
}

function pick<T>(items: readonly T[], random: () => number): T {
  return items[Math.floor(random() * items.length)]!;
}

/**
 * Greedy play: win if you can, block if you must, otherwise head for the
 * centre. This is roughly how a thoughtful beginner plays.
 */
function greedyMove(state: GameState, random: () => number): number {
  const wins = immediateWins(state);
  if (wins.length > 0) return pick(wins, random);

  const threats = immediateThreats(state);
  if (threats.length > 0) return pick(threats, random);

  const legal = legalMoves(state);
  const preference = [3, 2, 4, 1, 5, 0, 6];
  return preference.find((col) => legal.includes(col)) ?? legal[0]!;
}

export interface ChooseMoveOptions {
  /** Injected for deterministic tests. */
  random?: () => number;
  /** Overrides the bot's own search budget. */
  timeBudgetMs?: number;
}

/**
 * Chooses a column for `bot` in `state`. Throws if the game is already over.
 *
 * A blunder never throws away a game the bot has already won — it will still
 * take an immediate win. Randomly declining a win reads as broken rather than
 * weak, and no human plays that way either.
 */
export function chooseMove(
  bot: BotDefinition,
  state: GameState,
  options: ChooseMoveOptions = {},
): number {
  const { random = Math.random, timeBudgetMs } = options;

  const legal = legalMoves(state);
  if (legal.length === 0) {
    throw new Error('No legal moves available');
  }

  if (bot.brain === 'random') return pick(legal, random);

  const wins = immediateWins(state);
  if (wins.length > 0) return pick(wins, random);

  if (bot.blunderRate > 0 && random() < bot.blunderRate) {
    return pick(legal, random);
  }

  if (bot.brain === 'greedy') return greedyMove(state, random);

  return search(state, {
    depth: bot.depth,
    style: bot.style,
    random,
    ...(timeBudgetMs !== undefined ? { timeBudgetMs } : {}),
  }).move;
}

/** A human-feeling delay before the bot's move is broadcast. */
export function thinkDelayMs(bot: BotDefinition, random: () => number = Math.random): number {
  const [min, max] = bot.thinkMs;
  return Math.round(min + random() * (max - min));
}
