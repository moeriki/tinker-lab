// Bare-bones rendering on top of the style kit (public/css/app.css, settled in "Build the style
// kit at /kit"). Pages here are structurally correct and compositionally unfinished on purpose:
// what each page is *made of* is owned by the per-game and dashboard tickets. What matters at
// this stage is that the route exists, the data is real, and nothing lies.

import { escape } from './http.js';

// PROTOTYPE: `proto` is the animation-choreography switcher (issue #14) and comes out with the
// branch. `pageAnim` is the class the whole page arrives with, which every scheme agrees on.
export function layout({ title, body, showClose = false, proto = '', pageAnim = '' }) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escape(title)}</title>
  <link rel="stylesheet" href="/css/app.css">
  ${proto ? '<link rel="stylesheet" href="/css/prototype-anim.css">' : ''}
</head>
<body class="shell">
  <div class="app${pageAnim}">
    <div class="stack">
      <h1 class="shout">${escape(title)}</h1>
      ${body}
      ${showClose ? '<a class="btn btn--close" href="/">close</a>' : ''}
    </div>
  </div>
  ${proto}
  <script type="module" src="/js/app.js"></script>
  ${proto ? '<script type="module" src="/js/prototype-anim.js"></script>' : ''}
</body>
</html>`;
}

/**
 * An honest placeholder. It names the ticket that owns the design, so nobody mistakes a stub for
 * a decision that was already made.
 */
export function stub({ title, owner, does, data = null }) {
  return layout({
    title,
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
