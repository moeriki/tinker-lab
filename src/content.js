// The content half of the seam: everything authored lives in content/ and is loaded once at
// boot. The database never learns what games exist -- see
// docs/adr/0001-game-content-lives-on-disk.md.

import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { CONTENT_DIR } from './config.js';
import { all } from './db.js';

export const GAME_KINDS = ['answer', 'tally', 'hunt'];

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

export async function loadContent() {
  for (const game of await loadDirectory('games')) games.set(game.id, game);
  for (const page of await loadDirectory('pages')) pages.set(page.id, page);

  codes = (await import(pathToFileURL(join(CONTENT_DIR, 'codes.js')).href)).default;
  questions = (await import(pathToFileURL(join(CONTENT_DIR, 'questions.js')).href)).default;

  validate();
  return { games, pages, codes, questions };
}

export const listGames = () => [...games.values()];
export const getGame = (id) => games.get(id) ?? null;
export const getPage = (id) => pages.get(id) ?? null;
export const getCode = (slug) => codes[slug] ?? null;
export const listCodes = () => Object.entries(codes);
export const listQuestions = () => questions;

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

function validate() {
  const problems = [];

  for (const game of games.values()) {
    if (!GAME_KINDS.includes(game.kind)) {
      problems.push(`game "${game.id}" has unknown kind "${game.kind}"`);
    }
    if (game.kind === 'hunt' && !game.steps?.length) {
      problems.push(`hunt "${game.id}" has no steps`);
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
    if (game.photo && game.kind === 'hunt') {
      problems.push(`hunt "${game.id}" takes a photo, but hunts have no form`);
    }
    // A trust game pays on submit, so it needs to know what a submission is worth.
    if (judgingMode(game) === 'trust' && typeof game.points !== 'number') {
      problems.push(`game "${game.id}" is judged on trust but declares no points`);
    }
  }

  for (const [slug, target] of Object.entries(codes)) {
    if (target.game) {
      const game = games.get(target.game);
      if (!game) {
        problems.push(`code "${slug}" points at unknown game "${target.game}"`);
        continue;
      }
      if (game.kind === 'hunt') {
        const step = target.step;
        if (!step || step < 1 || step > game.steps.length) {
          problems.push(`code "${slug}" has step ${step}, outside hunt "${game.id}"`);
        }
      }
    } else if (target.page) {
      if (!pages.has(target.page)) {
        problems.push(`code "${slug}" points at unknown page "${target.page}"`);
      }
    } else {
      problems.push(`code "${slug}" names neither a game nor a page`);
    }
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
