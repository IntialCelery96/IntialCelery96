import type { Lesson } from '../curriculum.js';
import * as P from './positions.js';
import {
  ALLEN_2010,
  ALLIS_1988,
  CHASE_SIMON_1973,
  PONS_SOLVER,
  TROMP_PLAYGROUND,
  WIKIPEDIA_C4,
} from './sources.js';

/**
 * Tier: Beginner. Courses: Board Sense, First Tactics.
 *
 * For a player who knows the rules and blocks threats, but loses to shapes
 * they did not see coming. Ends with the double threat and the 7 trap: the
 * first winning techniques, and the first ones to defend against.
 */

// --- Board Sense -------------------------------------------------------------

const centerColumnControl: Lesson = {
  slug: 'center-column-control',
  title: 'Centre column control',
  summary: 'Why the middle column is worth more than any other, and what it costs you to give it away.',
  difficulty: 'beginner',
  course: 'board-sense',
  order: 1,
  blocks: [
    {
      kind: 'prose',
      text: 'There are 69 places on the board where a four can sit: 24 across, 21 up, and 24 on the diagonals. They are not spread evenly. A square in a corner is part of only 3 of them. A square in the middle of the centre column is part of 13.',
    },
    {
      kind: 'prose',
      text: 'Add them up by column and the picture is stark. The centre column’s six squares belong to 60 winning lines between them; the columns beside it to 48 each; the next pair to 36; and the edges to 24. A disc in the centre is doing two and a half times the work of a disc on the edge.',
    },
    {
      kind: 'keyIdea',
      text: 'With perfect play the first player wins, but only by opening in the centre column. Columns 3 and 5 only draw, and the four outer columns lose. That is not folklore: the game was solved in 1988 and the result has been checked exhaustively since.',
    },
    {
      kind: 'board',
      caption: 'The strongest opening move there is: straight down the middle.',
      moves: [3],
      highlight: [3],
    },
    {
      kind: 'prose',
      text: 'The reply matters just as much. If your opponent opens in the centre and you answer on the edge, you have conceded the most valuable real estate on the board for almost nothing in return.',
    },
    {
      kind: 'board',
      caption: 'The first player owns the centre; the second has taken an edge and is already worse.',
      moves: [3, 0, 3],
      highlight: [3, 10],
    },
    {
      kind: 'tryIt',
      prompt: 'Your opponent opened in the centre. Where do you play?',
      moves: [3],
      answers: [3, 2, 4],
      explanation: 'On or next to the centre. Stacking on column 4 denies them the second centre square; columns 3 and 5 keep you in the fight for the middle. An edge move hands them a free advantage.',
    },
    {
      kind: 'prose',
      text: 'This is the first habit to build: when you have nothing better to do, play toward the middle. It is rarely the losing move, and it keeps the most winning lines available to you.',
    },
    {
      kind: 'reference',
      sources: [
        { ...ALLIS_1988, note: 'The first proof that the first player wins from the centre.' },
        { ...WIKIPEDIA_C4 },
        { ...TROMP_PLAYGROUND, note: 'The 69 lines, and the exhaustive per-opening results.' },
        { ...PONS_SOLVER, note: 'Type any position into the online solver to see its exact value.' },
      ],
    },
  ],
};

const readingTheBoard: Lesson = {
  slug: 'reading-the-board',
  title: 'Reading the whole board',
  summary: 'A scanning routine that catches the threats beginners miss — above all, the diagonals.',
  difficulty: 'beginner',
  course: 'board-sense',
  order: 2,
  blocks: [
    {
      kind: 'prose',
      text: 'Every disc your opponent drops sits on up to four lines: its row, its column, and its two diagonals. When they move, look along those four lines from the new disc, in both directions. That is the whole routine, and it takes about three seconds.',
    },
    {
      kind: 'prose',
      text: 'The line that gets missed is the diagonal. Rows and columns are easy to see because the board is drawn with them. Diagonals cut across the grid, and a three on a diagonal can look like three unrelated discs.',
    },
    {
      kind: 'board',
      caption: 'The second player’s last disc landed on column 4, row 3. Look down and to the left from it.',
      moves: P.HIDDEN_DIAGONAL,
      highlight: [1, 9, 17],
    },
    {
      kind: 'tryIt',
      prompt: 'You are the first player. Their last move made a threat. Find it and block it.',
      moves: P.HIDDEN_DIAGONAL,
      answers: [4],
      explanation: 'Column 5. The diagonal from column 2, row 1 up to column 4, row 3 continues to column 5, row 4 — and column 5 has three discs in it, so that square is playable.',
    },
    {
      kind: 'keyIdea',
      text: 'After every opponent move, trace the four lines through their new disc. Diagonals first, because those are the ones you will miss.',
    },
    {
      kind: 'prose',
      text: 'Strong players do not do this consciously. Research on chess masters found that they see the board as familiar shapes rather than as individual pieces, and a diagonal three is one of those shapes for a strong Connect 4 player. The way to get there is repetition: the puzzles tagged “Block the four” are the drill.',
    },
    {
      kind: 'reference',
      sources: [
        { ...CHASE_SIMON_1973 },
      ],
    },
  ],
};

const verticalThreats: Lesson = {
  slug: 'vertical-threats',
  title: 'Stacks: the easiest win and the easiest miss',
  summary: 'A vertical three is always playable, so it must be answered at once — and it can be used to force a move.',
  difficulty: 'beginner',
  course: 'board-sense',
  order: 3,
  blocks: [
    {
      kind: 'prose',
      text: 'Most threats depend on the squares beneath them filling up. A vertical three does not: its fourth square is on top of the stack, and the stack is what makes it playable. So a stack of three is always an immediate threat, and it has to be capped on the very next move.',
    },
    {
      kind: 'board',
      caption: 'Three stacked in the centre. The second player has one move.',
      moves: [3, 0, 3, 1, 3],
      highlight: [3, 10, 17],
    },
    {
      kind: 'tryIt',
      prompt: 'You are the second player. Stop the stack.',
      moves: [3, 0, 3, 1, 3],
      answers: [3],
      explanation: 'Column 4, on top. Anywhere else and they complete the column.',
    },
    {
      kind: 'prose',
      text: 'Once capped, the stack is dead: a four can no longer pass through it vertically. But notice what the cap gave the blocker — a disc on row 4. Which row a disc lands on turns out to matter a great deal later, so a forced cap is not entirely free for either side.',
    },
    {
      kind: 'board',
      caption: 'Capped. The centre column is finished as a vertical line, and the second player now has a disc on row 4.',
      moves: [3, 0, 3, 1, 3, 3],
      highlight: [24],
    },
    {
      kind: 'prose',
      text: 'The other way round: building a stack of three is a way to force your opponent’s next move. They must cap it. If the cap lands them on a square you wanted them to fill — or keeps them busy while you set something up elsewhere — the stack has done its job even though it never became a four.',
    },
    {
      kind: 'keyIdea',
      text: 'A stack of three is always an immediate threat. Cap it on the spot; build one when you need your opponent to play where you say.',
    },
    {
      kind: 'reference',
      sources: [
        { ...ALLIS_1988, note: 'Vertical threats, and why the row a forced cap lands on matters for the parity of the column.' },
      ],
    },
  ],
};

const neverPlayUnder: Lesson = {
  slug: 'never-play-under',
  title: 'Never give them the square',
  summary: 'The square beneath an opponent’s winning square is poison. Learn to see it, and to leave it alone.',
  difficulty: 'beginner',
  course: 'board-sense',
  order: 4,
  blocks: [
    {
      kind: 'prose',
      text: 'A three whose fourth square is floating cannot be played yet. It becomes playable the moment someone fills the square directly beneath it. If that someone is you, your opponent wins on the next move. So that lower square is poison, and the first job on every move is to know where the poison is.',
    },
    {
      kind: 'board',
      caption: 'The second player has three on row 2. The winning square is column 4, row 2. Column 4, row 1 is poison for the first player.',
      moves: P.FLOATING_THREAT,
      highlight: [7, 8, 9],
    },
    {
      kind: 'tryIt',
      prompt: 'You are the first player. Column 4 is the centre and looks natural. Play a safe move.',
      moves: P.FLOATING_THREAT,
      answers: [1, 2, 4, 5, 6],
      explanation: 'Columns 2, 3, 5, 6 or 7. Column 4 lands on row 1 and their reply on row 2 makes four across. Column 1 also loses, more slowly: they answer column 2 and build a second threat you cannot stop. Poison squares are not the only danger, but they are the one you can always see.',
    },
    {
      kind: 'prose',
      text: 'Poison squares do not go away. As the rest of the board fills, the columns you are allowed to play run out, and eventually someone is forced to play a poison square because it is the only move left. Who that is depends on which rows the threats are on, and that is the whole of the Intermediate tier. For now, the rule is simpler.',
    },
    {
      kind: 'keyIdea',
      text: 'Before you drop a disc, look at the square above where it will land. If your opponent could win there, play somewhere else. Track every poison square and avoid them for as long as you can.',
    },
    {
      kind: 'prose',
      text: 'It cuts the other way too. If you have a floating threat, the square beneath it is poison for your opponent, and every column you can safely play while they cannot is a move in the bank. That asymmetry decides most games between good players.',
    },
    {
      kind: 'reference',
      sources: [
        { ...ALLIS_1988, note: 'The idea that a threat controls the square beneath it, and that the game is decided by who runs out of safe squares.' },
      ],
    },
  ],
};

// --- First Tactics -----------------------------------------------------------

const theDoubleThreat: Lesson = {
  slug: 'the-double-threat',
  title: 'Two threats, one block',
  summary: 'Creating two winning squares at once, so your opponent can only stop one of them.',
  difficulty: 'beginner',
  course: 'first-tactics',
  order: 1,
  blocks: [
    {
      kind: 'prose',
      text: 'A single threat is blocked. Two threats at once cannot be: your opponent has one move, and you have two winning squares. This is the first real winning technique in the game, and almost every won game ends with one.',
    },
    {
      kind: 'board',
      caption: 'Three across with both ends open. Columns 1 and 5 both win for the first player, and the second player can only take one.',
      moves: P.OPEN_THREE,
      highlight: [1, 2, 3],
    },
    {
      kind: 'prose',
      text: 'The open-ended three on the bottom row is the simplest double threat, and the reason experienced players never let an opponent get two adjacent discs on row 1 with space on both sides. But the same idea works with any two lines that end on two different playable squares.',
    },
    {
      kind: 'tryIt',
      prompt: 'You are the first player with two discs on the bottom row. Make a three that cannot be blocked.',
      moves: P.MAKE_OPEN_THREE,
      answers: [1, 4],
      explanation: 'Column 2 or column 5. Either makes three across with an empty, playable square at each end.',
    },
    {
      kind: 'board',
      caption: 'Two lines about to cross. Column 4 would complete a three across row 2 and a three on the falling diagonal at the same time.',
      moves: P.CROSSING_LINES,
      highlight: [8, 9, 16, 4],
    },
    {
      kind: 'tryIt',
      prompt: 'You are the first player. Find the move that makes two threats at once.',
      moves: P.CROSSING_LINES,
      answers: [3],
      explanation: 'Column 4. It threatens column 5 on row 2 (across) and column 2 on row 4 (the diagonal down to column 5, row 1). Both are playable, so one of them will be a four.',
    },
    {
      kind: 'keyIdea',
      text: 'Look for the square that sits on two of your lines at once. Defensively, break open-ended threes before they exist: take an end while it is still a two.',
    },
    {
      kind: 'reference',
      sources: [
        { ...ALLEN_2010, note: 'Practical winning shapes, including the open three and crossing lines.' },
      ],
    },
  ],
};

const theSevenTrap: Lesson = {
  slug: 'the-seven-trap',
  title: 'The 7 trap',
  summary: 'The classic beginner-killer: a horizontal threat with a diagonal threat directly above it.',
  difficulty: 'beginner',
  course: 'first-tactics',
  order: 2,
  blocks: [
    {
      kind: 'prose',
      text: 'The most famous shape in the game is named for what it looks like: a bar of three across, with a diagonal stem hanging down from one end. It is a double threat in disguise, because the two winning squares sit one on top of the other in the same column.',
    },
    {
      kind: 'board',
      caption: 'The 7. The bar is row 3, columns 3 to 5; the stem runs from column 4, row 2 down to column 3, row 1. The threats are column 6, row 3 (across) and column 6, row 4 (the diagonal).',
      moves: P.SEVEN_AFTER,
      highlight: [16, 17, 18, 10, 2],
    },
    {
      kind: 'prose',
      text: 'Column 6 has three discs in it, so row 3 is playable and the first player threatens to win there at once. The second player must block it — and the block fills the square directly beneath the diagonal’s fourth square. The first player then plays column 6 again and wins on row 4.',
    },
    {
      kind: 'tryIt',
      prompt: 'You are the first player, one move away from the shape. Complete the 7.',
      moves: P.SEVEN_BEFORE,
      answers: [4],
      explanation: 'Column 5, row 3. It finishes the bar and the diagonal in one move. They must block column 6 on row 3; you win on column 6, row 4.',
    },
    {
      kind: 'prose',
      text: 'The general principle is stacked threats. Two of your winning squares in the same column, one directly above the other, is a forced win the moment the lower one becomes playable: the block of the lower square is what makes the upper one reachable. The 7 is just the most common way to arrange it.',
    },
    {
      kind: 'prose',
      text: 'Defending against it means acting before the shape exists. A move earlier, the second player can see the stem and two-thirds of the bar. The cleanest answer is to take the key square yourself.',
    },
    {
      kind: 'tryIt',
      prompt: 'You are the second player. They are one move from a 7 trap. Stop it.',
      moves: P.SEVEN_DEFENCE,
      answers: [4, 5],
      explanation: 'Column 5 takes the square that would complete the bar and the diagonal at once, which is the cleanest defence. Column 6 also holds, by making the bar’s end square yours before it matters.',
    },
    {
      kind: 'keyIdea',
      text: 'Two of your winning squares stacked in one column is a forced win. When you see an opponent’s three-across taking shape with a diagonal running into one end, break it now, not next move.',
    },
    {
      kind: 'reference',
      sources: [
        { ...ALLEN_2010, note: 'The 7 and its relatives as named shapes; the name is folk usage, the mechanism is stacked threats.' },
        { ...ALLIS_1988, note: 'Threats that share a column, and why the lower one’s block hands over the upper one.' },
      ],
    },
  ],
};

const yourFirstMoves: Lesson = {
  slug: 'your-first-moves',
  title: 'Your first moves',
  summary: 'A simple opening plan for both sides, and the solved-game facts that justify it.',
  difficulty: 'beginner',
  course: 'first-tactics',
  order: 3,
  blocks: [
    {
      kind: 'prose',
      text: 'You do not need an opening repertoire to play well at this level. You need three habits: take the centre when you can, stay low and near the middle while the board is empty, and never open on an edge.',
    },
    {
      kind: 'prose',
      text: 'The reason is the solved result. Playing first and opening in column 4, you are winning with perfect play. Opening in column 3 or 5, the game is a draw. Opening in columns 1, 2, 6 or 7, you are losing — the edge columns lose fastest. Nobody plays perfectly, but there is no reason to start a game already behind.',
    },
    {
      kind: 'tryIt',
      prompt: 'You are the first player and the board is empty. Where do you begin?',
      moves: [],
      answers: [3],
      explanation: 'Column 4. It is on more winning lines than any other square, and it is the only first move that keeps the theoretical win.',
    },
    {
      kind: 'tryIt',
      prompt: 'Your opponent opened on the edge, column 1. Punish it.',
      moves: [0],
      answers: [3],
      explanation: 'Take the centre. Their disc sits on three winning lines; yours sits on seven, and it is the square every early line runs through.',
    },
    {
      kind: 'prose',
      text: 'Playing second against a centre opening, the standard reply is to stack on it. That keeps the second centre square out of their hands and starts building your own presence in the middle. Columns 3 and 5 are reasonable too. What you must not do is spend your first few moves on the edges while they build in the centre.',
    },
    {
      kind: 'keyIdea',
      text: 'Centre first, then next to it, then above it. Keep your early discs within one column of the middle and on the bottom two rows, and let your opponent be the one who wanders to the edge.',
    },
    {
      kind: 'prose',
      text: 'There is real opening theory beyond this — the Advanced tier covers what the solvers say about each reply — but it will not win you games until the tactics from this course are automatic. Habits first, theory later.',
    },
    {
      kind: 'reference',
      sources: [
        { ...WIKIPEDIA_C4 },
        { ...TROMP_PLAYGROUND },
        { ...PONS_SOLVER },
      ],
    },
  ],
};

export const LESSONS_BEGINNER: readonly Lesson[] = [
  centerColumnControl,
  readingTheBoard,
  verticalThreats,
  neverPlayUnder,
  theDoubleThreat,
  theSevenTrap,
  yourFirstMoves,
];
