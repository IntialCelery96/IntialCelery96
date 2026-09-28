import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BOTS_BY_ID,
  DIFFICULTIES,
  DIFFICULTY_LABELS,
  DIFFICULTY_TARGETS,
  LESSONS_BY_SLUG,
  PUZZLE_THEME_LABELS,
  curriculumProgress,
  type Course,
  type CurriculumProgress,
  type Difficulty,
  type LessonProgress,
} from '@connect4gg/engine';
import { api } from '../lib/api';
import { loadSolved } from '../lib/progress';
import { useAuth } from '../context/AuthContext';

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
  lesson: string;
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

/**
 * The curriculum index: four tiers, each a rating band with the bot to beat,
 * split into courses of a few lessons. Lessons open in order — each one's
 * puzzles have to be solved before the next unlocks — so the page reads as a
 * path with a single "continue" rather than a menu.
 */
export function LearnPage() {
  const { user, loading: authLoading } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [lessons, setLessons] = useState<LessonSummary[]>([]);
  const [puzzles, setPuzzles] = useState<PuzzleSummary[]>([]);
  const [progress, setProgress] = useState<CurriculumProgress>(() => curriculumProgress([]));
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    if (authLoading) return;
    void loadSolved(Boolean(user)).then((solved) => setProgress(curriculumProgress(solved)));
  }, [user, authLoading]);

  const progressByLesson = useMemo(
    () => new Map(progress.lessons.map((l) => [l.slug, l])),
    [progress],
  );

  const lessonsByCourse = useMemo(() => {
    const map = new Map<string, LessonSummary[]>();
    for (const lesson of lessons) {
      const list = map.get(lesson.course) ?? [];
      list.push(lesson);
      map.set(lesson.course, list);
    }
    return map;
  }, [lessons]);

  const puzzleTitles = useMemo(() => new Map(puzzles.map((p) => [p.slug, p])), [puzzles]);

  const finishedLessons = progress.lessons.filter((l) => l.complete).length;
  const next = progress.nextLesson ? LESSONS_BY_SLUG[progress.nextLesson] : null;
  const nextPuzzle = progress.nextPuzzle ? puzzleTitles.get(progress.nextPuzzle) : null;

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">Learn</h1>
      <p className="mb-6 max-w-prose text-sm text-ink-3">
        Connect 4 is a solved game with real theory behind it. This path teaches it in the order it
        is needed: the rules, then board sense, then odd and even threats, then the rules that
        solved the game. Each lesson ends with puzzles; solve them to open the next lesson. Every
        diagram is a legal position and every answer is proved by the engine.
      </p>

      {loading ? (
        <p className="text-ink-3">Loading…</p>
      ) : (
        <div className="space-y-10">
          <section className="card">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm text-ink-3">
                  {finishedLessons} of {progress.lessons.length} lessons finished ·{' '}
                  {progress.solved} of {progress.total} puzzles solved
                  {!user && ' · on this device'}
                </p>
                {next ? (
                  <p className="mt-1 font-medium">
                    Up next: <span className="text-accent-2">{next.title}</span>
                    {nextPuzzle && (
                      <span className="text-ink-3">
                        {' '}
                        — puzzle <em>{nextPuzzle.title}</em>
                      </span>
                    )}
                  </p>
                ) : (
                  <p className="mt-1 font-medium">You have finished the path.</p>
                )}
              </div>
              {next && (
                <Link to={`/learn/${next.slug}`} className="btn-primary">
                  {progress.solved === 0 ? 'Start the path' : 'Continue'}
                </Link>
              )}
            </div>
            <ProgressBar value={progress.solved} max={progress.total} />
            {!user && (
              <p className="mt-3 text-xs text-ink-3">
                <Link to="/login" className="text-accent-2 hover:underline">
                  Sign in
                </Link>{' '}
                to keep your progress on your account and pick it up on any device.
              </p>
            )}
          </section>

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
                progressByLesson={progressByLesson}
              />
            );
          })}

          <section>
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <h2 className="text-lg font-semibold">Puzzle library</h2>
              <p className="text-xs text-ink-3">
                Every puzzle, by theme. Rated on the same scale as players.
              </p>
            </div>
            <PuzzleLibrary puzzles={puzzles} progress={progress} />
          </section>

          <section className="card">
            <h2 className="mb-2 text-lg font-semibold">How to use this</h2>
            <ol className="list-inside list-decimal space-y-1 text-sm text-ink-3">
              <li>Read the lesson and do its exercises as you go.</li>
              <li>Solve the puzzles at the end. They open one at a time, and the next lesson opens when they are all done.</li>
              <li>At the end of each tier, play the tier&rsquo;s bot until you beat it more often than not, and review each game for the lesson you missed.</li>
              <li>Come back to solved puzzles a few days later; they stay open and get faster.</li>
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

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max === 0 ? 0 : Math.round((value / max) * 100);
  return (
    <div
      className="mt-3 h-2 w-full overflow-hidden rounded-full bg-surface-2"
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
    >
      <div className="h-full rounded-full bg-good transition-all" style={{ width: `${pct}%` }} />
    </div>
  );
}

function TierSection({
  tier,
  courses,
  lessonsByCourse,
  progressByLesson,
}: {
  tier: Difficulty;
  courses: Course[];
  lessonsByCourse: Map<string, LessonSummary[]>;
  progressByLesson: Map<string, LessonProgress>;
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
                  <LessonRow
                    key={lesson.slug}
                    index={i + 1}
                    lesson={lesson}
                    state={progressByLesson.get(lesson.slug)}
                  />
                ))}
              </ol>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function LessonRow({
  index,
  lesson,
  state,
}: {
  index: number;
  lesson: LessonSummary;
  state: LessonProgress | undefined;
}) {
  const unlocked = state?.unlocked ?? false;
  const complete = state?.complete ?? false;
  const count = state ? `${state.solvedCount}/${state.puzzles.length}` : '';

  const badge = complete ? (
    <span
      className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-good text-xs text-on-accent"
      aria-label="Finished"
    >
      ✓
    </span>
  ) : unlocked ? (
    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-xs text-on-accent">
      {index}
    </span>
  ) : (
    <span
      className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface-2 text-xs text-ink-3"
      aria-label="Locked"
    >
      🔒
    </span>
  );

  const body = (
    <>
      {badge}
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className={`font-medium ${unlocked ? '' : 'text-ink-3'}`}>{lesson.title}</span>
          {count && (
            <span className="shrink-0 text-xs text-ink-3" title="Puzzles solved">
              {count}
            </span>
          )}
        </span>
        <span className="block text-xs text-ink-3">{lesson.summary}</span>
      </span>
    </>
  );

  return (
    <li>
      {unlocked ? (
        <Link to={`/learn/${lesson.slug}`} className="flex items-start gap-2 text-sm hover:text-accent-2">
          {body}
        </Link>
      ) : (
        <div className="flex items-start gap-2 text-sm opacity-70" aria-disabled="true">
          {body}
        </div>
      )}
    </li>
  );
}

function PuzzleLibrary({
  puzzles,
  progress,
}: {
  puzzles: PuzzleSummary[];
  progress: CurriculumProgress;
}) {
  const state = useMemo(() => {
    const map = new Map<string, { unlocked: boolean; solved: boolean }>();
    for (const lesson of progress.lessons) {
      for (const puzzle of lesson.puzzles) map.set(puzzle.slug, puzzle);
    }
    return map;
  }, [progress]);

  const byTheme = useMemo(() => {
    const map = new Map<string, PuzzleSummary[]>();
    for (const puzzle of puzzles) {
      const list = map.get(puzzle.theme) ?? [];
      list.push(puzzle);
      map.set(puzzle.theme, list);
    }
    for (const list of map.values()) list.sort((a, b) => a.rating - b.rating);
    return map;
  }, [puzzles]);

  if (puzzles.length === 0) return <p className="card text-sm text-ink-3">No puzzles published yet.</p>;

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {[...byTheme.entries()].map(([theme, list]) => (
        <div key={theme} className="card">
          <h3 className="mb-2 font-semibold">
            {PUZZLE_THEME_LABELS[theme as keyof typeof PUZZLE_THEME_LABELS] ?? theme}
          </h3>
          <ul className="space-y-1.5">
            {list.map((puzzle) => {
              const s = state.get(puzzle.slug);
              const unlocked = s?.unlocked ?? false;
              const solved = s?.solved ?? false;
              const label = (
                <>
                  <span className="flex items-center gap-1.5">
                    {solved ? (
                      <span className="text-good" aria-label="Solved">
                        ✓
                      </span>
                    ) : !unlocked ? (
                      <span aria-label="Locked">🔒</span>
                    ) : null}
                    {puzzle.title}
                  </span>
                  <span className={`chip shrink-0 ${TIER_STYLE[puzzle.difficulty] ?? ''}`}>
                    {puzzle.rating}
                  </span>
                </>
              );
              return (
                <li key={puzzle.slug}>
                  {unlocked ? (
                    <Link
                      to={`/learn/puzzle/${puzzle.slug}`}
                      className="flex items-center justify-between gap-2 text-sm hover:text-accent-2"
                    >
                      {label}
                    </Link>
                  ) : (
                    <div className="flex items-center justify-between gap-2 text-sm text-ink-3 opacity-70">
                      {label}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
