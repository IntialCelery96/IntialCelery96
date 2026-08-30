import { ApiError } from '../lib/api';
import * as fixtures from './fixtures';

/**
 * Resolves API paths against the fixtures, for the standalone demo build.
 *
 * Matching is on the same paths the real server serves, so the pages call
 * exactly what they always call and never learn they are in a demo.
 */

type Handler = (match: RegExpMatchArray, body: unknown) => unknown;

interface Route {
  method: string;
  pattern: RegExp;
  handler: Handler;
}

const routes: Route[] = [
  {
    method: 'GET',
    pattern: /^\/api\/auth\/me$/,
    handler: () => ({ user: fixtures.viewer, needsSetup: false, googleEnabled: false }),
  },
  {
    method: 'POST',
    pattern: /^\/api\/auth\/(login|register)$/,
    handler: () => ({ user: fixtures.viewer, needsSetup: false }),
  },
  { method: 'POST', pattern: /^\/api\/auth\/logout$/, handler: () => ({ ok: true }) },

  {
    method: 'GET',
    pattern: /^\/api\/config$/,
    handler: () => ({ modes: fixtures.modes, bots: fixtures.bots }),
  },
  { method: 'GET', pattern: /^\/api\/stats$/, handler: () => fixtures.stats },

  {
    method: 'GET',
    pattern: /^\/api\/games\/recent\/all$/,
    handler: () => ({ games: fixtures.games.slice(0, 12) }),
  },
  {
    method: 'GET',
    pattern: /^\/api\/games\?/,
    handler: () => ({ games: fixtures.gamesFor('robert') }),
  },
  { method: 'GET', pattern: /^\/api\/games$/, handler: () => ({ games: fixtures.gamesFor('robert') }) },
  {
    method: 'GET',
    pattern: /^\/api\/games\/([^/?]+)\/analysis$/,
    handler: (match) => {
      const game = fixtures.games.find((g) => g.id === match[1]);
      if (!game) throw new ApiError(404, 'That game has not finished, or does not exist');
      // The real analysis, run here rather than on a server.
      const { analyseGame, parseMoves } = engine();
      return { analysis: analyseGame(parseMoves(game.moves), { depth: 5, timeBudgetMs: 4000 }), cached: false };
    },
  },
  {
    method: 'GET',
    pattern: /^\/api\/games\/([^/?]+)$/,
    handler: (match) => {
      const game = fixtures.games.find((g) => g.id === match[1]);
      if (!game) throw new ApiError(404, 'No such game');
      return { game };
    },
  },

  {
    method: 'GET',
    pattern: /^\/api\/leaderboard\/([^/?]+)/,
    handler: (match) => ({ mode: match[1], entries: fixtures.leaderboard(match[1]!) }),
  },

  {
    method: 'GET',
    pattern: /^\/api\/users\/([^/?]+)\/history/,
    handler: (match, _body) => {
      const mode = new URLSearchParams(currentQuery).get('mode') ?? 'rapid';
      return { mode, points: fixtures.historyFor(match[1]!, mode) };
    },
  },
  {
    method: 'GET',
    pattern: /^\/api\/users\/([^/?]+)$/,
    handler: (match) => {
      const profile = fixtures.profile(match[1]!);
      if (!profile) throw new ApiError(404, 'No such player');
      return profile;
    },
  },
  {
    method: 'POST',
    pattern: /^\/api\/users\/([^/?]+)\/follow$/,
    handler: () => ({ following: true }),
  },
  {
    method: 'DELETE',
    pattern: /^\/api\/users\/([^/?]+)\/follow$/,
    handler: () => ({ following: false }),
  },

  {
    method: 'GET',
    pattern: /^\/api\/search\/users/,
    handler: () => {
      const q = (new URLSearchParams(currentQuery).get('q') ?? '').toLowerCase();
      return {
        users: q.length < 2 ? [] : fixtures.users.filter((u) => u.username?.startsWith(q)),
      };
    },
  },
  {
    method: 'GET',
    pattern: /^\/api\/friends$/,
    handler: () => ({ friends: fixtures.friends, following: fixtures.following }),
  },
  {
    method: 'GET',
    pattern: /^\/api\/recent-opponents$/,
    handler: () => ({ opponents: fixtures.recentOpponents }),
  },

  { method: 'GET', pattern: /^\/api\/lessons$/, handler: () => ({ lessons: fixtures.lessons }) },
  {
    method: 'GET',
    pattern: /^\/api\/lessons\/([^/?]+)$/,
    handler: (match) => {
      const summary = fixtures.lessons.find((l) => l.slug === match[1]);
      if (!summary) throw new ApiError(404, 'No such lesson');
      return { lesson: { ...summary, blocks: fixtures.lessonBlocks } };
    },
  },
  { method: 'GET', pattern: /^\/api\/puzzles$/, handler: () => ({ puzzles: fixtures.puzzles }) },
  {
    method: 'POST',
    pattern: /^\/api\/puzzles\/([^/?]+)\/attempt$/,
    handler: (_match, body) => {
      const column = (body as { column?: number } | null)?.column;
      const correct = typeof column === 'number' && fixtures.puzzleAnswers.includes(column);
      return { correct, explanation: correct ? fixtures.puzzleExplanation : null };
    },
  },
  {
    method: 'GET',
    pattern: /^\/api\/puzzles\/([^/?]+)$/,
    handler: (match) => {
      if (match[1] !== fixtures.puzzleDetail.slug) throw new ApiError(404, 'No such puzzle');
      return { puzzle: fixtures.puzzleDetail };
    },
  },

  {
    method: 'GET',
    pattern: /^\/api\/avatars$/,
    handler: () => {
      const { AVATAR_PRESETS } = engine();
      // The demo mirrors the safe default: presets only, no uploads.
      return { presets: AVATAR_PRESETS, uploadsEnabled: false, policy: 'presets' };
    },
  },
  {
    method: 'GET',
    pattern: /^\/api\/username-available/,
    handler: () => ({ available: true, reason: null }),
  },
  { method: 'POST', pattern: /^\/api\/setup$/, handler: () => ({ user: fixtures.users[0] }) },
  {
    method: 'PATCH',
    pattern: /^\/api\/profile$/,
    handler: () => ({ user: fixtures.users[0] }),
  },
  {
    method: 'POST',
    pattern: /^\/api\/profile\/avatar$/,
    handler: () => ({ user: fixtures.users[0] }),
  },
  {
    method: 'DELETE',
    pattern: /^\/api\/profile\/avatar$/,
    handler: () => ({ user: fixtures.users[0] }),
  },
];

/** Query string of the request being handled, for handlers that need it. */
let currentQuery = '';

/** Lazily required so the engine is only pulled in where it is used. */
function engine() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return engineModule!;
}
let engineModule: typeof import('@connect4gg/engine') | null = null;
export function provideEngine(mod: typeof import('@connect4gg/engine')): void {
  engineModule = mod;
}

export async function handleDemoRequest(path: string, init: RequestInit): Promise<unknown> {
  const method = (init.method ?? 'GET').toUpperCase();
  const [pathname, query = ''] = path.split('?');
  currentQuery = query;

  for (const route of routes) {
    if (route.method !== method) continue;
    // Some routes want the query string, so match against the full path too.
    const match = pathname!.match(route.pattern) ?? path.match(route.pattern);
    if (!match) continue;

    const body =
      typeof init.body === 'string' ? (JSON.parse(init.body) as unknown) : null;

    // A little latency, so loading states are visible rather than skipped.
    await new Promise((resolve) => setTimeout(resolve, 80 + Math.random() * 120));
    return route.handler(match, body);
  }

  throw new ApiError(404, `No demo route for ${method} ${path}`);
}
