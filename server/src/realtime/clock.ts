/**
 * Chess-style clocks.
 *
 * Only the player on move burns time. The clock is stored as "milliseconds
 * remaining as of `lastTickAt`" rather than as a running timer, so the true
 * remaining time is always derivable from the wall clock. That makes it safe to
 * broadcast, safe to recover after a restart, and impossible for a client to
 * influence.
 */

import type { Player } from '@connect4gg/engine';

export interface ClockState {
  player1Ms: number;
  player2Ms: number;
  /** Whose clock is running, or null when the clock is paused or the game is over. */
  running: Player | null;
  /** When the running clock was last reconciled. */
  lastTickAt: number;
  incrementMs: number;
  /** Untimed modes carry a clock object that never counts down. */
  untimed: boolean;
}

export function createClock(initialMs: number, incrementMs: number): ClockState {
  return {
    player1Ms: initialMs,
    player2Ms: initialMs,
    running: null,
    lastTickAt: Date.now(),
    incrementMs,
    untimed: initialMs <= 0,
  };
}

/** Milliseconds remaining for each side right now, without mutating anything. */
export function remaining(clock: ClockState, now = Date.now()): { player1Ms: number; player2Ms: number } {
  if (clock.untimed || clock.running === null) {
    return { player1Ms: clock.player1Ms, player2Ms: clock.player2Ms };
  }
  const elapsed = Math.max(0, now - clock.lastTickAt);
  return {
    player1Ms: clock.running === 1 ? Math.max(0, clock.player1Ms - elapsed) : clock.player1Ms,
    player2Ms: clock.running === 2 ? Math.max(0, clock.player2Ms - elapsed) : clock.player2Ms,
  };
}

/** Folds elapsed time into the stored balances and resets the tick marker. */
function settle(clock: ClockState, now: number): void {
  const current = remaining(clock, now);
  clock.player1Ms = current.player1Ms;
  clock.player2Ms = current.player2Ms;
  clock.lastTickAt = now;
}

/** Starts (or hands over) the clock to `player`. */
export function startFor(clock: ClockState, player: Player, now = Date.now()): void {
  settle(clock, now);
  clock.running = clock.untimed ? null : player;
}

/**
 * Records a completed move: settles the mover's time, adds their increment, and
 * passes the clock to the opponent.
 */
export function applyMoveToClock(clock: ClockState, mover: Player, next: Player, now = Date.now()): void {
  settle(clock, now);
  if (!clock.untimed && clock.incrementMs > 0) {
    if (mover === 1) clock.player1Ms += clock.incrementMs;
    else clock.player2Ms += clock.incrementMs;
  }
  clock.running = clock.untimed ? null : next;
}

/** Pauses without changing whose turn it is — used during a disconnect. */
export function pause(clock: ClockState, now = Date.now()): void {
  settle(clock, now);
  clock.running = null;
}

export function resume(clock: ClockState, player: Player, now = Date.now()): void {
  startFor(clock, player, now);
}

export function stop(clock: ClockState, now = Date.now()): void {
  settle(clock, now);
  clock.running = null;
}

/** The player who has run out of time, if any. */
export function flagged(clock: ClockState, now = Date.now()): Player | null {
  if (clock.untimed) return null;
  const current = remaining(clock, now);
  if (clock.running === 1 && current.player1Ms <= 0) return 1;
  if (clock.running === 2 && current.player2Ms <= 0) return 2;
  return null;
}

/** Milliseconds until the running clock hits zero, or null if none is running. */
export function msUntilFlag(clock: ClockState, now = Date.now()): number | null {
  if (clock.untimed || clock.running === null) return null;
  const current = remaining(clock, now);
  return clock.running === 1 ? current.player1Ms : current.player2Ms;
}

export interface ClockSnapshot {
  player1Ms: number;
  player2Ms: number;
  running: Player | null;
  untimed: boolean;
  /** Server time the snapshot was taken, so clients can correct for latency. */
  at: number;
}

export function snapshot(clock: ClockState, now = Date.now()): ClockSnapshot {
  const current = remaining(clock, now);
  return {
    player1Ms: current.player1Ms,
    player2Ms: current.player2Ms,
    running: clock.running,
    untimed: clock.untimed,
    at: now,
  };
}
