// Small helpers over node:http. No framework: forms POST and redirect, pages render fresh.

import { Readable } from 'node:stream';

import mime from 'mime';

export function noCache(res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
}

export function parseCookies(req) {
  const header = req.headers.cookie ?? '';
  const jar = {};

  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index < 0) continue;
    jar[part.slice(0, index).trim()] = decodeURIComponent(part.slice(index + 1).trim());
  }

  return jar;
}

export function setCookie(res, name, value, { maxAge = 60 * 60 * 24 * 30, httpOnly = true } = {}) {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    'SameSite=Lax', // QR scans are top-level GET navigations, so Lax is enough
    `Max-Age=${maxAge}`,
  ];
  if (httpOnly) parts.push('HttpOnly');
  if (process.env.NODE_ENV === 'production') parts.push('Secure');

  const existing = res.getHeader('Set-Cookie');
  const all = existing ? [].concat(existing) : [];
  res.setHeader('Set-Cookie', [...all, parts.join('; ')]);
}

export const clearCookie = (res, name) => setCookie(res, name, '', { maxAge: 0 });

/** urlencoded only. Use `readMultipart` when the form can carry a photo. */
export async function readForm(req, { limit = 64 * 1024 } = {}) {
  const chunks = [];
  let size = 0;

  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new TooLarge();
    chunks.push(chunk);
  }

  return new URLSearchParams(Buffer.concat(chunks).toString('utf8'));
}

/** Thrown past the size cap, and caught into an honest message rather than a 500. */
export class TooLarge extends Error {
  constructor() {
    super('body too large');
    this.name = 'TooLarge';
  }
}

export const isMultipart = (req) =>
  (req.headers['content-type'] ?? '').startsWith('multipart/form-data');

/**
 * Multipart, with no dependency: Node can bridge an IncomingMessage into a web Request and let
 * the platform's own parser do the work. Verified on Node 26, which is what the container pins.
 *
 * The body is capped twice -- once on the declared Content-Length so an oversized upload dies
 * before it is sent, and once on the bytes actually seen, because a header is a claim.
 */
export async function readMultipart(req, { limit } = {}) {
  const declared = Number(req.headers['content-length'] ?? 0);
  if (declared > limit) throw new TooLarge();

  let seen = 0;
  const counter = new TransformStream({
    transform(chunk, controller) {
      seen += chunk.byteLength;
      if (seen > limit) throw new TooLarge();
      controller.enqueue(chunk);
    },
  });

  const request = new Request('http://form.invalid/', {
    method: 'POST',
    headers: { 'content-type': req.headers['content-type'] },
    body: Readable.toWeb(req).pipeThrough(counter),
    duplex: 'half',
  });

  let form;
  try {
    form = await request.formData();
  } catch (error) {
    // The cap fires inside the stream, so it surfaces here wrapped as a parse failure.
    if (seen > limit || declared > limit) throw new TooLarge();
    throw error;
  }

  const fields = new URLSearchParams();
  const files = [];

  for (const [name, value] of form.entries()) {
    if (typeof value === 'string') {
      fields.append(name, value);
      continue;
    }
    // A file input left empty still posts a part: zero bytes and an empty filename.
    if (value.size === 0) continue;
    files.push({ name, filename: value.name, buf: Buffer.from(await value.arrayBuffer()) });
  }

  return { fields, files };
}

/**
 * What to put in `Content-Type` for a file on disk. Two directories are served through this:
 * `public/` (css, html, jpg, js, woff2) and `data/uploads/`, which is where the six image formats
 * come from -- so this answers for more than a listing of `public/` suggests.
 *
 * It lives here rather than beside the static handler in app.js because app.js opens the database
 * on import: a test that wanted to check this would have had to create a database to read it,
 * which is why it went untested for as long as it did.
 *
 * This was a hand-written table of thirteen extensions until #102. The failure mode was never a
 * wrong answer for something in it -- it was somebody adding a font or an image to `public/` in a
 * format nobody thought to add, and the browser quietly downloading it. `mime` knows every
 * extension either directory can hold and carries no dependencies of its own.
 *
 * Two things the library does not do for us. It answers `text/css`, not `text/css; charset=utf-8`,
 * and a stylesheet served without a charset is a stylesheet a browser may decode wrongly -- so
 * every `text/*` gets one appended. And it answers `null` rather than guessing, which is exactly
 * the behaviour wanted: an unknown extension downloads.
 *
 * One answer legitimately changed: `.ico` is now `image/vnd.microsoft.icon` rather than
 * `image/x-icon`. Both work everywhere, and nothing in `public/` is an .ico today.
 */
export const contentTypeFor = (file) => {
  const type = mime.getType(file) ?? 'application/octet-stream';
  return type.startsWith('text/') ? `${type}; charset=utf-8` : type;
};

export function redirect(res, location, status = 303) {
  noCache(res);
  res.writeHead(status, { Location: location });
  res.end();
}

export function html(res, body, status = 200) {
  noCache(res);
  res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(body);
}

/** Escape for interpolation into HTML text or a quoted attribute. */
export const escape = (value) =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

/**
 * `/g/:gameId/submit` → a matcher returning params, or null. Deliberately tiny: the route
 * inventory is short and fixed (see CONTEXT.md).
 *
 * A `HEAD` matches a `GET` route, because a HEAD is a GET whose body is thrown away and Node
 * throws it away for us. Before that it did not, so `curl -I` answered 404 on a healthy site and
 * `MM-HANDOFF.md` read that as a missing proxy host (#40).
 *
 * A route declared `HEAD` still matches only HEAD, so a path whose GET is not safe to replay can
 * claim the HEAD for itself by sitting above it in the inventory -- which is exactly what
 * `/q/:slug` does.
 */
export function route(method, pattern, handler) {
  const names = [];
  const source = pattern
    .split('/')
    .map((segment) => {
      if (!segment.startsWith(':')) return segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      names.push(segment.slice(1));
      return '([^/]+)';
    })
    .join('/');

  const regex = new RegExp(`^${source}$`);

  return {
    method,
    handler,
    match(reqMethod, pathname) {
      const matchesMethod = reqMethod === method || (reqMethod === 'HEAD' && method === 'GET');
      if (!matchesMethod) return null;
      const found = regex.exec(pathname);
      if (!found) return null;
      return Object.fromEntries(names.map((name, index) => [name, decodeURIComponent(found[index + 1])]));
    },
  };
}
