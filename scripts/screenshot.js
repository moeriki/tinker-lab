#!/usr/bin/env node
// Look at a page. Not a test -- a pair of eyes.
//
//   node scripts/screenshot.js                       -> / and /kit, on a phone
//   node scripts/screenshot.js /kit /no-such-code
//   node scripts/screenshot.js --reduced-motion /
//   node scripts/screenshot.js --full /kit           -> the whole page, not just the fold
//   node scripts/screenshot.js --scroll 600 /        -> the fold 600px down, where sticky is pinned
//   node scripts/screenshot.js --base https://bday.moeriki.com /   -> the real deploy
//   node scripts/screenshot.js --out shots /         -> somewhere you choose
//
// Agents kept writing "not seen by eye" about pages they had just built. The cause was never the
// site: no Claude Chrome extension had been paired to this account, so every session that asked
// for a browser got "extension is not connected" and gave up. That extension is also the wrong
// shape for this repo even when it works -- it drives one shared Chrome interactively, and this
// repo runs several background sessions in parallel worktrees, which would collide in it.
//
// The boot, the Chrome and the DevTools client live in scripts/lib/browser.js, which this shares
// with scripts/walk.js. Everything below is this script's own job: a list of routes, shot cold.
//
// WHAT IT CANNOT DO: become a team. It sets no cookie and submits no form, so the database it
// shoots is always empty and `/` is the arrival page rather than a board. That is not a gap any
// more -- it is the division of labour. `node scripts/walk.js` walks the door, the scans and the
// submissions and shoots the pages behind them.

import { nameFor, reportOverflow, PHONE, withBrowser } from './lib/browser.js';

// --- arguments ------------------------------------------------------------------------------

const argv = process.argv.slice(2);
const routes = [];
let base = null;
let out = null;
let width = PHONE.width;
let height = PHONE.height;
let scale = PHONE.scale;
let reducedMotion = false;
let full = false;
// How far down the page to scroll before shooting. Zero is the fold, and the fold is the one place
// a STICKY thing is still sitting where it started -- so at zero the marquee is indistinguishable
// from an ordinary strip at the top, and `--full` renders from the top too. Neither shows the thing
// worth looking at: the marquee pinned over content that has scrolled under it.
let scroll = 0;

for (let i = 0; i < argv.length; i += 1) {
  const arg = argv[i];
  if (arg === '--reduced-motion') reducedMotion = true;
  else if (arg === '--full') full = true;
  else if (arg === '--base') base = argv[(i += 1)];
  else if (arg === '--out') out = argv[(i += 1)];
  else if (arg === '--width') width = Number(argv[(i += 1)]);
  else if (arg === '--height') height = Number(argv[(i += 1)]);
  else if (arg === '--scale') scale = Number(argv[(i += 1)]);
  else if (arg === '--scroll') scroll = Number(argv[(i += 1)]);
  else if (arg.startsWith('-')) {
    console.error(`unknown flag: ${arg}`);
    process.exit(1);
  } else routes.push(arg.startsWith('/') ? arg : `/${arg}`);
}

if (!routes.length) routes.push('/', '/kit');

// --- run ------------------------------------------------------------------------------------

const problems = [];

const { overflow } = await withBrowser(
  { base, out, reducedMotion, width, height, scale },
  async ({ page }) => {
    for (const route of routes) {
      try {
        await page.goto(route);
        await page.scrollTo(scroll);
        await page.shoot(nameFor(route), { full });
      } catch (error) {
        problems.push(`${route}: ${error.message}`);
      }
    }
  },
);

if (full) {
  console.log(
    '\nnote: --full renders past the fold, which shows the whole page but misplaces anything\n' +
      'sticky. Trust a default shot for the marquee and the scorebar.',
  );
}

reportOverflow(overflow);

if (problems.length) {
  process.stderr.write(`\n${problems.length} ROUTE(S) NOT SHOT:\n`);
  for (const problem of problems) process.stderr.write(`  ${problem}\n`);
  process.exitCode = 1;
}
