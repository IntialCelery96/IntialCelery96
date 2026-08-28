import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';

interface LessonSummary {
  slug: string;
  title: string;
  summary: string;
  difficulty: string;
  order: number;
}

interface PuzzleSummary {
  slug: string;
  title: string;
  difficulty: string;
  order: number;
}

const TIERS = ['beginner', 'intermediate', 'advanced'] as const;

const TIER_STYLE: Record<string, string> = {
  beginner: 'bg-emerald-500/15 text-emerald-300',
  intermediate: 'bg-amber-500/15 text-amber-300',
  advanced: 'bg-rose-500/15 text-rose-300',
};

/**
 * The curriculum index.
 *
 * Deliberately thin for now — one lesson and one puzzle prove the whole path
 * works, and the roadmap says what comes next. Adding content means seeding
 * rows, not writing components.
 */
export function LearnPage() {
  const [lessons, setLessons] = useState<LessonSummary[]>([]);
  const [puzzles, setPuzzles] = useState<PuzzleSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<{ lessons: LessonSummary[] }>('/api/lessons'),
      api.get<{ puzzles: PuzzleSummary[] }>('/api/puzzles'),
    ])
      .then(([lessonData, puzzleData]) => {
        setLessons(lessonData.lessons);
        setPuzzles(puzzleData.puzzles);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">Learn</h1>
      <p className="mb-6 max-w-prose text-sm text-slate-400">
        Connect 4 is a solved game with real theory behind it — center control, odd and even
        threats, forced sequences. This section is being built out; the lessons below are the first
        of them.
      </p>

      {loading ? (
        <p className="text-slate-400">Loading…</p>
      ) : (
        <div className="space-y-8">
          <section>
            <h2 className="mb-3 text-lg font-semibold">Lessons</h2>
            {lessons.length === 0 ? (
              <p className="card text-sm text-slate-400">No lessons published yet.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {lessons.map((lesson) => (
                  <Link
                    key={lesson.slug}
                    to={`/learn/${lesson.slug}`}
                    className="card transition hover:border-slate-700"
                  >
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <h3 className="font-semibold">{lesson.title}</h3>
                      <span className={`chip shrink-0 ${TIER_STYLE[lesson.difficulty] ?? ''}`}>
                        {lesson.difficulty}
                      </span>
                    </div>
                    <p className="text-sm text-slate-400">{lesson.summary}</p>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold">Puzzles</h2>
            {puzzles.length === 0 ? (
              <p className="card text-sm text-slate-400">No puzzles published yet.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-3">
                {puzzles.map((puzzle) => (
                  <Link
                    key={puzzle.slug}
                    to={`/learn/puzzle/${puzzle.slug}`}
                    className="card transition hover:border-slate-700"
                  >
                    <h3 className="font-semibold">{puzzle.title}</h3>
                    <span className={`chip mt-2 ${TIER_STYLE[puzzle.difficulty] ?? ''}`}>
                      {puzzle.difficulty}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section className="card">
            <h2 className="mb-2 text-lg font-semibold">What's coming</h2>
            <p className="mb-3 text-sm text-slate-400">
              The planned curriculum, roughly in the order it will be taught:
            </p>
            <ul className="grid gap-2 text-sm text-slate-400 sm:grid-cols-2">
              {TIERS.map((tier) => (
                <li key={tier}>
                  <span className={`chip ${TIER_STYLE[tier]}`}>{tier}</span>
                </li>
              ))}
            </ul>
            <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-slate-400">
              <li>Opening theory — why the center column decides the game</li>
              <li>Odd and even threat theory</li>
              <li>Trap patterns, including the classic "7 trap"</li>
              <li>Forced sequences and zugzwang-style squeezes</li>
              <li>Endgame counting</li>
            </ul>
          </section>
        </div>
      )}
    </div>
  );
}
