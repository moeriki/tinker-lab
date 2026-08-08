#!/usr/bin/env node
// Arrive as a team, play, and look at what a guest would be looking at.
//
//   node scripts/walk.js                    -> every flow, shot as it goes
//   node scripts/walk.js standings          -> one flow by name
//   node scripts/walk.js --out shots
//   node scripts/walk.js --reduced-motion   -> the frozen marquee, on a real board
//   node scripts/walk.js --dark             -> the phone set to dark, through the whole door wizard
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
// not actually cached at the pinned revision, and this site has no client JS to drive anyway. The
// third reason used to be that a devDependency would cost every fresh worktree a `pnpm install`;
// #102 spent that one, since this repo now has dependencies and every worktree owes it regardless.

import { existsSync, mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import codes from '../content/codes.js';
import economy from '../content/economy.js';
import { reportOverflow, PHONE, withBrowser } from './lib/browser.js';
import { answersFor, HERD_MAJORITY, HOUSE, US } from './lib/house.js';

const REPO = new URL('../', import.meta.url).pathname;

// The hunt the `hunt` flow walks. Both hunts have identical mechanics -- an ordered chain of
// codes, points banked per step -- so one flow covers the pair, and the lights hunt inherits every
// check below by changing this string once its content lands (#18).
const HUNT = 'riddle';

// Fixed, and handed to the server we boot. The walker needs the admin surfaces and there is no
// human here to read a secret off a terminal.
const ADMIN_SECRET = 'walk-the-map';

/** Every code in the inventory, which is what HQ's one number counts down from. */
const CODE_COUNT = Object.keys(codes).length;

// A JPEG WITH AN EMBEDDED EXIF THUMBNAIL, and both halves of that sentence are load-bearing.
//
// This used to be `moeriki-birthday-invite.png`, on the reasoning that photos are stored exactly
// as they arrive (ADR-photos-are-stored-as-they-arrive) so nothing here needed a fixture. What
// that missed: `exifThumbnail` returns null on its first line for anything that is not a JPEG, so
// a PNG walked straight past the fifty-seven lines of TIFF byte-walking underneath it. Every walk
// this repo has ever run left that code unexecuted -- and every guest uploads a phone JPEG, so it
// was going to run for the first time on the night (#102).
//
// A phone photo is now what gets sent, so the gallery screenshot below cannot be produced unless
// the thumbnail was really extracted. Regenerate it with the recipe in test/photos.test.js.
const A_REAL_IMAGE = `${REPO}test/fixtures/phone-photo.jpg`;

/** The first code pointing at this game whose content actually exists. */
function slugFor(gameId) {
  const entry = Object.entries(codes).find(([, code]) => code.game === gameId && !code.pending);
  return entry?.[0] ?? null;
}

/** Every code for a hunt, in step order. Empty while the hunt's content is still pending. */
function trailFor(gameId) {
  return Object.entries(codes)
    .filter(([, code]) => code.game === gameId && !code.pending && code.step)
    .sort((a, b) => a[1].step - b[1].step)
    .map(([slug]) => slug);
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
 * Through the front door for real: the wizard, one screen at a time (#97). Used by every flow that
 * needs to be somebody, and walked end to end as a flow of its own.
 *
 * Eight or nine screens depending on how many of you there are -- your name, the captain line and
 * the second name, the dealt team name, one question per member, the five herd words, then the
 * house rules one per screen. It always starts by dropping the cookie, so a flow that runs after
 * another arrives as a stranger rather than inheriting the last team.
 *
 * The two-people case is the one that is walked by default, because teams of two is the locked
 * constraint; `members: ['Solo']` walks the shorter path, and the counter difference between the
 * two is the thing that would break silently if the wizard ever started lying about its total.
 */
async function onboard(page, { members = ['Dieter', 'Anna'], shoot = null, check = null, guest = null } = {}) {
  const [captain, mate] = members;

  await page.clearCookies();
  await page.goto('/');

  const atDoor = await page.url();
  check?.('a stranger at / is sent to the front door', atDoor.startsWith('/welcome'));

  const firstCount = await page.text('.door__count');
  check?.(`the door opens on step 1 (${firstCount})`, /^step 1 of \d+$/.test(firstCount ?? ''));
  if (shoot) await shoot('door-name');

  // --- screen 1: your name
  await page.fillForm({ member: captain });
  await page.submit();

  check?.('the first name leads to the captain screen', (await page.url()).startsWith('/welcome/mate'));
  const captainTitle = await page.text('.door__title');
  check?.('the captain line lands after the name is typed', /captain/i.test(captainTitle ?? ''));
  if (shoot) await shoot('door-captain');

  // --- screen 2: anyone with you?
  // Solo is the SAME press as a pair, with the field left empty (#107). It used to be its own
  // `on my own` button; the forward button reads the field and says `On my own` instead.
  if (mate) await page.fillForm({ member: mate });
  await page.submit();

  check?.('the second screen leads to the dealt name', (await page.url()).startsWith('/welcome/team'));

  // --- screen 3: the dealt team name, and the reroll
  const dealt = await page.text('.door__title');
  await page.press('form button[name="reroll"]');
  const redealt = await page.text('.door__title');
  check?.('"deal us another" deals another name', Boolean(redealt) && redealt !== dealt);
  if (shoot) await shoot('door-team');

  await page.submit();

  const atQuestions = await page.url();
  check?.('the dealt name leads to the questions', atQuestions.startsWith('/questions'));

  // --- the question screens: one per member, then the team's five words. The wizard says how many
  // screens it thinks there are, so walk exactly that many rather than a number written here.
  const total = Number((await page.text('.door__count'))?.match(/of (\d+)/)?.[1] ?? 0);
  check?.(
    `a team of ${members.length} walks ${total} screens`,
    total === 3 + members.length + 1 + 3,
  );

  // `guest` is a cast entry from lib/house.js, and it is what turns this from "the gate opens" into
  // "the room has a shape". Without one every field takes a distinct filler word, which is right
  // for a flow that only needs to be somebody -- and wrong for the three tiles that read the whole
  // house, because a corpus of unrelated words has nothing to cluster and nothing to separate.
  for (let screen = 0; screen < members.length + 1; screen += 1) {
    if (shoot && screen === 0) await shoot('door-question');
    if (shoot && screen === members.length) await shoot('door-herd');
    await page.fillForm(guest ? await answersFor(page, guest, screen) : {});
    await page.submit();
  }

  const atRules = await page.url();
  check?.('the last answer leads to the rules', atRules.startsWith('/questions/rules'));
  if (shoot) await shoot('door-rules');

  // --- the rules, one per screen, pressed through rather than tapped away
  let guard = 0;
  while ((await page.url()).startsWith('/questions/rules')) {
    if (guard > 10) throw new Error('the rules screens never ended');
    guard += 1;
    await page.submit();
  }

  const landed = await page.url();
  check?.('pressing through the rules opens the gate', landed === '/' || landed.startsWith('/?'));

  const name = await page.text('.scorebar__name');
  return { name, landed };
}

/**
 * A team that EXISTS and has answered nothing -- the cheap rival, used by any flow that needs
 * bodies on the board rather than nine answers each.
 *
 * It used to be two presses: fill `/welcome`, submit, done. The wizard moved team creation to the
 * third screen (#97), so it is now the three identity screens and it stops there, which is still
 * five presses fewer than a whole questionnaire. It leaves the cookie attached, so the caller who
 * wants to be somebody else afterwards clears it -- exactly as before.
 */
/**
 * One guest of the cast, all the way through the wizard, answering as themselves. Returns the
 * handle they were dealt.
 *
 * It walks the pages a guest walks -- no rows written behind the site's back -- because the GATE is
 * the thing being relied on. A team that has not passed `onboardingComplete()` is invisible to
 * `deals.js` and `harvest.js` by design, so a fixture that seeded the database directly would be a
 * house that nobody in the house can see, which is exactly the wrong answer to look at.
 */
const arrive = async (page, guest) =>
  (await onboard(page, { members: guest.members, guest })).name;

/**
 * Fill the house, and hand back the handles in arrival order.
 *
 * The cookie is dropped before each arrival and left holding the LAST guest, so a caller that
 * wants to be somebody else calls `arrive(page, US)` afterwards -- which is what the roster flow
 * does, and why `US` sits in lib/house.js beside the cast rather than being invented here.
 */
async function seedHouse(page, { check } = {}) {
  const handles = [];
  for (const guest of HOUSE) handles.push(await arrive(page, guest));

  check?.(
    `${HOUSE.length} other teams are through the door`,
    handles.filter(Boolean).length === HOUSE.length,
  );
  check?.('every handle dealt is distinct', new Set(handles).size === handles.length);

  return handles;
}

async function stopAtTheDoor(page, who) {
  await page.clearCookies();
  await page.goto('/welcome');
  await page.fillForm({ member: who });
  await page.submit();
  // The second name left empty is what makes this a solo captain (#107).
  await page.submit();
  await page.submit();
}

// --- flows ---------------------------------------------------------------------------------------

const FLOWS = [
  {
    name: 'door',
    what: 'arrive as a stranger, walk the onboarding wizard, land on the board',
    async run({ page, shoot, check }) {
      const { name } = await onboard(page, { shoot, check });

      check('the board knows who we are', Boolean(name));
      const open = await page.text('.scorebar__open');
      check(`the two starter tiles are open (${open})`, /^2 of \d+ open$/.test(open ?? ''));
      check('a fresh team has no standing colour', !(await page.has('[class*="standing--"]')));
      check('and the board says what just opened', await page.has('.banner--opened'));

      await shoot('board-fresh');

      // A reload is a different request with no `?opened=1` on it, and the box has to go -- it is
      // a sentence a team reads once. Nothing persists it, so this is checking that nothing
      // accidentally started to.
      await page.goto('/');
      check('and says it once, not on every load', !(await page.has('.banner--opened')));
    },
  },

  {
    name: 'door-solo',
    what: 'walk the door on your own, and check the counter tells the truth about it',
    async run({ page, shoot, check }) {
      // The counter is honest rather than equal (#97): a solo captain walks one screen fewer than a
      // pair, and the total says so. This is the check that would catch it quietly becoming a fixed
      // lie -- the pair's total is asserted inside `onboard`, and this is the other half.
      await onboard(page, { members: ['Solo'], check });

      const open = await page.text('.scorebar__open');
      check(`a solo captain lands on the same board (${open})`, /^2 of \d+ open$/.test(open ?? ''));

      await shoot('board-solo');
    },
  },

  {
    name: 'door-back',
    what: 'press "undo that" and check what you typed came back with you',
    async run({ page, shoot, check }) {
      // Back is a GET submission of the screen you are on, so what you typed rides in the query
      // string rather than being held anywhere. This is the check that it actually comes back --
      // the failure mode is silent, and it is the whole reason the wizard needs no draft state.
      await page.clearCookies();
      await page.goto('/welcome');
      await page.fillForm({ member: 'Wilhelmina' });
      await page.submit();

      check(
        'the captain screen is where back is first offered',
        await page.has('.door__actions .btn--secondary'),
      );
      await page.fillForm({ member: 'Bartholomew' });

      // Forward to the dealt name, then straight back. Back is addressed by its `formaction` and
      // not by its class: the dealt-name screen carries a second quiet button -- `deal us another`
      // sits beside `undo that` -- and a class selector picks whichever the box lists first,
      // which is how this check first "passed" while rerolling the team name instead of going back.
      // Since #107 the two wear different classes, but addressing the action stays the right habit.
      await page.submit();
      check('forward reached the dealt name', (await page.url()).startsWith('/welcome/team'));
      await page.press('button[formaction="/welcome/mate"]');

      const back = await page.url();
      check('back lands on the captain screen', back.startsWith('/welcome/mate'));
      check('and the second name came back with it', back.includes('Bartholomew'));
      check('and so did the first', back.includes('Wilhelmina'));

      await shoot('door-back');

      // --- all the way back out, which is the bug Dieter walked into (#116).
      //
      // Back used to fall through bare `/questions` on the way from question screen 1 to screen 0,
      // and bare `/questions` is the GATE: for a team that has answered everything it spends the
      // held code, fires a hunt step's webhook and redirects to the board. So a team pressing back
      // one screen too many left the wizard entirely and arrived on their dashboard with onboarding
      // silently finished -- no error, no way back in.
      //
      // The flow above never reached it because it only ever pressed back ONCE, on screen two of
      // nine. This walks the whole door and then reverses out of it, which is the only shape that
      // touches the screen the bug lived on.
      await page.clearCookies();
      await page.goto('/welcome');
      await page.fillForm({ member: 'Wilhelmina' });
      await page.submit();
      await page.fillForm({ member: 'Bartholomew' });
      await page.submit();
      await page.submit();

      let forward = 0;
      while (!(await page.url()).startsWith('/questions/rules')) {
        if (forward > 12) throw new Error('the door never reached the rules');
        forward += 1;
        await page.fillForm({});
        await page.submit();
      }
      // On to the LAST rules screen, so the reverse below covers the whole run rather than the tail
      // of it. The last screen is the one whose form points at the gate instead of another rule,
      // which is how this knows where to stop without counting rules it would then have to keep in
      // step with `content/rules.js`.
      let rules = 1;
      while (((await page.attr('form', 'action')) ?? '').startsWith('/questions/rules')) {
        if (rules > 10) throw new Error('the rules screens never ended');
        rules += 1;
        await page.submit();
      }
      check(`the whole door leads to ${rules} rules screens`, rules >= 2);

      // Every press is the secondary, and the loop ends where back does -- question screen zero,
      // which is the first screen that has nothing behind it. Anything that leaves `/questions` on
      // the way is the bug.
      let backs = 0;
      let stray = '';
      while (await page.has('.door__actions .btn--secondary')) {
        if (backs > 20) throw new Error('back never ran out of screens');
        backs += 1;
        await page.press('.door__actions .btn--secondary');
        const at = await page.url();
        if (!at.startsWith('/questions')) stray ||= `back ${backs} left the wizard for ${at}`;
      }

      check(`back walked ${backs} screens out of the rules`, backs === rules + 2);
      check(`and never left the wizard${stray ? ` — ${stray}` : ''}`, stray === '');
      check(
        'and stopped on the first question screen',
        (await page.url()).startsWith('/questions/0'),
      );

      await shoot('door-back-out');
    },
  },

  {
    name: 'bored',
    what: 'press "I\'m bored" and watch the site suggest things and do nothing about them',
    async run({ page, shoot, check }) {
      await onboard(page);

      // The button ships `hidden` and app.js reveals it (#95), so this pair of checks is the
      // whole no-JS decision stated twice: the markup withholds it, the script hands it over.
      // A browser with scripts blocked is left with the first line true and the second false,
      // which is a team that never sees a button rather than one that presses a dead one.
      check('the board carries a bored button', await page.has('#bored'));
      check('and a script is what reveals it', await page.has('#bored:not([hidden])'));
      check('it is not a nineteenth tile', !(await page.has('.tiles #bored')));
      check('the box is shut until asked', await page.has('#bored-modal[hidden]'));

      // Where it sits is half of what this ticket had to settle, and the foot of the board is the
      // one part of this page nothing else in the walk photographs.
      await page.scrollTo(99999);
      await shoot('board-foot');
      await page.scrollTo(0);

      await page.tap('#bored');
      const first = await page.text('#bored-modal .modal__title');
      check(`pressing it opens the box on a suggestion — "${first}"`, Boolean(first));
      check('the box is open', await page.has('#bored-modal:not([hidden])'));
      check('the house words are under it', (await page.text('.modal__actions')) === 'No? Okay?');
      await shoot('bored');

      // A slot machine. Ten pulls is enough to catch a sampler that is really a constant, and
      // every consecutive pair is checked rather than only the first -- "never the same one twice
      // running" is a property of the whole sequence, and a bug that repeats on pull seven is
      // exactly the one a single press would miss.
      const pulls = [first];
      for (let pull = 0; pull < 9; pull += 1) {
        await page.tap('#bored');
        pulls.push(await page.text('#bored-modal .modal__title'));
      }

      const repeated = pulls.filter((one, at) => at > 0 && one === pulls[at - 1]);
      check(`ten pulls never repeat back to back`, repeated.length === 0);
      check(`and are not one word ten times (${new Set(pulls).size} distinct)`, new Set(pulls).size > 1);

      // Both answers close it and do nothing else -- no points, no record, no route. The URL is
      // the part worth pinning: a suggestion that navigated would make this a menu.
      const before = await page.url();
      await page.tap('#bored-modal .btn--primary');
      check('"Okay?" closes it', await page.has('#bored-modal[hidden]'));

      await page.tap('#bored');
      await page.tap('#bored-modal .btn--secondary');
      check('"No?" closes it too', await page.has('#bored-modal[hidden]'));
      check('and neither answer went anywhere', (await page.url()) === before);
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

      // HQ's one number, checked against the only thing that can move it (#79). The count is the
      // page's whole reason to exist -- a code nobody has found at 23:00 is behind a radiator --
      // and a readout nothing has ever moved is a readout nobody should trust. Two scans of the
      // same slug, so this also pins that it counts CODES and not scans.
      await page.goto(`/admin/key/${ADMIN_SECRET}`);
      const unfound = Number((await page.text('.hq-row .mono')) ?? NaN);
      check(`HQ counts one fewer unfound code (${unfound} of ${CODE_COUNT})`, unfound === CODE_COUNT - 1);

      // The three gauges #94 added, checked against the same two scans -- which is what makes
      // this worth the lines: ONE code was found and TWO scans happened, so a gauge that counted
      // the wrong event would read 2 and 2 or 1 and 1 and look perfectly reasonable on screen.
      const gauges = (await page.text('.hq-gauges')) ?? '';
      check(
        `HQ says one code of ${CODE_COUNT} has been found (${gauges.split('\n')[0]})`,
        gauges.includes(`1 of ${CODE_COUNT} found`),
      );
      check('HQ counts both scans of it, not just the code', gauges.includes('2 scans'));

      // The pulse counts scans AND submissions, and nothing has been submitted yet, so it is the
      // two scans alone at this point. A window of thirty minutes means a walk cannot age out of
      // it -- if this ever goes flaky, that is the reason and the fix is not a longer window.
      check('the pulse has both of them in its half hour', gauges.includes('2 things in the last 30 min'));

      // Progress is the average team score over a perfect 100. One team, nothing scored yet.
      const headline = (await page.text('[data-live="hq-headline"]')) ?? '';
      check(`HQ opens on 0% (${headline})`, headline.includes('0%'));

      await shoot('scan-hq');

      // The live endpoint is the SAME renderer as the page, which is the whole design of #94 --
      // a poller with its own copy of the markup drifts the first time either is edited. So this
      // does not check that the JSON is well-formed, it checks that a fragment it returns is
      // byte-identical to the one already on screen.
      const live = await page.evaluate(`
        return fetch('/admin/live', { headers: { accept: 'application/json' } })
          .then((r) => r.json())
          .then((parts) => {
            // Through a scratch element, because the page's own innerHTML has already been
            // through one: the browser decodes \`&middot;\` to \`·\` on the way out, so comparing
            // the raw server string to it fails on markup that is character-for-character the
            // same thing. Normalising both sides the same way is what makes this an equality
            // check about RENDERING rather than about entity spelling.
            const scratch = document.createElement('div');
            scratch.innerHTML = parts['hq-gauges'];
            return JSON.stringify({
              keys: Object.keys(parts).sort(),
              matches: scratch.innerHTML === document.querySelector('[data-live="hq-gauges"]').innerHTML,
            });
          })
      `);
      const served = JSON.parse(live);
      check(
        `/admin/live serves every slot (${served.keys.join(', ')})`,
        ['hq-codes', 'hq-gauges', 'hq-headline', 'hq-jobs', 'league-board'].every((key) =>
          served.keys.includes(key),
        ),
      );
      check('and renders them identically to the page itself', served.matches === true);

      // The page has to be marked, or the poller never starts and every number above freezes at
      // whatever it said when the host opened it -- which looks exactly like a quiet party.
      const seconds = await page.evaluate('return document.body.dataset.liveSeconds ?? ""');
      check(`HQ is marked live (every ${seconds}s)`, Number(seconds) > 0);

      // Last, because it burns the admin cookie: a stranger must not reach the live endpoint.
      // This matters more here than on the admin PAGES -- those leak a screen at a time, and this
      // one hands back the entire league board in a single request, which is exactly what #8 says
      // no guest sees before the reveal. 404 and not 401, like every admin surface: a guest
      // poking at it should not learn that it exists.
      await page.clearCookies();
      const guessed = await page.evaluate(`
        return fetch('/admin/live', { headers: { accept: 'application/json' } })
          .then((r) => r.status + ' ' + r.headers.get('content-type'))
      `);
      check(`a stranger gets the 404 page from /admin/live (${guessed})`, guessed.startsWith('404 text/html'));
    },
  },

  {
    name: 'lights',
    what: 'walk the lights hunt, be refused out of order, and buy its one shared hint sequence',
    async run({ page, shoot, check }) {
      await onboard(page);

      const trail = trailFor('lights');
      if (trail.length < 2) return check('the lights hunt has a trail to walk', false);

      // THE ONE THING A SCREENSHOT CANNOT TELL YOU. Position is derived from the longest
      // contiguous run of accepted scans, so jumping to the last card must advance nothing --
      // and it must say so on a page that names no game and admits nothing.
      await page.goto(`/q/${trail[trail.length - 1]}`);
      check('scanning the last card first is refused', (await page.url()).startsWith('/p/too-soon'));
      const denial = await page.text('.app p');
      check(`the refusal gives nothing away — "${denial}"`, /move along/i.test(denial ?? ''));
      await shoot('hunt-too-soon');

      for (const [index, slug] of trail.entries()) {
        const step = index + 1;
        await page.goto(`/q/${slug}`);

        const landed = await page.url();
        check(`step ${step} lands in the hunt`, landed.startsWith('/g/lights'));

        const statusline = await page.text('.statusline');
        check(
          `step ${step} reads as reached — "${statusline}"`,
          statusline === `Step ${step} of ${trail.length} — reached ${step}`,
        );

        if (step === 1) await shoot('hunt-step-1');
      }

      await shoot('hunt-complete');

      // One list for the whole trail, not one per step (#18): standing on the LAST step, the
      // first press must hand over the FIRST hint, which a per-step model could never do.
      await page.goto(`/g/lights`);
      if (await page.has('.btn--hint')) {
        await page.press('.btn--hint');
        const first = await page.text('.bubble');
        check(`the hint sequence starts at the beginning — "${first}"`, /something did happen/i.test(first ?? ''));
        await shoot('hunt-hint');

        // BOTH OF THEM, because both are about card one (#101) and the pair only works read in
        // order: the first says the house did something, the second says which property of it to
        // watch. A team that bought one and got the other would be told a fact about colour
        // before being told anything happened at all.
        await page.press('.btn--hint');
        const list = (await page.text('ul.stack--tight')) ?? '';
        check(
          `and the whole mechanic is two hints, not one — "${list}"`,
          /something did happen/i.test(list) && /mind the colour/i.test(list),
        );
        check('a spent sequence stops offering', !(await page.has('.btn--hint')));

        // Without the `?hint=` param, so the modal is not sitting over the thing being shot. The
        // shot above is the moment of paying; this one is what a team reads afterwards, which is
        // the pair in order with no Hint button left under it.
        await page.goto('/g/lights');
        await shoot('hunt-hints-spent');
      } else {
        check('the hunt offers a hint to buy', false);
      }
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

      // `.thumb.`, not merely `/uploads/`. An <img> renders whether the src is the extracted
      // thumbnail or the full photo, so the looser check passed even while `exifThumbnail` was
      // returning null for every walk this repo ever ran (#102). Naming the thumbnail is what
      // makes this flow prove the EXIF path actually executed rather than that a picture appeared.
      const src = await page.attr('.shot img', 'src');
      check(`the thumbnail points at the upload (${src})`, String(src).startsWith('/uploads/'));
      check(`the EXIF thumbnail was really extracted (${src})`, String(src).includes('.thumb.'));

      await shoot('photo-sent');
    },
  },

  {
    name: 'riddle',
    what: 'walk the riddle hunt end to end, banking a step at a time',
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

      // STEP 1 SELLS TWO HINTS (#101), and this is bought LAST on purpose -- twice over.
      //
      // A hint is the only debit on this site, so buying one mid-walk silently poisons both
      // arithmetic checks above: the score they read is no longer the hunt's payout. That is the
      // "wrong pair of numbers" shape this map has been bitten by before, and the fix is ordering
      // rather than cleverness.
      //
      // It also buys a second check for free. Standing on the LAST step and asking for step 1's
      // hints is the per-step model's mirror of what the lights flow proves about the shared one:
      // there, the first press on the final step must still hand over hint one. Between the two
      // flows both shapes `hintsFor` supports are walked, which is what stops a step-keyed
      // sequence from quietly re-selling hint one forever.
      await page.goto(`/g/${HUNT}?step=1`);
      for (const press of [1, 2]) {
        if (!(await page.has('.btn--hint'))) {
          check(`step 1 offers hint ${press} to buy`, false);
          break;
        }
        await page.press('.btn--hint');
      }

      // Read the whole list rather than the last bubble: the ORDER is the thing under test, and a
      // sequence that re-sold hint one twice would leave a perfectly plausible page behind.
      const list = (await page.text('ul.stack--tight')) ?? '';
      const opener = list.search(/not empty now/i);
      const closer = list.search(/something of yours/i);

      check(`step 1 sells two hints (${await page.count('.bubble')} on the page)`, (await page.count('.bubble')) === 2);
      check(`the sequence walks forwards, not in place — "${list}"`, opener >= 0 && closer > opener);
      check('a spent sequence stops offering', !(await page.has('.btn--hint')));
      await shoot('hunt-step-1-hints');

      // The first reveal of a team's night is free and the next one is not, so a finished hunt
      // that bought both comes out one hint under the tile budget. This is the only place the
      // walk ever sees the score go DOWN, which is what "your score can go below zero" is
      // promising on /rules.
      await page.goto('/');
      const spent = Number(await page.text('.scorebar__num'));
      check(
        `the second hint is the night's only debit (${previous} -> ${spent})`,
        spent === previous - economy.hintCost,
      );
    },
  },

  {
    name: 'standings',
    what: 'walk all three standing colours on a real board with real rivals',
    async run({ page, shoot, check }) {
      // Rivals first, so the last cookie standing is ours. A rival only has to EXIST to be on the
      // board -- standings() reads every team -- so they stop at the door rather than walking
      // the whole wizard, which is three fewer questionnaires per run.
      const rivals = [];
      for (const who of ['Rival', 'Other', 'Third']) {
        await stopAtTheDoor(page, who);
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
      // award redirects to is /admin/controls, which has no scorebar to read: `Number(null)` is 0, which
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

  {
    name: 'ending',
    what: 'freeze the game, sit in the gap, then end the night',
    async run({ page, shoot, check }) {
      await onboard(page);

      // As a plain guest, BEFORE any admin cookie is in the jar. #76 opened /league to the admin
      // at any time, so a walker holding both cookies is the wrong one to ask whether the results
      // are being kept back -- it would be turned away by nothing and pass by accident.
      await page.goto('/league');
      check('while the game runs, /league turns a guest away', (await page.url()) === '/');
      check('a team mid-game gets no ending banner', !(await page.has('.banner')));

      // Both cookies at once. Not because a host is a team -- #76 settled that one host runs the
      // admin and does not play, and the other plays as an ordinary guest -- but because this flow
      // needs to press /admin AND look at a frozen team board, and one walker is cheaper than two.
      await page.goto(`/admin/key/${ADMIN_SECRET}`);
      check('the admin key lets us in', !(await page.url()).startsWith('/admin/key'));
      await shoot('admin-running');

      // Progress is the average team score over a perfect 100 (#94), and this is the only place
      // anything MOVES it. Checked here rather than in the scan flow because a scan unlocks a
      // tile and unlocking scores nothing -- so every other shot of HQ in this suite sits on 0%,
      // which is exactly how a number that never worked would also look.
      //
      // One team on 25 of a possible 100 is 25%. The arithmetic is stated in the check so a
      // future change to the roster's size fails loudly here rather than drifting quietly: add an
      // eleventh tile and the ceiling becomes 110, and this reads 23%.
      const [onlyTeam] = await readBoard(page);
      await award(page, onlyTeam.id, 25, 'a quarter of a perfect night');
      await page.goto('/admin');
      const scored = (await page.text('[data-live="hq-headline"]')) ?? '';
      check(`25 points on the only team reads as 25% (${scored})`, scored.includes('25%'));

      // The poller, end to end, and the one check in this suite that has to spend real time. Every
      // other #94 check proves a PART: that the endpoint serves, that it renders identically, that
      // the page is marked. None of them would fail if the interval never fired -- HQ would open
      // with correct numbers, freeze at them for five hours, and look exactly like a quiet party.
      //
      // So: move the score WITHOUT navigating, wait one tick, and read the DOM. `__stillHere` is
      // wiped by any reload, which is what separates "the poller swapped the fragment" from "the
      // <noscript> meta refresh reloaded the page" -- both would show the new number, and only one
      // of them is the thing being built.
      const polled = await page.evaluate(`
        window.__stillHere = true;
        return fetch('/admin/award', {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ team: '${onlyTeam.id}', points: '10', reason: 'the poller' }),
        })
          .then(() => new Promise((done) => setTimeout(done, ${LIVE_TICK_MS})))
          .then(() => JSON.stringify({
            reloaded: window.__stillHere !== true,
            headline: document.querySelector('[data-live="hq-headline"]').textContent,
          }))
      `);
      const live = JSON.parse(polled);
      check(`the poller moves HQ on its own (${live.headline.trim()})`, live.headline.includes('35%'));
      check('and does it without reloading the page', live.reloaded === false);

      // --- the first ending: the freeze ---------------------------------------------------
      await page.post('/admin/freeze', {});
      check('freezing lands back on the controls', (await page.url()) === '/admin/controls');
      check(
        'the controls now offer the end',
        await page.has('a[href="/admin/end"]'),
      );
      check('and offer to unfreeze', await page.has('form[action="/admin/unfreeze"]'));
      await shoot('admin-ended');

      await page.goto('/');
      const frozen = await page.text('.banner');
      check(`the locked board says why (${frozen})`, /pens down/i.test(frozen ?? ''));
      check('and the team keeps its tiles', (await page.count('.tile')) > 0);
      await shoot('board-frozen');

      await page.goto(`/g/${STARTER}`);
      check('a frozen game page carries the banner too', await page.has('.banner'));
      check('and its submit button is dead', await page.has('button[disabled]'));

      // A stale tab pressing submit anyway. It must come home, not jump the queue to the results.
      await page.post(`/g/${STARTER}/submit`, { body: 'too late' });
      check(
        'a late submission bounces back to its own game, not to the results',
        (await page.url()).startsWith(`/g/${STARTER}`),
      );

      // The whole of #77 in one check: the freeze must NOT publish the results. Asked of a guest
      // who has never held the admin cookie, which since #76 is the only walker the question means
      // anything to -- so the jar is emptied and a second team walks in to ask it.
      await page.clearCookies();
      await onboard(page);
      await page.goto('/league');
      check('a frozen game still does not publish the results to a guest', (await page.url()) === '/');
      check('and that guest is told the game is frozen', await page.has('.banner'));

      // --- the second ending: the publish -------------------------------------------------
      await page.goto(`/admin/key/${ADMIN_SECRET}`);
      await page.goto('/admin/end');
      check('the confirm page says it out loud', await page.has('form[action="/admin/end"]'));
      await shoot('end-confirm');

      await page.press('form[action="/admin/end"] button');
      check(
        'ending the night lands the host on the league',
        (await page.url()) === '/league',
      );
      await shoot('league');

      await page.goto('/');
      check(
        'the published board points a guest at the results',
        await page.has('a.btn[href="/league"]'),
      );
      await shoot('board-published');

      // Socially irreversible, and the site holds that line: the button is gone, and the route
      // underneath it refuses too.
      await page.goto('/admin/controls');
      check(
        'the controls stop offering to unfreeze',
        !(await page.has('form[action="/admin/unfreeze"]')),
      );
      await page.post('/admin/unfreeze', {});
      await page.goto('/league');
      check(
        'and a stale reopen cannot unpublish the results',
        (await page.url()) === '/league',
      );
    },
  },

  {
    name: 'menu',
    what: 'the menu bar, either side of the two endings, as a host and as a guest',
    async run({ page, shoot, check }) {
      // A guest first, because the whole claim of #76 is that a guest has NO bar for five hours.
      await onboard(page);
      await page.goto('/');
      check('a guest playing has no menu bar', !(await page.has('.navbar')));
      await shoot('guest-playing');

      // The other half of opening /league to the host: a guest typing it is still turned away,
      // so nothing comparative reaches the field mid-party (#8).
      await page.goto('/league');
      check('a guest is bounced off the rankings mid-party', (await page.url()) === '/');

      // The host, who has a bar from the first minute -- three words, because `league` is not
      // gated and `recap` and `shots` are.
      await page.goto(`/admin/key/${ADMIN_SECRET}`);
      await page.goto('/admin');
      check('the host has a menu bar all night', await page.has('.navbar'));
      check('HQ is the page the host is standing on', await page.has('.navbar__item--here'));
      check(
        'league is offered before the night ends too',
        await page.has('.navbar__item[href="/league"]'),
      );
      check('recap waits for the end', !(await page.has('.navbar__item[href="/recap"]')));
      await shoot('host-playing');

      await page.goto('/admin/court');
      check('court is a real page', (await page.url()) === '/admin/court');
      await shoot('host-court');

      // The rankings, mid-party, for the one person allowed to read them.
      await page.goto('/league');
      check('the host reads the rankings mid-party', (await page.url()) === '/league');
      await shoot('host-league-early');

      // The freeze is NOT the reveal (#77), and the bar has to agree: `recap` and `shots` belong
      // to the ended night, not to the gap before it.
      await page.post('/admin/freeze', {});
      await page.goto('/admin/controls');
      check(
        'the freeze alone does not open recap',
        !(await page.has('.navbar__item[href="/recap"]')),
      );

      // The publish. What the bar has been holding back arrives at once.
      await page.goto('/admin/end');
      await page.press('form[action="/admin/end"] button');
      check(
        'ending the night puts recap in the host bar',
        await page.has('.navbar__item[href="/recap"]'),
      );
      check('and shots', await page.has('.navbar__item[href="/shots"]'));
      await shoot('host-after-end');

      // Rivals with real numbers, because a board where every row reads `0` cannot show the one
      // thing `/league` is for. They stop at the door rather than walking the whole wizard -- a team
      // only has to EXIST to be on the board -- which is the standings flow's trick.
      for (const who of ['Rival', 'Other']) {
        await stopAtTheDoor(page, who);
      }

      await page.goto(`/admin/key/${ADMIN_SECRET}`);
      const rivals = await readBoard(page);
      for (const [index, points] of [90, 45].entries()) {
        await award(page, rivals[index].id, points, 'a rival with a real night');
      }

      // The host's own copy of that board, which is the LAST thing this flow checks before
      // dropping the admin cookie -- and the check is that it has no expanded row. `showLeague()`
      // passes a null `youId` for a host on purpose (#78): the walker holds both cookies at once,
      // and so does any phone that onboarded once during testing, so "a host is never a team"
      // (#76) is a fact about people and cannot be leaned on here. Without this check the page
      // renders a full-width gradient row in the middle of the board the hosts read the top three
      // off, and every other check on this page still passes.
      await page.goto('/league');
      check('the host board has no expanded row', !(await page.has('.league__row--you')));
      await shoot('host-league');

      // Back to being a guest, on the same published night.
      await page.clearCookies();
      await onboard(page);
      await page.goto('/');
      check('a guest gets a menu bar once the night has ended', await page.has('.navbar'));
      check(
        'and it points at their own tiles, not at HQ',
        await page.has('.navbar__item[href="/"]'),
      );
      check('a guest is never offered HQ', !(await page.has('.navbar__item[href="/admin"]')));
      await shoot('guest-after-end');

      // The reveal, and the only shot of it anyone gets: the two in the `ending` flow are the
      // host's board, which by design looks nothing like this one. A component photographed only
      // in the shape it works in is how `<a class="btn">` shipped broken site-wide (#66), and the
      // expanded row is this page's entire design -- so it is checked in words as well as shot.
      await page.goto('/league');
      check('a guest reads the league once it is published', (await page.url()) === '/league');
      check('and their own row is the expanded one', await page.has('.league__row--you'));
      check('which says so in words, not only in paint', await page.has('.league__flag'));
      check(
        'the winner is a different row, and a quieter one',
        !(await page.has('.league__row--first.league__row--you')),
      );
      await shoot('guest-league');

      await page.goto('/shots');
      check('shots is reachable by a guest once the night has ended', (await page.url()) === '/shots');
      await shoot('guest-shots');
    },
  },

  {
    name: 'shots',
    what: 'shoot two games, end the night, and walk the wall and the fullscreen viewer',
    async run({ page, shoot, check }) {
      // The wall is the one page on this site that is made of OTHER pages' output, so it can only
      // be walked by a team that has actually photographed something. The menu flow above proves
      // the route is reachable; this proves there is anything on it.
      await onboard(page, { members: ['Dieter', 'Anna'] });

      const scavenger = slugFor('scavenger');
      const portrait = slugFor('portrait');
      if (!scavenger || !portrait) return check('both photo games have codes to scan', false);

      // One labelled unit, so the wall's second filter has a prompt to find.
      await page.goto(`/q/${scavenger}`);
      await page.setFile('input[type="file"]', A_REAL_IMAGE);
      await page.submit('input[type="file"]');
      check('the scavenger took a photograph', (await page.count('.shot img')) > 0);

      // One anonymous unit WITH a quote, which is the only photograph on the site that carries a
      // sentence -- and the one thing the viewer's caption has to get right.
      const SAID = 'I only came for the dog, honestly.';
      await page.goto(`/q/${portrait}`);
      await page.setFile('input[type="file"]', A_REAL_IMAGE);
      await page.fillForm({ body: SAID });
      await page.submit('input[type="file"]');
      check('the portrait took a photograph and a sentence', (await page.count('.shot img')) > 0);

      // Mid-party, the wall is shut. #77's two presses are what open it, and only the second.
      await page.goto('/shots');
      check('a guest is turned away from the wall mid-party', (await page.url()) === '/');

      await page.goto(`/admin/key/${ADMIN_SECRET}`);
      await page.post('/admin/freeze', {});
      await page.goto('/admin/end');
      await page.press('form[action="/admin/end"] button');

      await page.goto('/shots');
      const cells = await page.count('.wall__cell');
      check(`the wall holds both photographs (${cells})`, cells === 2);
      check('and both selects are on it', (await page.count('.filters select')) === 2);
      await shoot('shots-wall');

      // A cell taps through to the viewer rather than at the bytes -- the difference #80 added
      // `download: false` to `shot()` for. A `download` here would hand the phone the viewer's
      // own HTML as a file.
      const href = String(await page.attr('.wall__cell a', 'href'));
      check(`a photograph opens the viewer (${href})`, href.startsWith('/shots/open?'));

      // The prompt filter, which is the whole reason the second select lists units and not games.
      await page.goto('/shots?prompt=portrait');
      check('filtering to one prompt narrows the wall', (await page.count('.wall__cell')) === 1);
      const filtered = String(await page.attr('.wall__cell a', 'href'));
      check('and the filter travels into the viewer', filtered.includes('prompt=portrait'));

      await page.goto(filtered.replace(/#.*$/, ''));
      check('the viewer is fullscreen, with no menu bar', !(await page.has('.navbar')));
      check('one panel, because the filter came with it', (await page.count('.viewer__panel')) === 1);
      // The handle is dealt, so the walk cannot know it -- only that the caption says one.
      const who = String(await page.text('.viewer__who'));
      check(`the caption says whose camera it was (${who})`, who.startsWith('shot by '));
      // The quote is NOT here, and that is the decision rather than an omission (#80): the ~65
      // sentences Portrait collects are the recap's material, and a wall nobody reads captions on
      // is where they would be spent. Asserting the absence is what stops a later session
      // "restoring" it as an obvious improvement.
      check('the sentence stays off the wall, for the recap', !(await page.has('.bubble')));
      check('and there is a way back to the wall', await page.has('.viewer__close'));
      await shoot('shots-viewer');
    },
  },

  {
    name: 'delete',
    what: "remove a team at the door, and check what it takes with it in somebody else's tile",
    async run({ page, shoot, check }) {
      // Three teams, because the interesting damage is never to the team being removed. THE DUD is
      // the pair who changed their minds; ANOTHER is the rest of the party, there so the survivor's
      // hand is not wiped to nothing; and the survivor is the stranger holding cards dealt out of
      // both. Onboarded in that order so the survivor's cookie is the live one.
      await onboard(page, { members: ['Dud', 'Dudder'] });
      const dudName = await page.text('.scorebar__name');

      await page.clearCookies();
      await onboard(page, { members: ['Otto', 'Odile'] });

      await page.clearCookies();
      await onboard(page, { members: ['Ann', 'Bram'] });
      const ourName = await page.text('.scorebar__name');

      // Deal the hand by opening the tile, which is the only thing that ever deals one.
      const slug = slugFor('guess-who');
      if (!slug) return check('guess-who has a code to scan', false);
      await page.goto(`/q/${slug}`);

      const dealt = await page.count('.units > li');
      check(`the survivor is dealt cards from both other teams (${dealt})`, dealt === 4);

      await page.goto(`/admin/key/${ADMIN_SECRET}`);
      const board = await readBoard(page);
      const dud = board.find((row) => row.name === dudName);
      check('the dud is on the board to begin with', Boolean(dud));
      if (!dud) return undefined;

      // The list. Its whole job is telling PENGUIN from PELICAN in a loud hall, so the check is on
      // the names of the two people rather than on the dealt handle.
      await page.goto('/admin/delete-team');
      check('every team is offered for removal', (await page.count('tbody tr')) === 3);
      check(
        'a row names the pair, not just their handle',
        ((await page.text('tbody')) ?? '').includes('Dud & Dudder'),
      );
      await shoot('delete-team-list');

      // The confirmation, which has to say the one cost the host cannot see from the room.
      await page.goto(`/admin/delete-team?team=${dud.id}`);
      const warning = (await page.text('.shell')) ?? '';
      check('the confirmation names the team being removed', warning.includes(dudName));
      check(
        'it counts the cards this press takes out of other hands',
        /2 Guess Who cards in other teams/.test(warning),
      );
      check('and it asks for no typed word', !(await page.has('input[type="text"]')));
      await shoot('delete-team-confirm');

      await page.press('form[action="/admin/delete-team"] button');
      check('the removal lands back on the list', (await page.url()).startsWith('/admin/delete-team'));
      check('which says who went', ((await page.text('.banner')) ?? '').includes(dudName));
      check('and is one team shorter', (await page.count('tbody tr')) === 2);
      await shoot('delete-team-done');

      check(
        'the dud is off the board',
        !(await readBoard(page)).some((row) => row.name === dudName),
      );

      // The invisible half, and the reason this is more than `delete from teams`: the stranger's
      // hand. Two cards pointed at people who no longer exist, and a hand that merely lost their
      // NAMES would still render two squares -- blank, counting against the ten, unfillable.
      await page.goto('/g/guess-who');
      const left = await page.count('.units > li');
      check(`the stranger's dead cards are taken back (4 -> ${left})`, left === 2);
      check(
        'and no blank square is left behind counting against them',
        (await page.count('.bubble p:empty')) === 0,
      );
      await shoot('delete-team-hand');

      // The phone. Deleting the team we are currently holding the cookie for is the door case run
      // to its end: the pair who changed their minds have to be able to register again, which is
      // the escape hatch #9 refused to build for a guest and this button deliberately opens for
      // the host.
      const us = (await readBoard(page)).find((row) => row.name === ourName);
      await page.goto(`/admin/delete-team?team=${us.id}`);
      await page.press('form[action="/admin/delete-team"] button');

      await page.goto('/');
      check("the removed team's phone starts over at the door", (await page.url()) === '/welcome');
      await shoot('delete-team-phone');
    },
  },

  {
    name: 'roster',
    what: 'play all ten tiles as one team, in a house that has other teams in it',
    async run({ page, shoot, check }) {
      // THE WHOLE ROSTER, IN ONE NIGHT, BY ONE TEAM. Every other flow above walks one mechanic:
      // an answer, a photograph, a hunt, the door. Each game was also built by its own session
      // against its own ticket, so until #82 nobody had held all ten at once -- and three of them
      // cannot be held alone at all, because they read the rest of the house (see lib/house.js).
      //
      // What this flow is for is the sentence "does it actually complete?": scan to unlock to
      // submit to scored, for every tile, with nothing on the path missing or stubbed. It is
      // deliberately shallow per game -- the depth is in the flows above -- and wide instead.
      const handles = await seedHouse(page, { check });
      const us = await arrive(page, US);
      check('and we are somebody too', Boolean(us) && !handles.includes(us));

      await page.goto(`/admin/key/${ADMIN_SECRET}`);
      const board = await readBoard(page);
      const mine = board.find((row) => row.name === us);
      check('the host board can see us among the house', Boolean(mine));

      await page.goto('/');
      const open = await page.text('.scorebar__open');
      check(`the night opens on the two starters (${open})`, /^2 of 10 open$/.test(open ?? ''));
      await shoot('board-arrived');

      // --- unlock everything a code can unlock ---------------------------------------------
      //
      // Written against the inventory rather than against a list of game ids, so a roster that
      // gains or loses a tile changes this flow by changing `content/codes.js` alone.
      const unlockable = [...new Set(Object.values(codes).filter((c) => c.game && !c.step).map((c) => c.game))];

      for (const gameId of unlockable) {
        const slug = slugFor(gameId);
        await page.goto(`/q/${slug}`);
        check(`${gameId}: its code opens it`, (await page.url()).startsWith(`/g/${gameId}`));
      }

      // --- the two hunts ---------------------------------------------------------------------
      //
      // A hunt is not unlocked by a code the way everything else is -- its first STEP is what
      // opens it -- so the "every tile is open" count below only comes true once both trails have
      // been walked. Getting that wrong is how this flow first reported 8 of 10.
      for (const gameId of ['riddle', 'lights']) {
        const trail = trailFor(gameId);
        check(`${gameId}: the trail is complete (${trail.length} steps)`, trail.length > 0);
        for (const slug of trail) await page.goto(`/q/${slug}`);

        await page.goto(`/g/${gameId}`);
        await shoot(`${gameId}-finished`);
      }

      await page.goto('/');
      const opened = await page.text('.scorebar__open');
      check(`every tile is open (${opened})`, /^10 of 10 open$/.test(opened ?? ''));

      // --- Sign Here: a real handle, and a forged one ------------------------------------------
      await page.goto('/g/bingo');
      await page.fillForm({ unit: '0', body: handles[0] });
      await page.submit();
      check(
        `a real handle signs the card (${handles[0]})`,
        (await page.count('.square--signed')) > 0 || (await page.text('.statusline'))?.includes('1'),
      );
      await shoot('bingo-signed');

      await page.goto('/g/bingo');
      await page.fillForm({ unit: '1', body: 'NOBODYHOLDSTHIS' });
      await page.submit();
      check('a word nobody holds is refused', Boolean(await page.text('.banner')));
      await shoot('bingo-forged');

      // --- Guess Who: the tile that cannot be played on an empty board -------------------------
      await page.goto('/g/guess-who');
      const cards = await page.count('.unit');
      check(`the house deals a full hand (${cards} cards)`, cards === 10);
      check('and every card offers the whole party to name', await page.has('select'));
      await page.fillForm();
      await page.submit();
      check('a hand of guesses saves', (await page.url()).startsWith('/g/guess-who'));
      await shoot('guess-who-guessed');

      // --- Herd Mentality: predict what the house said -----------------------------------------
      await page.goto('/g/herd');
      const fields = await page.count('input[type="text"]');
      check(`the harvest asks its five questions back (${fields})`, fields === 5);
      await page.fillForm(await predictions(page));
      await page.submit();
      check('the predictions save', (await page.url()).startsWith('/g/herd'));
      await shoot('herd-predicted');

      // --- the photo pair ----------------------------------------------------------------------
      check('there is a real image to send', existsSync(A_REAL_IMAGE));

      await page.goto('/g/portrait');
      await page.fillForm({ body: 'Marieke, who came for the dog' });
      await page.setFile('input[type="file"]', A_REAL_IMAGE);
      await page.submit('input[type="file"]');
      check('a portrait comes back as a thumbnail', (await page.count('.shot img')) > 0);
      await shoot('portrait-sent');

      await page.goto('/g/scavenger');
      await page.setFile('input[type="file"]', A_REAL_IMAGE);
      await page.submit('input[type="file"]');
      check('a scavenger photo comes back as a thumbnail', (await page.count('.shot img')) > 0);
      await shoot('scavenger-sent');

      // --- the Triangle Test, which gets one shot ----------------------------------------------
      await page.goto('/g/triangle');
      await page.fillForm();
      await page.submit();
      check('the Triangle Test answers back', Boolean(await page.text('.banner')));
      check('and closes its form for good', !(await page.has('form select')));

      // --- Longest yarn -------------------------------------------------------------------------
      // Shot BEFORE the claim goes in, because the untouched tile is the thing #100 argued about:
      // one box asking for centimetres, and no sentence anywhere on it about how to get one. That
      // silence is deliberate, so it is worth a picture -- a helpful line added here later would
      // show up as a diff in this shot rather than as nobody noticing.
      await page.goto('/g/yarn');
      await shoot('yarn-fresh');
      await page.fillForm({ body: '184' });
      await page.submit();
      check('a length is accepted', (await page.url()).startsWith('/g/yarn'));

      // --- Teddy, which no team can play ---------------------------------------------------------
      await page.goto('/g/teddy');
      check('the trophy holds no form', !(await page.has('form')));

      // The trophy's admin page is the ONLY way Teddy's ten points ever move, and until #82 nobody
      // had opened it: `trophyPanel()` read a `req` it was never passed, so it threw and the host
      // got the 500 page. What made that survivable for a whole build is how weakly it fails --
      // the error page is a real page, it carries the site's chrome, and every loose check ("is
      // there no gallery here?") passes against it. So this asks for the thing only the working
      // page has: a button that awards the trophy, and a team list with the whole house on it.
      await page.goto('/admin/game/teddy');
      const buttons = await page.count('form[action="/admin/trophy"] button');
      check(`the host gets a button per team (${buttons})`, buttons === HOUSE.length + 1);

      // Pressed in OUR row rather than in whichever row the list sorts first, because the point of
      // awarding it here is what the tile does about it on the board below.
      await page.press(`form[action="/admin/trophy"]:has(input[name="team"][value="${mine.id}"]) button`);
      check('awarding the trophy lands back on the trophy', (await page.url()).includes('teddy'));
      // The SECOND statusline — the first is the panel's standing explanation, which says nothing
      // about tonight and would pass this check on any page that renders at all.
      const holders = await page.text('.statusline + .statusline');
      check(`and the host can see who is holding it (${holders})`, /^1 team/.test(holders ?? ''));
      await shoot('teddy-awarded');

      // --- what the board says it all added up to -----------------------------------------------
      //
      // THE TILE IS READ AGAINST THE LEDGER, not against a number this flow worked out for itself.
      // A tile's job on the dashboard is to report what a team has scored in it, and a whole class
      // of games -- the two `trust` tiles and the signature card -- deliberately stays `unlocked`
      // until it is finished, so that its POINTS do the talking (CONTEXT.md, "Tile"). Which means
      // the one thing that has to be true is that a tile carrying points says so.
      await page.goto('/');
      await shoot('board-played');

      const played = await tilePoints(page);
      const scored = Number(await page.text('.scorebar__num'));
      check(`the night added up to something (${scored} points)`, scored > 0);

      // Every tile this flow has actually banked points in. The two hunts and the Triangle Test
      // are settled kinds and already say `+10 pts`; these four are the ones whose state machine
      // has somewhere to hide, and each is here because this flow paid it above:
      //   Sign Here            one square signed, 1 point (grid)
      //   Portrait / scavenger one photograph each, 1 point (trust)
      //   Teddy                the trophy, awarded to us by the host, 10 points
      const PAID = ['Sign Here', 'Portrait of a stranger', 'Photo scavenger', 'Teddy'];

      const silent = PAID.filter((title) => played[title] === 'not played');
      check(
        `a tile that has paid says so (${silent.join(', ') || 'all four do'})`,
        silent.length === 0,
      );

      // The trophy is the sharper half of the same rule and has its own sentence in CONTEXT.md:
      // a trophy holds no submissions, so "awarded" IS the verdict and the tile goes green.
      check(`an awarded trophy is a finished tile (Teddy: ${played.Teddy})`, played.Teddy === '+10 pts');
    },
  },
];

/**
 * What every tile on the dashboard says about itself: title -> its points line.
 *
 * Read off the rendered board rather than out of the database on purpose. The question this flow
 * asks is not "did the ledger get it right" -- `/league` and the ending flow settle that -- but
 * "does the thing a guest looks at agree with it".
 */
const tilePoints = async (page) =>
  JSON.parse(
    (await page.evaluate(
      `return JSON.stringify(Object.fromEntries([...document.querySelectorAll('.tile')].map((t) => [
         t.querySelector('.tile__title')?.textContent?.trim(),
         t.querySelector('.tile__pts')?.textContent?.trim(),
       ])))`,
    )) ?? '{}',
  );

/**
 * Herd's five prediction fields, filled with what the house actually said.
 *
 * The fields are named `<questionId>:` exactly as they are at the door, which is the point of a
 * harvest naming its questions by id rather than restating them (CONTEXT.md, "Harvest"). Predicting
 * the majority is what makes this flow prove the tile can PAY, rather than merely accept typing.
 */
async function predictions(page) {
  const names = JSON.parse(
    (await page.evaluate(
      `return JSON.stringify([...document.querySelectorAll('form [name]')].map((el) => el.name))`,
    )) ?? '[]',
  );

  const overrides = {};
  for (const name of names) {
    const answer = HERD_MAJORITY[name.replace(/:$/, '')];
    if (answer) overrides[name] = answer;
  }
  return overrides;
}

/** A tile every team has from the moment it exists, so the flow above needs no scan. */
const STARTER = 'yarn';

const BAND_CLASS = { podium: 'top', chasing: 'mid', rest: 'low' };

/**
 * Every team's id, name and score, read off the host's own board rather than out of the database.
 *
 * /admin is still #11's stub, which prints its data as JSON in a `<pre>` -- so the ids are on
 * screen, just not designed yet. When the real board lands this stops finding them, and it says
 * so in one sentence rather than failing as three confusing checks further down.
 */
/**
 * The board, which #79 moved off `/admin` and onto `/league` -- HQ is a dashboard now and prints
 * no team list at all. It printed JSON while it was a stub; #78 designed the real one, so this
 * reads the markup that replaced it.
 *
 * `data-team` and `data-score` per row are there FOR this function, which is why they are on the
 * element rather than being scraped out of the rank and points spans: the spans are copy and a
 * copy pass may reformat them, and a walker that breaks when a number gains a `pts` suffix is a
 * walker nobody trusts. The name is read from its own span because nothing else carries it.
 *
 * The host cookie is what makes this reachable before the night has ended (#77): a guest is
 * bounced to `/` until the second press, and the walker needs the numbers during the gap.
 */
async function readBoard(page) {
  await page.goto('/league');

  const rows = await page.evaluate(`
    return [...document.querySelectorAll('.league__row')].map((row) => ({
      id: Number(row.dataset.team),
      name: (row.querySelector('.league__name') || {}).textContent.trim(),
      score: Number(row.dataset.score),
    }));
  `);

  if (!rows.length) {
    throw new Error('/league printed no `.league__row` — teach readBoard() to read the real one');
  }

  return rows;
}

/**
 * Long enough for HQ's ten-second poll to have fired at least once, plus slack for the fetch and
 * the render. Deliberately not tuned close to the interval: the check it serves is "does the
 * poller run at all", and a flaky wait would read as "the live numbers are broken" every few runs
 * and get someone to delete the feature rather than the timing.
 */
const LIVE_TICK_MS = 13_000;

/** Move points, through the route the host's board will press once #11 renders it. */
const award = (page, teamId, points, reason) =>
  page.post('/admin/award', { team: teamId, points, reason });

// --- arguments -------------------------------------------------------------------------------

const argv = process.argv.slice(2);
const wanted = [];
let out = null;
let reducedMotion = false;
// The phone in dark mode, not a dark version of the site. Onboarding's nine fields are the reason
// this is here and not only on screenshot.js: the questionnaire is the most form-heavy surface on
// the site and it lives behind the door, so it is unreachable to a cold shot (#89).
let dark = false;

for (let i = 0; i < argv.length; i += 1) {
  const arg = argv[i];
  if (arg === '--reduced-motion') reducedMotion = true;
  else if (arg === '--dark') dark = true;
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
    { out: outDir, reducedMotion, dark, ...PHONE, env: { ADMIN_SECRET } },
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
