import { describe, expect, it, vi } from 'vitest';
import { LiveGame, type LiveSeat } from '../src/realtime/liveGame.js';

function seat(overrides: Partial<LiveSeat> = {}): LiveSeat {
  return {
    userId: overrides.userId ?? 'user-1',
    botId: overrides.botId ?? null,
    username: overrides.username ?? 'player',
    avatarUrl: null,
    rating: overrides.rating ?? 1200,
    sockets: new Set(overrides.sockets ?? []),
    disconnectedAt: null,
  };
}

function makeGame(mode: 'rapid' | 'casual' = 'rapid') {
  const game = new LiveGame({
    id: 'game-1',
    mode,
    rated: mode !== 'casual',
    player1: seat({ userId: 'alice', username: 'alice' }),
    player2: seat({ userId: 'bob', username: 'bob' }),
  });
  game.start();
  return game;
}

describe('seating', () => {
  it('maps a user to their seat', () => {
    const game = makeGame();
    expect(game.seatOf('alice')).toBe(1);
    expect(game.seatOf('bob')).toBe(2);
    expect(game.seatOf('carol')).toBeNull();
  });
});

describe('move validation', () => {
  it('accepts a legal move from the player on turn', () => {
    const game = makeGame();
    expect(game.playMove(1, 3)).toEqual({ ok: true });
    expect(game.moves).toBe('3');
    expect(game.state.turn).toBe(2);
  });

  it('rejects a move from the player not on turn', () => {
    const game = makeGame();
    const result = game.playMove(2, 3);
    expect(result.ok).toBe(false);
    expect(game.moveCount).toBe(0);
  });

  it('rejects an out-of-range column', () => {
    const game = makeGame();
    expect(game.playMove(1, 9).ok).toBe(false);
    expect(game.playMove(1, -1).ok).toBe(false);
    expect(game.moveCount).toBe(0);
  });

  it('rejects a move into a full column', () => {
    const game = makeGame();
    for (let i = 0; i < 6; i++) {
      // Alternate columns so nobody connects four while filling column 0.
      game.playMove(game.state.turn, 0);
    }
    const result = game.playMove(game.state.turn, 0);
    expect(result.ok).toBe(false);
    expect(result).toHaveProperty('reason');
  });

  it('rejects every move once the game is over', () => {
    const game = makeGame();
    game.resign(1);
    expect(game.playMove(2, 3).ok).toBe(false);
  });
});

describe('ending a game', () => {
  it('ends on four in a row', () => {
    const game = makeGame();
    // Player 1 stacks column 3; player 2 stacks column 4.
    for (const column of [3, 4, 3, 4, 3, 4]) game.playMove(game.state.turn, column);
    game.playMove(1, 3);

    expect(game.over).toEqual({ outcome: 'player1', reason: 'CONNECT_FOUR', winner: 1 });
    expect(game.state.winningLine).toHaveLength(4);
  });

  it('awards the win to the opponent on resignation', () => {
    const game = makeGame();
    game.playMove(1, 3);
    game.resign(2);
    expect(game.over).toEqual({ outcome: 'player1', reason: 'RESIGNATION', winner: 1 });
  });

  it('stops the clock when the game ends', () => {
    const game = makeGame();
    game.resign(1);
    expect(game.clock.running).toBeNull();
  });

  it('ignores a second ending', () => {
    const game = makeGame();
    game.resign(1);
    const first = game.over;
    game.resign(2);
    expect(game.over).toBe(first);
  });
});

describe('draw offers', () => {
  it('records an offer, then agrees when the opponent offers too', () => {
    const game = makeGame();
    expect(game.offerDraw(1)).toBe('offered');
    expect(game.drawOfferFrom).toBe(1);

    expect(game.offerDraw(1)).toBe('noop');

    expect(game.offerDraw(2)).toBe('accepted');
    expect(game.over).toEqual({ outcome: 'draw', reason: 'DRAW_AGREED', winner: null });
  });

  it('lets the opponent decline', () => {
    const game = makeGame();
    game.offerDraw(1);
    game.declineDraw(2);
    expect(game.drawOfferFrom).toBeNull();
    expect(game.over).toBeNull();
  });

  it('clears an outstanding offer when a move is played', () => {
    const game = makeGame();
    game.offerDraw(2);
    game.playMove(1, 3);
    expect(game.drawOfferFrom).toBeNull();
  });
});

describe('timeouts', () => {
  it('flags the player who ran out of time', () => {
    vi.useFakeTimers();
    try {
      const game = makeGame();
      // Rapid is 5 minutes; jump past it while player 1 is on move.
      vi.advanceTimersByTime(301_000);
      expect(game.checkFlag()).toBe(true);
      expect(game.over).toEqual({ outcome: 'player2', reason: 'TIMEOUT', winner: 2 });
    } finally {
      vi.useRealTimers();
    }
  });

  it('never flags an untimed game', () => {
    vi.useFakeTimers();
    try {
      const game = makeGame('casual');
      vi.advanceTimersByTime(3_600_000);
      expect(game.checkFlag()).toBe(false);
      expect(game.over).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('disconnects', () => {
  it('pauses the clock rather than running it down', () => {
    vi.useFakeTimers();
    try {
      const game = makeGame();
      game.attach(1, 'socket-alice');
      game.attach(2, 'socket-bob');
      game.playMove(1, 3);
      game.playMove(2, 3);

      // Player 1 is on move when their socket drops.
      game.detach('socket-alice', () => undefined);
      expect(game.clock.running).toBeNull();

      const before = game.clockSnapshot().player1Ms;
      vi.advanceTimersByTime(20_000);
      expect(game.clockSnapshot().player1Ms).toBe(before);
    } finally {
      vi.useRealTimers();
    }
  });

  it('resumes the clock when the player comes back', () => {
    vi.useFakeTimers();
    try {
      const game = makeGame();
      game.attach(1, 'socket-alice');
      game.playMove(1, 3);
      game.playMove(2, 3);

      game.detach('socket-alice', () => undefined);
      const { resumed } = game.attach(1, 'socket-alice-2');

      expect(resumed).toBe(true);
      expect(game.clock.running).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('forfeits only after the grace period elapses', () => {
    vi.useFakeTimers();
    try {
      const game = makeGame();
      game.attach(1, 'socket-alice');
      game.playMove(1, 3);

      const onForfeit = vi.fn();
      game.detach('socket-alice', onForfeit);

      vi.advanceTimersByTime(59_000);
      expect(onForfeit).not.toHaveBeenCalled();

      vi.advanceTimersByTime(2_000);
      expect(onForfeit).toHaveBeenCalledWith(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('cancels the forfeit if the player reconnects in time', () => {
    vi.useFakeTimers();
    try {
      const game = makeGame();
      game.attach(1, 'socket-alice');
      game.playMove(1, 3);

      const onForfeit = vi.fn();
      game.detach('socket-alice', onForfeit);
      vi.advanceTimersByTime(30_000);
      game.attach(1, 'socket-alice-2');
      vi.advanceTimersByTime(60_000);

      expect(onForfeit).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps the seat connected while another socket remains', () => {
    const game = makeGame();
    game.attach(1, 'tab-one');
    game.attach(1, 'tab-two');

    const onForfeit = vi.fn();
    game.detach('tab-one', onForfeit);

    expect(game.seats[1].sockets.size).toBe(1);
    expect(game.toPayload().players[1].connected).toBe(true);
  });
});

describe('payload', () => {
  it('carries everything a client needs to render the board', () => {
    const game = makeGame();
    game.playMove(1, 3);

    const payload = game.toPayload();
    expect(payload.board).toHaveLength(42);
    expect(payload.turn).toBe(2);
    expect(payload.moves).toBe('3');
    expect(payload.legalMoves).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(payload.players[1].username).toBe('alice');
    expect(payload.clock.running).toBe(2);
    expect(payload.over).toBeNull();
  });

  it('reports a bot seat as always connected', () => {
    const game = new LiveGame({
      id: 'g',
      mode: 'casual',
      rated: false,
      player1: seat({ userId: 'alice' }),
      player2: seat({ userId: null, botId: 'nora', username: 'Nora' }),
    });
    expect(game.toPayload().players[2].connected).toBe(true);
    expect(game.isBotSeat(2)).toBe(true);
    expect(game.hasBot).toBe(true);
  });
});
