import { describe, expect, it } from 'vitest';
import {
  COLS,
  IllegalMoveError,
  ROWS,
  applyMove,
  createGame,
  dropRow,
  findWinner,
  fromEncoded,
  indexOf,
  isBoardFull,
  legalMoves,
  parseBoard,
  parseMoves,
  renderBoard,
  replay,
  serializeMoves,
  stateFromBoard,
  tryMove,
} from '../src/index.js';

describe('createGame', () => {
  it('starts empty with player 1 to move', () => {
    const game = createGame();
    expect(game.board).toHaveLength(ROWS * COLS);
    expect(game.board.every((c) => c === 0)).toBe(true);
    expect(game.turn).toBe(1);
    expect(game.status).toBe('in_progress');
    expect(game.winner).toBeNull();
    expect(legalMoves(game)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });
});

describe('gravity', () => {
  it('stacks discs from the bottom of a column', () => {
    let game = createGame();
    expect(dropRow(game.board, 3)).toBe(0);
    game = applyMove(game, 3);
    expect(game.board[indexOf(0, 3)]).toBe(1);
    expect(dropRow(game.board, 3)).toBe(1);
    game = applyMove(game, 3);
    expect(game.board[indexOf(1, 3)]).toBe(2);
  });

  it('reports a full column as unplayable and drops it from legal moves', () => {
    let game = createGame();
    for (let i = 0; i < ROWS; i++) {
      game = applyMove(game, 0);
    }
    expect(dropRow(game.board, 0)).toBe(-1);
    expect(legalMoves(game)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(() => applyMove(game, 0)).toThrow(IllegalMoveError);
  });

  it('rejects out-of-range and non-integer columns', () => {
    const game = createGame();
    for (const col of [-1, 7, 99, 1.5, NaN]) {
      expect(dropRow(game.board, col)).toBe(-1);
      expect(() => applyMove(game, col)).toThrow(IllegalMoveError);
      expect(tryMove(game, col)).toBeNull();
    }
  });
});

describe('turn order', () => {
  it('alternates players and never mutates the previous state', () => {
    const first = createGame();
    const second = applyMove(first, 3);
    const third = applyMove(second, 3);

    expect(first.moves).toEqual([]);
    expect(first.board.every((c) => c === 0)).toBe(true);
    expect(second.turn).toBe(2);
    expect(third.turn).toBe(1);
    expect(third.moves).toEqual([3, 3]);
  });
});

describe('win detection', () => {
  it('detects a horizontal connection', () => {
    // Player 1 fills columns 0-3 on the bottom row; player 2 answers above.
    const game = replay([0, 0, 1, 1, 2, 2, 3]);
    expect(game.status).toBe('win');
    expect(game.winner).toBe(1);
    expect(game.winningLine).toEqual([
      indexOf(0, 0),
      indexOf(0, 1),
      indexOf(0, 2),
      indexOf(0, 3),
    ]);
  });

  it('detects a vertical connection', () => {
    const game = replay([3, 4, 3, 4, 3, 4, 3]);
    expect(game.status).toBe('win');
    expect(game.winner).toBe(1);
    expect(game.winningLine).toEqual([
      indexOf(0, 3),
      indexOf(1, 3),
      indexOf(2, 3),
      indexOf(3, 3),
    ]);
  });

  it('detects an ascending diagonal', () => {
    const board = parseBoard(`
      .......
      .......
      ...x...
      ..xo...
      .xoo...
      xooo...
    `);
    const win = findWinner(board);
    expect(win?.player).toBe(1);
    expect(win?.line).toEqual([indexOf(0, 0), indexOf(1, 1), indexOf(2, 2), indexOf(3, 3)]);
  });

  it('detects a descending diagonal', () => {
    const board = parseBoard(`
      .......
      .......
      ...x...
      ...ox..
      ...oox.
      ...ooox
    `);
    const win = findWinner(board);
    expect(win?.player).toBe(1);
    expect(win?.line).toEqual([indexOf(0, 6), indexOf(1, 5), indexOf(2, 4), indexOf(3, 3)]);
  });

  it('does not count a line broken by the opponent', () => {
    const board = parseBoard(`
      .......
      .......
      .......
      .......
      .......
      xxoxx..
    `);
    expect(findWinner(board)).toBeNull();
  });

  it('finds a connection of five as a win', () => {
    const board = parseBoard(`
      .......
      .......
      .......
      .......
      .......
      xxxxx..
    `);
    const win = findWinner(board);
    expect(win?.player).toBe(1);
    expect(win?.line.length).toBeGreaterThanOrEqual(4);
  });

  it('refuses further moves once the game is won', () => {
    const game = replay([3, 4, 3, 4, 3, 4, 3]);
    expect(() => applyMove(game, 0)).toThrow(IllegalMoveError);
    expect(legalMoves(game)).toEqual([]);
  });
});

/**
 * A real game that fills all 42 cells without either player connecting four.
 * Draws are rare enough in Connect 4 that hand-writing one is error prone, so
 * this was found by playing out random legal games until one drew.
 */
const DRAWN_GAME = '261403463601145051320030434465355512122626';

describe('draws', () => {
  it('declares a draw when the board fills with no connection', () => {
    // A real 42-move game that ends with every cell filled and nobody winning.
    const game = fromEncoded(DRAWN_GAME);
    expect(game.moves).toHaveLength(42);
    expect(isBoardFull(game.board)).toBe(true);
    expect(game.status).toBe('draw');
    expect(game.winner).toBeNull();
    expect(game.winningLine).toBeNull();
    expect(legalMoves(game)).toEqual([]);
  });

  it('marks a full board with no winner as drawn', () => {
    const board = parseBoard(`
      xxoxxoo
      ooxooxx
      xxoxxoo
      ooxooxx
      xxoxxoo
      ooxooxx
    `);
    expect(findWinner(board)).toBeNull();
    const state = stateFromBoard(board, 1);
    expect(state.status).toBe('draw');
    expect(legalMoves(state)).toEqual([]);
  });
});

describe('serialization', () => {
  it('round-trips a move list', () => {
    const moves = [3, 3, 4, 2, 5, 1];
    const encoded = serializeMoves(moves);
    expect(encoded).toBe('334251');
    expect(parseMoves(encoded)).toEqual(moves);
    expect(fromEncoded(encoded).moves).toEqual(moves);
  });

  it('treats an empty string as a fresh board', () => {
    expect(parseMoves('')).toEqual([]);
    expect(fromEncoded('').status).toBe('in_progress');
  });

  it('rejects malformed encodings', () => {
    expect(() => parseMoves('39')).toThrow(IllegalMoveError);
    expect(() => parseMoves('3a')).toThrow(IllegalMoveError);
  });

  it('rejects a move list that contains an illegal move', () => {
    // Seven discs cannot fit in one column.
    expect(() => fromEncoded('0000000')).toThrow(IllegalMoveError);
  });
});

describe('board fixtures', () => {
  it('round-trips through render and parse', () => {
    const game = replay([3, 3, 4, 2, 5]);
    expect(parseBoard(renderBoard(game.board))).toEqual([...game.board]);
  });

  it('rejects a position with a floating disc', () => {
    const board = parseBoard(`
      .......
      .......
      .......
      ...x...
      .......
      .......
    `);
    expect(() => stateFromBoard(board, 1)).toThrow(/Floating disc/);
  });
});
