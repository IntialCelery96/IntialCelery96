import { COLS, type Cell, type GameState, type Player } from '../types.js';
import { applyMove, dropRow, legalMoves, lineThrough } from '../board.js';
import { WIN_SCORE, evaluate, type BotStyle } from './evaluate.js';

/** Centre-out order. Good moves first makes alpha-beta prune far more. */
const MOVE_ORDER: readonly number[] = [3, 2, 4, 1, 5, 0, 6];

export interface SearchResult {
  move: number;
  score: number;
  /** Nodes visited — surfaced so tests can assert pruning actually happens. */
  nodes: number;
}

interface SearchContext {
  style: BotStyle;
  /**
   * The player the search is choosing a move for. Every leaf is scored from
   * this player's point of view and then sign-flipped for the side to move.
   *
   * This matters because a personality with `defense !== 1` is deliberately
   * asymmetric: it counts the opponent's threats for more than its own. Scoring
   * each leaf from whoever happens to be on move would make
   * `evaluate(pos, p1) !== -evaluate(pos, p2)`, and negamax would then be
   * comparing scores drawn from two different functions — the defensive bots
   * would search deeply and still play incoherently. Anchoring to one
   * perspective keeps the tree strictly zero-sum while preserving the bias.
   */
  rootPlayer: Player;
  nodes: number;
  deadline: number;
  aborted: boolean;
}

/** Leaf score, relative to the side to move in `state`. */
function leafScore(state: GameState, ctx: SearchContext): number {
  const score = evaluate(state.board, ctx.rootPlayer, ctx.style);
  return state.turn === ctx.rootPlayer ? score : -score;
}

function orderedMoves(state: GameState): number[] {
  const legal = new Set(legalMoves(state));
  return MOVE_ORDER.filter((col) => legal.has(col));
}

/**
 * Negamax with alpha-beta pruning.
 *
 * Returns the score for the side to move in `state`. Wins are scored as
 * `WIN_SCORE - ply` so that a mate in two beats a mate in four — without this
 * a bot will happily shuffle around in a won position forever.
 */
function negamax(
  state: GameState,
  depth: number,
  alpha: number,
  beta: number,
  ply: number,
  ctx: SearchContext,
): number {
  ctx.nodes++;

  if ((ctx.nodes & 1023) === 0 && Date.now() > ctx.deadline) {
    ctx.aborted = true;
  }

  if (depth === 0 || ctx.aborted) {
    return leafScore(state, ctx);
  }

  const moves = orderedMoves(state);
  if (moves.length === 0) return 0; // drawn, board full

  let best = -Infinity;
  let a = alpha;

  for (const col of moves) {
    const next = applyMove(state, col);

    let score: number;
    if (next.status === 'win') {
      score = WIN_SCORE - ply;
    } else if (next.status === 'draw') {
      score = 0;
    } else {
      score = -negamax(next, depth - 1, -beta, -a, ply + 1, ctx);
    }

    if (score > best) best = score;
    if (best > a) a = best;
    if (a >= beta) break; // opponent would never allow this line
  }

  return best;
}

export interface SearchOptions {
  depth: number;
  style: BotStyle;
  /** Wall-clock budget in ms. The search returns its best-so-far when spent. */
  timeBudgetMs?: number;
  /** Injected so tests and replays are deterministic. */
  random?: () => number;
}

/**
 * Picks a move for the side to move in `state`.
 *
 * Equal-scoring moves are broken randomly so two bots of the same personality
 * don't replay an identical game every time, while still preferring the
 * centre-out order when scores genuinely tie.
 */
export function search(state: GameState, options: SearchOptions): SearchResult {
  const { depth, style, timeBudgetMs = 2_000, random = Math.random } = options;
  const ctx: SearchContext = {
    style,
    rootPlayer: state.turn,
    nodes: 0,
    deadline: Date.now() + timeBudgetMs,
    aborted: false,
  };

  const moves = orderedMoves(state);
  if (moves.length === 0) {
    return { move: -1, score: 0, nodes: 0 };
  }

  let bestScore = -Infinity;
  let bestMoves: number[] = [];

  for (const col of moves) {
    const next = applyMove(state, col);

    let score: number;
    if (next.status === 'win') {
      score = WIN_SCORE;
    } else if (next.status === 'draw') {
      score = 0;
    } else {
      score = -negamax(next, depth - 1, -Infinity, Infinity, 1, ctx);
    }

    if (score > bestScore) {
      bestScore = score;
      bestMoves = [col];
    } else if (score === bestScore) {
      bestMoves.push(col);
    }
  }

  const move = bestMoves[Math.floor(random() * bestMoves.length)] ?? bestMoves[0]!;
  return { move, score: bestScore, nodes: ctx.nodes };
}

/** Columns that win immediately for the side to move. */
export function immediateWins(state: GameState): number[] {
  return legalMoves(state).filter((col) => applyMove(state, col).status === 'win');
}

/**
 * Columns the opponent would win with if handed the move. These are the squares
 * we have to block. Used by the simpler bots, which don't search at all.
 */
export function immediateThreats(state: GameState): number[] {
  const opponent = state.turn === 1 ? 2 : 1;
  const threats: number[] = [];

  for (let col = 0; col < COLS; col++) {
    const row = dropRow(state.board, col);
    if (row === -1) continue;
    const board = state.board.slice() as Cell[];
    const index = row * COLS + col;
    board[index] = opponent;
    if (lineThrough(board, index)) threats.push(col);
  }

  return threats;
}
