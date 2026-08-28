import { Link } from 'react-router-dom';
import type { ClockSnapshot, SeatPayload } from '../lib/socket';
import { Avatar } from './Avatar';
import { Clock } from './Clock';

interface PlayerBarProps {
  seat: SeatPayload;
  player: 1 | 2;
  clock: ClockSnapshot;
  isYou: boolean;
  /** True while it is this player's move. */
  active: boolean;
}

/** One player's row above or below the board: disc colour, name, clock, status. */
export function PlayerBar({ seat, player, clock, isYou, active }: PlayerBarProps) {
  const disconnected = !seat.connected;

  return (
    <div
      className={`flex items-center gap-3 rounded-xl border px-3 py-2 transition ${
        active ? 'border-sky-500/70 bg-sky-500/5' : 'border-slate-800 bg-slate-900/40'
      }`}
    >
      <span
        className={`h-4 w-4 shrink-0 rounded-full ${
          player === 1
            ? 'bg-gradient-to-br from-red-disc to-red-discDark'
            : 'bg-gradient-to-br from-yellow-disc to-yellow-discDark'
        }`}
        aria-label={player === 1 ? 'Red' : 'Yellow'}
      />

      <Avatar username={seat.username} avatarUrl={seat.avatarUrl} size="sm" isBot={Boolean(seat.botId)} />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {seat.botId ? (
            <span className="truncate font-semibold">{seat.username}</span>
          ) : (
            <Link
              to={`/profile/${seat.username}`}
              className="truncate font-semibold hover:text-sky-300 hover:underline"
            >
              {seat.username}
            </Link>
          )}
          {isYou && <span className="chip bg-sky-500/15 text-sky-300">you</span>}
          {seat.botId && <span className="chip bg-slate-700 text-slate-300">bot</span>}
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-400">
          {seat.rating !== null && <span>{seat.rating}</span>}
          {disconnected && (
            <span className="text-amber-400" role="status">
              reconnecting…
            </span>
          )}
        </div>
      </div>

      <Clock snapshot={clock} player={player} isYou={isYou} />
    </div>
  );
}
