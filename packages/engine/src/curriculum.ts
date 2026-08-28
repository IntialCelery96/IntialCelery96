/**
 * Curriculum types — the shape lessons and puzzles take, shared by the server
 * (which stores them), the seed script (which writes them) and the web app
 * (which renders them).
 *
 * This is deliberately a scaffold. The point is that adding real content later
 * is a data job, not a code job: write a lesson made of these blocks, seed it,
 * and the existing renderer displays it.
 */

import type { Cell, Player } from './types.js';

export type Difficulty = 'beginner' | 'intermediate' | 'advanced';

export const DIFFICULTIES: readonly Difficulty[] = ['beginner', 'intermediate', 'advanced'];

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

export type LessonBlock = ProseBlock | KeyIdeaBlock | BoardBlock | TryItBlock;

export interface Lesson {
  slug: string;
  title: string;
  summary: string;
  difficulty: Difficulty;
  /** Position within its difficulty tier. Lower sorts first. */
  order: number;
  blocks: LessonBlock[];
}

export interface Puzzle {
  slug: string;
  title: string;
  difficulty: Difficulty;
  /** Columns replayed from an empty board to reach the starting position. */
  moves: number[];
  /** Which colour the solver is playing. */
  solver: Player;
  /** Every column that counts as solving it. */
  answers: number[];
  explanation: string;
  order: number;
}

export function isLessonBlock(value: unknown): value is LessonBlock {
  if (typeof value !== 'object' || value === null) return false;
  const kind = (value as { kind?: unknown }).kind;
  return kind === 'prose' || kind === 'keyIdea' || kind === 'board' || kind === 'tryIt';
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
