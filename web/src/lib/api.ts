/**
 * Thin fetch wrapper.
 *
 * Requests are same-origin in dev (Vite proxies /api to the server) and can be
 * pointed at another host with VITE_API_URL in production. `credentials:
 * 'include'` is what carries the session cookie.
 */

const BASE = import.meta.env.VITE_API_URL ?? '';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code: string | null = null,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    ...init,
    headers: {
      ...(init.body instanceof FormData ? {} : { 'content-type': 'application/json' }),
      ...init.headers,
    },
  });

  const text = await response.text();
  const data = text ? (JSON.parse(text) as unknown) : null;

  if (!response.ok) {
    const body = data as { message?: string; code?: string } | null;
    throw new ApiError(
      response.status,
      body?.message ?? `Request failed (${response.status})`,
      body?.code ?? null,
    );
  }

  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: body === undefined ? undefined : JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  upload: <T>(path: string, form: FormData) =>
    request<T>(path, { method: 'POST', body: form }),
};

// --- Shared response shapes -------------------------------------------------

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

export interface SessionUser {
  id: string;
  email: string;
  username: string | null;
  avatarUrl: string | null;
  setupComplete: boolean;
}

export interface RatingSnapshot {
  mode: string;
  rating: number;
  games: number;
  wins: number;
  losses: number;
  draws: number;
  peak: number;
  provisional: boolean;
}

export interface GameSide {
  user: PublicUser | null;
  botId: string | null;
  botName: string | null;
  rating: number | null;
  ratingDelta: number | null;
}

export interface GameSummary {
  id: string;
  mode: string;
  rated: boolean;
  moves: string;
  moveCount: number;
  result: string | null;
  endReason: string | null;
  winnerId: string | null;
  player1: GameSide;
  player2: GameSide;
  initialMs: number;
  incrementMs: number;
  startedAt: string;
  endedAt: string | null;
}

export interface ProfileResponse {
  user: PublicUser;
  ratings: RatingSnapshot[];
  recentGames: GameSummary[];
  followers: number;
  following: number;
  isFollowing: boolean;
  isSelf: boolean;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string | null;
  avatarUrl: string | null;
  avatarColor: string;
  country: string | null;
  rating: number;
  peak: number;
  games: number;
  wins: number;
  losses: number;
  draws: number;
  provisional: boolean;
}

export interface BotInfo {
  id: string;
  name: string;
  rating: number;
  personality: string;
  description: string;
  avatar: string;
}

export interface ModeInfo {
  id: string;
  name: string;
  blurb: string;
  initialMs: number;
  incrementMs: number;
  rated: boolean;
  label: string;
}

// --- Post-game analysis -----------------------------------------------------

export type MoveQuality =
  | 'best'
  | 'good'
  | 'inaccuracy'
  | 'mistake'
  | 'blunder'
  | 'missed_win';

export interface MoveAnalysis {
  ply: number;
  player: 1 | 2;
  column: number;
  quality: MoveQuality;
  bestColumn: number;
  scoreDrop: number;
  note: string | null;
}

export interface PlayerSummary {
  best: number;
  good: number;
  inaccuracy: number;
  mistake: number;
  blunder: number;
  missedWin: number;
  accuracy: number;
}

export interface GameAnalysis {
  moves: MoveAnalysis[];
  players: Record<1 | 2, PlayerSummary>;
  depth: number;
}
