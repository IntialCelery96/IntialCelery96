import { describe, expect, it } from 'vitest';
import {
  BOTS,
  applyMove,
  chooseMove,
  createGame,
  evaluate,
  fromEncoded,
  getBot,
  immediateThreats,
  immediateWins,
  isBotId,
  legalMoves,
  parseBoard,
  replay,
  search,
  stateFromBoard,
  thinkDelayMs,
  BALANCED_STYLE,
} from '../src/index.js';

/** Deterministic RNG so bot tests never flake. */
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

describe('roster', () => {
  it('exposes unique ids ordered from weakest to strongest', () => {
    const ids = BOTS.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
    const ratings = BOTS.map((b) => b.rating);
    expect([...ratings].sort((a, b) => a - b)).toEqual(ratings);
  });

  it('looks bots up by id', () => {
    expect(getBot('zenith')?.name).toBe('Zenith');
    expect(getBot('nobody')).toBeNull();
    expect(isBotId('pip')).toBe(true);
    expect(isBotId('pop')).toBe(false);
  });

  it('gives every bot a think delay inside its own range', () => {
    const random = seeded(7);
    for (const bot of BOTS) {
      const delay = thinkDelayMs(bot, random);
      expect(delay).toBeGreaterThanOrEqual(bot.thinkMs[0]);
      expect(delay).toBeLessThanOrEqual(bot.thinkMs[1]);
    }
  });
});

describe('tactics helpers', () => {
  it('finds a column that wins on the spot', () => {
    // Six plies, so player 1 is back on move with three stacked in column 3.
    const state = replay([3, 0, 3, 1, 3, 2]);
    expect(state.turn).toBe(1);
    expect(immediateWins(state)).toEqual([3]);
  });

  it('finds the column that must be blocked', () => {
    // Five plies: player 2 is on move and player 1 threatens column 3.
    const state = replay([3, 0, 3, 1, 3]);
    expect(state.turn).toBe(2);
    expect(immediateWins(state)).toEqual([]);
    expect(immediateThreats(state)).toEqual([3]);
  });

  it('reports no threats on an empty board', () => {
    expect(immediateThreats(createGame())).toEqual([]);
    expect(immediateWins(createGame())).toEqual([]);
  });
});

describe('every bot plays legally', () => {
  it.each(BOTS.map((b) => [b.id, b] as const))('%s only plays legal columns', (_id, bot) => {
    const random = seeded(99);
    let state = createGame();
    let plies = 0;
    while (state.status === 'in_progress' && plies < 42) {
      const move = chooseMove(bot, state, { random, timeBudgetMs: 500 });
      expect(legalMoves(state)).toContain(move);
      state = applyMove(state, move);
      plies++;
    }
    expect(state.status).not.toBe('in_progress');
  });

  it('refuses to move in a finished game', () => {
    const finished = replay([3, 4, 3, 4, 3, 4, 3]);
    expect(() => chooseMove(BOTS[0]!, finished)).toThrow(/No legal moves/);
  });
});

describe('bots take a win', () => {
  // Pip is excluded on purpose: its whole character is playing at random, and a
  // 600-rated punching bag that never misses a win would not be one.
  const deliberate = BOTS.filter((b) => b.brain !== 'random');

  it.each(deliberate.map((b) => [b.id, b] as const))(
    '%s completes four in a row when offered',
    (_id, bot) => {
      const state = replay([3, 0, 3, 1, 3, 2]);
      expect(state.turn).toBe(1);
      // Blunders never decline a win: chooseMove checks for one first.
      for (let trial = 0; trial < 8; trial++) {
        expect(chooseMove(bot, state, { random: seeded(trial + 1) })).toBe(3);
      }
    },
  );

  it('Pip, playing at random, sometimes misses a win', () => {
    const pip = getBot('pip')!;
    const state = replay([3, 0, 3, 1, 3, 2]);
    const moves = Array.from({ length: 20 }, (_, i) =>
      chooseMove(pip, state, { random: seeded(i + 1) }),
    );
    expect(moves.some((m) => m !== 3)).toBe(true);
  });
});

describe('bots that look ahead block a loss', () => {
  const thinkers = BOTS.filter((b) => b.brain !== 'random');

  it.each(thinkers.map((b) => [b.id, b] as const))('%s blocks an open three', (_id, bot) => {
    // Player 2 to move; player 1 threatens to complete column 3.
    const state = replay([3, 0, 3, 1, 3]);
    expect(state.turn).toBe(2);
    const blocked = [0, 1, 2, 3, 4].map((seed) =>
      chooseMove(bot, state, { random: seeded(seed), timeBudgetMs: 800 }),
    );
    // Allowing for each bot's blunder rate, the block must be the clear default.
    expect(blocked.filter((m) => m === 3).length).toBeGreaterThanOrEqual(4);
  });
});

describe('search quality', () => {
  it('prefers a faster win over a slower one', () => {
    const state = replay([3, 0, 3, 1, 3, 2]);
    const result = search(state, { depth: 6, style: BALANCED_STYLE, random: seeded(3) });
    expect(result.move).toBe(3);
    expect(result.score).toBeGreaterThan(0);
  });

  it('sees a loss coming and picks the move that delays it', () => {
    // Player 2 faces an unavoidable open-ended three; it must still block.
    const state = replay([3, 6, 4, 6, 5]);
    const result = search(state, { depth: 6, style: BALANCED_STYLE, random: seeded(5) });
    expect([2, 6]).toContain(result.move);
  });

  it('prunes: deeper search does not explode node counts linearly', () => {
    const state = replay([3, 3, 4]);
    const shallow = search(state, { depth: 4, style: BALANCED_STYLE, random: seeded(1) });
    const deep = search(state, { depth: 6, style: BALANCED_STYLE, random: seeded(1) });
    expect(deep.nodes).toBeGreaterThan(shallow.nodes);
    // Without pruning this ratio would be ~49x; alpha-beta keeps it well under.
    expect(deep.nodes / shallow.nodes).toBeLessThan(30);
  });

  it('respects its time budget', () => {
    const started = Date.now();
    search(createGame(), { depth: 14, style: BALANCED_STYLE, timeBudgetMs: 150 });
    expect(Date.now() - started).toBeLessThan(3_000);
  });
});

describe('evaluation', () => {
  it('is symmetric: a mirrored position scores the mirror', () => {
    const board = parseBoard(`
      .......
      .......
      .......
      .......
      ...x...
      ..xoo..
    `);
    const forPlayer1 = evaluate(board, 1, BALANCED_STYLE);
    const forPlayer2 = evaluate(board, 2, BALANCED_STYLE);
    expect(forPlayer1).toBeCloseTo(-forPlayer2, 6);
  });

  it('likes the centre column more than the edge', () => {
    const centre = fromEncoded('3').board;
    const edge = fromEncoded('0').board;
    expect(evaluate(centre, 1, BALANCED_STYLE)).toBeGreaterThan(
      evaluate(edge, 1, BALANCED_STYLE),
    );
  });

  it('scores a live three above a buried three', () => {
    const live = parseBoard(`
      .......
      .......
      .......
      .......
      .......
      xxx....
    `);
    const buried = parseBoard(`
      .......
      .......
      .......
      .......
      xxx....
      ooo....
    `);
    expect(evaluate(live, 1, BALANCED_STYLE)).toBeGreaterThan(
      evaluate(buried, 1, BALANCED_STYLE),
    );
  });
});

describe('relative strength', () => {
  /**
   * Plays a match and returns wins for the stronger bot.
   *
   * The time budget is deliberately generous. It is a ceiling, not a cost —
   * the deepest bot averages well under 200ms a move — but a tight budget makes
   * the result depend on how loaded the machine is: a truncated search plays
   * weaker, so a busy CI box would quietly turn a strength test into a speed
   * test and flake. Matching the budget used by scripts/bot-ladder.mjs keeps
   * the two in agreement.
   */
  function match(strongId: string, weakId: string, games: number): number {
    const strong = getBot(strongId)!;
    const weak = getBot(weakId)!;
    let strongWins = 0;

    for (let game = 0; game < games; game++) {
      const random = seeded(game * 7919 + 13);
      // Alternate who moves first so neither side gets a colour advantage.
      const strongIsFirst = game % 2 === 0;
      let state = createGame();

      while (state.status === 'in_progress') {
        const strongToMove = (state.turn === 1) === strongIsFirst;
        const bot = strongToMove ? strong : weak;
        state = applyMove(state, chooseMove(bot, state, { random, timeBudgetMs: 5_000 }));
      }

      if (state.status === 'win') {
        const winnerIsStrong = (state.winner === 1) === strongIsFirst;
        if (winnerIsStrong) strongWins++;
      }
    }

    return strongWins;
  }

  // Thresholds are set below the measured results (see scripts/bot-ladder.mjs)
  // so they assert the ladder holds without flaking on a single odd game.
  it('a searching bot beats the random one nearly every time', () => {
    expect(match('nora', 'pip', 10)).toBeGreaterThanOrEqual(9);
  });

  // Fewer games than the pairings below: Zenith searches nine plies, so each
  // game costs real time. Four is enough to catch a regression that breaks it,
  // and scripts/bot-ladder.mjs covers the pairing at greater depth.
  it('the top bot dominates the greedy one', () => {
    expect(match('zenith', 'rusty', 4)).toBeGreaterThanOrEqual(3);
  });

  it('deeper search beats shallower search of the same family', () => {
    expect(match('bastion', 'nora', 6)).toBeGreaterThanOrEqual(4);
  });

  it('the defensive bot outplays the aggressive one below it', () => {
    expect(match('bastion', 'vex', 6)).toBeGreaterThanOrEqual(4);
  });
});

describe('personalities differ', () => {
  it('the aggressive and defensive bots value the same position differently', () => {
    const vex = getBot('vex')!;
    const bastion = getBot('bastion')!;
    const board = parseBoard(`
      .......
      .......
      .......
      ...x...
      ..xo...
      .xoo...
    `);
    const state = stateFromBoard(board, 1);
    const aggressive = evaluate(state.board, 1, vex.style);
    const defensive = evaluate(state.board, 1, bastion.style);
    expect(aggressive).not.toBeCloseTo(defensive, 3);
  });
});
