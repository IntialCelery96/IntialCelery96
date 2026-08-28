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

export interface BotDefinition {
  id: string;
  name: string;
  /** Approximate human rating this bot plays at. Shown in the UI. */
  rating: number;
  /** Two or three sentences of flavour plus an honest hint about its weakness. */
  description: string;
  /** Short tag for the card, e.g. "Aggressive". */
  personality: string;
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
  /** Milliseconds of "thinking" before the move lands, so play feels human. */
  thinkMs: [min: number, max: number];
}

const style = (overrides: Partial<BotStyle>): BotStyle => ({ ...BALANCED_STYLE, ...overrides });

/**
 * The roster. Ordered easiest to hardest — the UI renders them in this order.
 *
 * Skill comes from `depth` and `blunderRate`; strategy comes from `style`.
 * That separation means "a strong defensive bot" and "a weak defensive bot"
 * are the same personality at different strengths, which is what makes the
 * ladder feel like climbing rather than facing six unrelated engines.
 */
export const BOTS: readonly BotDefinition[] = [
  {
    id: 'pip',
    name: 'Pip',
    rating: 600,
    personality: 'Chaotic',
    avatar: '🐣',
    description:
      'Drops discs more or less wherever they fit. Pip is here to help you learn which squares matter, not to put up a fight.',
    brain: 'random',
    depth: 0,
    blunderRate: 0,
    style: BALANCED_STYLE,
    thinkMs: [250, 600],
  },
  {
    id: 'rusty',
    name: 'Rusty',
    rating: 850,
    personality: 'Distracted',
    avatar: '🤖',
    description:
      'Takes a win when it sees one and blocks yours when he notices. He notices maybe four times out of five.',
    brain: 'greedy',
    depth: 0,
    blunderRate: 0.2,
    style: BALANCED_STYLE,
    thinkMs: [400, 900],
  },
  {
    id: 'nora',
    name: 'Nora',
    rating: 1100,
    personality: 'Solid',
    avatar: '🦉',
    description:
      'Looks two moves ahead and likes the middle of the board. Reliable, but she cannot see a double threat coming.',
    brain: 'search',
    depth: 3,
    blunderRate: 0.08,
    style: style({ center: 8 }),
    thinkMs: [500, 1_100],
  },
  {
    id: 'vex',
    name: 'Vex',
    rating: 1450,
    personality: 'Aggressive',
    avatar: '🔥',
    description:
      'Builds threats relentlessly and would rather race you than stop you. Punish him by making him defend — he is bad at it.',
    brain: 'search',
    depth: 5,
    blunderRate: 0.04,
    style: style({ three: 60, liveThreat: 130, defense: 0.7, center: 7 }),
    thinkMs: [600, 1_400],
  },
  {
    id: 'bastion',
    name: 'Bastion',
    rating: 1650,
    personality: 'Defensive',
    avatar: '🛡️',
    description:
      'Smothers your threats before they form and waits for you to overreach. Slow games. Bring patience and a plan.',
    brain: 'search',
    depth: 7,
    blunderRate: 0.02,
    style: style({ defense: 1.25, three: 35, parity: 20 }),
    thinkMs: [700, 1_600],
  },
  {
    id: 'zenith',
    name: 'Zenith',
    rating: 2000,
    personality: 'Positional',
    avatar: '👑',
    description:
      'Plays the parity game — odd and even threats, forced sequences, the works. Zenith does not blunder. Take the centre on move one or do not bother.',
    brain: 'search',
    depth: 9,
    blunderRate: 0,
    style: style({ parity: 45, three: 50, liveThreat: 110, center: 9 }),
    thinkMs: [800, 2_000],
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
