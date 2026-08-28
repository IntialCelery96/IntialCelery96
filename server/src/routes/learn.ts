import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { parseBlocks } from '@connect4gg/engine';
import { prisma } from '../lib/db.js';
import { HttpError } from '../middleware/auth.js';

/**
 * Curriculum endpoints.
 *
 * Scaffold only — the shape is finished so lessons can be added as seed data,
 * but the library itself is one lesson and one puzzle deep. See
 * docs/curriculum-roadmap.md for what is meant to go here.
 */
export async function learnRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/lessons', async () => {
    const lessons = await prisma.lesson.findMany({
      where: { published: true },
      orderBy: [{ difficulty: 'asc' }, { order: 'asc' }],
      select: { slug: true, title: true, summary: true, difficulty: true, order: true },
    });
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
        order: lesson.order,
        blocks: parseBlocks(lesson.blocks),
      },
    };
  });

  app.get('/api/puzzles', async () => {
    const puzzles = await prisma.puzzle.findMany({
      where: { published: true },
      orderBy: [{ difficulty: 'asc' }, { order: 'asc' }],
      select: { slug: true, title: true, difficulty: true, order: true },
    });
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
