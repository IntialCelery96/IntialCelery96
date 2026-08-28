import { type GameModeId, bandFor, canPair } from '@connect4gg/engine';

/**
 * The matchmaking queue.
 *
 * One queue per mode. Every tick, waiting players are sorted by rating and
 * adjacent pairs are checked against the widening rating bands — sorting first
 * means the closest available match is always considered before a distant one,
 * so nobody gets paired 300 points away while a 20-point match is sitting in
 * the same queue.
 */

export interface QueueEntry {
  userId: string;
  socketId: string;
  username: string;
  rating: number;
  mode: GameModeId;
  joinedAt: number;
}

export interface Pairing {
  mode: GameModeId;
  a: QueueEntry;
  b: QueueEntry;
}

export interface QueueStatus {
  mode: GameModeId;
  waitedSeconds: number;
  /** Current acceptable rating spread, or null once the search is unrestricted. */
  maxDelta: number | null;
  playersWaiting: number;
}

export class Matchmaker {
  /** Keyed by userId so a player can only ever hold one place in one queue. */
  private readonly entries = new Map<string, QueueEntry>();

  join(entry: Omit<QueueEntry, 'joinedAt'>): QueueEntry {
    // Re-joining replaces the old entry but keeps the original wait time, so
    // a reconnect doesn't send someone to the back of the line.
    const existing = this.entries.get(entry.userId);
    const record: QueueEntry = {
      ...entry,
      joinedAt: existing?.mode === entry.mode ? existing.joinedAt : Date.now(),
    };
    this.entries.set(entry.userId, record);
    return record;
  }

  leave(userId: string): QueueEntry | null {
    const entry = this.entries.get(userId);
    if (!entry) return null;
    this.entries.delete(userId);
    return entry;
  }

  leaveBySocket(socketId: string): QueueEntry | null {
    for (const entry of this.entries.values()) {
      if (entry.socketId === socketId) {
        this.entries.delete(entry.userId);
        return entry;
      }
    }
    return null;
  }

  has(userId: string): boolean {
    return this.entries.has(userId);
  }

  get(userId: string): QueueEntry | null {
    return this.entries.get(userId) ?? null;
  }

  size(mode?: GameModeId): number {
    if (!mode) return this.entries.size;
    let count = 0;
    for (const entry of this.entries.values()) if (entry.mode === mode) count++;
    return count;
  }

  statusFor(userId: string, now = Date.now()): QueueStatus | null {
    const entry = this.entries.get(userId);
    if (!entry) return null;
    const waitedSeconds = Math.floor((now - entry.joinedAt) / 1000);
    return {
      mode: entry.mode,
      waitedSeconds,
      maxDelta: bandFor(waitedSeconds).maxDelta,
      playersWaiting: this.size(entry.mode),
    };
  }

  /**
   * Finds every pair that can be made right now and removes them from the queue.
   *
   * Within a mode, players are sorted by rating and walked in order: each
   * unpaired player is matched with the nearest still-unpaired player whose
   * band allows it. That greedy pass is enough for a queue of realistic size
   * and keeps rating gaps as small as the bands permit.
   */
  drainPairings(now = Date.now()): Pairing[] {
    const byMode = new Map<GameModeId, QueueEntry[]>();
    for (const entry of this.entries.values()) {
      const list = byMode.get(entry.mode);
      if (list) list.push(entry);
      else byMode.set(entry.mode, [entry]);
    }

    const pairings: Pairing[] = [];

    for (const [mode, entries] of byMode) {
      if (entries.length < 2) continue;
      entries.sort((a, b) => a.rating - b.rating);

      const paired = new Set<string>();

      for (let i = 0; i < entries.length; i++) {
        const a = entries[i]!;
        if (paired.has(a.userId)) continue;

        for (let j = i + 1; j < entries.length; j++) {
          const b = entries[j]!;
          if (paired.has(b.userId)) continue;

          const waitedA = (now - a.joinedAt) / 1000;
          const waitedB = (now - b.joinedAt) / 1000;
          if (!canPair(a.rating, waitedA, b.rating, waitedB)) {
            // The list is rating-sorted, so every later candidate is further
            // away still — no point looking past the first failure.
            break;
          }

          paired.add(a.userId);
          paired.add(b.userId);
          pairings.push({ mode, a, b });
          break;
        }
      }

      for (const userId of paired) this.entries.delete(userId);
    }

    return pairings;
  }

  /** Everyone still waiting, for periodic status broadcasts. */
  waiting(): QueueEntry[] {
    return [...this.entries.values()];
  }

  clear(): void {
    this.entries.clear();
  }
}
