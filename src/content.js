// The content half of the seam: everything authored lives in content/ and is loaded once at
// boot. The database never learns what games exist -- see
// docs/adr/0001-game-content-lives-on-disk.md.

import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import economy from '../content/economy.js';
import { CONTENT_DIR } from './config.js';
import { all } from './db.js';
import { fuzzyEquals } from './matching.js';

export const GAME_KINDS = ['answer', 'tally', 'hunt', 'trophy'];

/**
 * The kinds whose game page carries **no form**, and so can never hold a submission: a hunt
 * advances by walking to the next code, a trophy is handed over by the host. Stated once, as a
 * predicate, rather than spelled `kind !== 'hunt'` at each of the four places that ask -- which is
 * exactly how `trophy` would otherwise have quietly inherited a form.
 */
const FORMLESS = new Set(['hunt', 'trophy']);
export const takesForm = (game) => !FORMLESS.has(game.kind);

/** Six, where the fuzzy matcher's floor is five: one character of margin, deliberately. */
const MIN_TEAM_NAME = 6;

/** Declared in content; the two that need a human. `check` and `resolve` are derived, not declared. */
export const DECLARED_JUDGING = ['manual', 'trust'];

/**
 * How a game's submissions become points, which is the only thing the admin gallery needs to
 * know to decide what buttons a photo gets:
 *
 *   check    judged on submit by a pure function     -> gallery is read-only
 *   resolve  judged across every team at game end    -> gallery is read-only
 *   trust    points land on submit, no judging       -> gallery shows no buttons
 *   manual   the host judges each one in the gallery -> award / reject
 *
 * Defaulting to `manual` is deliberate: a game that forgot to say gets a human looking at it,
 * never silent free points.
 */
export function judgingMode(game) {
  if (game.judging) return game.judging;
  if (typeof game.check === 'function') return 'check';
  if (typeof game.resolve === 'function') return 'resolve';
  return 'manual';
}

/** Whether the game's form carries a file input. */
export const takesPhoto = (game) => Boolean(game.photo);

async function loadDirectory(name) {
  const dir = join(CONTENT_DIR, name);
  const entries = readdirSync(dir).filter((file) => file.endsWith('.js'));
  const loaded = [];

  for (const file of entries) {
    const module = await import(pathToFileURL(join(dir, file)).href);
    loaded.push(module.default);
  }

  return loaded;
}

const games = new Map();
const pages = new Map();
let codes = {};
let questions = [];
let teamNames = [];

export async function loadContent() {
  for (const game of await loadDirectory('games')) games.set(game.id, game);
  for (const page of await loadDirectory('pages')) pages.set(page.id, page);

  codes = (await import(pathToFileURL(join(CONTENT_DIR, 'codes.js')).href)).default;
  questions = (await import(pathToFileURL(join(CONTENT_DIR, 'questions.js')).href)).default;
  teamNames = (await import(pathToFileURL(join(CONTENT_DIR, 'team-names.js')).href)).default;

  validate();
  return { games, pages, codes, questions, teamNames };
}

export const listGames = () => [...games.values()];
export const getGame = (id) => games.get(id) ?? null;
export const getPage = (id) => pages.get(id) ?? null;
export const getCode = (slug) => codes[slug] ?? null;
export const listCodes = () => Object.entries(codes);

/**
 * A slug whose target content is not authored yet. The inventory of nineteen codes is settled and
 * printed from `content/codes.js`, but the games behind six of them are still being written -- so
 * a code is allowed to point at nothing, PROVIDED it says `pending: true` out loud. An unflagged
 * dangling target is still a boot error, because that one is a typo. See ADR-0010.
 */
export const isPending = (slug) => {
  const target = codes[slug];
  if (!target) return false;
  return target.game ? !games.has(target.game) : !pages.has(target.page);
};

/** Every code whose content is still missing, for the boot warning and for /admin/codes. */
export const listPendingCodes = () => listCodes().filter(([slug]) => isPending(slug));
export const listQuestions = () => questions;
export const listTeamNames = () => teamNames;

/**
 * Games every team has before they have found anything, unlocked during onboarding on top of
 * whatever code they arrived through. A game declares this itself rather than onboarding holding
 * a list, so the roster's two starters (Human Bingo, Longest yarn) start working the moment their
 * own tickets land their content, and nothing here changes. See #7 for the rule that put them
 * there: a tile starts open only if learning about it late is unrecoverable.
 */
export const listStarterGames = () => listGames().filter((game) => game.starter);

/** Hunt steps are 1-based in content and in the database. */
export const stepCount = (game) => (game.kind === 'hunt' ? game.steps.length : 0);
export const getStep = (game, step) => (game.kind === 'hunt' ? game.steps[step - 1] ?? null : null);

/** Hints for a game, or for one hunt step. `step` is 0 for non-hunt games. */
export function hintsFor(game, step = 0) {
  if (game.kind === 'hunt') return getStep(game, step)?.hints ?? [];
  return game.hints ?? [];
}

/** Every slug bound to a game, ordered by step. Hunts have many; other games have one. */
export function slugsForGame(gameId) {
  return listCodes()
    .filter(([, target]) => target.game === gameId)
    .sort((a, b) => (a[1].step ?? 1) - (b[1].step ?? 1));
}

/**
 * The slug bound to a page, or null. Gag pages have exactly one code each; `too-soon` and
 * `no-such-code` are rendered directly by the app and have none, which is why this may be null.
 *
 * It exists so a page can be told *about* its own scans without ever reaching for the database
 * itself -- `showPage` resolves the slug here and does the counting. See ADR-0001: content
 * describes the game, the database holds player data, and the two never mix.
 */
export function slugForPage(pageId) {
  return listCodes().find(([, target]) => target.page === pageId)?.[0] ?? null;
}

const QUESTION_SCOPES = ['team', 'member'];
const QUESTION_INPUTS = ['text', 'number', 'select'];

/**
 * A question id is a bare string in `profile_answers` with no foreign key (ADR-0001), so a
 * duplicate id silently makes two questions share one row and the second overwrite the first.
 * Cheap to check at boot, invisible at 21:00 with fourteen teams' answers already in the file.
 */
function questionProblems() {
  const problems = [];
  const seen = new Set();

  for (const question of questions) {
    if (!question.id) problems.push('a question has no id');
    else if (seen.has(question.id)) problems.push(`two questions share the id "${question.id}"`);
    else seen.add(question.id);

    if (!question.label) problems.push(`question "${question.id}" has no label`);
    if (!QUESTION_SCOPES.includes(question.scope)) {
      problems.push(`question "${question.id}" has scope "${question.scope}"`);
    }
    if (question.input && !QUESTION_INPUTS.includes(question.input)) {
      problems.push(`question "${question.id}" has unknown input "${question.input}"`);
    }
    if (question.input === 'select' && !question.options?.length) {
      problems.push(`question "${question.id}" is a select with no options`);
    }
  }

  return problems;
}

/**
 * The name pool has rules that only bite hours later, in someone else's game: a team name is also
 * the handle a stranger types into a Human Bingo square, matched FUZZILY. A word under five
 * characters gets an edit budget of zero and has to be typed perfectly; two words within each
 * other's budget are the same team as far as that square is concerned. Both are invisible while
 * writing the list and unfixable once the night has started, so they fail the boot.
 */
function teamNameProblems() {
  const problems = [];

  if (!teamNames.length) return ['content/team-names.js is empty; onboarding has nothing to deal'];

  for (const word of teamNames) {
    if (!/^[A-Z]+$/.test(word)) {
      problems.push(`team name "${word}" must be one word, A-Z only, no accents or spaces`);
    }
    if (word.length < MIN_TEAM_NAME) {
      problems.push(
        `team name "${word}" is shorter than ${MIN_TEAM_NAME}; a stranger would have to type it perfectly`,
      );
    }
  }

  for (let i = 0; i < teamNames.length; i += 1) {
    for (let j = i + 1; j < teamNames.length; j += 1) {
      if (fuzzyEquals(teamNames[i], teamNames[j])) {
        problems.push(`team names "${teamNames[i]}" and "${teamNames[j]}" are too alike to tell apart`);
      }
    }
  }

  return problems;
}

function validate() {
  const problems = [];

  for (const game of games.values()) {
    if (!GAME_KINDS.includes(game.kind)) {
      problems.push(`game "${game.id}" has unknown kind "${game.kind}"`);
    }
    if (game.kind === 'hunt' && !game.steps?.length) {
      problems.push(`hunt "${game.id}" has no steps`);
    }
    // Hunts bank per step, so the points live on the step and not on the game. A hunt that still
    // declares a single `points` is written against the old all-at-the-finish scheme.
    if (game.kind === 'hunt') {
      if (typeof game.points === 'number') {
        problems.push(`hunt "${game.id}" declares game-level points; hunts pay per step`);
      }
      for (const [index, step] of (game.steps ?? []).entries()) {
        if (typeof step.points !== 'number') {
          problems.push(`hunt "${game.id}" step ${index + 1} declares no points`);
        }
      }
      // Every tile is worth the same flat budget, so a perfect score is exactly 100. A hunt is
      // the one kind whose total is knowable at boot -- answer and tally games spend theirs
      // inside check/resolve, where only the ticket that wrote them can check the arithmetic.
      const budget = (game.steps ?? []).reduce((sum, step) => sum + (step.points ?? 0), 0);
      if (budget > economy.tilePoints) {
        problems.push(
          `hunt "${game.id}" pays ${budget} across its steps, over the ${economy.tilePoints}-point tile budget`,
        );
      }
    }

    // A trophy is an object in the house, awarded once by hand. Its worth has to be knowable at
    // boot for the same reason a hunt's is: the admin button has to print a number, and nothing
    // later in the night can work it out. It is also the whole tile, so it may not exceed one.
    if (game.kind === 'trophy') {
      if (typeof game.points !== 'number') {
        problems.push(`trophy "${game.id}" declares no points; the host's award button has none to give`);
      } else if (game.points > economy.tilePoints) {
        problems.push(
          `trophy "${game.id}" is worth ${game.points}, over the ${economy.tilePoints}-point tile budget`,
        );
      }
      if (game.judging || typeof game.check === 'function' || typeof game.resolve === 'function') {
        problems.push(
          `trophy "${game.id}" declares a judging mode or a check/resolve function; a trophy has ` +
            `no form, so there is never a submission to judge`,
        );
      }
      if (game.steps) problems.push(`trophy "${game.id}" declares steps; only hunts have them`);
    }

    if (game.judging && !DECLARED_JUDGING.includes(game.judging)) {
      problems.push(
        `game "${game.id}" declares judging "${game.judging}"; expected one of ${DECLARED_JUDGING.join(', ')}`,
      );
    }
    // Declaring both is a contradiction the gallery would have to guess at, so refuse at boot.
    if (game.judging && (typeof game.check === 'function' || typeof game.resolve === 'function')) {
      problems.push(
        `game "${game.id}" declares judging "${game.judging}" AND a check/resolve function`,
      );
    }
    if (game.photo && !takesForm(game)) {
      problems.push(`${game.kind} "${game.id}" takes a photo, but has no form to take it with`);
    }
    // A trust game pays on submit, so it needs to know what a submission is worth.
    if (judgingMode(game) === 'trust' && typeof game.points !== 'number') {
      problems.push(`game "${game.id}" is judged on trust but declares no points`);
    }
    // A hunt is unlocked by scanning its step 1, and a team holding an unlocked hunt they have
    // not started has reached step 0 -- a step that does not exist. Nothing to render.
    if (game.starter && game.kind === 'hunt') {
      problems.push(`hunt "${game.id}" is a starter, but a hunt has no step until it is scanned`);
    }
  }

  problems.push(...questionProblems(), ...teamNameProblems());

  // A code may point at content that does not exist YET, but only where the inventory admits it
  // with `pending: true`. Without the flag the same situation is a typo in a game id, and stays
  // fatal. `scripts/qr-sheet.js` refuses to print while any flag survives, so the tolerance can
  // never reach paper. See docs/adr/0010-codes-are-printed-from-the-inventory.md.
  const stale = [];

  for (const [slug, target] of Object.entries(codes)) {
    if (target.game) {
      const game = games.get(target.game);
      if (!game) {
        if (!target.pending) problems.push(`code "${slug}" points at unknown game "${target.game}"`);
        continue;
      }
      if (target.pending) stale.push(`${slug} (game "${target.game}" exists now)`);
      if (game.kind === 'hunt') {
        const step = target.step;
        if (!step || step < 1 || step > game.steps.length) {
          problems.push(`code "${slug}" has step ${step}, outside hunt "${game.id}"`);
        }
      }
    } else if (target.page) {
      if (!pages.has(target.page)) {
        if (!target.pending) problems.push(`code "${slug}" points at unknown page "${target.page}"`);
        continue;
      }
      if (target.pending) stale.push(`${slug} (page "${target.page}" exists now)`);
    } else {
      problems.push(`code "${slug}" names neither a game nor a page`);
    }
  }

  const pending = listPendingCodes();
  if (pending.length) {
    console.warn(
      `\n!! ${pending.length} QR CODE(S) POINT AT CONTENT THAT DOES NOT EXIST YET:` +
        `\n!!   ${pending.map(([slug, target]) => `${slug} -> ${target.game ?? target.page}`).join(', ')}` +
        `\n!! Scanning one shows a placeholder. \`node scripts/qr-sheet.js --check\` gates printing.\n`,
    );
  }
  if (stale.length) {
    console.warn(
      `\n!! STALE \`pending: true\` in content/codes.js -- the content landed, the flag did not:` +
        `\n!!   ${stale.join(', ')}` +
        `\n!! Delete the flag, or the sheet generator will keep refusing to print.\n`,
    );
  }

  // Every hunt step needs exactly one slug, or a team can never reach the end.
  for (const game of games.values()) {
    if (game.kind !== 'hunt') continue;
    const bound = new Set(slugsForGame(game.id).map(([, target]) => target.step));
    for (let step = 1; step <= game.steps.length; step += 1) {
      if (!bound.has(step)) problems.push(`hunt "${game.id}" step ${step} has no code`);
    }
  }

  if (problems.length) {
    throw new Error(`content is invalid:\n  - ${problems.join('\n  - ')}`);
  }
}

/**
 * The other half of the seam, checked the other way round: renaming a game id orphans its rows,
 * so shout at boot if the database refers to a game that content no longer defines.
 */
export function warnAboutOrphans() {
  const referenced = all(`
    select distinct game_id from unlocks
    union select distinct game_id from submissions
    union select distinct game_id from hint_reveals
    union select distinct game_id from awards where game_id is not null
  `);

  const orphans = referenced.map((row) => row.game_id).filter((id) => id && !games.has(id));

  if (orphans.length) {
    console.warn(
      `\n!! ORPHANED PLAYER DATA: the database refers to games that no longer exist in content:` +
        `\n!!   ${orphans.join(', ')}` +
        `\n!! Their points and submissions are stranded. Restore the id or migrate the rows.\n`,
    );
  }

  return orphans;
}
