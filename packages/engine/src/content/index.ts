/**
 * The curriculum content: courses, lessons and puzzles, as data.
 *
 * The server seeds it, the demo serves it from fixtures, and
 * `tests/content.test.ts` proves every position and answer against the
 * engine. Nothing here does I/O.
 */
import type { Lesson } from '../curriculum.js';
import { LESSONS_ADVANCED } from './lessons-advanced.js';
import { LESSONS_BEGINNER } from './lessons-beginner.js';
import { LESSONS_INTERMEDIATE } from './lessons-intermediate.js';
import { LESSONS_NEW } from './lessons-new.js';

export { COURSES, COURSES_BY_ID } from './courses.js';
export { PUZZLES } from './puzzles.js';
export * as CURRICULUM_POSITIONS from './positions.js';
export * as CURRICULUM_SOURCES from './sources.js';

/** Every lesson, in teaching order: by tier, then course, then order. */
export const LESSONS: readonly Lesson[] = [
  ...LESSONS_NEW,
  ...LESSONS_BEGINNER,
  ...LESSONS_INTERMEDIATE,
  ...LESSONS_ADVANCED,
];

export const LESSONS_BY_SLUG: Record<string, Lesson> = Object.fromEntries(
  LESSONS.map((lesson) => [lesson.slug, lesson]),
);
