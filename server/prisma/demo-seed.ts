import argon2 from 'argon2';
import { PrismaClient } from '@prisma/client';
import {
  BOTS,
  DEFAULT_RATING,
  RATED_MODE_IDS,
  applyMove,
  applyGameResult,
  chooseMove,
  createGame,
  getBot,
  getMode,
  serializeMoves,
  type GameModeId,
} from '@connect4gg/engine';

const prisma = new PrismaClient();

/**
 * Demo data, for looking at a populated site.
 *
 *   npm run db:demo -w @connect4gg/server
 *
 * Separate from `seed.ts` (which seeds real curriculum content) because this is
 * throwaway: a cast of players, a few hundred finished games between them, and
 * the rating history those games imply. Every game is played out by the real
 * bots, so the move lists are legal and the replays and analysis work on them.
 *
 * Safe to re-run — it clears its own rows first and touches nothing else.
 */

const DEMO_PASSWORD = 'connect4demo';

interface Persona {
  username: string;
  country: string;
  bio: string;
  /** Which bot plays their moves, i.e. roughly how strong they are. */
  bot: string;
}

const PEOPLE: Persona[] = [
  { username: 'marguerite', country: 'FR', bio: 'Centre column or nothing.', bot: 'zenith' },
  { username: 'oyelaran', country: 'NG', bio: 'Learning the odd/even threats. Slowly.', bot: 'bastion' },
  { username: 'tamsin_v', country: 'GB', bio: '', bot: 'bastion' },
  { username: 'kwok', country: 'HK', bio: 'Blitz only. Life is short.', bot: 'vex' },
  { username: 'renske', country: 'NL', bio: 'Rapid regular. Always up for a rematch.', bot: 'vex' },
  { username: 'ana_paula', country: 'BR', bio: '', bot: 'vex' },
  { username: 'deshawn', country: 'US', bio: 'Trying to break 1400.', bot: 'nora' },
  { username: 'yusuf_k', country: 'TR', bio: 'Classical is the only real time control.', bot: 'nora' },
  { username: 'petra_l', country: 'CZ', bio: '', bot: 'nora' },
  { username: 'hoshino', country: 'JP', bio: 'New here. Be gentle.', bot: 'rusty' },
  { username: 'callum88', country: 'AU', bio: '', bot: 'rusty' },
  { username: 'ingrid_s', country: 'SE', bio: 'Puzzles more than games, honestly.', bot: 'rusty' },
];

/** The account to sign in as when looking around: demo@connect4.gg */
const VIEWER: Persona = {
  username: 'robert',
  country: 'US',
  bio: 'Building this. Mostly losing to Zenith.',
  bot: 'nora',
};

/** Deterministic RNG so a re-seed produces the same site. */
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

const random = seeded(20260829);

function pick<T>(items: readonly T[]): T {
  return items[Math.floor(random() * items.length)]!;
}

/** Plays a full game between two bots and returns the move list and winner. */
function playGame(botA: string, botB: string): { moves: string; winner: 1 | 2 | null } {
  const a = getBot(botA)!;
  const b = getBot(botB)!;
  let state = createGame();

  while (state.status === 'in_progress') {
    const bot = state.turn === 1 ? a : b;
    state = applyMove(state, chooseMove(bot, state, { random, timeBudgetMs: 400 }));
  }

  return { moves: serializeMoves(state.moves), winner: state.winner };
}

async function main(): Promise<void> {
  console.log('Clearing previous demo data…');
  const previous = await prisma.user.findMany({
    where: { email: { endsWith: '@demo.connect4.gg' } },
    select: { id: true },
  });
  const previousIds = previous.map((u) => u.id);
  if (previousIds.length) {
    await prisma.game.deleteMany({
      where: { OR: [{ player1Id: { in: previousIds } }, { player2Id: { in: previousIds } }] },
    });
    await prisma.user.deleteMany({ where: { id: { in: previousIds } } });
  }

  const passwordHash = await argon2.hash(DEMO_PASSWORD, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });

  console.log('Creating players…');
  const cast = [VIEWER, ...PEOPLE];
  const users = await Promise.all(
    cast.map((person, index) =>
      prisma.user.create({
        data: {
          email:
            person.username === VIEWER.username
              ? 'demo@demo.connect4.gg'
              : `${person.username}@demo.connect4.gg`,
          passwordHash,
          username: person.username,
          usernameLower: person.username.toLowerCase(),
          bio: person.bio || null,
          country: person.country,
          setupComplete: true,
          // Stagger join dates so "joined" reads plausibly on profiles.
          createdAt: new Date(Date.now() - (300 - index * 17) * 86_400_000),
        },
      }),
    ),
  );

  const byUsername = new Map(users.map((u) => [u.username!, u]));

  // Seed a rating row per player per rated mode, with enough games behind it
  // that the leaderboard (which hides provisional accounts) has something in it.
  console.log('Building rating histories…');
  for (const person of cast) {
    const user = byUsername.get(person.username)!;
    const bot = getBot(person.bot)!;

    for (const mode of RATED_MODE_IDS) {
      // Anchor near the bot's strength, with a little per-mode variation.
      const target = bot.rating + Math.round((random() - 0.5) * 160);
      const games = 32 + Math.floor(random() * 90);

      // Walk a rating from the default toward the target, so the graph looks
      // like a real player settling in rather than a straight line.
      let rating = DEFAULT_RATING;
      let peak = rating;
      const history: { rating: number; delta: number; at: Date }[] = [];

      for (let i = 0; i < games; i++) {
        const pull = (target - rating) / 12;
        const noise = (random() - 0.5) * 26;
        const delta = Math.round(pull + noise);
        rating = Math.max(100, rating + delta);
        peak = Math.max(peak, rating);
        history.push({
          rating,
          delta,
          at: new Date(Date.now() - (games - i) * 43_000_000 - random() * 20_000_000),
        });
      }

      const wins = Math.round(games * (0.42 + random() * 0.18));
      const draws = Math.round(games * 0.03);

      await prisma.rating.create({
        data: {
          userId: user.id,
          mode,
          rating,
          games,
          wins,
          draws,
          losses: games - wins - draws,
          peak,
        },
      });

      // Only the most recent slice is graphed, so storing all of it is waste.
      await prisma.ratingHistory.createMany({
        data: history.slice(-45).map((point) => ({
          userId: user.id,
          mode,
          rating: point.rating,
          delta: point.delta,
          createdAt: point.at,
        })),
      });
    }
  }

  console.log('Playing games…');
  const modes: GameModeId[] = ['blitz', 'rapid', 'classical'];
  const games: Parameters<typeof prisma.game.createMany>[0]['data'][] = [];

  for (let i = 0; i < 90; i++) {
    const a = pick(cast);
    let b = pick(cast);
    let guard = 0;
    while (b.username === a.username && guard++ < 10) b = pick(cast);
    if (b.username === a.username) continue;

    const mode = pick(modes);
    const modeInfo = getMode(mode);
    const { moves, winner } = playGame(a.bot, b.bot);

    const userA = byUsername.get(a.username)!;
    const userB = byUsername.get(b.username)!;

    const ratingA = 900 + Math.floor(random() * 900);
    const ratingB = ratingA + Math.round((random() - 0.5) * 200);
    const outcome = winner === 1 ? 'a' : winner === 2 ? 'b' : 'draw';
    const elo = applyGameResult(
      { rating: ratingA, games: 60 },
      { rating: ratingB, games: 60 },
      outcome === 'a' ? 1 : outcome === 'b' ? 0 : 0.5,
    );

    const endedAt = new Date(Date.now() - random() * 20 * 86_400_000);

    games.push({
      mode,
      rated: true,
      player1Id: userA.id,
      player2Id: userB.id,
      moves,
      result: winner === 1 ? 'PLAYER1_WIN' : winner === 2 ? 'PLAYER2_WIN' : 'DRAW',
      endReason: winner ? 'CONNECT_FOUR' : 'BOARD_FULL',
      winnerId: winner === 1 ? userA.id : winner === 2 ? userB.id : null,
      initialMs: modeInfo.initialMs,
      incrementMs: modeInfo.incrementMs,
      player1TimeMs: Math.round(modeInfo.initialMs * (0.15 + random() * 0.6)),
      player2TimeMs: Math.round(modeInfo.initialMs * (0.15 + random() * 0.6)),
      player1RatingBefore: ratingA,
      player2RatingBefore: ratingB,
      player1RatingDelta: elo.deltaA,
      player2RatingDelta: elo.deltaB,
      startedAt: new Date(endedAt.getTime() - 400_000),
      endedAt,
    });
  }

  await prisma.game.createMany({ data: games });

  // A handful of bot games on the viewer's account, so their history shows the
  // casual games too.
  const viewer = byUsername.get(VIEWER.username)!;
  for (const bot of BOTS.slice(0, 4)) {
    const { moves, winner } = playGame('nora', bot.id);
    const endedAt = new Date(Date.now() - random() * 6 * 86_400_000);
    await prisma.game.create({
      data: {
        mode: 'casual',
        rated: false,
        player1Id: viewer.id,
        player2BotId: bot.id,
        moves,
        result: winner === 1 ? 'PLAYER1_WIN' : winner === 2 ? 'PLAYER2_WIN' : 'DRAW',
        endReason: winner ? 'CONNECT_FOUR' : 'BOARD_FULL',
        winnerId: winner === 1 ? viewer.id : null,
        initialMs: 0,
        incrementMs: 0,
        startedAt: new Date(endedAt.getTime() - 300_000),
        endedAt,
      },
    });
  }

  // A few follows, so the friends list and follower counts are not all zero.
  const others = cast.filter((p) => p.username !== VIEWER.username).slice(0, 6);
  for (const person of others) {
    const other = byUsername.get(person.username)!;
    await prisma.follow.create({ data: { followerId: viewer.id, followingId: other.id } });
    if (random() < 0.7) {
      await prisma.follow.create({ data: { followerId: other.id, followingId: viewer.id } });
    }
  }

  const totalGames = await prisma.game.count();
  console.log(
    `Seeded ${users.length} players and ${totalGames} games.\n` +
      `Sign in as demo@demo.connect4.gg / ${DEMO_PASSWORD}`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
