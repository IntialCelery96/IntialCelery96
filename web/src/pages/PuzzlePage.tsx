import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  LESSONS_BY_SLUG,
  PUZZLE_THEME_LABELS,
  curriculumProgress,
  lessonAfter,
  puzzlesForLesson,
  type PuzzleTheme,
} from '@connect4gg/engine';
import { ApiError, api } from '../lib/api';
import { loadSolved, recordSolved } from '../lib/progress';
import { useAuth } from '../context/AuthContext';
import { LessonBoard } from '../components/LessonBoard';
import { TIER_STYLE } from './LearnPage';

interface Puzzle {
  slug: string;
  title: string;
  difficulty: string;
  lesson: string;
  theme: string;
  rating: number;
  prompt: string;
  moves: string;
  solver: 1 | 2;
}

/**
 * A single puzzle, at the end of its lesson.
 *
 * Attempts are graded by the server — the accepted answers never reach the
 * client, so the solution cannot be read out of the network tab. A correct
 * answer is recorded as progress, which is what opens the next puzzle in the
 * lesson, and after the last one, the next lesson.
 */
export function PuzzlePage() {
  const { slug } = useParams<{ slug: string }>();
  const { user, loading: authLoading } = useAuth();
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [solved, setSolved] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    setPuzzle(null);
    setError(null);
    api
      .get<{ puzzle: Puzzle }>(`/api/puzzles/${slug}`)
      .then((data) => setPuzzle(data.puzzle))
      .catch(() => setError('That puzzle could not be found.'));
  }, [slug]);

  useEffect(() => {
    if (authLoading) return;
    void loadSolved(Boolean(user)).then(setSolved);
  }, [user, authLoading, slug]);

  const progress = useMemo(() => (solved ? curriculumProgress(solved) : null), [solved]);

  if (error) return <p className="text-center text-ink-3">{error}</p>;
  if (!puzzle || !progress) return <p className="text-center text-ink-3">Loading…</p>;

  const lesson = LESSONS_BY_SLUG[puzzle.lesson];
  const lessonState = progress.lessons.find((l) => l.slug === puzzle.lesson);
  const state = lessonState?.puzzles.find((p) => p.slug === puzzle.slug);
  const unlocked = state?.unlocked ?? false;
  const alreadySolved = state?.solved ?? false;
  const themeLabel = PUZZLE_THEME_LABELS[puzzle.theme as PuzzleTheme] ?? puzzle.theme;

  const siblings = puzzlesForLesson(puzzle.lesson);
  const position = siblings.findIndex((p) => p.slug === puzzle.slug);
  const nextInLesson = siblings[position + 1] ?? null;
  const nextLesson = lesson ? lessonAfter(lesson.slug) : null;
  const lessonDone = lessonState?.complete ?? false;

  const header = (
    <>
      <Link to={lesson ? `/learn/${lesson.slug}` : '/learn'} className="text-sm text-accent-2 hover:underline">
        ← {lesson ? lesson.title : 'All lessons'}
      </Link>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className={`chip ${TIER_STYLE[puzzle.difficulty] ?? ''}`}>Rated {puzzle.rating}</span>
        <span className="chip bg-surface-2 text-ink-3">{themeLabel}</span>
        {siblings.length > 1 && (
          <span className="text-xs text-ink-3">
            Puzzle {position + 1} of {siblings.length}
          </span>
        )}
        {alreadySolved && <span className="chip bg-good/15 text-good">Solved</span>}
      </div>
      <h1 className="mt-2 text-3xl font-bold">{puzzle.title}</h1>
    </>
  );

  if (!unlocked) {
    return (
      <div className="mx-auto max-w-2xl">
        {header}
        <div className="card mt-6">
          <p className="font-medium">This puzzle is not open yet.</p>
          <p className="mt-1 text-sm text-ink-3">
            Puzzles open one at a time, at the end of their lesson. Solve the ones before it first.
          </p>
          <Link to={lesson ? `/learn/${lesson.slug}` : '/learn'} className="btn-primary mt-4">
            Back to {lesson ? lesson.title : 'the path'} →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      {header}
      <p className="mt-2 text-ink-3">
        You are playing {puzzle.solver === 1 ? 'first' : 'second'}.
      </p>

      <LessonBoard
        key={puzzle.slug}
        moves={puzzle.moves}
        guided={{
          prompt: puzzle.prompt,
          onAttempt: async (column) => {
            try {
              const result = await api.post<{ correct: boolean; explanation: string | null }>(
                `/api/puzzles/${puzzle.slug}/attempt`,
                { column },
              );
              if (result.correct) setSolved(recordSolved(puzzle.slug));
              return result;
            } catch (e) {
              if (e instanceof ApiError && e.code === 'PUZZLE_LOCKED') {
                setSolved(await loadSolved(Boolean(user)));
              }
              throw e;
            }
          },
        }}
      />

      {alreadySolved && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-surface-2 pt-4">
          <p className="text-sm text-ink-3">
            {lessonDone
              ? nextLesson
                ? `Lesson finished. ${nextLesson.title} is open.`
                : 'That was the last puzzle on the path.'
              : nextInLesson
                ? 'Next puzzle unlocked.'
                : ''}
          </p>
          {nextInLesson && !lessonDone ? (
            <Link to={`/learn/puzzle/${nextInLesson.slug}`} className="btn-primary">
              Next puzzle: {nextInLesson.title} ({nextInLesson.rating}) →
            </Link>
          ) : lessonDone && nextLesson ? (
            <Link to={`/learn/${nextLesson.slug}`} className="btn-primary">
              Next lesson: {nextLesson.title} →
            </Link>
          ) : (
            <Link to="/learn" className="btn-primary">
              Back to the path
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
