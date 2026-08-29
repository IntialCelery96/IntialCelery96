import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { BOTS, GAME_MODES, MODE_IDS, isGameModeId, type GameModeId } from '@connect4gg/engine';
import { prisma } from '../lib/db.js';
import { HttpError, currentUser, requireSetup } from '../middleware/auth.js';
import { GAME_INCLUDE, findGame, listUserGames, summariseGame } from '../services/games.js';
import { getGameAnalysis } from '../services/analysis.js';

export async function gameRoutes(app: FastifyInstance): Promise<void> {
  /** The mode table and bot roster, so the client never hardcodes either. */
  app.get('/api/config', async () => ({
    modes: MODE_IDS.map((id) => GAME_MODES[id]),
    bots: BOTS.map((bot) => ({
      id: bot.id,
      name: bot.name,
      rating: bot.rating,
      difficulty: bot.difficulty,
      avatar: bot.avatar,
    })),
  }));

  /** A finished or in-progress game, for the replay and spectator screens. */
  app.get('/api/games/:id', async (request) => {
    const { id } = z.object({ id: z.string().min(1).max(64) }).parse(request.params);
    const game = await findGame(id);
    if (!game) throw new HttpError(404, 'No such game', 'GAME_NOT_FOUND');
    return { game };
  });

  app.get('/api/games', { preHandler: requireSetup }, async (request) => {
    const query = z
      .object({
        mode: z.string().optional(),
        limit: z.coerce.number().int().min(1).max(50).default(20),
        cursor: z.string().max(64).optional(),
      })
      .parse(request.query);

    const me = currentUser(request);
    const mode = query.mode && isGameModeId(query.mode) ? (query.mode as GameModeId) : undefined;

    return { games: await listUserGames({ userId: me.id, mode, limit: query.limit, cursor: query.cursor }) };
  });

  /**
   * Post-game analysis. Computed on first request (seconds, in a worker) and
   * cached on the game row, so the second viewer gets it instantly.
   *
   * Rate limited separately from the global budget: this is the only endpoint
   * that can cost real CPU, and it is cheap to ask for.
   */
  app.get(
    '/api/games/:id/analysis',
    { config: { rateLimit: { max: 20, timeWindow: '5 minutes' } } },
    async (request) => {
      const { id } = z.object({ id: z.string().min(1).max(64) }).parse(request.params);

      const result = await getGameAnalysis(id);
      if (!result) {
        throw new HttpError(
          404,
          'That game has not finished, or does not exist',
          'ANALYSIS_UNAVAILABLE',
        );
      }

      return { analysis: result.analysis, cached: result.cached };
    },
  );

  /** Recently finished games across the site, for the home page. */
  app.get('/api/games/recent/all', async () => {
    const games = await prisma.game.findMany({
      where: { endedAt: { not: null }, result: { not: 'ABORTED' } },
      include: GAME_INCLUDE,
      orderBy: { endedAt: 'desc' },
      take: 12,
    });
    return { games: games.map((game) => summariseGame(game as Parameters<typeof summariseGame>[0])) };
  });
}
