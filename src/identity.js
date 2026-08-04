// The cookie IS the team. No accounts, no passwords, no join codes.

import { randomBytes } from 'node:crypto';

import { TEAM_COOKIE } from './config.js';
import { all, get, run, transact } from './db.js';
import { parseCookies, setCookie } from './http.js';

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

/** Onboarding: a team name plus one row per member, so member-scoped questions have subjects. */
export function createTeam({ name, memberNames }) {
  const token = newToken();

  return transact(() => {
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

    return get('select * from teams where id = ?', teamId);
  });
}

export const attachTeam = (res, team) => setCookie(res, TEAM_COOKIE, team.token);
