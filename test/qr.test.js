// The QR encoder, against the inventory that actually gets printed.
//
// `scripts/qr-sheet.js --selftest` already round-trips every payload, and that is the check that
// matters most -- but it lives behind a flag on a script nobody runs on an ordinary day, and it
// is the same code checking itself. This file makes the round-trip a byproduct of `pnpm test`,
// and pins the two properties the printed card's geometry depends on.
//
// WHAT THIS DELIBERATELY DOES NOT ASSERT: the module bitmap. #102 Phase 2 replaces the encoder
// with `qrcode-generator`, and a different encoder may legitimately pick a different mask and
// produce a different -- equally valid, equally scannable -- symbol for the same payload. A
// golden bitmap would fail that swap for no reason. What must not change is that the symbol reads
// back as the right URL, at the version the card was measured for.
//
// Cross-checked before the swap: all 22 payloads encoded by `qrcode-generator` at level H decode
// through THIS decoder to the exact URL, at the same version 4. See #102.

import assert from 'node:assert/strict';
import { test, describe } from 'node:test';

import codes from '../content/codes.js';
import { byteCapacity, decodeQr, encodeQr, LEVELS, MAX_VERSION, toSvg } from '../scripts/qr-encode.js';

// The real base URL the cards are printed with -- the payload length is what decides the version,
// so testing against a shorter placeholder would test a symbol nobody prints.
const BASE = 'https://bday.moeriki.com';
const SLUGS = Object.keys(codes);
const urlFor = (slug) => `${BASE}/q/${slug}`;

// The card geometry in scripts/qr-sheet.js is built on this: 49.9mm across 41 spans, which is a
// 33x33 version-4 symbol plus its mandatory 4-module quiet zone. If a payload ever pushed the
// inventory to version 5, every module would shrink and the "arm's length" measurement the ADR
// made would silently stop being the measurement.
const PRINTED_VERSION = 4;
const PRINTED_SIZE = 33;
const PRINTED_LEVEL = 'H';

describe('the printed inventory', () => {
  test('there is an inventory to print', () => {
    assert.ok(SLUGS.length > 0, 'content/codes.js is empty');
  });

  test('every code round-trips through the encoder', () => {
    for (const slug of SLUGS) {
      const url = urlFor(slug);
      const symbol = encodeQr(url, PRINTED_LEVEL);
      assert.equal(decodeQr(symbol).text, url, `${slug} did not read back`);
    }
  });

  // Level H is 30% error correction, chosen because these are printed on paper, taped behind
  // furniture and handled by twenty-five people holding drinks. A payload that quietly needed a
  // bigger symbol would be found here rather than on the day.
  test('every code fits the symbol the card was measured for', () => {
    for (const slug of SLUGS) {
      const symbol = encodeQr(urlFor(slug), PRINTED_LEVEL);
      assert.equal(symbol.version, PRINTED_VERSION, `${slug} is not version ${PRINTED_VERSION}`);
      assert.equal(symbol.size, PRINTED_SIZE, `${slug} is not ${PRINTED_SIZE} modules across`);
    }
  });

  test('the payload has headroom in the version the card uses', () => {
    const longest = SLUGS.reduce((a, b) => (urlFor(a).length > urlFor(b).length ? a : b));
    const used = Buffer.byteLength(urlFor(longest), 'utf8');
    const capacity = byteCapacity(PRINTED_VERSION, PRINTED_LEVEL);

    assert.ok(used <= capacity, `the longest URL (${used}B) exceeds version ${PRINTED_VERSION} at H (${capacity}B)`);
  });

  test('slugs are unique, because a duplicate prints two identical cards', () => {
    assert.equal(new Set(SLUGS).size, SLUGS.length);
  });
});

describe('the encoder', () => {
  test('round-trips at every correction level', () => {
    for (const level of LEVELS) {
      const url = urlFor(SLUGS[0]);
      assert.equal(decodeQr(encodeQr(url, level)).text, url, `level ${level} did not read back`);
    }
  });

  test('round-trips payloads either side of a version boundary', () => {
    for (const length of [1, 2, 16, 17, 32, 33, 34, 64, 100]) {
      const text = 'x'.repeat(length);
      assert.equal(decodeQr(encodeQr(text, 'H')).text, text, `${length} bytes did not read back`);
    }
  });

  test('refuses a payload it cannot hold rather than truncating it', () => {
    const tooBig = 'x'.repeat(byteCapacity(MAX_VERSION, 'H') + 1);
    assert.throws(() => encodeQr(tooBig, 'H'));
  });

  test('the SVG carries the quiet zone the spec requires', () => {
    const svg = toSvg(encodeQr(urlFor(SLUGS[0]), PRINTED_LEVEL), { quiet: 4 });

    assert.match(svg, /^<svg /);
    assert.match(svg, /viewBox="0 0 41 41"/); // 33 modules + 4 either side
    assert.ok(svg.includes('</svg>'));
  });
});
