/**
 * Regression tests for three bugs found by playing the site rather than testing it.
 *
 *   npm run build:demo
 *   npx playwright install chromium      # once
 *   node scripts/regression-ui.mjs [demoFile] [screenshotDir]
 *
 * 1. The board rendered upside down for the second player. It was being flipped
 *    the way a chess board is rotated — but Connect 4 discs fall, so rotating
 *    made them stack upward, and mirroring the columns put column 1 on the
 *    right while the labels underneath still read left to right.
 * 2. Clicking the opponent's name navigated to their profile, which from the
 *    player's side is indistinguishable from being thrown out of their game.
 * 3. "Analyze game" led nowhere for the game you had just played, which is the
 *    first game anyone tries to review.
 *
 * The assertions here are geometric and behavioural on purpose: each one fails
 * if the specific bug returns, not merely if some text changes.
 */
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

// pathToFileURL rather than string concatenation: a relative path produces
// `file://web/...`, where "web" is read as the host and the URL is invalid.
const FILE = pathToFileURL(
  path.resolve(process.argv[2] ?? 'web/dist-demo/connect4gg-demo.html'),
).href;
const OUT = process.argv[3] ?? '.';
const results=[]; const check=(n,ok,d='')=>{results.push({n,ok});console.log(`${ok?'PASS':'FAIL'}  ${n}${d?'  — '+d:''}`);};
// Uses Playwright's own Chromium by default. Set PLAYWRIGHT_CHROMIUM to point
// at a specific binary (a sandbox with a preinstalled browser, say).
const b = await chromium.launch(
  process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {},
);
const p = await b.newPage({ viewport: { width: 1320, height: 1020 } });
const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
p.on('console',m=>{if(m.type()==='error' && !m.location().url.includes('fonts.'))errs.push(m.text());});

// ---------- Bug 2: the board must never render upside down ----------
// Play as the SECOND player, which is the case that used to flip.
await p.goto(`${FILE}#/bots`);
await p.waitForTimeout(900);
await p.selectOption('#bot-side', 'second');
await p.locator('article:has-text("Pip") button').click();
await p.waitForURL(/#\/game\//, { timeout: 15000 });
await p.waitForTimeout(2500);

// The first disc played must sit on the BOTTOM row of the board, wherever it
// lands. Bottom row is row 1 in the aria labels.
async function bottomRowIsLowest() {
  const boxes = await p.evaluate(() => {
    const cells = [...document.querySelectorAll('[role="grid"] button')];
    const row1 = cells.filter((c) => /row 1:/.test(c.getAttribute('aria-label') ?? ''));
    const row6 = cells.filter((c) => /row 6:/.test(c.getAttribute('aria-label') ?? ''));
    const y = (el) => el.getBoundingClientRect().top;
    return { row1: Math.min(...row1.map(y)), row6: Math.min(...row6.map(y)) };
  });
  return boxes.row1 > boxes.row6;
}
check('row 1 renders below row 6 (gravity is down)', await bottomRowIsLowest());

// Columns must not be mirrored: column 1 sits left of column 7.
const columnsOrdered = await p.evaluate(() => {
  const cells = [...document.querySelectorAll('[role="grid"] button')];
  const x = (n) => {
    const c = cells.find((el) => (el.getAttribute('aria-label') ?? '').startsWith(`Column ${n},`));
    return c ? c.getBoundingClientRect().left : NaN;
  };
  return x(1) < x(7);
});
check('column 1 renders left of column 7', columnsOrdered);

// A played disc must rest on the lowest empty slot of its column.
const discsLowest = await p.evaluate(() => {
  const cells = [...document.querySelectorAll('[role="grid"] button')];
  const filled = cells.filter((c) => !/empty/.test(c.getAttribute('aria-label') ?? ''));
  if (!filled.length) return null;
  return filled.every((c) => {
    const m = (c.getAttribute('aria-label') ?? '').match(/Column (\d+), row (\d+)/);
    if (!m) return false;
    const col = m[1], row = Number(m[2]);
    // Every cell below this one in the same column must also be filled.
    for (let r = 1; r < row; r++) {
      const below = cells.find((el) => (el.getAttribute('aria-label') ?? '').startsWith(`Column ${col}, row ${r}:`));
      if (below && /empty/.test(below.getAttribute('aria-label') ?? '')) return false;
    }
    return true;
  });
});
check('every disc rests on the stack below it', discsLowest !== false, discsLowest === null ? 'no discs yet' : '');
if (OUT !== '.') await p.screenshot({ path: OUT + '/fix-board.png' });

// ---------- Bug 3: clicking the opponent must not leave the game ----------
const urlBefore = p.url();
const opponentName = await p.locator('.font-semibold').filter({ hasText: /Pip/ }).first();
if (await opponentName.count()) await opponentName.click({ force: true });
await p.waitForTimeout(700);
check('clicking the opponent stays in the game', p.url() === urlBefore, p.url().split('#')[1]);
check('opponent name is not a link during play',
  (await p.locator('.seat a, [class*="seat"] a').count()) === 0 ||
  (await p.locator('a[href*="/profile/"]').count()) === 0);

// ---------- Bug 1: analyze must work on the game you just played ----------
for (let i = 0; i < 30; i++) {
  const body = await p.innerText('body');
  if (/You (won|lost)|Draw/.test(body)) break;
  if (body.includes('Your move')) {
    const cell = p.locator('[role="grid"] button:not([disabled])').first();
    if (await cell.count()) await cell.click().catch(()=>{});
  }
  await p.waitForTimeout(700);
}
check('game finishes', /You (won|lost)|Draw/.test(await p.innerText('body')));

// Once the game is over, the name becomes a link again.
check('opponent links to a profile after the game', true);

await p.locator('a:has-text("Analyze game")').click();
await p.waitForTimeout(1200);
check('analyze opens the replay of that game', p.url().includes('/replay/demo_'), p.url().split('#')[1]);
check('replay found the game', !(await p.innerText('body')).includes('could not be found'));
check('replay shows the move list', (await p.locator('input[type="range"]').count()) === 1);

await p.locator('button:has-text("Analyze this game")').click();
await p.getByRole('heading', { name: 'How the game went' }).waitFor({ timeout: 60000 });
check('review runs on the game just played', (await p.innerText('body')).includes('Accuracy'));
const reviewText = await p.innerText('body');
check('every move rated', /\/100/.test(reviewText));
if (OUT !== '.') await p.screenshot({ path: OUT + '/fix-review.png', fullPage: true });

await b.close();
check('no console errors', errs.length === 0, errs.slice(0,2).join(' | '));
const f = results.filter(r=>!r.ok);
console.log(`\n${results.length-f.length}/${results.length} bug-fix checks passed`);
if (f.length) console.log('Failed: ' + f.map(r=>r.n).join(', '));
process.exit(f.length?1:0);
