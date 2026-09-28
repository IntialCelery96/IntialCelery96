import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  DIFFICULTY_LABELS,
  PUZZLE_THEME_LABELS,
  curriculumProgress,
  lessonAfter,
  lessonBefore,
  puzzlesForLesson,
  type Difficulty,
  type LessonBlock,
} from '@connect4gg/engine';
import { api } from '../lib/api';
import { loadSolved } from '../lib/progress';
import { useAuth } from '../context/AuthContext';
import { LessonBoard } from '../components/LessonBoard';
import { TIER_STYLE } from './LearnPage';

interface Lesson {
  slug: string;
  title: string;
  summary: string;
  difficulty: string;
  course: string;
  blocks: LessonBlock[];
}

/**
 * Renders a lesson from its content blocks, with its puzzles at the end.
 *
 * Every block type is handled here, so a new lesson is purely a matter of
 * seeding the right blocks — no new components required. The lesson is
 * gated: it opens once the previous lesson's puzzles are solved, and its own
 * puzzles open one at a time. The rule lives in the engine, so this page only
 * draws the state.
 */
export function LessonPage() {
  const { slug } = useParams<{ slug: string }>();
  const { user, loading: authLoading } = useAuth();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [solved, setSolved] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    setLesson(null);
    setError(null);
    api
      .get<{ lesson: Lesson }>(`/api/lessons/${slug}`)
      .then((data) => setLesson(data.lesson))
      .catch(() => setError('That lesson could not be found.'));
  }, [slug]);

  useEffect(() => {
    if (authLoading) return;
    void loadSolved(Boolean(user)).then(setSolved);
  }, [user, authLoading, slug]);

  const progress = useMemo(() => (solved ? curriculumProgress(solved) : null), [solved]);
  const state = progress?.lessons.find((l) => l.slug === slug) ?? null;

  if (error) return <p className="text-center text-ink-3">{error}</p>;
  if (!lesson || !progress || !state) return <p className="text-center text-ink-3">Loading…</p>;

  const tierLabel = DIFFICULTY_LABELS[lesson.difficulty as Difficulty] ?? lesson.difficulty;
  const previous = lessonBefore(lesson.slug);
  const next = lessonAfter(lesson.slug);

  if (!state.unlocked) {
    return (
      <article className="mx-auto max-w-2xl">
        <Link to="/learn" className="text-sm text-accent-2 hover:underline">
          ← All lessons
        </Link>
        <div className="mt-3 flex items-center gap-2">
          <span className={`chip ${TIER_STYLE[lesson.difficulty] ?? ''}`}>{tierLabel}</span>
          <span className="chip bg-surface-2 text-ink-3">Locked</span>
        </div>
        <h1 className="mt-2 text-3xl font-bold">{lesson.title}</h1>
        <p className="mt-2 text-ink-3">{lesson.summary}</p>
        <div className="card mt-8">
          <p className="font-medium">This lesson is not open yet.</p>
          <p className="mt-1 text-sm text-ink-3">
            Lessons open in order. Finish the one before it — and its puzzles — and this one
            unlocks.
          </p>
          {progress.nextLesson && (
            <Link to={`/learn/${progress.nextLesson}`} className="btn-primary mt-4">
              Go to {previous && progress.nextLesson === previous.slug ? previous.title : 'the next open lesson'} →
            </Link>
          )}
        </div>
      </article>
    );
  }

  const puzzles = puzzlesForLesson(lesson.slug);
  const puzzleState = new Map(state.puzzles.map((p) => [p.slug, p]));
  const nextPuzzle = state.puzzles.find((p) => p.unlocked && !p.solved) ?? null;

  return (
    <article className="mx-auto max-w-2xl">
      <Link to="/learn" className="text-sm text-accent-2 hover:underline">
        ← All lessons
      </Link>

      <div className="mt-3 flex items-center gap-2">
        <span className={`chip ${TIER_STYLE[lesson.difficulty] ?? ''}`}>{tierLabel}</span>
        {state.complete && <span className="chip bg-good/15 text-good">Finished</span>}
      </div>
      <h1 className="mt-2 text-3xl font-bold">{lesson.title}</h1>
      <p className="mt-2 text-ink-3">{lesson.summary}</p>

      <div className="mt-8 space-y-4">
        {lesson.blocks.map((block, index) => (
          <LessonBlockView key={`${lesson.slug}-${index}`} block={block} />
        ))}
      </div>

      <section className="mt-10 border-t border-surface-2 pt-6" aria-labelledby="practice">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="practice" className="text-lg font-semibold">
            Practice
          </h2>
          <span className="text-xs text-ink-3">
            {state.solvedCount} of {puzzles.length} solved
          </span>
        </div>
        <p className="mt-1 text-sm text-ink-3">
          {state.complete
            ? 'All done. The puzzles stay open, so come back to them in a few days and see how much faster they are.'
            : next
              ? `Solve ${puzzles.length === 1 ? 'this puzzle' : 'these puzzles'} to open the next lesson, ${next.title}.`
              : `Solve ${puzzles.length === 1 ? 'this puzzle' : 'these puzzles'} to finish the path.`}
        </p>
        <ol className="mt-4 space-y-2">
          {puzzles.map((puzzle, i) => {
            const s = puzzleState.get(puzzle.slug);
            const unlocked = s?.unlocked ?? false;
            const isSolved = s?.solved ?? false;
            const row = (
              <>
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs ${
                    isSolved
                      ? 'bg-good text-on-accent'
                      : unlocked
                        ? 'bg-accent text-on-accent'
                        : 'bg-surface-2 text-ink-3'
                  }`}
                  aria-label={isSolved ? 'Solved' : unlocked ? 'Open' : 'Locked'}
                >
                  {isSolved ? '✓' : unlocked ? i + 1 : '🔒'}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="font-medium">{puzzle.title}</span>
                  <span className="block text-xs text-ink-3">
                    {PUZZLE_THEME_LABELS[puzzle.theme]} · rated {puzzle.rating}
                  </span>
                </span>
                {unlocked && !isSolved && (
                  <span className="shrink-0 text-xs text-accent-2">Solve →</span>
                )}
              </>
            );
            return (
              <li key={puzzle.slug} className="card">
                {unlocked ? (
                  <Link to={`/learn/puzzle/${puzzle.slug}`} className="flex items-center gap-3 hover:text-accent-2">
                    {row}
                  </Link>
                ) : (
                  <div className="flex items-center gap-3 opacity-60" aria-disabled="true">
                    {row}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </section>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-surface-2 pt-6">
        {previous ? (
          <Link to={`/learn/${previous.slug}`} className="btn-ghost">
            ← {previous.title}
          </Link>
        ) : (
          <span />
        )}
        <div className="flex flex-wrap gap-2">
          <Link to="/play" className="btn-secondary">
            Try it in a game
          </Link>
          {nextPuzzle ? (
            <Link to={`/learn/puzzle/${nextPuzzle.slug}`} className="btn-primary">
              {state.solvedCount === 0 ? 'Start the puzzles' : 'Next puzzle'} →
            </Link>
          ) : next ? (
            <Link to={`/learn/${next.slug}`} className="btn-primary">
              Next: {next.title} →
            </Link>
          ) : (
            <Link to="/learn" className="btn-primary">
              Back to the path
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}

function LessonBlockView({ block }: { block: LessonBlock }) {
  switch (block.kind) {
    case 'prose':
      return <p className="leading-relaxed text-ink-2">{block.text}</p>;

    case 'keyIdea':
      return (
        <aside className="rounded-xl border-l-4 border-accent bg-accent/30 p-4">
          <p className="text-sm font-semibold uppercase tracking-wide text-accent-2">Key idea</p>
          <p className="mt-1 text-ink">{block.text}</p>
        </aside>
      );

    case 'board':
      return (
        <LessonBoard
          moves={block.moves}
          highlight={block.highlight}
          caption={block.caption}
          compact
        />
      );

    case 'tryIt':
      return (
        <div className="rounded-xl border border-surface-2 bg-surface/40 p-4">
          <LessonBoard
            moves={block.moves}
            compact
            guided={{
              answers: block.answers,
              prompt: block.prompt,
              explanation: block.explanation,
            }}
          />
        </div>
      );

    case 'reference':
      return (
        <aside className="mt-6 rounded-xl border border-surface-2 p-4">
          <p className="text-sm font-semibold uppercase tracking-wide text-ink-3">Sources</p>
          <ul className="mt-2 space-y-2 text-sm">
            {block.sources.map((source, i) => (
              <li key={i}>
                {source.url ? (
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-accent-2 hover:underline"
                  >
                    {source.title}
                  </a>
                ) : (
                  <span className="font-medium">{source.title}</span>
                )}
                <span className="text-ink-3"> — {source.citation}</span>
                {source.note && <p className="mt-0.5 text-xs text-ink-3">{source.note}</p>}
              </li>
            ))}
          </ul>
        </aside>
      );

    default:
      return null;
  }
}
