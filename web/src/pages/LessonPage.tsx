import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { DIFFICULTY_LABELS, type Difficulty, type LessonBlock } from '@connect4gg/engine';
import { api } from '../lib/api';
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

interface LessonSummary {
  slug: string;
  title: string;
}

const LESSONS_DONE_KEY = 'c4gg.lessons.done';

function markDone(slug: string): void {
  try {
    const raw = localStorage.getItem(LESSONS_DONE_KEY);
    const done = new Set<string>(raw ? (JSON.parse(raw) as string[]) : []);
    done.add(slug);
    localStorage.setItem(LESSONS_DONE_KEY, JSON.stringify([...done]));
  } catch {
    // Storage may be unavailable; finishing a lesson still works without it.
  }
}

/**
 * Renders a lesson from its content blocks.
 *
 * Every block type is handled here, so a new lesson is purely a matter of
 * seeding the right blocks — no new components required. The page also knows
 * its neighbours, so a reader can move through a course without going back to
 * the index each time.
 */
export function LessonPage() {
  const { slug } = useParams<{ slug: string }>();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [neighbours, setNeighbours] = useState<{ prev: LessonSummary | null; next: LessonSummary | null }>({
    prev: null,
    next: null,
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    setLesson(null);
    setError(null);
    api
      .get<{ lesson: Lesson }>(`/api/lessons/${slug}`)
      .then((data) => setLesson(data.lesson))
      .catch(() => setError('That lesson could not be found.'));

    api
      .get<{ lessons: LessonSummary[] }>('/api/lessons')
      .then((data) => {
        const index = data.lessons.findIndex((l) => l.slug === slug);
        setNeighbours({
          prev: index > 0 ? data.lessons[index - 1]! : null,
          next: index >= 0 && index < data.lessons.length - 1 ? data.lessons[index + 1]! : null,
        });
      })
      .catch(() => undefined);
  }, [slug]);

  if (error) return <p className="text-center text-ink-3">{error}</p>;
  if (!lesson) return <p className="text-center text-ink-3">Loading…</p>;

  const tierLabel = DIFFICULTY_LABELS[lesson.difficulty as Difficulty] ?? lesson.difficulty;

  return (
    <article className="mx-auto max-w-2xl">
      <Link to="/learn" className="text-sm text-accent-2 hover:underline">
        ← All lessons
      </Link>

      <div className="mt-3 flex items-center gap-2">
        <span className={`chip ${TIER_STYLE[lesson.difficulty] ?? ''}`}>{tierLabel}</span>
      </div>
      <h1 className="mt-2 text-3xl font-bold">{lesson.title}</h1>
      <p className="mt-2 text-ink-3">{lesson.summary}</p>

      <div className="mt-8 space-y-4">
        {lesson.blocks.map((block, index) => (
          <LessonBlockView key={`${lesson.slug}-${index}`} block={block} />
        ))}
      </div>

      <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-surface-2 pt-6">
        {neighbours.prev ? (
          <Link to={`/learn/${neighbours.prev.slug}`} className="btn-ghost">
            ← {neighbours.prev.title}
          </Link>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Link to="/play" className="btn-secondary">
            Try it in a game
          </Link>
          {neighbours.next ? (
            <Link
              to={`/learn/${neighbours.next.slug}`}
              className="btn-primary"
              onClick={() => markDone(lesson.slug)}
            >
              Next: {neighbours.next.title} →
            </Link>
          ) : (
            <Link to="/learn" className="btn-primary" onClick={() => markDone(lesson.slug)}>
              Finish
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
