import { prisma } from '../lib/db.js';
import { defaultAvatarFor } from '../lib/storage.js';
import { screenUsername } from './moderation.js';

/**
 * Usernames are the site's public identity, so they get real rules: a stable
 * character set, a length that fits a leaderboard row, and a reserved list so
 * nobody registers "admin" or "settings" and breaks routing or trust.
 */
export const USERNAME_PATTERN = /^[a-zA-Z0-9](?:[a-zA-Z0-9_-]{1,18}[a-zA-Z0-9])$/;
export const USERNAME_MIN = 3;
export const USERNAME_MAX = 20;
export const USERNAME_COOLDOWN_DAYS = 30;

const RESERVED_USERNAMES = new Set([
  'admin', 'administrator', 'root', 'system', 'moderator', 'mod', 'staff',
  'support', 'help', 'about', 'settings', 'account', 'login', 'logout',
  'register', 'signup', 'signin', 'play', 'game', 'games', 'watch', 'learn',
  'leaderboard', 'leaderboards', 'profile', 'user', 'users', 'api', 'null',
  'undefined', 'connect4', 'connect4gg', 'bot', 'bots', 'anonymous', 'guest',
]);

export interface UsernameCheck {
  ok: boolean;
  reason?: string;
}

export function validateUsernameFormat(username: string): UsernameCheck {
  if (username.length < USERNAME_MIN || username.length > USERNAME_MAX) {
    return { ok: false, reason: `Username must be ${USERNAME_MIN}-${USERNAME_MAX} characters` };
  }
  if (!USERNAME_PATTERN.test(username)) {
    return {
      ok: false,
      reason: 'Use letters, numbers, hyphens and underscores; start and end with a letter or number',
    };
  }
  if (RESERVED_USERNAMES.has(username.toLowerCase())) {
    return { ok: false, reason: 'That username is reserved' };
  }

  // Content screening runs last, so a name that fails for a boring structural
  // reason gets the boring message rather than an accusatory one.
  const screened = screenUsername(username);
  if (!screened.ok) {
    return { ok: false, reason: screened.message ?? 'That username is not allowed' };
  }

  return { ok: true };
}

/** Format check plus a uniqueness check, ignoring case. */
export async function checkUsernameAvailable(
  username: string,
  excludeUserId?: string,
): Promise<UsernameCheck> {
  const format = validateUsernameFormat(username);
  if (!format.ok) return format;

  const existing = await prisma.user.findUnique({
    where: { usernameLower: username.toLowerCase() },
    select: { id: true },
  });

  if (existing && existing.id !== excludeUserId) {
    return { ok: false, reason: 'That username is taken' };
  }
  return { ok: true };
}

/** Days remaining before this user may change their username again. */
export function usernameCooldownRemaining(changedAt: Date | null): number {
  if (!changedAt) return 0;
  const elapsedDays = (Date.now() - changedAt.getTime()) / (24 * 60 * 60 * 1000);
  return Math.max(0, Math.ceil(USERNAME_COOLDOWN_DAYS - elapsedDays));
}

/**
 * Suggests a starting username from an email or Google display name, so the
 * setup screen can prefill something sensible rather than an empty box.
 */
export function suggestUsername(seed: string): string {
  const base = seed
    .split('@')[0]!
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, USERNAME_MAX - 4);
  const padded = base.length >= USERNAME_MIN ? base : `player${base}`;
  return padded.slice(0, USERNAME_MAX - 4);
}

export interface PublicUser {
  id: string;
  username: string | null;
  avatarUrl: string | null;
  avatarColor: string;
  bio: string | null;
  country: string | null;
  createdAt: string;
  isBot: boolean;
}

export function toPublicUser(user: {
  id: string;
  username: string | null;
  avatarUrl: string | null;
  bio: string | null;
  country: string | null;
  createdAt: Date;
  isBot: boolean;
}): PublicUser {
  return {
    id: user.id,
    username: user.username,
    avatarUrl: user.avatarUrl,
    avatarColor: defaultAvatarFor(user.id),
    bio: user.bio,
    country: user.country,
    createdAt: user.createdAt.toISOString(),
    isBot: user.isBot,
  };
}

export const PUBLIC_USER_SELECT = {
  id: true,
  username: true,
  avatarUrl: true,
  bio: true,
  country: true,
  createdAt: true,
  isBot: true,
} as const;

export async function findByUsername(username: string) {
  return prisma.user.findUnique({
    where: { usernameLower: username.toLowerCase() },
    select: PUBLIC_USER_SELECT,
  });
}

/** Prefix search for the user search box. Bots are excluded. */
export async function searchUsers(query: string, limit = 10): Promise<PublicUser[]> {
  const term = query.trim().toLowerCase();
  if (term.length < 2) return [];

  const rows = await prisma.user.findMany({
    where: {
      usernameLower: { startsWith: term },
      setupComplete: true,
      isBot: false,
    },
    select: PUBLIC_USER_SELECT,
    orderBy: { usernameLower: 'asc' },
    take: Math.min(limit, 25),
  });

  return rows.map(toPublicUser);
}

export async function touchLastSeen(userId: string): Promise<void> {
  await prisma.user
    .update({ where: { id: userId }, data: { lastSeenAt: new Date() } })
    .catch(() => undefined);
}
