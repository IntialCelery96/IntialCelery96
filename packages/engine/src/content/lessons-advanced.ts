import type { Lesson } from '../curriculum.js';
import * as P from './positions.js';
import {
  ALLEN_2010,
  ALLIS_1988,
  BOCK_2025,
  MIT_SP268,
  POMAKIS,
  PONS_SOLVER,
  TROMP_PLAYGROUND,
  WIKIPEDIA_C4,
} from './sources.js';

/**
 * Tier: Advanced. Courses: Controlling the Zugzwang, Openings and Endgames.
 *
 * The material a player needs to beat Zenith: the complete threat-interaction
 * rules, the nine strategic rules from Allis's thesis, what the solvers say
 * about the opening, and exact endgame counting.
 */

// --- Controlling the Zugzwang ------------------------------------------------

const whoControlsTheZugzwang: Lesson = {
  slug: 'who-controls-the-zugzwang',
  title: 'Who controls the zugzwang',
  summary: 'What happens when both sides have threats: different columns, the same column, and the wrong parity.',
  difficulty: 'advanced',
  course: 'zugzwang',
  order: 1,
  blocks: [
    {
      kind: 'prose',
      text: 'Zugzwang is a chess word for a position where having to move is a disadvantage. In Connect 4 it is not an exception but the normal end of a well-played game: the board fills, and someone is forced to play the square beneath an opponent’s threat. Allis’s phrase is that one side controls the zugzwang. The rules below say who, for each way threats can combine. Every example here was proved by exhaustive search.',
    },
    {
      kind: 'keyIdea',
      text: 'Odd threat for the first player, nothing for the second: first player wins. Even threat for the second player, nothing for the first: second player wins. An even threat for the first player, or an odd threat for the second, wins nothing on its own.',
    },
    {
      kind: 'prose',
      text: 'The interesting cases are when both sides have a threat. First: different columns, the first player’s odd and the second player’s even. The first player wins. The second player’s follow-up gives them every even square, including the one beneath the first player’s threat; the first player’s odd squares include the one beneath the second player’s threat, but the first player is the one who runs out of neutral moves last.',
    },
    {
      kind: 'board',
      caption: 'First player to move. An odd threat on column 1, row 3 against an even threat on column 7, row 4. First player wins with column 7.',
      moves: P.MIXED_THREATS,
      highlight: [15, 16, 17, 24, 25, 26],
    },
    {
      kind: 'tryIt',
      prompt: 'You are the first player. Both sides have a threat. Find the winning move.',
      moves: P.MIXED_THREATS,
      answers: [6],
      explanation: 'Column 7, row 2 — the neutral square beneath their poison square. They must follow up on row 3, which fills the square beneath their own threat; you block row 4, and column 7 fills in pairs until they are forced into column 1, row 2.',
    },
    {
      kind: 'prose',
      text: 'Second: the same column. Then the lower threat wins, because the columns fill from the bottom and the lower square is reached first. Here the first player’s row 3 threat sits beneath the second player’s row 4 threat in column 1, and the first player wins. Swap the heights — second player on row 2, first player on row 3 — and the second player wins instead, whatever the first player does.',
    },
    {
      kind: 'board',
      caption: 'Both threats in column 1, the first player’s on row 3 below the second player’s on row 4. First player to move and winning.',
      moves: P.SAME_COLUMN_X_LOWER,
      highlight: [15, 16, 17, 22, 23, 24],
    },
    {
      kind: 'board',
      caption: 'Both threats in column 1, the second player’s on row 2 below the first player’s on row 3. First player to move and lost.',
      moves: P.SAME_COLUMN_O_LOWER,
      highlight: [8, 9, 10, 15, 16, 17],
    },
    {
      kind: 'prose',
      text: 'Third: two odd threats in different columns. Neither side controls the zugzwang and the result is a draw — but only with care. The first player must not play the neutral square beneath the second player’s threat. In the position below, the only move that holds is to fill the square beneath your own threat and accept that it will be blocked.',
    },
    {
      kind: 'board',
      caption: 'Odd threats for both: the first player’s on column 1, row 3; the second player’s on column 7, row 3. First player to move.',
      moves: P.BOTH_ODD,
      highlight: [15, 16, 17, 26, 32, 38],
    },
    {
      kind: 'tryIt',
      prompt: 'You are the first player. Only one move does not lose. Find it.',
      moves: P.BOTH_ODD,
      answers: [0],
      explanation: 'Column 1. It wastes your own threat, but column 7, row 2 is poison — their odd threat sits on row 3 — and after your column 1 they block, column 1 fills in pairs, and column 7 fills in pairs. Draw.',
    },
    {
      kind: 'keyIdea',
      text: 'Different columns: the first player’s odd threat beats the second player’s even one. Same column: the lower threat wins. Two odd threats, or two even threats, in different columns: a draw with correct play.',
    },
    {
      kind: 'reference',
      sources: [
        { ...ALLIS_1988, note: 'Chapter 3 sets out these cases; the examples here are verified positions, not the thesis’s own.' },
        { ...POMAKIS },
        { ...MIT_SP268 },
      ],
    },
  ],
};

const theNineRules: Lesson = {
  slug: 'the-nine-rules',
  title: 'The nine rules that solved the game',
  summary: 'Claimeven, Baseinverse, Vertical, Aftereven and the rest: how Allis’s program refuted every line, and which rules a human can use.',
  difficulty: 'advanced',
  course: 'zugzwang',
  order: 2,
  blocks: [
    {
      kind: 'prose',
      text: 'Allis’s program VICTOR did not solve the game by searching every position. It solved it with knowledge: nine rules, each a small strategy that guarantees the second player one or more squares, and a way of combining rules to show that every winning line the first player could try was refuted. Each rule was proved correct, and the combination was checked by search only where the rules ran out.',
    },
    {
      kind: 'prose',
      text: 'Four of the nine are things a strong human player uses at the board. Claimeven: when the opponent plays an odd square, take the even square above it. Baseinverse: two directly playable squares — if the opponent takes one, take the other, so they never get both. Vertical: two squares one above the other with the lower one even — if the opponent plays the lower, take the upper, so a line needing both is dead. Aftereven: a line whose remaining squares are all even and all claimable by Claimeven belongs to the second player once the columns fill, and everything above it in those columns comes with it.',
    },
    {
      kind: 'keyIdea',
      text: 'Playing second, you are refuting lines, not building them. A first-player line needing an even square you can claim, or needing both of two squares you can split, is already dead. Count the lines that are dead and the first player’s attack is usually thinner than it looks.',
    },
    {
      kind: 'prose',
      text: 'The other five — Lowinverse, Highinverse, Baseclaim, Before and Specialbefore — handle pairs of columns and combinations of the first four with squares that are directly playable now. They matter for a program that must prove a position drawn, and for a human reading the thesis, but at the board the first four carry almost all the weight.',
    },
    {
      kind: 'prose',
      text: 'The result of applying them is the famous one. Against every first move except the centre, the second player has a strategy built from these rules that draws or wins. Against the centre, no combination of rules works, and the search behind them finds a forced win for the first player by the 41st move. Independently and fifteen days earlier, James Allen reached the same verdict with a search-based program; the two announcements in October 1988 are why the game is described as solved twice.',
    },
    {
      kind: 'prose',
      text: 'Since then the result has been checked exhaustively. Tromp’s solver evaluated every opening; in 2025 a complete win/draw/loss table for all four and a half trillion reachable positions was computed on a single desktop. If you want to know the exact value of any position you reach, an open solver will tell you.',
    },
    {
      kind: 'reference',
      sources: [
        { ...ALLIS_1988, note: 'Chapter 6 defines the nine rules; chapter 7 shows how they combine.' },
        { ...ALLEN_2010 },
        { ...TROMP_PLAYGROUND },
        { ...BOCK_2025 },
        { ...PONS_SOLVER },
      ],
    },
  ],
};

// --- Openings and Endgames ---------------------------------------------------

const whatTheSolversSay: Lesson = {
  slug: 'what-the-solvers-say',
  title: 'What the solvers say about the opening',
  summary: 'The exact value of each first move, and how to use a perfect solver to study your own openings.',
  difficulty: 'advanced',
  course: 'openings-and-endgames',
  order: 1,
  blocks: [
    {
      kind: 'prose',
      text: 'The first move has been evaluated exactly. Column 4 is a first-player win, by the 41st move at the latest. Columns 3 and 5 are draws. Columns 2 and 6 lose for the first player, on the 42nd move; columns 1 and 7 lose on the 40th. The values are symmetric, because the board is.',
    },
    {
      kind: 'tryIt',
      prompt: 'You are the first player. Make the only move that keeps the win.',
      moves: [],
      answers: [3],
      explanation: 'Column 4. Every other first move is a draw or a loss with best play.',
    },
    {
      kind: 'prose',
      text: 'That does not tell you how to win from the centre, and no short lesson can: the win is 41 moves deep and depends on threat parity throughout. What you can do is study the way chess players study openings — with the engine as a reference. Enter the moves of a game you lost into a perfect solver and find the first move at which the value changed. That is the move to study, and often the one to change.',
    },
    {
      kind: 'prose',
      text: 'The second move is where most human games are already decided in practice, not in theory. After a centre opening every reply is a theoretical loss; the practical replies are column 4, stacking on the centre, and columns 3 and 5. Against any other reply the first player is winning fast, because an early edge disc is a disc on three winning lines instead of seven or more.',
    },
    {
      kind: 'tryIt',
      prompt: 'Your opponent, playing first, opened on the edge. What is the principled reply?',
      moves: [6],
      answers: [3],
      explanation: 'Column 4. Their edge opening is a theoretical loss for them; the centre is where the lines that punish it run through. Confirm it in a solver: the exact value is one lookup away.',
    },
    {
      kind: 'keyIdea',
      text: 'Use the solver the way it is meant to be used: after the game, to find the move where the value changed. Memorising lines is less useful here than in chess, because the parity themes recur in every game and the solver will show you which one you missed.',
    },
    {
      kind: 'reference',
      sources: [
        { ...WIKIPEDIA_C4 },
        { ...TROMP_PLAYGROUND, note: 'The exact per-column values and the move counts.' },
        { ...PONS_SOLVER, note: 'The online solver: paste a move sequence and read the value of every reply.' },
        { ...BOCK_2025 },
      ],
    },
  ],
};

const playingSecond: Lesson = {
  slug: 'playing-second',
  title: 'Playing second',
  summary: 'In theory you are lost against a centre opening. In practice you are not, if you know what to aim for.',
  difficulty: 'advanced',
  course: 'openings-and-endgames',
  order: 2,
  blocks: [
    {
      kind: 'prose',
      text: 'The solved result says the second player loses against perfect play from the centre. Nobody plays perfectly, and the win is 41 moves deep, so the practical question is how to make the first player prove it. The answer is the theme of the whole Intermediate tier turned into a plan.',
    },
    {
      kind: 'prose',
      text: 'Aim for even threats. A single even threat, with nothing for the first player, is a win; and it is a win that needs no further calculation, because follow-up does the rest. Everything you build should point at a square on row 2, 4 or 6.',
    },
    {
      kind: 'prose',
      text: 'Deny odd threats. A first-player threat on row 3 or row 5 beats your even threat unless yours is lower in the same column. Every time the first player gets three in a line aimed at an odd square, ask whether the square can be taken now or the line broken; a first player with no odd threat and no double threat has nothing.',
    },
    {
      kind: 'prose',
      text: 'Follow up by default. When you have no reason to do otherwise, answer in the column they played. It keeps the even squares yours, it keeps the columns filling in pairs, and it means that when the squeeze comes it lands on them.',
    },
    {
      kind: 'board',
      caption: 'The reward. An even threat on column 1, row 4 and nothing for the first player: the second player wins whatever the first player does.',
      moves: P.EVEN_THREAT_O,
      highlight: [22, 23, 24],
    },
    {
      kind: 'keyIdea',
      text: 'Playing second: build toward even rows, break every odd line, and follow up unless you have a reason not to. One even threat with the first player’s odd lines all dead is a won game.',
    },
    {
      kind: 'prose',
      text: 'And when you are the first player, invert every sentence above. Build toward odd rows, break every even line while it is still a two, and remember that follow-up is not available to you — which is why you need the odd threat, and why the centre matters: it is the column that reaches row 3 and row 5 in the most lines.',
    },
    {
      kind: 'reference',
      sources: [
        { ...ALLIS_1988, note: 'Chapter 3: what each side needs, and why the second player defends with follow-up.' },
        { ...POMAKIS },
      ],
    },
  ],
};

const endgameCounting: Lesson = {
  slug: 'endgame-counting',
  title: 'Endgame counting',
  summary: 'Reading a multi-column endgame to the end: safe squares, wasted squares, and who takes the last neutral one.',
  difficulty: 'advanced',
  course: 'openings-and-endgames',
  order: 3,
  blocks: [
    {
      kind: 'prose',
      text: 'The parity rules give a verdict. Counting is how you play the verdict out without a slip when there are several open columns. The method: for each open column, classify every empty square from the bottom up. Poison for one side (beneath an opponent threat), wasted for one side (beneath your own threat, or above a square that will be a block), or neutral. Then count the neutral squares and remember who moves.',
    },
    {
      kind: 'board',
      caption: 'The three-column endgame from the Intermediate tier. First player to move; column 4 holds three neutral squares.',
      moves: P.THREE_COLUMNS,
      highlight: [15, 16, 17, 3, 11, 19],
    },
    {
      kind: 'prose',
      text: 'Column 1, from the bottom: row 2 is poison for the second player and wasted for the first; rows 3 to 6 above it are decided by who plays row 2. Column 7: row 3 is poison for the first player and wasted for the second; if the second player plays it, row 4 is a block for the first player and rows 5 and 6 are neutral. Column 4: rows 4, 5 and 6, all neutral.',
    },
    {
      kind: 'prose',
      text: 'Three neutral squares, first player to move: the first player takes the first and the third. After that the second player must choose between the poison square and wasting their threat. Wasting it turns column 7 into a block on row 4 and two neutral squares on rows 5 and 6 — the second player takes row 5, the first player row 6, and the second player is back to the poison square. Every branch ends the same way.',
    },
    {
      kind: 'tryIt',
      prompt: 'You are the first player. Play the endgame correctly.',
      moves: P.THREE_COLUMNS,
      answers: [3],
      explanation: 'Column 4. The neutral count is odd and you are on move, so you will take the last neutral square. Column 7 is poison; column 1 throws away the threat that makes the count matter.',
    },
    {
      kind: 'prose',
      text: 'Two habits make this reliable under a clock. Count the neutral squares before you touch a disc, not after. And when the count is against you, look for a move that changes it: a threat that forces a block turns a neutral square into a forced one, and a wasted square deliberately spent can flip the parity of a column. The players who win these endgames are not calculating faster; they are counting first.',
    },
    {
      kind: 'keyIdea',
      text: 'Classify every empty square, count the neutral ones, and check who moves. Odd count, you to move: you win the squeeze. Even count: find the forcing move that changes it, or the draw.',
    },
    {
      kind: 'reference',
      sources: [
        { ...ALLIS_1988 },
        { ...ALLEN_2010, note: 'Worked endgame puzzles of exactly this kind.' },
      ],
    },
  ],
};

export const LESSONS_ADVANCED: readonly Lesson[] = [
  whoControlsTheZugzwang,
  theNineRules,
  whatTheSolversSay,
  playingSecond,
  endgameCounting,
];
