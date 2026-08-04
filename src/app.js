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
  listCodes,
  listGames,
  listQuestions,
  hintsFor,
  stepCount,
  getStep,
} from './content.js';
import {
  escape,
  html,
  noCache,
  parseCookies,
  readForm,
  redirect,
  route,
  setCookie,
  clearCookie,
} from './http.js';
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
    return redirect(res, `/g/${game.id}`);
  }

  const step = target.step;

  if (!scanIsInOrder(team.id, game, step)) {
    recordScan(team.id, params.slug, false);
    return redirect(res, '/p/too-soon');
  }

  recordScan(team.id, params.slug, true);
  if (step === 1) unlock(team.id, game.id);

  fireWebhook(getStep(game, step)?.webhook, { team: team.name, game: game.id, step });

  if (huntIsComplete(team.id, game)) {
    award({ teamId: team.id, gameId: game.id, kind: 'hunt', points: game.points ?? 0 });
  }

  return redirect(res, `/g/${game.id}?step=${step}`);
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

  return html(
    res,
    layout({
      title: escape(game.title),
      body: `
        <p class="banner"><strong>Composition not designed yet.</strong> Owned by: the per-game tickets.</p>
        ${
          game.kind === 'hunt'
            ? `<p class="statusline">Step ${step} of ${stepCount(game)} — reached ${reached}</p>
               <div class="hero hero--text">${escape(getStep(game, step)?.hero?.text ?? '')}</div>`
            : `<div class="hero hero--text">${escape(game.hero?.text ?? '')}</div>
               <form class="stack" method="post" action="/g/${escape(game.id)}/submit">
                 <input class="input" name="body"
                        value="${escape(submissionsFor(team.id, game.id).at(-1)?.body ?? '')}">
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

async function submitToGame({ req, res, params }) {
  const team = requireTeam(req, res);
  if (!team) return undefined;
  if (blockedByGameEnd(res)) return undefined;

  const game = getGame(params.gameId);
  if (!game || !isUnlocked(team.id, game.id)) return html(res, notFound(), 404);
  if (game.kind === 'hunt') return redirect(res, `/g/${game.id}`);

  // Photo submissions are multipart and belong to the photo subsystem ticket; this handles the
  // urlencoded half of the contract only.
  const form = await readForm(req);
  const body = form.get('body') ?? '';

  transact(() => {
    const existing = submissionsFor(team.id, game.id);

    if (game.kind === 'answer' && existing.length) {
      run(
        "update submissions set body = ?, updated_at = datetime('now') where id = ?",
        body,
        existing[0].id,
      );
      return;
    }

    const { lastInsertRowid } = run(
      'insert into submissions (team_id, game_id, body) values (?, ?, ?)',
      team.id,
      game.id,
      body,
    );

    if (game.kind === 'tally') {
      award({
        teamId: team.id,
        gameId: game.id,
        kind: 'tally',
        points: game.points ?? 1,
        sourceId: Number(lastInsertRowid),
      });
    }
  });

  if (game.kind === 'answer' && typeof game.check === 'function') {
    const verdict = game.check(body) ? 'correct' : 'incorrect';
    const submission = submissionsFor(team.id, game.id)[0];
    run('update submissions set verdict = ? where id = ?', verdict, submission.id);
    award({
      teamId: team.id,
      gameId: game.id,
      kind: 'answer',
      points: verdict === 'correct' ? game.points ?? 0 : 0,
      sourceId: submission.id,
    });
  }

  return redirect(res, '/');
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
    }),
  );
}

function adminGame({ req, res, params }) {
  if (!requireAdmin(req, res)) return undefined;

  const game = getGame(params.gameId);
  if (!game) return html(res, notFound(), 404);

  return html(
    res,
    stub({
      title: `Admin — ${game.title}`,
      owner: 'Photo submission subsystem (gallery) and Admin dashboard (judging)',
      does: 'Every submission for this game, with a photo gallery and per-submission judging.',
      data: allSubmissionsFor(game.id),
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

  transact(() => {
    run(
      "update submissions set verdict = ?, updated_at = datetime('now') where id = ?",
      verdict,
      submissionId,
    );
    award({
      teamId: submission.team_id,
      gameId: submission.game_id,
      kind: 'answer',
      points,
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
    }),
  );
}

// --- static -----------------------------------------------------------------------------------

async function serveFrom(rootDir, relativePath, res) {
  const safe = normalize(relativePath).replace(/^(\.\.[/\\])+/, '').replace(/^[/\\]+/, '');
  const file = join(rootDir, safe);
  if (!file.startsWith(rootDir)) return html(res, notFound(), 403);

  try {
    const body = await readFile(file);
    noCache(res);
    res.writeHead(200, { 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    html(res, notFound(), 404);
  }
}

async function serveKit({ res }) {
  html(res, await readFile(join(PUBLIC_DIR, 'kit.html'), 'utf8'));
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
];

export async function handle(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);

  for (const candidate of routes) {
    const params = candidate.match(req.method, url.pathname);
    if (params) return candidate.handler({ req, res, params, url });
  }

  if (url.pathname.startsWith('/uploads/')) {
    return serveFrom(UPLOADS_DIR, url.pathname.slice('/uploads/'.length), res);
  }

  if (/^\/(css|js|fonts|img)\//.test(url.pathname)) {
    return serveFrom(PUBLIC_DIR, url.pathname, res);
  }

  return html(res, notFound(), 404);
}
