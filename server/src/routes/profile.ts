import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { MODE_IDS, type GameModeId, isGameModeId } from '@connect4gg/engine';
import { prisma } from '../lib/db.js';
import {
  MAX_AVATAR_BYTES,
  deleteAvatar,
  isAllowedMime,
  processAvatar,
  storeAvatar,
} from '../lib/storage.js';
import { HttpError, currentUser, requireAuth, requireSetup } from '../middleware/auth.js';
import { getRatingHistory, getRatings } from '../services/ratings.js';
import {
  PUBLIC_USER_SELECT,
  USERNAME_MAX,
  USERNAME_MIN,
  checkUsernameAvailable,
  searchUsers,
  toPublicUser,
  usernameCooldownRemaining,
} from '../services/users.js';
import { summariseGame } from '../services/games.js';

const usernameSchema = z
  .string()
  .trim()
  .min(USERNAME_MIN, `Username must be at least ${USERNAME_MIN} characters`)
  .max(USERNAME_MAX, `Username must be at most ${USERNAME_MAX} characters`);

const countrySchema = z
  .string()
  .trim()
  .length(2, 'Country must be a two-letter code')
  .regex(/^[A-Za-z]{2}$/, 'Country must be a two-letter code')
  .transform((c) => c.toUpperCase());

export async function profileRoutes(app: FastifyInstance): Promise<void> {
  /** Live availability check for the setup and settings screens. */
  app.get('/api/username-available', { preHandler: requireAuth }, async (request) => {
    const { username } = z.object({ username: usernameSchema }).parse(request.query);
    const me = currentUser(request);
    const result = await checkUsernameAvailable(username, me.id);
    return { available: result.ok, reason: result.reason ?? null };
  });

  /**
   * One-time account setup. Claims a username and optionally an avatar, then
   * marks the account complete. Runs once — later edits go through PATCH
   * /api/profile, which enforces the change cooldown.
   */
  app.post('/api/setup', { preHandler: requireAuth }, async (request) => {
    const me = currentUser(request);
    if (me.setupComplete) {
      throw new HttpError(409, 'Your profile is already set up', 'ALREADY_SETUP');
    }

    const body = z
      .object({
        username: usernameSchema,
        bio: z.string().trim().max(300).optional(),
        country: countrySchema.optional(),
      })
      .parse(request.body);

    const check = await checkUsernameAvailable(body.username, me.id);
    if (!check.ok) throw new HttpError(409, check.reason!, 'USERNAME_UNAVAILABLE');

    try {
      const user = await prisma.user.update({
        where: { id: me.id },
        data: {
          username: body.username,
          usernameLower: body.username.toLowerCase(),
          bio: body.bio ?? null,
          country: body.country ?? null,
          setupComplete: true,
          // The first username doesn't start the cooldown — a new player who
          // typos their name shouldn't be stuck with it for a month.
          usernameChangedAt: null,
        },
        select: PUBLIC_USER_SELECT,
      });
      return { user: toPublicUser(user) };
    } catch (error) {
      // Two people can claim the same name between the check and the write;
      // the unique index is what actually decides it.
      if (isUniqueViolation(error)) {
        throw new HttpError(409, 'That username was just taken', 'USERNAME_UNAVAILABLE');
      }
      throw error;
    }
  });

  app.patch('/api/profile', { preHandler: requireSetup }, async (request) => {
    const me = currentUser(request);
    const body = z
      .object({
        username: usernameSchema.optional(),
        bio: z.string().trim().max(300).nullable().optional(),
        country: countrySchema.nullable().optional(),
      })
      .parse(request.body);

    const user = await prisma.user.findUniqueOrThrow({ where: { id: me.id } });
    const data: Record<string, unknown> = {};

    if (body.username && body.username.toLowerCase() !== (user.usernameLower ?? '')) {
      const remaining = usernameCooldownRemaining(user.usernameChangedAt);
      if (remaining > 0) {
        throw new HttpError(
          429,
          `You can change your username again in ${remaining} day${remaining === 1 ? '' : 's'}`,
          'USERNAME_COOLDOWN',
        );
      }
      const check = await checkUsernameAvailable(body.username, me.id);
      if (!check.ok) throw new HttpError(409, check.reason!, 'USERNAME_UNAVAILABLE');

      data.username = body.username;
      data.usernameLower = body.username.toLowerCase();
      data.usernameChangedAt = new Date();
    }

    if (body.bio !== undefined) data.bio = body.bio;
    if (body.country !== undefined) data.country = body.country;

    try {
      const updated = await prisma.user.update({
        where: { id: me.id },
        data,
        select: PUBLIC_USER_SELECT,
      });
      return { user: toPublicUser(updated) };
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new HttpError(409, 'That username was just taken', 'USERNAME_UNAVAILABLE');
      }
      throw error;
    }
  });

  /**
   * Avatar upload. The file is re-encoded to a 256px WebP before it is stored,
   * which normalises the size and strips EXIF location data along the way.
   */
  app.post(
    '/api/profile/avatar',
    {
      preHandler: requireAuth,
      config: { rateLimit: { max: 10, timeWindow: '10 minutes' } },
    },
    async (request) => {
      const me = currentUser(request);
      const file = await request.file({ limits: { fileSize: MAX_AVATAR_BYTES, files: 1 } });

      if (!file) throw new HttpError(400, 'No image was uploaded', 'NO_FILE');
      if (!isAllowedMime(file.mimetype)) {
        throw new HttpError(415, 'Upload a PNG, JPEG, WebP or GIF image', 'BAD_IMAGE_TYPE');
      }

      let raw: Buffer;
      try {
        raw = await file.toBuffer();
      } catch {
        throw new HttpError(413, 'That image is larger than 5MB', 'FILE_TOO_LARGE');
      }

      const processed = await processAvatar(raw);
      const stored = await storeAvatar(me.id, processed);

      const previous = await prisma.user.findUnique({
        where: { id: me.id },
        select: { avatarUrl: true },
      });

      const user = await prisma.user.update({
        where: { id: me.id },
        data: { avatarUrl: stored.url },
        select: PUBLIC_USER_SELECT,
      });

      // Remove the old file only after the new one is safely recorded.
      await deleteAvatar(previous?.avatarUrl ?? null);

      return { user: toPublicUser(user) };
    },
  );

  app.delete('/api/profile/avatar', { preHandler: requireAuth }, async (request) => {
    const me = currentUser(request);
    const previous = await prisma.user.findUnique({
      where: { id: me.id },
      select: { avatarUrl: true },
    });
    const user = await prisma.user.update({
      where: { id: me.id },
      data: { avatarUrl: null },
      select: PUBLIC_USER_SELECT,
    });
    await deleteAvatar(previous?.avatarUrl ?? null);
    return { user: toPublicUser(user) };
  });

  /** Everything the profile page renders, in one request. */
  app.get('/api/users/:username', async (request) => {
    const { username } = z.object({ username: usernameSchema }).parse(request.params);

    const user = await prisma.user.findUnique({
      where: { usernameLower: username.toLowerCase() },
      select: PUBLIC_USER_SELECT,
    });
    if (!user) throw new HttpError(404, 'No such player', 'USER_NOT_FOUND');

    const [ratings, games, followers, following] = await Promise.all([
      getRatings(user.id),
      prisma.game.findMany({
        where: {
          OR: [{ player1Id: user.id }, { player2Id: user.id }],
          endedAt: { not: null },
        },
        orderBy: { startedAt: 'desc' },
        take: 20,
        include: {
          player1: { select: PUBLIC_USER_SELECT },
          player2: { select: PUBLIC_USER_SELECT },
        },
      }),
      prisma.follow.count({ where: { followingId: user.id } }),
      prisma.follow.count({ where: { followerId: user.id } }),
    ]);

    const viewer = request.user;
    const isFollowing = viewer
      ? (await prisma.follow.count({
          where: { followerId: viewer.id, followingId: user.id },
        })) > 0
      : false;

    // Fill in modes the player hasn't touched yet so the profile shows the
    // full set rather than a partial list.
    const byMode = new Map(ratings.map((r) => [r.mode, r]));
    const allRatings = MODE_IDS.filter((mode) => mode !== 'casual').map(
      (mode) =>
        byMode.get(mode) ?? {
          mode,
          rating: 1200,
          games: 0,
          wins: 0,
          losses: 0,
          draws: 0,
          peak: 1200,
          provisional: true,
        },
    );

    return {
      user: toPublicUser(user),
      ratings: allRatings,
      recentGames: games.map((game) => summariseGame(game)),
      followers,
      following,
      isFollowing,
      isSelf: viewer?.id === user.id,
    };
  });

  /** Rating history for the profile graph. */
  app.get('/api/users/:username/history', async (request) => {
    const { username } = z.object({ username: usernameSchema }).parse(request.params);
    const { mode } = z.object({ mode: z.string().default('rapid') }).parse(request.query);

    if (!isGameModeId(mode) || mode === 'casual') {
      throw new HttpError(400, 'Unknown rated mode', 'BAD_MODE');
    }

    const user = await prisma.user.findUnique({
      where: { usernameLower: username.toLowerCase() },
      select: { id: true },
    });
    if (!user) throw new HttpError(404, 'No such player', 'USER_NOT_FOUND');

    return { mode, points: await getRatingHistory(user.id, mode as GameModeId) };
  });

  app.get('/api/search/users', async (request) => {
    const { q } = z.object({ q: z.string().max(50) }).parse(request.query);
    return { users: await searchUsers(q) };
  });

  // --- Follows --------------------------------------------------------------

  app.post('/api/users/:username/follow', { preHandler: requireSetup }, async (request) => {
    const { username } = z.object({ username: usernameSchema }).parse(request.params);
    const me = currentUser(request);

    const target = await prisma.user.findUnique({
      where: { usernameLower: username.toLowerCase() },
      select: { id: true },
    });
    if (!target) throw new HttpError(404, 'No such player', 'USER_NOT_FOUND');
    if (target.id === me.id) {
      throw new HttpError(400, 'You cannot follow yourself', 'SELF_FOLLOW');
    }

    await prisma.follow.upsert({
      where: { followerId_followingId: { followerId: me.id, followingId: target.id } },
      create: { followerId: me.id, followingId: target.id },
      update: {},
    });

    return { following: true };
  });

  app.delete('/api/users/:username/follow', { preHandler: requireSetup }, async (request) => {
    const { username } = z.object({ username: usernameSchema }).parse(request.params);
    const me = currentUser(request);

    const target = await prisma.user.findUnique({
      where: { usernameLower: username.toLowerCase() },
      select: { id: true },
    });
    if (!target) throw new HttpError(404, 'No such player', 'USER_NOT_FOUND');

    await prisma.follow.deleteMany({ where: { followerId: me.id, followingId: target.id } });
    return { following: false };
  });

  /**
   * The friends list. "Friends" are mutual follows; the rest are shown as
   * people you follow, which keeps the model simple and avoids a request
   * inbox for what is a lightweight relationship.
   */
  app.get('/api/friends', { preHandler: requireSetup }, async (request) => {
    const me = currentUser(request);

    const [following, followers] = await Promise.all([
      prisma.follow.findMany({
        where: { followerId: me.id },
        include: { following: { select: PUBLIC_USER_SELECT } },
        orderBy: { createdAt: 'desc' },
        take: 200,
      }),
      prisma.follow.findMany({
        where: { followingId: me.id },
        select: { followerId: true },
      }),
    ]);

    const followerIds = new Set(followers.map((f) => f.followerId));

    return {
      friends: following
        .filter((f) => followerIds.has(f.followingId))
        .map((f) => toPublicUser(f.following)),
      following: following
        .filter((f) => !followerIds.has(f.followingId))
        .map((f) => toPublicUser(f.following)),
    };
  });

  /** Recent opponents, newest first, de-duplicated. */
  app.get('/api/recent-opponents', { preHandler: requireSetup }, async (request) => {
    const me = currentUser(request);

    const games = await prisma.game.findMany({
      where: {
        OR: [{ player1Id: me.id }, { player2Id: me.id }],
        endedAt: { not: null },
      },
      orderBy: { startedAt: 'desc' },
      take: 60,
      include: {
        player1: { select: PUBLIC_USER_SELECT },
        player2: { select: PUBLIC_USER_SELECT },
      },
    });

    const seen = new Set<string>();
    const opponents = [];
    for (const game of games) {
      const other = game.player1Id === me.id ? game.player2 : game.player1;
      if (!other || other.id === me.id || seen.has(other.id)) continue;
      seen.add(other.id);
      opponents.push(toPublicUser(other));
      if (opponents.length >= 12) break;
    }

    return { opponents };
  });
}

/** Prisma's unique-constraint error, without importing the runtime error class. */
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: string }).code === 'P2002'
  );
}
