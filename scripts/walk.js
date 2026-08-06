#!/usr/bin/env node
// Arrive as a team, play, and look at what a guest would be looking at.
//
//   node scripts/walk.js                    -> every flow, shot as it goes
//   node scripts/walk.js standings          -> one flow by name
//   node scripts/walk.js --out shots
//   node scripts/walk.js --reduced-motion   -> the frozen marquee, on a real board
//   node scripts/walk.js --list
//
// scripts/screenshot.js shoots anything a URL can reach, which stops at the front door: it holds
// no cookie and submits no form, so its database is always empty and `/` is always the arrival
// page. Everything this map has built since -- the board, a tile mid-play, a verdict, a photo
// coming back as a thumbnail, and the three standing colours -- lives behind a state nobody
// reaches by browsing. This walks to those states and shoots them.
//
// IT IS ALSO THE E2E SUITE, and that is one thing rather than two on purpose. #32 settled that
// this repo has no test script and no CI, on the reasoning that a check nobody runs is worse than
// no check because it looks like enforcement. #59 found the way out and did not name it: make the
// check a byproduct of something somebody already wants. Nobody will run a suite eight days
// before a party. Everybody wants to see the page. So every flow below both WALKS the state and
// SHOOTS it, and a flow that breaks cannot produce its screenshot -- the run fails, loudly, with
// the step that broke. You do not run this out of duty; you run it because you want the picture,
// and the regression check is what you get on the way past.
//
// WHY NOT PLAYWRIGHT: see the header of scripts/lib/browser.js. Short version -- its browsers are
// not actually cached at the pinned revision, node_modules is gitignored so every fresh worktree
// would owe a `pnpm install` before it could look at anything, and this site has no client JS to
// drive anyway.

import { existsSync, mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import codes from '../content/codes.js';
import economy from '../content/economy.js';
import { reportOverflow, PHONE, withBrowser } from './lib/browser.js';

const REPO = new URL('../', import.meta.url).pathname;

// The hunt the `hunt` flow walks. Both hunts have identical mechanics -- an ordered chain of
// codes, points banked per step -- so one flow covers the pair, and the lights hunt inherits every
// check below by changing this string once its content lands (#18).
const HUNT = 'riddle';

// Fixed, and handed to the server we boot. The walker needs the admin surfaces and there is no
// human here to read a secret off a terminal.
const ADMIN_SECRET = 'walk-the-map';

// A real image, already in the repo, already a photograph of something. Photos are stored exactly
// as they arrive (ADR-photos-are-stored-as-they-arrive), so nothing here needs a fixture.
const A_REAL_IMAGE = `${REPO}moeriki-birthday-invite.png`;

/** The first code pointing at this game whose content actually exists. */
function slugFor(gameId) {
  const entry = Object.entries(codes).find(([, code]) => code.game === gameId && !code.pending);
  return entry?.[0] ?? null;
}

// --- checks ------------------------------------------------------------------------------------

/**
 * A check is a sentence that has to be true, said out loud whether it passes or not. The passing
 * ones are the run's receipt -- "35 checks" in this map's history has always meant a list like
 * this, and printing it is what stops the number being a claim.
 */
function recorder() {
  const failures = [];
  let passed = 0;

  return {
    failures,
    count: () => passed + failures.length,
    passed: () => passed,
    check(label, condition) {
      if (condition) {
        passed += 1;
        console.log(`  ✓ ${label}`);
      } else {
        failures.push(label);
        console.log(`  ✗ ${label}`);
      }
      return Boolean(condition);
    },
  };
}

// --- the walk ------------------------------------------------------------------------------------

/**
 * Through the front door for real: two screens, nine fields, and the dealt name. Used by every
 * flow that needs to be somebody, and walked end to end as a flow of its own.
 *
 * It always starts by dropping the cookie, so a flow that runs after another arrives as a
 * stranger rather than inheriting the last team.
 */
async function onboard(page, { members = ['Dieter', 'Anna'], shoot = null, check = null } = {}) {
  await page.clearCookies();
  await page.goto('/');

  const atDoor = await page.url();
  check?.('a stranger at / is sent to the front door', atDoor.startsWith('/welcome'));

  const dealt = await page.text('.display');
  if (shoot) await shoot('welcome');

  // The reroll. It carries formmethod=get and sits ABOVE the real button, which is exactly the
  // trap a generic form filler walks into, so it is worth pressing once on purpose.
  await page.press('form button[formmethod="get"]');
  const redealt = await page.text('.display');
  check?.('"deal us another" deals another name', Boolean(redealt) && redealt !== dealt);

  await page.fillForm({ member: members });
  await page.submit();

  const atQuestions = await page.url();
  check?.('the door leads to the questions', atQuestions.startsWith('/questions'));
  if (shoot) await shoot('questions');

  await page.fillForm();
  await page.submit();

  const landed = await page.url();
  check?.('answering everything opens the gate', landed === '/' || landed.startsWith('/?'));

  const name = await page.text('.scorebar__name');
  return { name, landed };
}

// --- flows ---------------------------------------------------------------------------------------

const FLOWS = [
  {
    name: 'door',
    what: 'arrive as a stranger, walk both onboarding screens, land on the board',
    async run({ page, shoot, check }) {
      const { name } = await onboard(page, { shoot, check });

      check('the board knows who we are', Boolean(name));
      const open = await page.text('.scorebar__open');
      check(`the two starter tiles are open (${open})`, /^2 of \d+ open$/.test(open ?? ''));
      check('a fresh team has no standing colour', !(await page.has('[class*="standing--"]')));

      await shoot('board-fresh');
    },
  },

  {
    name: 'scan',
    what: 'scan a code and land inside the game it unlocks',
    async run({ page, shoot, check }) {
      await onboard(page);

      const slug = slugFor('guess-who');
      if (!slug) return check('guess-who has a code to scan', false);

      const before = Number(((await page.text('.scorebar__open')) ?? '').split(' ')[0]);
      await page.goto(`/q/${slug}`);

      const landed = await page.url();
      check(`scanning ${slug} lands in the game itself`, landed.startsWith('/g/guess-who'));

      // NOT `landed.includes('just=')`, which reads false however well the site works. The
      // redirect really does carry `?just=unlock`, and public/js/app.js really does delete it on
      // the first animation frame -- a one-shot signal, so pull-to-refresh cannot replay the
      // animation. By the time anything can read `location`, the param is gone by design. What
      // survives is what the server baked into the HTML, which is the honest thing to check.
      check('the scan plays the unlock on the hero', await page.has('[class*="anim-unlock"]'));

      const after = Number(((await page.text('.scorebar__open')) ?? '').split(' ')[0]);
      check(`one more tile is open (${before} -> ${after})`, after === before + 1);

      await shoot('scan-unlocked');

      // Twice, because a code is a place in a house and people scan them again.
      await page.goto(`/q/${slug}`);
      check('scanning the same code again is not an error', (await page.url()).startsWith('/g/'));
    },
  },

  {
    name: 'answer',
    what: 'submit an answer to a check() game and read the verdict it comes back with',
    async run({ page, shoot, check }) {
      await onboard(page);

      const slug = slugFor('triangle');
      if (!slug) return check('the Triangle Test has a code to scan', false);

      await page.goto(`/q/${slug}`);
      check('the code opens the Triangle Test', (await page.url()).startsWith('/g/triangle'));
      await shoot('game-unplayed');

      await page.fillForm();
      await page.submit();

      const landed = await page.url();
      check('submitting keeps the team on the game page', landed.startsWith('/g/triangle'));

      // The verdict, in words. The `?just=` param that carried it here is already spent (see the
      // scan flow), so the banner the server rendered from it is the whole evidence.
      const verdict = await page.text('.banner');
      check(`the answer comes back with a verdict — "${verdict}"`, Boolean(verdict));

      // A `final` game closes its form once answered -- the whole point of the tile.
      check('a final answer closes the form', !(await page.has('form select')));

      await shoot('game-answered');
    },
  },

  {
    name: 'photo',
    what: 'send a real photograph and see it come back as a thumbnail',
    async run({ page, shoot, check }) {
      await onboard(page);

      const slug = slugFor('scavenger');
      if (!slug) return check('the photo scavenger has a code to scan', false);
      check('there is a real image to send', existsSync(A_REAL_IMAGE));

      await page.goto(`/q/${slug}`);
      check('the code opens the scavenger', (await page.url()).startsWith('/g/scavenger'));

      const cameras = await page.count('input[type="file"]');
      check(`every prompt is a camera (${cameras} of them)`, cameras > 0);
      await shoot('photo-prompts');

      await page.setFile('input[type="file"]', A_REAL_IMAGE);
      await page.submit('input[type="file"]');

      const landed = await page.url();
      check('the photo lands back on the scavenger', landed.startsWith('/g/scavenger'));
      check('the photo comes back as a thumbnail', (await page.count('.shot img')) > 0);

      const src = await page.attr('.shot img', 'src');
      check(`the thumbnail points at the upload (${src})`, String(src).startsWith('/uploads/'));

      await shoot('photo-sent');
    },
  },

  {
    name: 'hunt',
    what: 'walk a treasure hunt end to end, banking a step at a time',
    async run({ page, shoot, check }) {
      await onboard(page);

      // Every step of the riddle hunt, in step order. Written against `codes` rather than against
      // the game file so it stays true of whichever hunt is named here -- the lights hunt walks
      // this same flow once its content lands (#18) by changing one string.
      const steps = Object.entries(codes)
        .filter(([, code]) => code.game === HUNT && !code.pending)
        .sort((a, b) => a[1].step - b[1].step);

      if (!steps.length) return check(`the ${HUNT} hunt has codes to scan`, false);

      // Out of order FIRST, while the team is on step zero. Hunt position is the longest
      // CONTIGUOUS run of accepted scans, so stumbling on the last card early has to do nothing
      // at all -- that is the whole of why this site needs no anti-cheat, and it is worth one
      // check rather than one paragraph. See docs/adr/hunt-progress-is-derived-from-scans.md.
      const [lastSlug] = steps[steps.length - 1];
      await page.goto(`/q/${lastSlug}`);
      check(
        `the last card, found first, does not open the hunt`,
        !(await page.url()).startsWith(`/g/${HUNT}`),
      );
      await shoot('hunt-out-of-order');

      let previous = 0;
      for (const [slug, code] of steps) {
        await page.goto(`/q/${slug}`);
        check(`step ${code.step}: ${slug} lands in the hunt`, (await page.url()).startsWith(`/g/${HUNT}`));

        const line = (await page.text('.statusline')) ?? '';
        check(
          `step ${code.step}: the page says where it is (${line})`,
          line.includes(`Step ${code.step} of ${steps.length}`),
        );

        await shoot(`hunt-step-${code.step}`);

        await page.goto('/');
        const score = Number(await page.text('.scorebar__num'));

        // The first card is hung in plain sight, so reaching it is not playing and pays nothing
        // (#27). Every other step banks something the moment it is reached.
        if (code.step === 1) {
          check(`step 1 banks nothing (${score})`, score === 0);
        } else {
          check(`step ${code.step}: the score went up (${previous} -> ${score})`, score > previous);
        }
        previous = score;
      }

      // A hunt is the one kind whose whole payout is knowable before anybody plays it, so this is
      // the arithmetic the tile budget actually promises.
      check(
        `finishing pays exactly the tile budget (${previous} of ${economy.tilePoints})`,
        previous === economy.tilePoints,
      );
      check('a finished hunt turns the tile green', await page.has('.tile--correct'));

      await shoot('hunt-finished');
    },
  },

  {
    name: 'standings',
    what: 'walk all three standing colours on a real board with real rivals',
    async run({ page, shoot, check }) {
      // Rivals first, so the last cookie standing is ours. A rival only has to EXIST to be on the
      // board -- standings() reads every team -- so they stop at the door rather than walking
      // both screens, which is three fewer questionnaires per run.
      const rivals = [];
      for (const who of ['Rival', 'Other', 'Third']) {
        await page.clearCookies();
        await page.goto('/welcome');
        await page.fillForm({ member: [who] });
        await page.submit();
        rivals.push(who);
      }
      check(`${rivals.length} rival teams are on the board`, rivals.length === 3);

      await onboard(page);
      const us = await page.text('.scorebar__name');

      // The admin cookie, through the route the host uses on the night.
      await page.goto(`/admin/key/${ADMIN_SECRET}`);
      check('the admin key lets us in', !(await page.url()).startsWith('/admin/key'));

      const board = await readBoard(page);
      const mine = board.find((row) => row.name === us);
      const theirs = board.filter((row) => row.name !== us);
      check(
        'the host board can tell us apart from the rivals',
        Boolean(mine) && theirs.length === 3,
      );
      if (!mine) return undefined;

      // A spread that puts third place on 50, which is what the bands are read against:
      // podiumSize is 3 and podiumGap is 30 (content/economy.js).
      for (const [index, points] of [90, 70, 50].entries()) {
        await award(page, theirs[index].id, points, 'rival');
      }

      // Tracked here rather than read off the scorebar before each award, because the page an
      // award redirects to is /admin, which has no scorebar to read: `Number(null)` is 0, which
      // happened to be the right answer on the first pass and would have been silently wrong on
      // any board that did not start empty. The board's own number seeds it; the check below is
      // what confirms the page agrees.
      let score = mine.score;

      // 60 with third place on 50: at or above the line, so the podium.
      // 45: five short of it, and podiumGap is 30, so still chasing.
      // 10: forty short, which is the rest of the field.
      for (const [band, target] of [
        ['podium', 60],
        ['chasing', 45],
        ['rest', 10],
      ]) {
        await award(page, mine.id, target - score, `walking to ${band}`);
        score = target;

        await page.goto('/');
        check(
          `${band}: the scorebar reads ${target}`,
          Number(await page.text('.scorebar__num')) === target,
        );
        check(
          `${band}: the dashboard wears its colour`,
          await page.has(`.standing--${BAND_CLASS[band]}`),
        );

        await shoot(`standing-${band}`);
      }

      // And the fourth band, which has no colour and is the one every team starts in.
      await award(page, mine.id, -score, 'back to nothing');
      await page.goto('/');
      check(
        'a team on zero is fresh, and wears no colour',
        !(await page.has('[class*="standing--"]')),
      );
      await shoot('standing-fresh');
    },
  },
];

const BAND_CLASS = { podium: 'top', chasing: 'mid', rest: 'low' };

/**
 * Every team's id, name and score, read off the host's own board rather than out of the database.
 *
 * /admin is still #11's stub, which prints its data as JSON in a `<pre>` -- so the ids are on
 * screen, just not designed yet. When the real board lands this stops finding them, and it says
 * so in one sentence rather than failing as three confusing checks further down.
 */
async function readBoard(page) {
  await page.goto('/admin');

  const raw = await page.rawText('pre.mono');
  if (!raw) {
    throw new Error(
      '/admin no longer prints its board as JSON — teach readBoard() to read the real one',
    );
  }

  const { board } = JSON.parse(raw);
  return board;
}

/** Move points, through the route the host's board will press once #11 renders it. */
const award = (page, teamId, points, reason) =>
  page.post('/admin/award', { team: teamId, points, reason });

// --- arguments -------------------------------------------------------------------------------

const argv = process.argv.slice(2);
const wanted = [];
let out = null;
let reducedMotion = false;

for (let i = 0; i < argv.length; i += 1) {
  const arg = argv[i];
  if (arg === '--reduced-motion') reducedMotion = true;
  else if (arg === '--out') out = argv[(i += 1)];
  else if (arg === '--list') {
    for (const flow of FLOWS) console.log(`${flow.name.padEnd(11)} ${flow.what}`);
    process.exit(0);
  } else if (arg.startsWith('-')) {
    console.error(`unknown flag: ${arg}`);
    process.exit(1);
  } else wanted.push(arg);
}

const flows = wanted.length ? FLOWS.filter((flow) => wanted.includes(flow.name)) : FLOWS;

if (!flows.length) {
  const known = FLOWS.map((flow) => flow.name).join(', ');
  console.error(`no such flow: ${wanted.join(', ')}\nknown: ${known}`);
  process.exit(1);
}

// --- run -------------------------------------------------------------------------------------

const broken = [];
const overflow = [];
const recorded = recorder();

// One directory for the whole run, but ONE SERVER AND ONE DATABASE PER FLOW. That costs about
// half a second each and buys the property that makes a failing flow readable: every flow starts
// on an empty board with nobody onboarded. Sharing one database was the first thing tried, and it
// leaves the standings flow counting the four teams the four flows before it left lying around --
// which it did, and the arithmetic still passed, which is exactly how a shared fixture hides.
const outDir = out ?? mkdtempSync(join(tmpdir(), 'bday-walk-'));
mkdirSync(outDir, { recursive: true });

for (const flow of flows) {
  console.log(`\n${flow.name} — ${flow.what}`);
  const run = await withBrowser(
    { out: outDir, reducedMotion, ...PHONE, env: { ADMIN_SECRET } },
    async ({ page }) => {
      const shoot = (name, options) => page.shoot(`${flow.name}-${name}`, options);
      try {
        await flow.run({ page, shoot, check: recorded.check });
      } catch (error) {
        console.log(`  ✗ the walk broke: ${error.message}`);
        broken.push(`${flow.name}: ${error.message}`);
      }
    },
  );
  overflow.push(...run.overflow);
}

console.log(`\n${recorded.passed()} of ${recorded.count()} checks passed. Shots in ${outDir}`);

reportOverflow(overflow);

if (recorded.failures.length || broken.length) {
  process.stderr.write('\nWHAT FAILED:\n');
  for (const line of [...broken, ...recorded.failures]) process.stderr.write(`  ${line}\n`);
  process.exitCode = 1;
}
