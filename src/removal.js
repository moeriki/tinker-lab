// Unmaking one team, which until now could only be made. Settled in #87.
//
// It sits beside src/reset.js because they are the site's two destructive controls, but they are
// not the same kind of thing and the difference decides everything here. Reset is pressed once,
// before the party, against the whole night. THIS is pressed AT THE DOOR, against one team, while
// the queue is still in the hall -- Dieter's case in his own words: *"ppl will register. Change
// their minds. Switch teams up between ppl. Before they started."* Two guests registered as a
// pair, then decided they would rather be with somebody else.
//
// Which is why there is no snapshot here and no `data/deleted/` to restore from, where reset has
// both. At 20:10 a team is a dealt handle, two names and nine onboarding answers; there is nothing
// to file away, and building the machinery to file it would be building for an hour the host has
// said he will not press this at. What guards the button instead is the COUNT -- *"just so I know
// how much I'm voiding"* -- shown per team on the list and again on the confirmation page. If it
// says nothing, deleting is free. If it says something, that is the sentence that stops the thumb.
//
// THREE consequences worth naming, because two of them are invisible from the page:
//
// 1. **The handle goes back in the bag.** `dealTeamName` deals from words no live team holds, so
//    deleting PENGUIN makes PENGUIN dealable again. At the door that is right and even desirable
//    -- the pair re-register and may well get it back. It is only a problem after Human Bingo
//    cards exist, and this is not a tool for that hour.
//
// 2. **The phone starts over.** `currentTeam` returns null for a token matching no row, so the
//    cookie becomes inert and the next tap lands on `/welcome`. That is the *start over on this
//    phone* escape hatch #9 deliberately refused to build -- and here it is not a loophole but the
//    entire point, because a pair swapping partners cannot re-register on a phone that stays dead.
//    It is also host-gated: the only way through it is somebody pressing this button.
//
// 3. **Other teams' Guess Who cards** pointing at these members are taken back rather than left to
//    render as blank squares. src/deals.js owns that, and its `forgetMembers` explains why.
//
// What is NOT repaired, deliberately: a Human Bingo signature naming this handle stays on the
// stranger's card, with the points already banked. There is nothing to repair it to -- a signature
// is a word, not a reference -- and Dieter's steer covers it: *"in the end it's their choice. If
// it impacts other teams then we should accept that."* At the door there are no signatures anyway.

import { existsSync, unlinkSync } from 'node:fs';
import { basename, join } from 'node:path';

import { UPLOADS_DIR } from './config.js';
import { all, get, run, transact } from './db.js';
import { forgetMembers } from './deals.js';
import { onboardingComplete } from './identity.js';

/** Every team, with enough about each to be sure which one you are about to remove. */
export const removableTeams = () =>
  all('select id from teams order by name').map((row) => whatTeamHasDone(row.id));

/**
 * What removing this team would take with it, in the units the host cares about.
 *
 * The two guards against deleting the wrong team are both in here rather than in the page. The
 * first is `members`: handles are dealt animals, so a list of PENGUIN and PELICAN in a loud hall
 * is a coin toss, while *Ann & Bram* is not. The second is `onboarded` -- a team that never
 * finished the door questions is invisible to every pool by construction (src/deals.js drops them
 * from the corpus), so removing one costs the party literally nothing, and that is the likeliest
 * dud of the night. Saying so out loud turns the commonest press into an easy one.
 */
export function whatTeamHasDone(teamId) {
  const team = get('select * from teams where id = ?', teamId);
  if (!team) return null;

  const members = all(
    'select id, name from members where team_id = ? order by position',
    teamId,
  );

  const idle = get(
    "select cast((julianday('now') - julianday(last_seen_at)) * 1440 as integer) as idle " +
      'from teams where id = ?',
    teamId,
  );

  return {
    id: team.id,
    name: team.name,
    members: members.map((member) => member.name),
    onboarded: onboardingComplete(teamId),
    scans: get('select count(*) as n from scans where team_id = ?', teamId).n,
    submissions: get('select count(*) as n from submissions where team_id = ?', teamId).n,
    photos: get(
      'select count(*) as n from submissions where team_id = ? and photo_path is not null',
      teamId,
    ).n,
    points: get('select ifnull(sum(points), 0) as n from awards where team_id = ?', teamId).n,
    cards: cardsPointingAt(members.map((member) => member.id)),
    minutesIdle: Number(idle.idle),
  };
}

/**
 * How many cards in OTHER teams' hands name one of these people. The only number on the page that
 * is about somebody else's tile, which is exactly why it is on the page: it is the one cost of
 * this press that the host cannot see from the room.
 */
function cardsPointingAt(memberIds) {
  if (!memberIds.length) return 0;

  const refs = memberIds.map(() => '?').join(', ');
  return get(`select count(*) as n from deals where ref in (${refs})`, ...memberIds).n;
}

/**
 * Remove the team. Returns what went with it, for the page to say out loud, or null if it was
 * already gone -- a double-tap on a phone that showed nothing after the first press is ordinary,
 * and the second one should land on a calm page rather than an error.
 *
 * The row goes and every table follows it: members, profile answers, scans, unlocks, submissions,
 * hint reveals, awards and this team's own deals are all `on delete cascade` off `teams(id)`, so
 * the cascade is the removal and there is no list of tables here to fall out of date. Migration
 * 006 added `deals` long after the first six tables landed; a hand-written list would have quietly
 * stopped being complete that day. Same lesson as src/reset.js, learned in the same place.
 *
 * Photographs are player data that live on disk rather than in a row, so they go too -- leaving
 * them would put pictures belonging to nobody in `data/uploads`, which is the night's archive
 * (#25). They are unlinked AFTER the transaction commits, and that direction is chosen: a file
 * that will not delete leaves stray bytes behind an otherwise clean removal, where deleting first
 * and failing to commit would leave a live team whose photographs 404. It fails towards done.
 */
export function deleteTeam(teamId) {
  const team = get('select id, name from teams where id = ?', teamId);
  if (!team) return null;

  const files = all(
    'select photo_path, photo_thumb from submissions where team_id = ? and photo_path is not null',
    teamId,
  );
  const memberIds = all('select id from members where team_id = ?', teamId).map((row) => row.id);

  const cards = transact(() => {
    const taken = forgetMembers(memberIds);
    run('delete from teams where id = ?', team.id);
    return taken;
  });

  for (const row of files) {
    discard(row.photo_path);
    discard(row.photo_thumb);
  }

  return { name: team.name, cards, photos: files.length };
}

/**
 * One upload, gone. `basename` because a filename read back out of the database is still a string
 * this file is about to join onto a path -- the names are generated (src/photos.js) and cannot
 * contain a separator, and that is precisely the assumption worth not depending on here.
 */
function discard(filename) {
  if (!filename) return;

  const file = join(UPLOADS_DIR, basename(filename));
  if (existsSync(file)) unlinkSync(file);
}
