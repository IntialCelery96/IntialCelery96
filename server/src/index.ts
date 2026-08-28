import { buildApp } from './app.js';
import { disconnect, prisma } from './lib/db.js';
import { env } from './lib/env.js';
import { pruneExpiredSessions } from './lib/session.js';
import { shutdownBotWorker } from './realtime/botWorker.js';
import { createGateway } from './realtime/gateway.js';

const SESSION_PRUNE_INTERVAL_MS = 60 * 60 * 1000;

async function main(): Promise<void> {
  const app = await buildApp();

  // Fastify must be listening before Socket.IO can attach to its HTTP server.
  await app.listen({ port: env.PORT, host: env.HOST });

  const gateway = createGateway(app.server);
  app.log.info(`Realtime gateway attached; Connect4.gg API on :${env.PORT}`);

  const prune = setInterval(() => {
    void pruneExpiredSessions().catch((error) => app.log.warn({ err: error }, 'Session prune failed'));
  }, SESSION_PRUNE_INTERVAL_MS);
  prune.unref();

  // Expire stale challenges so an unanswered invite doesn't linger forever.
  const expireChallenges = setInterval(() => {
    void prisma.challenge
      .updateMany({
        where: { status: 'PENDING', expiresAt: { lt: new Date() } },
        data: { status: 'EXPIRED' },
      })
      .catch(() => undefined);
  }, 60_000);
  expireChallenges.unref();

  let shuttingDown = false;

  async function shutdown(signal: string): Promise<void> {
    if (shuttingDown) return;
    shuttingDown = true;
    app.log.info(`${signal} received, shutting down`);

    clearInterval(prune);
    clearInterval(expireChallenges);

    // Order matters: stop taking work, finish live games, then close the pool.
    await gateway.shutdown().catch((error) => app.log.error({ err: error }, 'Gateway shutdown'));
    await shutdownBotWorker().catch(() => undefined);
    await app.close().catch((error) => app.log.error({ err: error }, 'HTTP shutdown'));
    await disconnect().catch(() => undefined);

    process.exit(0);
  }

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

main().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
