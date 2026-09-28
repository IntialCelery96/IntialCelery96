import type { Lesson } from '../curriculum.js';
import * as P from './positions.js';
import { ALLIS_1988, HEISMAN_2010, KOTOV_1971, MIT_SP268, POMAKIS } from './sources.js';

/**
 * Tier: Intermediate. Courses: Threat Theory, Calculation.
 *
 * The heart of the game. Every endgame diagram in this tier was proved by
 * exhaustive search, so the claims are exact for the positions shown.
 */

// --- Threat Theory -----------------------------------------------------------

const oddAndEvenThreats: Lesson = {
  slug: 'odd-and-even-threats',
  title: 'Odd and even threats',
  summary: 'Why the first player wants threats on odd rows and the second on even rows, and how a single threat decides a game long before it is played.',
  difficulty: 'intermediate',
  course: 'threat-theory',
  order: 1,
  blocks: [
    {
      kind: 'prose',
      text: 'Number the rows 1 to 6 from the bottom. A threat on row 1, 3 or 5 is an odd threat; on row 2, 4 or 6 it is an even threat. The rule that Victor Allis built his 1988 solution on is this: odd threats are good for the first player, even threats are good for the second, and the wrong parity is close to worthless.',
    },
    {
      kind: 'prose',
      text: 'The reason is what happens when the board fills up. Late in a game the only columns left are the ones holding threats, and nobody wants to be the one who fills the square beneath an opponent’s winning square. Watch this endgame. The first player has an odd threat: three across on row 3, aimed at column 1, row 3. Column 1, row 2 is poison for the second player.',
    },
    {
      kind: 'board',
      caption: 'First player to move. Ten squares are empty: five in column 1, five in column 7. The threat is column 1, row 3.',
      moves: P.ODD_THREAT_X,
      highlight: [15, 16, 17],
    },
    {
      kind: 'prose',
      text: 'The first player plays column 7. The second player answers column 7 — any other move is column 1, row 2, and loses at once. Column 7 again, and again, and again: five discs fill it, and the first player played the first, third and fifth of them. Now it is the second player’s move, column 7 is full, and the only square left is the poison one. The first player wins on row 3.',
    },
    {
      kind: 'tryIt',
      prompt: 'You are the first player. Find the move that wins the endgame.',
      moves: P.ODD_THREAT_X,
      answers: [6],
      explanation: 'Column 7. Playing column 1 yourself fills row 2 and lets them block row 3; the whole point is to make them fill it. With column 7 holding an odd number of empty squares, you take its last square and they are left with the poison.',
    },
    {
      kind: 'prose',
      text: 'Now the mirror image. The second player has an even threat on column 1, row 4, and column 1, row 3 is poison for the first player. Column 7 is empty: six squares, an even number. The first player must move.',
    },
    {
      kind: 'board',
      caption: 'First player to move, and lost. Every route ends with the first player forced into column 1, row 3.',
      moves: P.EVEN_THREAT_O,
      highlight: [22, 23, 24],
    },
    {
      kind: 'prose',
      text: 'Whatever the first player does, the second player answers in the same column. Six discs fill column 7 in pairs, the first player having played the first, third and fifth; then the first player is to move again with nothing left but the poison square. The second player wins on row 4.',
    },
    {
      kind: 'prose',
      text: 'Finally, the same threat on row 4 but owned by the first player. It is worth nothing. Column 7 fills in pairs, the first player runs out first, plays column 1, row 3, and the second player simply blocks row 4. Draw.',
    },
    {
      kind: 'board',
      caption: 'The first player’s even threat. Best play from here is a draw: the parity is wrong.',
      moves: P.EVEN_THREAT_X,
      highlight: [22, 23, 24],
    },
    {
      kind: 'keyIdea',
      text: 'The first player wins with an odd threat, the second with an even one. The square beneath your threat is where your opponent will be forced to play once the board fills — provided the row is the right parity for you.',
    },
    {
      kind: 'prose',
      text: 'Why odd for the first player? Count the empty squares of a column from the bottom. The first player makes the odd-numbered moves of the game, so when two players alternate filling one column, the first player gets its first, third and fifth squares and the second player its second, fourth and sixth. A threat on an odd row asks the opponent to fill an even square — and even squares are the second player’s to fill, whether they like it or not.',
    },
    {
      kind: 'reference',
      sources: [
        { ...ALLIS_1988, note: 'Chapter 3: odd and even threats, and the zugzwang that decides who fills the square beneath them.' },
        { ...POMAKIS },
        { ...MIT_SP268 },
      ],
    },
  ],
};

const followUp: Lesson = {
  slug: 'follow-up',
  title: 'Follow-up: the second player’s weapon',
  summary: 'Answering in the same column claims every even square. Allis called it Claimeven, and it is the backbone of defence.',
  difficulty: 'intermediate',
  course: 'threat-theory',
  order: 2,
  blocks: [
    {
      kind: 'prose',
      text: 'The previous lesson’s endgames were all decided the same way: one side answered every move in the column it was played in. Allis calls this strategy follow-up, and the rule it rests on Claimeven: when your opponent plays an odd square, you take the even square directly above it.',
    },
    {
      kind: 'prose',
      text: 'Follow-up is the second player’s natural weapon because the second player makes the even-numbered moves of the game. If every column has an even number of empty squares and the second player follows up everywhere, the second player ends up with every even square on the board — and the first player fills every odd one, including any that are poison.',
    },
    {
      kind: 'board',
      caption: 'The second player’s even threat again, one move on: the first player has just played column 7. Second player to move.',
      moves: [...P.EVEN_THREAT_O, 6],
      highlight: [22, 23, 24],
    },
    {
      kind: 'tryIt',
      prompt: 'You are the second player, and you are winning. Keep it that way.',
      moves: [...P.EVEN_THREAT_O, 6],
      answers: [6],
      explanation: 'Follow up in column 7. Playing column 1 yourself would fill row 3, let them block row 4, and throw the win away for a draw.',
    },
    {
      kind: 'prose',
      text: 'The first player cannot follow up in the same way from the start, because the first player moves first and there is nobody to follow. That is exactly why the first player needs an odd threat: it turns one column into a place where the second player cannot follow up, and the parity of the rest of the board does the work.',
    },
    {
      kind: 'keyIdea',
      text: 'Playing second, follow up by default: answer in the column they played. Break the habit only for a reason — to take a win, to block one, or because the square above theirs is poison for you.',
    },
    {
      kind: 'prose',
      text: 'Allis proved that follow-up, applied with a handful of refinements, is enough for the second player to hold a draw against anything except the centre opening. Against the centre opening it is not, which is the whole reason the game is a first-player win. The Advanced tier covers the refinements.',
    },
    {
      kind: 'reference',
      sources: [
        { ...ALLIS_1988, note: 'Claimeven (chapter 6), and the follow-up strategy in chapter 3.' },
        { ...POMAKIS },
      ],
    },
  ],
};

const countingParity: Lesson = {
  slug: 'counting-parity',
  title: 'Counting who runs out of moves',
  summary: 'A method for endgames with several open columns: list the safe squares, count them, and know the result before you play.',
  difficulty: 'intermediate',
  course: 'threat-theory',
  order: 3,
  blocks: [
    {
      kind: 'prose',
      text: 'With one threat on the board the parity rule gives the answer directly. With threats for both sides and neutral columns between them, you count. The idea: every empty square is either poison for one side, wasted by one side (the square beneath your own threat, which throws it away), or neutral. Whoever runs out of neutral squares first has to do something they would rather not.',
    },
    {
      kind: 'board',
      caption: 'First player to move. The first player has an odd threat on column 1, row 3; the second player has an even threat on column 7, row 4 (the rising diagonal from column 4, row 1). Column 4 has three empty squares.',
      moves: P.THREE_COLUMNS,
      highlight: [15, 16, 17, 3, 11, 19],
    },
    {
      kind: 'prose',
      text: 'Take stock. Column 1: row 2 is poison for the second player; for the first player it merely wastes the threat. Column 7: row 3 is poison for the first player; for the second player it wastes their threat. Column 4: three neutral squares. Three is odd, and the first player moves first, so the first player will take the last neutral square.',
    },
    {
      kind: 'tryIt',
      prompt: 'You are the first player. Find the winning plan.',
      moves: P.THREE_COLUMNS,
      answers: [3],
      explanation: 'Column 4. You take neutral squares one and three; they take two. Then they must either play column 1, row 2 and lose at once, or fill column 7, row 3 themselves, after which you block row 4, column 7 fills in pairs, and they are forced into column 1 anyway.',
    },
    {
      kind: 'prose',
      text: 'Both of the other moves lose. Column 1 fills the square beneath your own threat, and after they block you have nothing while they still have an even threat. Column 7 is the poison square: they win on row 4 immediately.',
    },
    {
      kind: 'keyIdea',
      text: 'In an endgame, count the neutral squares. If the count is odd, the player to move takes the last one and the other side is squeezed. If it is even, the player to move is the one squeezed. Then play so that the count comes out your way.',
    },
    {
      kind: 'prose',
      text: 'The count is a shortcut for the same thing the parity rule says. When you have the right kind of threat, every neutral column fills in pairs and the squeeze lands on your opponent; the neutral squares only decide who gets squeezed when the threats do not settle it on their own.',
    },
    {
      kind: 'reference',
      sources: [
        { ...ALLIS_1988, note: 'Zugzwang and the control of it (chapter 3).' },
        { ...MIT_SP268 },
      ],
    },
  ],
};

// --- Calculation -------------------------------------------------------------

const forcingSequences: Lesson = {
  slug: 'forcing-sequences',
  title: 'Forcing moves: choosing their reply for them',
  summary: 'A threat forces a block. Chain the blocks so each one hands you the next square.',
  difficulty: 'intermediate',
  course: 'calculation',
  order: 1,
  blocks: [
    {
      kind: 'prose',
      text: 'When you make a threat, your opponent has one legal-in-practice reply: the block. That makes threats the most reliable tool for calculation. You are not guessing what they will do; you are choosing it. A forcing sequence is a chain of threats where each block puts a disc exactly where you need it — usually beneath a square you want to reach.',
    },
    {
      kind: 'board',
      caption: 'First player to move. Two on the bottom row with column 1 blocked; two on the rising diagonal from column 6, row 3 to column 7, row 4.',
      moves: P.FORCING_ONE,
      highlight: [1, 2, 19, 27],
    },
    {
      kind: 'tryIt',
      prompt: 'You are the first player. Force the win.',
      moves: P.FORCING_ONE,
      answers: [3],
      explanation: 'Column 4 makes three across and threatens column 5, row 1. They must block there — and the block makes column 5, row 2 playable, which completes your diagonal from column 4, row 1 to column 7, row 4.',
    },
    {
      kind: 'prose',
      text: 'The pattern to look for: a square you can win on that is not playable yet, and a threat that will make your opponent fill the square beneath it. The forcing move often does two jobs at once, as it does here — column 4, row 1 is both the third disc of the row and the first disc of the diagonal.',
    },
    {
      kind: 'board',
      caption: 'Two forcing moves. First player to move; the row threat and the vertical threat are independent, and each block feeds the diagonal.',
      moves: P.FORCING_TWO,
      highlight: [1, 2, 13, 20, 19],
    },
    {
      kind: 'tryIt',
      prompt: 'You are the first player. Win in three moves.',
      moves: P.FORCING_TWO,
      answers: [3, 6],
      explanation: 'Either order works. Column 4 threatens column 5, row 1, and the block makes column 5, row 2 playable. Column 7 makes a stack of three, and the cap fills column 7, row 5. After both blocks, column 5, row 2 completes the diagonal from column 4, row 1 through column 6, row 3 to column 7, row 4 — and you also threaten the stack, so one of the two is a four.',
    },
    {
      kind: 'keyIdea',
      text: 'Calculate forcing moves first. A threat narrows your opponent’s replies to one, so a line of threats can be read out to the end with certainty. Look for the block that fills the square beneath your winning square.',
    },
    {
      kind: 'reference',
      sources: [
        { ...ALLIS_1988, note: 'Threat sequences and the squares a forced block makes playable.' },
      ],
    },
  ],
};

const thinkingRoutine: Lesson = {
  slug: 'a-thinking-routine',
  title: 'A thinking routine for every move',
  summary: 'Candidate moves, the square above, and a blunder check: a five-step routine adapted from chess coaching.',
  difficulty: 'intermediate',
  course: 'calculation',
  order: 2,
  blocks: [
    {
      kind: 'prose',
      text: 'By now you know a lot of things to look for. The problem is looking for all of them, every move, under a clock. The answer is a fixed routine, the way chess players are taught to list candidate moves before calculating any of them, and to check a move’s safety before playing it. Here is one adapted to Connect 4.',
    },
    {
      kind: 'keyIdea',
      text: '1. Can I win now? 2. Must I block? 3. List candidates: moves that make a threat, moves toward the centre, moves that take a square they want. 4. For each, look at the square above it: does it give them a win? 5. Pick one and check once more what they can do after it.',
    },
    {
      kind: 'prose',
      text: 'Steps 1 and 2 are the safety check from the first course. Step 3 is Kotov’s idea: write down every move worth considering before you calculate any of them, or you will calculate the first move you see and play it. Step 4 is the one specific to this game. In chess a move can be unsafe for many reasons; here it is almost always the same reason, and it is one square away.',
    },
    {
      kind: 'board',
      caption: 'First player to move. Column 4 is the centre, and it is also the worst move on the board.',
      moves: P.FLOATING_THREAT,
      highlight: [7, 8, 9],
    },
    {
      kind: 'tryIt',
      prompt: 'Run the routine. Steps 1 and 2 say nothing. Step 3 offers the centre. Step 4?',
      moves: P.FLOATING_THREAT,
      answers: [1, 2, 4, 5, 6],
      explanation: 'Step 4 rejects the centre: the square above column 4, row 1 completes their row. Step 5 rejects column 1 as well \u2014 after it, column 2 gives them a second line and you cannot hold both. Columns 2, 3, 5, 6 and 7 pass. The routine is there for exactly this moment, when the natural move is the losing one.',
    },
    {
      kind: 'prose',
      text: 'Step 5 sounds redundant and is not. After you have chosen, look at the board as if you had already played the move and ask what your opponent’s best reply is. Most blunders at this level are moves that were fine in the position you were thinking about and losing in the position that actually arises.',
    },
    {
      kind: 'prose',
      text: 'On a fast clock the routine compresses rather than disappears. Steps 1, 2 and 4 are the ones you keep when there is no time for anything else. They take a second each, and they are worth more than any amount of deeper calculation.',
    },
    {
      kind: 'reference',
      sources: [
        { ...KOTOV_1971 },
        { ...HEISMAN_2010 },
      ],
    },
  ],
};

export const LESSONS_INTERMEDIATE: readonly Lesson[] = [
  oddAndEvenThreats,
  followUp,
  countingParity,
  forcingSequences,
  thinkingRoutine,
];
