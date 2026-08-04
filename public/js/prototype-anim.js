// PROTOTYPE — THROWAWAY. Switcher plumbing for issue #14, plus the one piece of client JS the
// signalling schemes actually need.
//
// Read this file as part of the answer to decision 3 ("does this earn client JS?"). Everything
// below the switcher is the REAL cost of schemes B and C — scheme A needs none of it.

const bar = document.querySelector('[data-protobar]');

if (bar) {
  // ← / → cycle variants. Ignored while typing, so the answer form still works.
  document.addEventListener('keydown', (event) => {
    const target = event.target;
    if (target instanceof HTMLElement) {
      const tag = target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable) return;
    }

    if (event.key === 'ArrowLeft') window.location.href = bar.dataset.prev;
    if (event.key === 'ArrowRight') window.location.href = bar.dataset.next;
  });
}

// --- the actual cost of signalling through the URL -----------------------------------------------
//
// A PRG redirect can only tell the next page what happened via a query param, and that param then
// LINGERS: pull-to-refresh replays the animation, and the URL a guest might screenshot or share
// says `?unlocked=yarn`. Stripping it needs History API access, which means a script tag.
//
// This runs after paint so the animation has already been kicked off by CSS — clearing the param
// does not cancel it, because the class was baked into the server's HTML.

const ONE_SHOT = ['unlocked', 'correct', 'done', 'just', 'verdict', 'shot', 'first'];

requestAnimationFrame(() => {
  const url = new URL(window.location.href);
  const had = ONE_SHOT.filter((key) => url.searchParams.has(key));
  if (!had.length) return;

  for (const key of had) url.searchParams.delete(key);
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);

  // Visible in the console so the cost is legible while flipping variants.
  console.log(`[proto] cleared one-shot signal(s) from the URL: ${had.join(', ')}`);
});
