import path from 'node:path';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyInstance } from 'fastify';
import { ZodError } from 'zod';
import { prisma } from './lib/db.js';
import { allowedOrigins, env, isProduction } from './lib/env.js';
import { MAX_AVATAR_BYTES, UnsupportedImageError, ensureLocalUploadDir } from './lib/storage.js';
import { HttpError, attachUser } from './middleware/auth.js';
import { authRoutes } from './routes/auth.js';
import { gameRoutes } from './routes/games.js';
import { leaderboardRoutes } from './routes/leaderboard.js';
import { learnRoutes } from './routes/learn.js';
import { profileRoutes } from './routes/profile.js';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: isProduction
      ? true
      : { transport: undefined, level: 'info' },
    // Behind a proxy on a PaaS, so request.ip must come from the header — this
    // matters because the rate limiters key on it.
    trustProxy: isProduction,
    bodyLimit: 1024 * 1024,
  });

  await app.register(cors, {
    origin: allowedOrigins,
    credentials: true,
  });

  await app.register(cookie, { secret: env.SESSION_SECRET });

  await app.register(multipart, {
    limits: { fileSize: MAX_AVATAR_BYTES, files: 1 },
  });

  /**
   * Global rate limit. Individual routes tighten this — auth endpoints allow
   * far fewer attempts — but this catches everything else.
   */
  await app.register(rateLimit, {
    global: true,
    max: 300,
    timeWindow: '1 minute',
    // Anonymous traffic is keyed by IP; signed-in traffic by account, so one
    // user behind a shared NAT does not throttle everyone else there.
    keyGenerator: (request) => request.user?.id ?? request.ip,
  });

  if (env.STORAGE_DRIVER === 'local') {
    await ensureLocalUploadDir();
    await app.register(fastifyStatic, {
      root: path.resolve(env.UPLOAD_DIR),
      prefix: '/uploads/',
      decorateReply: false,
      cacheControl: true,
      maxAge: '365d',
      immutable: true,
    });
  }

  app.decorateRequest('user', null);
  app.addHook('onRequest', attachUser);

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      return reply.code(400).send({
        error: 'Bad Request',
        message: error.issues[0]?.message ?? 'Invalid request',
        code: 'VALIDATION_ERROR',
        issues: error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      });
    }

    if (error instanceof HttpError) {
      return reply.code(error.statusCode).send({
        error: error.name,
        message: error.message,
        code: error.code ?? null,
      });
    }

    if (error instanceof UnsupportedImageError) {
      return reply.code(415).send({ error: 'Unsupported Media Type', message: error.message });
    }

    const statusCode = (error as { statusCode?: number } | undefined)?.statusCode ?? 500;
    if (statusCode >= 500) {
      request.log.error({ err: error }, 'Unhandled error');
      // Never leak internals to the client.
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Something went wrong on our end.',
      });
    }

    const named = error as { name?: string; message?: string };
    return reply.code(statusCode).send({
      error: named.name ?? 'Error',
      message: named.message ?? 'Request failed',
    });
  });

  app.setNotFoundHandler((request, reply) => {
    reply.code(404).send({ error: 'Not Found', message: `No route for ${request.url}` });
  });

  /** Liveness and readiness in one: reports whether the database answers. */
  app.get('/api/health', async (_request, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', database: 'up', uptime: Math.round(process.uptime()) };
    } catch {
      return reply.code(503).send({ status: 'degraded', database: 'down' });
    }
  });

  await app.register(authRoutes);
  await app.register(profileRoutes);
  await app.register(gameRoutes);
  await app.register(leaderboardRoutes);
  await app.register(learnRoutes);

  return app;
}
