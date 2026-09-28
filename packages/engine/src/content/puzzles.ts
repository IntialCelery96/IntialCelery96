import type { Puzzle } from '../curriculum.js';
import * as P from './positions.js';

/**
 * The puzzle set. Every answer here is proved by `tests/content.test.ts`:
 * win-in-one puzzles must list exactly the winning columns, forcing puzzles
 * exactly the moves that force a win within the stated horizon, and endgame
 * puzzles exactly the moves that hold the exhaustively-solved value.
 *
 * Ratings are hand-set on the player scale (a new account starts at 1200).
 * They are the starting point for a puzzle rating that floats with solve
 * rates, the way chess sites rate puzzles as if they were opponents.
 */

const WIN = 'Find the winning move.';

export const PUZZLES: readonly Puzzle[] = [
  // --- New to the game -------------------------------------------------------
  {
    slug: 'find-the-win',
    title: 'Find the win',
    difficulty: 'new',
    theme: 'winInOne',
    rating: 400,
    prompt: WIN,
    moves: P.VERTICAL_WIN,
    solver: 1,
    answers: [3],
    explanation:
      'Column 4 completes a vertical four. Vertical threats are the easiest to miss because they build in one place — always scan your own columns before you look anywhere else.',
    order: 1,
  },
  {
    slug: 'three-across',
    title: 'Three across',
    difficulty: 'new',
    theme: 'winInOne',
    rating: 450,
    prompt: WIN,
    moves: P.HORIZONTAL_RACE,
    solver: 1,
    answers: [3],
    explanation:
      'Column 4 makes four along the bottom row. It is also the square your opponent needed, so it wins and blocks at once.',
    order: 2,
  },
  {
    slug: 'down-the-diagonal',
    title: 'Down the diagonal',
    difficulty: 'new',
    theme: 'winInOne',
    rating: 550,
    prompt: WIN,
    moves: P.DIAGONAL_WIN,
    solver: 1,
    answers: [3],
    explanation:
      'Column 4 lands on row 4 and completes the diagonal from column 1, row 1. Diagonal fours are the ones players at every level overlook.',
    order: 3,
  },
  {
    slug: 'cap-the-stack',
    title: 'Cap the stack',
    difficulty: 'new',
    theme: 'block',
    rating: 450,
    prompt: 'Find the move that stops the four.',
    moves: [3, 0, 3, 1, 3],
    solver: 2,
    answers: [3],
    explanation: 'Column 4, on top of the stack. A vertical three is always playable, so it always has to be capped at once.',
    order: 4,
  },
  {
    slug: 'stop-the-row',
    title: 'Stop the row',
    difficulty: 'new',
    theme: 'block',
    rating: 500,
    prompt: 'Find the move that stops the four.',
    moves: P.BLOCK_THE_ROW,
    solver: 1,
    answers: [3],
    explanation: 'Column 4 is the only square that completes their row, and it is playable, so it is the only move.',
    order: 5,
  },
  {
    slug: 'the-hidden-diagonal',
    title: 'The hidden diagonal',
    difficulty: 'new',
    theme: 'block',
    rating: 700,
    prompt: 'Their last move made a threat. Find the move that stops it.',
    moves: P.HIDDEN_DIAGONAL,
    solver: 1,
    answers: [4],
    explanation:
      'Column 5. The diagonal from column 2, row 1 through column 3, row 2 and column 4, row 3 ends on column 5, row 4, and column 5 already has three discs in it.',
    order: 6,
  },

  // --- Beginner ------------------------------------------------------------------
  {
    slug: 'win-dont-block',
    title: 'Win, don’t block',
    difficulty: 'beginner',
    theme: 'winInOne',
    rating: 800,
    prompt: 'They threaten to win. Find the best move anyway.',
    moves: P.WIN_BEFORE_BLOCK,
    solver: 1,
    answers: [4],
    explanation:
      'Column 5 completes your stack. Their row is a threat only if you give them another move; you do not.',
    order: 1,
  },
  {
    slug: 'open-ended',
    title: 'Open-ended',
    difficulty: 'beginner',
    theme: 'doubleThreat',
    rating: 850,
    prompt: 'Make a threat that cannot be blocked.',
    moves: P.MAKE_OPEN_THREE,
    solver: 1,
    answers: [1, 4],
    explanation:
      'Column 2 or column 5 makes three across with a playable empty square at each end. They can block one end; you win at the other.',
    order: 2,
  },
  {
    slug: 'two-lines-cross',
    title: 'Two lines cross',
    difficulty: 'beginner',
    theme: 'doubleThreat',
    rating: 1000,
    prompt: 'Find the move that makes two threats at once.',
    moves: P.CROSSING_LINES,
    solver: 1,
    answers: [3],
    explanation:
      'Column 4 completes three across on row 2 (threatening column 5) and three on the falling diagonal (threatening column 2, row 4). Both squares are playable.',
    order: 3,
  },
  {
    slug: 'spring-the-seven',
    title: 'Spring the 7',
    difficulty: 'beginner',
    theme: 'sevenTrap',
    rating: 1050,
    prompt: 'Complete the trap.',
    moves: P.SEVEN_BEFORE,
    solver: 1,
    answers: [4],
    explanation:
      'Column 5 finishes the bar on row 3 and the diagonal from column 3, row 1. The threats are column 6, row 3 and column 6, row 4, stacked: whichever they block, the other wins.',
    order: 4,
  },
  {
    slug: 'break-the-seven',
    title: 'Break the 7',
    difficulty: 'beginner',
    theme: 'sevenTrap',
    rating: 1100,
    prompt: 'They are one move from a 7 trap. Find a move that stops it.',
    moves: P.SEVEN_DEFENCE,
    solver: 2,
    answers: [4, 5],
    explanation:
      'Column 5 takes the square that would complete both the bar and the diagonal — the cleanest defence. Column 6 also holds, by making the end of the bar yours before it becomes a threat.',
    order: 5,
  },

  {
    slug: 'poison-square',
    title: 'The poison square',
    difficulty: 'beginner',
    theme: 'safeSquare',
    rating: 900,
    prompt: 'Column 4 is the centre and looks natural. Find a safe move.',
    moves: P.FLOATING_THREAT,
    solver: 1,
    answers: [1, 2, 4, 5, 6],
    explanation:
      'Columns 2, 3, 5, 6 or 7. Column 4 fills the square beneath their row 2 threat and loses at once. Column 1 loses too, a few moves later: they answer column 2 and build a second line you cannot hold.',
    order: 6,
  },

  // --- Intermediate ----------------------------------------------------------------
  {
    slug: 'force-the-block',
    title: 'Force the block',
    difficulty: 'intermediate',
    theme: 'forcingSequence',
    rating: 1250,
    prompt: 'Find the move that forces a win.',
    moves: P.FORCING_ONE,
    solver: 1,
    answers: [3],
    explanation:
      'Column 4 threatens column 5, row 1. They must block, and the block makes column 5, row 2 playable — the last square of your diagonal from column 4, row 1 to column 7, row 4.',
    order: 1,
  },
  {
    slug: 'two-forcing-moves',
    title: 'Two forcing moves',
    difficulty: 'intermediate',
    theme: 'forcingSequence',
    rating: 1400,
    prompt: 'Win in three moves.',
    moves: P.FORCING_TWO,
    solver: 1,
    answers: [3, 6],
    explanation:
      'Column 4 forces a block on column 5, row 1; column 7 forces a cap on column 7, row 5. In either order, after both blocks column 5, row 2 completes the diagonal, and if they block that the stack in column 7 is still a threat.',
    order: 2,
  },
  {
    slug: 'the-odd-threat',
    title: 'The odd threat',
    difficulty: 'intermediate',
    theme: 'parity',
    rating: 1300,
    prompt: 'Find the move that wins the endgame.',
    moves: P.ODD_THREAT_X,
    solver: 1,
    answers: [6],
    explanation:
      'Column 7. It has five empty squares; you take the first, third and fifth, and they are left with column 1, row 2 — the square beneath your row 3 threat. Playing column 1 yourself only lets them block.',
    order: 3,
  },
  {
    slug: 'follow-up',
    title: 'Follow up',
    difficulty: 'intermediate',
    theme: 'parity',
    rating: 1350,
    prompt: 'You are winning. Find the move that keeps it.',
    moves: [...P.EVEN_THREAT_O, 6],
    solver: 2,
    answers: [6],
    explanation:
      'Answer in column 7. It fills in pairs, they run out of moves first, and they must play column 1, row 3 beneath your even threat. Column 1 yourself would fill that square for them and let them block.',
    order: 4,
  },
  {
    slug: 'three-columns',
    title: 'Three columns',
    difficulty: 'intermediate',
    theme: 'zugzwang',
    rating: 1550,
    prompt: 'Find the move that wins the endgame.',
    moves: P.THREE_COLUMNS,
    solver: 1,
    answers: [3],
    explanation:
      'Column 4 holds three neutral squares and you move first, so you take the last of them. Then they must play beneath your threat or waste their own. Column 7 is poison and column 1 wastes your threat.',
    order: 5,
  },

  // --- Advanced --------------------------------------------------------------------
  {
    slug: 'odd-beats-even',
    title: 'Odd beats even',
    difficulty: 'advanced',
    theme: 'zugzwang',
    rating: 1700,
    prompt: 'Both sides have a threat. Find the winning move.',
    moves: P.MIXED_THREATS,
    solver: 1,
    answers: [6],
    explanation:
      'Column 7, row 2: the neutral square beneath their poison square. They must follow up on row 3, wasting their even threat; you block row 4; column 7 fills in pairs and they are forced into column 1, row 2.',
    order: 1,
  },
  {
    slug: 'lower-threat-wins',
    title: 'The lower threat wins',
    difficulty: 'advanced',
    theme: 'zugzwang',
    rating: 1750,
    prompt: 'Both threats are in column 1. Find the winning move.',
    moves: P.SAME_COLUMN_X_LOWER,
    solver: 1,
    answers: [6],
    explanation:
      'Column 7. Your row 3 threat is beneath their row 4 threat, so column 1 is a column they can never enter. Column 7 has five empty squares; you take the last of them and they must play column 1, row 2.',
    order: 2,
  },
  {
    slug: 'the-only-draw',
    title: 'The only draw',
    difficulty: 'advanced',
    theme: 'zugzwang',
    rating: 1850,
    prompt: 'Find the only move that does not lose.',
    moves: P.BOTH_ODD,
    solver: 1,
    answers: [0],
    explanation:
      'Column 1, wasting your own threat. Column 7, row 2 is poison: their odd threat is on row 3. After column 1 they block, both columns fill in pairs, and the game is drawn.',
    order: 3,
  },
];
