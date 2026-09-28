import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { COURSES, difficultyRank, parseBlocks } from '@connect4gg/engine';
import { prisma } from '../lib/db.js';
import { HttpError } from '../middleware/auth.js';

/**
 * Curriculum endpoints.
 *
 * Lessons and puzzles are rows seeded from `packages/engine/src/content/`.
 * Courses are static — they are the table of contents, and change only when
 * the content does — so they come straight from the engine.
 *
 * Tiers sort in teaching order ("new" before "beginner"), which is not their
 * alphabetical order, so ordering is finished here rather than in SQL.
 */
export async function learnRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/courses', async () => ({ courses: COURSES }));

  app.get('/api/lessons', async () => {
    const rows = await prisma.lesson.findMany({
      where: { published: true },
      select: { slug: true, title: true, summary: true, difficulty: true, course: true, order: true },
    });
    const courseOrder = new Map(COURSES.map((c, i) => [c.id, i]));
    const lessons = rows.sort(
      (a, b) =>
        difficultyRank(a.difficulty) - difficultyRank(b.difficulty) ||
        (courseOrder.get(a.course) ?? Infinity) - (courseOrder.get(b.course) ?? Infinity) ||
        a.order - b.order,
    );
    return { lessons };
  });

  app.get('/api/lessons/:slug', async (request) => {
    const { slug } = z.object({ slug: z.string().min(1).max(80) }).parse(request.params);

    const lesson = await prisma.lesson.findUnique({ where: { slug } });
    if (!lesson || !lesson.published) {
      throw new HttpError(404, 'No such lesson', 'LESSON_NOT_FOUND');
    }

    return {
      lesson: {
        slug: lesson.slug,
        title: lesson.title,
        summary: lesson.summary,
        difficulty: lesson.difficulty,
        course: lesson.course,
        order: lesson.order,
        blocks: parseBlocks(lesson.blocks),
      },
    };
  });

  app.get('/api/puzzles', async () => {
    const rows = await prisma.puzzle.findMany({
      where: { published: true },
      select: { slug: true, title: true, difficulty: true, theme: true, rating: true, order: true },
    });
    const puzzles = rows.sort(
      (a, b) =>
        difficultyRank(a.difficulty) - difficultyRank(b.difficulty) || a.order - b.order,
    );
    return { puzzles };
  });

  /**
   * A puzzle's starting position. The accepted answers are deliberately NOT
   * included — they are checked server-side so the solution can't be read out
   * of the network tab.
   */
  app.get('/api/puzzles/:slug', async (request) => {
    const { slug } = z.object({ slug: z.string().min(1).max(80) }).parse(request.params);

    const puzzle = await prisma.puzzle.findUnique({ where: { slug } });
    if (!puzzle || !puzzle.published) {
      throw new HttpError(404, 'No such puzzle', 'PUZZLE_NOT_FOUND');
    }

    return {
      puzzle: {
        slug: puzzle.slug,
        title: puzzle.title,
        difficulty: puzzle.difficulty,
        theme: puzzle.theme,
        rating: puzzle.rating,
        prompt: puzzle.prompt,
        moves: puzzle.moves,
        solver: puzzle.solver,
        order: puzzle.order,
      },
    };
  });

  app.post('/api/puzzles/:slug/attempt', async (request) => {
    const { slug } = z.object({ slug: z.string().min(1).max(80) }).parse(request.params);
    const { column } = z.object({ column: z.number().int().min(0).max(6) }).parse(request.body);

    const puzzle = await prisma.puzzle.findUnique({ where: { slug } });
    if (!puzzle || !puzzle.published) {
      throw new HttpError(404, 'No such puzzle', 'PUZZLE_NOT_FOUND');
    }

    const answers = Array.isArray(puzzle.answers) ? (puzzle.answers as number[]) : [];
    const correct = answers.includes(column);

    return {
      correct,
      // The explanation is only revealed once the puzzle is solved.
      explanation: correct ? puzzle.explanation : null,
    };
  });
}
