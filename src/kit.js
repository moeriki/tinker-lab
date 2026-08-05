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

import {
  field,
  hero,
  hintModal,
  rulesList,
  scorebar,
  shoot,
  shot,
  shots,
  tile,
  win,
} from './render.js';

/** `<!--@name key="value" bare-key-->` */
const MARKER = /<!--@([\w-]+)((?:\s+[\w-]+(?:="[^"]*")?)*)\s*-->/g;
const ATTR = /([\w-]+)(?:="([^"]*)")?/g;

const num = (value, fallback = 0) => (value === undefined ? fallback : Number(value));

/**
 * The one committed image on this page. A real photo strip points at `/uploads/`, which is player
 * data and empty on a fresh checkout, so the photo section needs a file of its own or it demos an
 * empty box. It is 160x120 and ~7KB, deliberately the size and shape of the EXIF thumbnails the
 * app actually serves (#10 measured 6.5KB), and deliberately a drawing -- this repository is
 * public and nothing in the house belongs in it.
 */
const SAMPLE_SHOT = '/img/kit-shot.jpg';

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
  //
  // `options` makes it a select, pipe separated the way `shots` and `win` flatten their lists.
  // A cell may be `value=label` where the two differ, which is Guess Who's shape: a card names a
  // member by id and shows a person's name.
  field: ({ label, name, type, value, rows, options, ...attrs }) =>
    field({
      label: label ?? '',
      name: name ?? '',
      type,
      value,
      rows: num(rows),
      options: options
        ? options
            .split('|')
            .filter(Boolean)
            .map((cell) => {
              const split = cell.indexOf('=');
              return split === -1
                ? cell
                : { value: cell.slice(0, split), label: cell.slice(split + 1) };
            })
        : null,
      attrs,
    }),

  hintmodal: (a) =>
    hintModal({ notice: a.notice ?? 'paid', cost: num(a.cost, 3), backHref: a.href ?? '#modal' }),

  shoot: (a) => shoot({ face: a.face ?? 'take a photo' }),

  // A cell with a `src` is a thumbnail; one without is the download tile, and its `label` is the
  // format it names. Both are the same call -- which branch you get is decided by whether there
  // was anything to draw, exactly as it is on a game page.
  shot: (a) => shot({ href: a.href ?? SAMPLE_SHOT, src: a.src ?? '', label: a.label ?? 'file' }),

  // The strip takes a LIST, and a marker attribute is one flat string, so the cells are pipe
  // separated the way `win` flattens its rules. A cell that starts with `/` is a thumbnail path;
  // anything else is a mime type and gets the download tile. Every cell taps through to the
  // sample image, since the kit has no uploads behind it.
  shots: (a) =>
    shots(
      (a.cells ?? '')
        .split('|')
        .filter(Boolean)
        .map((cell) =>
          cell.startsWith('/')
            ? { href: cell, src: cell }
            : { href: SAMPLE_SHOT, src: '', label: cell },
        ),
      a.anim ? ` ${a.anim}` : '',
    ),

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
