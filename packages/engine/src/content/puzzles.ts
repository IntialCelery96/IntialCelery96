import type { Puzzle } from '../curriculum.js';
import * as P from './positions.js';

/**
 * The puzzle set. Every puzzle belongs to a lesson and sits at its end; within
 * a lesson puzzles unlock in `order`, and solving all of them unlocks the next
 * lesson (`progress.ts`). Every lesson has at least one.
 *
 * Every answer here is proved by `tests/content.test.ts`: win-in-one puzzles
 * must list exactly the winning columns, forcing puzzles exactly the moves
 * that force a win within the stated horizon, and endgame puzzles exactly the
 * moves that hold the exhaustively-solved value. The two opening puzzles are
 * the exception — a full-game solve is out of scope for a test suite — and
 * rest on the published result instead; the test pins them to the centre.
 *
 * Ratings are hand-set on the player scale (a new account starts at 1200).
 * They are the starting point for a puzzle rating that floats with solve
 * rates, the way chess sites rate puzzles as if they were opponents.
 */

const WIN = 'Find the winning move.';
const STOP = 'Find the move that stops the four.';

export const PUZZLES: readonly Puzzle[] = [
  // --- New to the game: First Steps ---------------------------------------------
  {
    slug: 'find-the-win',
    title: 'Find the win',
    difficulty: 'new',
    lesson: 'how-the-game-is-won',
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
    lesson: 'how-the-game-is-won',
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
    lesson: 'how-the-game-is-won',
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
    lesson: 'threats-and-blocks',
    theme: 'block',
    rating: 450,
    prompt: STOP,
    moves: [3, 0, 3, 1, 3],
    solver: 2,
    answers: [3],
    explanation: 'Column 4, on top of the stack. A vertical three is always playable, so it always has to be capped at once.',
    order: 1,
  },
  {
    slug: 'stop-the-row',
    title: 'Stop the row',
    difficulty: 'new',
    lesson: 'threats-and-blocks',
    theme: 'block',
    rating: 500,
    prompt: STOP,
    moves: P.BLOCK_THE_ROW,
    solver: 1,
    answers: [3],
    explanation: 'Column 4 is the only square that completes their row, and it is playable, so it is the only move.',
    order: 2,
  },
  {
    slug: 'win-dont-block',
    title: 'Win, don’t block',
    difficulty: 'new',
    lesson: 'win-before-you-block',
    theme: 'winInOne',
    rating: 700,
    prompt: 'They threaten to win. Find the best move anyway.',
    moves: P.WIN_BEFORE_BLOCK,
    solver: 1,
    answers: [4],
    explanation:
      'Column 5 completes your stack. Their row is a threat only if you give them another move; you do not.',
    order: 1,
  },
  {
    slug: 'no-win-so-block',
    title: 'No win, so block',
    difficulty: 'new',
    lesson: 'win-before-you-block',
    theme: 'block',
    rating: 600,
    prompt: 'Run the two questions. Then move.',
    moves: P.JUST_BLOCK,
    solver: 1,
    answers: [3],
    explanation:
      'Question one: no four for you. Question two: yes, column 4 completes their row. So column 4 is the move, and nothing else is.',
    order: 2,
  },

  // --- Beginner: Board Sense ------------------------------------------------------
  {
    slug: 'centre-of-everything',
    title: 'Centre of everything',
    difficulty: 'beginner',
    lesson: 'center-column-control',
    theme: 'doubleThreat',
    rating: 950,
    prompt: 'One square is on two of your lines. Find it.',
    moves: P.CENTRE_DOUBLE,
    solver: 1,
    answers: [3],
    explanation:
      'Column 4, row 1. It makes three across with column 1 open, and three on the rising diagonal to column 7, row 4, which is playable. Two winning squares; they can block one.',
    order: 1,
  },
  {
    slug: 'the-hidden-diagonal',
    title: 'The hidden diagonal',
    difficulty: 'beginner',
    lesson: 'reading-the-board',
    theme: 'block',
    rating: 800,
    prompt: 'Their last move made a threat. Find the move that stops it.',
    moves: P.HIDDEN_DIAGONAL,
    solver: 1,
    answers: [4],
    explanation:
      'Column 5. The diagonal from column 2, row 1 through column 3, row 2 and column 4, row 3 ends on column 5, row 4, and column 5 already has three discs in it.',
    order: 1,
  },
  {
    slug: 'three-high',
    title: 'Three high',
    difficulty: 'beginner',
    lesson: 'vertical-threats',
    theme: 'block',
    rating: 800,
    prompt: STOP,
    moves: P.CAP_IN_TRAFFIC,
    solver: 2,
    answers: [2],
    explanation:
      'Column 3, on top of the stack. Everything else on the board can wait; a stack of three cannot.',
    order: 1,
  },
  {
    slug: 'poison-square',
    title: 'The poison square',
    difficulty: 'beginner',
    lesson: 'never-play-under',
    theme: 'safeSquare',
    rating: 900,
    prompt: 'Column 4 is the centre and looks natural. Find a safe move.',
    moves: P.FLOATING_THREAT,
    solver: 1,
    answers: [1, 2, 4, 5, 6],
    explanation:
      'Columns 2, 3, 5, 6 or 7. Column 4 fills the square beneath their row 2 threat and loses at once. Column 1 loses too, a few moves later: they answer column 2 and build a second line you cannot hold.',
    order: 1,
  },

  // --- Beginner: First Tactics ----------------------------------------------------
  {
    slug: 'open-ended',
    title: 'Open-ended',
    difficulty: 'beginner',
    lesson: 'the-double-threat',
    theme: 'doubleThreat',
    rating: 850,
    prompt: 'Make a threat that cannot be blocked.',
    moves: P.MAKE_OPEN_THREE,
    solver: 1,
    answers: [1, 4],
    explanation:
      'Column 2 or column 5 makes three across with a playable empty square at each end. They can block one end; you win at the other.',
    order: 1,
  },
  {
    slug: 'two-lines-cross',
    title: 'Two lines cross',
    difficulty: 'beginner',
    lesson: 'the-double-threat',
    theme: 'doubleThreat',
    rating: 1000,
    prompt: 'Find the move that makes two threats at once.',
    moves: P.CROSSING_LINES,
    solver: 1,
    answers: [3],
    explanation:
      'Column 4 completes three across on row 2 (threatening column 5) and three on the falling diagonal (threatening column 2, row 4). Both squares are playable.',
    order: 2,
  },
  {
    slug: 'spring-the-seven',
    title: 'Spring the 7',
    difficulty: 'beginner',
    lesson: 'the-seven-trap',
    theme: 'sevenTrap',
    rating: 1050,
    prompt: 'Complete the trap.',
    moves: P.SEVEN_BEFORE,
    solver: 1,
    answers: [4],
    explanation:
      'Column 5 finishes the bar on row 3 and the diagonal from column 3, row 1. The threats are column 6, row 3 and column 6, row 4, stacked: whichever they block, the other wins.',
    order: 1,
  },
  {
    slug: 'break-the-seven',
    title: 'Break the 7',
    difficulty: 'beginner',
    lesson: 'the-seven-trap',
    theme: 'sevenTrap',
    rating: 1100,
    prompt: 'They are one move from a 7 trap. Find a move that stops it.',
    moves: P.SEVEN_DEFENCE,
    solver: 2,
    answers: [4, 5],
    explanation:
      'Column 5 takes the square that would complete both the bar and the diagonal — the cleanest defence. Column 6 also holds, by making the end of the bar yours before it becomes a threat.',
    order: 2,
  },
  {
    slug: 'the-first-move',
    title: 'The first move',
    difficulty: 'beginner',
    lesson: 'your-first-moves',
    theme: 'opening',
    rating: 800,
    prompt: 'The board is empty and you are first. Make the only move that keeps the win.',
    moves: [],
    solver: 1,
    answers: [3],
    explanation:
      'Column 4. With perfect play it wins by the 41st move; columns 3 and 5 only draw, and the outer four columns lose. The result is Allis’s and Allen’s from 1988, and the online solver will confirm it.',
    order: 1,
  },

  // --- Intermediate: Threat Theory -----------------------------------------------
  {
    slug: 'the-odd-threat',
    title: 'The odd threat',
    difficulty: 'intermediate',
    lesson: 'odd-and-even-threats',
    theme: 'parity',
    rating: 1300,
    prompt: 'Find the move that wins the endgame.',
    moves: P.ODD_THREAT_X,
    solver: 1,
    answers: [6],
    explanation:
      'Column 7. It has five empty squares; you take the first, third and fifth, and they are left with column 1, row 2 — the square beneath your row 3 threat. Playing column 1 yourself only lets them block.',
    order: 1,
  },
  {
    slug: 'follow-up',
    title: 'Follow up',
    difficulty: 'intermediate',
    lesson: 'follow-up',
    theme: 'parity',
    rating: 1350,
    prompt: 'You are winning. Find the move that keeps it.',
    moves: [...P.EVEN_THREAT_O, 6],
    solver: 2,
    answers: [6],
    explanation:
      'Answer in column 7. It fills in pairs, they run out of moves first, and they must play column 1, row 3 beneath your even threat. Column 1 yourself would fill that square for them and let them block.',
    order: 1,
  },
  {
    slug: 'three-columns',
    title: 'Three columns',
    difficulty: 'intermediate',
    lesson: 'counting-parity',
    theme: 'zugzwang',
    rating: 1550,
    prompt: 'Find the move that wins the endgame.',
    moves: P.THREE_COLUMNS,
    solver: 1,
    answers: [3],
    explanation:
      'Column 4 holds three neutral squares and you move first, so you take the last of them. Then they must play beneath your threat or waste their own. Column 7 is poison and column 1 wastes your threat.',
    order: 1,
  },

  // --- Intermediate: Calculation -------------------------------------------------
  {
    slug: 'force-the-block',
    title: 'Force the block',
    difficulty: 'intermediate',
    lesson: 'forcing-sequences',
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
    lesson: 'forcing-sequences',
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
    slug: 'only-one-survives',
    title: 'Only one survives',
    difficulty: 'intermediate',
    lesson: 'a-thinking-routine',
    theme: 'safeSquare',
    rating: 1450,
    prompt: 'Nothing is threatened yet. Six of your seven moves lose by force. Find the seventh.',
    moves: P.ONLY_ONE_SAFE,
    solver: 1,
    answers: [6],
    explanation:
      'Column 7. Every other column either fills the square beneath one of their lines or lets them build a threat you cannot answer in time. Step 4 of the routine — look at the square above — rules out five of them; step 5 rules out the sixth.',
    order: 1,
  },

  // --- Advanced: Controlling the Zugzwang -----------------------------------------
  {
    slug: 'odd-beats-even',
    title: 'Odd beats even',
    difficulty: 'advanced',
    lesson: 'who-controls-the-zugzwang',
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
    lesson: 'who-controls-the-zugzwang',
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
    lesson: 'who-controls-the-zugzwang',
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
  {
    slug: 'claimeven',
    title: 'Claimeven',
    difficulty: 'advanced',
    lesson: 'the-nine-rules',
    theme: 'parity',
    rating: 1750,
    prompt: 'They just played the bottom of column 1. Apply the rule.',
    moves: P.CLAIMEVEN,
    solver: 2,
    answers: [0],
    explanation:
      'Claim the even square: column 1, row 2, directly above their disc. Column 1 then fills in pairs with you on every even square, they run out first, and they are forced into column 7, row 3 beneath your even threat. Playing column 7 yourself instead throws the win away for a draw.',
    order: 1,
  },

  // --- Advanced: Openings and Endgames --------------------------------------------
  {
    slug: 'punish-the-edge',
    title: 'Punish the edge',
    difficulty: 'advanced',
    lesson: 'what-the-solvers-say',
    theme: 'opening',
    rating: 1700,
    prompt: 'They opened on the edge. Find the principled reply.',
    moves: [0],
    solver: 2,
    answers: [3],
    explanation:
      'Column 4. An edge opening is a theoretical loss for the first player, and the centre is where the lines that punish it run through. Paste the position into the online solver to see the exact value of every reply.',
    order: 1,
  },
  {
    slug: 'hold-the-even-square',
    title: 'Hold the even square',
    difficulty: 'advanced',
    lesson: 'playing-second',
    theme: 'zugzwang',
    rating: 1800,
    prompt: 'You are second, and both sides have an even threat. Find the winning move.',
    moves: P.PLAYING_SECOND,
    solver: 2,
    answers: [6],
    explanation:
      'Column 7, row 2 — the square beneath their poison square, not yours. Their even threat is the wrong parity for the first player; yours is not. Column 7 fills with you on the even squares, and they end up forced into column 1, row 3. Column 1 yourself would waste your threat for a draw.',
    order: 1,
  },
  {
    slug: 'the-last-neutral-square',
    title: 'The last neutral square',
    difficulty: 'advanced',
    lesson: 'endgame-counting',
    theme: 'zugzwang',
    rating: 1900,
    prompt: 'You are second. Both sides have an odd threat. Find the only move that holds.',
    moves: P.COUNTING_ONE_NEUTRAL,
    solver: 2,
    answers: [2],
    explanation:
      'Column 3, the one neutral square. Column 1, row 2 is poison, and column 7, row 2 is the square beneath your own threat, which wastes it while their threat still stands. Take the neutral square and the count comes out level: both columns fill in pairs and the game is drawn.',
    order: 1,
  },
];

export const PUZZLES_BY_SLUG: Record<string, Puzzle> = Object.fromEntries(
  PUZZLES.map((puzzle) => [puzzle.slug, puzzle]),
);
