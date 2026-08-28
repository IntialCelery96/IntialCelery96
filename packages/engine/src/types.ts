/**
 * Core shared types for the Connect 4 engine.
 *
 * Board coordinate system
 * -----------------------
 * The board is stored as a flat array of `ROWS * COLS` cells. Row 0 is the
 * BOTTOM row (the one pieces land on first), row 5 is the top. This keeps the
 * gravity maths trivial: dropping into a column means scanning upward from
 * row 0 for the first empty cell. UIs that render top-down simply iterate rows
 * in reverse.
 *
 *   index = row * COLS + col
 */

export const COLS = 7;
export const ROWS = 6;
export const CELL_COUNT = ROWS * COLS;
export const CONNECT = 4;

/** 0 = empty, 1 = first player (red), 2 = second player (yellow). */
export type Cell = 0 | 1 | 2;
export type Player = 1 | 2;

export type GameStatus = 'in_progress' | 'win' | 'draw';

export interface GameState {
  /** Flat board, length 42. See coordinate note above. */
  readonly board: readonly Cell[];
  /** Columns played, in order. Fully describes the game. */
  readonly moves: readonly number[];
  /** Whose turn it is. Meaningless once `status !== 'in_progress'`. */
  readonly turn: Player;
  readonly status: GameStatus;
  readonly winner: Player | null;
  /** Board indices of the four (or more) connected discs, for highlighting. */
  readonly winningLine: readonly number[] | null;
}

export function otherPlayer(p: Player): Player {
  return p === 1 ? 2 : 1;
}

export function indexOf(row: number, col: number): number {
  return row * COLS + col;
}

export function rowOf(index: number): number {
  return Math.floor(index / COLS);
}

export function colOf(index: number): number {
  return index % COLS;
}
