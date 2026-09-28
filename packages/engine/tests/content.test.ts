import { describe, expect, it } from 'vitest';
import {
  CELL_COUNT,
  COURSES,
  DIFFICULTY_TARGETS,
  LESSONS,
  LESSONS_BY_SLUG,
  PUZZLES,
  PUZZLE_THEMES,
  applyMove,
  curriculumProgress,
  difficultyRank,
  isLessonUnlocked,
  isPuzzleUnlocked,
  lessonForPuzzle,
  puzzlesForLesson,
  immediateThreats,
  immediateWins,
  isPuzzleTheme,
  legalMoves,
  replay,
  type GameState,
  type Lesson,
  type Puzzle,
  type TryItBlock,
} from '../src/index.js';

/**
 * The curriculum is data, so this suite is what makes it trustworthy: every
 * diagram must be a legal position, every highlight must ring a disc, every
 * "try it" answer must be right by the rules of the position, and every puzzle
 * answer must be exactly the set of correct moves — proved, not asserted.
 *
 * Three kinds of proof are used, from cheapest to strongest:
 *   - the rules of the position (a win on the board, a threat to block);
 *   - a bounded exact search ("forces a win within N plies");
 *   - a full exact solve, for endgames with few enough empty squares.
 */

// --- Exact solving -----------------------------------------------------------

/** Positions with at most this many empty squares are solved exhaustively. */
const SOLVE_LIMIT = 14;

const memo = new Map<string, number>();

/** Value for the side to move: >0 win, 0 draw, <0 loss. Magnitude prefers faster wins. */
function value(state: GameState): number {
  if (state.status === 'win') return -1000;
  if (state.status === 'draw') return 0;
  const key = state.board.join('') + state.turn;
  const hit = memo.get(key);
  if (hit !== undefined) return hit;
  let best = -Infinity;
  for (const col of legalMoves(state)) {
    const next = applyMove(state, col);
    const score =
      next.status === 'win' ? 1000 - state.moves.length : next.status === 'draw' ? 0 : -value(next);
    if (score > best) best = score;
  }
  memo.set(key, best);
  return best;
}

/** Every move that achieves the position's exact value. */
function bestMoves(state: GameState): number[] {
  const scored = legalMoves(state).map((col) => {
    const next = applyMove(state, col);
    const score =
      next.status === 'win' ? 1000 - state.moves.length : next.status === 'draw' ? 0 : -value(next);
    return { col, score };
  });
  // Any winning move counts, not only the fastest; a puzzle asks for a win,
  // not a mate in the fewest moves.
  const top = Math.max(...scored.map((s) => s.score));
  const sign = Math.sign(top);
  return scored.filter((s) => Math.sign(s.score) === sign).map((s) => s.col);
}

function empties(state: GameState): number {
  return CELL_COUNT - state.moves.length;
}

// --- Bounded search ----------------------------------------------------------

function canWinWithin(state: GameState, plies: number): boolean {
  if (plies <= 0) return false;
  for (const col of legalMoves(state)) {
    const next = applyMove(state, col);
    if (next.status === 'win') return true;
    if (next.status === 'draw') continue;
    if (plies >= 3 && !canEscapeWithin(next, plies - 1)) return true;
  }
  return false;
}

function canEscapeWithin(state: GameState, plies: number): boolean {
  for (const col of legalMoves(state)) {
    const next = applyMove(state, col);
    if (next.status !== 'in_progress') return true;
    if (!canWinWithin(next, plies - 1)) return true;
  }
  return false;
}

/** Moves for the side to move that force a win within `plies` plies. Exact. */
function forcingMoves(state: GameState, plies: number): number[] {
  return legalMoves(state).filter((col) => {
    const next = applyMove(state, col);
    if (next.status === 'win') return true;
    return next.status === 'in_progress' && plies >= 3 && !canEscapeWithin(next, plies - 1);
  });
}

/** Moves after which the opponent has no forced win within `plies` plies. */
function holdingMoves(state: GameState, plies: number): number[] {
  return legalMoves(state).filter((col) => {
    const next = applyMove(state, col);
    return next.status !== 'in_progress' || forcingMoves(next, plies).length === 0;
  });
}

/** Moves that leave the mover with two or more winning squares. */
function doubleThreatMoves(state: GameState): number[] {
  return legalMoves(state).filter((col) => {
    const next = applyMove(state, col);
    if (next.status !== 'in_progress') return false;
    return immediateWins({ ...next, turn: state.turn }).length >= 2;
  });
}

const sorted = (xs: readonly number[]) => [...xs].sort((a, b) => a - b);

// --- Structure ---------------------------------------------------------------

describe('curriculum structure', () => {
  it('has unique slugs and course ids', () => {
    expect(new Set(LESSONS.map((l) => l.slug)).size).toBe(LESSONS.length);
    expect(new Set(PUZZLES.map((p) => p.slug)).size).toBe(PUZZLES.length);
    expect(new Set(COURSES.map((c) => c.id)).size).toBe(COURSES.length);
  });

  it('files every lesson under a course of the same tier, with unique order', () => {
    for (const course of COURSES) {
      const lessons = LESSONS.filter((l) => l.course === course.id);
      expect(lessons.length, `course ${course.id} has lessons`).toBeGreaterThan(0);
      expect(new Set(lessons.map((l) => l.order)).size).toBe(lessons.length);
      for (const lesson of lessons) {
        expect(lesson.difficulty, `${lesson.slug} tier`).toBe(course.difficulty);
      }
    }
    for (const lesson of LESSONS) {
      expect(COURSES.some((c) => c.id === lesson.course), `${lesson.slug} course`).toBe(true);
    }
  });

  it('lists lessons in teaching order', () => {
    for (let i = 1; i < LESSONS.length; i++) {
      const a = LESSONS[i - 1]!;
      const b = LESSONS[i]!;
      expect(difficultyRank(a.difficulty) <= difficultyRank(b.difficulty)).toBe(true);
    }
  });

  it('gives every puzzle a known theme, a tier-appropriate rating and a prompt', () => {
    for (const puzzle of PUZZLES) {
      expect(isPuzzleTheme(puzzle.theme), `${puzzle.slug} theme`).toBe(true);
      const target = DIFFICULTY_TARGETS[puzzle.difficulty];
      expect(puzzle.rating, `${puzzle.slug} rating floor`).toBeGreaterThanOrEqual(target.minRating);
      if (target.maxRating !== null) {
        expect(puzzle.rating, `${puzzle.slug} rating ceiling`).toBeLessThanOrEqual(target.maxRating);
      }
      expect(puzzle.prompt.length).toBeGreaterThan(0);
      expect(puzzle.explanation.length).toBeGreaterThan(0);
    }
  });

  it('puts at least one puzzle at the end of every lesson, in the lesson\'s tier, with unique order', () => {
    for (const lesson of LESSONS) {
      const puzzles = puzzlesForLesson(lesson.slug);
      expect(puzzles.length, `${lesson.slug} has puzzles`).toBeGreaterThan(0);
      expect(new Set(puzzles.map((p) => p.order)).size).toBe(puzzles.length);
      for (const puzzle of puzzles) {
        expect(puzzle.difficulty, `${puzzle.slug} tier`).toBe(lesson.difficulty);
      }
    }
    for (const puzzle of PUZZLES) {
      expect(LESSONS_BY_SLUG[puzzle.lesson], `${puzzle.slug} lesson exists`).toBeDefined();
      expect(lessonForPuzzle(puzzle.slug)?.slug).toBe(puzzle.lesson);
    }
  });

  it('uses every puzzle theme at least once', () => {
    for (const theme of PUZZLE_THEMES) {
      expect(PUZZLES.some((p) => p.theme === theme), `theme ${theme}`).toBe(true);
    }
  });

  it('ends every lesson with its sources', () => {
    for (const lesson of LESSONS) {
      const last = lesson.blocks[lesson.blocks.length - 1];
      expect(last?.kind, `${lesson.slug} ends with references`).toBe('reference');
      if (last?.kind === 'reference') {
        expect(last.sources.length).toBeGreaterThan(0);
        for (const source of last.sources) {
          expect(source.title.length).toBeGreaterThan(0);
          expect(source.citation.length).toBeGreaterThan(0);
        }
      }
    }
  });
});

// --- Diagrams ----------------------------------------------------------------

describe('lesson diagrams', () => {
  for (const lesson of LESSONS) {
    if (!lesson.blocks.some((b) => b.kind === 'board' || b.kind === 'tryIt')) continue;
    describe(lesson.slug, () => {
      lesson.blocks.forEach((block, index) => {
        if (block.kind !== 'board' && block.kind !== 'tryIt') return;

        it(`block ${index} is a legal, unfinished position`, () => {
          const state = replay(block.moves);
          expect(state.status).toBe('in_progress');
        });

        if (block.kind === 'board' && block.highlight) {
          it(`block ${index} highlights only discs`, () => {
            const state = replay(block.moves);
            for (const cell of block.highlight!) {
              expect(cell).toBeGreaterThanOrEqual(0);
              expect(cell).toBeLessThan(CELL_COUNT);
              expect(state.board[cell], `cell ${cell} is a disc`).not.toBe(0);
            }
          });
        }
      });
    });
  }
});

// --- Try-it answers ----------------------------------------------------------

/**
 * Try-its that ask for a tactic rather than a rule-of-position answer, with
 * the exact claim each one makes. Keyed by lesson slug and block index.
 */
const TRY_IT_CLAIMS: Record<string, { forcedWithin?: number; doubleThreat?: true; holdsWithin?: number }> = {
  'the-double-threat:3': { doubleThreat: true },
  'the-double-threat:5': { doubleThreat: true },
  'the-seven-trap:3': { forcedWithin: 3 },
  'the-seven-trap:6': { holdsWithin: 7 },
  'forcing-sequences:2': { forcedWithin: 3 },
  'forcing-sequences:5': { forcedWithin: 5 },
};

function tryIts(lesson: Lesson): { block: TryItBlock; index: number }[] {
  return lesson.blocks.flatMap((block, index) =>
    block.kind === 'tryIt' ? [{ block, index }] : [],
  );
}

describe('try-it answers', () => {
  for (const lesson of LESSONS) {
    for (const { block, index } of tryIts(lesson)) {
      const name = `${lesson.slug}:${index}`;

      it(`${name} accepts only legal moves, and never a losing one`, () => {
        const state = replay(block.moves);
        const legal = legalMoves(state);
        expect(block.answers.length).toBeGreaterThan(0);
        for (const answer of block.answers) {
          expect(legal, `${answer} is legal`).toContain(answer);
          const next = applyMove(state, answer);
          if (next.status === 'in_progress') {
            expect(immediateWins(next), `${answer} hands over a win`).toEqual([]);
          }
        }
      });

      it(`${name} is right by the position`, () => {
        const state = replay(block.moves);
        const wins = immediateWins(state);
        const threats = immediateThreats(state);
        const claim = TRY_IT_CLAIMS[name];

        if (wins.length > 0) {
          expect(sorted(block.answers)).toEqual(sorted(wins));
        } else if (threats.length > 0) {
          expect(sorted(block.answers)).toEqual(sorted(threats));
        } else if (empties(state) <= SOLVE_LIMIT) {
          expect(sorted(block.answers)).toEqual(sorted(bestMoves(state)));
        } else if (claim?.forcedWithin) {
          expect(sorted(block.answers)).toEqual(sorted(forcingMoves(state, claim.forcedWithin)));
        } else if (claim?.doubleThreat) {
          expect(sorted(block.answers)).toEqual(sorted(doubleThreatMoves(state)));
        } else if (claim?.holdsWithin) {
          expect(sorted(block.answers)).toEqual(sorted(holdingMoves(state, claim.holdsWithin)));
        } else {
          // A rule-of-thumb answer (take the centre, avoid the poison square).
          // The blunder check above is the guarantee; here we only insist the
          // answer set does not include a move that loses within five plies.
          for (const answer of block.answers) {
            const next = applyMove(state, answer);
            expect(forcingMoves(next, 5), `${answer} loses by force`).toEqual([]);
          }
        }
      });
    }
  }
});

// --- Puzzles -----------------------------------------------------------------

/** Search horizons for the puzzles whose claim is "forces a win within N". */
const PUZZLE_HORIZON: Record<string, { forcedWithin?: number; holdsWithin?: number }> = {
  'spring-the-seven': { forcedWithin: 3 },
  'break-the-seven': { holdsWithin: 7 },
  'force-the-block': { forcedWithin: 3 },
  'two-forcing-moves': { forcedWithin: 5 },
};

function expectedAnswers(puzzle: Puzzle): number[] {
  const state = replay(puzzle.moves);
  const horizon = PUZZLE_HORIZON[puzzle.slug];

  switch (puzzle.theme) {
    case 'winInOne':
      return immediateWins(state);
    case 'block':
      expect(immediateWins(state)).toEqual([]);
      return immediateThreats(state);
    case 'doubleThreat':
      return doubleThreatMoves(state);
    case 'safeSquare':
      expect(immediateWins(state)).toEqual([]);
      expect(immediateThreats(state)).toEqual([]);
      return holdingMoves(state, 7);
    case 'sevenTrap':
    case 'forcingSequence':
      if (horizon?.holdsWithin) return holdingMoves(state, horizon.holdsWithin);
      expect(horizon?.forcedWithin, `${puzzle.slug} needs a horizon`).toBeDefined();
      return forcingMoves(state, horizon!.forcedWithin!);
    case 'parity':
    case 'zugzwang':
      expect(empties(state), `${puzzle.slug} is small enough to solve`).toBeLessThanOrEqual(SOLVE_LIMIT);
      return bestMoves(state);
    case 'opening':
      // Not proved here: the value of the opening rests on the published
      // solution (Allis 1988, Tromp), which this suite cannot re-derive. The
      // claim is pinned instead: an opening puzzle asks for the centre, from
      // an empty board or after a single opponent move.
      expect(puzzle.moves.length).toBeLessThanOrEqual(1);
      return [3];
  }
}

describe('puzzles', () => {
  for (const puzzle of PUZZLES) {
    it(`${puzzle.slug}: the solver is on move and the position is live`, () => {
      const state = replay(puzzle.moves);
      expect(state.status).toBe('in_progress');
      expect(state.turn).toBe(puzzle.solver);
    });

    it(`${puzzle.slug}: the answers are exactly the correct moves`, () => {
      expect(sorted(puzzle.answers)).toEqual(sorted(expectedAnswers(puzzle)));
    });
  }

  it('solves the odd/even endgames to the values the lessons claim', () => {
    // These are the claims the Intermediate and Advanced tiers rest on.
    const claims: [string, number[], 'win' | 'draw' | 'loss'][] = [
      ['first player odd threat wins', PUZZLES.find((p) => p.slug === 'the-odd-threat')!.moves, 'win'],
      ['first player odd beats second player even', PUZZLES.find((p) => p.slug === 'odd-beats-even')!.moves, 'win'],
      ['lower threat in a shared column wins', PUZZLES.find((p) => p.slug === 'lower-threat-wins')!.moves, 'win'],
      ['two odd threats draw', PUZZLES.find((p) => p.slug === 'the-only-draw')!.moves, 'draw'],
    ];
    for (const [name, moves, verdict] of claims) {
      const v = value(replay(moves));
      const sign = v > 0 ? 1 : v < 0 ? -1 : 0;
      expect(sign, name).toBe(verdict === 'win' ? 1 : verdict === 'draw' ? 0 : -1);
    }
  });
});

// --- Progression -------------------------------------------------------------

describe('progression', () => {
  it('opens only the first lesson and its first puzzle to a new player', () => {
    const progress = curriculumProgress([]);
    expect(progress.solved).toBe(0);
    expect(progress.total).toBe(PUZZLES.length);
    expect(progress.lessons.map((l) => l.unlocked)).toEqual(
      LESSONS.map((_, i) => i === 0),
    );
    const first = progress.lessons[0]!;
    expect(first.puzzles.map((p) => p.unlocked)).toEqual(first.puzzles.map((_, i) => i === 0));
    expect(progress.nextLesson).toBe(LESSONS[0]!.slug);
    expect(progress.nextPuzzle).toBe(first.puzzles[0]!.slug);
  });

  it('unlocks puzzles in order within a lesson, and the next lesson when all are solved', () => {
    const first = puzzlesForLesson(LESSONS[0]!.slug);
    const second = LESSONS[1]!;
    const solved: string[] = [];
    for (const [i, puzzle] of first.entries()) {
      expect(isPuzzleUnlocked(puzzle.slug, solved), `${puzzle.slug} open`).toBe(true);
      const later = first[i + 1];
      if (later) expect(isPuzzleUnlocked(later.slug, solved), `${later.slug} still locked`).toBe(false);
      expect(isLessonUnlocked(second.slug, solved)).toBe(false);
      solved.push(puzzle.slug);
    }
    expect(isLessonUnlocked(second.slug, solved)).toBe(true);
    const progress = curriculumProgress(solved);
    expect(progress.lessons[0]!.complete).toBe(true);
    expect(progress.nextLesson).toBe(second.slug);
    expect(progress.nextPuzzle).toBe(puzzlesForLesson(second.slug)[0]!.slug);
  });

  it('walks the whole curriculum in order and finishes with nothing left to do', () => {
    const solved: string[] = [];
    let steps = 0;
    for (;;) {
      const progress = curriculumProgress(solved);
      if (progress.nextPuzzle === null) {
        expect(progress.nextLesson).toBeNull();
        break;
      }
      expect(isPuzzleUnlocked(progress.nextPuzzle, solved)).toBe(true);
      solved.push(progress.nextPuzzle);
      steps++;
      expect(steps).toBeLessThanOrEqual(PUZZLES.length);
    }
    expect(solved.length).toBe(PUZZLES.length);
    expect(curriculumProgress(solved).lessons.every((l) => l.complete)).toBe(true);
  });

  it('does not open a later lesson because of a puzzle solved out of order', () => {
    const last = PUZZLES[PUZZLES.length - 1]!;
    const progress = curriculumProgress([last.slug]);
    expect(progress.lessons[1]!.unlocked).toBe(false);
    expect(isPuzzleUnlocked(last.slug, [last.slug])).toBe(false);
  });
});
