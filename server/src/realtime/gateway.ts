import type { Server as HttpServer } from 'node:http';
import { Server, type Socket } from 'socket.io';
import { z } from 'zod';
import {
  COLS,
  type GameModeId,
  getMode,
  isBotId,
  isGameModeId,
} from '@connect4gg/engine';
import { prisma } from '../lib/db.js';
import { allowedOrigins } from '../lib/env.js';
import { parseSessionCookieHeader, resolveSession } from '../lib/session.js';
import { getOrCreateRating } from '../services/ratings.js';
import type {
  ClientToServerEvents,
  InterServerEvents,
  ServerToClientEvents,
  SocketData,
} from './events.js';
import { GameManager } from './gameManager.js';
import type { LiveGame } from './liveGame.js';
import { Matchmaker } from './matchmaking.js';

/**
 * Socket.IO gateway.
 *
 * Every inbound event carries only the smallest possible payload (a game id, a
 * column number). The server never accepts board state from a client — it
 * looks the game up, checks the socket's session owns a seat in it, and
 * validates the move against its own copy of the position.
 */

const MATCH_TICK_MS = 1_000;

type GameSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

type GameServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

const gameIdSchema = z.object({ gameId: z.string().min(1).max(64) });
const moveSchema = z.object({
  gameId: z.string().min(1).max(64),
  column: z.number().int().min(0).max(COLS - 1),
});
const queueSchema = z.object({ mode: z.string() });
const challengeSchema = z.object({
  username: z.string().min(3).max(20),
  mode: z.string(),
  rated: z.boolean().default(true),
});
const botSchema = z.object({
  botId: z.string().min(1).max(32),
  mode: z.string(),
  /** Which colour the human takes; 'random' lets the server decide. */
  side: z.enum(['first', 'second', 'random']).default('random'),
});

function roomFor(gameId: string): string {
  return `game:${gameId}`;
}

/**
 * Per-socket rate limiting. Matchmaking and challenge events are cheap to send
 * and expensive to serve, so each socket gets a small token bucket.
 */
class TokenBucket {
  private tokens: number;
  private lastRefill = Date.now();

  constructor(
    private readonly capacity: number,
    private readonly refillPerSecond: number,
  ) {
    this.tokens = capacity;
  }

  take(): boolean {
    const now = Date.now();
    this.tokens = Math.min(
      this.capacity,
      this.tokens + ((now - this.lastRefill) / 1000) * this.refillPerSecond,
    );
    this.lastRefill = now;
    if (this.tokens < 1) return false;
    this.tokens -= 1;
    return true;
  }
}

export function createGateway(httpServer: HttpServer): {
  io: GameServer;
  manager: GameManager;
  shutdown: () => Promise<void>;
} {
  const io: GameServer = new Server(httpServer, {
    cors: { origin: allowedOrigins, credentials: true },
    // Keeps a brief network drop from being reported as a disconnect at all.
    pingTimeout: 20_000,
    pingInterval: 10_000,
  });

  const matchmaker = new Matchmaker();
  const buckets = new Map<string, TokenBucket>();

  const manager = new GameManager({
    broadcast(game) {
      io.to(roomFor(game.id)).emit('game:state', game.toPayload());
    },
    broadcastOver(game, ratings) {
      io.to(roomFor(game.id)).emit('game:over', {
        game: game.toPayload(),
        ratings,
      });
    },
  });

  function bucketFor(socket: GameSocket): TokenBucket {
    let bucket = buckets.get(socket.id);
    if (!bucket) {
      bucket = new TokenBucket(10, 1);
      buckets.set(socket.id, bucket);
    }
    return bucket;
  }

  /** Rejects the event and tells the client why, without disconnecting them. */
  function limited(socket: GameSocket): boolean {
    if (bucketFor(socket).take()) return false;
    socket.emit('error:rate', { message: 'Slow down a moment.' });
    return true;
  }

  // --- Authentication -------------------------------------------------------
  // The session cookie is the only credential. A socket that cannot be resolved
  // to a set-up account is refused, so every connected socket has an identity.

  io.use(async (socket, next) => {
    try {
      const token = parseSessionCookieHeader(socket.handshake.headers.cookie);
      const user = await resolveSession(token);

      if (!user) return next(new Error('UNAUTHENTICATED'));
      if (!user.setupComplete || !user.username) return next(new Error('SETUP_REQUIRED'));

      (socket as GameSocket).data.userId = user.id;
      (socket as GameSocket).data.username = user.username;
      next();
    } catch (error) {
      next(error instanceof Error ? error : new Error('AUTH_FAILED'));
    }
  });

  io.on('connection', (raw) => {
    const socket = raw as GameSocket;
    const { userId, username } = socket.data;

    // A player's own room, so a challenge can be delivered wherever they are.
    void socket.join(`user:${userId}`);

    // Reconnecting mid-game: point the client straight back at it.
    const active = manager.activeGameFor(userId);
    if (active) {
      socket.emit('game:resume', { gameId: active.id });
    }

    // --- Matchmaking --------------------------------------------------------

    socket.on('queue:join', async (payload: unknown) => {
      if (limited(socket)) return;

      const parsed = queueSchema.safeParse(payload);
      if (!parsed.success || !isGameModeId(parsed.data.mode)) {
        socket.emit('queue:error', { message: 'Unknown game mode' });
        return;
      }
      const mode = parsed.data.mode as GameModeId;

      if (manager.activeGameFor(userId)) {
        socket.emit('queue:error', { message: 'You are already in a game' });
        return;
      }

      const rating = getMode(mode).rated
        ? (await getOrCreateRating(userId, mode)).rating
        : 1200;

      matchmaker.join({ userId, socketId: socket.id, username, rating, mode });
      socket.emit('queue:status', matchmaker.statusFor(userId));
    });

    socket.on('queue:leave', () => {
      matchmaker.leave(userId);
      socket.emit('queue:left', {});
    });

    // --- Playing against a bot ---------------------------------------------

    socket.on('bot:play', async (payload: unknown) => {
      if (limited(socket)) return;

      const parsed = botSchema.safeParse(payload);
      if (!parsed.success || !isGameModeId(parsed.data.mode) || !isBotId(parsed.data.botId)) {
        socket.emit('queue:error', { message: 'Unknown bot or game mode' });
        return;
      }

      if (manager.activeGameFor(userId)) {
        socket.emit('queue:error', { message: 'You are already in a game' });
        return;
      }

      const mode = parsed.data.mode as GameModeId;
      matchmaker.leave(userId);

      const human = await manager.humanSeat(userId, mode, username);
      const bot = manager.botSeat(parsed.data.botId);

      const humanFirst =
        parsed.data.side === 'first'
          ? true
          : parsed.data.side === 'second'
            ? false
            : Math.random() < 0.5;

      const game = await manager.create({
        mode,
        // Bot games are never rated; the manager enforces this too.
        rated: false,
        player1: humanFirst ? human : bot,
        player2: humanFirst ? bot : human,
      });

      socket.emit('game:matched', { gameId: game.id, mode, opponent: bot.username });
    });

    // --- Direct challenges --------------------------------------------------

    socket.on('challenge:send', async (payload: unknown) => {
      if (limited(socket)) return;

      const parsed = challengeSchema.safeParse(payload);
      if (!parsed.success || !isGameModeId(parsed.data.mode)) {
        socket.emit('challenge:error', { message: 'Unknown game mode' });
        return;
      }

      const target = await prisma.user.findUnique({
        where: { usernameLower: parsed.data.username.toLowerCase() },
        select: { id: true, username: true, setupComplete: true },
      });

      if (!target || !target.setupComplete) {
        socket.emit('challenge:error', { message: 'No such player' });
        return;
      }
      if (target.id === userId) {
        socket.emit('challenge:error', { message: 'You cannot challenge yourself' });
        return;
      }

      const challenge = await prisma.challenge.create({
        data: {
          challengerId: userId,
          challengedId: target.id,
          mode: parsed.data.mode,
          rated: parsed.data.rated && getMode(parsed.data.mode as GameModeId).rated,
          expiresAt: new Date(Date.now() + 5 * 60_000),
        },
      });

      socket.emit('challenge:sent', { id: challenge.id, to: target.username });
      io.to(`user:${target.id}`).emit('challenge:received', {
        id: challenge.id,
        from: username,
        mode: parsed.data.mode,
        rated: challenge.rated,
      });
    });

    socket.on('challenge:accept', async (payload: unknown) => {
      if (limited(socket)) return;

      const parsed = z.object({ id: z.string().min(1).max(64) }).safeParse(payload);
      if (!parsed.success) return;

      const challenge = await prisma.challenge.findUnique({ where: { id: parsed.data.id } });

      // Only the invited player can accept, once, before it expires.
      if (
        !challenge ||
        challenge.challengedId !== userId ||
        challenge.status !== 'PENDING' ||
        challenge.expiresAt.getTime() < Date.now()
      ) {
        socket.emit('challenge:error', { message: 'That challenge is no longer available' });
        return;
      }

      if (manager.activeGameFor(userId) || manager.activeGameFor(challenge.challengerId)) {
        socket.emit('challenge:error', { message: 'One of you is already in a game' });
        return;
      }

      const mode = challenge.mode as GameModeId;
      matchmaker.leave(userId);
      matchmaker.leave(challenge.challengerId);

      const [challenger, challenged] = await Promise.all([
        manager.humanSeat(challenge.challengerId, mode),
        manager.humanSeat(userId, mode, username),
      ]);

      // The challenger takes the first move, as they proposed the game.
      const game = await manager.create({
        mode,
        rated: challenge.rated,
        player1: challenger,
        player2: challenged,
      });

      await prisma.challenge.update({
        where: { id: challenge.id },
        data: { status: 'ACCEPTED', gameId: game.id },
      });

      io.to(`user:${challenge.challengerId}`).emit('game:matched', {
        gameId: game.id,
        mode,
        opponent: challenged.username,
      });
      socket.emit('game:matched', { gameId: game.id, mode, opponent: challenger.username });
    });

    socket.on('challenge:decline', async (payload: unknown) => {
      const parsed = z.object({ id: z.string().min(1).max(64) }).safeParse(payload);
      if (!parsed.success) return;

      const challenge = await prisma.challenge.updateMany({
        where: { id: parsed.data.id, challengedId: userId, status: 'PENDING' },
        data: { status: 'DECLINED' },
      });

      if (challenge.count > 0) {
        const row = await prisma.challenge.findUnique({ where: { id: parsed.data.id } });
        if (row) {
          io.to(`user:${row.challengerId}`).emit('challenge:declined', { id: row.id, by: username });
        }
      }
    });

    // --- In-game ------------------------------------------------------------

    socket.on('game:join', (payload: unknown) => {
      const parsed = gameIdSchema.safeParse(payload);
      if (!parsed.success) return;

      const game = manager.get(parsed.data.gameId);
      if (!game) {
        socket.emit('game:notFound', { gameId: parsed.data.gameId });
        return;
      }

      void socket.join(roomFor(game.id));

      const seat = game.seatOf(userId);
      if (seat !== null) {
        const { resumed } = game.attach(seat, socket.id);
        if (resumed) io.to(roomFor(game.id)).emit('game:resumed', { player: seat });
      } else {
        // Anyone else in the room is a spectator: they receive state but the
        // move handler will never find them a seat.
        game.spectators.add(socket.id);
      }

      socket.emit('game:state', game.toPayload());
      if (seat === null) socket.emit('game:spectating', { gameId: game.id });
    });

    socket.on('game:leave', (payload: unknown) => {
      const parsed = gameIdSchema.safeParse(payload);
      if (!parsed.success) return;
      const game = manager.get(parsed.data.gameId);
      if (!game) return;
      // Leaving a game you are seated in is not a resignation; the disconnect
      // grace period handles genuine abandonment.
      game.spectators.delete(socket.id);
      void socket.leave(roomFor(game.id));
    });

    socket.on('game:move', (payload: unknown) => {
      const parsed = moveSchema.safeParse(payload);
      if (!parsed.success) {
        socket.emit('game:rejected', { message: 'Invalid move' });
        return;
      }

      const game = manager.get(parsed.data.gameId);
      if (!game) {
        socket.emit('game:notFound', { gameId: parsed.data.gameId });
        return;
      }

      const result = manager.playMove(game, userId, parsed.data.column);
      if (!result.ok) {
        // Re-send the authoritative state so a client that got ahead of itself
        // snaps back into line.
        socket.emit('game:rejected', { message: result.reason ?? 'Move rejected' });
        socket.emit('game:state', game.toPayload());
      }
    });

    socket.on('game:resign', (payload: unknown) => {
      const parsed = gameIdSchema.safeParse(payload);
      if (!parsed.success) return;
      const game = manager.get(parsed.data.gameId);
      if (game) manager.resign(game, userId);
    });

    socket.on('game:offerDraw', (payload: unknown) => {
      if (limited(socket)) return;
      const parsed = gameIdSchema.safeParse(payload);
      if (!parsed.success) return;
      const game = manager.get(parsed.data.gameId);
      if (game) manager.offerDraw(game, userId);
    });

    socket.on('game:declineDraw', (payload: unknown) => {
      const parsed = gameIdSchema.safeParse(payload);
      if (!parsed.success) return;
      const game = manager.get(parsed.data.gameId);
      if (game) manager.declineDraw(game, userId);
    });

    /**
     * Rematch. The first player to ask registers an offer; when the opponent
     * asks too, a new game is created with the colours swapped.
     */
    socket.on('game:rematch', async (payload: unknown) => {
      if (limited(socket)) return;

      const parsed = gameIdSchema.safeParse(payload);
      if (!parsed.success) return;

      const finished = await prisma.game.findUnique({
        where: { id: parsed.data.gameId },
        select: {
          id: true,
          mode: true,
          rated: true,
          player1Id: true,
          player2Id: true,
          player1BotId: true,
          player2BotId: true,
          endedAt: true,
        },
      });

      if (!finished?.endedAt) return;

      const mode = finished.mode as GameModeId;
      const isPlayer = finished.player1Id === userId || finished.player2Id === userId;
      if (!isPlayer) return;

      // Against a bot there is nobody to agree, so start immediately.
      const botId = finished.player1BotId ?? finished.player2BotId;
      if (botId) {
        const human = await manager.humanSeat(userId, mode, username);
        const bot = manager.botSeat(botId);
        // Swap colours from the previous game.
        const humanWasFirst = finished.player1Id === userId;
        const game = await manager.create({
          mode,
          rated: false,
          player1: humanWasFirst ? bot : human,
          player2: humanWasFirst ? human : bot,
        });
        socket.emit('game:matched', { gameId: game.id, mode, opponent: bot.username });
        return;
      }

      const opponentId = finished.player1Id === userId ? finished.player2Id : finished.player1Id;
      if (!opponentId) return;

      const key = `rematch:${finished.id}`;
      const existing = rematchOffers.get(key);

      if (existing && existing !== userId) {
        rematchOffers.delete(key);

        if (manager.activeGameFor(userId) || manager.activeGameFor(opponentId)) return;

        const [a, b] = await Promise.all([
          manager.humanSeat(opponentId, mode),
          manager.humanSeat(userId, mode, username),
        ]);

        // Colours swap so a rematch isn't the same game twice.
        const previousFirst = finished.player1Id;
        const game = await manager.create({
          mode,
          rated: finished.rated,
          player1: previousFirst === userId ? a : b,
          player2: previousFirst === userId ? b : a,
        });

        io.to(`user:${opponentId}`).emit('game:matched', {
          gameId: game.id,
          mode,
          opponent: username,
        });
        socket.emit('game:matched', { gameId: game.id, mode, opponent: a.username });
        return;
      }

      rematchOffers.set(key, userId);
      setTimeout(() => {
        if (rematchOffers.get(key) === userId) rematchOffers.delete(key);
      }, 120_000).unref();

      io.to(`user:${opponentId}`).emit('game:rematchOffered', {
        gameId: finished.id,
        from: username,
      });
    });

    socket.on('disconnect', () => {
      buckets.delete(socket.id);
      matchmaker.leaveBySocket(socket.id);

      const game = manager.activeGameFor(userId);
      if (game) {
        game.detach(socket.id, (player) => {
          manager.forfeitDisconnected(game, player);
        });
        io.to(roomFor(game.id)).emit('game:state', game.toPayload());
      }
    });
  });

  /** Rematch offers awaiting the opponent, keyed by the finished game. */
  const rematchOffers = new Map<string, string>();

  // --- Matchmaking loop -----------------------------------------------------
  // One tick per second: pair whoever can be paired, then tell everyone still
  // waiting how the search is going so the UI can show "expanding search".

  const tick = setInterval(() => {
    void (async () => {
      const pairings = matchmaker.drainPairings();

      for (const pairing of pairings) {
        try {
          const [a, b] = await Promise.all([
            manager.humanSeat(pairing.a.userId, pairing.mode, pairing.a.username),
            manager.humanSeat(pairing.b.userId, pairing.mode, pairing.b.username),
          ]);

          // Randomise who moves first — the first player has a real advantage
          // in Connect 4, so it must not be decided by queue order.
          const flip = Math.random() < 0.5;
          const game = await manager.create({
            mode: pairing.mode,
            rated: getMode(pairing.mode).rated,
            player1: flip ? a : b,
            player2: flip ? b : a,
          });

          io.to(`user:${pairing.a.userId}`).emit('game:matched', {
            gameId: game.id,
            mode: pairing.mode,
            opponent: b.username,
          });
          io.to(`user:${pairing.b.userId}`).emit('game:matched', {
            gameId: game.id,
            mode: pairing.mode,
            opponent: a.username,
          });
        } catch {
          // A failed pairing must not take the loop down; both players simply
          // need to re-queue.
        }
      }

      for (const entry of matchmaker.waiting()) {
        io.to(entry.socketId).emit('queue:status', matchmaker.statusFor(entry.userId));
      }
    })();
  }, MATCH_TICK_MS);

  tick.unref();

  async function shutdown(): Promise<void> {
    clearInterval(tick);
    matchmaker.clear();
    await manager.shutdown();
    await io.close();
  }

  return { io, manager, shutdown };
}
