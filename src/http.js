// Small helpers over node:http. No framework: forms POST and redirect, pages render fresh.

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

/** urlencoded only. Multipart belongs to the photo submission ticket. */
export async function readForm(req, { limit = 64 * 1024 } = {}) {
  const chunks = [];
  let size = 0;

  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new Error('form body too large');
    chunks.push(chunk);
  }

  return new URLSearchParams(Buffer.concat(chunks).toString('utf8'));
}

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
      if (reqMethod !== method) return null;
      const found = regex.exec(pathname);
      if (!found) return null;
      return Object.fromEntries(names.map((name, index) => [name, decodeURIComponent(found[index + 1])]));
    },
  };
}
