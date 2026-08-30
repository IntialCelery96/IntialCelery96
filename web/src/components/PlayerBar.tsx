import { Link } from 'react-router-dom';
import type { ClockSnapshot, SeatPayload } from '../lib/socket';
import { playerLabel } from '../lib/format';
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
        active ? 'border-accent/70 bg-accent/5' : 'border-surface-2 bg-surface/40'
      }`}
    >
      <span
        className={`h-4 w-4 shrink-0 rounded-full ${
          player === 1
            ? 'bg-gradient-to-br from-p1 to-p1-deep'
            : 'bg-gradient-to-br from-p2 to-p2-deep'
        }`}
        aria-label={playerLabel(player)}
      />

      <Avatar username={seat.username} avatarUrl={seat.avatarUrl} size="sm" isBot={Boolean(seat.botId)} />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {seat.botId ? (
            <span className="truncate font-semibold">{seat.username}</span>
          ) : (
            <Link
              to={`/profile/${seat.username}`}
              className="truncate font-semibold hover:text-accent-text hover:underline"
            >
              {seat.username}
            </Link>
          )}
          {isYou && <span className="chip bg-accent/15 text-accent-text">you</span>}
          {seat.botId && <span className="chip bg-line-2 text-ink-2">bot</span>}
        </div>

        <div className="flex items-center gap-2 text-xs text-ink-3">
          {seat.rating !== null && <span>{seat.rating}</span>}
          {disconnected && (
            <span className="text-warn" role="status">
              reconnecting…
            </span>
          )}
        </div>
      </div>

      <Clock snapshot={clock} player={player} isYou={isYou} />
    </div>
  );
}
