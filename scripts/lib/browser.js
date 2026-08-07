// A phone, on this machine, with no dependency: boot the server against a throwaway database,
// drive headless Chrome over the DevTools protocol, and hand back something you can point at a
// page and read.
//
// #64 wrote the first half of this inside scripts/screenshot.js. #65 needed the same boot in a
// second script, and two copies of a Chrome launcher drift exactly the way two copies of markup
// do -- so it moved here whole, and screenshot.js is now one of its two callers.
//
// WHY NOT PLAYWRIGHT. #65 was written expecting it, and the expectation did not survive being
// measured. Three things:
//
//   1. Its browsers are NOT already cached. playwright@1.62.1 pins chromium revision 1234; this
//      machine holds 1194, 1217 and 1228, so `playwright install` would pull ~150MB. The premise
//      the ticket was filed on was checked against a directory listing and not against the pin.
//   2. node_modules is gitignored and every session takes a fresh worktree, so a devDependency
//      turns "you can look at this site" into "you can look, once pnpm install succeeds against a
//      registry". That guarantee is eight days old and is the whole of what #64 bought.
//   3. This site has no client JS to drive. Forms POST and redirect (a locked constraint on the
//      map); nothing on a team-facing page is wired to a listener. What is actually needed to
//      become a team is a cookie jar, a form submit and a file input -- and a browser already has
//      the first two, while the third is one CDP call.
//
// So this is not a rejection of the ticket's goal. It is the same goal, arrived at without asking
// every future session to install something first.

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const REPO = new URL('../../', import.meta.url).pathname;

// A phone, because this site is mobile only. 390x844 at 2x is an iPhone 14/15 in CSS pixels,
// which is the width every layout decision on this map was made against.
export const PHONE = { width: 390, height: 844, scale: 2 };

/** Plausible one-word answers, cycled, so no two fields on a screen say the same thing. */
const FILLER_WORDS = [
  'otter',
  'pizza',
  'midnight',
  'kettle',
  'ketchup',
  'astronaut',
  'balloon',
  'trombone',
  'cactus',
  'lighthouse',
  'anchovy',
  'bicycle',
];

// --- small helpers --------------------------------------------------------------------------

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** A port nobody else holds, so two worktrees driving at once never collide. */
export const freePort = () =>
  new Promise((resolve, reject) => {
    const probe = createServer();
    probe.on('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });

/** Keep trying `fn` until it stops throwing, or give up rather than driving a blank page. */
export async function until(fn, attempts = 60, gap = 200) {
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

/** `/` -> home, `/kit` -> kit, `/q/k7f2qx` -> q-k7f2qx. Predictable, and safe as a filename. */
export const nameFor = (route) =>
  route === '/' ? 'home' : route.replace(/^\/|\/$/g, '').replaceAll('/', '-') || 'home';

// --- finding Chrome -------------------------------------------------------------------------

// The installed browser is enough; nothing is downloaded, and no cache belonging to another
// project is trusted to still be there tomorrow.
export function findChrome() {
  return [
    process.env.CHROME,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
  ]
    .filter(Boolean)
    .find((path) => existsSync(path));
}

// --- the DevTools connection ------------------------------------------------------------------

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

// --- the page -----------------------------------------------------------------------------------

/**
 * What a caller actually holds. Deliberately small: this site is server-rendered with no client
 * JS on any team-facing interaction, so there is no hover, no wait-for-selector and no network
 * idle to model. Load the page, read it, fill the form the server sent, submit it, look.
 */
function makePage(cdp, { base, outDir, overflow, width }) {
  /** Run an expression in the page and get a real JS value back. */
  async function evaluate(expression) {
    const reply = await cdp.send('Runtime.evaluate', {
      expression: `(() => { ${expression} })()`,
      returnByValue: true,
      awaitPromise: true,
    });
    if (reply.result?.exceptionDetails) {
      const { text, exception } = reply.result.exceptionDetails;
      throw new Error(`page threw: ${exception?.description ?? text}`);
    }
    return reply.result?.result?.value;
  }

  /** Do something that navigates, and wait for the page it lands on. */
  async function navigating(fn) {
    cdp.seen.delete('Page.loadEventFired');
    await fn();
    if (!(await until(() => cdp.seen.has('Page.loadEventFired'), 60))) {
      throw new Error('the page never finished loading');
    }
    // Web fonts decide the layout on this site -- reading or shooting before they swap in gets
    // the fallback, which is not what any guest will see.
    await cdp.send('Runtime.evaluate', {
      expression: 'document.fonts.ready.then(() => true)',
      awaitPromise: true,
    });
    await sleep(120);
  }

  const page = {
    /** Where the browser actually is -- after redirects, which is usually the interesting part. */
    url: () => evaluate('return location.pathname + location.search'),

    title: () => evaluate('return document.title'),

    goto: (route) => navigating(() => cdp.send('Page.navigate', { url: `${base}${route}` })),

    /** The rendered text of the first match, or null. Whitespace collapsed, because HTML. */
    text: (selector) =>
      evaluate(
        `const el = document.querySelector(${JSON.stringify(selector)});
         return el ? el.textContent.replace(/\\s+/g, ' ').trim() : null;`,
      ),

    /** The same, uncollapsed, for the one caller that is reading data rather than words. */
    rawText: (selector) =>
      evaluate(
        `const el = document.querySelector(${JSON.stringify(selector)});
         return el ? el.textContent : null;`,
      ),

    has: async (selector) =>
      Boolean(await evaluate(`return !!document.querySelector(${JSON.stringify(selector)})`)),

    count: (selector) =>
      evaluate(`return document.querySelectorAll(${JSON.stringify(selector)}).length`),

    attr: (selector, name) =>
      evaluate(
        `const el = document.querySelector(${JSON.stringify(selector)});
         return el ? el.getAttribute(${JSON.stringify(name)}) : null;`,
      ),

    /**
     * Fill every control the server rendered, and let the caller override the ones it cares
     * about by name. Generic on purpose: per-game tickets are still landing and still adding
     * fields, and a walker that hardcodes field names goes stale the week it is written.
     *
     * Values are plausible rather than clever -- this walks flows, it does not fuzz them. What
     * matters is that `required` is satisfied, `maxlength` is respected and a `<select>` lands on
     * a real option rather than the empty prompt.
     */
    fillForm: (overrides = {}, formSelector = 'form') =>
      evaluate(`
        const found = document.querySelector(${JSON.stringify(formSelector)});
        const form = found && (found.closest('form') ?? found);
        if (!form || form.tagName !== 'FORM') throw new Error('no form on this page');
        const overrides = ${JSON.stringify(overrides)};
        // Distinct rather than repeated, because two of this site's games read the room's answers
        // as a corpus: a team whose every answer is the same word is a fixture no real team
        // produces, and it would make Herd's clustering look like it works when it has not been
        // asked anything.
        const WORDS = ${JSON.stringify(FILLER_WORDS)};
        const used = {};
        const filled = [];
        let n = 0;

        for (const el of form.elements) {
          if (!el.name || el.disabled) continue;
          if (el.tagName === 'BUTTON') continue;
          if (el.type === 'hidden' || el.type === 'file') continue;

          // An override may be an array, spent one entry per control of that name -- which is how
          // the door's two \`member\` fields get two different people in them.
          if (el.name in overrides) {
            const given = overrides[el.name];
            const value = Array.isArray(given)
              ? given[(used[el.name] = (used[el.name] ?? -1) + 1)]
              : given;
            if (value !== undefined) {
              el.value = String(value);
              filled.push(el.name);
              continue;
            }
          }

          if (el.tagName === 'SELECT') {
            // Past the empty prompt: an unchosen \`<select>\` is what the server bounces back.
            const option = [...el.options].find((o) => o.value !== '');
            if (option) el.value = option.value;
            filled.push(el.name);
            continue;
          }

          if (el.value) continue; // the server already put something here; leave it

          const max = Number(el.getAttribute('maxlength')) || 40;
          const word =
            el.type === 'number'
              ? String(Math.min(Number(el.max) || 42, Math.max(Number(el.min) || 0, 42)))
              : WORDS[n % WORDS.length];
          el.value = word.slice(0, max);
          filled.push(el.name);
          n += 1;
        }

        return filled;
      `),

    /**
     * POST a form this page does not render yet. `/admin/award` is a real route with a real
     * handler and no markup -- /admin is still #11's stub -- so the only way to move points is to
     * build the form the board will one day render and press it. Building it in the document
     * rather than fetching keeps one cookie jar and one code path: this is what the browser will
     * send when that markup lands.
     */
    post: (action, fields) =>
      navigating(() =>
        evaluate(`
          const form = document.createElement('form');
          form.method = 'post';
          form.action = ${JSON.stringify(action)};
          for (const [name, value] of Object.entries(${JSON.stringify(fields)})) {
            const input = document.createElement('input');
            input.type = 'hidden';
            input.name = name;
            input.value = String(value);
            form.append(input);
          }
          document.body.append(form);
          form.submit();
          return true;
        `),
      ),

    /**
     * Press the button that submits. The LAST one without a `formmethod`, because this site puts
     * escape hatches ahead of the real button on two screens -- "no, deal us another" and "ask me
     * something else" both carry `formmethod=get` and both come first. Pressing the button rather
     * than calling form.submit() also carries its own name and value, which is the entire payload
     * of every verdict button on /admin.
     */
    submit: (formSelector = 'form') =>
      navigating(() =>
        evaluate(`
          const found = document.querySelector(${JSON.stringify(formSelector)});
          const form = found && (found.closest('form') ?? found);
          if (!form || form.tagName !== 'FORM') throw new Error('no form to submit');
          const buttons = [...form.querySelectorAll('button, input[type=submit]')]
            .filter((b) => !b.getAttribute('formmethod'));
          const button = buttons.at(-1);
          if (!button) throw new Error('no submit button in this form');
          button.click();
          return true;
        `),
      ),

    /** Press a named button, wherever it is. Same navigation wait. */
    press: (selector) =>
      navigating(() =>
        evaluate(`
          const el = document.querySelector(${JSON.stringify(selector)});
          if (!el) throw new Error('nothing matches ' + ${JSON.stringify(selector)});
          el.click();
          return true;
        `),
      ),

    /**
     * Put a real file into a real <input type=file>. This is the one thing a page cannot be
     * talked into from JS -- the value of a file input is not settable -- and it is the only
     * reason this driver touches the DOM domain at all.
     */
    async setFile(selector, path) {
      const { result: doc } = await cdp.send('DOM.getDocument', { depth: -1 });
      const { result: found } = await cdp.send('DOM.querySelector', {
        nodeId: doc.root.nodeId,
        selector,
      });
      if (!found?.nodeId) throw new Error(`no file input matches ${selector}`);
      await cdp.send('DOM.setFileInputFiles', { nodeId: found.nodeId, files: [path] });
    },

    /**
     * Move down the page before looking. The fold is the one place a STICKY thing is still
     * sitting where it started, so at zero the marquee is indistinguishable from an ordinary
     * strip at the top -- and `--full` renders from the top too. Neither shows the thing worth
     * looking at: the marquee pinned over content that has scrolled under it.
     */
    async scrollTo(y) {
      if (!y) return;
      await evaluate(`scrollTo(0, ${Number(y)}); return true;`);
      await sleep(150);
    },

    /** Forget who we are, so the next walk arrives as a stranger. */
    clearCookies: () => cdp.send('Network.clearBrowserCookies'),

    /**
     * Look. Writes a PNG and returns its path, and measures sideways overflow on the way past --
     * free, and on a mobile-only site a real defect that has exactly this one moment to be seen.
     */
    async shoot(name, { full = false } = {}) {
      const measured = await evaluate(
        'return JSON.stringify({inner: innerWidth, doc: document.documentElement.scrollWidth})',
      );
      const { inner, doc } = JSON.parse(measured ?? '{}');
      // Two different ways to be too wide, and the second one hid a real defect from this very
      // check. A box that sizes itself to its content -- `contain: inline-size` on `.board`, on
      // /admin/codes -- widens the VIEWPORT to match rather than overflowing inside it. Both
      // numbers rise together, `doc > inner` stays quiet, and the page is laid out at 672px on a
      // 390px phone with `body { overflow-x: hidden }` clipping the rest. The width we asked for
      // is the only fixed thing here, so it has to be one of the comparisons.
      if (inner > width) {
        overflow.push(`${name}: the viewport stretched to ${inner}px, asked for ${width}px`);
      }
      if (doc > inner) overflow.push(`${name}: content is ${doc}px wide in a ${inner}px viewport`);

      const shot = await cdp.send('Page.captureScreenshot', {
        format: 'png',
        captureBeyondViewport: full,
      });
      const data = shot.result?.data;
      if (!data) throw new Error(`Chrome returned no image for ${name}`);

      const target = join(outDir, `${name}.png`);
      writeFileSync(target, Buffer.from(data, 'base64'));
      console.log(`  ${name} → ${target}`);
      return target;
    },
  };

  page.evaluate = evaluate;
  return page;
}

// --- the session ----------------------------------------------------------------------------

/**
 * Boot everything, hand it to `fn`, and tear it all down -- including on a throw and on Ctrl-C.
 *
 * `base` given means the caller is pointing at something already running (the live deploy, say)
 * and no server is started. Otherwise a fresh one comes up on a free port against a throwaway
 * database, which is what keeps this safe to run in a parallel worktree.
 */
export async function withBrowser(options, fn) {
  const {
    base: givenBase = null,
    out = null,
    reducedMotion = false,
    dark = false,
    width = PHONE.width,
    height = PHONE.height,
    scale = PHONE.scale,
    env = {},
  } = options;

  const chrome = findChrome();
  if (!chrome) {
    console.error('No Chrome found. Set $CHROME to its binary, or install Google Chrome.');
    process.exit(1);
  }

  const outDir = out ?? mkdtempSync(join(tmpdir(), 'bday-shots-'));
  mkdirSync(outDir, { recursive: true });

  // Chrome keeps writing into its profile as it dies, so this is swept at the very end.
  const profile = mkdtempSync(join(tmpdir(), 'bday-chrome-'));
  const overflow = [];

  let server = null;
  let browser = null;
  let dataDir = null;
  let base = givenBase;

  try {
    if (!base) {
      // A throwaway database, so this never touches $DATA_DIR and never dirties the checkout.
      dataDir = mkdtempSync(join(tmpdir(), 'bday-walk-data-'));
      const port = await freePort();
      base = `http://localhost:${port}`;

      // NODE_ENV is deleted rather than passed through. An inherited `development` would hand the
      // browser the test team before the first request is routed (src/dev.js), and a walker that
      // cannot arrive as a stranger cannot walk the door -- which is half of what it is for.
      const childEnv = { ...process.env, PORT: String(port), DATA_DIR: `${dataDir}/`, ...env };
      delete childEnv.NODE_ENV;
      delete childEnv.HA_WEBHOOK_URL; // nothing here should reach the house

      server = spawn(process.execPath, ['server.js'], {
        cwd: REPO,
        env: childEnv,
        stdio: ['ignore', 'ignore', 'pipe'],
      });
      let bootLog = '';
      server.stderr.on('data', (chunk) => (bootLog += chunk));

      // `finally` covers a throw, but not a Ctrl-C. Without this an interrupted run orphans a
      // server.
      process.on('exit', () => server?.kill());
      for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => process.exit(130));

      if (!(await until(() => fetch(`${base}/kit`, { signal: AbortSignal.timeout(1000) })))) {
        console.error(`server never came up on ${base}\n${bootLog}`);
        process.exit(1);
      }
    }

    // Port 0: Chrome picks one and writes it into the profile, so parallel runs never contend.
    // The profile is not optional either -- without it Chrome opens the human's REAL one and
    // deadlocks against the Chrome they already have running.
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
    await cdp.send('DOM.enable'); // only for setFileInputFiles
    await cdp.send('Network.enable'); // only for clearBrowserCookies
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: scale,
      mobile: true,
    });
    // One call or none: `setEmulatedMedia` REPLACES the whole feature list rather than merging
    // into it, so two calls would leave only the second one's feature emulated.
    const features = [
      ...(reducedMotion ? [{ name: 'prefers-reduced-motion', value: 'reduce' }] : []),
      ...(dark ? [{ name: 'prefers-color-scheme', value: 'dark' }] : []),
    ];
    if (features.length) await cdp.send('Emulation.setEmulatedMedia', { features });

    // `dark` is TWO overrides, and the second one is the one that bites (#89).
    //
    // The media query alone changes nothing here, and that is not the flag failing: with no
    // `color-scheme` declared the used value is `normal`, and Chrome renders `input`, `select` and
    // the file button LIGHT under `normal` whatever the phone prefers. Measured before the fix --
    // `prefers-color-scheme` reported dark and every control stayed white.
    //
    // What actually repaints this site is Chrome for Android's **Auto Dark Theme**, which inverts
    // pages that have not declared a scheme -- an algorithm, not a stylesheet, applied to a site
    // that never asked. `setAutoDarkModeOverride` is the only way to see it off an Android phone,
    // and declaring `color-scheme: light` is the documented way out of it.
    if (dark) await cdp.send('Emulation.setAutoDarkModeOverride', { enabled: true });

    const page = makePage(cdp, { base, outDir, overflow, width });
    const result = await fn({ page, base, outDir });
    socket.close();
    return { result, outDir, overflow };
  } finally {
    server?.kill();
    browser?.kill('SIGKILL');
    // Best-effort, always. A leftover temp directory is the OS's problem; throwing here would
    // leave the server running instead, which is how a machine ends up with seven of them.
    for (const path of [profile, dataDir].filter(Boolean)) {
      try {
        rmSync(path, { recursive: true, force: true, maxRetries: 20, retryDelay: 100 });
      } catch {
        /* Chrome still had a grip on it. Harmless. */
      }
    }
  }
}

/** Say what overflowed, in the one voice both scripts use. */
export function reportOverflow(overflow) {
  if (!overflow.length) return;
  process.stderr.write(`\n${overflow.length} PAGE(S) OVERFLOW SIDEWAYS:\n`);
  for (const line of overflow) process.stderr.write(`  ${line}\n`);
}
