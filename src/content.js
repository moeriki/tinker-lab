// The content half of the seam: everything authored lives in content/ and is loaded once at
// boot. The database never learns what games exist -- see
// docs/adr/game-content-lives-on-disk.md.

import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import economy from '../content/economy.js';
import { CONTENT_DIR, PUBLIC_DIR } from './config.js';
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

/**
 * Hero assets that content names but `public/` does not have, resolved once at boot rather than
 * stat-ing the disk on every page render. A game page asks this to decide between an `<img>` and
 * the style kit's placeholder frame.
 */
const missingAssets = new Set();
export const assetIsPresent = (asset) => Boolean(asset) && !missingAssets.has(asset);

/**
 * Whether a photo alone is not enough. Portrait of a stranger is the only game that asks for
 * both -- its quote is the mechanic, not a caption -- so a photo-only submission there has to
 * bounce rather than bank a point for a picture with nothing said in it.
 */
export const requiresBody = (game) => Boolean(game.requiresBody);

/**
 * A tally game's **units**: the countable things it pays for, declared in content as either
 *
 *   units: 10                  ten anonymous slots      (Portrait of a stranger)
 *   units: ['a thing', ...]    labelled prompts         (the photo scavenger)
 *
 * The point of the concept is that the unit -- not the submission -- is what the ledger keys on.
 * `awards` is unique on (team, game, kind, source_id), so writing the unit index into
 * `source_id` makes a retake upsert the row it already wrote and pay nothing, with no cap check
 * and no delete anywhere. Every photo is still stored; only the second point is refused.
 *
 * Returns 0 for a game that declares none, which is every other kind on the roster.
 */
export function unitCount(game) {
  // A dealt hand IS the unit list, so its size is the count and declaring `units` as well would be
  // two numbers that can disagree. See `handSize` for what a hand is.
  if (game.hand) return handSize(game);
  // A harvest is the same argument: the questions ARE the units, so their number is the count.
  if (game.harvest) return harvestIds(game).length;
  if (typeof game.units === 'number') return game.units;
  return Array.isArray(game.units) ? game.units.length : 0;
}

/**
 * A **harvest**: units that are questions already asked at the door.
 *
 * Herd Mentality's five units are the five one-word questions in `content/questions.js`, and it
 * names them by id rather than restating their wording:
 *
 *   harvest: ['herd-pizza', 'herd-fridge', ...]
 *
 * so the question a guest is asked at 20:00 and the question they are asked to predict at 23:00
 * are the same string, and cannot drift apart. The index into this list is the unit.
 *
 * The contrast with a `hand` is worth keeping straight: a hand is units that differ PER TEAM and so
 * cannot live in content at all, while a harvest is identical for everybody and lives in content
 * already -- just in the questionnaire rather than in the game.
 */
export const hasHarvest = (game) => Array.isArray(game.harvest);
export const harvestIds = (game) => (Array.isArray(game.harvest) ? game.harvest : []);

/** The questions behind a harvest, in unit order. A named question that does not exist is null. */
export const harvestQuestions = (game) => harvestIds(game).map((id) => getQuestion(id));

/**
 * A **hand**: units that are not the same for every team.
 *
 * Every other tally game's units are content -- the scavenger's ten prompts are ten strings on
 * disk, identical for everybody, so nothing about them is player data. Guess Who's ten cards are
 * drawn per team out of what other guests answered at the door, so they cannot be. A game declares
 *
 *   hand: { size: 10, fromLadder: 'guess-who' }
 *
 * and the engine deals it (src/deals.js), tops it up, and hands the game its own cards back as
 * facts. Content never opens the database -- ADR-game-content-lives-on-disk -- so a game with a
 * hand still knows nothing about how one is stored.
 */
export const hasHand = (game) => Boolean(game.hand);
export const handSize = (game) => Number(game.hand?.size ?? 0);

/**
 * The prompts, where the units are labelled. Anonymous units have none, and that is not a lack.
 *
 * A harvest's labels are the questions themselves, read through `content/questions.js` rather than
 * restated in the game -- so anything that prints a unit prints what the guest was actually asked.
 */
export const unitLabels = (game) =>
  hasHarvest(game)
    ? harvestQuestions(game).map((question, index) => question?.label ?? `question ${index + 1}`)
    : Array.isArray(game.units)
      ? game.units
      : [];

/** The label for one unit, or null where the units are anonymous or the index is out of range. */
export const unitLabel = (game, unit) => unitLabels(game)[unit] ?? null;

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
 * dangling target is still a boot error, because that one is a typo. See
 * ADR-codes-are-printed-from-the-inventory.
 */
export const isPending = (slug) => {
  const target = codes[slug];
  if (!target) return false;
  return target.game ? !games.has(target.game) : !pages.has(target.page);
};

/** Every code whose content is still missing, for the boot warning and for /admin/codes. */
export const listPendingCodes = () => listCodes().filter(([slug]) => isPending(slug));
export const listQuestions = () => questions;
export const getQuestion = (id) => questions.find((question) => question.id === id) ?? null;
export const listTeamNames = () => teamNames;

// --- ladders ------------------------------------------------------------------------------------
//
// A **ladder** is several questions sharing one `ladder` id, of which a subject answers exactly
// ONE. Onboarding shows the first rung; "ask me something else" walks down the list; the last rung
// has no skip under it.
//
// It exists because rung 1 of the Guess Who ladder is a memory question, and a person who cannot
// remember what they wanted to be has nothing to type into a required field. Without a ladder the
// options were a worse question or a hole in the deck.
//
// A ladder is ONE SLOT at the gate, not five. That is the only thing the rest of the site has to
// know about it -- see `questionSlots`, which is what onboarding counts.

/** The rungs of one ladder, in file order, which is the order skipping walks. */
export const ladderRungs = (ladder) => questions.filter((question) => question.ladder === ladder);

/** Every ladder id, in the order its first rung appears. */
export const listLadders = () => [
  ...new Set(questions.filter((question) => question.ladder).map((question) => question.ladder)),
];

/**
 * What onboarding actually owes: one entry per answer a team has to produce, where a whole ladder
 * collapses to a single slot however many rungs it has.
 *
 * Counting question ROWS instead of slots is the bug this exists to prevent -- it would make the
 * gate demand all five Guess Who rungs from every member, which is the opposite of a ladder.
 */
export function questionSlots() {
  const slots = [];
  const seen = new Set();

  for (const question of questions) {
    if (!question.ladder) {
      slots.push({ id: question.id, scope: question.scope, rungs: [question] });
      continue;
    }
    if (seen.has(question.ladder)) continue;
    seen.add(question.ladder);
    slots.push({
      id: question.ladder,
      scope: question.scope,
      rungs: ladderRungs(question.ladder),
    });
  }

  return slots;
}

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
 * itself -- `showPage` resolves the slug here and does the counting. See
 * ADR-game-content-lives-on-disk: content describes the game, the database holds player data,
 * and the two never mix.
 */
export function slugForPage(pageId) {
  return listCodes().find(([, target]) => target.page === pageId)?.[0] ?? null;
}

const QUESTION_SCOPES = ['team', 'member'];
const QUESTION_INPUTS = ['text', 'number', 'select'];

/**
 * A question id is a bare string in `profile_answers` with no foreign key
 * (ADR-game-content-lives-on-disk), so a duplicate id silently makes two questions share one
 * row and the second overwrite the first. Cheap to check at boot, invisible at 21:00 with
 * fourteen teams' answers already in the file.
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
    // A rung's `card` is the only words a Guess Who card wears above the answer. Without one the
    // card reads "a purple Fiat Panda" with nothing saying what question that answered, which is
    // not a puzzle -- it is a fragment.
    if (question.ladder && !question.card) {
      problems.push(`ladder rung "${question.id}" has no \`card\`; a dealt card needs its prompt`);
    }
  }

  // A ladder's rungs are alternatives to each other, so they have to be interchangeable. Differing
  // scopes would mean the gate owes a different number of answers depending on which rung a person
  // stopped at, which is not a thing the gate can express.
  for (const ladder of listLadders()) {
    const rungs = ladderRungs(ladder);
    if (rungs.length < 2) {
      problems.push(`ladder "${ladder}" has one rung; that is a question wearing a costume`);
    }
    if (new Set(rungs.map((rung) => rung.scope)).size > 1) {
      problems.push(`ladder "${ladder}" mixes scopes across its rungs; they must be interchangeable`);
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

  // Games that admit, in their own words, that something in them is still a hole -- the day-of
  // numbers in `yarn`, most obviously. Same bargain as `pending: true` on a code: the site comes
  // up, the page degrades honestly, and the log will not let you forget.
  const unfinished = [];

  missingAssets.clear();

  for (const game of games.values()) {
    if (!GAME_KINDS.includes(game.kind)) {
      problems.push(`game "${game.id}" has unknown kind "${game.kind}"`);
    }

    for (const hole of game.unfinished?.() ?? []) unfinished.push(`${game.id}: ${hole}`);

    // A hero asset is a path under public/, served by the /img/ static route. An absent file is a
    // warning and not a boot error, so a photograph can arrive after the code that shows it --
    // but a path that could never resolve is a typo, and stays fatal.
    const asset = game.hero?.asset;
    if (asset) {
      if (!asset.startsWith('/')) {
        problems.push(`game "${game.id}" has hero asset "${asset}"; it must be an absolute path`);
      } else if (!existsSync(join(PUBLIC_DIR, asset.slice(1)))) {
        missingAssets.add(asset);
      }
    }
    if (game.hero?.text && asset) {
      problems.push(`game "${game.id}" has a hero with both words and a picture; use \`blurb\` for the words`);
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
    if (game.requiresBody && !takesForm(game)) {
      problems.push(`${game.kind} "${game.id}" requires a body, but has no form to type one into`);
    }

    // A hand is units that differ per team. Its size still has to be knowable at boot, because the
    // tile budget is checked the same way a fixed unit list's is -- ten cards at a point each.
    if (game.hand !== undefined) {
      if (!takesForm(game)) {
        problems.push(`${game.kind} "${game.id}" deals a hand, but has no form to answer one with`);
      }
      if (game.units !== undefined) {
        problems.push(
          `game "${game.id}" declares both \`hand\` and \`units\`; a hand IS its units, and two ` +
            `counts can disagree`,
        );
      }
      if (!Number.isInteger(game.hand.size) || game.hand.size < 1) {
        problems.push(`game "${game.id}" deals a hand of ${game.hand.size}; expected a positive whole number`);
      }
      // The pool. Today the only source is a question ladder, and naming one that does not exist
      // deals an empty hand to every team -- a tile that renders, submits nothing and pays nothing,
      // which is exactly the failure that looks like it works.
      if (!game.hand.fromLadder) {
        problems.push(`game "${game.id}" deals a hand with no \`fromLadder\`; there is nothing to deal`);
      } else if (!listLadders().includes(game.hand.fromLadder)) {
        problems.push(
          `game "${game.id}" deals from ladder "${game.hand.fromLadder}", which no question declares`,
        );
      }
      const budget = unitCount(game) * (game.points ?? 0);
      if (budget > economy.tilePoints) {
        problems.push(
          `game "${game.id}" pays ${budget} across its hand, over the ${economy.tilePoints}-point tile budget`,
        );
      }
    }

    // A harvest is units that are questions asked at the door. Everything here is knowable at boot,
    // and every one of these failures would otherwise show up as a tile that renders perfectly and
    // scores nobody -- the shape that looks like it works.
    if (game.harvest !== undefined) {
      if (!takesForm(game)) {
        problems.push(`${game.kind} "${game.id}" harvests questions, but has no form to answer them with`);
      }
      if (game.units !== undefined || game.hand !== undefined) {
        problems.push(
          `game "${game.id}" declares \`harvest\` alongside \`units\` or \`hand\`; a harvest IS its ` +
            `units, and two counts can disagree`,
        );
      }
      if (!Array.isArray(game.harvest) || !game.harvest.length) {
        problems.push(`game "${game.id}" declares an empty harvest; there is nothing to predict`);
      } else {
        const seen = new Set();
        game.harvest.forEach((id, index) => {
          const question = getQuestion(id);
          if (!question) {
            problems.push(
              `game "${game.id}" harvests question "${id}" (unit ${index}), which no question declares`,
            );
            return;
          }
          // A prediction is a thing a TEAM makes once. A member-scoped question would be answered
          // twice per team, so the corpus would count some teams double and the tile would quietly
          // be scoring a different room than the one in the house.
          if (question.scope !== 'team') {
            problems.push(
              `game "${game.id}" harvests question "${id}", which is ${question.scope}-scoped; a ` +
                `harvest question has to be team-scoped`,
            );
          }
          if (seen.has(id)) {
            problems.push(`game "${game.id}" harvests question "${id}" twice`);
          }
          seen.add(id);
        });
      }
      const budget = unitCount(game) * (game.points ?? 0);
      if (budget > economy.tilePoints) {
        problems.push(
          `game "${game.id}" pays ${budget} across its harvest, over the ${economy.tilePoints}-point tile budget`,
        );
      }
    }

    // Units. A tally game spends its ten points across countable things, and the arithmetic is
    // knowable at boot for exactly the reason a hunt's is -- the number is declared rather than
    // computed inside check() or resolve(), so nothing has to run for it to be wrong.
    if (game.units !== undefined) {
      if (!takesForm(game)) {
        problems.push(`${game.kind} "${game.id}" declares units, but has no form to submit one`);
      }
      if (typeof game.units === 'number') {
        if (!Number.isInteger(game.units) || game.units < 1) {
          problems.push(`game "${game.id}" declares ${game.units} units; expected a positive whole number`);
        }
      } else if (Array.isArray(game.units)) {
        if (!game.units.length) problems.push(`game "${game.id}" declares an empty units list`);
        game.units.forEach((label, index) => {
          if (typeof label !== 'string' || !label.trim()) {
            problems.push(`game "${game.id}" unit ${index + 1} has no label`);
          }
        });
      } else {
        problems.push(`game "${game.id}" declares units that are neither a count nor a list of labels`);
      }

      const budget = unitCount(game) * (game.points ?? 0);
      if (budget > economy.tilePoints) {
        problems.push(
          `game "${game.id}" pays ${budget} across its units, over the ${economy.tilePoints}-point tile budget`,
        );
      }
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
  // never reach paper. See docs/adr/codes-are-printed-from-the-inventory.md.
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

  if (unfinished.length) {
    console.warn(
      `\n!! GAME CONTENT IS STILL UNFINISHED:` +
        `\n!!   ${unfinished.join('\n!!   ')}` +
        `\n!! The night will run, but these games are not playing at full strength.\n`,
    );
  }

  if (missingAssets.size) {
    console.warn(
      `\n!! HERO ASSET(S) MISSING FROM public/:` +
        `\n!!   ${[...missingAssets].join(', ')}` +
        `\n!! Those pages show the placeholder frame instead of a picture.\n`,
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
