// Entry point. Everything is server-rendered fresh on every request and explicitly uncached; the
// admin page polls so the host watches progress in real time.
//
// The route inventory, the domain model and the schema are settled -- see CONTEXT.md and
// docs/adr/. Routes whose *composition* is still owned by a later ticket render an honest stub
// rather than a guess.

import { createServer } from 'node:http';

import { PORT, ADMIN_SECRET_IS_DEFAULT, HA_WEBHOOK_URL } from './src/config.js';
import { migrate } from './src/db.js';
import { loadContent, warnAboutOrphans } from './src/content.js';
import { handle } from './src/app.js';
import { html } from './src/http.js';
import { layout } from './src/render.js';

migrate();
await loadContent();
warnAboutOrphans();

const server = createServer(async (req, res) => {
  try {
    await handle(req, res);
  } catch (error) {
    console.error(error);
    if (res.headersSent) return;
    html(res, layout({ title: '500', body: '<p>the host is still showering</p>' }), 500);
  }
});

server.listen(PORT, () => {
  console.log(`bday → http://localhost:${PORT}`);
  console.log(`kit  → http://localhost:${PORT}/kit`);

  // Said at boot rather than left to be discovered: the container logs are the only place MM
  // will look, and both of these are silent failures otherwise.
  if (ADMIN_SECRET_IS_DEFAULT) {
    console.warn('WARNING: ADMIN_SECRET is unset — /admin/key/change-me is guessable. Set it.');
  }
  if (!HA_WEBHOOK_URL) {
    console.warn('note: HA_WEBHOOK_URL is unset — hunt scans will not reach Home Assistant.');
  }
});
