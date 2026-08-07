// The dev build. Everything switched on by `NODE_ENV=development` lives in this one file, so
// production reads as one import and one `if` rather than as a flag threaded through the app.
// Settled in #62.
//
// What it buys: open the site on a laptop and you are already a team, through the questionnaire,
// with every tile unlocked and the admin board one tap away. Before this, testing any change
// meant walking nine onboarding fields and then tapping nineteen slugs out of /admin/codes --
// again after every database wipe, which is the part that made it a tax rather than a chore.
//
// What it must never buy: any of that on the night. The routes below are appended to the
// inventory only when IS_DEV, so on a production container they do not exist to be found -- not
// 403, not hidden, absent. And IS_DEV is an EXPLICIT equality (see config.js), so a deployment
// that loses its env file locks up like the real site instead of opening every game to everyone.

import { DEV_OUT_COOKIE, ADMIN_COOKIE, ADMIN_SECRET, IS_DEV, TEAM_COOKIE } from './config.js';
import { listGames, questionSlots, slugsForGame } from './content.js';
import { get, run, transact } from './db.js';
import { clearCookie, parseCookies, redirect, route, setCookie } from './http.js';
import { unlock } from './progress.js';

/**
 * The team is found by NAME rather than by a marker column, because the schema is player data and
 * a dev harness has no business adding a column to it. The name is outside `content/team-names.js`
 * on purpose: `dealTeamName` only ever hands out pool words, so nothing this file inserts can
 * collide with a name a real onboarding would deal.
 */
const TEST_TEAM_NAME = 'TEST TEAM';

/**
 * Fixed rather than random, and that is the feature: wipe the database, reboot, and the cookie
 * already in the browser still points at the freshly seeded team. Otherwise every wipe would cost
 * a manual re-login, which is most of what this ticket set out to delete.
 */
const TEST_TEAM_TOKEN = 'dev-test-team';

const TEST_MEMBERS = ['Dev', 'Tester'];

/**
 * Which way the toggle on `/admin/controls` is pointing (#96). The two `/dev/*` routes are one
 * switch with two ends, and the page drawing it has a request in hand -- so it draws the end you
 * are not standing on rather than both. `devBar()` showed both because `layout()` had no request
 * to ask; that constraint left with it.
 *
 * By token rather than by name: the token is what `devAttach()` plants and what a cookie carries,
 * and a team that walked real onboarding can never hold this one.
 */
export const isTestTeam = (team) => team?.token === TEST_TEAM_TOKEN;

/**
 * Plausible one-word answers, cycled. They exist only so the gate opens and the pages that read
 * profile answers -- Guess Who's deck, Herd Mentality's corpus -- have something to draw rather
 * than a blank. With one team on the board neither game is meaningfully playable anyway; that is
 * what makes "just the test team" the right seed and a fabricated field of rivals the wrong one.
 */
const FILLER = [
  'pizza',
  'otter',
  'midnight',
  'kettle',
  'ketchup',
  'astronaut',
  'balloon',
  'trombone',
  'cactus',
  'lighthouse',
];

/** The test team, seeding it if this is the first boot against a fresh database. */
export function testTeam() {
  const existing = get('select * from teams where token = ?', TEST_TEAM_TOKEN);
  if (existing) return existing;
  return transact(seed);
}

function seed() {
  const { lastInsertRowid } = run(
    'insert into teams (token, name) values (?, ?)',
    TEST_TEAM_TOKEN,
    TEST_TEAM_NAME,
  );
  const teamId = Number(lastInsertRowid);

  const members = TEST_MEMBERS.map((name, index) => {
    const inserted = run(
      'insert into members (team_id, name, position) values (?, ?, ?)',
      teamId,
      name,
      index + 1,
    );
    return { id: Number(inserted.lastInsertRowid), name };
  });

  answerEverything(teamId, members);
  openEverything(teamId);

  return get('select * from teams where id = ?', teamId);
}

/**
 * Through the gate. `onboardingComplete` asks per SLOT and is satisfied by any ONE rung of a
 * ladder, so this answers the first rung and nothing else -- the same shape a real team produces,
 * rather than every rung filled, which no real team can be.
 */
function answerEverything(teamId, members) {
  let n = 0;

  for (const slot of questionSlots()) {
    const question = slot.rungs[0];
    const subjects = slot.scope === 'member' ? members.map((member) => member.id) : [null];

    for (const subject of subjects) {
      run(
        `insert into profile_answers (team_id, member_id, question_id, value) values (?, ?, ?, ?)`,
        teamId,
        subject,
        question.id,
        FILLER[n % FILLER.length],
      );
      n += 1;
    }
  }
}

/**
 * Every tile open. A hunt gets an accepted scan of its first step rather than a bare unlock row,
 * because a hunt tile has no honest "unlocked" state without one: `/g/:id` clamps to the step you
 * have reached, so a hunt unlocked at step 0 renders "Step 0 of 4" over an empty frame. One scan
 * is exactly what a team who found the first card would have, and it leaves the tile `unlocked`
 * rather than green -- which is what "nothing played" is supposed to look like.
 */
function openEverything(teamId) {
  for (const game of listGames()) {
    unlock(teamId, game.id);
    if (game.kind !== 'hunt') continue;

    const [slug] = slugsForGame(game.id).find(([, target]) => target.step === 1) ?? [];
    if (slug) run('insert into scans (team_id, slug, accepted) values (?, ?, 1)', teamId, slug);
  }
}

/** Said at boot so the first line of the log admits which build this is. */
export function announceDevBuild() {
  if (!IS_DEV) return;
  const team = testTeam();
  console.log(`DEV BUILD — logged in as ${team.name}, every tile unlocked, /admin open.`);
}

/**
 * Who you are, before routing. Handing the browser the test team's cookie is only half of it: the
 * request being routed right now was parsed from headers that do not have it yet, so `Set-Cookie`
 * alone would bounce this first load to /welcome and only work from the second. So the token goes
 * into the request's own header too, and the page you asked for is the page you get.
 *
 * The admin cookie rides along, because "back and forth between dashboard and admin" is one of the
 * four things this ticket asked for and a key in the URL is not back and forth.
 *
 * `DEV_OUT_COOKIE` is what makes logging out stick. Without it, dropping the team cookie would be
 * undone by this function on the very next request and real onboarding could never be reached.
 */
export function devAttach(req, res) {
  const jar = parseCookies(req);

  if (!jar[ADMIN_COOKIE]) {
    setCookie(res, ADMIN_COOKIE, ADMIN_SECRET);
    req.headers.cookie = withCookie(req.headers.cookie, ADMIN_COOKIE, ADMIN_SECRET);
  }

  if (jar[TEAM_COOKIE] || jar[DEV_OUT_COOKIE]) return;

  const team = testTeam();
  setCookie(res, TEAM_COOKIE, team.token);
  req.headers.cookie = withCookie(req.headers.cookie, TEAM_COOKIE, team.token);
}

const withCookie = (header, name, value) =>
  `${header ? `${header}; ` : ''}${name}=${encodeURIComponent(value)}`;

/**
 * Out of the test team and back to the front door, so onboarding can be walked for real. Not a
 * sign-out: CONTEXT.md settled that this site has none, and #9 settled why. This is a dev harness
 * dropping a cookie it planted itself, which is why it lives here and not on any page a guest
 * will ever load.
 */
const devLogout = ({ res }) => {
  clearCookie(res, TEAM_COOKIE);
  setCookie(res, DEV_OUT_COOKIE, '1');
  return redirect(res, '/welcome');
};

/** Back in, abandoning whatever team the walk-through created. */
const devLogin = ({ res }) => {
  clearCookie(res, DEV_OUT_COOKIE);
  setCookie(res, TEAM_COOKIE, testTeam().token);
  return redirect(res, '/');
};

/** Appended to the route inventory only when IS_DEV. On the night these paths are 404s. */
export const devRoutes = IS_DEV
  ? [route('GET', '/dev/logout', devLogout), route('GET', '/dev/login', devLogin)]
  : [];
