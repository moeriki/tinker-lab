// The route inventory, wired. Every route in CONTEXT.md exists here: real where the domain is
// settled, an honest stub where a later ticket owns the design.

import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

import rulesCopy from '../content/rules.js';
import {
  ADMIN_COOKIE,
  ADMIN_SECRET,
  PENDING_COOKIE,
  PUBLIC_DIR,
  UPLOADS_DIR,
} from './config.js';
import { all, get, run, transact } from './db.js';
import {
  assetIsPresent,
  getGame,
  getPage,
  getCode,
  isPending,
  judgingMode,
  listCodes,
  listGames,
  listQuestions,
  hintsFor,
  slugForPage,
  stepCount,
  getStep,
  takesForm,
  takesPhoto,
  requiresBody,
  unitCount,
  unitLabel,
  unitLabels,
} from './content.js';
import {
  escape,
  html,
  isMultipart,
  noCache,
  parseCookies,
  readForm,
  readMultipart,
  redirect,
  route,
  setCookie,
  clearCookie,
  TooLarge,
} from './http.js';
import { displayFor, MAX_PHOTO_BYTES, storePhoto } from './photos.js';
import {
  attachTeam,
  createTeam,
  currentTeam,
  dealTeamName,
  isDealtName,
  membersOf,
  onboardingComplete,
} from './identity.js';
import {
  finderRankFor,
  huntIsComplete,
  isUnlocked,
  reachedStep,
  recordScan,
  scanCountFor,
  scanIsInOrder,
  unlock,
} from './progress.js';
import {
  allSubmissionsFor,
  award,
  awardHuntProgress,
  endGame,
  gameIsOver,
  gameScore,
  hasDiscoveredHintCost,
  hintCost,
  reopenGame,
  rescore,
  revealNextHint,
  revealedHints,
  standings,
  standingsMessage,
  submissionsFor,
  teamScore,
} from './scoring.js';
import { fireWebhook } from './webhooks.js';
import {
  field,
  hero,
  hintModal,
  layout,
  notFound,
  rulesList,
  scorebar,
  stub,
  tile,
  win,
} from './render.js';
import { inject } from './kit.js';
import {
  ARRIVED,
  gamePath,
  heroAnimation,
  hintNoticeFor,
  hintNoticeOf,
  momentForSubmission,
  momentOf,
  shotAnimation,
  SUBMITTED,
  verdictAnimation,
} from './moments.js';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.heic': 'image/heic',
  '.avif': 'image/avif',
};

/** A team, or a bounce to the door. Used by the onboarding routes themselves. */
const requireTeam = (req, res) => {
  const team = currentTeam(req);
  if (!team) redirect(res, '/welcome');
  return team;
};

/**
 * A team that is all the way through the gate. Onboarding is a gate rather than a suggestion
 * (#9), and a team exists from the end of the first screen -- so "has a cookie" is not the same
 * question as "is allowed to play", and every route past the door has to ask the second one.
 */
const requireOnboardedTeam = (req, res) => {
  const team = requireTeam(req, res);
  if (!team) return null;
  if (!onboardingComplete(team.id)) {
    redirect(res, '/questions');
    return null;
  }
  return team;
};

/**
 * Who you are, what you have, and how much of the board is still shut -- on every team-facing
 * page. See `scorebar()` in render.js for why the count is there.
 */
const teamBar = (team) => {
  const games = listGames();
  return scorebar({
    name: team.name,
    score: teamScore(team.id),
    open: games.filter((game) => isUnlocked(team.id, game.id)).length,
    total: games.length,
  });
};

/** After game end the site is read-only for teams. One guard, one place. */
const blockedByGameEnd = (res) => {
  if (!gameIsOver()) return false;
  redirect(res, '/showdown');
  return true;
};

// --- the front door ---------------------------------------------------------------------------

/**
 * A slug the inventory does not know. Rendered here rather than redirected to `/p/no-such-code`,
 * because the most likely person holding an unknown code is someone who has not onboarded yet,
 * and bouncing them through /welcome for a code that buys nothing is a worse first minute than
 * a dead end that says so. Status is a real 404: the code really does not exist.
 */
const noSuchCode = (res) => {
  const page = getPage('no-such-code');
  return html(res, layout({ title: page.title, body: page.body, showClose: page.showClose }), 404);
};

/**
 * What a code DOES, separated from how the team got here -- because one scan on this site is not
 * live. An un-onboarded guest's scan is held in a cookie and replayed once they have a team, and
 * `deferred` is that replay saying so.
 *
 * The only thing it changes is the webhook. A hunt step's webhook flashes a lamp in a room, and
 * that flash IS the clue pointing at the next code; firing it a minute late, while the team is
 * still head-down in a questionnaire, spends the clue on an empty room. So a deferred scan keeps
 * the scan row and the unlock and drops the webhook, and the game page asks them to go and scan
 * it again for real. See ADR-0011.
 *
 * Returns the path to send them to, or null when the code points at a game content does not
 * define -- which the caller turns into a 404.
 */
function applyCode({ team, slug, target, deferred = false }) {
  if (gameIsOver()) {
    recordScan(team.id, slug, false);
    return '/showdown';
  }

  if (target.page) {
    recordScan(team.id, slug, true);
    return `/p/${target.page}`;
  }

  const game = getGame(target.game);
  if (!game) return null;

  if (game.kind !== 'hunt') {
    recordScan(team.id, slug, true);
    unlock(team.id, game.id);
    // Straight into the game, never via the dashboard: the team scanned a code because they want
    // to play, and the unlock plays on the hero they are already looking at. ADR-0009.
    return gamePath(game.id, { moment: 'unlock' });
  }

  const step = target.step;

  if (!scanIsInOrder(team.id, game, step)) {
    recordScan(team.id, slug, false);
    return '/p/too-soon';
  }

  recordScan(team.id, slug, true);
  if (step === 1) unlock(team.id, game.id);

  // The step's `webhook` is a logical node name, never a Home Assistant id -- see
  // docs/adr/0007-one-home-assistant-webhook.md.
  const webhook = getStep(game, step)?.webhook;
  if (webhook && !deferred) fireWebhook(webhook, { team: team.name, game: game.id, step });

  // Every step banks as it is reached, not the whole hunt at the finish -- see awardHuntProgress.
  awardHuntProgress(team.id, game);

  // A deferred scan that owed a physical effect asks for it back. Otherwise: step 1 is an unlock,
  // and every step after it is a step transition, and they look different.
  if (deferred && webhook) return gamePath(game.id, { step, moment: 'rescan' });
  return gamePath(game.id, { step, moment: step === 1 ? 'unlock' : 'step' });
}

async function handleScan({ req, res, params }) {
  const target = getCode(params.slug);
  if (!target) return noSuchCode(res);

  // A real code whose content is not written yet. Impossible on the night -- the sheet generator
  // refuses to print while any code is pending -- but entirely normal during the week before,
  // when a test print exists and the game behind it does not. ADR-0010.
  if (isPending(params.slug)) {
    return html(
      res,
      stub({
        title: 'Nothing here yet',
        owner: `the content ticket for "${target.game ?? target.page}"`,
        does: 'This code is real, printed and hidden. What it opens has not been written yet.',
      }),
    );
  }

  const team = currentTeam(req);

  // Hold the slug and replay it once they are through onboarding, so the code they scanned costs
  // them nothing. A team mid-questionnaire is held the same way: they have a cookie but they owe
  // answers, and letting this scan through would put them in a game past the gate.
  if (!team || !onboardingComplete(team.id)) {
    setCookie(res, PENDING_COOKIE, params.slug, { maxAge: 60 * 60 });
    return redirect(res, team ? '/questions' : '/welcome');
  }

  const path = applyCode({ team, slug: params.slug, target });
  if (!path) return html(res, notFound(), 404);

  return redirect(res, path);
}

// --- onboarding -------------------------------------------------------------------------------

const MEMBER_NAME_MAX = 24;

/**
 * Screen one: who you are. Nine fields is the whole door, and this screen is two of them --
 * because the team name is dealt rather than typed.
 *
 * The team name is DEALT rather than typed (#9). It is the team's display name and also the
 * handle a stranger types into a Human Bingo square, so dealing it buys uniqueness, kills the
 * duplicate-name error that would otherwise live on the first screen of the night, and hands
 * every team something better than they would have typed with their coat still on.
 *
 * Reroll costs no client JS and loses nothing already typed: the button carries `formmethod=get`,
 * so it re-submits this same form as a GET back to this same page. The word they were looking at
 * arrives as `?word=`, gets excluded from the next deal so the name visibly changes, and their
 * half-typed member names come back with them. `formnovalidate` is what lets that happen before
 * the first name has been filled in.
 */
function showWelcome({ req, res, url }) {
  const existing = currentTeam(req);
  if (existing) return redirect(res, onboardingComplete(existing.id) ? '/' : '/questions');

  const offered = dealTeamName(url.searchParams.get('word'));
  const typed = url.searchParams.getAll('member');

  const nameField = (index, label, required) =>
    field({
      label,
      name: 'member',
      value: typed[index] ?? '',
      attrs: { maxlength: MEMBER_NAME_MAX, autocomplete: 'off', required },
    });

  return html(
    res,
    layout({
      title: 'Right. Who are you?',
      body: `
        <p>Two of you, one phone. Whoever is holding it is carrying the team all night — so pick
          the one with battery left.</p>
        <form class="stack" method="post" action="/welcome">
          <input type="hidden" name="word" value="${escape(offered)}">
          <p class="display">TEAM ${escape(offered)}</p>
          <button class="btn" formmethod="get" formaction="/welcome" formnovalidate>
            no, deal us another
          </button>
          ${nameField(0, 'Who is holding the phone?', true)}
          ${nameField(1, 'And who else? (leave empty if you are on your own)', false)}
          <button class="btn btn--primary">that's us</button>
        </form>
      `,
    }),
  );
}

async function createTeamFromForm({ req, res }) {
  const existing = currentTeam(req);
  if (existing) return redirect(res, onboardingComplete(existing.id) ? '/' : '/questions');

  const form = await readForm(req);

  // Trust the hidden field only as far as it names a word this site would have dealt; anything
  // else means a hand-edited form, and gets a name of our choosing rather than an error page.
  const offered = form.get('word');
  const name = isDealtName(offered) ? offered : dealTeamName();

  const memberNames = form.getAll('member').map((value) => String(value).slice(0, MEMBER_NAME_MAX));
  if (!memberNames.some((value) => value.trim())) return redirect(res, '/welcome');

  const team = createTeam({ name, memberNames });
  attachTeam(res, team);

  return redirect(res, '/questions');
}

/** Honest, short, and never a dead end: the form is always still underneath. */
const QUESTION_PROBLEMS = {
  blank: 'Nearly — a couple of those are still empty. Every one of them is somebody else’s game later.',
};

/**
 * Screen two: the questionnaire, which is a gate rather than a form (#9). Every answer here is
 * consumed by a game somebody else plays hours from now -- the aged-eight answers become Guess
 * Who's answer key, and the five one-word answers are the corpus Herd Mentality scores against.
 * A team that skips does not merely skip their own tile; they put a hole in everyone's.
 */
function showQuestions({ req, res, url }) {
  const team = requireTeam(req, res);
  if (!team) return undefined;
  if (onboardingComplete(team.id)) return redirect(res, afterOnboarding(req, res, team));

  const questions = listQuestions();
  const members = membersOf(team.id);
  const answered = new Map(
    all('select member_id, question_id, value from profile_answers where team_id = ?', team.id).map(
      (row) => [`${row.question_id}:${row.member_id ?? ''}`, row.value],
    ),
  );

  const fields = questions
    .flatMap((question) =>
      question.scope === 'member'
        ? members.map((member) => ({ question, member }))
        : [{ question, member: null }],
    )
    .map(({ question, member }) => {
      const key = `${question.id}:${member?.id ?? ''}`;
      // The member's name goes in the question, not in brackets after it: "what did ANNA want to
      // be" is a question, "what did you want to be (Anna)" is a form field.
      const label = member ? `${member.name}: ${question.label}` : question.label;

      return field({
        label,
        name: key,
        type: question.input ?? 'text',
        value: answered.get(key) ?? '',
        attrs: {
          maxlength: Number(question.maxLength ?? 40),
          placeholder: question.placeholder ?? '',
          autocomplete: 'off',
          autocapitalize: 'off',
          required: true,
        },
      });
    })
    .join('');

  const problem = QUESTION_PROBLEMS[url.searchParams.get('problem')];

  return html(
    res,
    layout({
      title: 'Two seconds each',
      body: `
        ${problem ? `<p class="banner banner--bad">${escape(problem)}</p>` : ''}
        <p>Answer these and you are in. Don't think about them — every single one is a game
          somebody plays later tonight, and the honest answer is the funny one.</p>
        <form class="stack" method="post" action="/questions">
          ${fields}
          <button class="btn btn--primary">let us in</button>
        </form>
      `,
    }),
  );
}

async function saveQuestions({ req, res }) {
  const team = requireTeam(req, res);
  if (!team) return undefined;

  const form = await readForm(req);

  transact(() => {
    for (const [key, value] of form.entries()) {
      const [questionId, rawMemberId] = key.split(':');
      const memberId = rawMemberId ? Number(rawMemberId) : null;
      run(
        `insert into profile_answers (team_id, member_id, question_id, value)
         values (?, ?, ?, ?)
         on conflict (team_id, ifnull(member_id, -1), question_id)
         do update set value = excluded.value, updated_at = datetime('now')`,
        team.id,
        memberId,
        questionId,
        value,
      );
    }
  });

  // Everything typed is kept either way, so coming back costs them only the blanks. `required`
  // already asked; this is the same question asked by someone who cannot be talked out of it.
  if (!onboardingComplete(team.id)) return redirect(res, '/questions?problem=blank');

  return redirect(res, afterOnboarding(req, res, team));
}

/**
 * The code they arrived on, applied at last, so onboarding costs them nothing.
 *
 * It is applied HERE rather than by redirecting back through `/q/:slug`, because this scan is a
 * minute stale and a hunt step's webhook must not fire into an empty room -- see `applyCode` and
 * ADR-0011. A team who arrived by typing the address instead of scanning anything has no pending
 * slug and simply lands on their board.
 */
function afterOnboarding(req, res, team) {
  const pending = parseCookies(req)[PENDING_COOKIE];
  if (!pending) return '/';

  clearCookie(res, PENDING_COOKIE);

  const target = getCode(pending);
  if (!target || isPending(pending)) return '/';

  return applyCode({ team, slug: pending, target, deferred: true }) ?? '/';
}

// --- dashboard, games, rules ------------------------------------------------------------------

function showDashboard({ req, res }) {
  const team = requireOnboardedTeam(req, res);
  if (!team) return undefined;

  // The five tile designs the style kit ships: locked, unlocked, correct, wrong, unknown.
  const tiles = listGames().map((game) => {
    const unlocked = isUnlocked(team.id, game.id);
    const submissions = submissionsFor(team.id, game.id);
    const verdicts = new Set(submissions.map((submission) => submission.verdict));

    const points = gameScore(team.id, game.id);

    let state = 'locked';
    if (unlocked) state = 'unlocked';
    if (submissions.length) {
      if (verdicts.has('pending')) state = 'unknown';
      else state = verdicts.has('correct') ? 'correct' : 'wrong';
    }
    if (game.kind === 'hunt' && huntIsComplete(team.id, game)) state = 'correct';

    // A `trust` game banks on submit and is never judged, so its submissions sit at `pending`
    // for the whole night -- which the block above would paint `unknown`, the design that means
    // "submitted, and unscoreable until game end". For these two tiles that is precisely
    // backwards: they hold the only points on the board that are already certain.
    //
    // So the LEDGER decides, the way it does for a trophy, and green means the same thing here
    // as it does on a hunt: finished. A half-filled tile stays `unlocked` and lets its points
    // speak, rather than going green for one photograph out of ten.
    if (judgingMode(game) === 'trust') {
      const budget = unitCount(game) * (game.points ?? 0);
      state = budget && points >= budget ? 'correct' : 'unlocked';
    }
    // A trophy never holds a submission, so the ledger is the only thing that knows. A team that
    // was not handed it sits at unlocked and zero -- never `wrong`, since they were never asked a
    // question they could get wrong.
    if (game.kind === 'trophy' && points > 0) state = 'correct';

    return { game, unlocked, state, points };
  });

  const grid = tiles.length
    ? tiles
        .map(({ game, state, points }) =>
          tile({ state, title: game.title, points, href: `/g/${game.id}` }),
        )
        .join('')
    : '<p>No games yet. The roster is still being locked.</p>';

  return html(
    res,
    layout({
      title: 'Your board',
      bar: teamBar(team),
      body: `
        <p class="standing">${escape(standingsMessage(team.id))}</p>
        <div class="tiles">${grid}</div>
        <a class="btn" href="/rules">the rules</a>
      `,
    }),
  );
}

/** Honest, short, and never a dead end -- the form is always still underneath. */
/**
 * A game's own words in its empty input. It matters more than it looks on the yarn tile, where
 * the whole submission is a bare number and nothing else on the page says which unit -- pair it
 * with `form.inputmode` so a phone opens the right keyboard.
 */
const placeholderOf = (game) =>
  game.form?.placeholder ? `placeholder="${escape(game.form.placeholder)}"` : '';

const SUBMIT_PROBLEMS = {
  toobig: 'That photo was too big to send. Take a new one and try again.',
  notaphoto: "That file wasn't a photo — at least, not one we know how to read.",
  empty: 'Nothing arrived. Pick a photo first.',
  noquote: 'Almost — this one needs a sentence they actually said. Type it and send again.',
  nophoto: 'A quote on its own is only half a portrait. Take the photo too.',
  // A stale tab, or a prompt list that changed under someone mid-photo. Never a thing a guest
  // can do wrong by tapping, so it explains itself and points at the only fix.
  nounit: "That prompt isn't on the list any more. Reopen the tile and pick one from it.",
};

/**
 * A team's own photos, back to them. Thumbnails are the extracted EXIF ones where the camera
 * embedded any, so reopening a tile with six photos on it costs kilobytes and not megabytes.
 */
function photoStrip(submissions, newestAnim = '') {
  const withPhotos = submissions.filter((submission) => submission.photo_path);
  if (!withPhotos.length) return '';

  const cells = withPhotos
    .map((submission, index) => {
      const display = displayFor(submission);
      const href = `/uploads/${escape(submission.photo_path)}`;
      const inside = display.src
        ? `<img class="shot__img" src="${escape(display.src)}" alt="" loading="lazy">`
        : '<span class="shot__none">sent ✓</span>';
      // Only the photo that just arrived moves; the rest of the strip stays put.
      const moving = index === withPhotos.length - 1 ? newestAnim : '';
      return `<a class="shot${moving}" href="${href}">${inside}</a>`;
    })
    .join('');

  return `<p class="statusline">you've sent ${withPhotos.length}</p>
          <div class="shots">${cells}</div>`;
}

/** The one thumbnail-or-fallback cell, shared by the strip and the prompt checklist. */
function shotCell(submission, extraClass = '') {
  const display = displayFor(submission);
  const inside = display.src
    ? `<img class="shot__img" src="${escape(display.src)}" alt="" loading="lazy">`
    : '<span class="shot__none">sent ✓</span>';
  return `<a class="shot${extraClass}" href="/uploads/${escape(submission.photo_path)}">${inside}</a>`;
}

/** The camera control, posting one unit of one game. `unit` is null where the units are anonymous. */
function shootForm(game, { unit = null, face, primary = true, body = null }) {
  return `<form class="stack stack--tight" method="post" action="/g/${escape(game.id)}/submit"
                enctype="multipart/form-data">
            ${unit === null ? '' : `<input type="hidden" name="unit" value="${Number(unit)}">`}
            <label class="shoot">
              <input class="shoot__input" type="file" name="photo" accept="image/*" capture="environment">
              <span class="shoot__face">${escape(face)}</span>
            </label>
            ${body ?? ''}
            <button class="btn ${primary ? 'btn--primary' : ''}" ${gameIsOver() ? 'disabled' : ''}>send</button>
          </form>`;
}

/**
 * The photo scavenger's page: the prompt list IS the page. A done prompt shows the photograph
 * that closed it; an open one is a camera button wearing the prompt as its face, so tapping the
 * thing you have to photograph is what opens the camera.
 *
 * Showing what is left rather than only what has been sent is the whole reason this shape was
 * chosen over a dropdown: it makes the dedup rule VISIBLE. A team can see that the seventh photo
 * of "someone eating" buys nothing, instead of discovering it by not scoring.
 *
 * A closed prompt keeps its camera anyway -- retaking is allowed and free, it just never pays
 * twice. Nothing on this page ever tells anyone to stop taking photographs.
 */
function promptChecklist(game, mine, newestAnim) {
  const labels = unitLabels(game);

  // The latest photo per prompt. Retakes insert new rows rather than overwriting, so the last
  // one wins on screen while the ledger keeps paying for the first.
  const shots = new Map();
  for (const submission of mine) {
    if (submission.unit !== null && submission.photo_path) shots.set(submission.unit, submission);
  }

  const newest = mine.filter((submission) => submission.photo_path).at(-1);

  const rows = labels
    .map((label, unit) => {
      const done = shots.get(unit);
      if (!done) {
        return `<li class="prompt">
                  ${shootForm(game, { unit, face: label })}
                </li>`;
      }
      const moving = done.id === newest?.id ? newestAnim : '';
      return `<li class="prompt prompt--done">
                ${shotCell(done, moving)}
                <div class="prompt__said">
                  <p class="prompt__label">✓ ${escape(label)}</p>
                  ${shootForm(game, { unit, face: 'retake', primary: false })}
                </div>
              </li>`;
    })
    .join('');

  return `<p class="statusline">${shots.size} of ${labels.length} — ${shots.size} point${
    shots.size === 1 ? '' : 's'
  }</p>
          <ul class="prompts">${rows}</ul>`;
}

/**
 * Portrait of a stranger: anonymous units, so there is no list to tick off -- just a count, the
 * portraits so far with what was said under each, and one form.
 *
 * The quote is required here and nowhere else on the site, which is why it sits inside the form
 * rather than beside it: a photograph with nothing said is not a portrait, and bouncing it is
 * the tile working rather than the tile failing.
 */
function portraitStage(game, mine, newestAnim) {
  const cap = unitCount(game);
  const sent = mine.filter((submission) => submission.photo_path);
  const paid = Math.min(sent.length, cap);
  const newest = sent.at(-1);

  const gallery = sent.length
    ? `<ul class="prompts">${sent
        .map(
          (submission) => `<li class="prompt prompt--done">
             ${shotCell(submission, submission.id === newest?.id ? newestAnim : '')}
             <div class="prompt__said">
               <p class="prompt__label">“${escape(submission.body ?? '')}”</p>
             </div>
           </li>`,
        )
        .join('')}</ul>`
    : '';

  const quote = `<input class="input" name="body" maxlength="140" ${placeholderOf(game)}>`;

  return `<p class="statusline">${paid} of ${cap} — ${paid} point${paid === 1 ? '' : 's'}</p>
          ${gallery}
          ${shootForm(game, { face: sent.length ? 'another portrait' : 'take a portrait', body: quote })}`;
}

function showGame({ req, res, params, url }) {
  const team = requireOnboardedTeam(req, res);
  if (!team) return undefined;

  const game = getGame(params.gameId);
  if (!game) return html(res, notFound(), 404);
  if (!isUnlocked(team.id, game.id)) return html(res, notFound(), 404);

  // /g/:id always means the current step; ?step=n browses reached steps, clamped.
  const reached = reachedStep(team.id, game);
  const requested = Number(url.searchParams.get('step'));
  const step = game.kind === 'hunt' ? Math.min(Math.max(requested || reached, 1), reached) : 0;

  const hints = revealedHints(team.id, game.id, step);
  const remaining = hintsFor(game, step).length - hints.length;

  const mine = submissionsFor(team.id, game.id);
  const problem = SUBMIT_PROBLEMS[url.searchParams.get('problem')];
  const wantsPhoto = takesPhoto(game);

  // What just happened, delivered here rather than to the dashboard. See ADR-0009.
  const moment = momentOf(url);
  const submitted = SUBMITTED[moment];

  // The one arrival that carries an instruction rather than a verdict: a hunt code scanned before
  // this team existed, whose webhook was deliberately not fired. ADR-0011.
  const arrival = ARRIVED[moment];

  // A reveal that has already happened, announcing what it cost. Rendered only when there is a
  // price to name -- every other visit to this page carries no modal at all.
  const notice = hintNoticeOf(url);

  // A hunt's hero belongs to the step it is on; every other kind has one of its own.
  const source = game.kind === 'hunt' ? getStep(game, step)?.hero : game.hero;

  const heroBlock =
    hero({ ...source, anim: heroAnimation(moment), assetExists: assetIsPresent(source?.asset) }) +
    // Words underneath the frame, for the one case the kit forbids inside it: a picture that
    // still needs a sentence. Teddy is a photograph plus the only rule that matters.
    (game.blurb ? `<p class="blurb">${escape(game.blurb)}</p>` : '');

  // What sits between the banners and the hints. A hunt says which step it is on; a trophy is the
  // hero and its blurb and nothing else -- no form, because the object is in the room and the
  // host decides who ends the night holding it. Everything else takes an answer. The last branch
  // asks `takesForm` rather than naming the three kinds, so a fifth formless kind cannot quietly
  // inherit a form.
  let stage;
  if (game.kind === 'hunt') {
    stage = `<p class="statusline">Step ${step} of ${stepCount(game)} — reached ${reached}</p>
             ${heroBlock}`;
  } else if (!takesForm(game)) {
    stage = heroBlock;
  } else if (unitCount(game)) {
    // A game that pays per unit composes its own stage: the units are the page, and the generic
    // one-form-and-a-strip below cannot say which of them are still open.
    stage = `${heroBlock}
             ${
               unitLabels(game).length
                 ? promptChecklist(game, mine, shotAnimation(moment))
                 : portraitStage(game, mine, shotAnimation(moment))
             }`;
  } else {
    stage = `${heroBlock}
             ${wantsPhoto ? photoStrip(mine, shotAnimation(moment)) : ''}
             <form class="stack" method="post" action="/g/${escape(game.id)}/submit"
                   ${wantsPhoto ? 'enctype="multipart/form-data"' : ''}>
               ${
                 wantsPhoto
                   ? `<label class="shoot">
                        <input class="shoot__input" type="file" name="photo"
                               accept="image/*" capture="environment">
                        <span class="shoot__face">${mine.some((s) => s.photo_path) ? 'take another' : 'take a photo'}</span>
                      </label>`
                   : ''
               }
               <input class="input" name="body"
                      ${wantsPhoto ? 'placeholder="say something about it (optional)"' : placeholderOf(game)}
                      ${game.form?.inputmode ? `inputmode="${escape(game.form.inputmode)}"` : ''}
                      value="${escape(game.kind === 'tally' ? '' : mine.at(-1)?.body ?? '')}">
               <button class="btn btn--primary" ${gameIsOver() ? 'disabled' : ''}>Submit</button>
             </form>`;
  }

  return html(
    res,
    layout({
      title: escape(game.title),
      bar: teamBar(team),
      modal: notice
        ? hintModal({ notice, cost: hintCost(), backHref: gamePath(game.id, { step }) })
        : '',
      body: `
        ${problem ? `<p class="banner banner--bad">${escape(problem)}</p>` : ''}
        ${arrival ? `<p class="banner">${escape(arrival)}</p>` : ''}
        ${submitted ? `<p class="banner${verdictAnimation(moment)}">${escape(submitted)}</p>` : ''}
        ${stage}
        <ul class="stack stack--tight">
          ${hints.map((hint) => `<li class="bubble">${escape(hintsFor(game, step)[hint.hint_index])}</li>`).join('')}
        </ul>
        ${
          remaining > 0 && !gameIsOver()
            ? `<form method="post" action="/g/${escape(game.id)}/hint">
                 <input type="hidden" name="step" value="${step}">
                 <button class="btn btn--hint">Hint</button>
               </form>`
            : ''
        }
        <a class="btn btn--close" href="/">close</a>
      `,
    }),
  );
}

/**
 * A failed submission must never cost a team their place: every problem lands back on the game
 * page with the form still there, never on an error page and never on a 500.
 */
const backToGame = (res, game, problem) =>
  redirect(res, `/g/${game.id}${problem ? `?problem=${problem}` : ''}`);

async function submitToGame({ req, res, params }) {
  const team = requireOnboardedTeam(req, res);
  if (!team) return undefined;
  if (blockedByGameEnd(res)) return undefined;

  const game = getGame(params.gameId);
  if (!game || !isUnlocked(team.id, game.id)) return html(res, notFound(), 404);
  // Neither a hunt nor a trophy renders a form, so a POST here is a stale tab or a curious guest
  // with a terminal. Bounce it rather than opening a submission row against a game that has no
  // way to judge one.
  if (!takesForm(game)) return redirect(res, `/g/${game.id}`);

  let fields;
  let photo = null;

  try {
    if (isMultipart(req)) {
      const parsed = await readMultipart(req, { limit: MAX_PHOTO_BYTES });
      fields = parsed.fields;

      // Written to disk only now, after the whole body parsed -- an upload that dies on patchy
      // wifi throws above and leaves no file at all.
      const upload = parsed.files.find((file) => file.name === 'photo');
      if (upload) {
        photo = storePhoto({ teamId: team.id, gameId: game.id, buf: upload.buf });
        if (!photo) return backToGame(res, game, 'notaphoto');
      }
    } else {
      fields = await readForm(req);
    }
  } catch (error) {
    if (error instanceof TooLarge) return backToGame(res, game, 'toobig');
    throw error;
  }

  const body = (fields.get('body') ?? '').trim();
  if (takesPhoto(game) && !photo && !body) return backToGame(res, game, 'empty');

  // Portrait of a stranger is the only game that wants both halves. A photograph with nothing
  // said is not a portrait, so it bounces with the form -- and the photo it already stored is
  // left on disk rather than deleted: the party wanted the picture either way, and a half-filled
  // form is not a reason to throw one away.
  if (requiresBody(game) && !body) return backToGame(res, game, 'noquote');
  if (requiresBody(game) && !photo) return backToGame(res, game, 'nophoto');

  const mode = judgingMode(game);

  // Which countable thing this submission claims. A labelled game posts the index; an anonymous
  // one takes the next ordinal, which is simply how many photographs this team has already sent.
  // Out of range means a stale tab or a hand-typed field: bounce rather than open a submission
  // against a unit the game does not have.
  const units = unitCount(game);
  const alreadySent = submissionsFor(team.id, game.id).filter((row) => row.photo_path);
  let unit = null;

  // Whether this one is worth a point -- which is NOT whether the ledger is written. A retake
  // upserts the row its first photo already wrote, at the same value, so the award is a harmless
  // no-op; what this decides is which of the two honest lines the team gets back. Both photos
  // are stored either way, and neither line ever suggests they stop.
  let paid = true;

  if (units) {
    if (unitLabels(game).length) {
      unit = Number(fields.get('unit'));
      if (!Number.isInteger(unit) || unit < 0 || unit >= units) {
        return backToGame(res, game, 'nounit');
      }
      paid = !alreadySent.some((row) => row.unit === unit);
    } else {
      // Anonymous units take the next ordinal, which is simply how many this team has sent. Past
      // the last slot the ordinal runs off the end and the photograph is a spare.
      unit = alreadySent.length;
      paid = unit < units;
    }
  }

  const submissionId = transact(() => {
    const existing = submissionsFor(team.id, game.id);

    // `answer` games hold one row per team and upsert it, editable until game end.
    if (game.kind === 'answer' && existing.length) {
      if (photo) {
        run(
          `update submissions
              set body = ?, photo_path = ?, photo_mime = ?, photo_thumb = ?,
                  verdict = 'pending', updated_at = datetime('now')
            where id = ?`,
          body,
          photo.filename,
          photo.mime,
          photo.thumbnailName,
          existing[0].id,
        );
      } else {
        run(
          "update submissions set body = ?, updated_at = datetime('now') where id = ?",
          body,
          existing[0].id,
        );
      }
      return existing[0].id;
    }

    const { lastInsertRowid } = run(
      `insert into submissions (team_id, game_id, body, photo_path, photo_mime, photo_thumb, unit)
       values (?, ?, ?, ?, ?, ?, ?)`,
      team.id,
      game.id,
      body,
      photo?.filename ?? null,
      photo?.mime ?? null,
      photo?.thumbnailName ?? null,
      unit,
    );

    // Trust games pay on submit -- which is exactly why the gallery gives them no buttons: the
    // points are already banked and a second press would double-pay.
    //
    // A game with units keys the award on the UNIT rather than on the submission, and that one
    // substitution is the entire cap: `awards` is unique on (team, game, kind, source_id), so a
    // second photograph of the same prompt rewrites one row at the same value instead of adding
    // another. No counting, no ceiling check, no deleting -- and every photograph still stored.
    // A spare past the last anonymous slot is simply never written.
    if (mode === 'trust' && paid) {
      award({
        teamId: team.id,
        gameId: game.id,
        kind: game.kind === 'tally' ? 'tally' : 'answer',
        points: game.points,
        reason: unit === null ? 'on trust' : `on trust — ${unitLabel(game, unit) ?? `#${unit + 1}`}`,
        sourceId: unit === null ? Number(lastInsertRowid) : unit,
      });
    }

    return Number(lastInsertRowid);
  });

  let verdict = 'pending';

  if (mode === 'check') {
    verdict = game.check(body) ? 'correct' : 'incorrect';
    run('update submissions set verdict = ? where id = ?', verdict, submissionId);
    award({
      teamId: team.id,
      gameId: game.id,
      kind: 'answer',
      points: verdict === 'correct' ? game.points ?? 0 : 0,
      sourceId: submissionId,
    });
  }

  // Every submission lands back on the game page -- the one the team is already looking at --
  // and is answered there. Nobody gets thrown to the dashboard to be told what happened, and
  // closing the game is the team's call. Photo games needed this anyway: sending another is one
  // tap. See ADR-0009.
  // `photo` here is the one that actually arrived, not merely a game that accepts them: a
  // photo game also takes a text-only submission, and that must not animate a photo.
  return redirect(
    res,
    gamePath(game.id, {
      moment: momentForSubmission({ photo: Boolean(photo), mode, verdict, paid }),
    }),
  );
}

async function revealHint({ req, res, params }) {
  const team = requireOnboardedTeam(req, res);
  if (!team) return undefined;
  if (blockedByGameEnd(res)) return undefined;

  const game = getGame(params.gameId);
  if (!game || !isUnlocked(team.id, game.id)) return html(res, notFound(), 404);

  const form = await readForm(req);
  const step = game.kind === 'hunt' ? Number(form.get('step')) || reachedStep(team.id, game) : 0;

  const revealed = revealNextHint(team.id, game, step);

  // The reveal is done: the row is written, the ledger is charged, and the hint is on the page we
  // are redirecting to. `?hint=` only decides which sentence the modal says on arrival -- free the
  // first time this team ever asks, the price every time after. It is a notification, not a
  // confirmation, so nothing above this line waits on it.
  return redirect(res, gamePath(game.id, { step, hint: hintNoticeFor(revealed, hintCost()) }));
}

/**
 * The rules. Copy lives in `content/rules.js`; this function owns exactly one thing the copy
 * cannot -- whether rule 4 is on the page yet.
 *
 * Rule 4 is appended to the same list, with no marker of any kind. That is deliberate: MISSION.md
 * asks for a rule that "should only appear once they actually stumbled upon it", and announcing
 * the arrival would undo the stumble. It also makes the 404 page's "there is no rule 4 either"
 * retroactively false, which is free and worth having.
 */
function showRules({ req, res }) {
  const team = currentTeam(req);

  // Where the hint modal's "What?" button lands, so it has to actually answer the question.
  const discovered = team && hasDiscoveredHintCost(team.id);
  const rules = discovered ? [...rulesCopy.rules, rulesCopy.hintRule(hintCost())] : rulesCopy.rules;

  // The statusline is the kit's gag slot, and it is the one place the page acknowledges rule 4 --
  // by counting it, and never by mentioning it. Rule 3 is the only enforced rule until a hint has
  // been bought; after that rule 4 is enforced too, and rather more literally, since it is the
  // only rule on the page the ledger can execute.
  const status = `${rules.length} rule(s) · ${discovered ? 2 : 1} of them enforced`;

  return html(
    res,
    layout({
      title: rulesCopy.title,
      bar: team ? teamBar(team) : '',
      showClose: true,
      body: `
        ${win({ title: rulesCopy.filename, body: rulesList(rules), status })}
        <h2 class="shout">${escape(rulesCopy.pointsTitle)}</h2>
        ${rulesCopy.points.map((para) => `<p>${escape(para)}</p>`).join('')}
      `,
    }),
  );
}

/**
 * A gag page: no game, no points, no way back except the close button. See MISSION.md -- "hidden"
 * describes the page rather than the code, and means unreachable from the dashboard.
 *
 * `body` is usually a string. Two of the three gags need to know something about the team holding
 * the phone -- how many times they have scanned this code, and where they came in the order of
 * teams that found it -- so a page may instead export a FUNCTION, and this is where it is called.
 *
 * The numbers are computed here rather than in `content/`, which keeps the seam intact: content
 * describes the game and never opens the database (ADR-0001). The page is handed facts, not a
 * connection.
 *
 * A page with no code bound to it, or a visitor with no team, gets zeroes -- `/p/motivation` is a
 * real URL and someone will eventually reach it without scanning anything.
 */
function showPage({ req, res, params }) {
  const page = getPage(params.pageId);
  if (!page) return html(res, notFound(), 404);

  let body = page.body;

  if (typeof body === 'function') {
    const team = currentTeam(req);
    const slug = slugForPage(page.id);

    body = body({
      team,
      scanCount: team && slug ? scanCountFor(team.id, slug) : 0,
      finderRank: team && slug ? finderRankFor(team.id, slug) : 0,
    });
  }

  return html(res, layout({ title: page.title, body, showClose: page.showClose }));
}

function showShowdown({ req, res }) {
  if (!gameIsOver()) return redirect(res, '/');

  return html(
    res,
    stub({
      title: 'The showdown',
      owner: 'Admin dashboard and results showdown',
      does: 'Final standings, winner badge and reveal animation.',
      data: standings(),
    }),
  );
}

// --- admin ------------------------------------------------------------------------------------

const isAdmin = (req) => parseCookies(req)[ADMIN_COOKIE] === ADMIN_SECRET;

/** 404, never 401: a guest poking at /admin should not learn that an admin surface exists. */
const requireAdmin = (req, res) => {
  if (isAdmin(req)) return true;
  html(res, notFound(), 404);
  return false;
};

function adminKey({ res, params }) {
  if (params.secret !== ADMIN_SECRET) return html(res, notFound(), 404);
  setCookie(res, ADMIN_COOKIE, ADMIN_SECRET);
  return redirect(res, '/admin');
}

function adminBoard({ req, res }) {
  if (!requireAdmin(req, res)) return undefined;

  const board = standings().map((team) => ({
    ...team,
    hunts: listGames()
      .filter((game) => game.kind === 'hunt')
      .map((game) => `${game.id}:${reachedStep(team.id, game)}/${stepCount(game)}`),
    unjudged: get(
      "select count(*) as count from submissions where team_id = ? and verdict = 'pending'",
      team.id,
    ).count,
  }));

  return html(
    res,
    stub({
      title: 'Admin',
      owner: 'Admin dashboard and results showdown',
      does: 'Live board with polling, per-game galleries, judging, manual awards, end game.',
      data: { gameOver: gameIsOver(), board },
      still: true, // it polls; a page that re-animates every few seconds cannot be read
    }),
  );
}

/**
 * A trophy's admin surface. There is no gallery, because a trophy holds no submissions: it is an
 * object in the house, and the only question is who is holding it. So this is the team list, one
 * button each, and the current holder said out loud.
 *
 * It does not enforce a single holder. A trophy is content's word for "the host decides", and two
 * people carrying Teddy between them is the kind of thing that happens at midnight -- the count is
 * shown instead, so an accidental second award is visible rather than prevented.
 */
function trophyPanel(res, game) {
  const worth = game.points ?? 0;
  const holders = new Map(
    all(
      "select team_id, points from awards where game_id = ? and kind = 'trophy' and points > 0",
      game.id,
    ).map((row) => [row.team_id, row.points]),
  );

  const rows = all('select id, name from teams order by name')
    .map((team) => {
      const holding = holders.has(team.id);
      return `
        <tr>
          <td>${escape(team.name)}</td>
          <td class="mono">${holding ? `holding · ${holders.get(team.id)} pts` : '&mdash;'}</td>
          <td>
            <form class="judge" method="post" action="/admin/trophy">
              <input type="hidden" name="game" value="${escape(game.id)}">
              <input type="hidden" name="team" value="${team.id}">
              ${
                holding
                  ? '<button class="btn" name="holding" value="no">✗ take it back</button>'
                  : `<button class="btn btn--primary" name="holding" value="yes">✓ award ${worth}</button>`
              }
            </form>
          </td>
        </tr>`;
    })
    .join('');

  return html(
    res,
    layout({
      title: game.title,
      still: true, // admin surface
      body: `
        <p class="statusline">A trophy — no form, no submissions. Award it to whoever is holding
          it. Taking it back writes a zero, so a mis-tap costs nothing permanent.</p>
        <p class="statusline">${holders.size} team${holders.size === 1 ? '' : 's'} holding it</p>
        <table class="board">
          <thead><tr><th>team</th><th>state</th><th></th></tr></thead>
          <tbody>${rows || '<tr><td colspan="3">No teams yet.</td></tr>'}</tbody>
        </table>
        <a class="btn btn--close" href="/admin">back to the board</a>
      `,
    }),
  );
}

/**
 * The gallery, per game. What a photo can have done to it comes from the game's judging mode in
 * content, never from a hardcoded list -- so locking the roster needs no change here. A trophy
 * has no submissions to gallery, and hands off above.
 */
function adminGame({ req, res, params }) {
  if (!requireAdmin(req, res)) return undefined;

  const game = getGame(params.gameId);
  if (!game) return html(res, notFound(), 404);
  if (game.kind === 'trophy') return trophyPanel(res, game);

  const mode = judgingMode(game);
  const submissions = allSubmissionsFor(game.id);
  const names = new Map(all('select id, name from teams').map((team) => [team.id, team.name]));
  const worth = game.points ?? 1;

  const cards = submissions
    .map((submission) => {
      const display = submission.photo_path ? displayFor(submission) : null;

      let media = '';
      if (display?.src) {
        media = `<a class="shot" href="/uploads/${escape(submission.photo_path)}">
                   <img class="shot__img" src="${escape(display.src)}" alt="" loading="lazy">
                 </a>`;
      } else if (display) {
        // HEIC on Android, or anything else this browser may refuse. Never a broken <img>.
        media = `<a class="shot shot--dl" href="/uploads/${escape(submission.photo_path)}" download>
                   <span class="shot__none">${escape(submission.photo_mime ?? 'file')}<br>tap to open</span>
                 </a>`;
      }

      const judging =
        mode === 'manual'
          ? `<form class="judge" method="post" action="/admin/judge">
               <input type="hidden" name="submission" value="${submission.id}">
               <button class="btn btn--primary" name="verdict" value="correct">✓ award ${worth}</button>
               <button class="btn" name="verdict" value="incorrect">✗ reject</button>
               <input type="hidden" name="points" value="${worth}">
             </form>`
          : '';

      // Which prompt this photograph answers, where the game has labelled units. Read from
      // content rather than stored with the photo, so rewording a prompt relabels the gallery.
      const prompt = submission.unit === null ? null : unitLabel(game, submission.unit);

      return `<article class="card card--${escape(submission.verdict)}">
                ${media}
                <p class="card__who">${escape(names.get(submission.team_id) ?? '?')}</p>
                ${prompt ? `<p class="statusline">${escape(prompt)}</p>` : ''}
                ${submission.body ? `<p class="card__body">${escape(submission.body)}</p>` : ''}
                <p class="statusline">${escape(submission.verdict)} · ${escape(submission.created_at)}</p>
                ${judging}
              </article>`;
    })
    .join('');

  const explainer = {
    manual: 'You judge these. Award or reject each one.',
    trust: 'Judged on trust — points landed when they submitted. Nothing to press.',
    check: 'Judged automatically on submit. Read-only.',
    resolve: 'Judged across every team at game end. Read-only until then.',
  }[mode];

  return html(
    res,
    layout({
      title: game.title,
      still: true, // admin surface: judging a gallery, not arriving at a party page
      body: `
        <p class="statusline">${escape(explainer)}</p>
        <p class="statusline">${submissions.length} submission${submissions.length === 1 ? '' : 's'}</p>
        <div class="gallery">${cards || '<p>Nothing submitted yet.</p>'}</div>
        <a class="btn btn--close" href="/admin">back to the board</a>
      `,
    }),
  );
}

async function adminJudge({ req, res }) {
  if (!requireAdmin(req, res)) return undefined;

  const form = await readForm(req);
  const submissionId = Number(form.get('submission'));
  const verdict = form.get('verdict');
  const points = Number(form.get('points') ?? 0);

  const submission = get('select * from submissions where id = ?', submissionId);
  if (!submission) return redirect(res, '/admin');

  // A tally game's award must be a tally row: the ledger is unique on (team, game, kind,
  // source), so the wrong kind would open a second row per submission rather than upsert.
  const game = getGame(submission.game_id);
  const kind = game?.kind === 'tally' ? 'tally' : 'answer';

  transact(() => {
    run(
      "update submissions set verdict = ?, updated_at = datetime('now') where id = ?",
      verdict,
      submissionId,
    );
    award({
      teamId: submission.team_id,
      gameId: submission.game_id,
      kind,
      // Rejecting writes a zero rather than deleting, so re-judging upserts and a mis-tap costs
      // nothing permanent.
      points: verdict === 'correct' ? points : 0,
      reason: 'judged by the host',
      sourceId: submissionId,
    });
  });

  return redirect(res, `/admin/game/${submission.game_id}`);
}

/**
 * Hand a trophy over, or take it back. Its own route rather than a reuse of /admin/award, because
 * that one is the host's freehand escape hatch and deliberately *accumulates* — it stamps
 * `Date.now()` into `source_id` so two consolation points are two rows. A trophy is the opposite:
 * `source_id` stays null, so the upsert key is `(team, game, 'trophy', 0)` and a team can hold one
 * trophy exactly once however many times the button is pressed.
 */
async function adminTrophy({ req, res }) {
  if (!requireAdmin(req, res)) return undefined;

  const form = await readForm(req);
  const game = getGame(form.get('game'));
  if (!game || game.kind !== 'trophy') return redirect(res, '/admin');

  const holding = form.get('holding') === 'yes';

  award({
    teamId: Number(form.get('team')),
    gameId: game.id,
    kind: 'trophy',
    // Taking it back writes a zero rather than deleting the row — the same rule the gallery's
    // reject follows, so handing Teddy to the wrong team at 23:00 costs nothing permanent.
    points: holding ? game.points : 0,
    reason: holding ? 'was holding it' : 'handed it back',
  });

  return redirect(res, `/admin/game/${game.id}`);
}

async function adminAward({ req, res }) {
  if (!requireAdmin(req, res)) return undefined;

  const form = await readForm(req);
  award({
    teamId: Number(form.get('team')),
    kind: 'manual',
    points: Number(form.get('points') ?? 0),
    reason: form.get('reason') ?? 'because the host said so',
    sourceId: Date.now(), // manual awards accumulate rather than upserting over each other
  });

  return redirect(res, '/admin');
}

const adminEnd = ({ req, res }) => {
  if (!requireAdmin(req, res)) return undefined;
  endGame();
  return redirect(res, '/admin');
};

const adminReopen = ({ req, res }) => {
  if (!requireAdmin(req, res)) return undefined;
  reopenGame();
  return redirect(res, '/admin');
};

const adminRescore = ({ req, res }) => {
  if (!requireAdmin(req, res)) return undefined;
  rescore();
  return redirect(res, '/admin');
};

/**
 * The inventory, on screen. It exists for one question asked at 22:40 with a drink in hand:
 * "code seven is broken." The slug is printed on every card, so the host reads it off the paper
 * and finds the row -- which says what it should have done, whether its content exists, and how
 * many teams have already scanned it. A code nobody has ever scanned is lost or badly hidden; a
 * code with scans is fine and the complaint is about something else.
 */
function adminCodes({ req, res }) {
  if (!requireAdmin(req, res)) return undefined;

  const scans = new Map(
    all(`select slug, count(*) as total, sum(accepted) as accepted from scans group by slug`).map(
      (row) => [row.slug, row],
    ),
  );

  const rows = listCodes()
    .map(([slug, target], index) => {
      const seen = scans.get(slug);
      const pending = isPending(slug);
      return `
        <tr>
          <td class="mono">#${String(index + 1).padStart(2, '0')}</td>
          <td class="mono"><a href="/q/${escape(slug)}">${escape(slug)}</a></td>
          <td>${escape(target.label ?? '')}</td>
          <td class="mono">${escape(
            target.game ? `${target.game}${target.step ? ` step ${target.step}` : ''}` : target.page,
          )}</td>
          <td>${pending ? '<strong>PENDING</strong>' : 'ready'}</td>
          <td class="mono">${seen ? `${seen.accepted}/${seen.total}` : '&mdash;'}</td>
          <td>${escape(target.where ?? '')}</td>
        </tr>`;
    })
    .join('');

  return html(
    res,
    layout({
      title: 'Codes',
      still: true, // admin surface
      body: `
        <p>${listCodes().length} codes. Scans are shown as <em>accepted / total</em>; a code with
          no scans at all is the one that fell behind the radiator.</p>
        <table class="board">
          <thead>
            <tr><th>#</th><th>slug</th><th>label</th><th>target</th><th>content</th>
              <th>scans</th><th>where</th></tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <p class="mono">Print: <code>node scripts/qr-sheet.js</code> &middot;
          reprint one: <code>node scripts/qr-sheet.js --only=&lt;slug&gt;</code></p>
        <a class="btn btn--close" href="/admin">back to the board</a>
      `,
    }),
  );
}

// --- static -----------------------------------------------------------------------------------

async function serveFrom(rootDir, relativePath, res, { immutable = false } = {}) {
  const safe = normalize(relativePath).replace(/^(\.\.[/\\])+/, '').replace(/^[/\\]+/, '');
  const file = join(rootDir, safe);
  if (!file.startsWith(rootDir)) return html(res, notFound(), 403);

  try {
    const body = await readFile(file);
    const headers = { 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream' };

    if (immutable) {
      // An upload's name carries a random tail and its bytes never change, so a phone should
      // fetch each photo exactly once. This is what keeps a tile full of thumbnails cheap on
      // house wifi shared by fifteen teams. Pages stay uncached; only these bytes are.
      headers['Cache-Control'] = 'public, max-age=31536000, immutable';
    } else {
      noCache(res);
    }

    res.writeHead(200, headers);
    res.end(body);
  } catch {
    html(res, notFound(), 404);
  }
}

/**
 * The style kit, with the real components swapped in for their markers. Read and injected per
 * request rather than at boot, so `node --watch` picks up an edit to `kit.html` the same way it
 * picks up an edit to a component. See `src/kit.js` for the rule this enforces.
 */
async function serveKit({ res }) {
  html(res, inject(await readFile(join(PUBLIC_DIR, 'kit.html'), 'utf8')));
}

/**
 * Liveness for MM's container health check and for the pre-party walkthrough. Deliberately says
 * nothing about teams or scores -- it is the one route reachable without a cookie and without the
 * admin secret, so it must stay boring. It touches the database on purpose: a process that is
 * listening but cannot read its own file is not healthy.
 */
function healthz({ res }) {
  let body;
  let status = 200;

  try {
    get('select 1 as ok');
    body = {
      ok: true,
      games: listGames().length,
      uptime: Math.round(process.uptime()),
      node: process.version,
    };
  } catch (error) {
    status = 503;
    body = { ok: false, error: error.message };
  }

  noCache(res);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

// --- the inventory ------------------------------------------------------------------------------

const routes = [
  route('GET', '/q/:slug', handleScan),

  route('GET', '/', showDashboard),
  route('GET', '/welcome', showWelcome),
  route('POST', '/welcome', createTeamFromForm),
  route('GET', '/questions', showQuestions),
  route('POST', '/questions', saveQuestions),
  route('GET', '/g/:gameId', showGame),
  route('POST', '/g/:gameId/submit', submitToGame),
  route('POST', '/g/:gameId/hint', revealHint),
  route('GET', '/rules', showRules),
  route('GET', '/p/:pageId', showPage),
  route('GET', '/showdown', showShowdown),

  route('GET', '/admin/key/:secret', adminKey),
  route('GET', '/admin', adminBoard),
  route('GET', '/admin/game/:gameId', adminGame),
  route('POST', '/admin/judge', adminJudge),
  route('POST', '/admin/trophy', adminTrophy),
  route('POST', '/admin/award', adminAward),
  route('POST', '/admin/end', adminEnd),
  route('POST', '/admin/reopen', adminReopen),
  route('POST', '/admin/rescore', adminRescore),
  route('GET', '/admin/codes', adminCodes),

  route('GET', '/kit', serveKit),
  route('GET', '/healthz', healthz),
];

export async function handle(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);

  for (const candidate of routes) {
    const params = candidate.match(req.method, url.pathname);
    if (params) return candidate.handler({ req, res, params, url });
  }

  if (url.pathname.startsWith('/uploads/')) {
    return serveFrom(UPLOADS_DIR, url.pathname.slice('/uploads/'.length), res, { immutable: true });
  }

  if (/^\/(css|js|fonts|img)\//.test(url.pathname)) {
    return serveFrom(PUBLIC_DIR, url.pathname, res);
  }

  return html(res, notFound(), 404);
}
