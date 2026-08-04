// The route inventory, wired. Every route in CONTEXT.md exists here: real where the domain is
// settled, an honest stub where a later ticket owns the design.

import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

import {
  ADMIN_COOKIE,
  ADMIN_SECRET,
  PENDING_COOKIE,
  PUBLIC_DIR,
  UPLOADS_DIR,
} from './config.js';
import { all, get, run, transact } from './db.js';
import {
  getGame,
  getPage,
  getCode,
  judgingMode,
  listCodes,
  listGames,
  listQuestions,
  hintsFor,
  stepCount,
  getStep,
  takesPhoto,
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
import { attachTeam, createTeam, currentTeam, membersOf } from './identity.js';
import { huntIsComplete, isUnlocked, reachedStep, recordScan, scanIsInOrder, unlock } from './progress.js';
import {
  allSubmissionsFor,
  award,
  endGame,
  gameIsOver,
  gameScore,
  hasDiscoveredHintCost,
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
import { layout, notFound, stub } from './render.js';
import {
  gamePath,
  heroAnimation,
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

const requireTeam = (req, res) => {
  const team = currentTeam(req);
  if (!team) redirect(res, '/welcome');
  return team;
};

/** After game end the site is read-only for teams. One guard, one place. */
const blockedByGameEnd = (res) => {
  if (!gameIsOver()) return false;
  redirect(res, '/showdown');
  return true;
};

// --- the front door ---------------------------------------------------------------------------

async function handleScan({ req, res, params }) {
  const target = getCode(params.slug);
  if (!target) return html(res, notFound(), 404);

  const team = currentTeam(req);
  if (!team) {
    // Hold the slug across onboarding, then replay this exact URL so the effect applies once.
    setCookie(res, PENDING_COOKIE, params.slug, { maxAge: 60 * 60 });
    return redirect(res, '/welcome');
  }

  if (gameIsOver()) {
    recordScan(team.id, params.slug, false);
    return redirect(res, '/showdown');
  }

  if (target.page) {
    recordScan(team.id, params.slug, true);
    return redirect(res, `/p/${target.page}`);
  }

  const game = getGame(target.game);
  if (!game) return html(res, notFound(), 404);

  if (game.kind !== 'hunt') {
    recordScan(team.id, params.slug, true);
    unlock(team.id, game.id);
    // Straight into the game, never via the dashboard: the team scanned a code because they want
    // to play, and the unlock plays on the hero they are already looking at. ADR-0009.
    return redirect(res, gamePath(game.id, { moment: 'unlock' }));
  }

  const step = target.step;

  if (!scanIsInOrder(team.id, game, step)) {
    recordScan(team.id, params.slug, false);
    return redirect(res, '/p/too-soon');
  }

  recordScan(team.id, params.slug, true);
  if (step === 1) unlock(team.id, game.id);

  // The step's `webhook` is a logical node name, never a Home Assistant id -- see
  // docs/adr/0007-one-home-assistant-webhook.md.
  fireWebhook(getStep(game, step)?.webhook, { team: team.name, game: game.id, step });

  if (huntIsComplete(team.id, game)) {
    award({ teamId: team.id, gameId: game.id, kind: 'hunt', points: game.points ?? 0 });
  }

  // Step 1 is an unlock; every step after it is a step transition, and they look different.
  return redirect(res, gamePath(game.id, { step, moment: step === 1 ? 'unlock' : 'step' }));
}

// --- onboarding -------------------------------------------------------------------------------

function showWelcome({ req, res }) {
  if (currentTeam(req)) return redirect(res, '/');

  return html(
    res,
    layout({
      title: 'Welcome',
      body: `
        <p><strong>Not designed yet.</strong> Owned by: Onboarding flow and questionnaire.</p>
        <form method="post" action="/welcome">
          <p><label>Team name <input name="team" required></label></p>
          <p><label>Player 1 <input name="member" required></label></p>
          <p><label>Player 2 <input name="member"></label></p>
          <button type="submit">Let us in</button>
        </form>
      `,
    }),
  );
}

async function createTeamFromForm({ req, res }) {
  const form = await readForm(req);
  const name = (form.get('team') ?? '').trim();
  if (!name) return redirect(res, '/welcome');

  const team = createTeam({ name, memberNames: form.getAll('member') });
  attachTeam(res, team);

  return redirect(res, '/questions');
}

function showQuestions({ req, res }) {
  const team = requireTeam(req, res);
  if (!team) return undefined;

  const questions = listQuestions();
  // Nothing to ask yet -- the questionnaire is owned by its own ticket. Skip straight through
  // rather than showing an empty form.
  if (!questions.length) return redirect(res, afterOnboarding(req, res));

  const members = membersOf(team.id);
  const fields = questions
    .flatMap((question) =>
      question.scope === 'member'
        ? members.map((member) => ({ question, member }))
        : [{ question, member: null }],
    )
    .map(
      ({ question, member }) => `
        <p><label>${escape(question.label)}${member ? ` (${escape(member.name)})` : ''}
          <input name="${escape(question.id)}:${member?.id ?? ''}"
                 type="${escape(question.input ?? 'text')}"></label></p>`,
    )
    .join('');

  return html(
    res,
    layout({
      title: 'A few questions',
      body: `<form method="post" action="/questions">${fields}<button>Done</button></form>`,
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

  return redirect(res, afterOnboarding(req, res));
}

/** Replay the code they arrived on, so onboarding costs them nothing. */
function afterOnboarding(req, res) {
  const pending = parseCookies(req)[PENDING_COOKIE];
  if (!pending) return '/';
  clearCookie(res, PENDING_COOKIE);
  return `/q/${pending}`;
}

// --- dashboard, games, rules ------------------------------------------------------------------

function showDashboard({ req, res }) {
  const team = requireTeam(req, res);
  if (!team) return undefined;

  // The five tile designs the style kit ships: locked, unlocked, correct, wrong, unknown.
  const tiles = listGames().map((game) => {
    const unlocked = isUnlocked(team.id, game.id);
    const submissions = submissionsFor(team.id, game.id);
    const verdicts = new Set(submissions.map((submission) => submission.verdict));

    let state = 'locked';
    if (unlocked) state = 'unlocked';
    if (submissions.length) {
      if (verdicts.has('pending')) state = 'unknown';
      else state = verdicts.has('correct') ? 'correct' : 'wrong';
    }
    if (game.kind === 'hunt' && huntIsComplete(team.id, game)) state = 'correct';

    return { game, unlocked, state, points: gameScore(team.id, game.id) };
  });

  const grid = tiles.length
    ? tiles
        .map(({ game, unlocked, state, points }) => {
          const inner = `<span class="tile__title">${escape(unlocked ? game.title : '???')}</span>
            <span class="tile__pts">${points} pts</span>`;
          return unlocked
            ? `<a class="tile tile--${state}" href="/g/${escape(game.id)}">${inner}</a>`
            : `<span class="tile tile--locked">${inner}</span>`;
        })
        .join('')
    : '<p>No games yet. The roster is still being locked.</p>';

  return html(
    res,
    layout({
      title: escape(team.name),
      body: `
        <div class="scorebar">
          <div class="scorebar__who">
            <span class="scorebar__label">TEAM</span>
            <span class="scorebar__name">${escape(team.name)}</span>
          </div>
          <div class="scorebar__pts">
            <span class="scorebar__num">${teamScore(team.id)}</span><span class="scorebar__unit">pts</span>
          </div>
        </div>
        <p class="standing">${escape(standingsMessage(team.id))}</p>
        <div class="tiles">${grid}</div>
        <a class="btn" href="/rules">the rules</a>
      `,
    }),
  );
}

/** Honest, short, and never a dead end -- the form is always still underneath. */
const SUBMIT_PROBLEMS = {
  toobig: 'That photo was too big to send. Take a new one and try again.',
  notaphoto: "That file wasn't a photo — at least, not one we know how to read.",
  empty: 'Nothing arrived. Pick a photo first.',
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

function showGame({ req, res, params, url }) {
  const team = requireTeam(req, res);
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

  return html(
    res,
    layout({
      title: escape(game.title),
      body: `
        <p class="banner"><strong>Composition not designed yet.</strong> Owned by: the per-game tickets.</p>
        ${problem ? `<p class="banner banner--bad">${escape(problem)}</p>` : ''}
        ${submitted ? `<p class="banner${verdictAnimation(moment)}">${escape(submitted)}</p>` : ''}
        ${
          game.kind === 'hunt'
            ? `<p class="statusline">Step ${step} of ${stepCount(game)} — reached ${reached}</p>
               <div class="hero hero--text${heroAnimation(moment)}">${escape(getStep(game, step)?.hero?.text ?? '')}</div>`
            : `<div class="hero hero--text${heroAnimation(moment)}">${escape(game.hero?.text ?? '')}</div>
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
                 <input class="input" name="body" ${wantsPhoto ? 'placeholder="say something about it (optional)"' : ''}
                        value="${escape(game.kind === 'tally' ? '' : mine.at(-1)?.body ?? '')}">
                 <button class="btn btn--primary" ${gameIsOver() ? 'disabled' : ''}>Submit</button>
               </form>`
        }
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
  const team = requireTeam(req, res);
  if (!team) return undefined;
  if (blockedByGameEnd(res)) return undefined;

  const game = getGame(params.gameId);
  if (!game || !isUnlocked(team.id, game.id)) return html(res, notFound(), 404);
  if (game.kind === 'hunt') return redirect(res, `/g/${game.id}`);

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

  const mode = judgingMode(game);

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
      `insert into submissions (team_id, game_id, body, photo_path, photo_mime, photo_thumb)
       values (?, ?, ?, ?, ?, ?)`,
      team.id,
      game.id,
      body,
      photo?.filename ?? null,
      photo?.mime ?? null,
      photo?.thumbnailName ?? null,
    );

    // Trust games pay on submit -- which is exactly why the gallery gives them no buttons: the
    // points are already banked and a second press would double-pay.
    if (mode === 'trust') {
      award({
        teamId: team.id,
        gameId: game.id,
        kind: game.kind === 'tally' ? 'tally' : 'answer',
        points: game.points,
        reason: 'on trust',
        sourceId: Number(lastInsertRowid),
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
    gamePath(game.id, { moment: momentForSubmission({ photo: Boolean(photo), mode, verdict }) }),
  );
}

async function revealHint({ req, res, params }) {
  const team = requireTeam(req, res);
  if (!team) return undefined;
  if (blockedByGameEnd(res)) return undefined;

  const game = getGame(params.gameId);
  if (!game || !isUnlocked(team.id, game.id)) return html(res, notFound(), 404);

  const form = await readForm(req);
  const step = game.kind === 'hunt' ? Number(form.get('step')) || reachedStep(team.id, game) : 0;

  const revealed = revealNextHint(team.id, game, step);

  // `first=1` is what makes the client-side modal announce the price. It is a notification, not
  // a confirmation: the first reveal per team is free, every one after costs.
  const query = revealed?.isFirstEver ? '&first=1' : '';
  return redirect(res, `/g/${game.id}?step=${step}${query}`);
}

function showRules({ req, res }) {
  const team = currentTeam(req);

  return html(
    res,
    layout({
      title: 'The rules',
      body: `
        <p><strong>Copy not written yet.</strong> Owned by: the rules page and score bands fog.</p>
        <ul>
          <li>Have fun</li>
          <li>Be nice</li>
          <li>The bedroom is off limits</li>
          ${team && hasDiscoveredHintCost(team.id) ? '<li>Hints cost you points. You knew that.</li>' : ''}
        </ul>
        <p><a href="/">close</a></p>
      `,
    }),
  );
}

function showPage({ res, params }) {
  const page = getPage(params.pageId);
  if (!page) return html(res, notFound(), 404);

  return html(res, layout({ title: page.title, body: page.body, showClose: page.showClose }));
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
 * The gallery, per game. What a photo can have done to it comes from the game's judging mode in
 * content, never from a hardcoded list -- so locking the roster needs no change here.
 */
function adminGame({ req, res, params }) {
  if (!requireAdmin(req, res)) return undefined;

  const game = getGame(params.gameId);
  if (!game) return html(res, notFound(), 404);

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

      return `<article class="card card--${escape(submission.verdict)}">
                ${media}
                <p class="card__who">${escape(names.get(submission.team_id) ?? '?')}</p>
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

function adminAdopt({ req, res, params }) {
  if (!requireAdmin(req, res)) return undefined;

  const team = get('select * from teams where token = ?', params.token);
  if (!team) return html(res, notFound(), 404);

  // Re-attach a team to this phone. The one thing standing between a dead battery and a lost
  // evening's score.
  attachTeam(res, team);
  return redirect(res, '/');
}

function adminCodes({ req, res }) {
  if (!requireAdmin(req, res)) return undefined;

  return html(
    res,
    stub({
      title: 'Codes',
      owner: 'QR inventory and generator script',
      does: 'Slug → target inventory, for printing and for debugging a code someone says is broken.',
      data: listCodes().map(([slug, target]) => ({ slug, ...target })),
      still: true, // admin surface
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

async function serveKit({ res }) {
  html(res, await readFile(join(PUBLIC_DIR, 'kit.html'), 'utf8'));
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
  route('POST', '/admin/award', adminAward),
  route('POST', '/admin/end', adminEnd),
  route('POST', '/admin/reopen', adminReopen),
  route('POST', '/admin/rescore', adminRescore),
  route('GET', '/admin/adopt/:token', adminAdopt),
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
