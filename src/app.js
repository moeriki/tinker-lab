// The route inventory, wired. Every route in CONTEXT.md exists here: real where the domain is
// settled, an honest stub where a later ticket owns the design.

import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

import * as chrome from '../content/chrome.js';
import rulesCopy from '../content/rules.js';
import {
  ADMIN_COOKIE,
  ADMIN_SECRET,
  BUILD_COMMIT,
  IS_DEV,
  PENDING_COOKIE,
  PUBLIC_DIR,
  UPLOADS_DIR,
} from './config.js';
import { devAttach, devRoutes, isTestTeam } from './dev.js';
import { all, get, run, transact } from './db.js';
import { PULSE_MINUTES, codeCounts, progressPercent, pulse } from './hq.js';
import {
  assetIsPresent,
  getGame,
  getPage,
  getCode,
  getQuestion,
  gridSize,
  harvestQuestions,
  hasGrid,
  hasHand,
  hasHarvest,
  isFinal,
  isPending,
  judgingMode,
  ladderRungs,
  listCodes,
  listGames,
  listQuestions,
  questionSlots,
  hintStep,
  hintsFor,
  slugForPage,
  stepCount,
  getStep,
  takesForm,
  takesPhoto,
  requiresBody,
  verdictLine,
  unitCount,
  unitLabel,
  unitLabels,
} from './content.js';
import {
  cardScore,
  lineUnits,
  lockedUntil,
  minutesLeft,
  refusalFor,
  signaturesFor,
  teamByHandle,
} from './bingo.js';
import { handFor, namesFor } from './deals.js';
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
  allPhotos,
  allSubmissionsFor,
  award,
  awardHuntProgress,
  freezeGame,
  gameIsFrozen,
  gameScore,
  hasDiscoveredHintCost,
  hintCost,
  unfreezeGame,
  rescore,
  revealNextHint,
  revealedHints,
  gameHasEnded,
  standingBand,
  standings,
  standingsMessage,
  endGame,
  submissionsFor,
  teamScore,
} from './scoring.js';
import { deleteTeam, removableTeams, whatTeamHasDone } from './removal.js';
import { resetGame, whatWouldBeCleared } from './reset.js';
import { fireWebhook } from './webhooks.js';
import {
  blurb,
  boredButton,
  boredModal,
  bubble,
  card,
  field,
  hero,
  hintModal,
  layout,
  league,
  navbar,
  notFound,
  rulesList,
  scorebar,
  shoot,
  shot,
  shots,
  stamp,
  standing,
  starburst,
  stub,
  tile,
  unitRow,
  viewer,
  viewerPanel,
  wall,
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

/**
 * How often the two host readouts redraw themselves (#79). Thirty seconds: long enough not to
 * read as a flicker on a phone lying on a counter, short enough that "3 codes nobody has found"
 * is still true when the host looks up.
 *
 * It applies to `/admin` and to `/league` for a host, and to nothing else on the site. Both are
 * pure readouts -- no form, no typing -- which is the rule that lets them refresh at all.
 *
 * **Since #94 this is the `<noscript>` fallback only.** A whole-page reload flashes and throws
 * away the scroll position, which is exactly what a dashboard must not do, so the live path is
 * now `LIVE_SECONDS` polling against `/admin/live`. This stays because a reload is the only
 * self-updating a phone with JavaScript blocked can do, and it costs one line to keep.
 */
const ADMIN_REFRESH_SECONDS = 30;

/**
 * How often those readouts fetch their numbers when JavaScript runs (#94). Ten seconds, which is
 * three times the old reload and reads as live rather than as a page turning over.
 *
 * Dieter asked for one minute, having been told the page refreshed every thirty MINUTES; it was
 * thirty seconds. Once that was straightened out the ask was *"so it looks real-time"*, and this
 * is that ask rather than the number attached to the misunderstanding. A fetch is genuinely
 * cheap: `liveFragments()` is four counts and a fifteen-row board over local SQLite.
 *
 * Note the pulse's window is a different dial entirely and is thirty MINUTES on purpose -- it is
 * a stall detector, and see `src/hq.js` for why a short one would cry wolf.
 */
const LIVE_SECONDS = 10;

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

/**
 * After the freeze the site is read-only for teams. One guard, one place.
 *
 * It sends them BACK rather than onward to `/league`, which is the whole of #77 in one line: the
 * freeze is not the end, and the end is a separate press that may still be an hour away, so a
 * stale submit at 00:20 must not publish a results page nobody has released yet. `backTo` is the
 * page they were already on, per ADR-the-page-you-are-on-is-the-stage -- nobody is routed to the
 * dashboard to be told something, and `endNotice()` is on both pages to do the telling.
 */
const blockedByFreeze = (res, backTo = '/') => {
  if (!gameIsFrozen()) return false;
  redirect(res, backTo);
  return true;
};

/**
 * What the night is doing, said on the team's own pages. Three states, and the middle one is the
 * reason this exists: between the freeze and the end a team keeps the board they spent five hours
 * on, every control on it dead, and nothing else on the page would say why.
 *
 * The line after the end is also the only thing on this site that points a guest at `/league` --
 * the menu bar (#76) is where that link properly belongs, and this is what stops the results
 * being a page with no way in until it lands.
 */
const endNotice = () => {
  if (gameHasEnded()) {
    // The way on is a `.btn` and not a link inside the sentence. Written the other way first, and
    // it rendered as a raw purple underlined link: `app.css` styles anchors only as `.btn`,
    // because until this banner nothing on the guest side had ever put a link inside prose. The
    // fix is the site's own grammar rather than a new rule -- every "go somewhere" here is a
    // button-shaped thing.
    return `<p class="banner"><strong>That's the night.</strong> The scores are final and the
        table is up.</p>
      <a class="btn btn--primary" href="/league">see where you came</a>`;
  }
  if (gameIsFrozen()) {
    return `<p class="banner"><strong>Pens down.</strong> Nothing on this board will answer you
      now. The hosts are adding it all up, which should worry some of you more than others.</p>`;
  }
  return '';
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
 * it again for real. See ADR-the-first-scan-is-not-live.
 *
 * Returns the path to send them to, or null when the code points at a game content does not
 * define -- which the caller turns into a 404.
 */
function applyCode({ team, slug, target, deferred = false }) {
  // The scan is still recorded, so who was still hunting at midnight stays visible -- it just
  // buys nothing. They land on their own board, where `endNotice()` says which of the two endings
  // the night is in; before #77 this went straight to `/league`, which published the results to
  // anybody who scanned a code in the gap.
  if (gameIsFrozen()) {
    recordScan(team.id, slug, false);
    return '/';
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
    // to play, and the unlock plays on the hero they are already looking at.
    // ADR-the-page-you-are-on-is-the-stage.
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
  // docs/adr/one-home-assistant-webhook.md.
  const webhook = getStep(game, step)?.webhook;
  if (webhook && !deferred) fireWebhook(webhook, { team: team.name, game: game.id, step });

  // Every step banks as it is reached, not the whole hunt at the finish -- see awardHuntProgress.
  awardHuntProgress(team.id, game);

  // A deferred scan that owed a physical effect asks for it back. Otherwise: step 1 is an unlock,
  // and every step after it is a step transition, and they look different.
  if (deferred && webhook) return gamePath(game.id, { step, moment: 'rescan' });
  return gamePath(game.id, { step, moment: step === 1 ? 'unlock' : 'step' });
}

/**
 * A `HEAD` on the front door, which is deliberately NOT a dry run of the scan behind it.
 *
 * Every other route answers a HEAD by running its GET and letting Node drop the body, which is
 * free because those routes only read. This one is the exception named in
 * ADR-qr-entry-mutates-on-get: a scan writes a scan row, unlocks a tile, banks hunt progress and
 * fires the Home Assistant webhook, so the lights in a room are part of the response. A
 * link-preview crawler unfurling a code in a chat app, or an uptime monitor pointed at a printed
 * URL, would otherwise play the game for whoever owns the cookie it happens to be carrying -- and
 * flash a lamp at an empty room, spending the clue. Silence is a far better failure than that.
 *
 * So this answers the only question a HEAD can honestly ask about a code -- does it exist -- and
 * touches nothing. 200 for a real slug, 404 for one the inventory does not know, matching the
 * `noSuchCode` 404 a GET would give. It does not preview the `303`, because working out where
 * that redirect goes IS the scan.
 */
function peekScan({ res, params }) {
  const target = getCode(params.slug);
  noCache(res);
  res.writeHead(target ? 200 : 404, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end();
}

async function handleScan({ req, res, params }) {
  const target = getCode(params.slug);
  if (!target) return noSuchCode(res);

  // A real code whose content is not written yet. Impossible on the night -- the sheet generator
  // refuses to print while any code is pending -- but entirely normal during the week before,
  // when a test print exists and the game behind it does not.
  // ADR-codes-are-printed-from-the-inventory.
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
      nav: devNav(req),
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
        ${stamp(chrome.stamp)}
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
 * consumed by a game somebody else plays hours from now -- one answer per member becomes a Guess
 * Who card, and the five one-word answers are the corpus Herd Mentality scores against. A team
 * that skips does not merely skip their own tile; they put a hole in everyone's.
 *
 * One slot may be a LADDER (#22): several interchangeable questions of which a member answers one,
 * with "ask me something else" walking down them. Rung 1 asks what you wanted to be when you were
 * young, and that is a memory question -- somebody who genuinely cannot remember has nothing to
 * type into a required field, and the alternatives were a worse question or a hole in the deck.
 *
 * Skipping re-submits the whole form as a GET, so nothing typed is lost and no client JS comes
 * anywhere near onboarding -- the same trick the team name's reroll uses on screen one.
 */
function showQuestions({ req, res, url }) {
  const team = requireTeam(req, res);
  if (!team) return undefined;
  if (onboardingComplete(team.id)) return redirect(res, afterOnboarding(req, res, team));

  const members = membersOf(team.id);
  const answered = new Map(
    all('select member_id, question_id, value from profile_answers where team_id = ?', team.id).map(
      (row) => [`${row.question_id}:${row.member_id ?? ''}`, row.value],
    ),
  );

  // Which subject just tapped skip, as `slotId:memberId`. A button's own name/value is only
  // submitted for the button actually pressed, which is what makes one form able to carry two
  // members' skips without either of them knowing about the other.
  const skipped = url.searchParams.get('skip');

  /**
   * The rung a subject is looking at. Carried on the query string while they are skipping;
   * otherwise the rung they have already answered, so reopening a half-filled form does not quietly
   * undo somebody's skipping and lose the answer underneath it.
   */
  const rungFor = (slot, member) => {
    const subject = `${slot.id}:${member?.id ?? ''}`;
    const carried = url.searchParams.get(`rung:${subject}`);
    const saved = slot.rungs.findIndex((rung) => answered.has(`${rung.id}:${member?.id ?? ''}`));

    let index = carried === null ? Math.max(saved, 0) : Number(carried);
    if (!Number.isInteger(index) || index < 0) index = 0;
    if (skipped === subject) index += 1;

    return Math.min(index, slot.rungs.length - 1);
  };

  const fields = questionSlots()
    .flatMap((slot) =>
      (slot.scope === 'member' ? members : [null]).map((member) => ({ slot, member })),
    )
    .map(({ slot, member }) => {
      const index = rungFor(slot, member);
      const question = slot.rungs[index];
      const key = `${question.id}:${member?.id ?? ''}`;
      const subject = `${slot.id}:${member?.id ?? ''}`;

      // The member's name goes in the question, not in brackets after it: "what did ANNA want to
      // be" is a question, "what did you want to be (Anna)" is a form field.
      const label = member ? `${member.name}: ${question.label}` : question.label;

      const control = field({
        label,
        name: key,
        type: question.input ?? 'text',
        options: question.input === 'select' ? question.options : null,
        value: url.searchParams.get(key) ?? answered.get(key) ?? '',
        attrs: {
          maxlength: Number(question.maxLength ?? 40),
          placeholder: question.placeholder ?? '',
          autocomplete: 'off',
          autocapitalize: 'off',
          required: true,
        },
      });

      // The rung has to survive the round trip, or a second skip would start again from the top.
      const carry =
        slot.rungs.length > 1
          ? `<input type="hidden" name="rung:${escape(subject)}" value="${index}">`
          : '';

      // No skip under the last rung. Everyone contributes exactly one answer, which is what lets
      // this stay a gate with nothing to represent an opt-out -- and it is why the last rung is a
      // possession rather than a memory: everybody owns something useless.
      const skip =
        index < slot.rungs.length - 1
          ? `<button class="btn" formmethod="get" formaction="/questions" formnovalidate
                     name="skip" value="${escape(subject)}">ask me something else</button>`
          : '';

      return `${control}${carry}${skip}`;
    })
    .join('');

  const problem = QUESTION_PROBLEMS[url.searchParams.get('problem')];

  return html(
    res,
    layout({
      title: 'Two seconds each',
      nav: devNav(req),
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

      // Only fields naming a real question become answers. The form also carries `rung:` markers
      // and a `skip` button, and the old loop would have written those in as questions of their
      // own -- rows nothing ever reads, under ids no content declares.
      const question = getQuestion(questionId);
      if (!question) continue;

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

      // A member holds exactly ONE rung of a ladder, so answering this one drops whatever they
      // typed into a rung they have since skipped past. Without this a member who typed something,
      // skipped, and answered the next rung would leave two answers behind -- and the abandoned one
      // would be dealt to somebody as a card whose owner never claims it, since the question they
      // remember answering is the other one.
      if (question.ladder) {
        const siblings = ladderRungs(question.ladder)
          .map((rung) => rung.id)
          .filter((id) => id !== questionId);

        if (siblings.length) {
          run(
            `delete from profile_answers
              where team_id = ? and ifnull(member_id, -1) = ?
                and question_id in (${siblings.map(() => '?').join(', ')})`,
            team.id,
            memberId ?? -1,
            ...siblings,
          );
        }
      }
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
 * ADR-the-first-scan-is-not-live. A team who arrived by typing the address instead of scanning
 * anything has no pending slug and simply lands on their board.
 */
function afterOnboarding(req, res, team) {
  const pending = parseCookies(req)[PENDING_COOKIE];
  if (!pending) return '/';

  // The second and last way a GET reaches `applyCode`: `GET /questions` by a team already through
  // the gate. A HEAD gets the same 303 without spending the held code -- the slug stays in the
  // cookie, so the team's own next GET still gets everything it was owed.
  if (req.method === 'HEAD') return '/';

  clearCookie(res, PENDING_COOKIE);

  const target = getCode(pending);
  if (!target || isPending(pending)) return '/';

  return applyCode({ team, slug: pending, target, deferred: true }) ?? '/';
}

// --- the menu bar -----------------------------------------------------------------------------

/**
 * Which links this request gets (#76). This half is the GATE -- who you are, and how far the night
 * has got; the words themselves are `menuFor()` in `content/chrome.js`, which is where a copy pass
 * can find them and where `/kit` reads them from too.
 *
 * Server-rendered on every page load and nothing else: no counts, no badges, nothing that could be
 * stale by the time it is read. A count on `court` was the obvious candidate and lost, and it
 * still loses now that two pages refresh themselves (#79): the bar is on every page including the
 * eleven that do not, so a number in it would be stale on nine of them.
 *
 * **A host is never a team.** Settled while resolving #76: one host runs the admin and does not
 * play, the other plays and is an ordinary guest. So the two bars never appear on one device and
 * no word has to mean two pages at once.
 *
 * **The reveal is the end, not the freeze** (#77), which is why this reads
 * `gameHasEnded()` and not `gameIsFrozen()`. The gap between them is the hour in which the
 * hosts finish the queue, and a guest whose bar had already sprouted `league` during it would be
 * one tap from an ending nobody has read out yet.
 *
 * **`IS_DEV` is the third input** (#96), and it is a build fact rather than a request fact --
 * which is why it is read here, next to the other two, instead of being threaded down from the
 * routes. It is also the whole of what is left of the dev build's chrome: `devBar()` is deleted
 * and `navbar()` draws this bar yellow instead.
 */
function navFor(req, here) {
  const items = chrome.menuFor({
    admin: isAdmin(req),
    ended: gameHasEnded(),
    dev: IS_DEV,
  });

  return navbar(items.map((item) => ({ ...item, here: item.href === here })));
}

/**
 * The bar on the two pages that have never had one -- `/welcome` and `/questions` -- and only on a
 * dev build (#96).
 *
 * The front door is bare by design and stays bare on the night: a page whose entire job is "type
 * two names" offers nowhere else to be, and a team that has not registered has no surface to
 * navigate to. Nothing here changes that. This is the dev build's badge, and it is on these two
 * pages for the two reasons the badge exists at all.
 *
 * **It says which build this is, on the page a stranger sees first.** `devBar()` was on every page
 * without asking; the yellow that replaced it rides the menu, and the menu is exactly what these
 * two pages do not have. #69 put a dev build on `bday.moeriki.com` and nothing took it off by
 * itself -- `/welcome` is where that build says hello, and it would have been the one page left
 * with no way to tell.
 *
 * **It is the way back in.** `/dev/logout` drops the team cookie and lands here so real onboarding
 * can be walked, and the toggle that undoes it now lives on `/admin/controls`. Without a bar, the
 * walk out is one tap and the walk back is typing an admin URL from memory. The admin cookie
 * survives the logout -- `devAttach()` re-plants it every request -- so the bar this draws is the
 * host's, `HQ` and all, which is precisely the door back.
 */
const devNav = (req) => (IS_DEV ? navFor(req) : '');

// --- dashboard, games, rules ------------------------------------------------------------------

/**
 * The board, and the **I'm bored** button under it (#95).
 *
 * That button is on this page in **all three states of the night**, and the absence of a gate is
 * the decision, not an oversight. The ticket asked whether it should exist before onboarding is
 * finished or after the showdown starts. The first half is answered by the line below:
 * `requireOnboardedTeam` means there is no board to put it on until the door questions are done,
 * so "before onboarding" is not a state this button can be in.
 *
 * The second half is a judgement. It stays through the freeze, because the freeze is the most
 * bored anyone is all night -- `endNotice()` says "nothing on this board will answer you now", and
 * this is the one control on the page that was never going to answer you anyway, so it is the only
 * thing that survives that sentence honestly. And it stays after the end, sat below the results
 * banner and `the rules`, where a team that presses it gets `Conga line?` at a party whose scoring
 * has stopped, which is the suggestion working rather than failing. A gate here would also be a
 * branch the next dashboard ticket inherits without knowing why.
 */
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
    //
    // `unlocked &&` is load-bearing and was missing: this branch used to overwrite `locked`
    // unconditionally, so both photo tiles rendered as open links from the first minute of the
    // night for every team, before anyone had scanned either code. Tapping one hit `showGame`,
    // which checks the unlock properly, and returned the 404 page -- a tile that looks open, is
    // not, and says so only after a tap. It also quietly spent the thing #7 designed the locked
    // wall to do, which is send people prowling. Found while giving the signature card the same
    // ledger-decides treatment (#21).
    if (unlocked && judgingMode(game) === 'trust') {
      const budget = unitCount(game) * (game.points ?? 0);
      state = budget && points >= budget ? 'correct' : 'unlocked';
    }
    // A trophy never holds a submission, so the ledger is the only thing that knows. A team that
    // was not handed it sits at unlocked and zero -- never `wrong`, since they were never asked a
    // question they could get wrong.
    if (game.kind === 'trophy' && points > 0) state = 'correct';

    // A signature card, where the generic block above is wrong in BOTH directions -- the same
    // shape #25 found on the trust tiles, and worse here because one of the two is a slander.
    //
    // It would paint `correct` on the first signature, when green everywhere else on this board
    // means finished; a card with one square filled has eight hours of work left in it. And it
    // would paint `wrong` for a team whose only row so far is a refused signature -- a mishearing
    // at 20:40 marking the tile as failed for the rest of the night, on a tile that cannot be
    // failed. There is no wrong answer on a card: there is a line, or there is not yet.
    //
    // So the ledger decides, exactly as it does for a trust tile and a trophy, and `wrong` is
    // unreachable here by construction.
    // `unlocked &&` for the reason the branch above now carries it: this tile is a starter today,
    // so a locked card cannot happen -- but the guard is what stops that being an assumption the
    // next grid game inherits without knowing.
    if (unlocked && hasGrid(game)) {
      state = game.bingo && points >= game.bingo ? 'correct' : 'unlocked';
    }

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
      nav: navFor(req, '/'),

      // The bored box (#95) rides the modal slot for the reason the hint box does -- outside
      // `.app`, ahead of it -- and is the first thing this site renders there shut. See
      // `boredModal()`.
      modal: boredModal(),
      body: `
        ${endNotice()}
        ${standing({ band: standingBand(team.id), text: standingsMessage(team.id) })}
        <div class="tiles">${grid}</div>
        <a class="btn" href="/rules">the rules</a>
        ${boredButton()}
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

/**
 * The words a stored body was picked from, where the form offered a list. `submissions.body` holds
 * the option's VALUE -- "3" -- and reading "You answered 3" back to somebody is not a sentence.
 *
 * Normalising a bare string to `{ value, label }` mirrors `field()` in render.js, which is not
 * drift: that one is deciding what to draw and this one is deciding what to say. Falls back to the
 * raw body, so a value whose option has since been edited out of content still reads as something.
 */
const optionLabel = (game, body) =>
  (game.form?.options ?? [])
    .map((option) => (typeof option === 'string' ? { value: option, label: option } : option))
    .find((option) => String(option.value) === String(body))?.label ?? body;

/**
 * What a game with a final answer shows where its form used to be: what this team said, and how it
 * went. A `pending` verdict is possible in principle -- a final game judged at game end rather than
 * on submit -- so it gets an honest line instead of being assumed away.
 */
function answeredStage(game, submission) {
  const outcome =
    { correct: 'That was right.', incorrect: 'That was wrong.' }[submission.verdict] ??
    'Nobody has judged it yet.';

  return `<p class="statusline">You answered ${escape(optionLabel(game, submission.body))}. ${escape(outcome)}</p>`;
}

/**
 * How long a quote may be. One constant rather than two, because the box that accepts it and the
 * redirect that carries it back after a bounce have to agree or a sentence gets silently truncated
 * on the way home.
 */
const QUOTE_MAX = 140;

const SUBMIT_PROBLEMS = {
  toobig: 'That photo was too big to send. Take a new one and try again.',
  notaphoto: "That file wasn't a photo — at least, not one we know how to read.",
  empty: 'Nothing arrived. Pick a photo first.',
  noquote: 'Almost — this one needs a sentence they actually said. Type it and send again.',
  nophoto: 'A quote on its own is only half a portrait. Take the photo too.',
  // A stale tab, or a prompt list that changed under someone mid-photo. Never a thing a guest
  // can do wrong by tapping, so it explains itself and points at the only fix.
  nounit: "That prompt isn't on the list any more. Reopen the tile and pick one from it.",
  // A dropdown submitted while still on "— pick one —". On a game whose answer is final this is
  // the difference between a bounce and losing the whole tile to a mis-tap, which is why an empty
  // choice can never be allowed to reach check().
  nochoice: 'Pick one from the list first.',
  // A second answer to a game that only takes one. A stale tab or the back button -- the form is
  // not on the page any more, so nobody can reach this by tapping what they were shown.
  spent: 'You have already answered this one, and that answer was final.',

  // --- the signature card's three refusals (#21) -------------------------------------------------
  //
  // Only the first of these costs anything. The other two are things a guest can do by misreading
  // the rules rather than by forging a signature, and a forger already knows both -- so a penalty
  // on them would buy no protection and only punish the honest. See `refusalFor` in src/bingo.js.
  //
  // The locked line is built at render time rather than sitting here, because it has to say how
  // many minutes are left.
  unknown: 'Nobody here is called that. Check the spelling with them — and the card is shut for a while now.',
  yourself: 'You cannot sign your own card. Go and find somebody else.',
  nosquare: "That square isn't open. Reopen the tile and pick one that still is.",
  noname: 'Type the name of the team that matched, exactly as they said it.',
  usedname: 'That name is already on your card, and each one only counts once. Look at the grid — it is up there somewhere.',
};

/** The one refusal whose sentence needs a number in it. */
const lockedLine = (minutes) =>
  `The card is shut for another ${minutes} minute${minutes === 1 ? '' : 's'}. ` +
  `Keep collecting names while you wait — you can still write them in afterwards.`;

/**
 * What `shot()` needs to draw one submission: which of the three photo columns to point at, and
 * what to call the format when there is nothing to point at. This mapping is the whole reason
 * render.js takes resolved entries rather than rows -- it is database knowledge, and render.js
 * has none.
 */
const photoCell = (submission) => ({
  href: `/uploads/${submission.photo_path}`,
  src: displayFor(submission).src ?? '',
  label: submission.photo_mime ?? 'file',
});

/** The one cell, shared by the strip, the prompt checklist and the admin gallery. */
const shotCell = (submission, anim = '') => shot({ ...photoCell(submission), anim });

/**
 * A team's own photos, back to them. Thumbnails are the extracted EXIF ones where the camera
 * embedded any, so reopening a tile with six photos on it costs kilobytes and not megabytes.
 */
const photoStrip = (submissions, newestAnim = '') =>
  shots(submissions.filter((submission) => submission.photo_path).map(photoCell), newestAnim);

/** The camera control, posting one unit of one game. `unit` is null where the units are anonymous. */
function shootForm(game, { unit = null, face, primary = true, body = null }) {
  return `<form class="stack stack--tight" method="post" action="/g/${escape(game.id)}/submit"
                enctype="multipart/form-data">
            ${unit === null ? '' : `<input type="hidden" name="unit" value="${Number(unit)}">`}
            ${shoot({ face })}
            ${body ?? ''}
            <button class="btn ${primary ? 'btn--primary' : ''}" ${gameIsFrozen() ? 'disabled' : ''}>send</button>
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
      if (!done) return unitRow({ body: shootForm(game, { unit, face: label }) });

      const moving = done.id === newest?.id ? newestAnim : '';
      return unitRow({
        shot: shotCell(done, moving),
        label: `✓ ${label}`,
        body: shootForm(game, { unit, face: 'retake', primary: false }),
      });
    })
    .join('');

  return `<p class="statusline">${shots.size} of ${labels.length} — ${shots.size} point${
    shots.size === 1 ? '' : 's'
  }</p>
          <ul class="units">${rows}</ul>`;
}

/**
 * Portrait of a stranger: anonymous units, so there is no list to tick off -- just a count, the
 * portraits so far with what was said under each, and one form.
 *
 * The quote is required here and nowhere else on the site, which is why it sits inside the form
 * rather than beside it: a photograph with nothing said is not a portrait, and bouncing it is
 * the tile working rather than the tile failing.
 *
 * `draft` is that sentence coming back after a bounce. The box cannot fall back to the last
 * submission the way an `answer` game's does -- on a tally, the previous row is a DIFFERENT
 * portrait rather than an earlier take of this one -- so a bounced sentence has nowhere to come
 * from except the redirect that bounced it.
 */
function portraitStage(game, mine, newestAnim, draft = '') {
  const cap = unitCount(game);
  const sent = mine.filter((submission) => submission.photo_path);
  const paid = Math.min(sent.length, cap);
  const newest = sent.at(-1);

  const gallery = sent.length
    ? `<ul class="units">${sent
        .map((submission) =>
          unitRow({
            shot: shotCell(submission, submission.id === newest?.id ? newestAnim : ''),
            label: `“${submission.body ?? ''}”`,
          }),
        )
        .join('')}</ul>`
    : '';

  const quote = `<input class="input" name="body" maxlength="${QUOTE_MAX}" ${placeholderOf(game)}
                        value="${escape(draft)}">`;

  return `<p class="statusline">${paid} of ${cap} — ${paid} point${paid === 1 ? '' : 's'}</p>
          ${gallery}
          ${shootForm(game, { face: sent.length ? 'another portrait' : 'take a portrait', body: quote })}`;
}

/**
 * Guess Who: the ten cards this team was dealt, each an answer somebody gave at the door, wearing
 * the question it answered, with a dropdown naming who you think wrote it.
 *
 * ONE form and one save button, not ten. Every other unit game posts a unit at a time because each
 * one carries a photograph; these are ten dropdowns on one screen, and making a team tap save ten
 * times would be the two-taps-twenty-times complaint of #49 with nothing bought for it.
 *
 * A DROPDOWN rather than a typed name, and that is not a convenience. A member's name is whatever
 * their partner typed at the door: you know her as Sofie, her boyfriend entered Sofietje, and under
 * typing you would have had the actual conversation, got the actual answer and lost the point
 * anyway. Picking a person by id deletes that failure, and the two-people-called-Jan case with it.
 *
 * The list is the WHOLE party, not the ten people on the cards -- narrowing it to the answer key
 * would hand the game away. It grows all night at no cost: the cards were dealt from people who
 * already existed, so the right name is always in the list and a late arrival only adds a wrong one.
 *
 * Nothing here says how many are RIGHT. This game resolves at the end of the night, and it has to:
 * a verdict on submit would let a team sit on the sofa cycling names until the tile went green,
 * which is the one way to score this tile without talking to anybody.
 */
function cardStage(game, team, mine) {
  const hand = handFor(team.id, game);

  if (!hand.length) {
    return `<p class="statusline">No cards yet — nobody else has been through the door.</p>
            <p>Come back in a bit. This tile deals from what other guests answered on their way
              in, so it fills up as the house does.</p>`;
  }

  const people = namesFor(team.id);
  const guesses = new Map(
    mine.filter((submission) => submission.unit !== null).map((row) => [row.unit, row.body]),
  );

  const named = hand.filter((card) => guesses.get(card.unit)).length;

  const rows = hand
    .map(
      (card) =>
        unitRow({
          label: card.prompt,
          body: `${bubble(card.answer)}
            ${field({
              label: 'who wrote this?',
              name: `card-${card.unit}`,
              value: guesses.get(card.unit) ?? '',
              options: [{ value: '', label: '— no idea yet —' }, ...people],
            })}`,
        }),
    )
    .join('');

  return `<p class="statusline">${named} of ${hand.length} named</p>
          <form class="stack" method="post" action="/g/${escape(game.id)}/submit">
            <ul class="units">${rows}</ul>
            <button class="btn btn--primary" ${gameIsFrozen() ? 'disabled' : ''}>Save my guesses</button>
          </form>`;
}

/**
 * Herd Mentality's page: the five questions asked at the door, with an empty box under each.
 *
 * THE PAGE IS BLIND, and every absence here is deliberate (#23). It shows no running tally, no
 * sample of what anyone said, and NOT this team's own answers read back to them -- the questions
 * arrive with exactly as much information as the guest is carrying in their head. Anything shown
 * here would make the tile a lookup rather than a prediction, and would hand a team arriving at
 * 23:00 a better board than one that arrived at 20:00.
 *
 * All five post together under one button, like a dealt hand and unlike the photo tiles, because
 * five separate sends is four more taps than a party will tolerate. Predictions are editable until
 * game end, so the boxes come back filled with whatever was last saved.
 */
function herdStage(game, mine) {
  const questions = harvestQuestions(game);

  // One row per unit, last save wins. `saveUnits` rewrites in place, so there is at most one.
  const said = new Map();
  for (const submission of mine) {
    if (submission.unit !== null) said.set(submission.unit, submission.body ?? '');
  }

  const answered = questions.filter((_, unit) => said.get(unit)).length;

  const rows = questions
    .map((question, unit) => {
      const label = question?.label ?? `question ${unit + 1}`;
      return unitRow({
        body: field({
          label,
          name: `unit-${unit}`,
          value: said.get(unit) ?? '',
          attrs: {
            maxlength: question?.maxLength ?? 24,
            placeholder: question?.placeholder ?? 'one word',
            // A phone that helpfully completes the box with what this guest typed at the door
            // would quietly undo the blindness the whole tile is built on.
            autocomplete: 'off',
            autocapitalize: 'none',
          },
        }),
      });
    })
    .join('');

  return `<p class="statusline">${answered} of ${questions.length} predicted</p>
          <form class="stack" method="post" action="/g/${escape(game.id)}/submit">
            <ul class="units">${rows}</ul>
            <button class="btn btn--primary" ${gameIsFrozen() ? 'disabled' : ''}>Save my answers</button>
          </form>`;
}

/**
 * Sign Here's stage: the card, and whatever belongs under it in this state.
 *
 * The grid itself is `card()` in `src/render.js` (#60) -- including the rule that it is ALWAYS
 * DRAWN, which is a property of the component and not of any one branch below. What this function
 * owns is the sentence above it and the form under it, which is where every state actually differs.
 *
 * ONE FORM, TWO FIELDS, rather than nine boxes in nine squares. The physical moment this has to
 * match is standing in front of a pair who have just said "I've broken a bone": what you need to
 * record is which square and whose name, and a 3x3 of tiny inputs on a phone is a worse way to say
 * that than a dropdown of the squares still open. It also makes an attempt a single submission,
 * which is what lets a refusal be priced (#21) instead of being one bad box among nine.
 *
 * THE FORM CLOSES ON A LINE, and that is deliberate against the precedent of the photo tiles,
 * which never close. A tenth photograph is still a photograph the party wanted; a seventh
 * signature after a line is worth exactly nothing, since `bingo` pays INSTEAD of the squares. A
 * form that accepts input and pays nothing is the failure shape this codebase keeps finding, so
 * the card says it is finished and stops taking names.
 */
function bingoStage(game, team) {
  const signed = signaturesFor(team.id, game.id);
  const winning = lineUnits(game, signed);
  const labels = unitLabels(game);
  const until = winning.size ? null : lockedUntil(team.id, game);

  // The squares are data, not markup: `card()` renders every one of them (#60). Which squares are
  // green and which are yellow is the only thing this page knows that the design system cannot --
  // a line is a fact about the scorer's geometry, so it is passed in while `signed` derives itself.
  const grid = card(
    labels.map((label, unit) => ({
      trait: label,
      signature: signed.get(unit) ?? '',
      line: winning.has(unit),
    })),
    gridSize(game),
  );

  // Only the squares still open, so the dropdown shrinks as the card fills and a signed square
  // can never be overwritten by a mis-tap.
  const open = labels
    .map((label, unit) => ({ value: String(unit), label }))
    .filter((option) => !signed.has(Number(option.value)));

  if (winning.size) {
    return `<p class="statusline">${signed.size} of ${labels.length} signed — line complete</p>
            ${grid}
            <p>That is the tile. Nothing more to collect here, and no more names to spend.</p>`;
  }

  if (until) {
    return `<p class="statusline">${signed.size} of ${labels.length} signed</p>
            ${grid}
            <p class="banner banner--bad">${escape(lockedLine(minutesLeft(until)))}</p>`;
  }

  if (!open.length) {
    // Unreachable by arithmetic -- a full card on a square grid always contains a line -- but a
    // grid of 2 would make it reachable, and an empty dropdown is worse than a sentence.
    return `<p class="statusline">${signed.size} of ${labels.length} signed</p>${grid}`;
  }

  return `<p class="statusline">${signed.size} of ${labels.length} signed</p>
          ${grid}
          <form class="stack" method="post" action="/g/${escape(game.id)}/submit">
            ${field({
              label: 'which square?',
              name: 'unit',
              options: [{ value: '', label: '— pick one —' }, ...open],
            })}
            ${field({
              label: 'their team name',
              name: 'body',
              attrs: {
                maxlength: 24,
                placeholder: 'BADGER',
                // Their handle, not a word this phone has seen before. A keyboard offering to
                // finish it from the team's own history would offer their OWN name first.
                autocomplete: 'off',
                autocapitalize: 'characters',
              },
            })}
            <button class="btn btn--primary" ${gameIsFrozen() ? 'disabled' : ''}>Sign it</button>
          </form>`;
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

  const hints = revealedHints(team.id, game.id, hintStep(game, step));
  const remaining = hintsFor(game, step).length - hints.length;

  const mine = submissionsFor(team.id, game.id);
  const problem = SUBMIT_PROBLEMS[url.searchParams.get('problem')];
  // The sentence a bounced submission was carrying, back in the box it was typed into. Free text
  // rather than a closed vocabulary, and capped on arrival as well as on departure -- see
  // `backToGame`, which is the only thing that ever writes it.
  const draft = (url.searchParams.get('draft') ?? '').slice(0, QUOTE_MAX);
  const wantsPhoto = takesPhoto(game);

  // What just happened, delivered here rather than to the dashboard. See
  // ADR-the-page-you-are-on-is-the-stage.
  const moment = momentOf(url);
  // A game may bring its own words for what just happened. Forced by `final`, not a flourish: the
  // site-wide `incorrect` line offers to let you change your answer, which a game that has just
  // closed its form cannot honour. See src/moments.js.
  const submitted = verdictLine(game, moment) ?? SUBMITTED[moment];

  // The one arrival that carries an instruction rather than a verdict: a hunt code scanned before
  // this team existed, whose webhook was deliberately not fired. ADR-the-first-scan-is-not-live.
  const arrival = ARRIVED[moment];

  // A reveal that has already happened, announcing what it cost. Rendered only when there is a
  // price to name -- every other visit to this page carries no modal at all.
  const notice = hintNoticeOf(url);

  // A hunt's hero belongs to the step it is on; every other kind has one of its own.
  const source = game.kind === 'hunt' ? getStep(game, step)?.hero : game.hero;

  const heroBlock =
    hero({ ...source, anim: heroAnimation(moment), assetExists: assetIsPresent(source?.asset) }) +
    (game.blurb ? blurb(game.blurb) : '');

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
  } else if (hasGrid(game)) {
    // Units whose layout is a scoring rule, so the stage draws them as a card rather than as a
    // list. It sits above the branches below because its units are labelled, and both of them
    // read a labelled unit as something else -- a photo prompt, or a question asked at the door.
    stage = `${heroBlock}
             ${bingoStage(game, team)}`;
  } else if (hasHand(game)) {
    // Units dealt per team rather than declared in content, so the stage has to ask the database
    // what this team is even holding before it can draw anything.
    stage = `${heroBlock}
             ${cardStage(game, team, mine)}`;
  } else if (hasHarvest(game)) {
    // Units that are questions asked at the door. It sits above the branch below because its units
    // ARE labelled -- they are the questions -- and that branch reads a labelled unit as a photo
    // prompt with a camera under it.
    stage = `${heroBlock}
             ${herdStage(game, mine)}`;
  } else if (unitCount(game)) {
    // A game that pays per unit composes its own stage: the units are the page, and the generic
    // one-form-and-a-strip below cannot say which of them are still open.
    stage = `${heroBlock}
             ${
               unitLabels(game).length
                 ? promptChecklist(game, mine, shotAnimation(moment))
                 : portraitStage(game, mine, shotAnimation(moment), draft)
             }`;
  } else if (isFinal(game) && mine.length) {
    // This game has taken the one answer it takes, so there is no form left to draw. What goes in
    // its place is the answer itself: the arrival banner is spent on first paint, and a team
    // reopening the tile an hour later would otherwise meet a hero, no form, and not a word about
    // what they said or how it went.
    stage = `${heroBlock}
             ${answeredStage(game, mine[0])}`;
  } else {
    stage = `${heroBlock}
             ${wantsPhoto ? photoStrip(mine, shotAnimation(moment)) : ''}
             <form class="stack" method="post" action="/g/${escape(game.id)}/submit"
                   ${wantsPhoto ? 'enctype="multipart/form-data"' : ''}>
               ${
                 wantsPhoto
                   ? shoot({
                       face: mine.some((s) => s.photo_path) ? 'take another' : 'take a photo',
                     })
                   : ''
               }
               ${
                 game.form?.options
                   ? field({
                       label: game.form.label ?? '',
                       name: 'body',
                       value: mine.at(-1)?.body ?? '',
                       options: game.form.options,
                     })
                   : `<input class="input" name="body"
                      ${wantsPhoto ? 'placeholder="say something about it (optional)"' : placeholderOf(game)}
                      ${game.form?.inputmode ? `inputmode="${escape(game.form.inputmode)}"` : ''}
                      value="${escape(draft || (game.kind === 'tally' ? '' : mine.at(-1)?.body ?? ''))}">`
               }
               <button class="btn btn--primary" ${gameIsFrozen() ? 'disabled' : ''}>Submit</button>
             </form>`;
  }

  return html(
    res,
    layout({
      title: escape(game.title),
      bar: teamBar(team),
      nav: navFor(req),
      modal: notice
        ? hintModal({ notice, cost: hintCost(), backHref: gamePath(game.id, { step }) })
        : '',
      body: `
        ${endNotice()}
        ${problem ? `<p class="banner banner--bad">${escape(problem)}</p>` : ''}
        ${arrival ? `<p class="banner">${escape(arrival)}</p>` : ''}
        ${submitted ? `<p class="banner${verdictAnimation(moment)}">${escape(submitted)}</p>` : ''}
        ${stage}
        ${
          // Only when there ARE hints. An empty `<ul>` is not nothing: it keeps the browser's
          // `margin: 1em 0` and picks up a `.stack` gap on either side, so a team that has
          // revealed none -- which is every team on every tile until they pay, and forever on the
          // four that declare no hints at all -- got 64px of dead air under the stage. On Teddy
          // that is the whole gap between the blurb and the close link.
          hints.length
            ? `<ul class="stack stack--tight">
          ${hints.map((hint) => `<li>${bubble(hintsFor(game, step)[hint.hint_index])}</li>`).join('')}
        </ul>`
            : ''
        }
        ${
          remaining > 0 && !gameIsFrozen()
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
 *
 * `draft` carries the typed body home so the box comes back filled. Portrait of a stranger is the
 * first game where a bounce and a typed sentence can coexist, and the halves are not equal: the
 * expensive half is the sentence, the cheap half is the tap. Bouncing the tap must never charge
 * the sentence.
 *
 * It is the only FREE-TEXT query parameter on this site -- `problem`, `just`, `hint` and `step`
 * are closed vocabularies -- and the exception is deliberate. A bounce is a PRG redirect, so there
 * is nowhere else the text survives; it is the guest's own sentence on its way into the database
 * regardless; and the alternative of holding a half-written submission in a row would invent a
 * draft state for every game to carry. Capped at the length the box accepts, so a hand-edited URL
 * cannot arrive longer than something a phone could have typed.
 */
const backToGame = (res, game, problem, draft = '') => {
  const query = new URLSearchParams();
  if (problem) query.set('problem', problem);
  if (draft) query.set('draft', draft.slice(0, QUOTE_MAX));
  const suffix = query.toString();
  return redirect(res, `/g/${game.id}${suffix ? `?${suffix}` : ''}`);
};

/**
 * Every card of a dealt hand, saved in one press.
 *
 * One submission row per (team, unit), rewritten in place, because a guess is a thing you CHANGE
 * rather than a thing you add to -- there is no history worth keeping of who you briefly suspected.
 * Nothing is judged and nothing is awarded here: the game resolves across every team at the end of
 * the night, which is what stops a team brute-forcing the list from the sofa.
 *
 * A name that is not somebody at this party -- a stale tab, a hand-edited option -- is stored as no
 * guess at all rather than bounced. Nine good guesses must not be lost to one bad option, and the
 * card is still sitting there to be answered again.
 */
/**
 * Write one submission row per (team, unit), rewritten in place.
 *
 * The shape both all-at-once tiles need: a guess and a prediction are things you CHANGE rather than
 * things you add to, so there is no history worth keeping of who you briefly suspected or what you
 * first thought the room would say. Nothing is judged and nothing is awarded here -- both games
 * resolve across every team at the end of the night, which is what stops a team brute-forcing the
 * answers from the sofa.
 *
 * `values` is a Map of unit to the already-cleaned body, because what counts as a usable answer is
 * the game's business: Guess Who drops a name that is not somebody at this party, Herd Mentality
 * takes any word at all.
 */
function saveUnits({ team, game, values }) {
  transact(() => {
    for (const [unit, body] of values) {
      const existing = get(
        'select id from submissions where team_id = ? and game_id = ? and unit = ?',
        team.id,
        game.id,
        unit,
      );

      if (existing) {
        run(
          "update submissions set body = ?, updated_at = datetime('now') where id = ?",
          body,
          existing.id,
        );
      } else if (body) {
        // A unit nobody has answered yet gets no row at all, so an untouched form leaves the
        // database exactly as it found it.
        run(
          'insert into submissions (team_id, game_id, body, unit) values (?, ?, ?, ?)',
          team.id,
          game.id,
          body,
          unit,
        );
      }
    }
  });
}

/**
 * One signature, onto one square of a card.
 *
 * THE WHOLE CARD IS RESCORED ON EVERY SIGNATURE and written as a SINGLE award row, which is the
 * one place this tile departs from the ledger's award-per-unit habit (#25). It has to: a line pays
 * `bingo` INSTEAD of the squares that made it, so the tile's worth is a function of the grid and
 * not a sum over its units. Nine per-unit rows plus a bonus row could not express "the 3 you had
 * stops counting" without deleting rows, and deleting from a ledger is the one thing it does not
 * do. One row keyed on `sourceId: 0` upserts on every submission and is always the current truth.
 *
 * The stored body is the OWNER'S OWN SPELLING rather than what was typed. The match is fuzzy, so
 * `WALRUSS` and `walrus` both land on WALRUS -- and storing the canonical word is what lets the
 * once-per-card rule be an exact comparison later, rather than a second fuzzy pass that could
 * disagree with the first.
 */
async function saveSignature({ req, res, team, game }) {
  const form = await readForm(req);
  const signed = signaturesFor(team.id, game.id);

  // Finished. The form is gone from the page the moment a line lands, so this is a stale tab or
  // the back button -- and without it a team could keep signing a card that pays 10 either way.
  if (lineUnits(game, signed).size) return redirect(res, `/g/${game.id}`);

  // Shut. The stage draws the lock and the minutes left, so this needs no problem of its own; the
  // page it lands on already says what happened and for how long.
  if (lockedUntil(team.id, game)) return redirect(res, `/g/${game.id}`);

  const unit = Number(form.get('unit'));
  const units = unitCount(game);
  if (!Number.isInteger(unit) || unit < 0 || unit >= units || signed.has(unit)) {
    return backToGame(res, game, 'nosquare');
  }

  const handle = String(form.get('body') ?? '').trim();
  if (!handle) return backToGame(res, game, 'noname');

  const refusal = refusalFor({ handle, team, signed });

  // A word nobody holds. This is the forgery, and the only refusal that costs anything: the row
  // is written with an `incorrect` verdict, and `lockedUntil` reads its timestamp as the lock. It
  // is stored rather than merely counted so the host can see, at /admin/game/bingo, that a team
  // spent the evening guessing.
  if (refusal?.kind === 'unknown') {
    run(
      "insert into submissions (team_id, game_id, body, unit, verdict) values (?, ?, ?, ?, 'incorrect')",
      team.id,
      game.id,
      handle,
      unit,
    );
    return backToGame(res, game, 'unknown');
  }

  if (refusal?.kind === 'yourself') return backToGame(res, game, 'yourself');
  if (refusal?.kind === 'spent') return backToGame(res, game, 'usedname');

  // Refused nothing, so the handle resolves. The canonical spelling is what gets stored.
  const name = teamByHandle(handle).name;

  const scored = transact(() => {
    run(
      "insert into submissions (team_id, game_id, body, unit, verdict) values (?, ?, ?, ?, 'correct')",
      team.id,
      game.id,
      name,
      unit,
    );

    const now = signaturesFor(team.id, game.id);
    const line = lineUnits(game, now).size > 0;
    const points = cardScore(game, now);

    award({
      teamId: team.id,
      gameId: game.id,
      kind: 'tally',
      points,
      reason: line ? 'line complete' : `${now.size} signed`,
      sourceId: 0,
    });

    return line;
  });

  return redirect(res, gamePath(game.id, { moment: scored ? 'bingo' : 'signed' }));
}

/**
 * Every card of a dealt hand, saved in one press.
 *
 * A name that is not somebody at this party -- a stale tab, a hand-edited option -- is stored as no
 * guess at all rather than bounced. Nine good guesses must not be lost to one bad option, and the
 * card is still sitting there to be answered again.
 */
async function saveHand({ req, res, team, game }) {
  const form = await readForm(req);
  const hand = handFor(team.id, game);
  const known = new Set(namesFor(team.id).map((person) => person.value));

  const values = new Map(
    hand.map((card) => {
      const posted = String(form.get(`card-${card.unit}`) ?? '').trim();
      return [card.unit, known.has(posted) ? posted : ''];
    }),
  );

  saveUnits({ team, game, values });

  return redirect(res, gamePath(game.id, { moment: 'pending' }));
}

/**
 * Every prediction of a harvest, saved in one press.
 *
 * Anything typed is kept: there is no such thing as an invalid prediction, and a word nobody else
 * said is a wrong answer rather than a broken one. It is only trimmed and cut to the same length
 * the door imposed, so a paragraph pasted in cannot become an answer that no box could have typed.
 */
async function savePredictions({ req, res, team, game }) {
  const form = await readForm(req);
  const questions = harvestQuestions(game);

  const values = new Map(
    questions.map((question, unit) => {
      const posted = String(form.get(`unit-${unit}`) ?? '').trim();
      return [unit, posted.slice(0, question?.maxLength ?? 24)];
    }),
  );

  saveUnits({ team, game, values });

  return redirect(res, gamePath(game.id, { moment: 'pending' }));
}

async function submitToGame({ req, res, params }) {
  const team = requireOnboardedTeam(req, res);
  if (!team) return undefined;
  if (blockedByFreeze(res, `/g/${encodeURIComponent(params.gameId)}`)) return undefined;

  const game = getGame(params.gameId);
  if (!game || !isUnlocked(team.id, game.id)) return html(res, notFound(), 404);
  // Neither a hunt nor a trophy renders a form, so a POST here is a stale tab or a curious guest
  // with a terminal. Bounce it rather than opening a submission row against a game that has no
  // way to judge one.
  if (!takesForm(game)) return redirect(res, `/g/${game.id}`);

  // One shot means one shot on the server too. The form is gone from the page the moment a row
  // exists, so reaching here is a stale tab or the back button -- but without this the upsert
  // below would happily re-judge and re-award, which is the entire brute force the flag exists to
  // close. See docs/adr/an-answer-may-be-final.md.
  if (isFinal(game) && submissionsFor(team.id, game.id).length) {
    return backToGame(res, game, 'spent');
  }

  // A signature card scores its whole grid at once and can refuse a submission outright, neither
  // of which the generic path below can express. It never carries a photograph either.
  if (hasGrid(game)) return saveSignature({ req, res, team, game });

  // A dealt hand posts every card at once -- ten dropdowns under one save button -- so it takes its
  // own path rather than squeezing ten units through the one-unit-per-post shape the photo tiles
  // use. It never carries a photograph, so everything below this line is irrelevant to it.
  if (hasHand(game)) return saveHand({ req, res, team, game });

  // A harvest posts all five predictions at once for the same reason, and likewise never carries a
  // photograph.
  if (hasHarvest(game)) return savePredictions({ req, res, team, game });

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
        // Reads the body straight off `fields` rather than waiting for it to be trimmed below,
        // because this bounce happens before that line and loses the sentence exactly as
        // `nophoto` does.
        if (!photo) return backToGame(res, game, 'notaphoto', (fields.get('body') ?? '').trim());
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

  // A dropdown still sitting on its empty first option. Bouncing matters most where the answer is
  // final: submitting "" would otherwise reach check(), come back wrong, and spend the whole tile
  // on a mis-tap nobody meant to make.
  if (game.form?.options && !body) return backToGame(res, game, 'nochoice');

  // Portrait of a stranger is the only game that wants both halves. A photograph with nothing
  // said is not a portrait, so it bounces with the form -- and the photo it already stored is
  // left on disk rather than deleted: the party wanted the picture either way, and a half-filled
  // form is not a reason to throw one away.
  //
  // That the orphan is invisible in the admin gallery costs nothing, and #48 confirmed it rather
  // than fixed it. The gallery is a JUDGING surface, and this tile is `trust` -- it has no buttons
  // (#10, #25) -- so an orphan there would be a portrait with no quote under it and nothing to do
  // about it. Where the photograph actually has to arrive is `data/uploads`, whose self-describing
  // filenames are the night's archive, and it does.
  if (requiresBody(game) && !body) return backToGame(res, game, 'noquote');
  // The sentence rides home. Photo selections cannot be restored into a file input by anyone, so
  // the tap has to be redone either way -- which is the whole asymmetry: retyping is the cost
  // worth removing.
  if (requiresBody(game) && !photo) return backToGame(res, game, 'nophoto', body);

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
  // tap. See ADR-the-page-you-are-on-is-the-stage.
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
  if (blockedByFreeze(res, `/g/${encodeURIComponent(params.gameId)}`)) return undefined;

  const game = getGame(params.gameId);
  if (!game || !isUnlocked(team.id, game.id)) return html(res, notFound(), 404);

  const form = await readForm(req);
  // The step is both the return address and, for a per-step hint list, the ledger key -- which
  // `hintStep` collapses to 0 for a hunt carrying one shared sequence (#18).
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
      nav: navFor(req),
      showClose: true,
      body: `
        ${win({ title: rulesCopy.filename, body: rulesList(rules), status })}
        <h2 class="shout">${escape(rulesCopy.pointsTitle)}</h2>
        ${rulesCopy.points.map((para) => `<p>${escape(para)}</p>`).join('')}
        ${starburst(chrome.starburst)}
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
 * describes the game and never opens the database (ADR-game-content-lives-on-disk). The page is
 * handed facts, not a connection.
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

  return html(res, layout({ title: page.title, body, showClose: page.showClose, nav: navFor(req) }));
}

/**
 * Gated for a GUEST on the night having ENDED, not on it having been frozen -- the gap between
 * those two is the hour in which the hosts finish the queue, hand out the last points and read
 * the top three off this page, and it existing for guests during that would hand the room the
 * ending early (#77).
 *
 * **The admin cookie reaches it at any time** (#76). #8's rule that nothing comparative is ever
 * shown all night is a rule about guests; the person running the night is the one it was written
 * to protect, and they have to be able to read the rankings whenever they want -- including during
 * exactly that gap, which is when they are reading the top three off something.
 *
 * **This is the only board on the site now** (#79). `/admin` used to print one too, and printing
 * it twice meant the host's phone could show two different orderings a few seconds apart. So the
 * board moved here whole, and for a HOST this became a page that refreshes: it holds no form,
 * nothing to press and nothing to lose, which is what makes it safe to leave open on a counter
 * for five hours.
 *
 * A guest gets neither the refresh nor `still`. #78's rule that hosts and guests read the same
 * results page is about what it SAYS, and that is identical; what differs is that a guest opens
 * this once, at the end, and should get the arrival animation the rest of the site gave them --
 * while a host who is watching it does not want it re-animating every thirty seconds.
 *
 * **Both lines of copy are true at both moments**, which is the constraint #11's one-page rule
 * imposes and the only thing that made this copy hard. "Nobody could see this until now" is the
 * obvious line for a reveal and is a lie to the host reading the same page at 22:30, so the page
 * says nothing about when it is being read. `No appeals` is deadpan at either hour.
 *
 * The scale line under the board says the hundred out loud, and it belongs to `league()` rather
 * than to this page -- see the note there.
 */
function showLeague({ req, res }) {
  if (!gameHasEnded() && !isAdmin(req)) return redirect(res, '/');

  const host = isAdmin(req);
  const team = currentTeam(req);

  // A host gets NO expanded row, and this line is why it is a rule here rather than a consequence
  // of "a host is never a team" (#76). That rule is about the night -- one host runs the admin and
  // does not play -- and it is true of people, not of cookie jars. `scripts/walk.js` holds both
  // cookies at once and put a full-width gradient row in the middle of the host's board on the
  // first run of this page; a phone that onboarded once during testing would do the same thing on
  // the night, in the minute the hosts are reading the top three off this screen.
  //
  // It is also the right board on its own terms. The expanded row is a reveal device for someone
  // arriving once; this surface refreshes every thirty seconds for five hours, and the one thing
  // it owes its reader is a uniform column they can scan.
  const youId = host ? null : (team?.id ?? null);

  return html(
    res,
    layout({
      title: 'The league',
      nav: navFor(req, '/league'),
      still: host,
      refresh: host ? ADMIN_REFRESH_SECONDS : 0,
      live: host ? LIVE_SECONDS : 0,
      body: `
        ${blurb('Everyone, in order. No appeals.')}
        ${
          // The slot is a HOST-only wrapper (#94). A guest's board is the reveal, rendered once
          // and never touched again -- and marking it live would be worse than pointless: the
          // fragment `/admin/live` returns carries no expanded `--you` row, so a guest's own row
          // would silently flatten into the column ten seconds after they found it.
          host
            ? `<div data-live="league-board">${league(standings(), { youId })}</div>`
            : league(standings(), { youId })
        }
      `,
    }),
  );
}

/**
 * The two surfaces the menu bar named before anybody built them (#76). Both are reachable only
 * after the reveal, and both bounce to `/` before it for `/league`'s reason: a link that lands
 * on an empty page is worse than a link that is not in the bar yet, and the bar does not offer
 * these until the game is over either way.
 *
 * They exist now because the alternative was a bar with two words in it that 404. CONTEXT.md's
 * rule is that a route a later ticket owns renders an honest stub naming it, so that is what
 * these are -- the words `recap` and `shots` are settled, the pages behind them are not.
 *
 * Both gate on the night having ENDED rather than merely being frozen, which is
 * `/league`'s own line (#77) and for its reason: the freeze is not the reveal.
 *
 * **A dev build walks through both gates** (#96), and has to, because `menuFor()` now puts both
 * words in the dev bar. A dev build has no night to be partway through -- `gameHasEnded()` is
 * false there from the first boot to the last -- so without this the two words the bar just
 * gained would bounce straight back to `/`, which is the dead link this file's own comment above
 * says is worse than no link. It is `IS_DEV` and not `isAdmin(req)`: `/league` lets the host in
 * early because #77's gap is an hour he really lives through, and there is no matching hour in
 * which anyone should be reading an unbuilt stub on the night.
 */
function showRecap({ req, res }) {
  if (!gameHasEnded() && !IS_DEV) return redirect(res, '/');

  return html(
    res,
    stub({
      title: 'Recap',
      nav: navFor(req, '/recap'),
      owner: 'Nothing turns the night’s own material back into a moment',
      does: 'The night played back from what teams actually wrote and shot.',
    }),
  );
}

// --- shots: the wall, and the fullscreen viewer behind it (#80) --------------------------------

/**
 * Who may look at the wall. A guest once the night has been revealed, a host at any hour, and a
 * dev build always.
 *
 * The `IS_DEV`-not-`isAdmin` line above belongs to a *stub*, and its reasoning said so: there is
 * no hour in which anyone should be reading an unbuilt page. This one is built, so it goes back to
 * `/league`'s rule -- the hosts have the real thing all night, and publishing is a separate press
 * (#77). A host wanting to see what the guests will see does not have to end the party first.
 */
const maySeeShots = (req) => gameHasEnded() || isAdmin(req) || IS_DEV;

/**
 * The second select's vocabulary: one option per *prompt*, not per game.
 *
 * Filtering to "The most convincing fake laugh in the house" and getting thirteen teams' takes on
 * it side by side is the thing worth having, and a two-entry game filter cannot express it. So a
 * game with labelled units contributes one option each, and a game whose units are anonymous
 * contributes one for the whole tile -- which is Portrait of a stranger, where one portrait is by
 * design not distinguishable from another (CONTEXT.md, Unit).
 *
 * The key is `<gameId>:<unit>` for a labelled unit and a bare `<gameId>` for an anonymous one, so
 * `keyFor` below can derive a submission's key without consulting this list.
 */
function promptOptions() {
  const options = [{ value: '', label: 'every prompt' }];

  for (const game of listGames().filter(takesPhoto)) {
    const labels = unitLabels(game);
    if (!labels.length) {
      options.push({ value: game.id, label: game.title });
      continue;
    }
    labels.forEach((label, unit) => options.push({ value: `${game.id}:${unit}`, label }));
  }

  return options;
}

const keyFor = (submission) =>
  unitLabel(getGame(submission.game_id), submission.unit) === null
    ? submission.game_id
    : `${submission.game_id}:${submission.unit}`;

/** The filter as a query string, so the viewer and its close link carry it back and forth. */
function shotsQuery({ team, prompt }) {
  const params = new URLSearchParams();
  if (team) params.set('team', team);
  if (prompt) params.set('prompt', prompt);
  const query = params.toString();
  return query ? `?${query}` : '';
}

/**
 * Every photograph the current filter admits, newest first, with the content each one needs
 * resolved off disk. `displayFor` decides which of a submission's three photo columns a cell may
 * point at, and that is database knowledge -- which is why render.js is handed entries and never
 * rows.
 */
function filteredPhotos({ team, prompt }) {
  return allPhotos()
    .filter((photo) => !team || photo.team_id === Number(team))
    .filter((photo) => !prompt || keyFor(photo) === prompt)
    .map((photo) => {
      const game = getGame(photo.game_id);
      return {
        id: photo.id,
        src: displayFor(photo).src ?? '',
        label: photo.photo_mime ?? 'file',
        who: photo.team_name,
        what: unitLabel(game, photo.unit) ?? game?.title ?? photo.game_id,
        said: photo.body ?? '',
        bytes: `/uploads/${photo.photo_path}`,
      };
    });
}

/** The two selects, as a plain GET form: pick, press, the URL says what you are looking at. */
function shotsFilters({ team, prompt }) {
  const teams = [
    { value: '', label: 'every team' },
    ...all('select id, name from teams order by name').map((row) => ({
      value: String(row.id),
      label: row.name,
    })),
  ];

  return `<form class="filters" method="get" action="/shots">
      ${field({ label: 'who took it', name: 'team', value: team, options: teams })}
      ${field({ label: 'what it answers', name: 'prompt', value: prompt, options: promptOptions() })}
      <button class="btn">look</button>
    </form>`;
}

/**
 * The wall. Every photograph of the night, by everyone, filtered by two selects and nothing else.
 *
 * **Not curated, and that is the decision** (#11): the highlights at `/recap` are the joke and
 * this is the evidence. The pile is the point.
 */
function showShots({ req, res, url }) {
  if (!maySeeShots(req)) return redirect(res, '/');

  const team = url.searchParams.get('team') ?? '';
  const prompt = url.searchParams.get('prompt') ?? '';
  const query = shotsQuery({ team, prompt });

  const cells = filteredPhotos({ team, prompt }).map((photo) => ({
    id: photo.id,
    src: photo.src,
    label: photo.label,
    // `at` and the fragment say the same thing to two different readers: the fragment is what
    // scrolls the track, and the server never sees it, so the query param is how this handler's
    // opposite number learns which panel to render eager.
    href: `/shots/open${query ? `${query}&` : '?'}at=${photo.id}#p${photo.id}`,
  }));

  return html(
    res,
    layout({
      title: 'Shots',
      nav: navFor(req, '/shots'),
      still: isAdmin(req),
      body: wall(cells, {
        filters: shotsFilters({ team, prompt }),
        // Two different nothings, and one sentence for both would be a lie half the time.
        // Filtered to nothing is the ordinary case -- a team that skipped a prompt -- and the
        // selects are still on the page above it, which is the way out.
        empty: query
          ? 'Nothing matches that. Try a different team, or a different prompt.'
          : 'Nobody photographed anything. That is also a result.',
      }),
    }),
  );
}

/**
 * One photograph fullscreen, with the rest of the filter either side of it to swipe through.
 *
 * The fragment decides which one you land on and the browser does the scrolling, so this handler
 * never sees it -- `#p42` is not sent to the server. That is why `at` is a query param as well:
 * the panel it names is the one rendered `eager`, because a `loading="lazy"` image that has not
 * been fetched yet has nothing for the view transition to morph into.
 */
function showShotsOpen({ req, res, url }) {
  if (!maySeeShots(req)) return redirect(res, '/');

  const team = url.searchParams.get('team') ?? '';
  const prompt = url.searchParams.get('prompt') ?? '';
  const at = Number(url.searchParams.get('at'));
  const photos = filteredPhotos({ team, prompt });

  if (!photos.length) return redirect(res, `/shots${shotsQuery({ team, prompt })}`);

  const panels = photos
    .map((photo) => viewerPanel({ ...photo, href: photo.bytes, eager: photo.id === at }))
    .join('');

  // Back to the photograph you opened rather than the top of a seven-screen wall -- and, on a
  // browser with view transitions, that fragment is also what the reverse morph targets.
  const anchor = photos.some((photo) => photo.id === at) ? `#p${at}` : '';

  return html(res, viewer({ panels, back: `/shots${shotsQuery({ team, prompt })}${anchor}` }));
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

/** How far into the night we are, counted from the first team through the door. */
function nightSoFar() {
  const first = get("select min(created_at) as at from teams where created_at is not null").at;
  if (!first) return null;
  const minutes = Math.max(0, Math.round((Date.now() - Date.parse(`${first}Z`)) / 60000));
  const hours = Math.floor(minutes / 60);
  return hours ? `${hours}h${String(minutes % 60).padStart(2, '0')} in` : `${minutes} min in`;
}

/**
 * Submissions sitting on a verdict a human owes. Only `manual` games can hold one: a `trust`
 * submission is already paid, and `check`/`resolve` games write their own verdicts.
 *
 * Today this is ALWAYS ZERO -- nothing in the roster declares `manual`, which is #83's finding
 * and the reason the queue is empty all night until it flips the two photo tiles over. Counting
 * it honestly now means the number is right on the day #83 lands rather than a week later.
 */
const awaitingVerdict = () =>
  listGames()
    .filter((game) => judgingMode(game) === 'manual')
    .reduce(
      (total, game) =>
        total +
        get(
          "select count(*) as count from submissions where game_id = ? and verdict = 'pending'",
          game.id,
        ).count,
      0,
    );

/** One row of HQ: a label, a fact, and somewhere to go. */
const hqRow = (href, label, note) =>
  `<a class="hq-row" href="${href}"><span>${label}</span><span class="mono">${note}</span></a>`;

/**
 * Every part of a host's screen that changes on its own, keyed by the `data-live` attribute that
 * marks where it goes. Rendered into the page on load AND returned by `/admin/live` ten seconds
 * later -- the same functions both times, which is the point of the indirection: a poller with
 * its own copy of the markup is a second renderer, and the two disagree the first time one is
 * edited. There is no client-side templating here at all; the browser swaps server HTML in.
 *
 * This carries `league-board` as well as HQ's four, so one endpoint serves both host surfaces.
 * The script applies only the keys whose element is on the page, so HQ ignores the board and the
 * league ignores the gauges. Rendering a board nobody asked for costs one indexed query over
 * fifteen rows; making the client explain itself would cost more than that in code.
 *
 * `youId` is null by construction: this is admin-only, and a host has no row of their own (#76).
 */
function liveFragments() {
  const teams = get('select count(*) as count from teams').count;
  const elapsed = nightSoFar();
  const codes = codeCounts();
  const waiting = awaitingVerdict();

  const teddy = listGames().find((game) => game.kind === 'trophy');
  const teddyHolders = teddy
    ? get(
        "select count(*) as count from awards where game_id = ? and kind = 'trophy' and points > 0",
        teddy.id,
      ).count
    : 0;

  // Both of these are jobs, so both vanish when there is no job. Teddy stays visible once handed
  // over -- who is holding it is a fact worth a glance, and it is one row.
  const jobs = [
    waiting ? hqRow('/admin/court', 'court', `${waiting} waiting`) : '',
    teddy
      ? hqRow(
          `/admin/game/${escape(teddy.id)}`,
          escape(teddy.title),
          teddyHolders ? `${teddyHolders} holding it` : 'nobody holding it',
        )
      : '',
  ]
    .filter(Boolean)
    .join('');

  return {
    // Teams, time, and the one percent (#94). The percent sits up here with the other two facts
    // about the night as a whole rather than in a row of its own, because it is a gauge and not
    // a job: #79's loud row is reserved for the thing that sends you to a room.
    'hq-headline': `${teams} team${teams === 1 ? '' : 's'}${
      elapsed ? ` &middot; ${elapsed}` : ''
    } &middot; ${progressPercent()}%`,

    // THE number on this page, and the only one that sends the host to a room rather than to a
    // thought (#79): at 23:00 a code nobody has found is behind a radiator or under a coat, and
    // the fix is to walk over and move it. Absent from the page entirely once it reaches zero.
    //
    // The COUNT and not the slugs, which was the first version and looked fine reasoning about
    // the night and terrible on screen: before anyone has scanned anything this is all 22 of
    // them, which drew a five-line block of random syllables at the top of the page. A slug says
    // nothing anyway -- `k7rbt9` is not a place. `where` is the field that sends you to a room,
    // and it is on `/admin/codes`, which is what this row is a door to.
    'hq-codes': codes.unfound
      ? hqRow('/admin/codes', '<strong>codes nobody has found</strong>', String(codes.unfound))
      : '',

    // The quiet gauges (#94). Deliberately mono and small: they are glanced at, not acted on.
    // `found` restates `unfound` from the other end and that redundancy is Dieter's call, made
    // after it was put to him -- see `codeCounts()` for why all three earn their place.
    //
    // TWO LINES, broken by hand rather than left to wrap. As one line it ran to 58 characters and
    // a 390px phone split it at "in the last / 30 min", mid-phrase -- and the break point would
    // then have moved every time a number gained a digit. Broken here it is coverage-and-volume
    // on top, recency underneath, which is also the honest grouping: the first line is what has
    // happened all night, the second is whether anything is happening now.
    //
    // "things" is the deadpan-but-accurate word for a mixed count of scans and submissions; there
    // is no house noun covering both (`moment` is taken -- see src/moments.js). Flagged for the
    // map's standing copy pass rather than settled here.
    'hq-gauges': `${codes.found} of ${codes.total} found &middot; ${codes.scans} scan${
      codes.scans === 1 ? '' : 's'
    }<br>${pulse()} things in the last ${PULSE_MINUTES} min`,

    'hq-jobs': jobs ? `<h2 class="hq-heading">waiting on you</h2>${jobs}` : '',

    'league-board': league(standings(), { youId: null }),
  };
}

/**
 * What the host's two screens poll. JSON, and the only endpoint on this site that is not a page.
 *
 * Admin-gated by the same `requireAdmin` as every other admin surface, so a guest gets the 404
 * page rather than the night's numbers -- which matters more here than on the pages, because #8's
 * rule is that nothing comparative reaches a guest before the reveal and this hands back the
 * whole board in one request.
 */
function adminLive({ req, res }) {
  if (!requireAdmin(req, res)) return undefined;

  res.writeHead(200, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  return res.end(JSON.stringify(liveFragments()));
}

/**
 * HQ. A dashboard and nothing else (#79) -- no board, no forms, no judging, no lost-team
 * detection.
 *
 * **No board.** It used to print every team and score as JSON in a `<pre>`, and the board now
 * lives once, at `/league`, which the host reaches from the menu bar at any hour. Two boards on
 * one phone can disagree for thirty seconds at a time, and the host asked for one.
 *
 * **No forms**, which is what buys the refresh. A page that reloads itself every thirty seconds
 * cannot hold a text field -- it would eat a half-typed award reason at exactly the moment it was
 * being typed -- so every control that needs typing is behind `/admin/controls`, and what is left
 * here is a readout.
 *
 * **No "teams who look lost".** #11 asked for one and #79 cut it: an idle timer would flag half
 * the room at midnight, because forty minutes of silence is two people drinking and talking, and
 * a section that cries wolf is a section nobody reads. The host reads the board and thinks.
 *
 * **`waiting on you` is absent when there is nothing waiting**, which is most of the night. A
 * heading over an empty list is the thing #36 called a lie with no rows under it.
 */
function adminBoard({ req, res }) {
  if (!requireAdmin(req, res)) return undefined;

  const parts = liveFragments();

  // Every game with a surface behind /admin/game/:id, as small text rather than as buttons.
  // Six of these will show a team a read-only list all night: they score themselves, and the
  // page is for "I answered that and it did not save" (#79). Dressing them as eight jobs is what
  // the old row of identical buttons did. Teddy is left out -- it is up in `jobs` already.
  const galleries = listGames()
    .filter((game) => takesForm(game) || game.kind === 'trophy')
    .filter((game) => game.kind !== 'trophy')
    .map((game) => `<a href="/admin/game/${escape(game.id)}">${escape(game.title)}</a>`)
    .join(' &middot; ');

  return html(
    res,
    layout({
      title: 'HQ',
      nav: navFor(req, '/admin'),
      still: true, // it refreshes; a page that re-animates every ten seconds cannot be read
      refresh: ADMIN_REFRESH_SECONDS, // <noscript> only -- see layout()
      live: LIVE_SECONDS,
      body: `
        <p class="mono" data-live="hq-headline">${parts['hq-headline']}</p>

        <div data-live="hq-codes">${parts['hq-codes']}</div>

        <p class="mono hq-gauges" data-live="hq-gauges">${parts['hq-gauges']}</p>

        <div data-live="hq-jobs">${parts['hq-jobs']}</div>

        <a class="btn" href="/admin/controls">controls</a>

        <p class="hq-galleries">look at a game's submissions:<br>${galleries}</p>
      `,
    }),
  );
}

/**
 * The dev build's identity switch, at the foot of `/admin/controls` (#96), and empty on the night.
 *
 * It is here because this page already exists and already holds every lever with a consequence --
 * freeze, award, recompute, delete a team, reset the night. Adding a sixth cost no new surface,
 * and the alternative was keeping a yellow menu at the top of every page to hold two links.
 *
 * **Below `the dangerous end`, and deliberately not inside it.** Nothing here destroys anything:
 * `/dev/logout` drops a cookie this build planted itself and `/dev/login` plants it again. The
 * heading says which build you are in, which is the other half of what the yellow strip was for.
 *
 * One end of the switch, never both. `isTestTeam()` reads the cookie the request already carries,
 * so the button is always the move you have not made.
 */
function devToggle(req) {
  if (!IS_DEV) return '';

  const out = isTestTeam(currentTeam(req));

  return `
    <h2 class="hq-heading">dev build</h2>
    <p>${
      out
        ? `You are the seeded test team, with every tile open. Logging out drops that cookie and
           lands you on the front door so onboarding can be walked for real — it is not a sign-out,
           this site has none, it is this build dropping a cookie it planted.`
        : `You are not the test team. Going back abandons whatever team the walk-through made and
           puts you in the seeded one, with every tile open.`
    }</p>
    <a class="btn" href="${out ? '/dev/logout' : '/dev/login'}">${
      out ? 'log out and walk onboarding' : 'become the test team'
    }</a>
  `;
}

/**
 * Everything with a consequence, on one page, off the menu bar (#79).
 *
 * It exists because HQ refreshes and therefore may not hold a form. That is the mechanical
 * reason; the useful one is that these are the five things you press twice a night and never by
 * accident, and keeping them off the page you glance at ten times an hour keeps your thumb away
 * from them.
 *
 * The night's two presses are shown as whatever the state allows next and NOTHING else -- never
 * both at once, never one that would be refused. The host at 01:00 is holding a drink and reading
 * a phone in a loud room.
 *
 * **No typed words anywhere** (#79). The reset's `RESET` field is gone; a sentence on a page you
 * had to navigate to is the guard, and the same shape now guards the end and the delete. What
 * none of them is, is a JavaScript `confirm()`: this site's client JS is the arrival animation and
 * the hint modal, and a control that destroys a night should not be the one thing needing a script
 * to run.
 */
function adminControls({ req, res }) {
  if (!requireAdmin(req, res)) return undefined;

  const teams = all('select id, name from teams order by name');

  let ending;
  if (gameHasEnded()) {
    ending = `<p class="banner"><strong>The night has ended and the league is up.</strong> It does
        not go back from here.</p>
      <a class="btn" href="/league">the league</a>`;
  } else if (gameIsFrozen()) {
    ending = `<p class="banner"><strong>Frozen. The numbers are final and nobody has seen
        them.</strong> This is the gap: hand out anything you owe, then end the night.</p>
      <a class="btn btn--primary" href="/admin/end">end the night</a>
      <form method="post" action="/admin/unfreeze">
        <button class="btn">unfreeze</button>
      </form>`;
  } else {
    ending = `<p>Freezing stops every team submitting and scores the games that only resolve at
        the end. It is a toggle and it costs nothing to undo.</p>
      <form method="post" action="/admin/freeze">
        <button class="btn btn--primary">freeze the game</button>
      </form>`;
  }

  return html(
    res,
    layout({
      title: 'Controls',
      nav: navFor(req),
      still: true, // admin surface
      body: `
        ${ending}

        <h2 class="hq-heading">hand out points</h2>
        <form class="stack stack--tight" method="post" action="/admin/award">
          ${field({
            label: 'which team',
            name: 'team',
            options: [
              { value: '', label: '—' },
              ...teams.map((team) => ({ value: String(team.id), label: team.name })),
            ],
            attrs: { required: true },
          })}
          ${field({ label: 'how many', name: 'points', type: 'number', value: '1', attrs: { required: true } })}
          ${field({ label: 'what for', name: 'reason', attrs: { required: true } })}
          <button class="btn">give</button>
        </form>

        <h2 class="hq-heading">repairs</h2>
        <p>Recompute re-runs scoring over what teams have already done. It changes nothing that
          was not already true, so it is safe to press as often as you like.</p>
        <form method="post" action="/admin/rescore">
          <button class="btn">recompute every score</button>
        </form>

        <h2 class="hq-heading">the dangerous end</h2>
        <a class="btn" href="/admin/delete-team">delete a team</a>
        <a class="btn" href="/admin/reset">reset the whole night</a>

        ${devToggle(req)}

        <a class="btn btn--close" href="/admin">back to HQ</a>
      `,
    }),
  );
}

/** What a team has done, in one line, for the list and again for the confirmation. */
function tally(team) {
  const parts = [];
  if (team.scans) parts.push(`${team.scans} ${team.scans === 1 ? 'scan' : 'scans'}`);
  if (team.submissions) parts.push(`${team.submissions} submitted`);
  if (team.photos) parts.push(`${team.photos} ${team.photos === 1 ? 'photograph' : 'photographs'}`);
  if (team.points) parts.push(`${team.points} points`);

  if (!parts.length) return team.onboarded ? 'nothing yet' : 'never finished the door questions';
  return parts.join(' · ');
}

/**
 * Every team, with a way to remove one. A LIST rather than the dropdown the controls page uses for
 * handing out points, and the reason is the handles: they are dealt animals (#9), so choosing
 * between PENGUIN and PELICAN from a collapsed picker in a loud hall is a coin toss with an
 * irreversible button on the end of it. Rows show the two people's names, which is what the host
 * actually knows about the pair standing in front of him.
 *
 * Each row also carries what that team has done, because that is the guard Dieter asked for in so
 * many words -- *"just so I know how much I'm voiding"*. It is honest at both hours without the
 * page having to know what time it is: at 20:10 every row says `nothing yet` and the press is
 * free; at 23:00 one says `14 scans · 6 submitted · 31 points` and stops the thumb by itself.
 */
function adminDeleteTeam({ req, res, url }) {
  if (!requireAdmin(req, res)) return undefined;
  if (url.searchParams.has('team')) return deleteTeamConfirmation({ req, res, url });

  const teams = removableTeams();
  const gone = url.searchParams.get('gone');

  const done = gone
    ? `<p class="banner"><strong>${escape(gone)} is gone.</strong> Their phone starts over at the
        welcome screen, and the name is back in the bag.</p>`
    : '';

  const rows = teams
    .map(
      (team) => `
        <tr>
          <td>
            <strong>${escape(team.name)}</strong><br>
            ${team.members.length ? team.members.map(escape).join(' &amp; ') : '<em>nobody</em>'}
          </td>
          <td class="mono">${escape(tally(team))}</td>
          <td>
            <div class="judge"><a class="btn" href="/admin/delete-team?team=${team.id}">delete</a></div>
          </td>
        </tr>`,
    )
    .join('');

  return html(
    res,
    layout({
      title: 'Delete a team',
      nav: navFor(req),
      still: true, // admin surface
      body: `
        ${done}
        <p>For the pair at the door who registered, changed their minds, and want to be on
          different teams. Deleting frees their phone to start again.</p>
        ${
          teams.length
            ? `<table class="board"><tbody>${rows}</tbody></table>`
            : '<p>No teams yet.</p>'
        }
        <a class="btn btn--close" href="/admin/controls">back to controls</a>
      `,
    }),
  );
}

/**
 * The confirmation, as a page rather than a dialog -- the same two guards the reset page keeps,
 * for the same reasons. The list is reached by a link, and a link removes nothing; this page names
 * one team and says what goes with it. **No typed word**: the host's rule is that nothing on this
 * site asks anyone to spell anything (#79), and a page carrying the count IS the plain confirmation
 * that rule asks for. Not a `confirm()` either, since client JS here is animation and the hint
 * modal, and this would be the one control that broke when a script did not run.
 *
 * The line about other teams' cards only appears when there are any, which at the door there never
 * are. It is the one consequence of the press that the host cannot see from the room.
 */
function deleteTeamConfirmation({ req, res, url }) {
  const team = whatTeamHasDone(Number(url.searchParams.get('team')));
  if (!team) return redirect(res, '/admin/delete-team');

  const row = (label, value) =>
    `<tr><th>${escape(label)}</th><td class="mono">${escape(String(value))}</td></tr>`;

  const spent = team.scans || team.submissions || team.points;

  return html(
    res,
    layout({
      title: 'Delete a team',
      nav: navFor(req),
      still: true, // admin surface
      body: `
        <p class="banner banner--bad">This deletes ${escape(team.name)} for good.</p>
        <p><strong>${team.members.map(escape).join(' &amp; ') || 'Nobody'}</strong>, playing as
          ${escape(team.name)}${team.onboarded ? '' : ', who never finished the door questions'}.
          Last seen ${escape(ago(team.minutesIdle))}.</p>
        <table class="board">
          <tbody>
            ${row('scans', team.scans)}
            ${row('submissions', team.submissions)}
            ${row('photographs', team.photos)}
            ${row('points', team.points)}
          </tbody>
        </table>
        ${
          spent
            ? '<p>Everything above goes with them, photographs included, and none of it comes back.</p>'
            : '<p>They have done nothing yet, so there is nothing to lose here.</p>'
        }
        ${
          team.cards
            ? `<p>${team.cards} Guess Who ${team.cards === 1 ? 'card' : 'cards'} in other teams'
                hands point at these two. Those cards are taken back, and those teams top up to a
                fresh ten next time they open the tile.</p>`
            : ''
        }
        <p>Their phone starts over at the welcome screen, and ${escape(team.name)} goes back in the
          bag of names.</p>
        <form method="post" action="/admin/delete-team">
          <input type="hidden" name="team" value="${team.id}">
          <button class="btn btn--primary" type="submit">delete ${escape(team.name)}</button>
        </form>
        <a class="btn btn--close" href="/admin/delete-team">keep them</a>
      `,
    }),
  );
}

/**
 * Redirects rather than rendering, so the removal is never sitting behind a form resubmission, and
 * comes back naming who went -- which doubles as the proof it worked, since the row above it is
 * now missing from the list. A second press of a stale page finds nothing to remove and lands on
 * the same calm list; `deleteTeam` returns null rather than throwing for exactly that.
 */
async function adminDeleteTeamConfirmed({ req, res }) {
  if (!requireAdmin(req, res)) return undefined;

  const form = await readForm(req);
  const removed = deleteTeam(Number(form.get('team')));

  return redirect(
    res,
    removed ? `/admin/delete-team?gone=${encodeURIComponent(removed.name)}` : '/admin/delete-team',
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
      nav: navFor(req),
      still: true, // admin surface
      body: `
        <p class="statusline">A trophy — no form, no submissions. Award it to whoever is holding
          it. Taking it back writes a zero, so a mis-tap costs nothing permanent.</p>
        <p class="statusline">${holders.size} team${holders.size === 1 ? '' : 's'} holding it</p>
        <table class="board">
          <thead><tr><th>team</th><th>state</th><th></th></tr></thead>
          <tbody>${rows || '<tr><td colspan="3">No teams yet.</td></tr>'}</tbody>
        </table>
        <a class="btn btn--close" href="/admin">back to HQ</a>
      `,
    }),
  );
}

/**
 * The gallery, per game. What a photo can have done to it comes from the game's judging mode in
 * content, never from a hardcoded list -- so locking the roster needs no change here. A trophy
 * has no submissions to gallery, and hands off above.
 */
/**
 * `court` in the host's menu bar (#76): one queue across every game, rather than the per-game
 * galleries `HQ` already links. It is in the bar from the first minute of the night because it is
 * the only surface a host opens repeatedly -- and it is a stub because what a queue holds is
 * #83's decision, not this ticket's.
 */
function adminCourt({ req, res }) {
  if (!requireAdmin(req, res)) return undefined;

  return html(
    res,
    stub({
      title: 'Court',
      nav: navFor(req, '/admin/court'),
      owner: 'Photographs are trusted, and nobody has decided what the queue holds',
      does: 'Everything waiting on a human verdict, across all games, in one list.',
      still: true, // admin surface
    }),
  );
}

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
      // The same cell a team sees on the game page, including the download tile a HEIC gets.
      const media = submission.photo_path ? shotCell(submission) : '';

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

      // `.submission`, not `.card`: the signature card took that word back in #60, and until then
      // the two rules were merging in the cascade -- this gallery was drawing every box as a
      // padding-less three-column grid, which is what a collision looks like from the outside.
      return `<article class="submission submission--${escape(submission.verdict)}">
                ${media}
                <p class="submission__who">${escape(names.get(submission.team_id) ?? '?')}</p>
                ${prompt ? `<p class="statusline">${escape(prompt)}</p>` : ''}
                ${submission.body ? `<p class="submission__body">${escape(submission.body)}</p>` : ''}
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
      nav: navFor(req),
      still: true, // admin surface: judging a gallery, not arriving at a party page
      body: `
        <p class="statusline">${escape(explainer)}</p>
        <p class="statusline">${submissions.length} submission${submissions.length === 1 ? '' : 's'}</p>
        <div class="gallery">${cards || '<p>Nothing submitted yet.</p>'}</div>
        <a class="btn btn--close" href="/admin">back to HQ</a>
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

  return redirect(res, '/admin/controls');
}

const adminFreeze = ({ req, res }) => {
  if (!requireAdmin(req, res)) return undefined;
  freezeGame();
  return redirect(res, '/admin/controls');
};

const adminUnfreeze = ({ req, res }) => {
  if (!requireAdmin(req, res)) return undefined;
  // Refused once the night has ended; `/admin/controls` stops offering it there, so reaching this
  // is a stale tab. Either way the host lands back on the page that says which state they are in.
  unfreezeGame();
  return redirect(res, '/admin/controls');
};

/**
 * The sentence in front of the second press. It is not a gate -- one tap gets past it -- and that
 * is the design: what makes the end irreversible is thirteen phones having been looked at, which
 * no confirmation can undo, so the only useful thing to put here is the checklist the hosts would
 * otherwise be running from memory at 01:00.
 *
 * It earns its place for a reason the checklist does not say out loud (#79): the gap between the
 * freeze and the end is exactly when the host is on `/admin/controls` handing out final points,
 * which puts their thumb repeatedly on the same screen as the press that ends the gap. This is
 * the one arrangement where a stray tap is plausible rather than theoretical.
 *
 * Redirects rather than renders in both dead ends: pressed too early there is nothing to publish,
 * and pressed twice the league itself is the better answer than a page asking again.
 */
function adminEndPage({ req, res }) {
  if (!requireAdmin(req, res)) return undefined;
  if (gameHasEnded()) return redirect(res, '/league');
  if (!gameIsFrozen()) return redirect(res, '/admin');

  return html(
    res,
    layout({
      title: 'End the night',
      still: true, // admin surface
      body: `
        <p class="banner"><strong>This puts the final table on every phone in the house.</strong>
          You cannot take it back &mdash; not because the button is one-way, but because they will
          have read it.</p>
        <p>The game is already frozen and the scores are already final. Nothing below changes a
          number; it only decides when the room finds out.</p>
        <p>Before you press it:</p>
        <ul>
          <li>Is there anything left to judge?</li>
          <li>Have you read the top three out?</li>
        </ul>
        <p>Do that first. The button publishes; the announcement is yours.</p>
        <form method="post" action="/admin/end">
          <button class="btn btn--primary" type="submit">end the night</button>
        </form>
        <a class="btn btn--close" href="/admin/controls">back to the controls</a>
      `,
    }),
  );
}

/** Straight to the league, which is the page the hosts are about to be reading from. */
const adminEndConfirm = ({ req, res }) => {
  if (!requireAdmin(req, res)) return undefined;
  if (!endGame()) return redirect(res, '/admin');
  return redirect(res, '/league');
};

const adminRescore = ({ req, res }) => {
  if (!requireAdmin(req, res)) return undefined;
  rescore();
  return redirect(res, '/admin/controls');
};

/**
 * The inventory, on screen. It exists for one question asked at 22:40 with a drink in hand:
 * "code seven is broken." The slug is printed on every card, so the host reads it off the paper
 * and finds the row -- which says what it should have done, whether its content exists, and how
 * many teams have already scanned it. A code nobody has ever scanned is lost or badly hidden; a
 * code with scans is fine and the complaint is about something else.
 *
 * THE COLUMN ORDER IS THE ANSWER ORDER, and that is not cosmetic. Seven columns of a `nowrap`
 * table measure 2270px; a phone shows 363 of them and `.board` scrolls the rest away with no
 * scrollbar at rest and nothing that says it can be dragged. With `scans` sixth, the one number
 * this page exists to print sat 500px off the right edge, and a host looking at it would have
 * read the page correctly and concluded there were no scan counts. Slug, then the two verdicts
 * on it, then the description -- the first five columns fit the screen, and what scrolls away is
 * the prose you already have on the key sheet in your hand.
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
          <td class="mono">${seen ? `${seen.accepted}/${seen.total}` : '&mdash;'}</td>
          <td>${pending ? '<strong>PENDING</strong>' : 'ready'}</td>
          <td class="mono">${escape(
            target.game ? `${target.game}${target.step ? ` step ${target.step}` : ''}` : target.page,
          )}</td>
          <td>${escape(target.label ?? '')}</td>
          <td>${escape(target.where ?? '')}</td>
        </tr>`;
    })
    .join('');

  return html(
    res,
    layout({
      title: 'Codes',
      nav: navFor(req),
      still: true, // admin surface
      body: `
        <p>${listCodes().length} codes. Scans are shown as <em>accepted / total</em>; a code with
          no scans at all is the one that fell behind the radiator.</p>
        <table class="board">
          <thead>
            <tr><th>#</th><th>slug</th><th>scans</th><th>content</th><th>target</th>
              <th>label</th><th>where</th></tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <p class="mono">Print: <code>node scripts/qr-sheet.js</code> &middot;
          reprint one: <code>node scripts/qr-sheet.js --only=&lt;slug&gt;</code></p>
        <a class="btn btn--close" href="/admin">back to HQ</a>
      `,
    }),
  );
}

/** How long ago, in words, for the one line on the reset page that separates 19:45 from 23:00. */
function ago(minutes) {
  if (minutes < 1) return 'seconds ago';
  if (minutes === 1) return 'a minute ago';
  if (minutes < 90) return `${minutes} minutes ago`;
  const hours = Math.round(minutes / 60);
  return hours === 1 ? 'an hour ago' : `${hours} hours ago`;
}

/**
 * The reset, as a page rather than a button.
 *
 * That is the first of its two guards and the cheapest: `/admin/controls` carries a link, and a
 * link destroys nothing. The second is this page, which counts what it is about to clear and says
 * when somebody last played -- see src/reset.js for why that sentence is the one doing the work.
 *
 * **There used to be a third, and #79 removed it.** The form asked you to type RESET, on the
 * reasoning that a page reached by one tap can be dismissed by another. The host's rule is that
 * nothing on this site asks anyone to spell anything: a plain confirmation is enough for anything
 * dangerous, and this page is already a plain confirmation with a number on it. A spelling test
 * at 19:45 on a phone was a guard against a mistake nobody had made.
 *
 * Neither guard is a confirm dialog, deliberately: this site's client JS is animation and the
 * hint modal, and `confirm()` would be the one place a control depended on a script running.
 */
function adminReset({ req, res, url }) {
  if (!requireAdmin(req, res)) return undefined;

  const state = whatWouldBeCleared();
  const kept = url.searchParams.get('kept');

  const row = (label, value) =>
    `<tr><th>${escape(label)}</th><td class="mono">${escape(String(value))}</td></tr>`;

  const done = kept
    ? `<p class="banner"><strong>Cleared.</strong> The night before this one is in
        <code>data/resets/${escape(kept)}</code>.</p>`
    : '';

  const activity = state.teams
    ? `<p><strong>A team was last active ${escape(ago(state.minutesIdle))}.</strong> If that is
        minutes rather than hours, the party is happening right now and this is the wrong page.</p>`
    : '<p>The board is already empty.</p>';

  return html(
    res,
    layout({
      title: 'Reset',
      nav: navFor(req),
      still: true, // admin surface
      body: `
        ${done}
        <p class="banner banner--bad">This empties the board.</p>
        ${activity}
        <table class="board">
          <tbody>
            ${row('teams', state.teams)}
            ${row('submissions', state.submissions)}
            ${row('photographs', state.photos)}
            ${row('awards', state.awards)}
            ${row('points on the board', state.points)}
          </tbody>
        </table>
        <p>Games, codes, questions and hints are files in this repository and are not touched.
          Only what the guests made is cleared.</p>
        <p>Nothing is deleted. The database is snapshotted and the photographs are moved into
          <code>data/resets/</code> first, so a mistake here is recoverable &mdash; see
          <code>MM-HANDOFF.md</code>.</p>
        <form method="post" action="/admin/reset">
          <button class="btn btn--primary" type="submit">reset the game</button>
        </form>
        <a class="btn btn--close" href="/admin">back to HQ</a>
      `,
    }),
  );
}

/**
 * Redirects rather than rendering, so the one page in this site that can destroy five hours of a
 * party is never sitting behind a form resubmission. It comes back naming the directory the old
 * night went into, which doubles as the proof it worked -- the counts above it are now zero.
 *
 * **The typed word is gone** (#79). No control on this site asks anyone to spell anything any
 * more: the host's rule is a plain confirmation for anything dangerous, and this page already IS
 * one. Two guards remain and they are the two that were doing the work -- it is a page rather
 * than a button, so a tap on HQ destroys nothing, and it says how long ago somebody last played,
 * which is the line that separates 19:45 from 23:00.
 */
async function adminResetConfirm({ req, res }) {
  if (!requireAdmin(req, res)) return undefined;

  return redirect(res, `/admin/reset?kept=${encodeURIComponent(resetGame())}`);
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
 *
 * It also answers *which build is this*, which is the only thing on the site that does. There is
 * no registry and no version number: a deploy is `git pull && docker compose up -d --build`, so
 * without `build` here a container six weeks behind `main` is indistinguishable from one built a
 * minute ago. It rides on the liveness probe rather than taking a route of its own because the
 * two questions are always asked together, and because this is already the route with no cookie.
 * A commit sha is not a secret -- the repository is public.
 *
 * `build` is reported on the 503 path too: a container that cannot read its own database is
 * exactly when someone needs to know which deploy did that.
 */
function healthz({ res }) {
  let body;
  let status = 200;

  try {
    get('select 1 as ok');
    body = {
      ok: true,
      build: BUILD_COMMIT,
      games: listGames().length,
      uptime: Math.round(process.uptime()),
      node: process.version,
    };
  } catch (error) {
    status = 503;
    body = { ok: false, build: BUILD_COMMIT, error: error.message };
  }

  noCache(res);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

// --- the inventory ------------------------------------------------------------------------------

const routes = [
  // Above the GET on purpose: first match wins, so this is what claims the HEAD. See `peekScan`.
  route('HEAD', '/q/:slug', peekScan),
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
  route('GET', '/league', showLeague),
  route('GET', '/recap', showRecap),
  route('GET', '/shots', showShots),
  route('GET', '/shots/open', showShotsOpen),

  route('GET', '/admin/key/:secret', adminKey),
  route('GET', '/admin', adminBoard),
  route('GET', '/admin/live', adminLive),
  route('GET', '/admin/controls', adminControls),
  route('GET', '/admin/delete-team', adminDeleteTeam),
  route('POST', '/admin/delete-team', adminDeleteTeamConfirmed),
  route('GET', '/admin/court', adminCourt),
  route('GET', '/admin/game/:gameId', adminGame),
  route('POST', '/admin/judge', adminJudge),
  route('POST', '/admin/trophy', adminTrophy),
  route('POST', '/admin/award', adminAward),
  route('POST', '/admin/freeze', adminFreeze),
  route('POST', '/admin/unfreeze', adminUnfreeze),
  route('GET', '/admin/end', adminEndPage),
  route('POST', '/admin/end', adminEndConfirm),
  route('POST', '/admin/rescore', adminRescore),
  route('GET', '/admin/codes', adminCodes),
  route('GET', '/admin/reset', adminReset),
  route('POST', '/admin/reset', adminResetConfirm),

  route('GET', '/kit', serveKit),
  route('GET', '/healthz', healthz),

  // Empty in production. On a dev build: the two ends of the logout that lets real onboarding be
  // walked. See src/dev.js and #62.
  ...devRoutes,
];

export async function handle(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);

  // Before routing, because it decides who this request is FROM: on a dev build the browser is
  // handed the test team and the admin cookie if it is not carrying them already.
  if (IS_DEV) devAttach(req, res);

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
