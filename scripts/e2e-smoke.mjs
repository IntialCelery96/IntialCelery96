/**
 * End-to-end smoke test against a running server.
 *
 *   npm run dev -w @connect4gg/server     # in another terminal
 *   node scripts/e2e-smoke.mjs
 *
 * Registers two throwaway accounts and drives the real socket protocol: queue,
 * pairing, move validation, a full game, rating updates, persistence, a bot
 * game, and the auth guards. Exits non-zero if any check fails.
 */
import { io } from 'socket.io-client';

// Override with API_URL to point at a deployed server.
const API = process.env.API_URL ?? 'http://localhost:4000';
const stamp = Date.now();

async function api(path, options = {}, cookie) {
  const res = await fetch(API + path, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...(cookie ? { cookie } : {}),
      ...options.headers,
    },
  });
  const setCookie = res.headers.get('set-cookie');
  const body = await res.json().catch(() => null);
  return { status: res.status, body, cookie: setCookie?.split(';')[0] };
}

async function makeUser(name) {
  const reg = await api('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email: `${name}${stamp}@example.com`, password: 'hunter2hunter2' }),
  });
  if (reg.status !== 201) throw new Error(`register ${name}: ${JSON.stringify(reg.body)}`);
  const setup = await api('/api/setup', {
    method: 'POST',
    body: JSON.stringify({ username: `${name}${stamp}`.slice(0, 20), country: 'US' }),
  }, reg.cookie);
  if (setup.status !== 200) throw new Error(`setup ${name}: ${JSON.stringify(setup.body)}`);
  return { cookie: reg.cookie, username: setup.body.user.username };
}

function connect(cookie) {
  return io(API, { extraHeaders: { cookie }, transports: ['websocket'] });
}

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
};

const alice = await makeUser('alice');
const bob = await makeUser('bob');
check('register + setup two accounts', Boolean(alice.username && bob.username), `${alice.username}, ${bob.username}`);

// --- Matchmaking pairs two queued players -----------------------------------
const sa = connect(alice.cookie);
const sb = connect(bob.cookie);
await Promise.all([
  new Promise((r, j) => { sa.on('connect', r); sa.on('connect_error', j); }),
  new Promise((r, j) => { sb.on('connect', r); sb.on('connect_error', j); }),
]);
check('both sockets authenticate via session cookie', true);

const matched = new Promise((resolve) => {
  let seen = 0; const ids = [];
  const onMatch = (p) => { ids.push(p.gameId); if (++seen === 2) resolve(ids); };
  sa.on('game:matched', onMatch);
  sb.on('game:matched', onMatch);
});
sa.emit('queue:join', { mode: 'rapid' });
sb.emit('queue:join', { mode: 'rapid' });

const ids = await Promise.race([matched, new Promise((_, j) => setTimeout(() => j(new Error('matchmaking timed out')), 15000))]);
check('matchmaking pairs two queued players', ids[0] === ids[1], `game ${ids[0]}`);
const gameId = ids[0];

// --- Join the room and play a full game -------------------------------------
const states = { a: null, b: null };
sa.on('game:state', (s) => { states.a = s; });
sb.on('game:state', (s) => { states.b = s; });

const overPayload = new Promise((resolve) => sa.on('game:over', resolve));

sa.emit('game:join', { gameId });
sb.emit('game:join', { gameId });
await new Promise((r) => setTimeout(r, 400));

check('both clients receive board state', states.a?.board?.length === 42 && states.b?.board?.length === 42);
check('clocks start for the player on move', states.a.clock.running === 1 && states.a.clock.player1Ms <= 300000);

// Whoever is player 1 plays column 3 four times; the other answers in column 4.
const aliceSeat = states.a.players[1].username === alice.username ? 1 : 2;
const sockOf = (seat) => (seat === aliceSeat ? sa : sb);

// --- Server rejects an out-of-turn move -------------------------------------
const rejected = new Promise((resolve) => sockOf(2).once('game:rejected', resolve));
sockOf(2).emit('game:move', { gameId, column: 0 });
const rej = await Promise.race([rejected, new Promise((r) => setTimeout(() => r(null), 2000))]);
check('server rejects an out-of-turn move', rej !== null, rej?.message ?? 'no rejection received');

// --- Server rejects an illegal column ---------------------------------------
const badCol = new Promise((resolve) => sockOf(1).once('game:rejected', resolve));
sockOf(1).emit('game:move', { gameId, column: 99 });
const bad = await Promise.race([badCol, new Promise((r) => setTimeout(() => r(null), 2000))]);
check('server rejects an out-of-range column', bad !== null, bad?.message ?? 'no rejection received');

// --- Play out a win for player 1 --------------------------------------------
for (const [seat, column] of [[1,3],[2,4],[1,3],[2,4],[1,3],[2,4],[1,3]]) {
  sockOf(seat).emit('game:move', { gameId, column });
  await new Promise((r) => setTimeout(r, 150));
}

const over = await Promise.race([overPayload, new Promise((_, j) => setTimeout(() => j(new Error('game:over timed out')), 8000))]);
check('vertical four ends the game', over.game.over?.reason === 'CONNECT_FOUR', JSON.stringify(over.game.over));
check('winning line is reported', over.game.winningLine?.length === 4);
check('rated game moves both ratings', over.ratings !== null && over.ratings.player1.delta > 0 && over.ratings.player2.delta < 0,
  over.ratings ? `${over.ratings.player1.delta} / ${over.ratings.player2.delta}` : 'no ratings');

// --- The finished game is persisted and replayable ---------------------------
await new Promise((r) => setTimeout(r, 500));
const stored = await api(`/api/games/${gameId}`);
check('game persisted with moves', stored.body?.game?.moves === '3434343', stored.body?.game?.moves);
check('game persisted with result', stored.body?.game?.result === 'PLAYER1_WIN', stored.body?.game?.result);

// --- Profile reflects the game ----------------------------------------------
const winner = over.game.players[1].username;
const profile = await api(`/api/users/${winner}`);
const rapid = profile.body?.ratings?.find((r) => r.mode === 'rapid');
check('profile shows the updated rating', rapid?.games === 1 && rapid?.wins === 1, JSON.stringify(rapid));
check('profile lists the recent game', profile.body?.recentGames?.length === 1);

const history = await api(`/api/users/${winner}/history?mode=rapid`);
check('rating history recorded', history.body?.points?.length === 1, JSON.stringify(history.body?.points));

sa.close(); sb.close();

// --- Bot game ---------------------------------------------------------------
// Snapshot Alice's rating first: a bot game must leave it completely untouched,
// whichever way the rated game above went for her.
const beforeBot = await api(`/api/users/${alice.username}`);
const rapidBefore = beforeBot.body?.ratings?.find((r) => r.mode === 'rapid');

const sc = connect(alice.cookie);
await new Promise((r, j) => { sc.on('connect', r); sc.on('connect_error', j); });

const botMatched = new Promise((resolve) => sc.on('game:matched', resolve));
sc.emit('bot:play', { botId: 'nora', mode: 'casual', side: 'first' });
const botGame = await Promise.race([botMatched, new Promise((_, j) => setTimeout(() => j(new Error('bot game timed out')), 8000))]);
check('bot game starts', Boolean(botGame.gameId), `vs ${botGame.opponent}`);

let botState = null;
sc.on('game:state', (s) => { botState = s; });
sc.emit('game:join', { gameId: botGame.gameId });
await new Promise((r) => setTimeout(r, 300));
check('bot seat shows as connected', botState?.players[2]?.botId === 'nora' && botState.players[2].connected === true);

sc.emit('game:move', { gameId: botGame.gameId, column: 3 });
await new Promise((r) => setTimeout(r, 3000));
check('bot replies with a move', botState.moves.length >= 2, `moves: ${botState.moves}`);
check('bot game is untimed in casual mode', botState.clock.untimed === true);

// --- Bot game must not be rated ---------------------------------------------
sc.emit('game:resign', { gameId: botGame.gameId });
await new Promise((r) => setTimeout(r, 600));
const afterBot = await api(`/api/users/${alice.username}`);
const rapidAfter = afterBot.body?.ratings?.find((r) => r.mode === 'rapid');
check(
  'bot game did not change ratings',
  rapidAfter?.rating === rapidBefore?.rating && rapidAfter?.games === rapidBefore?.games,
  `${rapidBefore?.rating}/${rapidBefore?.games} -> ${rapidAfter?.rating}/${rapidAfter?.games}`,
);

sc.close();

// --- Puzzle answers stay server-side ----------------------------------------
const puzzle = await api('/api/puzzles/find-the-win');
check('puzzle omits its answer', puzzle.body?.puzzle && !('answers' in puzzle.body.puzzle));
const wrong = await api('/api/puzzles/find-the-win/attempt', { method: 'POST', body: JSON.stringify({ column: 0 }) });
const right = await api('/api/puzzles/find-the-win/attempt', { method: 'POST', body: JSON.stringify({ column: 3 }) });
check('puzzle grades attempts', wrong.body?.correct === false && right.body?.correct === true);
check('explanation only on success', wrong.body?.explanation === null && typeof right.body?.explanation === 'string');

// --- Auth guards -------------------------------------------------------------
const anon = await api('/api/games');
check('protected route rejects anonymous', anon.status === 401, `status ${anon.status}`);
const dupe = await api('/api/setup', { method: 'POST', body: JSON.stringify({ username: bob.username }) }, alice.cookie);
check('setup cannot run twice', dupe.status === 409, `status ${dupe.status}`);

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length === 0 ? 0 : 1);
