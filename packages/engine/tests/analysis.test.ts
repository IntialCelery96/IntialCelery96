import { describe, expect, it } from 'vitest';
import {
  BALANCED_STYLE,
  analyseGame,
  applyMove,
  createGame,
  immediateWins,
  isNotable,
  legalMoves,
  parseMoves,
  rankMoves,
  replay,
  turningPoint,
  WIN_SCORE,
} from '../src/index.js';

/** Analysis at a shallow depth, so the suite stays quick. */
const FAST = { depth: 4, timeBudgetMs: 5_000 };

describe('rankMoves', () => {
  it('scores every legal move, best first', () => {
    const ranked = rankMoves(createGame(), { depth: 4, style: BALANCED_STYLE });
    expect(ranked).toHaveLength(7);
    expect(new Set(ranked.map((r) => r.move)).size).toBe(7);
    for (let i = 1; i < ranked.length; i++) {
      expect(ranked[i - 1]!.score).toBeGreaterThanOrEqual(ranked[i]!.score);
    }
  });

  it('puts an immediate win at the top with a winning score', () => {
    // Player 1 to move with three stacked in column 3.
    const state = replay([3, 0, 3, 1, 3, 2]);
    const ranked = rankMoves(state, { depth: 4, style: BALANCED_STYLE });
    expect(ranked[0]!.move).toBe(3);
    expect(ranked[0]!.score).toBe(WIN_SCORE);
  });

  it('scores a move that loses on the spot below one that does not', () => {
    // Player 2 to move; player 1 threatens to complete column 3.
    const state = replay([3, 0, 3, 1, 3]);
    const ranked = rankMoves(state, { depth: 4, style: BALANCED_STYLE });
    const block = ranked.find((r) => r.move === 3)!;
    const ignore = ranked.find((r) => r.move === 6)!;
    expect(block.score).toBeGreaterThan(ignore.score);
  });

  it('returns nothing for a finished game', () => {
    const finished = replay([3, 4, 3, 4, 3, 4, 3]);
    expect(rankMoves(finished, { depth: 4, style: BALANCED_STYLE })).toEqual([]);
  });
});

describe('missed wins', () => {
  it('flags declining a win that was on the board', () => {
    // Player 1 stacks three in column 3, then plays elsewhere instead of winning.
    const analysis = analyseGame(parseMoves('3031326'), FAST);
    const missed = analysis.moves.find((m) => m.quality === 'missed_win');

    expect(missed).toBeDefined();
    expect(missed!.ply).toBe(6);
    expect(missed!.player).toBe(1);
    expect(missed!.column).toBe(6);
    expect(missed!.bestColumn).toBe(3);
    expect(missed!.note).toContain('Column 4');
    expect(analysis.players[1].missedWin).toBe(1);
  });

  it('does not flag a win that was taken', () => {
    const analysis = analyseGame(parseMoves('3031323'), FAST);
    expect(analysis.moves.every((m) => m.quality !== 'missed_win')).toBe(true);
    // The winning move should be rated best.
    expect(analysis.moves.at(-1)!.quality).toBe('best');
  });
});

describe('blunders', () => {
  it('flags a move that hands the opponent an immediate win', () => {
    // Player 1 builds three along the bottom in columns 0-2, so column 3 wins
    // for them. Player 2's own discs are scattered across columns 5 and 6 with
    // no threat of their own, so blocking is plainly the move — and they play
    // column 6 instead.
    const analysis = analyseGame(parseMoves('061526'), FAST);
    const blunder = analysis.moves.find((m) => m.quality === 'blunder');

    expect(blunder).toBeDefined();
    expect(blunder!.player).toBe(2);
    expect(blunder!.note).toContain('win with column');
    expect(analysis.players[2].blunder).toBeGreaterThanOrEqual(1);
  });

  it('does not blame the move when every move loses', () => {
    // Player 1 has an open-ended three across columns 3-5, so both column 2 and
    // column 6 win for them. Player 2 can block only one: whatever they play,
    // player 1 wins next move. Blaming that move would teach the wrong lesson —
    // the game was lost earlier.
    const moves = parseMoves('203645');
    const position = replay(moves.slice(0, 5));
    expect(position.turn).toBe(2);

    // Confirm the premise: every reply hands player 1 an immediate win.
    for (const column of legalMoves(position)) {
      expect(immediateWins(applyMove(position, column)).length).toBeGreaterThan(0);
    }

    const analysis = analyseGame(moves, FAST);
    const doomed = analysis.moves.find((m) => m.ply === 5)!;
    expect(doomed.player).toBe(2);
    expect(doomed.quality).not.toBe('blunder');

    // The real error was allowing the double threat two plies earlier.
    const earlier = analysis.moves.find((m) => m.ply === 3)!;
    expect(['mistake', 'inaccuracy', 'blunder']).toContain(earlier.quality);
  });

  it('names the blocking square only once when it is the winning square', () => {
    // The square to block is usually the very square the opponent would win on.
    // Naming it twice reads as a contradiction, so the note must not do that.
    const analysis = analyseGame(parseMoves('061526'), FAST);
    const blunder = analysis.moves.find((m) => m.quality === 'blunder')!;
    expect(blunder.note).toContain('Taking column');
    expect(blunder.note).not.toContain('held the position');
  });
});

describe('summaries', () => {
  it('counts every move against exactly one player', () => {
    const moves = parseMoves('3344556');
    const analysis = analyseGame(moves, FAST);

    const counted = ([1, 2] as const).reduce((total, player) => {
      const s = analysis.players[player];
      return (
        total + s.best + s.good + s.inaccuracy + s.mistake + s.blunder + s.missedWin
      );
    }, 0);

    expect(counted).toBe(analysis.moves.length);
    expect(analysis.moves.length).toBe(moves.length);
  });

  it('alternates players across plies', () => {
    const analysis = analyseGame(parseMoves('333333'), FAST);
    analysis.moves.forEach((move, index) => {
      expect(move.player).toBe(index % 2 === 0 ? 1 : 2);
    });
  });

  it('reports accuracy as the share of top-choice moves', () => {
    const analysis = analyseGame(parseMoves('3344'), FAST);
    for (const player of [1, 2] as const) {
      const s = analysis.players[player];
      const total = s.best + s.good + s.inaccuracy + s.mistake + s.blunder + s.missedWin;
      expect(s.accuracy).toBeCloseTo(total === 0 ? 0 : s.best / total, 6);
      expect(s.accuracy).toBeGreaterThanOrEqual(0);
      expect(s.accuracy).toBeLessThanOrEqual(1);
    }
  });

  it('never reports a negative score drop', () => {
    const analysis = analyseGame(parseMoves('3413526'), FAST);
    for (const move of analysis.moves) {
      expect(move.scoreDrop).toBeGreaterThanOrEqual(0);
    }
  });

  it('gives the best move a zero drop', () => {
    const analysis = analyseGame(parseMoves('3344'), FAST);
    for (const move of analysis.moves) {
      if (move.quality === 'best') expect(move.scoreDrop).toBe(0);
    }
  });
});

describe('robustness', () => {
  it('handles an empty game', () => {
    const analysis = analyseGame([], FAST);
    expect(analysis.moves).toEqual([]);
    expect(analysis.players[1].accuracy).toBe(0);
  });

  it('stops at the end of a decided game rather than throwing', () => {
    // A won game with trailing junk appended.
    const analysis = analyseGame([...parseMoves('3434343'), 0, 1, 2], FAST);
    expect(analysis.moves).toHaveLength(7);
  });

  it('stops at an illegal move rather than throwing', () => {
    // Column 0 seven times: the seventh does not fit.
    const analysis = analyseGame([0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0], FAST);
    expect(analysis.moves.length).toBeLessThanOrEqual(12);
    expect(() => analyseGame([0, 0, 0, 0, 0, 0, 0], FAST)).not.toThrow();
  });

  it('records the depth it used', () => {
    expect(analyseGame(parseMoves('33'), FAST).depth).toBe(4);
  });
});

describe('turningPoint', () => {
  it('returns null for a game with nothing notable', () => {
    const analysis = analyseGame(parseMoves('33'), FAST);
    if (analysis.moves.every((m) => !isNotable(m.quality))) {
      expect(turningPoint(analysis)).toBeNull();
    }
  });

  it('picks the earliest moment of the highest severity', () => {
    // This game contains both a blunder (player 2 ignores a threat on ply 5)
    // and a missed win (player 1 declines the win on ply 6). They are equally
    // severe, so the turning point is the earlier one: the game was decided
    // when the threat was allowed, not when the win was fumbled.
    const analysis = analyseGame(parseMoves('3031326'), FAST);
    const point = turningPoint(analysis);

    expect(point).not.toBeNull();
    expect(point!.quality).toBe('blunder');
    expect(point!.ply).toBe(5);
    expect(point!.player).toBe(2);
  });

  it('never points at a move less severe than another in the game', () => {
    const analysis = analyseGame(parseMoves('3031326'), FAST);
    const point = turningPoint(analysis)!;
    const severity: Record<string, number> = {
      missed_win: 3, blunder: 3, mistake: 2, inaccuracy: 1, good: 0, best: 0,
    };
    for (const move of analysis.moves) {
      expect(severity[point.quality]!).toBeGreaterThanOrEqual(severity[move.quality]!);
    }
  });
});

describe('isNotable', () => {
  it('surfaces only the qualities worth telling a player about', () => {
    expect(isNotable('missed_win')).toBe(true);
    expect(isNotable('blunder')).toBe(true);
    expect(isNotable('mistake')).toBe(true);
    expect(isNotable('inaccuracy')).toBe(false);
    expect(isNotable('good')).toBe(false);
    expect(isNotable('best')).toBe(false);
  });
});
