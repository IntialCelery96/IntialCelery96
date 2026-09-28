import type { Lesson } from '../curriculum.js';
import * as P from './positions.js';
import { ALLIS_1988, HEISMAN_2010, TROMP_PLAYGROUND, WIKIPEDIA_C4 } from './sources.js';

/**
 * Tier: New to the game. Course: First Steps.
 *
 * Assumes nothing. By the end a player knows the rules, can see a three that
 * needs a fourth, and runs the two-question check before every move — which
 * is enough to beat Pip and, most of the time, Rusty.
 */

const howTheGameIsWon: Lesson = {
  slug: 'how-the-game-is-won',
  title: 'How a game is won',
  summary: 'The board, the drop, and the four ways to make four.',
  difficulty: 'new',
  course: 'first-steps',
  order: 1,
  blocks: [
    {
      kind: 'prose',
      text: 'The board has seven columns and six rows. You do not place a disc on a square: you drop it into a column, and it falls to the lowest empty square there. The first player moves first, then the two of you alternate, one disc per turn.',
    },
    {
      kind: 'board',
      caption: 'A disc dropped into column 4 lands on row 1, the bottom row.',
      moves: [3],
      highlight: [3],
    },
    {
      kind: 'prose',
      text: 'You win by having four of your discs in a straight line. There are four kinds of line: across a row, up a column, and along either diagonal. The line must be unbroken: four discs touching, with nothing of your opponent’s in between.',
    },
    {
      kind: 'board',
      caption: 'Three across on the bottom row. One more disc in column 4 would make four.',
      moves: [0, 6, 1, 5, 2],
      highlight: [0, 1, 2],
    },
    {
      kind: 'board',
      caption: 'Three up a column. A disc on top, in column 4 again, would make four.',
      moves: [3, 0, 3, 1, 3],
      highlight: [3, 10, 17],
    },
    {
      kind: 'board',
      caption: 'Three on a diagonal. Column 4 lands on the fourth square of the line.',
      moves: P.DIAGONAL_WIN,
      highlight: [0, 8, 16],
    },
    {
      kind: 'keyIdea',
      text: 'Four in a row wins in any of four directions: across, up, and along both diagonals. The diagonals are the ones new players forget to look for.',
    },
    {
      kind: 'tryIt',
      prompt: 'You are the first player. Both sides have three across. Make four.',
      moves: P.HORIZONTAL_RACE,
      answers: [3],
      explanation: 'Column 4 completes your row. It would also have completed theirs, which is why you had to be first to it.',
    },
    {
      kind: 'prose',
      text: 'If all 42 squares fill with no four anywhere, the game is a draw. That is rarer than it sounds: there are 69 different places a four can sit on the board, and it is hard to fill every one of them with a mix of colours.',
    },
    {
      kind: 'reference',
      sources: [
        { ...WIKIPEDIA_C4, title: 'Connect Four — Gameplay', url: 'https://en.wikipedia.org/wiki/Connect_Four', note: 'The rules, and the history of the game.' },
        { ...TROMP_PLAYGROUND, note: 'The 69 winning lines and the count of legal positions.' },
      ],
    },
  ],
};

const threatsAndBlocks: Lesson = {
  slug: 'threats-and-blocks',
  title: 'Threats, and how to stop them',
  summary: 'What a threat is, how to block one, and why some threats are not urgent yet.',
  difficulty: 'new',
  course: 'first-steps',
  order: 2,
  blocks: [
    {
      kind: 'prose',
      text: 'A threat is three in a line with an empty fourth square that can be played right now. If your opponent has one and it is your turn, there is exactly one thing to do: drop a disc into that square yourself. That is a block.',
    },
    {
      kind: 'board',
      caption: 'The second player has three across on the bottom row. Column 4 is the square that must be blocked.',
      moves: P.BLOCK_THE_ROW,
      highlight: [0, 1, 2],
    },
    {
      kind: 'tryIt',
      prompt: 'Your opponent has three in a row. Stop it.',
      moves: P.BLOCK_THE_ROW,
      answers: [3],
      explanation: 'Column 4. A disc anywhere else and they play column 4 themselves and win.',
    },
    {
      kind: 'prose',
      text: 'Not every three is a threat yet. Because discs fall, the fourth square only becomes playable when the squares beneath it are filled. Here the second player has three across on row 2, but the square that completes it sits above an empty square.',
    },
    {
      kind: 'board',
      caption: 'Three on row 2. The winning square is column 4, row 2 — but column 4 is empty, so nobody can reach it yet.',
      moves: P.FLOATING_THREAT,
      highlight: [7, 8, 9],
    },
    {
      kind: 'prose',
      text: 'A threat like that is not urgent, but it is not harmless either. Whoever drops a disc into column 4 fills row 1 and makes row 2 playable — and then the other side wins. So the square beneath a threat is one you leave alone. There is a whole lesson on this in the Beginner tier; for now, notice the pattern.',
    },
    {
      kind: 'keyIdea',
      text: 'A threat is a three whose fourth square is playable now. Block those at once. A three whose fourth square is floating is a warning: never fill the square beneath it.',
    },
    {
      kind: 'reference',
      sources: [
        { ...ALLIS_1988, note: 'Allis’s definition of a threat, and of the square beneath it as one a player is forced to avoid.' },
      ],
    },
  ],
};

const winBeforeYouBlock: Lesson = {
  slug: 'win-before-you-block',
  title: 'Win first, block second',
  summary: 'The two questions to ask before every move, in the right order.',
  difficulty: 'new',
  course: 'first-steps',
  order: 3,
  blocks: [
    {
      kind: 'prose',
      text: 'Most games between new players are decided by one of two mistakes: missing your own four, or missing your opponent’s. Both are cured by the same habit — two questions, asked in order, before every move.',
    },
    {
      kind: 'keyIdea',
      text: 'First: can I make four right now? If yes, do it; nothing else matters. Second: can they make four on their next move? If yes, block it. Only then think about anything else.',
    },
    {
      kind: 'prose',
      text: 'The order is the point. A block is only worth making if you have no win of your own. Here the second player threatens column 4, and it is tempting to rush to stop it. But look at column 5.',
    },
    {
      kind: 'board',
      caption: 'The first player has three stacked in column 5. The second player has three across, aimed at column 4.',
      moves: P.WIN_BEFORE_BLOCK,
      highlight: [4, 11, 18],
    },
    {
      kind: 'tryIt',
      prompt: 'You are the first player. What do you play?',
      moves: P.WIN_BEFORE_BLOCK,
      answers: [4],
      explanation: 'Column 5 makes four up the column and ends the game. Blocking column 4 instead would let them block column 5 and you would have given away a win.',
    },
    {
      kind: 'prose',
      text: 'Now the same shape without your stack. Question one: no, you have no four. Question two: yes, they do. So you block.',
    },
    {
      kind: 'tryIt',
      prompt: 'You are the first player, and this time you have no win. Find the move.',
      moves: P.JUST_BLOCK,
      answers: [3],
      explanation: 'Column 4 blocks the row. Every other move loses immediately.',
    },
    {
      kind: 'prose',
      text: 'Chess coaches call this the safety check, and it is the single habit that separates players who lose to one-move oversights from those who do not. It takes a few seconds and it never stops being worth it: strong players still run it, they just run it faster.',
    },
    {
      kind: 'reference',
      sources: [
        { ...HEISMAN_2010, note: 'The safety check — look at what the opponent can do to you before you move — as the foundation of a thinking routine.' },
      ],
    },
  ],
};

export const LESSONS_NEW: readonly Lesson[] = [howTheGameIsWon, threatsAndBlocks, winBeforeYouBlock];
