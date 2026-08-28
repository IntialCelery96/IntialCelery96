import { describe, expect, it } from 'vitest';
import {
  DEFAULT_RATING,
  K_ESTABLISHED,
  K_PROVISIONAL,
  MIN_RATING,
  PROVISIONAL_GAMES,
  applyGameResult,
  expectedScore,
  isProvisional,
  kFactor,
  ratingTier,
  scoreFor,
  updateRating,
} from '../src/index.js';

describe('expectedScore', () => {
  it('gives equal players an even chance', () => {
    expect(expectedScore(1200, 1200)).toBeCloseTo(0.5, 10);
  });

  it('gives a 400-point favourite roughly a 10:1 edge', () => {
    expect(expectedScore(1600, 1200)).toBeCloseTo(10 / 11, 6);
    expect(expectedScore(1200, 1600)).toBeCloseTo(1 / 11, 6);
  });

  it('always sums to 1 across the pair', () => {
    for (const [a, b] of [[1000, 1000], [1500, 1200], [800, 2100]] as const) {
      expect(expectedScore(a, b) + expectedScore(b, a)).toBeCloseTo(1, 10);
    }
  });
});

describe('kFactor', () => {
  it('uses the provisional K below the games threshold', () => {
    expect(kFactor(0)).toBe(K_PROVISIONAL);
    expect(kFactor(PROVISIONAL_GAMES - 1)).toBe(K_PROVISIONAL);
    expect(isProvisional(PROVISIONAL_GAMES - 1)).toBe(true);
  });

  it('steps down to the established K at the threshold', () => {
    expect(kFactor(PROVISIONAL_GAMES)).toBe(K_ESTABLISHED);
    expect(kFactor(500)).toBe(K_ESTABLISHED);
    expect(isProvisional(PROVISIONAL_GAMES)).toBe(false);
  });
});

describe('updateRating', () => {
  it('awards half the K-factor when equals draw nothing and win everything', () => {
    // Equal ratings, established player: a win is worth exactly K/2.
    const player = { rating: 1200, games: 100 };
    expect(updateRating(player, 1200, 1)).toBe(1200 + K_ESTABLISHED / 2);
    expect(updateRating(player, 1200, 0)).toBe(1200 - K_ESTABLISHED / 2);
    expect(updateRating(player, 1200, 0.5)).toBe(1200);
  });

  it('gives a provisional player larger swings', () => {
    const provisional = { rating: 1200, games: 0 };
    const established = { rating: 1200, games: 100 };
    const pGain = updateRating(provisional, 1200, 1) - 1200;
    const eGain = updateRating(established, 1200, 1) - 1200;
    expect(pGain).toBeGreaterThan(eGain);
    expect(pGain).toBe(K_PROVISIONAL / 2);
  });

  it('rewards an upset far more than an expected win', () => {
    const underdog = { rating: 1000, games: 100 };
    const favourite = { rating: 1800, games: 100 };
    const upsetGain = updateRating(underdog, 1800, 1) - 1000;
    const routineGain = updateRating(favourite, 1000, 1) - 1800;
    expect(upsetGain).toBeGreaterThan(15);
    expect(routineGain).toBeLessThanOrEqual(1);
    expect(upsetGain).toBeGreaterThan(routineGain);
  });

  it('never falls below the rating floor', () => {
    let player = { rating: MIN_RATING, games: 100 };
    for (let i = 0; i < 50; i++) {
      player = { rating: updateRating(player, 2400, 0), games: 100 };
    }
    expect(player.rating).toBe(MIN_RATING);
  });

  it('returns whole numbers', () => {
    const result = updateRating({ rating: 1237, games: 3 }, 1411, 1);
    expect(Number.isInteger(result)).toBe(true);
  });
});

describe('applyGameResult', () => {
  it('is close to zero-sum for two established players', () => {
    const result = applyGameResult({ rating: 1400, games: 60 }, { rating: 1250, games: 60 }, 1);
    // Rounding can shift the sum by a point; the transfer is otherwise even.
    expect(Math.abs(result.deltaA + result.deltaB)).toBeLessThanOrEqual(1);
    expect(result.deltaA).toBeGreaterThan(0);
    expect(result.deltaB).toBeLessThan(0);
  });

  it('leaves equal players unchanged after a draw', () => {
    const result = applyGameResult({ rating: 1500, games: 40 }, { rating: 1500, games: 40 }, 0.5);
    expect(result.deltaA).toBe(0);
    expect(result.deltaB).toBe(0);
  });

  it('moves the underdog up on a draw against a stronger player', () => {
    const result = applyGameResult({ rating: 1100, games: 40 }, { rating: 1600, games: 40 }, 0.5);
    expect(result.deltaA).toBeGreaterThan(0);
    expect(result.deltaB).toBeLessThan(0);
  });

  it('can move the two sides by different amounts when one is provisional', () => {
    const result = applyGameResult({ rating: 1200, games: 0 }, { rating: 1200, games: 200 }, 1);
    expect(result.deltaA).toBe(K_PROVISIONAL / 2);
    expect(result.deltaB).toBe(-K_ESTABLISHED / 2);
  });

  it('reports the new ratings alongside the deltas', () => {
    const a = { rating: 1300, games: 50 };
    const b = { rating: 1350, games: 50 };
    const result = applyGameResult(a, b, 1);
    expect(result.ratingA).toBe(a.rating + result.deltaA);
    expect(result.ratingB).toBe(b.rating + result.deltaB);
  });
});

describe('scoreFor', () => {
  it('maps winners onto A-relative scores', () => {
    expect(scoreFor('a')).toBe(1);
    expect(scoreFor('b')).toBe(0);
    expect(scoreFor('draw')).toBe(0.5);
  });
});

describe('ratingTier', () => {
  it('assigns tiers in ascending order', () => {
    expect(ratingTier(400)).toBe('bronze');
    expect(ratingTier(DEFAULT_RATING)).toBe('gold');
    expect(ratingTier(1900)).toBe('diamond');
    expect(ratingTier(2500)).toBe('master');
  });
});

describe('rating convergence', () => {
  it('drags a new account toward its true strength', () => {
    // A player who wins 75% against a 1500 pool belongs somewhere near 1690.
    let player = { rating: DEFAULT_RATING, games: 0 };
    for (let i = 0; i < 200; i++) {
      const score = i % 4 === 0 ? 0 : 1;
      player = {
        rating: updateRating(player, 1500, score as 0 | 1),
        games: player.games + 1,
      };
    }
    expect(player.rating).toBeGreaterThan(1550);
    expect(player.rating).toBeLessThan(1850);
  });
});
