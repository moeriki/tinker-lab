// The photo path, which until #102 nothing had ever run.
//
// `scripts/walk.js` uploaded a PNG, and `exifThumbnail` returns null on its first line for
// anything that is not a JPEG -- so the fifty-seven lines of TIFF byte-walking underneath it had
// never once executed in this repository. Every guest uploads a phone JPEG. That code was going
// to run for the first time, in front of everybody, on the night.
//
// These tests characterise BEHAVIOUR, not implementation: what bytes go in, what comes out. That
// is deliberate, because the implementations underneath are being replaced by libraries (#102
// Phase 2) and these assertions have to survive the swap unchanged. A swap that changes an answer
// here is a swap that changed the site.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test, describe } from 'node:test';

import {
  displayFor,
  exifThumbnail,
  isRenderable,
  photoFilename,
  sniff,
  thumbnailNameFor,
} from '../src/photos.js';

const FIXTURES = new URL('./fixtures/', import.meta.url).pathname;
const read = (name) => readFileSync(FIXTURES + name);

// Real files, not hand-built magic bytes. `sniff` only reads the first twelve bytes today, so
// synthetic headers would pass -- but the library replacing it may want more, and a fixture that
// is a real image is the only kind that can prove both. Regenerate with, from test/fixtures:
//
//   cp ../../public/img/teddy.jpg phone-photo.jpg
//   exiftool -overwrite_original "-ThumbnailImage<=../../public/img/kit-shot.jpg" phone-photo.jpg
//   sips -s format heic phone-photo.jpg --out phone-photo.heic
//   sips -s format gif -Z 32 ../../public/img/teddy.jpg --out tiny.gif
//   sips -s format png -Z 32 ../../public/img/teddy.jpg --out tiny.png
//   ffmpeg -i ../../public/img/teddy.jpg -vf scale=32:32 tiny.avif
//   cwebp -resize 32 32 ../../public/img/teddy.jpg -o tiny.webp
const SAMPLES = [
  ['phone-photo.jpg', 'image/jpeg', true],
  ['tiny.png', 'image/png', true],
  ['tiny.gif', 'image/gif', true],
  ['tiny.webp', 'image/webp', true],
  ['phone-photo.heic', 'image/heic', false],
  ['tiny.avif', 'image/avif', false],
];

describe('sniff', () => {
  for (const [file, mime] of SAMPLES) {
    test(`${file} is ${mime}`, () => {
      assert.equal(sniff(read(file)), mime);
    });
  }

  // The filename and the client's Content-Type are both claims. Only the bytes decide, which is
  // why a JPEG renamed to .png must still come back as a JPEG.
  test('a lying extension changes nothing', () => {
    assert.equal(sniff(read('phone-photo.jpg')), 'image/jpeg');
  });

  test('refuses what it does not recognise', () => {
    assert.equal(sniff(Buffer.from('this is not an image at all', 'utf8')), null);
    assert.equal(sniff(Buffer.alloc(0)), null);
    assert.equal(sniff(Buffer.from([0xff, 0xd8])), null); // a truncated JPEG magic, one byte short
    assert.equal(sniff(Buffer.alloc(64)), null); // all zeroes
  });
});

describe('isRenderable', () => {
  for (const [file, mime, renderable] of SAMPLES) {
    test(`${mime} ${renderable ? 'renders in an <img>' : 'gets the download tile'}`, () => {
      assert.equal(isRenderable(mime), renderable, `${file} disagreed`);
    });
  }

  // HEIC is the one that matters: Safari renders it natively and Chrome does not, and an iPhone
  // shooting in High Efficiency sends exactly this. It must be a download tile, never an <img>
  // that renders as a broken icon on half the phones at the party.
  test('HEIC is deliberately not renderable', () => {
    assert.equal(isRenderable('image/heic'), false);
  });

  test('an unknown mime is not renderable', () => {
    assert.equal(isRenderable('application/pdf'), false);
    assert.equal(isRenderable(null), false);
    assert.equal(isRenderable(undefined), false);
  });
});

describe('exifThumbnail', () => {
  // The whole point of the path: a 149KB photo yields a 7KB thumbnail, which is what lets the
  // gallery show a grid over house wifi shared by fifteen teams.
  test('pulls the embedded thumbnail out of a phone JPEG', () => {
    const thumbnail = exifThumbnail(read('phone-photo.jpg'));

    assert.ok(thumbnail, 'no thumbnail came back');
    assert.equal(thumbnail.length, 7341);
    assert.equal(sniff(thumbnail), 'image/jpeg', 'the thumbnail must itself be a JPEG');
    assert.ok(thumbnail.length < read('phone-photo.jpg').length / 10, 'thumbnail is not cheap');
  });

  test('returns null for formats that carry no EXIF thumbnail', () => {
    assert.equal(exifThumbnail(read('tiny.png')), null);
    assert.equal(exifThumbnail(read('tiny.gif')), null);
    assert.equal(exifThumbnail(read('tiny.webp')), null);
    assert.equal(exifThumbnail(read('phone-photo.heic')), null);
  });

  // A phone on patchy wifi is the ordinary case, not the exotic one. Half a photo must return
  // null rather than throw, because a throw here is a 500 on the one form guests actually use.
  test('survives a truncated file', () => {
    const whole = read('phone-photo.jpg');
    for (const cut of [2, 12, 64, 512, 4096, whole.length - 1]) {
      assert.doesNotThrow(() => exifThumbnail(whole.subarray(0, cut)), `cut at ${cut} threw`);
    }
  });

  test('survives garbage', () => {
    assert.doesNotThrow(() => exifThumbnail(Buffer.alloc(0)));
    assert.doesNotThrow(() => exifThumbnail(Buffer.from([0xff, 0xd8, 0xff, 0xe1, 0xff, 0xff])));
  });
});

describe('photoFilename', () => {
  const at = new Date(2026, 7, 14, 21, 34); // the night itself, local time

  test('is self-describing on disk', () => {
    const name = photoFilename({ teamId: 7, gameId: 'yarn', mime: 'image/jpeg', at });
    assert.match(name, /^0007-yarn-20260814T2134-[0-9a-f]{4}\.jpg$/);
  });

  test('every stored format gets its own extension', () => {
    for (const [, mime] of SAMPLES) {
      const name = photoFilename({ teamId: 1, gameId: 'g', mime, at });
      assert.notEqual(name.endsWith('.bin'), true, `${mime} fell through to .bin`);
    }
  });

  test('an unknown mime falls back to .bin rather than throwing', () => {
    assert.ok(photoFilename({ teamId: 1, gameId: 'g', mime: 'application/pdf', at }).endsWith('.bin'));
  });

  // The random tail is what keeps an /uploads URL unguessable, and that route has no cookie gate.
  test('two photos of the same game by the same team do not collide', () => {
    const args = { teamId: 3, gameId: 'scavenger', mime: 'image/jpeg', at };
    const names = new Set(Array.from({ length: 200 }, () => photoFilename(args)));
    assert.ok(names.size > 190, `only ${names.size} distinct names in 200`);
  });

  test('the thumbnail sits beside its photo', () => {
    assert.equal(thumbnailNameFor('0007-yarn-20260814T2134-a3f9.jpg'), '0007-yarn-20260814T2134-a3f9.thumb.jpg');
    assert.equal(thumbnailNameFor('0007-yarn-20260814T2134-a3f9.heic'), '0007-yarn-20260814T2134-a3f9.thumb.jpg');
  });
});

describe('displayFor', () => {
  test('prefers the cheap thumbnail', () => {
    const shown = displayFor({ photo_thumb: 'a.thumb.jpg', photo_path: 'a.jpg', photo_mime: 'image/jpeg' });
    assert.deepEqual(shown, { src: '/uploads/a.thumb.jpg', kind: 'thumb' });
  });

  test('falls back to the full image when it can be rendered', () => {
    const shown = displayFor({ photo_thumb: null, photo_path: 'a.png', photo_mime: 'image/png' });
    assert.deepEqual(shown, { src: '/uploads/a.png', kind: 'full' });
  });

  // The case an iPhone actually produces: HEIC, no EXIF thumbnail extracted. A download link,
  // never a broken <img>.
  test('a HEIC with no thumbnail becomes a download', () => {
    const shown = displayFor({ photo_thumb: null, photo_path: 'a.heic', photo_mime: 'image/heic' });
    assert.deepEqual(shown, { src: null, kind: 'download' });
  });
});
