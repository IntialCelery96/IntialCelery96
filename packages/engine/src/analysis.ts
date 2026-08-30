import { otherPlayer, type GameState, type Player } from './types.js';
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
  /**
   * The only move that held or won, and not merely by taking an obvious win.
   * Rare by construction: every other legal move had to lose.
   */
  | 'brilliant'
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

/** Ordered strongest to weakest, for sorting and for summary display. */
export const MOVE_QUALITIES: readonly MoveQuality[] = [
  'brilliant',
  'best',
  'good',
  'inaccuracy',
  'mistake',
  'blunder',
  'missed_win',
];

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
  /**
   * A sentence explaining the move. Present on every move, not only the bad
   * ones — a review that only speaks up when you err teaches less than one that
   * also says what a good move accomplished.
   */
  note: string;
  /**
   * How the position stood after this move, from the FIRST player's point of
   * view, in -1..1. A forced win pins to ±1.
   *
   * This is a shaped view of the engine's own evaluation, not a probability:
   * the underlying units are arbitrary weights, so the curve is chosen to make
   * the graph readable rather than to predict anything.
   */
  evalAfter: number;
}

export interface PlayerSummary {
  brilliant: number;
  best: number;
  good: number;
  inaccuracy: number;
  mistake: number;
  blunder: number;
  missedWin: number;
  /**
   * A 0-100 score for the player's moves.
   *
   * Not the share of top-choice moves: in Connect 4 many positions have several
   * moves that give nothing away, and scoring those as failures reads as unfair
   * because it is. Each move earns a weight by quality and the mean is taken,
   * so a game of sound-but-not-optimal moves scores well and a game with one
   * blunder in it does not.
   */
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
  return {
    brilliant: 0,
    best: 0,
    good: 0,
    inaccuracy: 0,
    mistake: 0,
    blunder: 0,
    missedWin: 0,
    accuracy: 0,
  };
}

/**
 * What each verdict is worth when scoring a player's accuracy.
 *
 * A move that gives nothing away is worth close to full marks even when the
 * engine preferred something else, because in Connect 4 it usually genuinely
 * did not matter. The gap between "inaccuracy" and "blunder" is where the
 * weights bite.
 */
const QUALITY_WEIGHT: Record<MoveQuality, number> = {
  brilliant: 1,
  best: 1,
  good: 0.9,
  inaccuracy: 0.6,
  mistake: 0.3,
  blunder: 0,
  missed_win: 0,
};

/**
 * The scale on which an evaluation is considered decisive.
 *
 * Chosen against the style weights in `evaluate.ts`: a live threat is 90 and a
 * buried three 40, so a few hundred points is the difference between "somewhat
 * better" and "winning". Only affects how the graph looks.
 */
const EVAL_SCALE = 320;

/** Maps a raw engine score to -1..1 for the graph. */
function shapeEval(score: number): number {
  if (score >= WIN_THRESHOLD) return 1;
  if (score <= -WIN_THRESHOLD) return -1;
  return Math.max(-1, Math.min(1, Math.tanh(score / EVAL_SCALE)));
}

/**
 * Describes what a move did, in terms a player can act on.
 *
 * Built from checkable facts about the position rather than from the score:
 * whether it blocked something, whether it created something, how many threats
 * exist afterwards. A note derived from the evaluation number would just be the
 * number in words.
 */
function describeMove(before: GameState, column: number, after: GameState): string {
  const mover = before.turn;
  const opponent = otherPlayer(mover);

  if (after.status === 'win') return 'Four in a row. That is the game.';
  if (after.status === 'draw') return 'Fills the last square — the board is full.';

  // Threats the opponent had before this move, and still has after it.
  const threatsBefore = immediateWins({ ...before, turn: opponent } as GameState).length;
  const threatsAfter = immediateWins(after).length;

  // Threats the mover will have on their next turn.
  const mineAfter = immediateWins({ ...after, turn: mover } as GameState).length;

  if (mineAfter >= 2) {
    return 'Creates two threats at once. Only one of them can be blocked.';
  }

  if (threatsBefore > 0 && threatsAfter === 0) {
    return mineAfter === 1
      ? 'Blocks their threat and builds one of your own.'
      : 'Blocks the threat before it could be completed.';
  }

  if (mineAfter === 1) {
    return 'Builds a threat — they have to answer it next move.';
  }

  if (threatsBefore > 0 && threatsAfter > 0) {
    return 'Leaves their threat standing.';
  }

  const centreDistance = Math.abs(column - 3);
  if (centreDistance === 0) return 'Takes the centre, the most valuable column.';
  if (centreDistance === 1) return 'Develops toward the middle.';
  return 'A quiet move on the edge of the board.';
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
  ranked: readonly { move: number; score: number }[],
): { quality: MoveQuality } {
  const drop = Math.max(0, bestScore - playedScore);

  // A win was sitting on the board. Nothing else about the move matters.
  const wins = immediateWins(state);
  if (wins.length > 0 && !wins.includes(column)) {
    return { quality: 'missed_win' };
  }

  /**
   * The only move that held — and the danger was not visible one move out.
   *
   * That last condition is what stops the tier from being worthless. Blocking a
   * three-in-a-row is also "the only move that held", but it is forced and
   * anyone sees it; awarding brilliance for it would fire on most defensive
   * moves in most games. Requiring that the opponent had no immediate winning
   * square means the loss was at least two moves away, so finding the one reply
   * actually took seeing something.
   *
   * Taking an immediate win is excluded for the same reason: that is `best`.
   */
  const opponentThreats = immediateWins({ ...state, turn: otherPlayer(state.turn) });

  if (
    wins.length === 0 &&
    opponentThreats.length === 0 &&
    ranked.length > 1 &&
    column === bestColumn &&
    !isLosing(playedScore) &&
    ranked.every((entry) => entry.move === column || isLosing(entry.score))
  ) {
    return { quality: 'brilliant' };
  }

  // The move handed the opponent an immediate win. Only a blunder if it could
  // have been avoided — sometimes every move loses, and that is not this move's
  // fault.
  const after = applyMove(state, column);
  if (after.status === 'in_progress') {
    const opponentWins = immediateWins(after);
    if (opponentWins.length > 0 && !isLosing(bestScore)) {
      return { quality: 'blunder' };
    }
  }

  // Threw away a won position.
  if (isWinning(bestScore) && !isWinning(playedScore)) return { quality: 'mistake' };

  if (column === bestColumn || drop === 0) return { quality: 'best' };
  if (drop >= MISTAKE_DROP) return { quality: 'mistake' };
  if (drop >= INACCURACY_DROP) return { quality: 'inaccuracy' };

  return { quality: 'good' };
}

/**
 * The sentence shown against a move.
 *
 * Verdicts that carry a specific lesson say it; the rest describe what the move
 * did on the board. Both paths always return something, because a review that
 * goes quiet on ordinary moves teaches less than one that does not.
 */
function noteFor(
  quality: MoveQuality,
  before: GameState,
  column: number,
  after: GameState,
  bestColumn: number,
): string {
  const wins = immediateWins(before);

  switch (quality) {
    case 'missed_win':
      return `Column ${wins[0]! + 1} completed four in a row and won on the spot.`;

    case 'blunder': {
      const opponentWins = after.status === 'in_progress' ? immediateWins(after) : [];
      const winning = (opponentWins[0] ?? bestColumn) + 1;
      // The square to block is usually the same square the opponent wins on,
      // and naming it twice reads like a contradiction.
      return bestColumn === opponentWins[0]
        ? `This let them win with column ${winning}. Taking column ${winning} yourself was the move.`
        : `This let them win with column ${winning}. Column ${bestColumn + 1} held the position.`;
    }

    case 'brilliant':
      return 'The only move that held — and nothing on the board said so yet.';

    case 'mistake':
      return `Column ${bestColumn + 1} was clearly stronger here.`;

    case 'inaccuracy':
      return `Column ${bestColumn + 1} was a little better.`;

    case 'best': {
      // A block that was the only thing keeping the game alive is forced rather
      // than inspired, and saying so is more useful than praising it.
      const threats = immediateWins({ ...before, turn: otherPlayer(before.turn) });
      if (threats.length > 0 && after.status === 'in_progress') {
        const stillThreatened = immediateWins(after).length > 0;
        if (!stillThreatened) return 'Forced — any other move loses on the spot.';
      }
      return describeMove(before, column, after);
    }

    default:
      return describeMove(before, column, after);
  }
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

    const next = applyMove(state, column);
    const { quality } = classify(state, column, played.score, best.score, best.move, ranked);

    // `played.score` is from the mover's point of view; the graph is always
    // from the first player's, so the sign flips on the second player's moves.
    const evalAfter = shapeEval(mover === 1 ? played.score : -played.score);

    analyses.push({
      ply,
      player: mover,
      column,
      quality,
      bestColumn: best.move,
      scoreDrop: Math.max(0, Math.round(best.score - played.score)),
      note: noteFor(quality, state, column, next, best.move),
      evalAfter,
    });

    const summary = summaries[mover];
    if (quality === 'missed_win') summary.missedWin++;
    else if (quality === 'blunder') summary.blunder++;
    else if (quality === 'mistake') summary.mistake++;
    else if (quality === 'inaccuracy') summary.inaccuracy++;
    else if (quality === 'brilliant') summary.brilliant++;
    else if (quality === 'best') summary.best++;
    else summary.good++;

    state = next;
  }

  for (const player of [1, 2] as const) {
    const summary = summaries[player];
    const moves = analyses.filter((move) => move.player === player);
    const scored = moves.reduce((total, move) => total + QUALITY_WEIGHT[move.quality], 0);
    summary.accuracy = moves.length === 0 ? 0 : Math.round((scored / moves.length) * 100);
  }

  return { moves: analyses, players: summaries, depth };
}

/** Whether a quality is worth surfacing in the key-moments list. */
export function isNotable(quality: MoveQuality): boolean {
  return (
    quality === 'missed_win' ||
    quality === 'blunder' ||
    quality === 'mistake' ||
    quality === 'brilliant'
  );
}

/** The single most costly moment in the game, or null if there wasn't one. */
export function turningPoint(analysis: GameAnalysis): MoveAnalysis | null {
  const notable = analysis.moves.filter(
    (move) => isNotable(move.quality) && move.quality !== 'brilliant',
  );
  if (notable.length === 0) return null;

  // A missed win or an outright blunder outranks a merely bad move.
  const rank: Record<MoveQuality, number> = {
    missed_win: 3,
    blunder: 3,
    mistake: 2,
    inaccuracy: 1,
    // A brilliancy is worth showing, but it is not what turned a game.
    brilliant: 0,
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
