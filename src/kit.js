// The style kit's one piece of machinery, settled in #32.
//
// `/kit` is a demo page for the design system. The styles were always shared -- every page and
// the kit link the same `public/css/app.css`, so appearance cannot drift. What drifted was the
// MARKUP: which elements wear those classes was typed out twice, once in `public/kit.html` by
// hand and once in `src/render.js`, and the two copies came apart. The kit's scorebar was a
// `<div>` while the site's was an `<a>` carrying an "open" count the kit had never shown.
//
// So the kit stops keeping a copy. Where the app renders a component, `kit.html` carries a
// marker and this module swaps in the real function's output:
//
//     <!--@scorebar name="TEAM BADGER" score="47" open="2" total="10"-->
//
// The rule that follows, and the reason this file is small: a component's markup exists in
// exactly one place. If the app renders it, that place is `render.js` and the kit calls it. If
// the app does not render it yet -- the window frame, the starburst, the standing colours -- that
// place is `kit.html`, and the ticket that first builds it into a page moves it here in the same
// change, so a second copy is never created.

import { field, hero, hintModal, rulesList, scorebar, tile, win } from './render.js';

/** `<!--@name key="value" bare-key-->` */
const MARKER = /<!--@([\w-]+)((?:\s+[\w-]+(?:="[^"]*")?)*)\s*-->/g;
const ATTR = /([\w-]+)(?:="([^"]*)")?/g;

const num = (value, fallback = 0) => (value === undefined ? fallback : Number(value));

/**
 * One adapter per primitive, mapping the marker's flat bag of strings onto the function's real
 * signature. Numbers are coerced here because every marker attribute arrives as a string, and
 * `scorebar` branches on whether `total` is truthy -- where the string "0" is not.
 */
const RENDERERS = {
  scorebar: (a) =>
    scorebar({ name: a.name ?? '', score: num(a.score), open: num(a.open), total: num(a.total) }),

  // The trailing attrs are what let the animation section demo a REAL tile: its replay button
  // finds `data-anim-target`, which would otherwise have forced the kit to keep its own copy of
  // tile markup -- the exact thing this file exists to prevent.
  tile: ({ state, title, points, href, ...attrs }) =>
    tile({
      state: state ?? 'locked',
      title: title ?? '',
      points: num(points),
      href: href ?? '#tiles',
      attrs,
    }),

  hero: (a) => hero({ text: a.text ?? '', kicker: a.kicker ?? '', flavour: a.flavour ?? 'text' }),

  // Everything `field` does not name itself is a real HTML attribute on the control, escaped on
  // the way out by `field` -- so a marker can demo `required` or a `placeholder` without this
  // file knowing the list.
  field: ({ label, name, type, value, rows, ...attrs }) =>
    field({ label: label ?? '', name: name ?? '', type, value, rows: num(rows), attrs }),

  hintmodal: (a) =>
    hintModal({ notice: a.notice ?? 'paid', cost: num(a.cost, 3), backHref: a.href ?? '#modal' }),

  // `/rules` was the first page to render the window frame, so it moved out of kit.html and into
  // render.js in the same change -- the rule this file's header states. The body is a rules list
  // because that is the only thing wearing the frame so far; `rules` is pipe-separated because a
  // marker attribute is one flat string and a list has to survive being flattened into one.
  win: (a) =>
    win({
      title: a.title ?? 'the_rules.txt',
      body: rulesList((a.rules ?? '').split('|').filter(Boolean)),
      status: a.status ?? '',
      closeHref: a.href ?? '#window',
    }),
};

function parseAttrs(source) {
  const attrs = {};
  for (const [, key, value] of source.matchAll(ATTR)) attrs[key] = value ?? true;
  return attrs;
}

/**
 * Swap every marker for the real component. An unknown name renders a loud banner rather than
 * nothing: a marker that silently disappears would look exactly like a section somebody deleted,
 * which is the failure this whole mechanism exists to prevent.
 */
export function inject(source) {
  return source.replace(MARKER, (whole, name, rawAttrs) => {
    const render = RENDERERS[name.toLowerCase()];
    if (!render) {
      return `<p class="banner banner--bad">style kit: no primitive named <code>${name}</code>.
        Known: ${Object.keys(RENDERERS).join(', ')}.</p>`;
    }
    return render(parseAttrs(rawAttrs));
  });
}

/** The primitives a marker can name, for the kit's own footer. */
export const injectable = Object.keys(RENDERERS);
