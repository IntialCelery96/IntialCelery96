# Curriculum Roadmap

The `/learn` section currently ships as a **scaffold**: the data model, the API,
the renderer and one seed lesson plus one seed puzzle, all wired end to end. The
point of shipping it this thin is that everything below is now a content job
rather than an engineering one — write the blocks, seed them, and the existing
renderer displays them.

## How content is added

A lesson is a row in the `Lesson` table whose `blocks` column is an array of
[`LessonBlock`](../packages/engine/src/curriculum.ts) values:

| Block | Purpose |
| --- | --- |
| `prose` | A paragraph of explanation. |
| `keyIdea` | A callout — the one sentence worth remembering. |
| `board` | A diagram. `moves` is replayed from an empty board, so the position is always legal; `highlight` rings the squares under discussion. |
| `tryIt` | An inline exercise. The reader plays a move and is told whether it was right. |

A puzzle is a row in the `Puzzle` table: a starting position (as a move list),
which colour the solver plays, the accepted answers, and an explanation. Answers
are graded server-side and never sent to the browser.

Both render through `LessonBoard`, which wraps the same `Board` component the
live game uses — so a diagram is guaranteed to look and behave like the real
thing, and there is one place to fix a rendering bug.

See `server/prisma/seed.ts` for the working example of each.

## Planned topics

Ordered roughly as they should be taught.

### Beginner

- **Center Column Control** — *shipped as the seed lesson.* Why the middle
  column sits on the most winning lines, and why the first player's win depends
  on taking it.
- **Reading the board** — spotting your own three-in-a-rows and your opponent's
  before they complete. The single biggest source of beginner losses.
- **Vertical threats** — the easiest win to build and the easiest to miss,
  because it grows in one column instead of across the board.
- **Don't play under a threat** — why filling the square beneath an opponent's
  winning square hands them the game.
- **The double threat** — creating two winning squares at once so the opponent
  can only block one. The first real winning technique.

### Intermediate

- **Odd/even threat theory** — the heart of Connect 4 strategy. The first player
  wants threats on odd rows, the second player on even rows, because of who is
  forced to fill in underneath. Explains why so many games are decided long
  before the final move.
- **Counting the parity** — working out, from a given position, which side
  benefits from the board filling up.
- **The 7 trap** — the classic beginner-killer: a shape that looks safe and
  forces a loss several moves later.
- **Other trap patterns** — the claimeven, the baseinverse, and the standard
  shapes that recur in real games.
- **Forcing sequences** — chaining threats so the opponent's replies are all
  compelled, and you reach a won position by force rather than by hoping.

### Advanced

- **Zugzwang-style squeezes** — positions where every legal move loses, and how
  to engineer them.
- **Endgame counting** — calculating exactly how the remaining squares fill and
  who runs out of safe moves first.
- **Opening repertoire** — the strongest replies to each of the seven opening
  moves, and where each transposes.
- **Refuting an early edge move** — punishing the most common opening mistake.

## Planned features

Beyond the content itself, the section is meant to grow these:

- **Progress tracking** — a `LessonProgress` table keyed on (user, lesson), so
  the index can show what has been completed.
- **Puzzle streaks and a puzzle rating** — the same ELO machinery already used
  for games, applied to puzzle solving.
- **A daily puzzle** — one shared position per day, with a leaderboard.
- **"Analyze this game"** — the post-game *Analyze* link currently opens the
  replay. It should eventually annotate each move: where the losing blunder was,
  what the winning move would have been. The engine already has the search
  needed for this (`packages/engine/src/bots/search.ts`); what is missing is a
  pass that evaluates every position in a finished game and surfaces the swings.
- **Lesson-to-puzzle links** — finishing a lesson should offer the puzzles that
  drill it.
