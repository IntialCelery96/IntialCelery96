import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { RATED_MODE_IDS, isGameModeId, isProvisional } from '@connect4gg/engine';
import { prisma } from '../lib/db.js';
import { HttpError } from '../middleware/auth.js';
import { defaultAvatarFor } from '../lib/storage.js';

export async function leaderboardRoutes(app: FastifyInstance): Promise<void> {
  /**
   * Top players in a mode.
   *
   * Provisional players are excluded: a new account that wins its first two
   * games would otherwise sit near the top of the table on almost no evidence,
   * which makes the leaderboard meaningless.
   */
  app.get('/api/leaderboard/:mode', async (request) => {
    const { mode } = z.object({ mode: z.string() }).parse(request.params);
    const { limit } = z
      .object({ limit: z.coerce.number().int().min(1).max(100).default(50) })
      .parse(request.query);

    if (!isGameModeId(mode) || !RATED_MODE_IDS.includes(mode)) {
      throw new HttpError(404, 'That mode has no leaderboard', 'BAD_MODE');
    }

    const rows = await prisma.rating.findMany({
      where: {
        mode,
        games: { gte: 30 },
        user: { setupComplete: true, isBot: false },
      },
      orderBy: [{ rating: 'desc' }, { games: 'desc' }],
      take: limit,
      include: {
        user: { select: { id: true, username: true, avatarUrl: true, country: true } },
      },
    });

    return {
      mode,
      entries: rows.map((row, index) => ({
        rank: index + 1,
        userId: row.user.id,
        username: row.user.username,
        avatarUrl: row.user.avatarUrl,
        avatarColor: defaultAvatarFor(row.user.id),
        country: row.user.country,
        rating: row.rating,
        peak: row.peak,
        games: row.games,
        wins: row.wins,
        losses: row.losses,
        draws: row.draws,
        provisional: isProvisional(row.games),
      })),
    };
  });

  /** Site-wide counters for the home page. */
  app.get('/api/stats', async () => {
    const [players, games] = await Promise.all([
      prisma.user.count({ where: { setupComplete: true, isBot: false } }),
      prisma.game.count({ where: { endedAt: { not: null } } }),
    ]);
    return { players, games };
  });
}
