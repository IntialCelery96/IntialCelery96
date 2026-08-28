import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { LessonBlock } from '@connect4gg/engine';
import { api } from '../lib/api';
import { LessonBoard } from '../components/LessonBoard';

interface Lesson {
  slug: string;
  title: string;
  summary: string;
  difficulty: string;
  blocks: LessonBlock[];
}

/**
 * Renders a lesson from its content blocks.
 *
 * Every block type is handled here, so a new lesson is purely a matter of
 * seeding the right blocks — no new components required.
 */
export function LessonPage() {
  const { slug } = useParams<{ slug: string }>();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    api
      .get<{ lesson: Lesson }>(`/api/lessons/${slug}`)
      .then((data) => setLesson(data.lesson))
      .catch(() => setError('That lesson could not be found.'));
  }, [slug]);

  if (error) return <p className="text-center text-slate-400">{error}</p>;
  if (!lesson) return <p className="text-center text-slate-400">Loading…</p>;

  return (
    <article className="mx-auto max-w-2xl">
      <Link to="/learn" className="text-sm text-sky-400 hover:underline">
        ← All lessons
      </Link>

      <h1 className="mt-3 text-3xl font-bold">{lesson.title}</h1>
      <p className="mt-2 text-slate-400">{lesson.summary}</p>

      <div className="mt-8 space-y-4">
        {lesson.blocks.map((block, index) => (
          <LessonBlockView key={index} block={block} />
        ))}
      </div>

      <div className="mt-10 border-t border-slate-800 pt-6">
        <Link to="/play" className="btn-primary">
          Try it in a game
        </Link>
      </div>
    </article>
  );
}

function LessonBlockView({ block }: { block: LessonBlock }) {
  switch (block.kind) {
    case 'prose':
      return <p className="leading-relaxed text-slate-300">{block.text}</p>;

    case 'keyIdea':
      return (
        <aside className="rounded-xl border-l-4 border-sky-500 bg-sky-950/30 p-4">
          <p className="text-sm font-semibold uppercase tracking-wide text-sky-400">Key idea</p>
          <p className="mt-1 text-slate-200">{block.text}</p>
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
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
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

    default:
      return null;
  }
}
