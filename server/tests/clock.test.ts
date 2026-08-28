import { describe, expect, it } from 'vitest';
import {
  applyMoveToClock,
  createClock,
  flagged,
  msUntilFlag,
  pause,
  remaining,
  resume,
  snapshot,
  startFor,
  stop,
} from '../src/realtime/clock.js';

describe('createClock', () => {
  it('starts both players with the full time and nothing running', () => {
    const clock = createClock(60_000, 2_000);
    expect(clock.player1Ms).toBe(60_000);
    expect(clock.player2Ms).toBe(60_000);
    expect(clock.running).toBeNull();
    expect(clock.untimed).toBe(false);
  });

  it('marks a zero starting time as untimed', () => {
    expect(createClock(0, 0).untimed).toBe(true);
  });
});

describe('only the player on move burns time', () => {
  it('deducts from the running side alone', () => {
    const clock = createClock(60_000, 0);
    const t0 = 1_000_000;
    startFor(clock, 1, t0);

    const after = remaining(clock, t0 + 5_000);
    expect(after.player1Ms).toBe(55_000);
    expect(after.player2Ms).toBe(60_000);
  });

  it('does not run down an untimed clock', () => {
    const clock = createClock(0, 0);
    const t0 = 1_000_000;
    startFor(clock, 1, t0);
    expect(clock.running).toBeNull();
    expect(remaining(clock, t0 + 600_000)).toEqual({ player1Ms: 0, player2Ms: 0 });
    expect(flagged(clock, t0 + 600_000)).toBeNull();
  });
});

describe('increments', () => {
  it('adds the increment to the mover and hands the clock over', () => {
    const clock = createClock(60_000, 2_000);
    const t0 = 1_000_000;
    startFor(clock, 1, t0);

    // Player 1 thinks for 5s, then moves.
    applyMoveToClock(clock, 1, 2, t0 + 5_000);

    expect(clock.player1Ms).toBe(57_000); // 60 - 5 + 2
    expect(clock.player2Ms).toBe(60_000);
    expect(clock.running).toBe(2);
  });

  it('lets a fast player gain time overall', () => {
    const clock = createClock(60_000, 2_000);
    let t = 1_000_000;
    startFor(clock, 1, t);

    // Five moves at half a second each: +1.5s net per move.
    for (let i = 0; i < 5; i++) {
      t += 500;
      applyMoveToClock(clock, 1, 2, t);
      applyMoveToClock(clock, 2, 1, t);
    }

    expect(clock.player1Ms).toBeGreaterThan(60_000);
  });

  it('adds nothing when the mode has no increment', () => {
    const clock = createClock(900_000, 0);
    const t0 = 1_000_000;
    startFor(clock, 1, t0);
    applyMoveToClock(clock, 1, 2, t0 + 10_000);
    expect(clock.player1Ms).toBe(890_000);
  });
});

describe('flagging', () => {
  it('reports the player whose clock hit zero', () => {
    const clock = createClock(5_000, 0);
    const t0 = 1_000_000;
    startFor(clock, 1, t0);

    expect(flagged(clock, t0 + 4_999)).toBeNull();
    expect(flagged(clock, t0 + 5_000)).toBe(1);
    expect(flagged(clock, t0 + 9_000)).toBe(1);
  });

  it('never reports the idle player', () => {
    const clock = createClock(5_000, 0);
    const t0 = 1_000_000;
    startFor(clock, 2, t0);
    expect(flagged(clock, t0 + 60_000)).toBe(2);
  });

  it('never lets a clock go negative', () => {
    const clock = createClock(1_000, 0);
    const t0 = 1_000_000;
    startFor(clock, 1, t0);
    expect(remaining(clock, t0 + 500_000).player1Ms).toBe(0);
  });

  it('reports when the flag will fall', () => {
    const clock = createClock(30_000, 0);
    const t0 = 1_000_000;
    startFor(clock, 1, t0);
    expect(msUntilFlag(clock, t0 + 10_000)).toBe(20_000);

    stop(clock, t0 + 10_000);
    expect(msUntilFlag(clock, t0 + 10_000)).toBeNull();
  });
});

describe('pause and resume', () => {
  it('freezes the clock while a player is disconnected', () => {
    const clock = createClock(60_000, 0);
    const t0 = 1_000_000;
    startFor(clock, 1, t0);

    // Player 1 drops after 5 seconds.
    pause(clock, t0 + 5_000);
    expect(clock.running).toBeNull();

    // A minute passes while they reconnect: no further time is lost.
    expect(remaining(clock, t0 + 65_000).player1Ms).toBe(55_000);
    expect(flagged(clock, t0 + 65_000)).toBeNull();

    resume(clock, 1, t0 + 65_000);
    expect(clock.running).toBe(1);
    expect(remaining(clock, t0 + 66_000).player1Ms).toBe(54_000);
  });
});

describe('snapshot', () => {
  it('reports live values plus the server time', () => {
    const clock = createClock(60_000, 2_000);
    const t0 = 1_000_000;
    startFor(clock, 1, t0);

    const snap = snapshot(clock, t0 + 3_000);
    expect(snap.player1Ms).toBe(57_000);
    expect(snap.player2Ms).toBe(60_000);
    expect(snap.running).toBe(1);
    expect(snap.at).toBe(t0 + 3_000);
  });

  it('does not mutate the clock', () => {
    const clock = createClock(60_000, 0);
    const t0 = 1_000_000;
    startFor(clock, 1, t0);
    snapshot(clock, t0 + 10_000);
    expect(clock.player1Ms).toBe(60_000);
  });
});
