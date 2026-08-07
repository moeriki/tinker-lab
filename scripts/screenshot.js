#!/usr/bin/env node
// Look at a page. Not a test -- a pair of eyes.
//
//   node scripts/screenshot.js                       -> / and /kit, on a phone
//   node scripts/screenshot.js /kit /no-such-code
//   node scripts/screenshot.js --reduced-motion /
//   node scripts/screenshot.js --dark /welcome      -> the phone set to dark, not the site
//   node scripts/screenshot.js --full /kit           -> the whole page, not just the fold
//   node scripts/screenshot.js --scroll 600 /        -> the fold 600px down, the page mid-scroll
//   node scripts/screenshot.js --base https://bday.moeriki.com /   -> the real deploy
//   node scripts/screenshot.js --out shots /         -> somewhere you choose
//   node scripts/screenshot.js --admin /admin        -> as the host, not as a stranger
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
// WHAT IT CANNOT DO: become a team. It submits no form, so the database it shoots is always empty
// and `/` is the arrival page rather than a board. That is not a gap any more -- it is the
// division of labour. `node scripts/walk.js` walks the door, the scans and the submissions and
// shoots the pages behind them.
//
// `--admin` is the one cookie it will set, and it exists because without it the eleven admin
// routes were unreachable to every pair of eyes in this repository: they 404 to a stranger, so a
// cold shot of `/admin` returned the 404 page and an agent could read that as the page. Half of
// this site is a working tool one person uses on one night (#66 put it outside `/kit`'s contract
// entirely), which makes it the half most in need of somebody looking at it. It visits
// `/admin/key/<secret>` first, exactly as a host does.

import { ADMIN_SECRET } from '../src/config.js';
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
// There is no dark version of this site to shoot. This shoots the PHONE in dark mode, which is a
// different thing: the platform draws the form controls and the scrollbar, and will theme them
// itself unless told not to. The only view in which `color-scheme: light` can be seen working.
let dark = false;
let full = false;
let admin = false;
// How far down the page to scroll before shooting. Since #88 unstuck the marquee there is nothing
// `position: sticky` left on this site, so a default shot no longer hides anything the way it hid
// a pinned marquee. What it still cannot show is the page in its scrolled state: the pinned foot
// over content that has run under it, and the marquee correctly GONE rather than merely untested.
let scroll = 0;

for (let i = 0; i < argv.length; i += 1) {
  const arg = argv[i];
  if (arg === '--reduced-motion') reducedMotion = true;
  else if (arg === '--dark') dark = true;
  else if (arg === '--full') full = true;
  else if (arg === '--admin') admin = true;
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
  { base, out, reducedMotion, dark, width, height, scale },
  async ({ page }) => {
    // The host's own way in, and the only state this script ever puts itself into. It is a GET
    // that sets a cookie and redirects, so one visit covers every admin route in the list.
    if (admin) await page.goto(`/admin/key/${ADMIN_SECRET}`);

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
      'pinned. Trust a default shot for the foot -- the menu bar and the small print.',
  );
}

reportOverflow(overflow);

if (problems.length) {
  process.stderr.write(`\n${problems.length} ROUTE(S) NOT SHOT:\n`);
  for (const problem of problems) process.stderr.write(`  ${problem}\n`);
  process.exitCode = 1;
}
