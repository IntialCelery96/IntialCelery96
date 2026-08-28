import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { LessonBoard } from '../components/LessonBoard';

interface Puzzle {
  slug: string;
  title: string;
  difficulty: string;
  moves: string;
  solver: 1 | 2;
}

/**
 * A single puzzle.
 *
 * Attempts are graded by the server — the accepted answers never reach the
 * client, so the solution cannot be read out of the network tab.
 */
export function PuzzlePage() {
  const { slug } = useParams<{ slug: string }>();
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    api
      .get<{ puzzle: Puzzle }>(`/api/puzzles/${slug}`)
      .then((data) => setPuzzle(data.puzzle))
      .catch(() => setError('That puzzle could not be found.'));
  }, [slug]);

  if (error) return <p className="text-center text-slate-400">{error}</p>;
  if (!puzzle) return <p className="text-center text-slate-400">Loading…</p>;

  return (
    <div className="mx-auto max-w-2xl">
      <Link to="/learn" className="text-sm text-sky-400 hover:underline">
        ← All puzzles
      </Link>

      <h1 className="mt-3 text-3xl font-bold">{puzzle.title}</h1>
      <p className="mt-2 text-slate-400">
        You are playing {puzzle.solver === 1 ? 'Red' : 'Yellow'}.
      </p>

      <LessonBoard
        moves={puzzle.moves}
        guided={{
          prompt: 'Find the winning move.',
          onAttempt: (column) =>
            api.post<{ correct: boolean; explanation: string | null }>(
              `/api/puzzles/${puzzle.slug}/attempt`,
              { column },
            ),
        }}
      />
    </div>
  );
}
