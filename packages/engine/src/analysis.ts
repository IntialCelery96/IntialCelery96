import { type GameState, type Player } from './types.js';
import { applyMove, fromEncoded, legalMoves } from './board.js';
import { BALANCED_STYLE, WIN_SCORE, type BotStyle } from './bots/evaluate.js';
import { immediateWins, rankMoves } from './bots/search.js';

/**
 * Post-game analysis.
 *
 * The classification is deliberately anchored to *tactical facts* rather than
 * to evaluation deltas alone:
 *
 *   - "You had a win on the board and did not play it."
 *   - "That move let your opponent win immediately, and another move didn't."
 *   - "That move threw away a winning position."
 *
 * Those statements are true or false, checkable, and useful to a learner. A
 * scale of centipawn-style buckets would be neither: the evaluation units here
 * are arbitrary weights (a centre disc is worth 6, a live threat 90), so a
 * "40-point drop" means nothing to a player and would vary with the bot style
 * used to produce it. Eval drops are used only for the softest bucket, where no
 * tactical claim applies.
 */

export type MoveQuality =
  /** Matched the engine's top choice. */
  | 'best'
  /** Not the top choice, but nothing was given away. */
  | 'good'
  /** Measurably worse than the best move, with nothing forced about it. */
  | 'inaccuracy'
  /** Threw away a winning position, or a large evaluation swing. */
  | 'mistake'
  /** Handed the opponent an immediate win that was avoidable. */
  | 'blunder'
  /** A win was available on the board and was not played. */
  | 'missed_win';

export interface MoveAnalysis {
  /** 0-based index into the game's move list. */
  ply: number;
  player: Player;
  /** The column actually played. */
  column: number;
  quality: MoveQuality;
  /** The engine's preferred column at this point. */
  bestColumn: number;
  /**
   * How much worse the played move scored than the best one, on the engine's
   * internal scale. Never negative.
   *
   * Useful for sorting and for comparing two quiet moves, but not a figure to
   * show a player: a lost forced win registers as ~1,000,000, which is an
   * artefact of how wins are scored rather than a meaningful quantity. The
   * `quality` and `note` fields are what the UI should render.
   */
  scoreDrop: number;
  /** A sentence explaining the verdict, or null for unremarkable moves. */
  note: string | null;
}

export interface PlayerSummary {
  best: number;
  good: number;
  inaccuracy: number;
  mistake: number;
  blunder: number;
  missedWin: number;
  /** Share of moves that matched the engine's top choice, 0-1. */
  accuracy: number;
}

export interface GameAnalysis {
  moves: MoveAnalysis[];
  players: Record<Player, PlayerSummary>;
  /** Search depth used, so a cached result can be invalidated if it changes. */
  depth: number;
}

export interface AnalyseOptions {
  /**
   * Search depth. Lower than the strongest bot uses: analysis runs over every
   * position in a game, so cost multiplies by ~42.
   */
  depth?: number;
  style?: BotStyle;
  timeBudgetMs?: number;
}

/**
 * Six plies.
 *
 * Measured over a full 42-move game: depth 4 takes 0.15s, depth 6 1.1s, depth 7
 * 3.7s, depth 8 13.4s — and depths 4 through 8 produce a materially identical
 * classification (one move moved between "good" and "inaccuracy"). That is not
 * a coincidence: the verdicts that matter are tactical rather than positional,
 * and `immediateWins` does not care how deep the search goes. Depth 6 is deep
 * enough to spot a forced win a few moves out while keeping a whole game inside
 * a second or so.
 */
export const DEFAULT_ANALYSIS_DEPTH = 6;

/** Scores at or beyond this are a forced win for the side to move. */
const WIN_THRESHOLD = WIN_SCORE - 1_000;

/**
 * Evaluation drop that counts as an inaccuracy or a mistake, on the engine's
 * own scale. Calibrated against the style weights in `evaluate.ts`: a live
 * threat is worth 90 and a buried three 40, so a drop of 60 is roughly "gave up
 * a real threat" and 150 is "gave up more than one".
 */
const INACCURACY_DROP = 60;
const MISTAKE_DROP = 150;

function isWinning(score: number): boolean {
  return score >= WIN_THRESHOLD;
}

function isLosing(score: number): boolean {
  return score <= -WIN_THRESHOLD;
}

function emptySummary(): PlayerSummary {
  return { best: 0, good: 0, inaccuracy: 0, mistake: 0, blunder: 0, missedWin: 0, accuracy: 0 };
}

/**
 * Classifies one move, given the ranking of every option in the position.
 *
 * `playedScore` and `bestScore` are both from the mover's point of view.
 */
function classify(
  state: GameState,
  column: number,
  playedScore: number,
  bestScore: number,
  bestColumn: number,
): { quality: MoveQuality; note: string | null } {
  const drop = Math.max(0, bestScore - playedScore);

  // A win was sitting on the board. Nothing else about the move matters.
  const wins = immediateWins(state);
  if (wins.length > 0 && !wins.includes(column)) {
    return {
      quality: 'missed_win',
      note: `Column ${wins[0]! + 1} completed four in a row and won on the spot.`,
    };
  }

  // The move handed the opponent an immediate win. Only a blunder if it could
  // have been avoided — sometimes every move loses, and that is not this move's
  // fault.
  const after = applyMove(state, column);
  if (after.status === 'in_progress') {
    const opponentWins = immediateWins(after);
    if (opponentWins.length > 0 && !isLosing(bestScore)) {
      const winning = opponentWins[0]! + 1;
      return {
        quality: 'blunder',
        // The square to block is usually the same square the opponent wins on,
        // and naming it twice reads like a contradiction ("they win with
        // column 4… column 4 held the position"). Say it once when they match.
        note:
          bestColumn === opponentWins[0]
            ? `This let your opponent win with column ${winning}. Taking column ${winning} yourself was the move.`
            : `This let your opponent win with column ${winning}. Column ${
                bestColumn + 1
              } held the position.`,
      };
    }
  }

  // Threw away a won position.
  if (isWinning(bestScore) && !isWinning(playedScore)) {
    return {
      quality: 'mistake',
      note: `Column ${bestColumn + 1} led to a forced win; this gave that up.`,
    };
  }

  if (column === bestColumn || drop === 0) {
    return { quality: 'best', note: null };
  }

  if (drop >= MISTAKE_DROP) {
    return {
      quality: 'mistake',
      note: `Column ${bestColumn + 1} was clearly stronger here.`,
    };
  }

  if (drop >= INACCURACY_DROP) {
    return { quality: 'inaccuracy', note: `Column ${bestColumn + 1} was a little better.` };
  }

  return { quality: 'good', note: null };
}

/**
 * Analyses a finished (or partial) game from its move list.
 *
 * Every position is searched once, so cost is roughly the number of moves times
 * the cost of one search. At the default depth that is a few seconds for a full
 * game — fine to run in a worker and cache, not fine to run on the event loop.
 */
export function analyseGame(moves: readonly number[], options: AnalyseOptions = {}): GameAnalysis {
  const {
    depth = DEFAULT_ANALYSIS_DEPTH,
    style = BALANCED_STYLE,
    timeBudgetMs = 5_000,
  } = options;

  const analyses: MoveAnalysis[] = [];
  const summaries: Record<Player, PlayerSummary> = { 1: emptySummary(), 2: emptySummary() };

  let state: GameState = fromEncoded('');

  for (const [ply, column] of moves.entries()) {
    if (state.status !== 'in_progress') break;
    if (!legalMoves(state).includes(column)) break;

    const mover = state.turn;
    const ranked = rankMoves(state, { depth, style, timeBudgetMs });

    const best = ranked[0];
    const played = ranked.find((entry) => entry.move === column);

    // Should not happen for a legal move, but analysis must never throw on a
    // stored game.
    if (!best || !played) {
      state = applyMove(state, column);
      continue;
    }

    const { quality, note } = classify(state, column, played.score, best.score, best.move);

    analyses.push({
      ply,
      player: mover,
      column,
      quality,
      bestColumn: best.move,
      scoreDrop: Math.max(0, Math.round(best.score - played.score)),
      note,
    });

    const summary = summaries[mover];
    if (quality === 'missed_win') summary.missedWin++;
    else if (quality === 'blunder') summary.blunder++;
    else if (quality === 'mistake') summary.mistake++;
    else if (quality === 'inaccuracy') summary.inaccuracy++;
    else if (quality === 'best') summary.best++;
    else summary.good++;

    state = applyMove(state, column);
  }

  for (const player of [1, 2] as const) {
    const summary = summaries[player];
    const total =
      summary.best +
      summary.good +
      summary.inaccuracy +
      summary.mistake +
      summary.blunder +
      summary.missedWin;
    summary.accuracy = total === 0 ? 0 : summary.best / total;
  }

  return { moves: analyses, players: summaries, depth };
}

/** Whether a quality is worth surfacing to the player. */
export function isNotable(quality: MoveQuality): boolean {
  return quality === 'missed_win' || quality === 'blunder' || quality === 'mistake';
}

/** The single most costly moment in the game, or null if there wasn't one. */
export function turningPoint(analysis: GameAnalysis): MoveAnalysis | null {
  const notable = analysis.moves.filter((move) => isNotable(move.quality));
  if (notable.length === 0) return null;

  // A missed win or an outright blunder outranks a merely bad move.
  const rank: Record<MoveQuality, number> = {
    missed_win: 3,
    blunder: 3,
    mistake: 2,
    inaccuracy: 1,
    good: 0,
    best: 0,
  };

  return notable.reduce((worst, move) => {
    const byRank = rank[move.quality] - rank[worst.quality];
    if (byRank !== 0) return byRank > 0 ? move : worst;
    // Same severity: the earlier one is the one that decided the game.
    return move.ply < worst.ply ? move : worst;
  });
}
