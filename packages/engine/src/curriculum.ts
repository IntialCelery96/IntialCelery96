/**
 * Curriculum types — the shape lessons and puzzles take, shared by the server
 * (which stores them), the seed script (which writes them), the demo fixtures
 * and the web app (which renders them).
 *
 * The content itself lives in `./content/` and is validated by
 * `tests/content.test.ts`: every diagram is replayed through the engine, every
 * "try it" answer is checked against the position, and every puzzle answer is
 * proved by exhaustive search rather than trusted. Adding a lesson is a data
 * job, and the tests are what make that safe.
 */

import type { Cell, Player } from './types.js';

/**
 * Skill tiers, in the order they are taught. Modelled on the four levels a
 * chess site uses ("New to chess", Beginner, Intermediate, Advanced): the
 * first tier assumes nothing, not even the rules.
 */
export type Difficulty = 'new' | 'beginner' | 'intermediate' | 'advanced';

export const DIFFICULTIES: readonly Difficulty[] = ['new', 'beginner', 'intermediate', 'advanced'];

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  new: 'New to the game',
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
};

/**
 * The rating range each tier is written for, and the bot a player should be
 * able to beat by the end of it. Ratings are on the site's own scale
 * (`DEFAULT_RATING` is 1200); the bots are the ladder in `bots/index.ts`.
 */
export const DIFFICULTY_TARGETS: Record<
  Difficulty,
  { minRating: number; maxRating: number | null; beats: string }
> = {
  new: { minRating: 0, maxRating: 800, beats: 'rusty' },
  beginner: { minRating: 800, maxRating: 1200, beats: 'nora' },
  intermediate: { minRating: 1200, maxRating: 1700, beats: 'bastion' },
  advanced: { minRating: 1700, maxRating: null, beats: 'zenith' },
};

export function isDifficulty(value: unknown): value is Difficulty {
  return typeof value === 'string' && (DIFFICULTIES as readonly string[]).includes(value);
}

/** Sort key: tiers in teaching order, not alphabetical order. */
export function difficultyRank(value: string): number {
  const index = (DIFFICULTIES as readonly string[]).indexOf(value);
  return index === -1 ? DIFFICULTIES.length : index;
}

/**
 * A course groups the lessons of one tier around one theme, the way a chess
 * site groups "Tactics" or "Openings". Lessons carry the course id.
 */
export interface Course {
  id: string;
  title: string;
  summary: string;
  difficulty: Difficulty;
  /** Position within its tier. Lower sorts first. */
  order: number;
}

/** A paragraph of explanation. */
export interface ProseBlock {
  kind: 'prose';
  text: string;
}

/** A callout box — a rule of thumb worth remembering. */
export interface KeyIdeaBlock {
  kind: 'keyIdea';
  text: string;
}

/**
 * A board diagram. `moves` is a column list replayed from an empty board, which
 * keeps lesson content compact and guarantees the position is legal.
 * `highlight` marks board indices to ring, e.g. the squares under discussion.
 */
export interface BoardBlock {
  kind: 'board';
  caption?: string;
  moves: number[];
  highlight?: number[];
}

/**
 * "Your turn" — the reader must find a move. `answers` lists every acceptable
 * column, so a lesson can accept more than one good continuation.
 */
export interface TryItBlock {
  kind: 'tryIt';
  prompt: string;
  moves: number[];
  answers: number[];
  explanation: string;
}

/** A published source a lesson draws on. */
export interface SourceRef {
  title: string;
  /** Who wrote it and when, e.g. "Allis, 1988". */
  citation: string;
  url?: string;
  /** What the lesson took from it, in a sentence. */
  note?: string;
}

/** "Sources" — the references a lesson's claims rest on, shown at its end. */
export interface ReferenceBlock {
  kind: 'reference';
  sources: SourceRef[];
}

export type LessonBlock = ProseBlock | KeyIdeaBlock | BoardBlock | TryItBlock | ReferenceBlock;

export interface Lesson {
  slug: string;
  title: string;
  summary: string;
  difficulty: Difficulty;
  /** The `Course.id` this lesson belongs to. */
  course: string;
  /** Position within its course. Lower sorts first. */
  order: number;
  blocks: LessonBlock[];
}

/**
 * What a puzzle drills. Puzzles are tagged so a player can train one pattern
 * at a time, and so game analysis can later route "you missed a vertical win"
 * to the drill for it — the way chess sites tag puzzles by motif.
 */
export type PuzzleTheme =
  | 'winInOne'
  | 'block'
  | 'doubleThreat'
  | 'sevenTrap'
  | 'forcingSequence'
  | 'safeSquare'
  | 'parity'
  | 'zugzwang'
  | 'opening';

export const PUZZLE_THEMES: readonly PuzzleTheme[] = [
  'winInOne',
  'block',
  'doubleThreat',
  'sevenTrap',
  'forcingSequence',
  'safeSquare',
  'parity',
  'zugzwang',
  'opening',
];

export const PUZZLE_THEME_LABELS: Record<PuzzleTheme, string> = {
  winInOne: 'Win in one',
  block: 'Block the four',
  doubleThreat: 'Double threat',
  sevenTrap: 'The 7 trap',
  forcingSequence: 'Forcing sequence',
  safeSquare: 'Safe square',
  parity: 'Odd and even',
  zugzwang: 'Zugzwang',
  opening: 'Opening',
};

export function isPuzzleTheme(value: unknown): value is PuzzleTheme {
  return typeof value === 'string' && (PUZZLE_THEMES as readonly string[]).includes(value);
}

export interface Puzzle {
  slug: string;
  title: string;
  difficulty: Difficulty;
  /**
   * The lesson this puzzle drills. Puzzles sit at the end of their lesson and
   * unlock in `order`; solving all of a lesson's puzzles unlocks the next
   * lesson. See `content/progress.ts`.
   */
  lesson: string;
  theme: PuzzleTheme;
  /**
   * How hard the puzzle is, on the same scale as player ratings. Set by hand
   * for now; the roadmap is to let it float with solve rates the way chess
   * sites rate puzzles as if they were opponents.
   */
  rating: number;
  /** What the solver is asked to do. Usually "Find the winning move." */
  prompt: string;
  /** Columns replayed from an empty board to reach the starting position. */
  moves: number[];
  /** Which colour the solver is playing. */
  solver: Player;
  /** Every column that counts as solving it. */
  answers: number[];
  explanation: string;
  /** Position within its lesson. Lower sorts first, and unlocks first. */
  order: number;
}

export function isLessonBlock(value: unknown): value is LessonBlock {
  if (typeof value !== 'object' || value === null) return false;
  const kind = (value as { kind?: unknown }).kind;
  return (
    kind === 'prose' ||
    kind === 'keyIdea' ||
    kind === 'board' ||
    kind === 'tryIt' ||
    kind === 'reference'
  );
}

/** Narrows a JSON column to a block list, dropping anything malformed. */
export function parseBlocks(value: unknown): LessonBlock[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isLessonBlock);
}

/** Convenience for renderers: the cell colour a solver is placing. */
export function solverCell(puzzle: Pick<Puzzle, 'solver'>): Cell {
  return puzzle.solver;
}
