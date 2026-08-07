// `contentTypeFor` is what `serveFrom` puts on every byte this site sends that is not a page --
// all of `public/`, and all of `data/uploads/`. Getting it wrong is not subtle: the wrong type on
// app.css is a site with no styling, and the wrong type on a woff2 is a site in Times New Roman.
//
// Characterises behaviour, not implementation. #102 Phase 2 replaces the table underneath with
// the `mime` package, and every assertion here must survive that unchanged -- except `.ico`,
// which is called out below because it is the one answer that legitimately changes.

import assert from 'node:assert/strict';
import { readdirSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
import { test, describe } from 'node:test';

import { contentTypeFor } from '../src/http.js';

const PUBLIC_DIR = new URL('../public/', import.meta.url).pathname;

describe('contentTypeFor', () => {
  test('the things pages are made of carry a charset', () => {
    assert.equal(contentTypeFor('/x/app.css'), 'text/css; charset=utf-8');
    assert.equal(contentTypeFor('/x/app.js'), 'text/javascript; charset=utf-8');
    assert.equal(contentTypeFor('/x/kit.html'), 'text/html; charset=utf-8');
  });

  test('fonts', () => {
    assert.equal(contentTypeFor('/fonts/bungee.woff2'), 'font/woff2');
  });

  test('every format an upload can be', () => {
    assert.equal(contentTypeFor('a.jpg'), 'image/jpeg');
    assert.equal(contentTypeFor('a.jpeg'), 'image/jpeg');
    assert.equal(contentTypeFor('a.png'), 'image/png');
    assert.equal(contentTypeFor('a.gif'), 'image/gif');
    assert.equal(contentTypeFor('a.webp'), 'image/webp');
    assert.equal(contentTypeFor('a.heic'), 'image/heic');
    assert.equal(contentTypeFor('a.avif'), 'image/avif');
  });

  test('an unknown extension downloads rather than guesses', () => {
    assert.equal(contentTypeFor('a.sqlite'), 'application/octet-stream');
    assert.equal(contentTypeFor('a.bin'), 'application/octet-stream');
    assert.equal(contentTypeFor('LICENSE'), 'application/octet-stream');
    assert.equal(contentTypeFor(''), 'application/octet-stream');
  });

  // A photo stored as .JPG by a camera that shouts must not fall through to a download.
  test('case does not decide', () => {
    assert.equal(contentTypeFor('A.JPG'), 'image/jpeg');
    assert.equal(contentTypeFor('A.HEIC'), 'image/heic');
  });

  // The regression this exists for: someone adds a font, an icon or an image to public/ in a
  // format the table has never seen, and the browser silently downloads it instead of using it.
  // This walks what is actually on disk rather than a list somebody has to remember to update.
  test('every extension actually shipped in public/ is known', () => {
    const walk = (dir) =>
      readdirSync(dir).flatMap((entry) => {
        const full = join(dir, entry);
        return statSync(full).isDirectory() ? walk(full) : [full];
      });

    const unknown = walk(PUBLIC_DIR)
      .filter((file) => extname(file) !== '')
      .filter((file) => contentTypeFor(file) === 'application/octet-stream');

    assert.deepEqual(unknown, [], 'public/ ships a file this site would serve as a download');
  });
});
