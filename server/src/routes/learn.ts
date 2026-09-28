import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import {
  COURSES,
  PUZZLES_BY_SLUG,
  difficultyRank,
  isPuzzleUnlocked,
  parseBlocks,
} from '@connect4gg/engine';
import { prisma } from '../lib/db.js';
import { HttpError, currentUser, requireAuth } from '../middleware/auth.js';

/**
 * Curriculum endpoints.
 *
 * Lessons and puzzles are rows seeded from `packages/engine/src/content/`.
 * Courses are static — they are the table of contents, and change only when
 * the content does — so they come straight from the engine.
 *
 * Progress is the set of puzzles a user has solved, and nothing else: which
 * lessons are open is derived from that set by the engine, so the server, the
 * web app and the demo all apply the same rule. Signed-in players' solves are
 * recorded here when an attempt is graded correct, and a locked puzzle refuses
 * attempts. Anonymous readers are graded but not recorded; the browser keeps
 * their progress and merges it into the account when they sign in.
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
      select: {
        slug: true,
        title: true,
        difficulty: true,
        lesson: true,
        theme: true,
        rating: true,
        order: true,
      },
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
        lesson: puzzle.lesson,
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

    // A signed-in player may only attempt what the path has opened. The
    // browser enforces the same rule for everyone else; a reader who bypasses
    // it only spoils their own puzzle.
    if (request.user) {
      const solved = await solvedSlugs(request);
      if (!isPuzzleUnlocked(slug, solved)) {
        throw new HttpError(403, 'Finish the puzzles before this one first', 'PUZZLE_LOCKED');
      }
    }

    const answers = Array.isArray(puzzle.answers) ? (puzzle.answers as number[]) : [];
    const correct = answers.includes(column);

    let recorded = false;
    if (correct && request.user) {
      await prisma.puzzleSolve.upsert({
        where: { userId_puzzleSlug: { userId: request.user.id, puzzleSlug: slug } },
        create: { userId: request.user.id, puzzleSlug: slug },
        update: {},
      });
      recorded = true;
    }

    return {
      correct,
      // The explanation is only revealed once the puzzle is solved.
      explanation: correct ? puzzle.explanation : null,
      recorded,
    };
  });

  /** The puzzles this account has solved. Progress is derived from it. */
  app.get('/api/learn/progress', { preHandler: requireAuth }, async (request) => ({
    solved: await solvedSlugs(request),
  }));

  /**
   * Merges solves the browser recorded before the player signed in. Only
   * slugs that exist in the content are kept; duplicates are ignored. The
   * merged set is returned so the client can replace its local copy.
   */
  app.post('/api/learn/progress', { preHandler: requireAuth }, async (request) => {
    const user = currentUser(request);
    const { solved } = z
      .object({ solved: z.array(z.string().min(1).max(80)).max(500) })
      .parse(request.body);

    const known = [...new Set(solved)].filter((slug) => slug in PUZZLES_BY_SLUG);
    if (known.length > 0) {
      await prisma.puzzleSolve.createMany({
        data: known.map((puzzleSlug) => ({ userId: user.id, puzzleSlug })),
        skipDuplicates: true,
      });
    }

    return { solved: await solvedSlugs(request) };
  });
}

async function solvedSlugs(request: FastifyRequest): Promise<string[]> {
  const user = currentUser(request);
  const rows = await prisma.puzzleSolve.findMany({
    where: { userId: user.id },
    select: { puzzleSlug: true },
    orderBy: { solvedAt: 'asc' },
  });
  return rows.map((row) => row.puzzleSlug);
}
