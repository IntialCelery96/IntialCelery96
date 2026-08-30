import { useMemo } from 'react';

interface Point {
  rating: number;
  delta: number;
  at: string;
}

/**
 * Rating history as a sparkline.
 *
 * Hand-drawn SVG rather than a charting library: this is one series with no
 * interaction beyond a tooltip, and a dependency would cost more than it saves.
 */
export function RatingChart({ points }: { points: Point[] }) {
  const geometry = useMemo(() => {
    if (points.length < 2) return null;

    const width = 600;
    const height = 160;
    const padding = { top: 12, right: 8, bottom: 20, left: 36 };

    const ratings = points.map((p) => p.rating);
    const min = Math.min(...ratings);
    const max = Math.max(...ratings);
    // Pad the range so a flat line doesn't sit on the axis.
    const span = Math.max(40, max - min);
    const low = Math.floor((min - span * 0.1) / 10) * 10;
    const high = Math.ceil((max + span * 0.1) / 10) * 10;

    const plotWidth = width - padding.left - padding.right;
    const plotHeight = height - padding.top - padding.bottom;

    const x = (i: number) => padding.left + (i / (points.length - 1)) * plotWidth;
    const y = (rating: number) =>
      padding.top + plotHeight - ((rating - low) / (high - low)) * plotHeight;

    const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(p.rating)}`).join(' ');
    const area = `${line} L ${x(points.length - 1)} ${padding.top + plotHeight} L ${padding.left} ${
      padding.top + plotHeight
    } Z`;

    return { width, height, padding, low, high, line, area, x, y, plotHeight };
  }, [points]);

  if (!geometry) {
    return (
      <p className="py-8 text-center text-sm text-ink-4">
        Play a few rated games to build a rating history.
      </p>
    );
  }

  const { width, height, padding, low, high, line, area, x, y, plotHeight } = geometry;
  const latest = points[points.length - 1]!;
  const first = points[0]!;
  const trend = latest.rating - first.rating;

  return (
    <div>
      <div className="mb-2 flex items-baseline gap-3">
        <span className="text-2xl font-bold tabular-nums">{latest.rating}</span>
        <span
          className={`text-sm font-medium ${
            trend > 0 ? 'text-good' : trend < 0 ? 'text-bad' : 'text-ink-3'
          }`}
        >
          {trend > 0 ? '+' : ''}
          {trend} over {points.length} games
        </span>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        role="img"
        aria-label={`Rating history: ${points.length} games, currently ${latest.rating}`}
      >
        <defs>
          <linearGradient id="ratingFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0" />
          </linearGradient>
        </defs>

        {[low, Math.round((low + high) / 2), high].map((value) => (
          <g key={value}>
            <line
              x1={padding.left}
              y1={y(value)}
              x2={width - padding.right}
              y2={y(value)}
              stroke="#1e293b"
              strokeWidth="1"
            />
            <text x={padding.left - 6} y={y(value) + 4} textAnchor="end" className="fill-ink-4 text-[10px]">
              {value}
            </text>
          </g>
        ))}

        <path d={area} fill="url(#ratingFill)" />
        <path d={line} fill="none" stroke="#0ea5e9" strokeWidth="2" strokeLinejoin="round" />

        {points.map((point, index) => (
          <circle
            key={index}
            cx={x(index)}
            cy={y(point.rating)}
            r={points.length > 60 ? 0 : 2.5}
            className={point.delta >= 0 ? 'fill-good' : 'fill-bad'}
          >
            <title>
              {point.rating} ({point.delta >= 0 ? '+' : ''}
              {point.delta}) — {new Date(point.at).toLocaleDateString()}
            </title>
          </circle>
        ))}

        <line
          x1={padding.left}
          y1={padding.top + plotHeight}
          x2={width - padding.right}
          y2={padding.top + plotHeight}
          stroke="#334155"
        />
      </svg>
    </div>
  );
}
