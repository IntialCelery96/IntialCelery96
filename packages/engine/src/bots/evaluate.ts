import { COLS, ROWS, type Cell, type Player, indexOf, otherPlayer } from '../types.js';
import { dropRow } from '../board.js';

/**
 * Every four-in-a-row window on the board, precomputed once. There are 69 of
 * them (24 horizontal, 21 vertical, 24 diagonal). Evaluating a position means
 * walking this list, which is far cheaper than rediscovering the geometry on
 * every node of a search.
 */
function buildWindows(): number[][] {
  const windows: number[][] = [];
  const push = (cells: number[]) => windows.push(cells);

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col + 3 < COLS; col++) {
      push([0, 1, 2, 3].map((i) => indexOf(row, col + i)));
    }
  }
  for (let col = 0; col < COLS; col++) {
    for (let row = 0; row + 3 < ROWS; row++) {
      push([0, 1, 2, 3].map((i) => indexOf(row + i, col)));
    }
  }
  for (let row = 0; row + 3 < ROWS; row++) {
    for (let col = 0; col + 3 < COLS; col++) {
      push([0, 1, 2, 3].map((i) => indexOf(row + i, col + i)));
    }
    for (let col = 3; col < COLS; col++) {
      push([0, 1, 2, 3].map((i) => indexOf(row + i, col - i)));
    }
  }

  return windows;
}

export const WINDOWS: ReadonlyArray<readonly number[]> = buildWindows();

/** Distance from the centre column, used for the centre-control term. */
const CENTER_WEIGHT: readonly number[] = [0, 1, 2, 3, 2, 1, 0];

/**
 * The knobs that give each bot its personality. Two bots searching to the same
 * depth with different weights genuinely play differently: one grabs the
 * centre and builds threats, another spends its effort smothering yours.
 */
export interface BotStyle {
  /** Value of a disc in or near the centre column. */
  center: number;
  /** Value of a window holding two of our discs and no opponent discs. */
  two: number;
  /** Value of a window holding three of ours — one move from a connection. */
  three: number;
  /** Value of an immediately playable winning square (a live threat). */
  liveThreat: number;
  /**
   * Weight on odd/even threat theory. The first player wants threats on odd
   * rows (1st, 3rd, 5th from the bottom); the second player wants them on even
   * rows. A bot with a high value here plays the classic Connect 4 parity game.
   */
  parity: number;
  /**
   * How heavily the opponent's score counts against us. 1.0 is balanced;
   * above 1.0 is a defensive bot that prioritises blocking over building.
   */
  defense: number;
}

export const BALANCED_STYLE: BotStyle = {
  center: 6,
  two: 5,
  three: 40,
  liveThreat: 90,
  parity: 25,
  defense: 1,
};

export const WIN_SCORE = 1_000_000;

function windowScore(
  board: readonly Cell[],
  cells: readonly number[],
  player: Player,
  style: BotStyle,
): number {
  const opponent = otherPlayer(player);
  let mine = 0;
  let theirs = 0;
  let emptyIndex = -1;
  let emptyCount = 0;

  for (const cell of cells) {
    const value = board[cell];
    if (value === player) mine++;
    else if (value === opponent) theirs++;
    else {
      emptyCount++;
      emptyIndex = cell;
    }
  }

  // A window containing both colours can never be completed by either side.
  if (mine > 0 && theirs > 0) return 0;
  if (mine === 0) return 0;

  if (mine === 4) return WIN_SCORE;
  if (mine === 3 && emptyCount === 1) {
    let score = style.three;
    const row = Math.floor(emptyIndex / COLS);
    const col = emptyIndex % COLS;

    if (dropRow(board, col) === row) {
      // The square is playable right now — a threat we can cash next move.
      score += style.liveThreat;
    } else {
      // Not yet reachable. Odd/even threat theory: a threat sitting on a row
      // that matches your parity tends to be the one that eventually decides
      // the game, because the opponent is forced to fill in underneath it.
      const wantsOddRow = player === 1;
      const isOddRow = row % 2 === 0; // row 0 is the 1st row, i.e. odd
      score += wantsOddRow === isOddRow ? style.parity : -style.parity / 2;
    }
    return score;
  }
  if (mine === 2) return style.two;
  return 1;
}

/**
 * Static evaluation of `board` from `player`'s point of view. Positive is good
 * for `player`. Never called on a finished position — the search handles those.
 */
export function evaluate(board: readonly Cell[], player: Player, style: BotStyle): number {
  const opponent = otherPlayer(player);
  let score = 0;

  for (const cells of WINDOWS) {
    score += windowScore(board, cells, player, style);
    score -= style.defense * windowScore(board, cells, opponent, style);
  }

  for (let col = 0; col < COLS; col++) {
    const weight = CENTER_WEIGHT[col]!;
    if (weight === 0) continue;
    for (let row = 0; row < ROWS; row++) {
      const value = board[indexOf(row, col)];
      if (value === player) score += weight * style.center;
      else if (value === opponent) score -= weight * style.center * style.defense;
    }
  }

  return score;
}
