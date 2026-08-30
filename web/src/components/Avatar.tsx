import { AVATAR_PRESETS_BY_ID, avatarDataUri, presetIdFromUrl } from '@connect4gg/engine';
import { initials } from '../lib/format';

interface AvatarProps {
  username: string | null;
  avatarUrl?: string | null;
  /** Deterministic fallback colour from the server, keyed on user id. */
  color?: string | undefined;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  /** Bots get a ring so they are never mistaken for a human account. */
  isBot?: boolean;
}

const SIZES = {
  xs: 'h-6 w-6 text-[10px]',
  sm: 'h-8 w-8 text-xs',
  md: 'h-12 w-12 text-sm',
  lg: 'h-24 w-24 text-2xl',
} as const;

/**
 * A player's avatar, falling back to their initials on a colour derived from
 * their user id — so an account with no photo is still recognisable at a glance
 * in a game list.
 */
export function Avatar({ username, avatarUrl, color, size = 'md', isBot }: AvatarProps) {
  const name = username ?? '?';

  // `avatar:<id>` refers to one of the built-in avatars, drawn inline rather
  // than fetched. Anything else is an uploaded file.
  const presetId = avatarUrl ? presetIdFromUrl(avatarUrl) : null;
  const preset = presetId ? AVATAR_PRESETS_BY_ID[presetId] : undefined;

  if (preset) {
    return (
      <img
        src={avatarDataUri(preset)}
        alt=""
        className={`${SIZES[size]} shrink-0 rounded-full ${
          isBot ? 'ring-2 ring-accent/60' : 'ring-1 ring-line-2'
        }`}
      />
    );
  }

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt=""
        className={`${SIZES[size]} shrink-0 rounded-full object-cover ${
          isBot ? 'ring-2 ring-accent/60' : 'ring-1 ring-line-2'
        }`}
      />
    );
  }

  return (
    <div
      // White, not a theme token: these initials sit on the generated avatar
      // colour rather than on a themed surface, and that colour is mid-lightness
      // in every theme.
      className={`${SIZES[size]} flex shrink-0 items-center justify-center rounded-full font-semibold text-white ${
        isBot ? 'ring-2 ring-accent/60' : 'ring-1 ring-line-2'
      }`}
      style={{ backgroundColor: color ?? '#334155' }}
      aria-hidden="true"
    >
      {initials(name)}
    </div>
  );
}
