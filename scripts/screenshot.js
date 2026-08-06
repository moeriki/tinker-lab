#!/usr/bin/env node
// Look at a page. Not a test -- a pair of eyes.
//
//   node scripts/screenshot.js                       -> / and /kit, on a phone
//   node scripts/screenshot.js /kit /no-such-code
//   node scripts/screenshot.js --reduced-motion /
//   node scripts/screenshot.js --full /kit           -> the whole page, not just the fold
//   node scripts/screenshot.js --base https://bday.moeriki.com /   -> the real deploy
//   node scripts/screenshot.js --out shots /         -> somewhere you choose
//
// Agents kept writing "not seen by eye" about pages they had just built. The cause was never the
// site: no Claude Chrome extension had been paired to this account, so every session that asked for
// a browser got "extension is not connected" and gave up. That extension is also the wrong shape
// for this repo even when it works -- it drives one shared Chrome interactively, and this repo runs
// several background sessions in parallel worktrees, which would collide in it.
//
// So this boots the server on a free port against a throwaway database, drives headless Chrome over
// the DevTools protocol, and writes PNGs an agent can read. No dependency -- Node's own WebSocket
// and fetch are the whole client. A page is verifiable here: do not report a change as unproven for
// want of a way to look at it.
//
// WHY CDP AND NOT `--screenshot`: because this site is mobile only, and the flag cannot render a
// phone. Chrome clamps its window to a minimum width of around 500px and then CROPS the image to
// whatever --window-size asked for, so `--window-size=390,844` yields a 390px-wide picture of a
// 500px-wide layout. Everything looks like it overflows, and it is a lie -- measured 2026-08-06,
// and it nearly got a fictional overflow bug filed against the arrival page. Emulation.set-
// DeviceMetricsOverride sets a REAL 390px viewport with `mobile: true`, so the viewport meta tag
// applies and the page lays out the way a guest's phone will lay it out.
//
// WHAT IT CANNOT DO: become a team. There is no cookie and no form submission, so anything behind
// arrival is out of reach and the database it shoots is always empty. Walking a hunt, submitting an
// answer and seeing a real score belong to Playwright -- issue #65.

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// --- arguments ------------------------------------------------------------------------------------

const argv = process.argv.slice(2);
const routes = [];
let base = null;
let out = null;
// A phone, because this site is mobile only. 390x844 at 2x is an iPhone 14/15 in CSS pixels, which
// is the width every layout decision on this map was made against.
let width = 390;
let height = 844;
let scale = 2;
let reducedMotion = false;
let full = false;

for (let i = 0; i < argv.length; i += 1) {
  const arg = argv[i];
  if (arg === '--reduced-motion') reducedMotion = true;
  else if (arg === '--full') full = true;
  else if (arg === '--base') base = argv[(i += 1)];
  else if (arg === '--out') out = argv[(i += 1)];
  else if (arg === '--width') width = Number(argv[(i += 1)]);
  else if (arg === '--height') height = Number(argv[(i += 1)]);
  else if (arg === '--scale') scale = Number(argv[(i += 1)]);
  else if (arg.startsWith('-')) {
    console.error(`unknown flag: ${arg}`);
    process.exit(1);
  } else routes.push(arg.startsWith('/') ? arg : `/${arg}`);
}

if (!routes.length) routes.push('/', '/kit');

// --- finding Chrome -------------------------------------------------------------------------------

// The installed browser is enough; nothing is downloaded, and no cache belonging to another project
// is trusted to still be there tomorrow.
const chrome = [
  process.env.CHROME,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
]
  .filter(Boolean)
  .find((path) => existsSync(path));

if (!chrome) {
  console.error('No Chrome found. Set $CHROME to its binary, or install Google Chrome.');
  process.exit(1);
}

// --- small helpers --------------------------------------------------------------------------------

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** A port nobody else holds, so two worktrees shooting at once never collide. */
const freePort = () =>
  new Promise((resolve, reject) => {
    const probe = createServer();
    probe.on('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });

/** Keep trying `fn` until it stops throwing, or give up rather than shooting a blank page. */
async function until(fn, attempts = 60, gap = 200) {
  for (let i = 0; i < attempts; i += 1) {
    try {
      const value = await fn();
      if (value) return value;
    } catch {
      /* not up yet */
    }
    await sleep(gap);
  }
  return null;
}

// --- the DevTools connection ------------------------------------------------------------------------

/** A tiny CDP client: send a command, await its reply; remember which events have fired. */
function connect(socket) {
  let id = 0;
  const pending = new Map();
  const seen = new Set();

  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      pending.get(message.id)(message);
      pending.delete(message.id);
    } else if (message.method) seen.add(message.method);
  });

  return {
    seen,
    send: (method, params = {}) =>
      new Promise((resolve) => {
        const n = (id += 1);
        pending.set(n, resolve);
        socket.send(JSON.stringify({ id: n, method, params }));
      }),
  };
}

// --- run ------------------------------------------------------------------------------------------

const outDir = out ?? mkdtempSync(join(tmpdir(), 'bday-shots-'));
mkdirSync(outDir, { recursive: true });

/** `/` -> home, `/kit` -> kit, `/q/k7f2qx` -> q-k7f2qx. Predictable, and safe as a filename. */
const nameFor = (route) =>
  route === '/' ? 'home' : route.replace(/^\/|\/$/g, '').replaceAll('/', '-') || 'home';

let server = null;
let browser = null;
let dataDir = null;
// Chrome keeps writing into its profile as it dies, so this is swept at the very end.
const profile = mkdtempSync(join(tmpdir(), 'bday-chrome-'));
const problems = [];
const wide = [];

try {
  if (!base) {
    // A throwaway database, so this never touches $DATA_DIR and never dirties the checkout. It is
    // also always EMPTY, which is why anything behind arrival shows the arrival page instead.
    dataDir = mkdtempSync(join(tmpdir(), 'bday-shot-data-'));
    const port = await freePort();
    base = `http://localhost:${port}`;

    server = spawn(process.execPath, ['server.js'], {
      cwd: new URL('..', import.meta.url).pathname,
      env: { ...process.env, PORT: String(port), DATA_DIR: `${dataDir}/` },
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    let bootLog = '';
    server.stderr.on('data', (chunk) => (bootLog += chunk));

    // `finally` covers a throw, but not a Ctrl-C. Without this an interrupted run orphans a server.
    process.on('exit', () => server?.kill());
    for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => process.exit(130));

    if (!(await until(() => fetch(`${base}/kit`, { signal: AbortSignal.timeout(1000) })))) {
      console.error(`server never came up on ${base}\n${bootLog}`);
      process.exit(1);
    }
  }

  // Port 0: Chrome picks one and writes it into the profile, so parallel runs never contend. The
  // profile is not optional either -- without it Chrome opens the human's REAL one and deadlocks
  // against the Chrome they already have running.
  browser = spawn(
    chrome,
    [
      '--headless',
      '--disable-gpu',
      '--hide-scrollbars',
      `--user-data-dir=${profile}`,
      '--no-first-run',
      '--no-default-browser-check',
      // Quiet, and honest about the night: nothing here should need the network.
      '--disable-background-networking',
      '--disable-component-update',
      '--disable-sync',
      '--remote-debugging-port=0',
      'about:blank',
    ],
    { stdio: ['ignore', 'ignore', 'ignore'] },
  );

  const portFile = join(profile, 'DevToolsActivePort');
  const devtoolsPort = await until(() =>
    existsSync(portFile) ? readFileSync(portFile, 'utf8').split('\n')[0].trim() : null,
  );
  if (!devtoolsPort) {
    console.error('Chrome never opened a DevTools port.');
    process.exit(1);
  }

  const target = await until(async () => {
    const list = await (await fetch(`http://127.0.0.1:${devtoolsPort}/json/list`)).json();
    return list.find((entry) => entry.type === 'page' && entry.webSocketDebuggerUrl);
  });

  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  const cdp = connect(socket);

  await cdp.send('Page.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: scale,
    mobile: true,
  });
  if (reducedMotion) {
    await cdp.send('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
    });
  }

  for (const route of routes) {
    const target = join(outDir, `${nameFor(route)}.png`);
    cdp.seen.delete('Page.loadEventFired');
    await cdp.send('Page.navigate', { url: `${base}${route}` });
    await until(() => cdp.seen.has('Page.loadEventFired'), 50);
    // Web fonts decide the layout on this site -- shooting before they swap in shows the fallback.
    await cdp.send('Runtime.evaluate', {
      expression: 'document.fonts.ready.then(() => true)',
      awaitPromise: true,
    });
    await sleep(250);

    // Free, and worth having: the page's own measurement of whether it overflows sideways. On a
    // mobile-only site that is a real defect, and this is the one moment it can be seen.
    const measured = await cdp.send('Runtime.evaluate', {
      expression:
        'JSON.stringify({inner: innerWidth, doc: document.documentElement.scrollWidth})',
      returnByValue: true,
    });
    const { inner, doc } = JSON.parse(measured.result?.result?.value ?? '{}');
    if (doc > inner) wide.push(`${route}: content is ${doc}px wide in a ${inner}px viewport`);

    const shot = await cdp.send('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: full,
    });
    const data = shot.result?.data;
    if (!data) {
      problems.push(`${route}: Chrome returned no image`);
      continue;
    }
    writeFileSync(target, Buffer.from(data, 'base64'));
    console.log(`${route} → ${target}`);
  }

  socket.close();
} finally {
  server?.kill();
  browser?.kill('SIGKILL');
  // Best-effort, always. A leftover temp directory is the OS's problem; throwing here would leave
  // the server running instead, which is how a machine ends up with seven of them.
  for (const path of [profile, dataDir].filter(Boolean)) {
    try {
      rmSync(path, { recursive: true, force: true, maxRetries: 20, retryDelay: 100 });
    } catch {
      /* Chrome still had a grip on it. Harmless. */
    }
  }
}

if (full) {
  console.log(
    '\nnote: --full renders past the fold, which shows the whole page but misplaces anything\n' +
      'sticky. Trust a default shot for the marquee and the scorebar.',
  );
}

if (wide.length) {
  process.stderr.write(`\n${wide.length} PAGE(S) OVERFLOW SIDEWAYS:\n`);
  for (const line of wide) process.stderr.write(`  ${line}\n`);
}

if (problems.length) {
  process.stderr.write(`\n${problems.length} ROUTE(S) NOT SHOT:\n`);
  for (const problem of problems) process.stderr.write(`  ${problem}\n`);
  process.exitCode = 1;
}
