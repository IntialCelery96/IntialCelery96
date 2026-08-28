import { describe, expect, it } from 'vitest';
import {
  GAME_MODES,
  MATCHMAKING_BANDS,
  MODE_IDS,
  RATED_MODE_IDS,
  bandFor,
  canPair,
  getMode,
  isGameModeId,
  isTimed,
} from '../src/index.js';

describe('mode table', () => {
  it('keys every mode by its own id', () => {
    for (const id of MODE_IDS) {
      expect(getMode(id).id).toBe(id);
    }
  });

  it('marks casual as the only unrated mode', () => {
    expect(RATED_MODE_IDS).toEqual(['blitz', 'rapid', 'classical']);
    expect(GAME_MODES.casual.rated).toBe(false);
  });

  it('treats a zero starting clock as untimed', () => {
    expect(isTimed('blitz')).toBe(true);
    expect(isTimed('casual')).toBe(false);
  });

  it('orders the timed modes from fastest to slowest', () => {
    expect(GAME_MODES.blitz.initialMs).toBeLessThan(GAME_MODES.rapid.initialMs);
    expect(GAME_MODES.rapid.initialMs).toBeLessThan(GAME_MODES.classical.initialMs);
  });

  it('recognises only real mode ids', () => {
    expect(isGameModeId('blitz')).toBe(true);
    expect(isGameModeId('bullet')).toBe(false);
    expect(isGameModeId(42)).toBe(false);
    expect(isGameModeId(null)).toBe(false);
  });
});

describe('matchmaking bands', () => {
  it('widens monotonically and ends unrestricted', () => {
    let previous = -1;
    for (const band of MATCHMAKING_BANDS) {
      expect(band.afterSeconds).toBeGreaterThan(previous);
      previous = band.afterSeconds;
    }
    expect(MATCHMAKING_BANDS.at(-1)?.maxDelta).toBeNull();
  });

  it('picks the widest band unlocked so far', () => {
    expect(bandFor(0).maxDelta).toBe(50);
    expect(bandFor(9).maxDelta).toBe(50);
    expect(bandFor(10).maxDelta).toBe(100);
    expect(bandFor(29).maxDelta).toBe(100);
    expect(bandFor(30).maxDelta).toBe(200);
    expect(bandFor(59).maxDelta).toBe(200);
    expect(bandFor(60).maxDelta).toBeNull();
    expect(bandFor(600).maxDelta).toBeNull();
  });
});

describe('canPair', () => {
  it('pairs close ratings immediately', () => {
    expect(canPair(1200, 0, 1230, 0)).toBe(true);
  });

  it('holds distant ratings apart at first', () => {
    expect(canPair(1200, 0, 1400, 0)).toBe(false);
  });

  it('lets the longer wait pull in the newer joiner', () => {
    // 200 apart: blocked while both are fresh, allowed once one has waited 30s.
    expect(canPair(1200, 0, 1400, 0)).toBe(false);
    expect(canPair(1200, 35, 1400, 0)).toBe(true);
  });

  it('pairs anyone after the final band opens', () => {
    expect(canPair(400, 61, 2400, 0)).toBe(true);
  });

  it('is symmetric', () => {
    expect(canPair(1200, 35, 1400, 0)).toBe(canPair(1400, 0, 1200, 35));
  });
});
