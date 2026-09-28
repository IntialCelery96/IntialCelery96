/**
 * The curriculum content: courses, lessons and puzzles, as data, plus the
 * progression rules derived from them.
 *
 * The server seeds it, the demo serves it from fixtures, and
 * `tests/content.test.ts` proves every position and answer against the
 * engine. Nothing here does I/O.
 */
export { COURSES, COURSES_BY_ID } from './courses.js';
export { LESSONS, LESSONS_BY_SLUG } from './lessons.js';
export { PUZZLES, PUZZLES_BY_SLUG } from './puzzles.js';
export * from './progress.js';
export * as CURRICULUM_POSITIONS from './positions.js';
export * as CURRICULUM_SOURCES from './sources.js';
