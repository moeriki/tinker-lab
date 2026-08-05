// The cookie IS the team. No accounts, no passwords, no join codes -- and no way back in: there
// is no sign-out, no rejoin and no recovery, because there is nothing to sign out of. One phone
// per team, carried by whichever member volunteers, and a charger in the hall. Settled in #9.

import { randomBytes } from 'node:crypto';

import { TEAM_COOKIE } from './config.js';
import { listStarterGames, listTeamNames, questionSlots } from './content.js';
import { all, get, run, transact } from './db.js';
import { parseCookies, setCookie } from './http.js';
import { unlock } from './progress.js';

export const newToken = () => randomBytes(16).toString('base64url');

/** The team behind this request, or null. Touches last_seen_at so the admin board shows life. */
export function currentTeam(req) {
  const token = parseCookies(req)[TEAM_COOKIE];
  if (!token) return null;

  const team = get('select * from teams where token = ?', token);
  if (!team) return null;

  run("update teams set last_seen_at = datetime('now') where id = ?", team.id);
  return team;
}

export const membersOf = (teamId) =>
  all('select * from members where team_id = ? order by position', teamId);

// --- the name ----------------------------------------------------------------------------------
//
// A team is DEALT its name rather than asked for one. That word is the team's display name and
// also the handle a stranger types into a Human Bingo square, so it has to be unique, speakable
// across a loud kitchen, and typeable by someone holding a drink. Dealing it buys all three, and
// removes the only validation error the first screen could otherwise have had.

const takenNames = () => new Set(all('select name from teams').map((row) => row.name));

/**
 * A free word, avoiding `except` so a reroll always visibly changes something.
 *
 * If the pool ever runs dry -- more teams than words, meaning a party twice the size this was
 * built for -- fall back to numbering rather than failing at the door. An ugly name is
 * recoverable; a guest who cannot get in is not.
 */
export function dealTeamName(except = null) {
  const taken = takenNames();
  const free = listTeamNames().filter((word) => !taken.has(word) && word !== except);

  if (free.length) return free[Math.floor(Math.random() * free.length)];

  const pool = listTeamNames();
  const base = pool[Math.floor(Math.random() * pool.length)];
  for (let suffix = 2; ; suffix += 1) {
    const candidate = `${base} ${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }
}

/** Whether a word is one this site would ever have dealt. Guards the form's hidden field. */
export const isDealtName = (name) =>
  listTeamNames().includes(name) || /^[A-Z]+ \d+$/.test(String(name ?? ''));

// --- creating a team ---------------------------------------------------------------------------

/**
 * Onboarding, first screen: a team plus one row per member, so member-scoped questions have
 * subjects to be asked about. Starter games are unlocked in the same transaction, so a team is
 * never briefly nameless, memberless or empty-handed.
 *
 * Retries on a name collision rather than showing an error. The only way to get one is two guests
 * finishing this screen in the same second -- both dealt from the same free pool before either
 * has inserted -- the unique index catches it, and dealing again costs nothing. Neither team ever
 * learns it happened.
 */
export function createTeam({ name, memberNames }) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = attempt === 0 ? name : dealTeamName(name);

    try {
      return transact(() => insertTeam(candidate, memberNames));
    } catch (error) {
      if (!String(error.message).includes('teams_name_unique')) throw error;
    }
  }

  throw new Error('could not find a free team name after five attempts');
}

function insertTeam(name, memberNames) {
  const token = newToken();
  const { lastInsertRowid } = run('insert into teams (token, name) values (?, ?)', token, name);
  const teamId = Number(lastInsertRowid);

  memberNames
    .map((memberName) => memberName.trim())
    .filter(Boolean)
    .forEach((memberName, index) => {
      run(
        'insert into members (team_id, name, position) values (?, ?, ?)',
        teamId,
        memberName,
        index + 1,
      );
    });

  // Open before they have found anything. WHICH games these are is declared by the games
  // themselves and never listed here -- see listStarterGames().
  for (const game of listStarterGames()) unlock(teamId, game.id);

  return get('select * from teams where id = ?', teamId);
}

// --- the gate ----------------------------------------------------------------------------------

/** Every answer this team has actually given, as `questionId:memberId` (team answers end in `:`). */
const answeredKeys = (teamId) =>
  new Set(
    all(
      "select member_id, question_id from profile_answers where team_id = ? and trim(value) <> ''",
      teamId,
    ).map((row) => `${row.question_id}:${row.member_id ?? ''}`),
  );

/**
 * Onboarding is a gate, and this is the definition of being through it. A team exists after the
 * first screen but still owes five team answers and one per member; until those are in, every
 * team-facing route sends them back. Otherwise a team that closed the tab mid-questionnaire plays
 * all night while Herd Mentality counts a corpus with holes in it -- and the holes belong to
 * everyone's tile, not just theirs. Settled in #9.
 *
 * It asks per SLOT rather than counting rows, which is what a ladder needs (#22): the five Guess
 * Who rungs are one slot and any one of them satisfies it. Counting rows against a total would
 * demand all five from every member -- the exact opposite of a ladder -- and would also let a
 * member who answered two rungs mask somebody else's blank.
 */
export function onboardingComplete(teamId) {
  const slots = questionSlots();
  if (!slots.length) return true;

  const answered = answeredKeys(teamId);
  const memberIds = membersOf(teamId).map((member) => member.id);

  for (const slot of slots) {
    const subjects = slot.scope === 'member' ? memberIds : [null];
    for (const subject of subjects) {
      const satisfied = slot.rungs.some((rung) => answered.has(`${rung.id}:${subject ?? ''}`));
      if (!satisfied) return false;
    }
  }

  return true;
}

export const attachTeam = (res, team) => setCookie(res, TEAM_COOKIE, team.token);
