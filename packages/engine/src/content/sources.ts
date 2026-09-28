import type { SourceRef } from '../curriculum.js';

/**
 * The published sources the curriculum draws on. Each lesson ends with the
 * subset it used, so a reader can check a claim rather than take it on trust.
 *
 * Game theory: the game was solved independently in October 1988 by James D.
 * Allen and by Victor Allis; Allis's thesis is the reference for the odd/even
 * threat theory and the nine strategic rules every lesson past the beginner
 * tier rests on. Tromp's later exhaustive work and Pons's open solver are what
 * turn "widely reported" into "checkable".
 */

export const ALLIS_1988: SourceRef = {
  title: 'A Knowledge-based Approach of Connect-Four: The Game is Solved: White Wins',
  citation: 'Victor Allis, master’s thesis, Vrije Universiteit Amsterdam, October 1988',
  url: 'https://tromp.github.io/c4/connect4_thesis.pdf',
  note: 'The source of odd/even threat theory, the zugzwang rules, and the nine strategic rules (Claimeven, Baseinverse, Vertical, Aftereven, Lowinverse, Highinverse, Baseclaim, Before, Specialbefore).',
};

export const ALLEN_2010: SourceRef = {
  title: 'The Complete Book of Connect 4: History, Strategy, Puzzles',
  citation: 'James D. Allen, Sterling / Puzzlewright Press, 2010 (ISBN 978-1-4027-5621-4)',
  note: 'Allen solved the game on 1 October 1988, fifteen days before Allis; the book is the only full-length treatment of practical strategy and named trap shapes.',
};

export const TROMP_PLAYGROUND: SourceRef = {
  title: 'John’s Connect Four Playground',
  citation: 'John Tromp',
  url: 'https://tromp.github.io/c4/c4.html',
  note: 'Exhaustive results for every opening, the count of 4,531,985,219,092 legal positions (Edelkamp & Kissmann, 2008), and the Fhourstones solver benchmark.',
};

export const WIKIPEDIA_C4: SourceRef = {
  title: 'Connect Four — Mathematical solution',
  citation: 'Wikipedia',
  url: 'https://en.wikipedia.org/wiki/Connect_Four#Mathematical_solution',
  note: 'The per-column verdicts for the first move: a win by move 41 from the centre, draws from columns 3 and 5, losses from the outer four columns.',
};

export const PONS_SOLVER: SourceRef = {
  title: 'Solving Connect 4: how to build a perfect AI',
  citation: 'Pascal Pons, 2015',
  url: 'http://blog.gamesolver.org/',
  note: 'An open perfect solver. The online version at connect4.gamesolver.org gives the exact value of any position, so every verdict in these lessons can be checked.',
};

export const BOCK_2025: SourceRef = {
  title: 'Strongly Solving 7×6 Connect-Four on Consumer Grade Hardware',
  citation: 'Markus Böck, arXiv:2507.05267, 2025',
  url: 'https://arxiv.org/abs/2507.05267',
  note: 'A complete win/draw/loss table for every reachable position, and a short history of the 1988 solutions.',
};

export const POMAKIS: SourceRef = {
  title: 'Expert Play in Connect-Four',
  citation: 'Keith Pomakis',
  url: 'https://www.pomakis.com/c4/expert_play.html',
  note: 'A plain-language account of Allis’s threat theory for human players.',
};

export const MIT_SP268: SourceRef = {
  title: 'Connect Four (SP.268: The Mathematics of Toys and Games)',
  citation: 'MIT OpenCourseWare course notes, 2010',
  url: 'https://web.mit.edu/sp.268/www/connectfour.pdf',
  note: 'A concise statement of the odd/even threat rules and of who controls the zugzwang.',
};

export const KOTOV_1971: SourceRef = {
  title: 'Think Like a Grandmaster',
  citation: 'Alexander Kotov, 1971',
  note: 'Candidate moves: list the moves worth considering before calculating any of them.',
};

export const HEISMAN_2010: SourceRef = {
  title: 'A Guide to Chess Improvement: The Best of Novice Nook',
  citation: 'Dan Heisman, Everyman Chess, 2010',
  note: 'The safety check: before every move, ask what your opponent can do to you after it.',
};

export const CHASE_SIMON_1973: SourceRef = {
  title: 'Perception in chess',
  citation: 'William G. Chase and Herbert A. Simon, Cognitive Psychology 4(1), 55–81, 1973',
  url: 'https://doi.org/10.1016/0010-0285(73)90004-2',
  note: 'Experts see boards as familiar chunks, not as individual pieces. Pattern drills are how those chunks are built.',
};
