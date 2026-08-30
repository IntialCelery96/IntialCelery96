import { useMemo } from 'react';
import type { MoveAnalysis } from '../lib/api';

/**
 * How the game stood, move by move.
 *
 * Above the midline the first player is on top; below it the second is. The
 * shape is the point — a review is much easier to read when you can see where
 * the game turned before reading about it — so the graph is also the fastest
 * way to jump to that moment.
 */
export function EvalGraph({
  moves,
  currentPly,
  onSelectPly,
}: {
  moves: MoveAnalysis[];
  /** 1-based: how many moves are shown on the board. */
  currentPly: number;
  onSelectPly: (ply: number) => void;
}) {
  const geometry = useMemo(() => {
    if (moves.length === 0) return null;

    const width = 300;
    const height = 84;
    const mid = height / 2;

    // A point per move, plus the even starting position at x = 0.
    const points = [0, ...moves.map((m) => m.evalAfter)];
    const step = width / Math.max(1, points.length - 1);

    const x = (i: number) => i * step;
    const y = (value: number) => mid - value * (mid - 4);

    const line = points.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(v)}`).join(' ');
    const area = `${line} L ${x(points.length - 1)} ${mid} L 0 ${mid} Z`;

    return { width, height, mid, points, step, x, y, line, area };
  }, [moves]);

  if (!geometry) return null;

  const { width, height, mid, points, step, x, y, line, area } = geometry;

  return (
    <div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        role="img"
        aria-label="How the advantage moved through the game"
        preserveAspectRatio="none"
        style={{ height: 84 }}
      >
        <defs>
          <linearGradient id="evalFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgb(var(--c-p1))" stopOpacity="0.5" />
            <stop offset="50%" stopColor="rgb(var(--c-p1))" stopOpacity="0.05" />
            <stop offset="50%" stopColor="rgb(var(--c-p2))" stopOpacity="0.05" />
            <stop offset="100%" stopColor="rgb(var(--c-p2))" stopOpacity="0.5" />
          </linearGradient>
        </defs>

        <rect width={width} height={height} fill="rgb(var(--c-slot))" />
        <path d={area} fill="url(#evalFill)" />
        <line
          x1="0"
          y1={mid}
          x2={width}
          y2={mid}
          stroke="rgb(var(--c-line-2))"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d={line}
          fill="none"
          stroke="rgb(var(--c-ink-2))"
          strokeWidth="1.5"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />

        {/* Where the board currently sits. */}
        <line
          x1={x(currentPly)}
          y1="0"
          x2={x(currentPly)}
          y2={height}
          stroke="rgb(var(--c-accent))"
          strokeWidth="1.5"
          vectorEffect="non-scaling-stroke"
        />
        <circle
          cx={x(currentPly)}
          cy={y(points[currentPly] ?? 0)}
          r="3"
          fill="rgb(var(--c-accent))"
        />

        {/* Invisible hit targets, so the graph is a scrubber as well as a chart. */}
        {points.map((_, i) => (
          <rect
            key={i}
            x={x(i) - step / 2}
            y={0}
            width={step}
            height={height}
            fill="transparent"
            className="cursor-pointer"
            onClick={() => onSelectPly(i)}
          >
            <title>{i === 0 ? 'Start' : `Move ${i}`}</title>
          </rect>
        ))}
      </svg>

      <div className="mt-1 flex justify-between text-[10px] uppercase tracking-wide text-ink-4">
        <span>First ahead</span>
        <span>Second ahead</span>
      </div>
    </div>
  );
}
