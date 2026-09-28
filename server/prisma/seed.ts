import { PrismaClient } from '@prisma/client';
import { LESSONS, PUZZLES, serializeMoves } from '@connect4gg/engine';

const prisma = new PrismaClient();

/**
 * Seeds the curriculum.
 *
 * The content lives in the engine package (`packages/engine/src/content/`),
 * where its tests replay every diagram and prove every answer. This script
 * only copies it into the database, so re-running it after a content change
 * is the whole deployment step. Rows are upserted by slug; a lesson or puzzle
 * removed from the content is unpublished rather than deleted, so a link to it
 * keeps 404ing cleanly instead of dangling.
 *
 * See docs/curriculum.md for the design of the curriculum itself.
 */

async function main(): Promise<void> {
  for (const lesson of LESSONS) {
    const data = {
      title: lesson.title,
      summary: lesson.summary,
      difficulty: lesson.difficulty,
      course: lesson.course,
      blocks: lesson.blocks,
      order: lesson.order,
      published: true,
    };
    await prisma.lesson.upsert({
      where: { slug: lesson.slug },
      create: { slug: lesson.slug, ...data },
      update: data,
    });
  }

  for (const puzzle of PUZZLES) {
    const data = {
      title: puzzle.title,
      difficulty: puzzle.difficulty,
      lesson: puzzle.lesson,
      theme: puzzle.theme,
      rating: puzzle.rating,
      prompt: puzzle.prompt,
      moves: serializeMoves(puzzle.moves),
      solver: puzzle.solver,
      answers: puzzle.answers,
      explanation: puzzle.explanation,
      order: puzzle.order,
      published: true,
    };
    await prisma.puzzle.upsert({
      where: { slug: puzzle.slug },
      create: { slug: puzzle.slug, ...data },
      update: data,
    });
  }

  const lessonSlugs = LESSONS.map((l) => l.slug);
  const puzzleSlugs = PUZZLES.map((p) => p.slug);
  const [retiredLessons, retiredPuzzles] = await Promise.all([
    prisma.lesson.updateMany({
      where: { slug: { notIn: lessonSlugs }, published: true },
      data: { published: false },
    }),
    prisma.puzzle.updateMany({
      where: { slug: { notIn: puzzleSlugs }, published: true },
      data: { published: false },
    }),
  ]);

  console.log(
    `Seeded ${LESSONS.length} lessons and ${PUZZLES.length} puzzles` +
      (retiredLessons.count + retiredPuzzles.count > 0
        ? `; unpublished ${retiredLessons.count} lessons and ${retiredPuzzles.count} puzzles no longer in the content.`
        : '.'),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
