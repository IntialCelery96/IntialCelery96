import type { Course } from '../curriculum.js';

/**
 * The course catalogue. Four tiers, each split into courses of three or four
 * lessons, in the order they should be taken. `docs/curriculum.md` explains
 * the sequencing and what each tier is meant to get a player past.
 */
export const COURSES: readonly Course[] = [
  {
    id: 'first-steps',
    title: 'First Steps',
    summary: 'The rules, what a threat is, and the two questions to ask before every move.',
    difficulty: 'new',
    order: 1,
  },
  {
    id: 'board-sense',
    title: 'Board Sense',
    summary: 'Where the winning lines are, how to scan for them, and the square you must never fill.',
    difficulty: 'beginner',
    order: 1,
  },
  {
    id: 'first-tactics',
    title: 'First Tactics',
    summary: 'Double threats, the 7 trap, and how to open a game without losing it.',
    difficulty: 'beginner',
    order: 2,
  },
  {
    id: 'threat-theory',
    title: 'Threat Theory',
    summary: 'Odd and even threats, follow-up play, and counting who runs out of safe moves.',
    difficulty: 'intermediate',
    order: 1,
  },
  {
    id: 'calculation',
    title: 'Calculation',
    summary: 'Forcing sequences, and a thinking routine that stops one-move blunders.',
    difficulty: 'intermediate',
    order: 2,
  },
  {
    id: 'zugzwang',
    title: 'Controlling the Zugzwang',
    summary: 'The full set of threat rules from the thesis that solved the game.',
    difficulty: 'advanced',
    order: 1,
  },
  {
    id: 'openings-and-endgames',
    title: 'Openings and Endgames',
    summary: 'What the solvers say about the first move, how to play second, and exact endgame counting.',
    difficulty: 'advanced',
    order: 2,
  },
];

export const COURSES_BY_ID: Record<string, Course> = Object.fromEntries(
  COURSES.map((course) => [course.id, course]),
);
