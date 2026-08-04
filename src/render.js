// Bare-bones rendering on top of the style kit (public/css/app.css, settled in "Build the style
// kit at /kit"). Pages here are structurally correct and compositionally unfinished on purpose:
// what each page is *made of* is owned by the per-game and dashboard tickets. What matters at
// this stage is that the route exists, the data is real, and nothing lies.

import { escape } from './http.js';

/**
 * `still` opts a page out of the arrival animation. The admin board is the only caller that
 * wants it: it polls, and a page that re-animates every few seconds is unreadable. Team-facing
 * pages animate by default so a new one never has to remember to.
 */
export function layout({ title, body, showClose = false, still = false }) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escape(title)}</title>
  <link rel="stylesheet" href="/css/app.css">
</head>
<body class="shell">
  <div class="app${still ? '' : ' anim-page'}">
    <div class="stack">
      <h1 class="shout">${escape(title)}</h1>
      ${body}
      ${showClose ? '<a class="btn btn--close" href="/">close</a>' : ''}
    </div>
  </div>
  <script type="module" src="/js/app.js"></script>
</body>
</html>`;
}

/**
 * An honest placeholder. It names the ticket that owns the design, so nobody mistakes a stub for
 * a decision that was already made.
 */
export function stub({ title, owner, does, data = null, still = false }) {
  return layout({
    title,
    still,
    body: `
      <p class="banner"><strong>Not designed yet.</strong> Owned by: ${escape(owner)}.</p>
      <p>${escape(does)}</p>
      ${data ? `<pre class="mono">${escape(JSON.stringify(data, null, 2))}</pre>` : ''}
      <a class="btn btn--close" href="/">back to the dashboard</a>
    `,
  });
}

export const notFound = () =>
  layout({
    title: '404',
    body: '<p>there is no rule 4 either</p>',
  });
