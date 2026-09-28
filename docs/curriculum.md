# The Connect4.gg curriculum

A path from "never played" to beating the strongest bot, built the way a chess
site builds one: four skill tiers, each split into short courses, each course a
few lessons that end in an exercise, with a rated puzzle library alongside and
the bot ladder as the place to apply it. Every diagram is a legal position and
every answer is proved against the engine before it ships.

This document is the design. The content is in
[`packages/engine/src/content/`](../packages/engine/src/content/); the proof is
[`packages/engine/tests/content.test.ts`](../packages/engine/tests/content.test.ts).

## Contents

1. [Shape](#shape)
2. [The path](#the-path)
3. [The puzzle library](#the-puzzle-library)
4. [The training loop](#the-training-loop)
5. [Methods, and the evidence for them](#methods-and-the-evidence-for-them)
6. [Sources for the game itself](#sources-for-the-game-itself)
7. [How the content is verified](#how-the-content-is-verified)
8. [What comes next](#what-comes-next)
9. [References](#references)

## Shape

The structure mirrors a chess site's lessons section because that structure is
what makes a learning path feel like a path rather than a pile of articles:

| Layer | Here | Chess.com equivalent |
| --- | --- | --- |
| Tier | New to the game, Beginner, Intermediate, Advanced | New to Chess, Beginner, Intermediate, Advanced [[C1]](#c1) |
| Course | 3–4 lessons on one theme (e.g. *Threat Theory*) | A course within a level [[C1]](#c1) |
| Lesson | Prose, diagrams, a key idea, one or more "try it" exercises, sources | A lesson with interactive challenges [[C1]](#c1) |
| Puzzle | A position with a themed, rated, server-graded answer | Rated puzzles by motif [[C2]](#c2) [[L1]](#l1) |
| Play | The bot ladder, one bot per tier | Bots by rating |
| Review | Move-by-move game analysis with tactical verdicts | Game Review [[C3]](#c3) |

Two deliberate differences from the chess model. First, every lesson ends with
its sources. Connect 4 is a solved game and the strategic theory comes from a
small number of identifiable papers, so a lesson can say where a claim comes
from and a reader can check it. Second, every lesson's factual claims are tested
in CI, because the content is data and the engine is right there.

### Tiers, rating bands and target bots

Each tier is written for a rating band on the site's own scale (a new account
starts at 1200) and names the bot a player should be able to beat by the end
of it. The bands are wide on purpose: they say what to study, not what you are.

| Tier | Rating band | Bot to beat | What the tier gets you past |
| --- | --- | --- | --- |
| New to the game | under 800 | Rusty (Easy, ~850) | Not knowing the rules; missing your own four; missing theirs |
| Beginner | 800–1200 | Nora (Moderate, ~1100) | Losing to shapes you did not see: diagonals, doubles, the 7 |
| Intermediate | 1200–1700 | Bastion (Hard, ~1650) | Not knowing who wins the endgame until it is over |
| Advanced | 1700+ | Zenith (Expert, ~2000) | Everything a perfect solver knows that a strong human can use |

The bots are the same ones in `packages/engine/src/bots/index.ts`; the mapping
lives in `DIFFICULTY_TARGETS` in `curriculum.ts` so the Learn page and the
content can never disagree about it.

## The path

Twenty lessons in seven courses. Each one has a learning objective a reader
should be able to demonstrate on a board afterwards.

### New to the game — *First Steps*

| # | Lesson | Objective | Main source |
| --- | --- | --- | --- |
| 1 | How a game is won | Drop, gravity, four directions, the draw; complete a four | [[G4]](#g4) [[G6]](#g6) |
| 2 | Threats, and how to stop them | Define a threat; block one; recognise a floating threat | [[G1]](#g1) |
| 3 | Win first, block second | Run the two-question check in order, every move | [[M9]](#m9) |

### Beginner — *Board Sense*

| # | Lesson | Objective | Main source |
| --- | --- | --- | --- |
| 4 | Centre column control | Know the line counts (3 to 13 per square; 24 to 60 per column) and the solved verdict per opening | [[G1]](#g1) [[G4]](#g4) [[G6]](#g6) |
| 5 | Reading the whole board | Trace the four lines through the opponent's last disc; find a diagonal threat | [[M4]](#m4) |
| 6 | Stacks | Cap a vertical three; use a stack as a forcing move | [[G1]](#g1) |
| 7 | Never give them the square | Identify poison squares; play a safe move when the centre is poison | [[G1]](#g1) |

### Beginner — *First Tactics*

| # | Lesson | Objective | Main source |
| --- | --- | --- | --- |
| 8 | Two threats, one block | Make an open-ended three; make two threats with crossing lines | [[G2]](#g2) |
| 9 | The 7 trap | Spring it; break it a move early; see it as stacked threats | [[G2]](#g2) [[G1]](#g1) |
| 10 | Your first moves | Centre first; punish an edge opening; the standard second-player reply | [[G6]](#g6) [[G4]](#g4) [[G5]](#g5) |

### Intermediate — *Threat Theory*

| # | Lesson | Objective | Main source |
| --- | --- | --- | --- |
| 11 | Odd and even threats | State the parity rule and explain it by counting; win an odd-threat endgame | [[G1]](#g1) [[G7]](#g7) [[G8]](#g8) |
| 12 | Follow-up | Play Claimeven as the second player; keep an even-threat win | [[G1]](#g1) [[G7]](#g7) |
| 13 | Counting who runs out of moves | Classify empty squares (poison, wasted, neutral); count neutral squares; win a three-column endgame | [[G1]](#g1) [[G8]](#g8) |

### Intermediate — *Calculation*

| # | Lesson | Objective | Main source |
| --- | --- | --- | --- |
| 14 | Forcing moves | Find the threat whose block fills the square beneath your winning square; win in two and in three | [[G1]](#g1) |
| 15 | A thinking routine | Run a five-step routine: win, block, candidates, the square above, blunder check | [[M8]](#m8) [[M9]](#m9) |

### Advanced — *Controlling the Zugzwang*

| # | Lesson | Objective | Main source |
| --- | --- | --- | --- |
| 16 | Who controls the zugzwang | Resolve odd-vs-even in different columns, threats in the same column, and two odd threats | [[G1]](#g1) [[G7]](#g7) [[G8]](#g8) |
| 17 | The nine rules | Use Claimeven, Baseinverse, Vertical and Aftereven; know the other five exist and what they are for | [[G1]](#g1) [[G2]](#g2) [[G4]](#g4) [[G9]](#g9) |

### Advanced — *Openings and Endgames*

| # | Lesson | Objective | Main source |
| --- | --- | --- | --- |
| 18 | What the solvers say | Know the exact value of each first move; use a solver to find the move where a game's value changed | [[G6]](#g6) [[G4]](#g4) [[G5]](#g5) [[G9]](#g9) |
| 19 | Playing second | A plan: aim for even threats, kill odd lines, follow up by default | [[G1]](#g1) [[G7]](#g7) |
| 20 | Endgame counting | Play a multi-column endgame to the end without a slip | [[G1]](#g1) [[G2]](#g2) |

## The puzzle library

Twenty puzzles, each tagged with a theme and a rating, graded on the server so
the answer never reaches the browser. The theme tags exist so that a player can
drill one pattern at a time, and so that game review can later say "you missed
a vertical win — here are the puzzles for that", which is how a chess site
links its analysis to its training [[L1]](#l1) [[C3]](#c3).

| Theme | What it drills | Puzzles | Ratings |
| --- | --- | --- | --- |
| Win in one | See your own four | 4 | 400–800 |
| Block the four | See theirs, including diagonals | 3 | 450–700 |
| Double threat | Open threes and crossing lines | 2 | 850–1000 |
| The 7 trap | Spring it and break it | 2 | 1050–1100 |
| Safe square | Avoid the poison square, and the slower loss | 1 | 900 |
| Forcing sequence | Wins in two and three | 2 | 1250–1400 |
| Odd and even | Single-threat endgames | 2 | 1300–1350 |
| Zugzwang | Mixed threats, shared columns, the only draw | 4 | 1550–1850 |

Ratings are on the player scale and set by hand for now, each inside its
tier's band (the test suite enforces that). They are the seed values for a
puzzle rating that floats with solve rates; see [What comes next](#what-comes-next).

## The training loop

A chess site's lessons work because they sit inside a loop: learn something,
drill it, play, get told what you missed, go back. The same loop here, for one
tier at a time:

1. **Learn.** Take the tier's lessons in order. Do each exercise before reading
   on; the exercise is the point of the lesson, not a quiz after it.
2. **Drill.** Solve the tier's puzzles until they are fast. Come back to the
   same set after a few days and again after a couple of weeks.
3. **Play.** Play the tier's bot. Alternate colours. Keep going until you win
   more than you lose.
4. **Review.** Open the game review of every game. Each notable verdict maps
   onto a lesson: a *missed win* is lesson 1 or 3, a *blunder* that handed
   over a square is lesson 7, a lost endgame is the Intermediate tier.
5. **Move up** when the bot is beaten and the review is mostly clean.

A concrete week at the Beginner tier: two lessons on Monday and Tuesday with
their exercises; the Board Sense puzzles on Wednesday; five games against Nora
on Thursday, reviewed; the same puzzles again on Saturday, faster; the next two
lessons on Sunday. Twenty to thirty minutes a day is enough. The ordering
inside the week is deliberate and the reasons are in the next section.

## Methods, and the evidence for them

Each design choice below is traceable to a published source. Where the
evidence is contested, that is said.

**Tiers, courses, lessons with interactive challenges.** The four-level
structure and the lesson-with-challenges format are Chess.com's, described in
its own help documentation [[C1]](#c1). It is used here because it is the
format the target audience already knows how to use.

**Every lesson ends in a test.** Retrieval practice — being made to produce an
answer — produces better long-term retention than re-reading the same material.
Roediger and Karpicke's experiments found repeated testing beat repeated
studying by a wide margin a week later, even though studying looked better
after five minutes [[M1]](#m1). That is why every lesson has a "try it" the
reader must answer, and why the explanation appears only after an answer.

**Puzzles are rated, and the rating is on the player scale.** Chess.com rates
puzzles with the same Glicko-style logic it uses for games [[C2]](#c2);
Lichess goes further and gives each puzzle its own rating, deviation and
volatility, so a puzzle is literally an opponent in the rating maths
[[L1]](#l1). The seed ratings here are hand-set so that the first version can
ship without solve data; the roadmap is to let them float.

**Puzzles are themed.** Lichess tags every puzzle with the motifs it contains,
so a player can train one pattern at a time [[L2]](#l2). The theme list here
is the Connect 4 equivalent: win in one, block, double threat, the 7, forcing
sequence, safe square, parity, zugzwang.

**Drill the same patterns repeatedly.** Chase and Simon's classic result is
that chess experts perceive the board as a few familiar chunks where novices
see many pieces, and that this, not raw memory, is what lets a master
reconstruct a position after a five-second glance [[M4]](#m4). Later work
confirmed the chunking account while refining it [[M5]](#m5). Pattern drills
are how those chunks are built, and the Woodpecker Method — solve a large set
of tactical puzzles, then solve the same set again several times, faster each
cycle — is the chess-training method built directly on that idea
[[M7]](#m7). The training loop's "come back to the same puzzles" is Woodpecker
in miniature.

**Space the repetitions.** Cepeda and colleagues' meta-analysis of 839
assessments found that spreading study sessions out beats massing them, and
that the best gap grows with how long you need to remember the material
[[M2]](#m2). Chess.com's own drills schedule repetitions on a spaced-repetition
basis [[C4]](#c4). The loop's "a few days, then a couple of weeks" is the
practical version; a scheduler that does it automatically is on the roadmap.

**Interleave, and expect it to feel harder.** Rohrer's review of interleaved
practice found that mixing problem types improves the ability to choose the
right method for a problem, at the cost of feeling less fluent during practice
[[M3]](#m3). Bjork's term for effects like this is *desirable difficulties*
[[M6]](#m6). The puzzle page therefore offers "next puzzle" up the rating
ladder across themes, not within one theme, and the Learn page says so.

**Practice with feedback on the thing you are bad at.** Ericsson's account of
expert performance stresses individualised practice on specific weaknesses with
immediate feedback, not just time spent [[M10]](#m10). The effect size has
been contested — a 2019 replication found deliberate-practice hours explain
less of the variance than originally reported, though still a meaningful share
[[M11]](#m11) — but the direction of the finding is not in doubt, and the
training loop's *review* step exists to turn each game into a diagnosis. The
roadmap item "lessons from your own games" is the automated version.

**Master a tier before moving on.** Bloom's mastery learning proposes fixing
the standard and letting the time vary, rather than the reverse [[M12]](#m12).
"Beat the tier's bot more often than not" is that standard, made concrete.

**A thinking routine, not just knowledge.** Kotov's advice to list candidate
moves before calculating any of them [[M8]](#m8), and Heisman's insistence on
a safety check before every move [[M9]](#m9), are the two most-cited pieces of
chess thinking-process coaching. Lesson 15 adapts them, and lesson 3 is the
safety check on its own because it is the one habit that pays at every level.

## Sources for the game itself

The strategic content rests on a small, well-defined literature.

**The solution.** Connect 4 was solved twice in October 1988: by James D.
Allen on the 1st, with a search-based program, and independently by Victor
Allis on the 16th, with a knowledge-based one [[G1]](#g1) [[G2]](#g2)
[[G9]](#g9). Allis's master's thesis is the source of everything in the
Intermediate and Advanced tiers: the definition of a threat, odd and even
threats, follow-up and the control of the zugzwang, and the nine strategic
rules (Claimeven, Baseinverse, Vertical, Aftereven, Lowinverse, Highinverse,
Baseclaim, Before, Specialbefore) that his program VICTOR used to refute every
first-player line except the centre [[G1]](#g1).

**The exact values.** John Tromp's exhaustive work established the value of
every opening: a first-player win by move 41 from the centre column, draws
from columns 3 and 5, losses from columns 2 and 6 on move 42 and from columns 1
and 7 on move 40 [[G4]](#g4) [[G6]](#g6). His page also carries the count of
4,531,985,219,092 legal positions, computed by Edelkamp and Kissmann in 2008
[[G4]](#g4) [[G3]](#g3). Pascal Pons's 2015 solver and tutorial make those
values checkable by anyone: the online solver returns the exact value of any
position [[G5]](#g5). In 2025 Markus Böck computed a complete win/draw/loss
table for every reachable position on a single desktop [[G9]](#g9).

**Practical strategy.** Allen's *The Complete Book of Connect 4* is the only
book-length treatment of human strategy and named trap shapes, including the
7 [[G2]](#g2). Keith Pomakis's "Expert Play in Connect-Four" and the MIT
SP.268 course notes are the two accessible restatements of Allis's threat
theory for players rather than programmers [[G7]](#g7) [[G8]](#g8).

## How the content is verified

Content is data, so it is tested like code. `tests/content.test.ts` runs on
every push and checks, for every lesson and puzzle:

- Every diagram and exercise position replays legally from an empty board and
  is unfinished.
- Every highlighted square holds a disc.
- Every "try it" answer is a legal move that does not hand the opponent an
  immediate win.
- Every "try it" answer set is *exactly* right by the strongest applicable
  proof: equal to the set of winning moves if a win exists; equal to the set
  of blocks if a threat exists; equal to the exact best moves if the position
  has 14 or fewer empty squares (a full solve); equal to the moves that force a
  win within a stated horizon, or that create two immediate threats, for the
  tactical exercises; and, for rule-of-thumb answers such as "take the
  centre", not losing by force within five plies.
- Every puzzle's answer set is exactly the correct set by the same rules, keyed
  on its theme.
- The endgames the parity lessons rest on solve to the values the lessons
  claim: the first-player odd threat wins, odd beats even in different
  columns, the lower threat in a shared column wins, two odd threats draw.

The endgame positions were generated for the purpose: a search over random
fillings of the closed columns for a board with exactly the threats the lesson
needs and no others, then a search for a legal move order that reaches it, then
an exhaustive solve. That is why they look like real games rather than
textbook diagrams, and why their verdicts are proofs rather than claims.

What is *not* verified locally: statements about the full game (the value of
each first move, the 41-move win) are cited to the published sources above
rather than re-derived, because a full solve is outside the scope of a test
suite. The online solver [[G5]](#g5) lets a reader check any of them.

The direct fetch of primary sources from this environment was blocked by its
network policy, so the citations were compiled from search results and prior
knowledge of the works, and the URLs are the canonical ones for each. A
[fetch script](../scripts/fetch-c4-sources.sh) exists for pulling the primary
texts into the repository from an unrestricted machine.

## What comes next

In rough priority order. The first three are what would make the puzzle side
feel like a chess site's.

- **A floating puzzle rating.** Give puzzles a rating, deviation and volatility
  and update both sides on every attempt, as Lichess does [[L1]](#l1). The
  ELO machinery in `elo.ts` is a start; Glicko-2 is the better fit because
  puzzles are attempted far more often than games are played.
- **Progress that follows the account.** A `LessonProgress` table keyed on
  (user, lesson), replacing the per-browser record on the Learn page, and a
  puzzle history so the review step can point at specific weaknesses.
- **A spaced-repetition scheduler.** Failed and slow puzzles come back sooner;
  fast ones later, on the Cepeda gaps [[M2]](#m2) [[C4]](#c4).
- **Lessons from your own games.** Game analysis already tags every move
  (`analysis.ts`). Map its verdicts onto puzzle themes and lesson slugs —
  `missed_win` to *Win in one*, an avoidable `blunder` to *Safe square*, a
  lost endgame to *Odd and even* — and show "you missed three vertical wins
  this week; here is the drill" on the profile.
- **More puzzles per theme.** Twenty is a proof of the pipeline. The generator
  used for the endgames can produce many more, and every one will be proved
  before it is seeded.
- **A daily puzzle and a timed mode.** One shared position per day with a
  leaderboard, and a three-minute, three-strikes rush in the style of
  Puzzle Rush [[C5]](#c5).
- **Worked openings.** The Advanced opening lesson says how to use a solver;
  a follow-up could show the main lines of the centre opening with the value
  of each deviation.

## References

### Chess-site practice

<a id="c1"></a>**[C1]** Chess.com Help Center, "How do Lessons work on Chess.com?" — lessons are organised into four levels (New to Chess, Beginner, Intermediate, Advanced), each with courses of lessons and interactive challenges. <https://support.chess.com/en/articles/8609703-how-do-lessons-work-on-chess-com>

<a id="c2"></a>**[C2]** Chess.com, "New Puzzles Ratings, Difficulty Settings, And More Consistent Experience" — the puzzle rating uses the same Glicko-style logic as game ratings. <https://www.chess.com/news/view/announcing-new-puzzles-rating-system>. See also "How do Puzzle ratings work?" <https://support.chess.com/en/articles/8602396-how-do-puzzle-ratings-work>

<a id="c3"></a>**[C3]** Chess.com Help Center, "How does Game Review work?" <https://support.chess.com/en/articles/8584089-how-does-game-review-work>

<a id="c4"></a>**[C4]** Chess.com Help Center, "How does the spaced repetition scheduling work?" <https://support.chess.com/en/articles/10319322-how-does-the-spaced-repetition-scheduling-work>

<a id="c5"></a>**[C5]** Chess.com, "Puzzle Rush" — three or five minutes, three strikes. <https://www.chess.com/puzzles/rush>

<a id="l1"></a>**[L1]** Lichess forum, "How Lichess puzzle rating works" — puzzles carry their own Glicko-2 rating, deviation and volatility and are rated as opponents. <https://lichess.org/forum/general-chess-discussion/how-lichess-puzzle-rating-works->. Glickman, M. E. (2012), "Example of the Glicko-2 system", <http://www.glicko.net/glicko/glicko2.pdf>

<a id="l2"></a>**[L2]** Lichess, "Puzzle Themes". <https://lichess.org/training/themes>

### Learning science and training method

<a id="m1"></a>**[M1]** Roediger, H. L., & Karpicke, J. D. (2006). Test-enhanced learning: Taking memory tests improves long-term retention. *Psychological Science*, 17(3), 249–255. <https://doi.org/10.1111/j.1467-9280.2006.01693.x>

<a id="m2"></a>**[M2]** Cepeda, N. J., Pashler, H., Vul, E., Wixted, J. T., & Rohrer, D. (2006). Distributed practice in verbal recall tasks: A review and quantitative synthesis. *Psychological Bulletin*, 132(3), 354–380. <https://doi.org/10.1037/0033-2909.132.3.354>

<a id="m3"></a>**[M3]** Rohrer, D. (2012). Interleaving helps students distinguish among similar concepts. *Educational Psychology Review*, 24(3), 355–367. <https://doi.org/10.1007/s10648-012-9201-3>

<a id="m4"></a>**[M4]** Chase, W. G., & Simon, H. A. (1973). Perception in chess. *Cognitive Psychology*, 4(1), 55–81. <https://doi.org/10.1016/0010-0285(73)90004-2>. Building on de Groot, A. D. (1965). *Thought and Choice in Chess*. Mouton.

<a id="m5"></a>**[M5]** Gobet, F., & Simon, H. A. (1998). Expert chess memory: Revisiting the chunking hypothesis. *Memory*, 6(3), 225–255. <https://doi.org/10.1080/741942359>

<a id="m6"></a>**[M6]** Bjork, R. A. (1994). Memory and metamemory considerations in the training of human beings. In J. Metcalfe & A. Shimamura (Eds.), *Metacognition: Knowing about knowing* (pp. 185–205). MIT Press.

<a id="m7"></a>**[M7]** Smith, A., & Tikkanen, H. (2018). *The Woodpecker Method*. Quality Chess. ISBN 978-1-78483-054-0.

<a id="m8"></a>**[M8]** Kotov, A. (1971). *Think Like a Grandmaster*. Batsford.

<a id="m9"></a>**[M9]** Heisman, D. (2010). *A Guide to Chess Improvement: The Best of Novice Nook*. Everyman Chess. ISBN 978-1-85744-649-4. See also Heisman, D. (2015). *Is Your Move Safe?* Mongoose Press.

<a id="m10"></a>**[M10]** Ericsson, K. A., Krampe, R. T., & Tesch-Römer, C. (1993). The role of deliberate practice in the acquisition of expert performance. *Psychological Review*, 100(3), 363–406. <https://doi.org/10.1037/0033-295X.100.3.363>

<a id="m11"></a>**[M11]** Macnamara, B. N., & Maitra, M. (2019). The role of deliberate practice in expert performance: revisiting Ericsson, Krampe & Tesch-Römer (1993). *Royal Society Open Science*, 6(8), 190327. <https://doi.org/10.1098/rsos.190327>

<a id="m12"></a>**[M12]** Bloom, B. S. (1968). Learning for mastery. *Evaluation Comment*, 1(2), 1–12. UCLA Center for the Study of Evaluation of Instructional Programs. <https://eric.ed.gov/?id=ED053419>

### Connect 4 game theory and strategy

<a id="g1"></a>**[G1]** Allis, L. V. (1988). *A Knowledge-based Approach of Connect-Four: The Game is Solved: White Wins*. Master's thesis, Vrije Universiteit Amsterdam. Mirrored at <https://tromp.github.io/c4/connect4_thesis.pdf>. Summarised in *ICGA Journal*, 11(4), 1988. <https://doi.org/10.3233/ICG-1988-11410>

<a id="g2"></a>**[G2]** Allen, J. D. (2010). *The Complete Book of Connect 4: History, Strategy, Puzzles*. Sterling / Puzzlewright Press. ISBN 978-1-4027-5621-4. Allen's solution was announced on 1 October 1988.

<a id="g3"></a>**[G3]** Edelkamp, S., & Kissmann, P. (2008). Symbolic classification of general two-player games. In *KI 2008: Advances in Artificial Intelligence*, LNCS 5243, 185–192. Springer. The count of 4,531,985,219,092 positions; also OEIS A212693.

<a id="g4"></a>**[G4]** Tromp, J. *John's Connect Four Playground*. <https://tromp.github.io/c4/c4.html>. See also Tromp, J. (2008). Solving Connect-4 on medium board sizes. *ICGA Journal*, 31(2), 110–112. <https://doi.org/10.3233/ICG-2008-31205>

<a id="g5"></a>**[G5]** Pons, P. (2015). *Solving Connect 4: how to build a perfect AI*. <http://blog.gamesolver.org/>. Online solver: <https://connect4.gamesolver.org/>. Source: <https://github.com/PascalPons/connect4>

<a id="g6"></a>**[G6]** Wikipedia, "Connect Four", section *Mathematical solution*. <https://en.wikipedia.org/wiki/Connect_Four#Mathematical_solution>

<a id="g7"></a>**[G7]** Pomakis, K. *Expert Play in Connect-Four*. <https://www.pomakis.com/c4/expert_play.html>

<a id="g8"></a>**[G8]** MIT SP.268, *The Mathematics of Toys and Games* (2010), Connect Four notes. <https://web.mit.edu/sp.268/www/connectfour.pdf>

<a id="g9"></a>**[G9]** Böck, M. (2025). Strongly Solving 7×6 Connect-Four on Consumer Grade Hardware. arXiv:2507.05267. <https://arxiv.org/abs/2507.05267>
