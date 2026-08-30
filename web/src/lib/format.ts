/** Small display helpers shared across screens. */

/**
 * Clock display. Under ten seconds it switches to tenths, which is the point
 * at which a player needs to see time draining rather than just read a number.
 */
export function formatClock(ms: number): string {
  const clamped = Math.max(0, ms);
  const totalSeconds = clamped / 1000;

  if (clamped < 10_000) {
    return totalSeconds.toFixed(1);
  }

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function formatRatingDelta(delta: number | null): string {
  if (delta === null) return '';
  if (delta > 0) return `+${delta}`;
  return String(delta);
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const seconds = Math.round((Date.now() - then) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604_800) return `${Math.floor(seconds / 86_400)}d ago`;
  return formatDate(iso);
}

/** A two-letter country code rendered as a flag emoji. */
export function countryFlag(code: string | null): string {
  if (!code || code.length !== 2) return '';
  const base = 0x1f1e6;
  return String.fromCodePoint(
    ...[...code.toUpperCase()].map((c) => base + (c.charCodeAt(0) - 65)),
  );
}

const REASON_TEXT: Record<string, string> = {
  CONNECT_FOUR: 'by connecting four',
  BOARD_FULL: 'the board filled up',
  RESIGNATION: 'by resignation',
  TIMEOUT: 'on time',
  DRAW_AGREED: 'by agreement',
  ABANDONED: 'by abandonment',
  ABORTED: 'the game was aborted',
};

export function describeReason(reason: string | null): string {
  if (!reason) return '';
  return REASON_TEXT[reason] ?? reason.toLowerCase().replace(/_/g, ' ');
}

export function initials(name: string): string {
  return name.slice(0, 2).toUpperCase();
}

/**
 * What to call each side.
 *
 * Not "Red" and "Yellow": the discs are themed, and under four of the five
 * themes those names are simply wrong. Turn order is the one property that
 * holds whatever the board looks like — the same reason chess says White and
 * Black regardless of how a set is coloured.
 */
export function playerName(player: 1 | 2): string {
  return player === 1 ? 'First' : 'Second';
}

/** Longer form, for screen readers and prose. */
export function playerLabel(player: 1 | 2): string {
  return player === 1 ? 'first player' : 'second player';
}
