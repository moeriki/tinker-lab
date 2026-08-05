// Photos: sniff what actually arrived, pull out a cheap thumbnail, write it to disk under a
// self-describing name. No image library, no resizing, no conversion -- see
// docs/adr/photos-are-stored-as-they-arrive.md.

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

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
 * which is how the gallery shows a grid without downloading megabytes: pure byte-walking, so it
 * costs no dependency and no image decoding. Measured on a real photo: 1282KB -> 6.7KB.
 */
export function exifThumbnail(buf) {
  if (sniff(buf) !== 'image/jpeg') return null;

  let offset = 2;
  while (offset + 4 <= buf.length) {
    if (buf[offset] !== 0xff) return null;
    const marker = buf[offset + 1];
    if (marker === 0xda) return null; // start of scan -- past every metadata segment
    const length = buf.readUInt16BE(offset + 2);

    if (marker === 0xe1 && buf.subarray(offset + 4, offset + 10).toString('latin1') === 'Exif\0\0') {
      return thumbnailFromTiff(buf.subarray(offset + 10, offset + 2 + length));
    }

    offset += 2 + length;
  }

  return null;
}

/** IFD0 is the image; IFD1, hanging off its tail, describes the thumbnail. */
function thumbnailFromTiff(tiff) {
  if (tiff.length < 8) return null;

  const order = tiff.subarray(0, 2).toString('latin1');
  if (order !== 'MM' && order !== 'II') return null;
  const bigEndian = order === 'MM';
  const u16 = (at) => (bigEndian ? tiff.readUInt16BE(at) : tiff.readUInt16LE(at));
  const u32 = (at) => (bigEndian ? tiff.readUInt32BE(at) : tiff.readUInt32LE(at));

  const ifd0 = u32(4);
  if (ifd0 + 2 > tiff.length) return null;

  const pointerToIfd1 = ifd0 + 2 + u16(ifd0) * 12; // entries are 12 bytes; the pointer follows
  if (pointerToIfd1 + 4 > tiff.length) return null;

  const ifd1 = u32(pointerToIfd1);
  if (!ifd1 || ifd1 + 2 > tiff.length) return null;

  let start = null;
  let length = null;
  const entries = u16(ifd1);

  for (let index = 0; index < entries; index += 1) {
    const entry = ifd1 + 2 + index * 12;
    if (entry + 12 > tiff.length) break;
    const tag = u16(entry);
    if (tag === 0x0201) start = u32(entry + 8); // JPEGInterchangeFormat
    if (tag === 0x0202) length = u32(entry + 8); // JPEGInterchangeFormatLength
  }

  if (start === null || length === null) return null;
  if (start + length > tiff.length) return null;

  const thumbnail = tiff.subarray(start, start + length);
  return sniff(thumbnail) === 'image/jpeg' ? thumbnail : null; // trust nothing, check it too
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
