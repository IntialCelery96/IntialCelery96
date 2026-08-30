import { PrismaClient } from '@prisma/client';
import { type Lesson, type Puzzle, serializeMoves } from '@connect4gg/engine';

const prisma = new PrismaClient();

/**
 * Seed content for the curriculum scaffold.
 *
 * One lesson and one puzzle, written to prove the whole path works end to end:
 * content is data, the API serves it, and the web app renders board diagrams
 * through the same component the live game uses. Adding the rest of the
 * curriculum should mean adding entries here, not writing new code.
 *
 * See docs/curriculum-roadmap.md for the topics that come next.
 */

const centerColumnControl: Lesson = {
  slug: 'center-column-control',
  title: 'Center Column Control',
  summary:
    'Why the middle column is worth more than any other, and what it costs you to give it away.',
  difficulty: 'beginner',
  order: 1,
  blocks: [
    {
      kind: 'prose',
      text: 'Connect 4 is played on a 7×6 board, and the 69 possible four-in-a-rows are not spread evenly across it. Some squares sit on many more of those lines than others, and the center column sits on the most.',
    },
    {
      kind: 'prose',
      text: 'Count them: a disc in column 4 (the middle) belongs to up to 13 different winning lines. A disc in an outside column belongs to as few as 3. Every disc you place in the middle is doing four times the work.',
    },
    {
      kind: 'keyIdea',
      text: 'With perfect play, the first player wins — but only by starting in the center column. Every other opening move throws the win away.',
    },
    {
      kind: 'board',
      caption: 'The strongest opening move there is: straight down the middle.',
      moves: [3],
      // Board index 3 is the bottom row of the center column.
      highlight: [3],
    },
    {
      kind: 'prose',
      text: 'The follow-up matters just as much. If your opponent opens in the center and you answer on the edge, you have conceded the most valuable real estate on the board for almost nothing in return.',
    },
    {
      kind: 'board',
      caption: 'The first player owns the centre; the second has taken an edge and is already worse.',
      moves: [3, 0, 3],
      // Both of the first player's centre discs: 3 and 10 are the bottom two cells
      // of column 4. Highlighting an empty square would just ring nothing.
      highlight: [3, 10],
    },
    {
      kind: 'tryIt',
      prompt: 'Your opponent opened in the centre. Where do you play?',
      moves: [3],
      // Stacking on the center is the standard reply; the two squares beside it
      // are the reasonable alternatives.
      answers: [3, 2, 4],
      explanation:
        'Play on or next to the centre. Stacking directly on top (column 4) denies your opponent the second centre square; columns 3 and 5 keep you in the fight for the middle. An edge move hands them a free advantage.',
    },
    {
      kind: 'prose',
      text: 'This is the first habit to build: when you have nothing better to do, play toward the middle. It is rarely the losing move, and it keeps the most winning lines available to you.',
    },
  ],
};

const findTheWin: Puzzle = {
  slug: 'find-the-win',
  title: 'Find the Win',
  difficulty: 'beginner',
  // The first player has three stacked in the centre column and is on move.
  moves: [3, 0, 3, 1, 3, 2],
  solver: 1,
  answers: [3],
  explanation:
    'Column 4 completes a vertical four. Vertical threats are the easiest to miss because they build in one place — always scan your own columns before you look anywhere else.',
  order: 1,
};

async function main(): Promise<void> {
  await prisma.lesson.upsert({
    where: { slug: centerColumnControl.slug },
    create: {
      slug: centerColumnControl.slug,
      title: centerColumnControl.title,
      summary: centerColumnControl.summary,
      difficulty: centerColumnControl.difficulty,
      blocks: centerColumnControl.blocks,
      order: centerColumnControl.order,
    },
    update: {
      title: centerColumnControl.title,
      summary: centerColumnControl.summary,
      difficulty: centerColumnControl.difficulty,
      blocks: centerColumnControl.blocks,
      order: centerColumnControl.order,
    },
  });

  await prisma.puzzle.upsert({
    where: { slug: findTheWin.slug },
    create: {
      slug: findTheWin.slug,
      title: findTheWin.title,
      difficulty: findTheWin.difficulty,
      moves: serializeMoves(findTheWin.moves),
      solver: findTheWin.solver,
      answers: findTheWin.answers,
      explanation: findTheWin.explanation,
      order: findTheWin.order,
    },
    update: {
      title: findTheWin.title,
      difficulty: findTheWin.difficulty,
      moves: serializeMoves(findTheWin.moves),
      solver: findTheWin.solver,
      answers: findTheWin.answers,
      explanation: findTheWin.explanation,
      order: findTheWin.order,
    },
  });

  console.log('Seeded 1 lesson and 1 puzzle.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
