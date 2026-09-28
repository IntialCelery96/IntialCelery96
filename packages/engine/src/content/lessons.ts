import type { Lesson } from '../curriculum.js';
import { LESSONS_ADVANCED } from './lessons-advanced.js';
import { LESSONS_BEGINNER } from './lessons-beginner.js';
import { LESSONS_INTERMEDIATE } from './lessons-intermediate.js';
import { LESSONS_NEW } from './lessons-new.js';

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
