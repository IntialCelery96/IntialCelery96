import {
  CELL_COUNT,
  COLS,
  CONNECT,
  ROWS,
  type Cell,
  type GameState,
  type Player,
  indexOf,
  otherPlayer,
} from './types.js';

/** The four directions we scan for a connection, as (dRow, dCol) pairs. */
const DIRECTIONS: ReadonlyArray<readonly [number, number]> = [
  [0, 1], // horizontal
  [1, 0], // vertical
  [1, 1], // diagonal /
  [1, -1], // diagonal \
];

export function emptyBoard(): Cell[] {
  return new Array<Cell>(CELL_COUNT).fill(0);
}

export function createGame(): GameState {
  return {
    board: emptyBoard(),
    moves: [],
    turn: 1,
    status: 'in_progress',
    winner: null,
    winningLine: null,
  };
}

/**
 * The row a disc would land on if dropped into `col`, or -1 when the column is
 * full or out of range.
 */
export function dropRow(board: readonly Cell[], col: number): number {
  if (!Number.isInteger(col) || col < 0 || col >= COLS) return -1;
  for (let row = 0; row < ROWS; row++) {
    if (board[indexOf(row, col)] === 0) return row;
  }
  return -1;
}

export function isColumnPlayable(state: GameState, col: number): boolean {
  return state.status === 'in_progress' && dropRow(state.board, col) !== -1;
}

export function legalMoves(state: GameState): number[] {
  if (state.status !== 'in_progress') return [];
  const out: number[] = [];
  for (let col = 0; col < COLS; col++) {
    if (dropRow(state.board, col) !== -1) out.push(col);
  }
  return out;
}

export function isBoardFull(board: readonly Cell[]): boolean {
  for (let col = 0; col < COLS; col++) {
    if (board[indexOf(ROWS - 1, col)] === 0) return false;
  }
  return true;
}

/**
 * Returns the connected line of >= 4 discs through `index`, or null.
 * Only the cell that was just played needs checking, which is why this takes
 * an index rather than scanning the whole board.
 */
export function lineThrough(board: readonly Cell[], index: number): number[] | null {
  const player = board[index];
  if (!player) return null;

  const row = Math.floor(index / COLS);
  const col = index % COLS;

  for (const [dRow, dCol] of DIRECTIONS) {
    const line = [index];

    // Walk forwards then backwards along the direction, collecting same-colour
    // discs until we hit an edge or a different cell.
    for (const sign of [1, -1] as const) {
      let r = row + sign * dRow;
      let c = col + sign * dCol;
      while (r >= 0 && r < ROWS && c >= 0 && c < COLS && board[indexOf(r, c)] === player) {
        line.push(indexOf(r, c));
        r += sign * dRow;
        c += sign * dCol;
      }
    }

    if (line.length >= CONNECT) return line.sort((a, b) => a - b);
  }

  return null;
}

/** Scans the whole board for any winning line. Used when validating imports. */
export function findWinner(board: readonly Cell[]): { player: Player; line: number[] } | null {
  for (let index = 0; index < CELL_COUNT; index++) {
    const cell = board[index];
    if (!cell) continue;
    const line = lineThrough(board, index);
    if (line) return { player: cell, line };
  }
  return null;
}

export class IllegalMoveError extends Error {
  readonly code = 'ILLEGAL_MOVE';
  constructor(message: string) {
    super(message);
    this.name = 'IllegalMoveError';
  }
}

/**
 * Applies a move, returning a NEW state. The input state is never mutated —
 * the server relies on this to keep authoritative history and to let bots
 * search without cloning by hand.
 */
export function applyMove(state: GameState, col: number): GameState {
  if (state.status !== 'in_progress') {
    throw new IllegalMoveError('Game is already over');
  }
  const row = dropRow(state.board, col);
  if (row === -1) {
    throw new IllegalMoveError(`Column ${col} is not playable`);
  }

  const index = indexOf(row, col);
  const board = state.board.slice() as Cell[];
  board[index] = state.turn;

  const line = lineThrough(board, index);
  const moves = [...state.moves, col];

  if (line) {
    return {
      board,
      moves,
      turn: state.turn,
      status: 'win',
      winner: state.turn,
      winningLine: line,
    };
  }

  if (isBoardFull(board)) {
    return { board, moves, turn: state.turn, status: 'draw', winner: null, winningLine: null };
  }

  return {
    board,
    moves,
    turn: otherPlayer(state.turn),
    status: 'in_progress',
    winner: null,
    winningLine: null,
  };
}

/** Applies a move, or returns null instead of throwing. */
export function tryMove(state: GameState, col: number): GameState | null {
  try {
    return applyMove(state, col);
  } catch {
    return null;
  }
}

/**
 * Compact wire/DB format: the column of each move, in order, as digits.
 * "3334" is a four-move game. Empty string is a fresh board.
 */
export function serializeMoves(moves: readonly number[]): string {
  return moves.join('');
}

export function parseMoves(encoded: string): number[] {
  const trimmed = encoded.trim();
  if (!trimmed) return [];
  const moves: number[] = [];
  for (const ch of trimmed) {
    const col = Number(ch);
    if (!Number.isInteger(col) || col < 0 || col >= COLS) {
      throw new IllegalMoveError(`Invalid move character "${ch}"`);
    }
    moves.push(col);
  }
  return moves;
}

/** Rebuilds a state from a move list, validating every move on the way. */
export function replay(moves: readonly number[]): GameState {
  let state = createGame();
  for (const col of moves) {
    state = applyMove(state, col);
  }
  return state;
}

export function fromEncoded(encoded: string): GameState {
  return replay(parseMoves(encoded));
}

/** Which player owns move number `n` (0-indexed). Player 1 always starts. */
export function playerForMoveNumber(n: number): Player {
  return n % 2 === 0 ? 1 : 2;
}

/**
 * Human-readable board, bottom row last. Handy in tests and logs:
 *   `.......` for empty rows, `x` for player 1, `o` for player 2.
 */
export function renderBoard(board: readonly Cell[]): string {
  const rows: string[] = [];
  for (let row = ROWS - 1; row >= 0; row--) {
    let line = '';
    for (let col = 0; col < COLS; col++) {
      const cell = board[indexOf(row, col)];
      line += cell === 1 ? 'x' : cell === 2 ? 'o' : '.';
    }
    rows.push(line);
  }
  return rows.join('\n');
}

/**
 * Parses the `renderBoard` format back into a board. Rows are given top-first,
 * which is how a person naturally writes a position out in a test.
 */
export function parseBoard(text: string): Cell[] {
  const lines = text
    .trim()
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length !== ROWS) {
    throw new Error(`Expected ${ROWS} rows, got ${lines.length}`);
  }
  const board = emptyBoard();
  lines.forEach((line, i) => {
    if (line.length !== COLS) throw new Error(`Row "${line}" must be ${COLS} wide`);
    const row = ROWS - 1 - i;
    for (let col = 0; col < COLS; col++) {
      const ch = line[col];
      board[indexOf(row, col)] = ch === 'x' ? 1 : ch === 'o' ? 2 : 0;
    }
  });
  return board;
}

/**
 * Builds a state from a drawn position. Floating discs are rejected, so a
 * malformed test fixture fails loudly instead of producing nonsense.
 */
export function stateFromBoard(board: readonly Cell[], turn: Player): GameState {
  for (let col = 0; col < COLS; col++) {
    let seenEmpty = false;
    for (let row = 0; row < ROWS; row++) {
      const cell = board[indexOf(row, col)];
      if (cell === 0) seenEmpty = true;
      else if (seenEmpty) throw new Error(`Floating disc in column ${col}`);
    }
  }

  const win = findWinner(board);
  if (win) {
    return {
      board: board.slice(),
      moves: [],
      turn: win.player,
      status: 'win',
      winner: win.player,
      winningLine: win.line,
    };
  }
  if (isBoardFull(board)) {
    return { board: board.slice(), moves: [], turn, status: 'draw', winner: null, winningLine: null };
  }
  return {
    board: board.slice(),
    moves: [],
    turn,
    status: 'in_progress',
    winner: null,
    winningLine: null,
  };
}
