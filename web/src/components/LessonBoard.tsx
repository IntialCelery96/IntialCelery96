import { useMemo, useState } from 'react';
import { legalMoves, parseMoves, replay } from '@connect4gg/engine';
import { Board } from './Board';

/**
 * A board for teaching, wrapping the same component the live game uses.
 *
 * Two modes:
 *  - read-only diagram, for illustrating a position in a lesson;
 *  - guided move, where the reader must find a specific column and gets
 *    feedback. The `onAttempt` hook lets a puzzle grade server-side while a
 *    lesson's inline "try it" grades locally.
 *
 * Sharing the underlying Board is the point: a diagram in a lesson is
 * guaranteed to look and behave like the real game.
 */

export interface LessonBoardProps {
  /** Columns replayed from an empty board to reach the position. */
  moves: number[] | string;
  /** Board indices to ring — the squares under discussion. */
  highlight?: number[] | undefined;
  /** When set, the reader may play one move and is told whether it is right. */
  guided?:
    | {
        /** Accepted columns, for local grading. Ignored when `onAttempt` is set. */
        answers?: number[];
        /** Server-side grading, used by puzzles so answers stay hidden. */
        onAttempt?: (column: number) => Promise<{ correct: boolean; explanation: string | null }>;
        prompt?: string;
        explanation?: string;
      }
    | undefined;
  compact?: boolean;
  caption?: string;
}

type Attempt = { column: number; correct: boolean; explanation: string | null } | null;

export function LessonBoard({ moves, highlight, guided, compact, caption }: LessonBoardProps) {
  const [attempt, setAttempt] = useState<Attempt>(null);
  const [checking, setChecking] = useState(false);

  const columns = useMemo(
    () => (typeof moves === 'string' ? parseMoves(moves) : moves),
    [moves],
  );

  const position = useMemo(() => replay(columns), [columns]);

  // A correct guided move is played onto the board so the reader sees the result.
  const displayed = useMemo(() => {
    if (!attempt?.correct) return position;
    return replay([...columns, attempt.column]);
  }, [position, columns, attempt]);

  async function handleDrop(column: number): Promise<void> {
    if (!guided || checking || attempt?.correct) return;
    setChecking(true);

    try {
      if (guided.onAttempt) {
        const result = await guided.onAttempt(column);
        setAttempt({ column, correct: result.correct, explanation: result.explanation });
      } else {
        const correct = (guided.answers ?? []).includes(column);
        setAttempt({
          column,
          correct,
          explanation: correct ? (guided.explanation ?? null) : null,
        });
      }
    } catch {
      setAttempt({ column, correct: false, explanation: null });
    } finally {
      setChecking(false);
    }
  }

  return (
    <figure className="my-4">
      {guided?.prompt && (
        <p className="mb-3 font-medium text-slate-200">{guided.prompt}</p>
      )}

      <div className="flex justify-center">
        <Board
          board={displayed.board}
          onDrop={guided && !attempt?.correct ? (column) => void handleDrop(column) : undefined}
          legalMoves={guided && !attempt?.correct ? legalMoves(displayed) : undefined}
          previewPlayer={guided ? position.turn : undefined}
          highlight={attempt?.correct ? (displayed.winningLine ?? highlight) : highlight}
          compact={compact}
          label={caption ?? 'Board diagram'}
        />
      </div>

      {caption && (
        <figcaption className="mt-2 text-center text-sm text-slate-400">{caption}</figcaption>
      )}

      {attempt && (
        <div
          className={`mt-3 rounded-lg border p-3 text-sm ${
            attempt.correct
              ? 'border-emerald-700 bg-emerald-950/40 text-emerald-200'
              : 'border-rose-800 bg-rose-950/40 text-rose-200'
          }`}
          role="status"
        >
          <p className="font-medium">
            {attempt.correct ? 'Correct.' : `Column ${attempt.column + 1} is not it.`}
          </p>
          {attempt.explanation && <p className="mt-1 opacity-90">{attempt.explanation}</p>}
          {!attempt.correct && (
            <button
              type="button"
              onClick={() => setAttempt(null)}
              className="mt-2 text-xs underline hover:no-underline"
            >
              Try again
            </button>
          )}
        </div>
      )}
    </figure>
  );
}
