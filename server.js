// Minimal server. Deliberately dependency-free and deliberately dumb: the route
// inventory is still an open question (see "Domain model and route inventory"),
// so this only carries what the style kit needs.
//
// Everything is server-rendered fresh on every request and explicitly uncached.

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const PORT = process.env.PORT ?? 3040;
const PUBLIC_DIR = new URL('./public/', import.meta.url).pathname;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
};

const noCache = (res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
};

async function renderKit(res) {
  const html = await readFile(join(PUBLIC_DIR, 'kit.html'), 'utf8');

  noCache(res);
  res.writeHead(200, { 'Content-Type': MIME['.html'] });
  res.end(html);
}

async function serveStatic(pathname, res) {
  // normalize + strip leading separators so `../` can't escape public/
  const safe = normalize(pathname).replace(/^(\.\.[/\\])+/, '').replace(/^[/\\]+/, '');
  const file = join(PUBLIC_DIR, safe);

  if (!file.startsWith(PUBLIC_DIR)) {
    res.writeHead(403).end('nope');
    return;
  }

  try {
    const body = await readFile(file);
    noCache(res);
    res.writeHead(200, {
      'Content-Type': MIME[extname(file)] ?? 'application/octet-stream',
    });
    res.end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': MIME['.html'] });
    res.end('<h1>404</h1><p>there is no rule 4 either</p>');
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  try {
    if (url.pathname === '/' || url.pathname === '/kit') {
      await renderKit(res);
      return;
    }
    await serveStatic(url.pathname, res);
  } catch (error) {
    console.error(error);
    res.writeHead(500, { 'Content-Type': MIME['.html'] });
    res.end('<h1>500</h1><p>the host is still showering</p>');
  }
});

server.listen(PORT, () => {
  console.log(`style kit → http://localhost:${PORT}/kit`);
});
