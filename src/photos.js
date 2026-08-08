// Photos: sniff what actually arrived, pull out a cheap thumbnail, write it to disk under a
// self-describing name. No image library, no resizing, no conversion -- see
// docs/adr/photos-are-stored-as-they-arrive.md.

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import ExifReader from 'exifreader';

import { UPLOADS_DIR } from './config.js';

/** Cap on a single upload. A modern phone photo is 3-12MB; this is headroom, not a target. */
export const MAX_PHOTO_BYTES = 25 * 1024 * 1024;

const EXTENSIONS = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/heic': '.heic',
  'image/avif': '.avif',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

/**
 * Formats every browser we might judge on can render in an <img>. Safari renders HEIC natively
 * and Chrome does not, and we judge on "modern iOS and Android" -- so HEIC is deliberately absent
 * and gets a download tile instead of a broken image.
 */
const RENDERABLE = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

export const isRenderable = (mime) => RENDERABLE.has(mime);

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/**
 * What the bytes actually are -- never the filename, never the client's Content-Type. A phone
 * that lies about either still gets stored under the truth.
 *
 * #102 replaced the other two parsers in this repo with libraries and deliberately left this one
 * alone, having measured `file-type` against it: identical answers on all six formats and on every
 * garbage input the tests below throw at it, so the swap buys no correctness. What it costs is the
 * part that decided it -- `file-type` is async-only, so `sniff`, `exifThumbnail` and `storePhoto`
 * would all have to become async, and every assertion in `test/photos.test.js` would change shape
 * to follow. Those tests exist to prove a swap changed nothing; a swap that rewrites them cannot.
 * It also carries nine transitive packages into the runtime image, for twenty lines that compare
 * magic bytes and have never been wrong.
 */
export function sniff(buf) {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length > 8 && buf.subarray(0, 8).equals(PNG_MAGIC)) return 'image/png';

  if (buf.length > 12 && buf.subarray(4, 8).toString('latin1') === 'ftyp') {
    const brand = buf.subarray(8, 12).toString('latin1');
    if (brand.startsWith('hei') || brand.startsWith('mif')) return 'image/heic';
    if (brand === 'avif' || brand === 'avis') return 'image/avif';
  }

  if (
    buf.length > 12 &&
    buf.subarray(0, 4).toString('latin1') === 'RIFF' &&
    buf.subarray(8, 12).toString('latin1') === 'WEBP'
  ) {
    return 'image/webp';
  }

  if (buf.length > 3 && buf.subarray(0, 3).toString('latin1') === 'GIF') return 'image/gif';

  return null;
}

/**
 * The embedded EXIF thumbnail, or null. Phone JPEGs carry a ~160x120 JPEG in the APP1 segment,
 * which is how the gallery shows a grid without downloading megabytes. Measured on a real photo:
 * 1282KB -> 6.7KB.
 *
 * This was fifty-seven lines of TIFF offset arithmetic until #102, and it was the code with the
 * worst risk profile in the repo: nothing had ever run it (the walk uploaded a PNG, and the line
 * above returns null for those), and every guest uploads a phone JPEG, so it was going to execute
 * for the first time in front of everybody. `exifreader` returns the same 7341 bytes,
 * byte-identical, and is somebody else's problem to keep correct.
 */
export function exifThumbnail(buf) {
  if (sniff(buf) !== 'image/jpeg') return null;

  let thumbnail;
  try {
    // Where the hand-rolled walker returned null, this throws -- RangeError on a file cut off
    // inside the TIFF header, "Invalid image format" on an empty buffer. A photo arriving over
    // patchy wifi is the ordinary case, not the exotic one, and a throw here is a 500 on the one
    // form guests actually use.
    thumbnail = ExifReader.load(buf, { expanded: true }).Thumbnail;
  } catch {
    return null;
  }

  if (!thumbnail?.image) return null;

  // The other half of the same problem, and the quieter one: handed a JPEG that stops partway
  // through its own thumbnail, `exifreader` returns the bytes it found rather than nothing -- 320
  // bytes of a 7341-byte thumbnail, which still opens with the JPEG magic and so passes every
  // cheap check. Written to disk that becomes a permanently half-drawn tile. The declared length
  // is right there in the tag, so a short read is knowable: refuse it and let the gallery fall
  // back to the full image, which is what the old walker did by refusing to read past its buffer.
  if (thumbnail.JPEGInterchangeFormatLength?.value !== thumbnail.image.byteLength) return null;

  const bytes = Buffer.from(thumbnail.image);
  return sniff(bytes) === 'image/jpeg' ? bytes : null; // trust nothing, check it too
}

const pad = (value, width) => String(value).padStart(width, '0');

/** Local time, minute resolution -- enough to sort an evening, short enough to read. */
function stamp(date = new Date()) {
  return (
    `${date.getFullYear()}${pad(date.getMonth() + 1, 2)}${pad(date.getDate(), 2)}` +
    `T${pad(date.getHours(), 2)}${pad(date.getMinutes(), 2)}`
  );
}

const slugify = (value) => String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 24);

/**
 * Self-describing on disk, so `cp -r data/uploads` is already a labelled archive and the
 * post-party collage needs no export feature -- only the filesystem. The random tail is what
 * keeps an /uploads URL unguessable, since that route has no cookie gate.
 *
 *   0007-yarn-20260814T2134-a3f9.jpg
 *   team  game  when          random
 */
export function photoFilename({ teamId, gameId, mime, at = new Date() }) {
  const random = Math.random().toString(16).slice(2, 6);
  return `${pad(teamId, 4)}-${slugify(gameId)}-${stamp(at)}-${random}${EXTENSIONS[mime] ?? '.bin'}`;
}

export const thumbnailNameFor = (filename) => filename.replace(/\.[^.]+$/, '.thumb.jpg');

/**
 * Write one photo and, where the camera gave us one, its thumbnail. Called only after the whole
 * body has been parsed, so an upload that dies on patchy wifi leaves nothing behind at all --
 * there is no such thing as a half-written photo here.
 *
 * Returns null when the bytes are not an image we recognise.
 */
export function storePhoto({ teamId, gameId, buf }) {
  const mime = sniff(buf);
  if (!mime) return null;

  const filename = photoFilename({ teamId, gameId, mime });
  writeFileSync(join(UPLOADS_DIR, filename), buf);

  const thumbnail = exifThumbnail(buf);
  const thumbnailName = thumbnail ? thumbnailNameFor(filename) : null;
  if (thumbnail) writeFileSync(join(UPLOADS_DIR, thumbnailName), thumbnail);

  return { filename, mime, thumbnailName, bytes: buf.length };
}

/**
 * What the gallery should put in the tile: a cheap thumbnail, the full image, or neither --
 * in which case the caller shows a download link rather than a broken <img>.
 */
export function displayFor(submission) {
  if (submission.photo_thumb) return { src: `/uploads/${submission.photo_thumb}`, kind: 'thumb' };
  if (isRenderable(submission.photo_mime)) {
    return { src: `/uploads/${submission.photo_path}`, kind: 'full' };
  }
  return { src: null, kind: 'download' };
}
