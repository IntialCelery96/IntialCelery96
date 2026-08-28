import { useEffect, useState } from 'react';
import type { ClockSnapshot } from '../lib/socket';
import { formatClock } from '../lib/format';

interface ClockProps {
  snapshot: ClockSnapshot;
  player: 1 | 2;
  /** Highlights the clock belonging to the viewer. */
  isYou?: boolean;
}

/**
 * A player's clock.
 *
 * The server sends a snapshot (balances plus the server time it was taken);
 * this component extrapolates locally between snapshots so the display ticks
 * smoothly instead of jumping once a second. The server remains the authority —
 * a local clock reaching zero shows 0:00 but never ends the game.
 */
export function Clock({ snapshot, player, isYou }: ClockProps) {
  const [now, setNow] = useState(() => Date.now());

  const isRunning = snapshot.running === player && !snapshot.untimed;

  useEffect(() => {
    if (!isRunning) return;
    // 100ms keeps the tenths display honest under ten seconds without
    // re-rendering more than it needs to.
    const timer = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(timer);
  }, [isRunning]);

  if (snapshot.untimed) {
    return (
      <div className="rounded-lg bg-slate-800/60 px-3 py-1.5 font-mono text-lg text-slate-400">
        ∞
      </div>
    );
  }

  const base = player === 1 ? snapshot.player1Ms : snapshot.player2Ms;
  // Offset by however long ago the snapshot was taken.
  const elapsed = isRunning ? Math.max(0, now - snapshot.at) : 0;
  const remaining = Math.max(0, base - elapsed);

  const critical = remaining < 10_000;

  return (
    <div
      className={`rounded-lg px-3 py-1.5 font-mono text-lg tabular-nums transition ${
        isRunning
          ? critical
            ? 'bg-rose-950 text-rose-300 ring-1 ring-rose-500'
            : 'bg-slate-700 text-white'
          : 'bg-slate-800/60 text-slate-400'
      } ${isYou ? 'font-semibold' : ''}`}
      aria-label={`${isYou ? 'Your' : "Opponent's"} clock`}
      role="timer"
    >
      {formatClock(remaining)}
    </div>
  );
}
