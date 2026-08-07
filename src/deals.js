// A **hand**: units dealt to one team rather than declared in content. Added for Guess Who (#22).
//
// Every other tally game's units are the same for everybody -- the scavenger's ten prompts are ten
// strings on disk. Guess Who's ten cards come out of what other guests answered at the door, so
// which ten a team holds is player data and lives in `deals`.
//
// ADR-game-content-lives-on-disk is intact. Content declares `hand: { size, fromLadder }` and
// receives its own cards back as plain facts; it never learns that a `deals` table exists, and the
// table never learns what a `ref` means.

import { hasHand, ladderRungs, listGames } from './content.js';
import { all, run, transact } from './db.js';
import { onboardingComplete } from './identity.js';

/**
 * Everyone whose answer is dealable to this team: a member of another team, who answered one of
 * the ladder's rungs, and whose team is **through the gate**.
 *
 * That last condition is not tidiness. A team mid-questionnaire has already written rows -- the
 * form saves what it has before bouncing them back for the blanks -- and a member who then taps
 * "ask me something else" has that answer DELETED, because a member holds exactly one rung. Deal
 * from a half-onboarded team and you can hand out a card whose answer disappears a minute later.
 * Waiting for the gate closes that window completely: after it, answers never change again.
 */
function poolFor(teamId, ladder) {
  const rungs = ladderRungs(ladder);
  if (!rungs.length) return [];

  const placeholders = rungs.map(() => '?').join(', ');
  const rows = all(
    `select m.id as member_id, m.team_id, m.name, pa.question_id, pa.value
       from members m
       join profile_answers pa on pa.member_id = m.id
      where m.team_id <> ?
        and pa.question_id in (${placeholders})
        and trim(pa.value) <> ''
      order by m.id`,
    teamId,
    ...rungs.map((rung) => rung.id),
  );

  const gate = new Map();
  return rows.filter((row) => {
    if (!gate.has(row.team_id)) gate.set(row.team_id, onboardingComplete(row.team_id));
    return gate.get(row.team_id);
  });
}

/** Fisher-Yates, in place. A hand has to be a different ten for each team or it is not a hand. */
function shuffle(items) {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

const dealtTo = (teamId, gameId) =>
  all('select * from deals where team_id = ? and game_id = ? order by unit', teamId, gameId);

/**
 * This team's hand, dealing or topping up on the way past.
 *
 * TOPPING UP is what makes the tile honest for whoever opens it first. The party's guests arrive in
 * one batch and onboard at the door, so by the time anyone is hunting for codes there are plenty of
 * answers -- but the very first team through can still find seven where ten are wanted, and a hand
 * frozen at seven would cap them at seven points for the night. So the deal fills whatever is
 * short, every time the tile is opened, until it holds `size`.
 *
 * A card already dealt is never re-dealt and never displaced: the unique index on (team, game, ref)
 * enforces the first, and topping up only ever appends units. A guess made at 21:00 cannot be taken
 * away by somebody arriving at 23:00.
 *
 * Returns `[{ unit, memberId, name, prompt, answer }]`, ordered by unit -- facts, which is all
 * content is ever handed.
 */
export function handFor(teamId, game) {
  const ladder = game.hand.fromLadder;
  const size = Number(game.hand.size);

  const pool = poolFor(teamId, ladder);
  const byMember = new Map(pool.map((row) => [row.member_id, row]));

  let dealt = dealtTo(teamId, game.id);

  if (dealt.length < size) {
    const held = new Set(dealt.map((row) => row.ref));
    const free = shuffle(pool.filter((row) => !held.has(row.member_id)));

    if (free.length) {
      transact(() => {
        let unit = dealt.length ? Math.max(...dealt.map((row) => row.unit)) + 1 : 0;
        for (const row of free.slice(0, size - dealt.length)) {
          run(
            'insert or ignore into deals (team_id, game_id, unit, ref) values (?, ?, ?, ?)',
            teamId,
            game.id,
            unit,
            row.member_id,
          );
          unit += 1;
        }
      });
      dealt = dealtTo(teamId, game.id);
    }
  }

  const rungs = ladderRungs(ladder);

  return dealt.map((row) => {
    const source = byMember.get(row.ref);
    const rung = rungs.find((candidate) => candidate.id === source?.question_id);
    return {
      unit: row.unit,
      memberId: row.ref,
      name: source?.name ?? null,
      prompt: rung?.card ?? '',
      answer: source?.value ?? '',
    };
  });
}

/**
 * Everyone a guess may name: every member of every other team through the gate, by id.
 *
 * It is deliberately the WHOLE party and not merely the ten people on your cards -- narrowing it to
 * the answer key would hand the game away, since the list itself would be the answer. It also grows
 * all night, which costs nothing: your cards were dealt from people who already existed, so the
 * right name is always in here, and a late arrival only ever adds a wrong one.
 */
export function namesFor(teamId) {
  const rows = all(
    'select id, team_id, name from members where team_id <> ? order by id',
    teamId,
  );

  const gate = new Map();
  return rows
    .filter((row) => {
      if (!gate.has(row.team_id)) gate.set(row.team_id, onboardingComplete(row.team_id));
      return gate.get(row.team_id);
    })
    .map((row) => ({ value: String(row.id), label: row.name }));
}

/**
 * What one member answered on the ladder, for every member -- the answer key, read once at game end
 * and handed to the resolver.
 */
export function ladderAnswers(ladder) {
  const rungs = ladderRungs(ladder);
  if (!rungs.length) return new Map();

  const placeholders = rungs.map(() => '?').join(', ');
  const rows = all(
    `select member_id, question_id, value from profile_answers
      where member_id is not null and question_id in (${placeholders}) and trim(value) <> ''`,
    ...rungs.map((rung) => rung.id),
  );

  return new Map(rows.map((row) => [row.member_id, row.value]));
}

/** Which member each of a team's units refers to, for the resolver. */
export function dealsByUnit(gameId) {
  const rows = all('select team_id, unit, ref from deals where game_id = ?', gameId);
  return new Map(rows.map((row) => [`${row.team_id}:${row.unit}`, row.ref]));
}

/** Every member's name by id, so a resolver can write "said Anna — it was Bram" into the ledger. */
export const memberNames = () =>
  new Map(all('select id, name from members').map((row) => [row.id, row.name]));

/**
 * Throw away every card, in anybody's hand, pointing at one of these members -- because they are
 * about to stop existing. Returns how many cards were taken back. See #87.
 *
 * This is the one piece of a team's removal that no foreign key can do, and that is by design
 * rather than by omission: `ref` is an OPAQUE integer the table refuses to interpret
 * (006-deals.sql), so a cascade off `members` cannot see it. The knowledge that a ref is a member
 * id lives in this module, because this module is what wrote the integer -- which is also why the
 * delete is scoped to the games that deal member ids instead of being a blanket sweep of `deals`.
 * A future game that deals something else keeps its cards.
 *
 * DROPPING is right, where leaving is wrong and repointing is impossible. `handFor` tops a hand up
 * to `size` every single time the tile is opened, so a stranger who loses a card here walks back
 * into a full ten and never learns anything happened. Leave the row instead and they hold a square
 * with no name, no prompt and no answer -- counting against their ten, unfillable, and raising no
 * error anywhere. The failure would surface in someone else's tile an hour after the press.
 *
 * THE GUESS GOES WITH THE CARD, which is the part that is not obvious. A guess is a submission row
 * keyed by unit, and units are handed out as `max(existing) + 1` -- so a hand that loses SOME of
 * its cards keeps counting upwards and a stale guess is merely invisible, but a hand that loses
 * ALL of them restarts at unit 0, and the next card dealt into that slot would come up wearing
 * somebody's old answer. Rare, silent, and three lines to make impossible.
 *
 * The LEDGER is deliberately not touched. Points are a ledger (docs/adr/points-are-a-ledger.md):
 * you do not un-pay a team at midnight because the host tidied the board. Guess Who resolves at
 * the freeze anyway, so at the hour this button is for there is nothing paid to argue about.
 */
export function forgetMembers(memberIds) {
  const gameIds = listGames().filter(hasHand).map((game) => game.id);
  if (!memberIds.length || !gameIds.length) return 0;

  const games = gameIds.map(() => '?').join(', ');
  const refs = memberIds.map(() => '?').join(', ');

  const doomed = all(
    `select team_id, game_id, unit from deals
      where game_id in (${games}) and ref in (${refs})`,
    ...gameIds,
    ...memberIds,
  );

  for (const card of doomed) {
    run(
      'delete from submissions where team_id = ? and game_id = ? and unit = ?',
      card.team_id,
      card.game_id,
      card.unit,
    );
    run(
      'delete from deals where team_id = ? and game_id = ? and unit = ?',
      card.team_id,
      card.game_id,
      card.unit,
    );
  }

  return doomed.length;
}
