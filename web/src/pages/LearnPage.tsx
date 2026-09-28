import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BOTS_BY_ID,
  DIFFICULTIES,
  DIFFICULTY_LABELS,
  DIFFICULTY_TARGETS,
  PUZZLE_THEME_LABELS,
  type Course,
  type Difficulty,
} from '@connect4gg/engine';
import { api } from '../lib/api';

interface LessonSummary {
  slug: string;
  title: string;
  summary: string;
  difficulty: string;
  course: string;
  order: number;
}

interface PuzzleSummary {
  slug: string;
  title: string;
  difficulty: string;
  theme: string;
  rating: number;
  order: number;
}

/** Tier colours, cool to hot: the same bands the bot ladder uses. */
export const TIER_STYLE: Record<string, string> = {
  new: 'bg-accent/15 text-accent-text',
  beginner: 'bg-good/15 text-good',
  intermediate: 'bg-warn/15 text-warn',
  advanced: 'bg-bad/15 text-bad',
};

const LESSONS_DONE_KEY = 'c4gg.lessons.done';

/** Slugs of lessons this browser has finished. A convenience, not a record. */
function readDone(): Set<string> {
  try {
    const raw = localStorage.getItem(LESSONS_DONE_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

/**
 * The curriculum index: four tiers, each a rating band with the bot to beat,
 * split into courses of a few lessons, with the puzzle library below grouped
 * by theme. Built the way a chess site lays out its lessons, because the
 * structure is what makes a path feel like a path.
 */
export function LearnPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [lessons, setLessons] = useState<LessonSummary[]>([]);
  const [puzzles, setPuzzles] = useState<PuzzleSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [done] = useState(readDone);

  useEffect(() => {
    Promise.all([
      api.get<{ courses: Course[] }>('/api/courses'),
      api.get<{ lessons: LessonSummary[] }>('/api/lessons'),
      api.get<{ puzzles: PuzzleSummary[] }>('/api/puzzles'),
    ])
      .then(([courseData, lessonData, puzzleData]) => {
        setCourses(courseData.courses);
        setLessons(lessonData.lessons);
        setPuzzles(puzzleData.puzzles);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  const lessonsByCourse = useMemo(() => {
    const map = new Map<string, LessonSummary[]>();
    for (const lesson of lessons) {
      const list = map.get(lesson.course) ?? [];
      list.push(lesson);
      map.set(lesson.course, list);
    }
    return map;
  }, [lessons]);

  const puzzlesByTheme = useMemo(() => {
    const map = new Map<string, PuzzleSummary[]>();
    for (const puzzle of puzzles) {
      const list = map.get(puzzle.theme) ?? [];
      list.push(puzzle);
      map.set(puzzle.theme, list);
    }
    for (const list of map.values()) list.sort((a, b) => a.rating - b.rating);
    return map;
  }, [puzzles]);

  const finished = lessons.filter((l) => done.has(l.slug)).length;
  const next = lessons.find((l) => !done.has(l.slug));

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">Learn</h1>
      <p className="mb-6 max-w-prose text-sm text-ink-3">
        Connect 4 is a solved game with real theory behind it. This path teaches that theory in the
        order it is needed: the rules, then board sense, then odd and even threats, then the rules
        that solved the game. Every diagram is a legal position and every answer is proved by the
        engine.
      </p>

      {loading ? (
        <p className="text-ink-3">Loading…</p>
      ) : (
        <div className="space-y-10">
          {lessons.length > 0 && (
            <section className="card flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm text-ink-3">
                  {finished} of {lessons.length} lessons finished on this device
                </p>
                {next && (
                  <p className="mt-1 font-medium">
                    Up next: <span className="text-accent-2">{next.title}</span>
                  </p>
                )}
              </div>
              {next && (
                <Link to={`/learn/${next.slug}`} className="btn-primary">
                  {finished === 0 ? 'Start the path' : 'Continue'}
                </Link>
              )}
            </section>
          )}

          {DIFFICULTIES.map((tier) => {
            const tierCourses = courses
              .filter((c) => c.difficulty === tier)
              .sort((a, b) => a.order - b.order);
            if (tierCourses.length === 0) return null;
            return (
              <TierSection
                key={tier}
                tier={tier}
                courses={tierCourses}
                lessonsByCourse={lessonsByCourse}
                done={done}
              />
            );
          })}

          <section>
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <h2 className="text-lg font-semibold">Puzzles</h2>
              <p className="text-xs text-ink-3">
                Rated on the same scale as players. Start near your rating.
              </p>
            </div>
            {puzzles.length === 0 ? (
              <p className="card text-sm text-ink-3">No puzzles published yet.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {[...puzzlesByTheme.entries()].map(([theme, list]) => (
                  <div key={theme} className="card">
                    <h3 className="mb-2 font-semibold">
                      {PUZZLE_THEME_LABELS[theme as keyof typeof PUZZLE_THEME_LABELS] ?? theme}
                    </h3>
                    <ul className="space-y-1.5">
                      {list.map((puzzle) => (
                        <li key={puzzle.slug}>
                          <Link
                            to={`/learn/puzzle/${puzzle.slug}`}
                            className="flex items-center justify-between gap-2 text-sm hover:text-accent-2"
                          >
                            <span>{puzzle.title}</span>
                            <span className={`chip shrink-0 ${TIER_STYLE[puzzle.difficulty] ?? ''}`}>
                              {puzzle.rating}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="card">
            <h2 className="mb-2 text-lg font-semibold">How to use this</h2>
            <ol className="list-inside list-decimal space-y-1 text-sm text-ink-3">
              <li>Take the lessons of your tier in order. Each one ends with an exercise; do it before reading on.</li>
              <li>Drill the puzzles for that tier until they are quick, then come back to them a few days later.</li>
              <li>Play the tier&rsquo;s bot until you beat it more often than not, then review each game and look for the lesson you missed.</li>
              <li>Move up a tier. The material is written so that each tier is what the next one assumes.</li>
            </ol>
            <p className="mt-3 text-xs text-ink-3">
              The design, and the sources behind it, are documented in the repository&rsquo;s{' '}
              <code>docs/curriculum.md</code>.
            </p>
          </section>
        </div>
      )}
    </div>
  );
}

function TierSection({
  tier,
  courses,
  lessonsByCourse,
  done,
}: {
  tier: Difficulty;
  courses: Course[];
  lessonsByCourse: Map<string, LessonSummary[]>;
  done: Set<string>;
}) {
  const target = DIFFICULTY_TARGETS[tier];
  const bot = BOTS_BY_ID[target.beats];
  const band =
    target.maxRating === null
      ? `${target.minRating}+`
      : target.minRating === 0
        ? `under ${target.maxRating}`
        : `${target.minRating}–${target.maxRating}`;

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-lg font-semibold">{DIFFICULTY_LABELS[tier]}</h2>
        <span className={`chip ${TIER_STYLE[tier]}`}>{band}</span>
        {bot && (
          <span className="text-xs text-ink-3">
            Goal: beat {bot.avatar} {bot.name} ({bot.difficulty})
          </span>
        )}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {courses.map((course) => {
          const list = (lessonsByCourse.get(course.id) ?? []).sort((a, b) => a.order - b.order);
          return (
            <div key={course.id} className="card">
              <h3 className="font-semibold">{course.title}</h3>
              <p className="mb-3 mt-1 text-sm text-ink-3">{course.summary}</p>
              <ol className="space-y-1.5">
                {list.map((lesson, i) => (
                  <li key={lesson.slug}>
                    <Link
                      to={`/learn/${lesson.slug}`}
                      className="flex items-start gap-2 text-sm hover:text-accent-2"
                    >
                      <span
                        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs ${
                          done.has(lesson.slug)
                            ? 'bg-good text-on-accent'
                            : 'bg-surface-2 text-ink-3'
                        }`}
                        aria-label={done.has(lesson.slug) ? 'Finished' : undefined}
                      >
                        {done.has(lesson.slug) ? '✓' : i + 1}
                      </span>
                      <span>
                        <span className="font-medium">{lesson.title}</span>
                        <span className="block text-xs text-ink-3">{lesson.summary}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>
            </div>
          );
        })}
      </div>
    </section>
  );
}
