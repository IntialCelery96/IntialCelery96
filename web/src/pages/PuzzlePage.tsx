import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PUZZLE_THEME_LABELS, type PuzzleTheme } from '@connect4gg/engine';
import { api } from '../lib/api';
import { LessonBoard } from '../components/LessonBoard';
import { TIER_STYLE } from './LearnPage';

interface Puzzle {
  slug: string;
  title: string;
  difficulty: string;
  theme: string;
  rating: number;
  prompt: string;
  moves: string;
  solver: 1 | 2;
}

interface PuzzleSummary {
  slug: string;
  title: string;
  rating: number;
}

/**
 * A single puzzle.
 *
 * Attempts are graded by the server — the accepted answers never reach the
 * client, so the solution cannot be read out of the network tab. The page
 * shows the theme and rating the way a chess site does, and offers the next
 * puzzle up the rating ladder once this one is done.
 */
export function PuzzlePage() {
  const { slug } = useParams<{ slug: string }>();
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [next, setNext] = useState<PuzzleSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    setPuzzle(null);
    setError(null);
    api
      .get<{ puzzle: Puzzle }>(`/api/puzzles/${slug}`)
      .then((data) => setPuzzle(data.puzzle))
      .catch(() => setError('That puzzle could not be found.'));

    api
      .get<{ puzzles: PuzzleSummary[] }>('/api/puzzles')
      .then((data) => {
        const index = data.puzzles.findIndex((p) => p.slug === slug);
        setNext(index >= 0 && index < data.puzzles.length - 1 ? data.puzzles[index + 1]! : null);
      })
      .catch(() => undefined);
  }, [slug]);

  if (error) return <p className="text-center text-ink-3">{error}</p>;
  if (!puzzle) return <p className="text-center text-ink-3">Loading…</p>;

  const themeLabel = PUZZLE_THEME_LABELS[puzzle.theme as PuzzleTheme] ?? puzzle.theme;

  return (
    <div className="mx-auto max-w-2xl">
      <Link to="/learn" className="text-sm text-accent-2 hover:underline">
        ← All puzzles
      </Link>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className={`chip ${TIER_STYLE[puzzle.difficulty] ?? ''}`}>Rated {puzzle.rating}</span>
        <span className="chip bg-surface-2 text-ink-3">{themeLabel}</span>
      </div>
      <h1 className="mt-2 text-3xl font-bold">{puzzle.title}</h1>
      <p className="mt-2 text-ink-3">
        You are playing {puzzle.solver === 1 ? 'first' : 'second'}.
      </p>

      <LessonBoard
        key={puzzle.slug}
        moves={puzzle.moves}
        guided={{
          prompt: puzzle.prompt,
          onAttempt: (column) =>
            api.post<{ correct: boolean; explanation: string | null }>(
              `/api/puzzles/${puzzle.slug}/attempt`,
              { column },
            ),
        }}
      />

      {next && (
        <div className="mt-6 flex justify-end border-t border-surface-2 pt-4">
          <Link to={`/learn/puzzle/${next.slug}`} className="btn-primary">
            Next puzzle: {next.title} ({next.rating}) →
          </Link>
        </div>
      )}
    </div>
  );
}
