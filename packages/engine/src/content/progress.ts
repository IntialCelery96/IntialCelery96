import type { Lesson, Puzzle } from '../curriculum.js';
import { LESSONS, LESSONS_BY_SLUG } from './lessons.js';
import { PUZZLES, PUZZLES_BY_SLUG } from './puzzles.js';

/**
 * Progression through the curriculum.
 *
 * The only state is the set of puzzles a player has solved. Everything else
 * — which lessons are open, which puzzle comes next, whether a lesson is
 * finished — is derived from that set and the content's order, here, so the
 * server (which decides whether an attempt is allowed), the web app (which
 * draws the locks) and the demo all agree by construction.
 *
 * The rules:
 *   - Lessons open in teaching order. The first is always open; each later
 *     one opens when the lesson before it is complete.
 *   - A lesson is complete when every puzzle at its end is solved.
 *   - Within a lesson, puzzles open in order: the first as soon as the lesson
 *     is open, each later one when the one before it is solved.
 */

export interface PuzzleProgress {
  slug: string;
  unlocked: boolean;
  solved: boolean;
}

export interface LessonProgress {
  slug: string;
  unlocked: boolean;
  complete: boolean;
  puzzles: PuzzleProgress[];
  solvedCount: number;
}

export interface CurriculumProgress {
  lessons: LessonProgress[];
  /** Puzzles solved, and the total in the curriculum. */
  solved: number;
  total: number;
  /** The first lesson that is open and not finished, if any. */
  nextLesson: string | null;
  /** The puzzle to do next: the first open, unsolved one in `nextLesson`. */
  nextPuzzle: string | null;
}

/** The puzzles at the end of a lesson, in unlock order. */
export function puzzlesForLesson(lessonSlug: string): Puzzle[] {
  return PUZZLES.filter((p) => p.lesson === lessonSlug).sort((a, b) => a.order - b.order);
}

export function lessonForPuzzle(puzzleSlug: string): Lesson | null {
  const puzzle = PUZZLES_BY_SLUG[puzzleSlug];
  return puzzle ? (LESSONS_BY_SLUG[puzzle.lesson] ?? null) : null;
}

export function curriculumProgress(solvedSlugs: Iterable<string>): CurriculumProgress {
  const solved = new Set(solvedSlugs);
  const lessons: LessonProgress[] = [];
  let previousComplete = true;
  let nextLesson: string | null = null;
  let nextPuzzle: string | null = null;
  let solvedCount = 0;

  for (const lesson of LESSONS) {
    const unlocked = previousComplete;
    const puzzles: PuzzleProgress[] = [];
    let previousSolved = true;
    let lessonSolved = 0;

    for (const puzzle of puzzlesForLesson(lesson.slug)) {
      const isSolved = solved.has(puzzle.slug);
      const isUnlocked = unlocked && previousSolved;
      puzzles.push({ slug: puzzle.slug, unlocked: isUnlocked, solved: isSolved });
      if (isSolved) lessonSolved++;
      if (isUnlocked && !isSolved && nextPuzzle === null && nextLesson === null) {
        nextPuzzle = puzzle.slug;
      }
      previousSolved = isSolved;
    }

    const complete = puzzles.every((p) => p.solved);
    if (unlocked && !complete && nextLesson === null) nextLesson = lesson.slug;

    lessons.push({ slug: lesson.slug, unlocked, complete, puzzles, solvedCount: lessonSolved });
    solvedCount += lessonSolved;
    previousComplete = complete;
  }

  return { lessons, solved: solvedCount, total: PUZZLES.length, nextLesson, nextPuzzle };
}

export function isLessonUnlocked(lessonSlug: string, solvedSlugs: Iterable<string>): boolean {
  return curriculumProgress(solvedSlugs).lessons.some((l) => l.slug === lessonSlug && l.unlocked);
}

export function isPuzzleUnlocked(puzzleSlug: string, solvedSlugs: Iterable<string>): boolean {
  for (const lesson of curriculumProgress(solvedSlugs).lessons) {
    const puzzle = lesson.puzzles.find((p) => p.slug === puzzleSlug);
    if (puzzle) return puzzle.unlocked;
  }
  return false;
}

/** The lesson a locked lesson is waiting on: the one just before it. */
export function lessonBefore(lessonSlug: string): Lesson | null {
  const index = LESSONS.findIndex((l) => l.slug === lessonSlug);
  return index > 0 ? (LESSONS[index - 1] ?? null) : null;
}

export function lessonAfter(lessonSlug: string): Lesson | null {
  const index = LESSONS.findIndex((l) => l.slug === lessonSlug);
  return index >= 0 ? (LESSONS[index + 1] ?? null) : null;
}
