# Curriculum Roadmap

The `/learn` section now ships the full first version of the curriculum:
four tiers, seven courses, twenty lessons and twenty-nine rated puzzles, every
one of them proved against the engine in CI. Each lesson ends with its
puzzles; they unlock in order, and finishing them unlocks the next lesson.
Progress is kept on the account for signed-in players and in the browser for
everyone else. The design, the sequencing and the
sources are in [curriculum.md](curriculum.md); this file is only about what
is still to build.

## How content is added

Content is data in [`packages/engine/src/content/`](../packages/engine/src/content/):

| File | Holds |
| --- | --- |
| `courses.ts` | The course catalogue, one entry per course. |
| `lessons-*.ts` | One file per tier. A lesson is a list of blocks. |
| `puzzles.ts` | The puzzle set: position, solver, answers, lesson, theme, rating. |
| `progress.ts` | The unlock rules, derived from the set of solved puzzles. |
| `positions.ts` | Move lists shared between lessons and puzzles. |
| `sources.ts` | The references lessons cite. |

A lesson is a `Lesson` whose `blocks` are [`LessonBlock`](../packages/engine/src/curriculum.ts) values:

| Block | Purpose |
| --- | --- |
| `prose` | A paragraph. |
| `keyIdea` | The one sentence worth remembering. |
| `board` | A diagram. `moves` replays from an empty board; `highlight` rings discs. |
| `tryIt` | An exercise. The reader plays a move and is told whether it was right. |
| `reference` | The sources the lesson rests on. Every lesson ends with one. |

Adding content means: write it, run `npm test -w @connect4gg/engine` (which
proves every position and answer), then `npm run db:seed` to publish it. The
seed script upserts by slug and unpublishes anything no longer in the content.

The content tests know how to prove an answer from the puzzle's theme or from a
small table of horizons in the test file. A new tactical puzzle needs a line in
that table saying how many plies its forced win takes; everything else is
automatic.

## Planned features

Ordered by how much they would change the experience.

- **A floating puzzle rating.** Puzzles carry a seed rating today. Give them a
  Glicko-2 rating, deviation and volatility, and update puzzle and player on
  every attempt, the way Lichess does.
- **An attempt log.** Solves are on the account (`PuzzleSolve`); failed
  attempts and solve times are not recorded yet, and both a floating rating and
  a spaced-repetition scheduler need them.
- **A spaced-repetition scheduler** over that log: failed and slow puzzles
  return sooner, solved ones later.
- **Lessons from your own games.** Analysis already tags every move
  (`packages/engine/src/analysis.ts`). Map verdicts to puzzle themes and
  lesson slugs and surface "you missed three vertical wins this week — here is
  the drill" on the profile.
- **More puzzles per theme.** The endgame generator used for the parity
  positions can produce many more; each is proved before it ships.
- **A daily puzzle and a timed rush mode.**
- **Worked opening lines** for the centre opening, with the solver's value at
  each deviation.
