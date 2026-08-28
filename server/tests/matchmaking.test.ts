import { beforeEach, describe, expect, it } from 'vitest';
import { Matchmaker, type QueueEntry } from '../src/realtime/matchmaking.js';

function entry(overrides: Partial<Omit<QueueEntry, 'joinedAt'>> = {}) {
  return {
    userId: overrides.userId ?? 'u1',
    socketId: overrides.socketId ?? 's1',
    username: overrides.username ?? 'player',
    rating: overrides.rating ?? 1200,
    mode: overrides.mode ?? ('rapid' as const),
  };
}

describe('queue membership', () => {
  let queue: Matchmaker;
  beforeEach(() => {
    queue = new Matchmaker();
  });

  it('adds and removes players', () => {
    queue.join(entry({ userId: 'a' }));
    expect(queue.has('a')).toBe(true);
    expect(queue.size()).toBe(1);

    expect(queue.leave('a')?.userId).toBe('a');
    expect(queue.has('a')).toBe(false);
    expect(queue.leave('a')).toBeNull();
  });

  it('holds one place per player, not one per join', () => {
    queue.join(entry({ userId: 'a', mode: 'rapid' }));
    queue.join(entry({ userId: 'a', mode: 'blitz' }));
    expect(queue.size()).toBe(1);
    expect(queue.get('a')?.mode).toBe('blitz');
  });

  it('keeps the original wait time when re-joining the same mode', () => {
    const first = queue.join(entry({ userId: 'a', mode: 'rapid' }));
    const rejoined = queue.join(entry({ userId: 'a', mode: 'rapid', socketId: 's2' }));
    expect(rejoined.joinedAt).toBe(first.joinedAt);
    expect(rejoined.socketId).toBe('s2');
  });

  it('resets the wait time when switching modes', () => {
    const first = queue.join(entry({ userId: 'a', mode: 'rapid' }));
    first.joinedAt = Date.now() - 60_000;
    const switched = queue.join(entry({ userId: 'a', mode: 'blitz' }));
    expect(switched.joinedAt).toBeGreaterThan(first.joinedAt);
  });

  it('removes a player by their socket', () => {
    queue.join(entry({ userId: 'a', socketId: 'sock-a' }));
    expect(queue.leaveBySocket('sock-a')?.userId).toBe('a');
    expect(queue.size()).toBe(0);
    expect(queue.leaveBySocket('nope')).toBeNull();
  });

  it('counts per mode', () => {
    queue.join(entry({ userId: 'a', mode: 'rapid' }));
    queue.join(entry({ userId: 'b', mode: 'rapid' }));
    queue.join(entry({ userId: 'c', mode: 'blitz' }));
    expect(queue.size('rapid')).toBe(2);
    expect(queue.size('blitz')).toBe(1);
    expect(queue.size()).toBe(3);
  });
});

describe('pairing', () => {
  let queue: Matchmaker;
  beforeEach(() => {
    queue = new Matchmaker();
  });

  it('does nothing with a single player waiting', () => {
    queue.join(entry({ userId: 'a' }));
    expect(queue.drainPairings()).toEqual([]);
    expect(queue.has('a')).toBe(true);
  });

  it('pairs two close ratings immediately', () => {
    queue.join(entry({ userId: 'a', rating: 1200 }));
    queue.join(entry({ userId: 'b', rating: 1230 }));

    const pairings = queue.drainPairings();
    expect(pairings).toHaveLength(1);
    expect([pairings[0]!.a.userId, pairings[0]!.b.userId].sort()).toEqual(['a', 'b']);
    // Paired players leave the queue.
    expect(queue.size()).toBe(0);
  });

  it('holds distant ratings apart while both are fresh', () => {
    queue.join(entry({ userId: 'a', rating: 1000 }));
    queue.join(entry({ userId: 'b', rating: 1600 }));
    expect(queue.drainPairings()).toEqual([]);
    expect(queue.size()).toBe(2);
  });

  it('pairs distant ratings once the band has widened', () => {
    const a = queue.join(entry({ userId: 'a', rating: 1000 }));
    queue.join(entry({ userId: 'b', rating: 1600 }));

    // Player A has been waiting over a minute: the search is now unrestricted.
    a.joinedAt = Date.now() - 61_000;

    expect(queue.drainPairings()).toHaveLength(1);
  });

  it('never pairs across modes', () => {
    queue.join(entry({ userId: 'a', rating: 1200, mode: 'rapid' }));
    queue.join(entry({ userId: 'b', rating: 1200, mode: 'blitz' }));
    expect(queue.drainPairings()).toEqual([]);
  });

  it('prefers the closest rating available', () => {
    queue.join(entry({ userId: 'low', rating: 1200 }));
    queue.join(entry({ userId: 'near', rating: 1220 }));
    queue.join(entry({ userId: 'far', rating: 1245 }));

    const pairings = queue.drainPairings();
    expect(pairings).toHaveLength(1);
    const paired = [pairings[0]!.a.userId, pairings[0]!.b.userId].sort();
    // 1200 pairs with 1220, not 1245.
    expect(paired).toEqual(['low', 'near']);
    expect(queue.has('far')).toBe(true);
  });

  it('makes several pairings in one pass', () => {
    for (let i = 0; i < 6; i++) {
      queue.join(entry({ userId: `u${i}`, rating: 1200 + i * 10 }));
    }
    const pairings = queue.drainPairings();
    expect(pairings).toHaveLength(3);
    expect(queue.size()).toBe(0);
  });

  it('leaves an odd player waiting', () => {
    for (let i = 0; i < 5; i++) {
      queue.join(entry({ userId: `u${i}`, rating: 1200 }));
    }
    expect(queue.drainPairings()).toHaveLength(2);
    expect(queue.size()).toBe(1);
  });

  it('never pairs a player with themselves', () => {
    queue.join(entry({ userId: 'a', rating: 1200 }));
    for (const pairing of queue.drainPairings()) {
      expect(pairing.a.userId).not.toBe(pairing.b.userId);
    }
  });
});

describe('queue status', () => {
  it('reports the widening search band as time passes', () => {
    const queue = new Matchmaker();
    const joined = queue.join(entry({ userId: 'a' }));
    const t0 = joined.joinedAt;

    expect(queue.statusFor('a', t0)?.maxDelta).toBe(50);
    expect(queue.statusFor('a', t0 + 15_000)?.maxDelta).toBe(100);
    expect(queue.statusFor('a', t0 + 35_000)?.maxDelta).toBe(200);
    expect(queue.statusFor('a', t0 + 65_000)?.maxDelta).toBeNull();
    expect(queue.statusFor('a', t0 + 65_000)?.waitedSeconds).toBe(65);
  });

  it('returns null for someone not in the queue', () => {
    expect(new Matchmaker().statusFor('nobody')).toBeNull();
  });
});
