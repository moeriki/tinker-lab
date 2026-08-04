#!/usr/bin/env node
// The printer. Reads content/codes.js and emits ONE self-contained HTML file that prints to A4.
//
//   node scripts/qr-sheet.js                      the whole inventory, six cards to a sheet
//   node scripts/qr-sheet.js --check              the print-day pre-flight; exits 1 if not ready
//   node scripts/qr-sheet.js --only=k7rbt9        a reprint of one lost card
//   node scripts/qr-sheet.js --only=03,07 --repeat=2
//   node scripts/qr-sheet.js --selftest           encode/decode every payload, prove the encoder
//   node scripts/qr-sheet.js --mint=3             three fresh slugs, for adding a code by hand
//
// HTML rather than PDF: a PDF writer is a dependency or a hand-rolled font embedder, and the
// browser we would use to check the PDF is the same browser that can print the HTML. Print at
// 100% scale ("Actual size", not "Fit to page") -- every dimension below is in millimetres and
// the QR size is a decision, not a suggestion. Nothing here needs "background graphics" enabled:
// the only colour is an inline SVG stripe, which is content and always prints.
//
// Reruns are free and produce byte-identical output for the same inventory: nothing is random,
// nothing is timestamped, and slugs are literals in content/codes.js. See ADR-0010.

import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { randomInt } from 'node:crypto';
import { dirname, join } from 'node:path';

import { decodeQr, encodeQr, toSvg, LEVELS, MAX_VERSION, byteCapacity } from './qr-encode.js';

const ROOT = new URL('..', import.meta.url).pathname;
const DEFAULT_BASE = process.env.SITE_BASE_URL ?? 'https://bday.moeriki.com';

// --- the numbers, and why they are these numbers ------------------------------------------------
//
// SYMBOL 49.9mm, MODULE 1.51mm. A 33-byte URL at level H is a version-4 symbol: 33x33 modules,
// plus the mandatory 4-module quiet zone on each side, is 41 spans across a 62mm box.
//
// Big enough: a 12MP phone at arm's length (~50cm) resolves roughly 0.17mm per pixel, so a 1.51mm
// module lands on ~9 pixels. Dim light costs contrast and adds motion blur, not resolution -- it
// takes a factor of five before a module stops being distinguishable. The usual field rule
// (scan distance is about 10x the symbol width) puts a 50mm symbol at half a metre, which is the
// arm's length the ticket asked for, and that rule assumes far worse cameras than a 2026 phone.
//
// LEVEL H (30%), not Q (25%) or M (15%). These are printed on paper, taped behind furniture,
// touched by twenty-five people holding drinks, and never reprinted mid-party. The cost of H over
// M is one version step (33x33 instead of 29x29) -- 2mm of module size on the same card, which the
// paragraph above says we can spare. Measured with an independent decoder (Apple's CIDetector), a
// version-4 H symbol still reads with a contiguous circular blot covering 20% of its area; the
// same symbol at level M dies well before that. A fold is the more likely damage, and a fold that
// lands anywhere but straight through a finder pattern is a thin line, not a blot.

const CARD = { width: 95, height: 92, perSheet: 6 }; // mm; 2 across x 3 down inside A4 @ 10mm
const QR_BOX = 62; // mm, quiet zone included
const LEVEL = 'H';

// Lifted from public/css/app.css. One per card, cycling, so the host can say "the pink one".
const STRIPES = ['#16e0d8', '#4fe04f', '#a8ee1e', '#f2e00c', '#ff9b2f', '#ff6fa8', '#ff17a3'];

// Unambiguous lowercase alphanumerics: no 0/o, no 1/l/i. Slugs are read aloud when a code
// misbehaves, and 30^6 is 729 million, which is opaque enough for something that is not secret.
const SLUG_ALPHABET = '23456789abcdefghjkmnpqrstuvwxyz';
const SLUG_LENGTH = 6;

// --- arguments -----------------------------------------------------------------------------------

function parseArgs(argv) {
  const options = {
    base: DEFAULT_BASE,
    level: LEVEL,
    only: null,
    repeat: 1,
    out: join(ROOT, 'data', 'qr-sheet.html'),
    key: true,
    force: false,
    check: false,
    selftest: false,
    mint: 0,
    help: false,
  };

  for (const arg of argv) {
    const [name, value] = arg.startsWith('--') ? arg.slice(2).split('=') : [arg, undefined];
    switch (name) {
      case 'base': options.base = value.replace(/\/+$/, ''); break;
      case 'level': options.level = value.toUpperCase(); break;
      case 'only': options.only = value.split(',').map((entry) => entry.trim()).filter(Boolean); break;
      case 'repeat': options.repeat = Number(value); break;
      case 'out': options.out = value; break;
      case 'no-key': options.key = false; break;
      case 'force': options.force = true; break;
      case 'check': options.check = true; break;
      case 'selftest': options.selftest = true; break;
      case 'mint': options.mint = Number(value ?? 1); break;
      case 'help': case 'h': options.help = true; break;
      default: throw new Error(`unknown option "${arg}" -- try --help`);
    }
  }

  if (!LEVELS.includes(options.level)) throw new Error(`--level must be one of ${LEVELS.join(', ')}`);
  if (!Number.isInteger(options.repeat) || options.repeat < 1) throw new Error('--repeat must be >= 1');
  return options;
}

const USAGE = `
qr-sheet -- print the QR inventory

  --check           validate only; exit 1 while any code is still pending
  --selftest        encode and decode every payload; exit 1 on any mismatch
  --mint=N          print N unused slugs and exit (writes nothing)

  --only=a,b        limit to these slugs or card numbers (reprints)
  --repeat=N        print each card N times (spares)
  --no-key          omit the host key sheet
  --base=URL        default ${DEFAULT_BASE} (or $SITE_BASE_URL)
  --level=L|M|Q|H   default ${LEVEL}
  --out=PATH        default data/qr-sheet.html; "-" writes to stdout
`;

// --- the inventory, as rows -----------------------------------------------------------------------

async function loadInventory(base) {
  const codes = (await import(new URL('../content/codes.js', import.meta.url))).default;

  return Object.entries(codes).map(([slug, target], index) => ({
    number: String(index + 1).padStart(2, '0'),
    slug,
    url: `${base}/q/${slug}`,
    target: target.game
      ? `game: ${target.game}${target.step ? `, step ${target.step}` : ''}`
      : `page: ${target.page}`,
    label: target.label ?? '(unlabelled)',
    where: target.where,
    pending: Boolean(target.pending),
  }));
}

const select = (rows, only) => {
  if (!only) return rows;
  const wanted = new Set(only);
  const chosen = rows.filter((row) => wanted.has(row.slug) || wanted.has(row.number));
  const missed = only.filter(
    (entry) => !rows.some((row) => row.slug === entry || row.number === entry),
  );
  if (missed.length) throw new Error(`--only names nothing in the inventory: ${missed.join(', ')}`);
  return chosen;
};

// --- the pre-flight ---------------------------------------------------------------------------------

/**
 * The gate that replaces "remember to check before you print". A `pending` code is a slug whose
 * target content is not authored yet -- deliberate while the game tickets are open, and a disaster
 * on the night, because the card is already taped to a lampshade.
 */
function preflight(rows, { base, level }) {
  const problems = [];
  const pending = rows.filter((row) => row.pending);

  for (const row of rows) {
    if (!/^[a-z0-9]+$/.test(row.slug)) problems.push(`slug "${row.slug}" is not url-safe`);
    const bytes = new TextEncoder().encode(row.url).length;
    if (bytes > byteCapacity(MAX_VERSION, level)) {
      problems.push(`${row.url} is ${bytes} bytes, past version ${MAX_VERSION} at level ${level}`);
    }
  }

  const bySlug = new Map();
  for (const row of rows) {
    if (bySlug.has(row.slug)) problems.push(`slug "${row.slug}" appears twice`);
    bySlug.set(row.slug, row);
  }

  if (!base.startsWith('https://') && !base.startsWith('http://')) {
    problems.push(`--base "${base}" is not an absolute URL; a phone camera cannot follow it`);
  }

  return { problems, pending };
}

function reportPreflight(rows, { problems, pending }) {
  const lines = [`${rows.length} codes, level ${LEVEL}.`];
  if (pending.length) {
    lines.push(`\n${pending.length} still pending -- their content is not written yet:`);
    for (const row of pending) lines.push(`  #${row.number} ${row.slug.padEnd(8)} ${row.target}`);
    lines.push('\nDrop `pending: true` in content/codes.js as each game lands.');
  }
  for (const problem of problems) lines.push(`  PROBLEM: ${problem}`);
  if (!pending.length && !problems.length) lines.push('Ready to print.');
  return lines.join('\n');
}

// --- the self-test -------------------------------------------------------------------------------

/**
 * Every symbol this repo will ever print, encoded and then decoded straight back through the spec
 * -- format bits, mask, zigzag, de-interleave, Reed-Solomon syndromes, payload. Plus a sweep of
 * every version and level, so a table typo cannot hide in a version we happen not to use.
 */
function selftest(rows, level) {
  const cases = rows.map((row) => [row.url, level]);
  for (let version = 1; version <= MAX_VERSION; version += 1) {
    for (const each of LEVELS) {
      cases.push(['A'.repeat(byteCapacity(version, each)), each]); // exactly full
      if (version > 1) cases.push(['b'.repeat(byteCapacity(version - 1, each) + 1), each]); // one over
    }
  }

  const failures = [];
  for (const [text, each] of cases) {
    try {
      const symbol = encodeQr(text, each);
      const back = decodeQr(symbol);
      if (back.text !== text) failures.push(`payload changed: ${text.slice(0, 24)}...`);
      if (back.level !== each) failures.push(`level ${each} read back as ${back.level}`);
      if (back.mask !== symbol.mask) failures.push(`mask ${symbol.mask} read back as ${back.mask}`);
    } catch (error) {
      failures.push(`${text.slice(0, 24)}... (${each}): ${error.message}`);
    }
  }

  return { count: cases.length, failures };
}

// --- minting ---------------------------------------------------------------------------------------

function mint(count, taken) {
  const minted = [];
  while (minted.length < count) {
    let slug = '';
    for (let i = 0; i < SLUG_LENGTH; i += 1) slug += SLUG_ALPHABET[randomInt(SLUG_ALPHABET.length)];
    if (!taken.has(slug) && !minted.includes(slug)) minted.push(slug);
  }
  return minted;
}

// --- the page ------------------------------------------------------------------------------------

const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character],
  );

/** Self-hosted fonts, inlined, so the sheet is one file that prints the same on any machine. */
function fontFace(family, file, weight = 400) {
  const data = readFileSync(join(ROOT, 'public', 'fonts', file)).toString('base64');
  return `@font-face{font-family:'${family}';font-weight:${weight};src:url(data:font/woff2;base64,${data}) format('woff2')}`;
}

const stripe = (colour) =>
  `<svg class="stripe" viewBox="0 0 100 6" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">` +
  `<rect width="100" height="6" fill="${colour}"/></svg>`;

/**
 * One card. It deliberately says NOTHING about what the code does: the same card front carries a
 * hunt step, a photo tile and the rickroll. A label would spoil the gags, and a gag that is only
 * unlabelled *sometimes* is a label of its own -- the unmarked cards would be the funny ones. The
 * mapping lives on the host key sheet, which is not for cutting.
 *
 * What it does carry: the site name, so a card found in a corridor without a phone still says
 * where it came from; the card number, which is the host's index and means nothing to a guest;
 * and the slug in small type, so "code seven is broken" can be looked up in /admin/codes.
 */
function card(row, index, host) {
  const symbol = encodeQr(row.url, LEVEL);
  return `
  <div class="card">
    <div class="sticker">
      ${stripe(STRIPES[index % STRIPES.length])}
      <div class="band">${escape(host)}</div>
      <div class="qr">${toSvg(symbol, { quiet: 4 })}</div>
      <div class="foot">
        <span class="num">#${row.number}</span>
        <span class="say">point your camera</span>
        <span class="slug">${escape(row.slug)}</span>
      </div>
    </div>
  </div>`;
}

function keySheet(rows, base) {
  const body = rows
    .map(
      (row) => `
      <tr${row.pending ? ' class="pending"' : ''}>
        <td class="num">#${row.number}</td>
        <td class="mono">${escape(row.slug)}</td>
        <td>${escape(row.label)}</td>
        <td class="mono">${escape(row.target)}${row.pending ? ' <b>PENDING</b>' : ''}</td>
        <td>${row.where ? escape(row.where) : '<i>hiding plan not settled</i>'}</td>
      </tr>`,
    )
    .join('');

  return `
  <section class="key">
    <h1>HOST KEY &mdash; do not cut, do not hide</h1>
    <p>Every card front is identical on purpose. This is the only place the mapping exists on
      paper. ${escape(rows.length)} codes, base <span class="mono">${escape(base)}</span>.</p>
    <table>
      <thead><tr><th>#</th><th>slug</th><th>label</th><th>target</th><th>where it goes</th></tr></thead>
      <tbody>${body}</tbody>
    </table>
    <p class="small">Print at 100% scale (&ldquo;Actual size&rdquo;), A4, margins 10mm. Cut on the
      dashed lines. Reprint one card with
      <span class="mono">node scripts/qr-sheet.js --only=&lt;slug&gt;</span>.</p>
  </section>`;
}

function document_(rows, options) {
  const host = new URL(options.base).host;
  const cards = rows.flatMap((row) => Array.from({ length: options.repeat }, () => row));

  const sheets = [];
  for (let i = 0; i < cards.length; i += CARD.perSheet) {
    const slice = cards
      .slice(i, i + CARD.perSheet)
      .map((row, index) => card(row, i + index, host))
      .join('');
    sheets.push(`<section class="sheet">${slice}</section>`);
  }

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>QR sheet &mdash; ${escape(host)}</title>
<style>
${fontFace('Bungee', 'bungee.woff2')}
${fontFace('Courier Prime', 'courier-prime.woff2')}
${fontFace('Courier Prime', 'courier-prime-bold.woff2', 700)}

@page { size: A4; margin: 10mm; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: #fff; color: #000; }
body { font-family: 'Courier Prime', ui-monospace, monospace; }

.sheet {
  display: grid;
  grid-template-columns: ${CARD.width}mm ${CARD.width}mm;
  grid-auto-rows: ${CARD.height}mm;
  break-after: page;
}
.sheet:last-of-type { break-after: auto; }

/* The cut line. Outline rather than border so it never adds to the grid cell. */
.card { padding: 4mm; outline: 0.2mm dashed #b0b0b0; outline-offset: -0.1mm; break-inside: avoid; }

.sticker {
  height: 100%;
  display: flex;
  flex-direction: column;
  border: 1.2mm solid #000;
  border-radius: 1.5mm;
  overflow: hidden;
  background: #fff;
}
.stripe { flex: 0 0 4mm; width: 100%; display: block; }
.band {
  flex: 0 0 8mm;
  border-top: 0.6mm solid #000;
  border-bottom: 0.6mm solid #000;
  font-family: 'Bungee', Impact, sans-serif;
  font-size: 4.1mm;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  display: flex; align-items: center; justify-content: center;
}
.qr { flex: 1 1 auto; display: flex; align-items: center; justify-content: center; }
.qr svg { width: ${QR_BOX}mm; height: ${QR_BOX}mm; display: block; }
.foot {
  flex: 0 0 7mm;
  border-top: 0.6mm solid #000;
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 2.5mm;
  font-size: 2.6mm;
}
.foot .num { font-family: 'Bungee', Impact, sans-serif; font-size: 3.6mm; }
.foot .say { letter-spacing: 0.08em; text-transform: uppercase; }
.foot .slug { font-weight: 700; }

.key { break-before: page; font-size: 3.2mm; }
.key h1 { font-family: 'Bungee', Impact, sans-serif; font-size: 6mm; margin: 0 0 3mm; }
.key table { border-collapse: collapse; width: 100%; }
.key th, .key td { border: 0.2mm solid #000; padding: 1.2mm 1.6mm; text-align: left; vertical-align: top; }
.key th { font-family: 'Bungee', Impact, sans-serif; font-size: 2.8mm; }
.key .num { font-family: 'Bungee', Impact, sans-serif; white-space: nowrap; }
.key .mono { font-size: 3mm; }
.key tr.pending td { background: #f2e00c; }
.key .small { margin-top: 3mm; font-size: 2.8mm; }
</style>
</head>
<body>
${sheets.join('\n')}
${options.key ? keySheet(rows, options.base) : ''}
</body>
</html>
`;
}

// --- main ------------------------------------------------------------------------------------------

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(`${USAGE}\n`);
    return 0;
  }

  const rows = await loadInventory(options.base);

  if (options.mint) {
    process.stdout.write(`${mint(options.mint, new Set(rows.map((row) => row.slug))).join('\n')}\n`);
    return 0;
  }

  if (options.selftest) {
    const { count, failures } = selftest(rows, options.level);
    if (failures.length) {
      process.stderr.write(`SELFTEST FAILED (${failures.length}/${count}):\n`);
      for (const failure of failures) process.stderr.write(`  ${failure}\n`);
      return 1;
    }
    process.stderr.write(`selftest: ${count} symbols encoded and decoded back, all identical.\n`);
    return 0;
  }

  const chosen = select(rows, options.only);
  const result = preflight(chosen, options);
  process.stderr.write(`${reportPreflight(chosen, result)}\n`);

  if (options.check) return result.problems.length || result.pending.length ? 1 : 0;

  if (result.problems.length) {
    process.stderr.write('\nRefusing to print: fix the problems above.\n');
    return 1;
  }
  if (result.pending.length && !options.force) {
    process.stderr.write(
      '\nRefusing to print while codes are pending. A card pointing at a game that does not\n' +
        'exist is a guest holding a phone in front of a 404. Pass --force for a dry run.\n',
    );
    return 1;
  }

  const output = document_(chosen, options);

  if (options.out === '-') {
    process.stdout.write(output);
  } else {
    mkdirSync(dirname(options.out), { recursive: true });
    writeFileSync(options.out, output);
    const sheets = Math.ceil((chosen.length * options.repeat) / CARD.perSheet);
    process.stderr.write(
      `\nWrote ${options.out}\n` +
        `${chosen.length * options.repeat} cards on ${sheets} sheet(s)` +
        `${options.key ? ' plus the host key' : ''}.\n` +
        'Open it, print A4 at 100% scale, cut on the dashed lines.\n',
    );
  }
  return 0;
}

process.exitCode = await main();
