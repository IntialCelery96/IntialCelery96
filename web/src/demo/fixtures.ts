import {
  BOTS,
  GAME_MODES,
  MODE_IDS,
  applyMove,
  chooseMove,
  createGame,
  serializeMoves,
} from '@connect4gg/engine';
import type {
  BotInfo,
  GameSummary,
  LeaderboardEntry,
  ModeInfo,
  ProfileResponse,
  PublicUser,
  RatingSnapshot,
  SessionUser,
} from '../lib/api';

/**
 * Fixture data for the standalone demo build.
 *
 * Only compiled in when VITE_DEMO is set. Everything here mirrors what the real
 * API returns, so the pages themselves are the shipped components with no
 * demo-specific branches inside them — the substitution happens at the network
 * boundary and nowhere else.
 *
 * Games are played out by the real bots at build time, so every move list is
 * legal and the replay and analysis screens work on them.
 */

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

function hsl(seed: string): string {
  let hash = 0;
  for (const ch of seed) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return `hsl(${hash % 360} 65% 45%)`;
}

interface Persona {
  username: string;
  country: string;
  bio: string;
  /** Which bot plays their moves — i.e. roughly how strong they are. */
  bot: string;
  base: number;
}

const PEOPLE: Persona[] = [
  { username: 'robert', country: 'US', bio: 'Building this. Mostly losing to Zenith.', bot: 'nora', base: 1284 },
  { username: 'marguerite', country: 'FR', bio: 'Centre column or nothing.', bot: 'zenith', base: 2043 },
  { username: 'oyelaran', country: 'NG', bio: 'Learning the odd/even threats. Slowly.', bot: 'bastion', base: 1811 },
  { username: 'tamsin_v', country: 'GB', bio: '', bot: 'bastion', base: 1764 },
  { username: 'kwok', country: 'HK', bio: 'Blitz only. Life is short.', bot: 'vex', base: 1690 },
  { username: 'renske', country: 'NL', bio: 'Rapid regular. Always up for a rematch.', bot: 'vex', base: 1622 },
  { username: 'ana_paula', country: 'BR', bio: '', bot: 'vex', base: 1558 },
  { username: 'deshawn', country: 'US', bio: 'Trying to break 1400.', bot: 'nora', base: 1387 },
  { username: 'yusuf_k', country: 'TR', bio: 'Classical is the only real time control.', bot: 'nora', base: 1341 },
  { username: 'petra_l', country: 'CZ', bio: '', bot: 'nora', base: 1298 },
  { username: 'hoshino', country: 'JP', bio: 'New here. Be gentle.', bot: 'rusty', base: 1044 },
  { username: 'callum88', country: 'AU', bio: '', bot: 'rusty', base: 987 },
  { username: 'ingrid_s', country: 'SE', bio: 'Puzzles more than games, honestly.', bot: 'rusty', base: 913 },
];

const DAY = 86_400_000;

export const users: PublicUser[] = PEOPLE.map((person, index) => ({
  id: `u_${person.username}`,
  username: person.username,
  avatarUrl: null,
  avatarColor: hsl(person.username),
  bio: person.bio || null,
  country: person.country,
  createdAt: new Date(Date.now() - (320 - index * 19) * DAY).toISOString(),
  isBot: false,
}));

const byName = new Map(users.map((u) => [u.username!, u]));
const personaByName = new Map(PEOPLE.map((p) => [p.username, p]));

/** The account the demo is signed in as. */
export const viewer: SessionUser = {
  id: 'u_robert',
  email: 'you@connect4.gg',
  username: 'robert',
  avatarUrl: null,
  setupComplete: true,
};

// --- Ratings ---------------------------------------------------------------

const RATED = ['blitz', 'rapid', 'classical'] as const;

function ratingsFor(person: Persona): RatingSnapshot[] {
  return RATED.map((mode, i) => {
    const rating = person.base + Math.round((random() - 0.5) * 130) - i * 12;
    const games = 34 + Math.floor(random() * 90);
    const wins = Math.round(games * (0.42 + random() * 0.18));
    const draws = Math.round(games * 0.03);
    return {
      mode,
      rating,
      games,
      wins,
      draws,
      losses: games - wins - draws,
      peak: rating + Math.floor(random() * 70),
      provisional: false,
    };
  });
}

export const ratings = new Map<string, RatingSnapshot[]>(
  PEOPLE.map((person) => [person.username, ratingsFor(person)]),
);

/** A plausible rating walk, so the profile graph has shape rather than noise. */
export function historyFor(username: string, mode: string) {
  const person = personaByName.get(username);
  const snapshot = ratings.get(username)?.find((r) => r.mode === mode);
  if (!person || !snapshot) return [];

  const walk = seeded(username.length * 977 + mode.length * 31);
  const points: { rating: number; delta: number; at: string }[] = [];
  const count = 40;
  let rating = Math.max(900, snapshot.rating - 180);

  for (let i = 0; i < count; i++) {
    const pull = (snapshot.rating - rating) / 9;
    const delta = Math.round(pull + (walk() - 0.5) * 30);
    rating = Math.max(100, rating + delta);
    points.push({
      rating,
      delta,
      at: new Date(Date.now() - (count - i) * 2.4 * DAY).toISOString(),
    });
  }

  // Land exactly on the rating the profile card shows. A graph that ends a few
  // points away from the number printed above it looks like a bug, because in
  // the real app it would be one.
  const last = points[points.length - 1];
  if (last) {
    last.delta += snapshot.rating - last.rating;
    last.rating = snapshot.rating;
  }

  return points;
}

// --- Games -----------------------------------------------------------------

/** Plays a real game between two bots, so the move list is legal. */
function playOut(botA: string, botB: string): { moves: string; winner: 1 | 2 | null } {
  const a = BOTS.find((b) => b.id === botA)!;
  const b = BOTS.find((x) => x.id === botB)!;
  let state = createGame();
  while (state.status === 'in_progress') {
    const bot = state.turn === 1 ? a : b;
    state = applyMove(state, chooseMove(bot, state, { random, timeBudgetMs: 250 }));
  }
  return { moves: serializeMoves(state.moves), winner: state.winner };
}

function side(user: PublicUser | null, botId: string | null, rating: number | null, delta: number | null) {
  return {
    user,
    botId,
    botName: botId ? (BOTS.find((b) => b.id === botId)?.name ?? botId) : null,
    rating,
    ratingDelta: delta,
  };
}

function buildGames(): GameSummary[] {
  const out: GameSummary[] = [];

  for (let i = 0; i < 44; i++) {
    // Half the games involve the viewer, so their profile and history look used.
    const aName = i % 2 === 0 ? 'robert' : pick(PEOPLE).username;
    let bName = pick(PEOPLE).username;
    let guard = 0;
    while (bName === aName && guard++ < 8) bName = pick(PEOPLE).username;
    if (bName === aName) continue;

    const a = personaByName.get(aName)!;
    const b = personaByName.get(bName)!;
    const mode = pick(['blitz', 'rapid', 'classical'] as const);
    const info = GAME_MODES[mode];
    const { moves, winner } = playOut(a.bot, b.bot);

    const ratingA = a.base + Math.round((random() - 0.5) * 90);
    const ratingB = b.base + Math.round((random() - 0.5) * 90);
    const swing = 8 + Math.floor(random() * 18);
    const deltaA = winner === 1 ? swing : winner === 2 ? -swing : 0;

    const endedAt = new Date(Date.now() - i * 0.7 * DAY - random() * DAY);

    out.push({
      id: `g_${i}`,
      mode,
      rated: true,
      moves,
      moveCount: moves.length,
      result: winner === 1 ? 'PLAYER1_WIN' : winner === 2 ? 'PLAYER2_WIN' : 'DRAW',
      endReason: winner ? 'CONNECT_FOUR' : 'BOARD_FULL',
      winnerId: winner === 1 ? byName.get(aName)!.id : winner === 2 ? byName.get(bName)!.id : null,
      player1: side(byName.get(aName)!, null, ratingA, deltaA),
      player2: side(byName.get(bName)!, null, ratingB, -deltaA),
      initialMs: info.initialMs,
      incrementMs: info.incrementMs,
      startedAt: new Date(endedAt.getTime() - 420_000).toISOString(),
      endedAt: endedAt.toISOString(),
    });
  }

  // A few of the viewer's bot games, so casual history is represented too.
  BOTS.slice(0, 4).forEach((bot, i) => {
    const { moves, winner } = playOut('nora', bot.id);
    const endedAt = new Date(Date.now() - (i + 1) * 0.4 * DAY);
    out.push({
      id: `gb_${i}`,
      mode: 'casual',
      rated: false,
      moves,
      moveCount: moves.length,
      result: winner === 1 ? 'PLAYER1_WIN' : winner === 2 ? 'PLAYER2_WIN' : 'DRAW',
      endReason: winner ? 'CONNECT_FOUR' : 'BOARD_FULL',
      winnerId: winner === 1 ? viewer.id : null,
      player1: side(byName.get('robert')!, null, null, null),
      player2: side(null, bot.id, bot.rating, null),
      initialMs: 0,
      incrementMs: 0,
      startedAt: new Date(endedAt.getTime() - 300_000).toISOString(),
      endedAt: endedAt.toISOString(),
    });
  });

  return out.sort(
    (x, y) => new Date(y.startedAt).getTime() - new Date(x.startedAt).getTime(),
  );
}

export const games: GameSummary[] = buildGames();

export function gamesFor(username: string): GameSummary[] {
  return games.filter(
    (g) => g.player1.user?.username === username || g.player2.user?.username === username,
  );
}

// --- Derived views ---------------------------------------------------------

export function leaderboard(mode: string): LeaderboardEntry[] {
  return PEOPLE.map((person) => {
    const user = byName.get(person.username)!;
    const snapshot = ratings.get(person.username)!.find((r) => r.mode === mode)!;
    return {
      rank: 0,
      userId: user.id,
      username: user.username,
      avatarUrl: null,
      avatarColor: user.avatarColor,
      country: user.country,
      rating: snapshot.rating,
      peak: snapshot.peak,
      games: snapshot.games,
      wins: snapshot.wins,
      losses: snapshot.losses,
      draws: snapshot.draws,
      provisional: false,
    };
  })
    .sort((a, b) => b.rating - a.rating)
    .map((entry, i) => ({ ...entry, rank: i + 1 }));
}

export function profile(username: string): ProfileResponse | null {
  const user = byName.get(username);
  if (!user) return null;
  return {
    user,
    ratings: ratings.get(username) ?? [],
    recentGames: gamesFor(username).slice(0, 12),
    followers: 4 + (username.length % 9),
    following: 3 + (username.length % 6),
    isFollowing: username !== 'robert' && username.length % 2 === 0,
    isSelf: username === 'robert',
  };
}

export const modes: ModeInfo[] = MODE_IDS.map((id) => GAME_MODES[id]);

export const bots: BotInfo[] = BOTS.map((bot) => ({
  id: bot.id,
  name: bot.name,
  rating: bot.rating,
  difficulty: bot.difficulty,
  avatar: bot.avatar,
}));

export const stats = { players: users.length, games: games.length };

export const friends = users.slice(1, 5);
export const following = users.slice(5, 8);
export const recentOpponents = users.slice(1, 9);

// --- Curriculum ------------------------------------------------------------

export const lessons = [
  {
    slug: 'center-column-control',
    title: 'Center Column Control',
    summary:
      'Why the middle column is worth more than any other, and what it costs you to give it away.',
    difficulty: 'beginner',
    order: 1,
  },
];

export const lessonBlocks = [
  {
    kind: 'prose' as const,
    text: 'Connect 4 is played on a 7×6 board, and the 69 possible four-in-a-rows are not spread evenly across it. Some squares sit on many more of those lines than others, and the center column sits on the most.',
  },
  {
    kind: 'prose' as const,
    text: 'Count them: a disc in column 4 (the middle) belongs to up to 13 different winning lines. A disc in an outside column belongs to as few as 3. Every disc you place in the middle is doing four times the work.',
  },
  {
    kind: 'keyIdea' as const,
    text: 'With perfect play, the first player wins — but only by starting in the center column. Every other opening move throws the win away.',
  },
  {
    kind: 'board' as const,
    caption: 'The strongest opening move there is: straight down the middle.',
    moves: [3],
    highlight: [3],
  },
  {
    kind: 'prose' as const,
    text: 'The follow-up matters just as much. If your opponent opens in the center and you answer on the edge, you have conceded the most valuable real estate on the board for almost nothing in return.',
  },
  {
    kind: 'board' as const,
    caption: 'Red owns the center; Yellow has taken an edge and is already worse.',
    moves: [3, 0, 3],
    highlight: [3, 10],
  },
  {
    kind: 'tryIt' as const,
    prompt: 'Red has opened in the center. You are Yellow. Where do you play?',
    moves: [3],
    answers: [3, 2, 4],
    explanation:
      'Play on or next to the center. Stacking directly on top (column 4) denies Red the second center square; columns 3 and 5 keep you in the fight for the middle. An edge move hands Red a free advantage.',
  },
  {
    kind: 'prose' as const,
    text: 'This is the first habit to build: when you have nothing better to do, play toward the middle. It is rarely the losing move, and it keeps the most winning lines available to you.',
  },
];

export const puzzles = [
  { slug: 'find-the-win', title: 'Find the Win', difficulty: 'beginner', order: 1 },
];

export const puzzleDetail = {
  slug: 'find-the-win',
  title: 'Find the Win',
  difficulty: 'beginner',
  moves: '303132',
  solver: 1 as const,
  order: 1,
};

export const puzzleAnswers = [3];
export const puzzleExplanation =
  'Column 4 completes a vertical four. Vertical threats are the easiest to miss because they build in one place — always scan your own columns before you look anywhere else.';
