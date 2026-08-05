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
// the app does not render it yet, that place is `kit.html`, and the ticket that first builds it
// into a page moves it here in the same change, so a second copy is never created.
//
// Which sections those are is not written down anywhere as a list, and this comment deliberately
// does not name them. It used to, and it was wrong: it still named the window frame after #37
// built it. So did the page's own header comment, the page's footer and `CONTEXT.md` -- four
// hand-typed copies, three of them stale, and #53 corrected two of the four without ever seeing
// the other two. A list maintained by remembering to maintain it is a list that is wrong.
//
// So the kit counts instead of remembering. A hand-written demo carries `@owed`, the footer's two
// halves are generated from those markers and from `injectable`, and the page reports its own
// debt rather than being told what it is (#55).

import {
  bubble,
  field,
  hero,
  hintModal,
  rulesList,
  scorebar,
  shoot,
  shot,
  shots,
  tile,
  unitRow,
  win,
} from './render.js';
import { escape } from './http.js';

/** `<!--@name key="value" bare-key-->` */
const MARKER = /<!--@([\w-]+)((?:\s+[\w-]+(?:="[^"]*")?)*)\s*-->/g;
const ATTR = /([\w-]+)(?:="([^"]*)")?/g;

const num = (value, fallback = 0) => (value === undefined ? fallback : Number(value));

/**
 * A marker's flat bag of strings onto `field()`. Its own function rather than an inline adapter
 * because §14 needs to put a field *inside* a unit row, and a second copy of this mapping is the
 * kind of duplication this whole file exists to stop.
 */
function fieldFrom({ label, name, type, value, rows, options, ...attrs }) {
  return field({
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
  });
}

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
  field: (a) => fieldFrom(a),

  hintmodal: (a) =>
    hintModal({ notice: a.notice ?? 'paid', cost: num(a.cost, 3), backHref: a.href ?? '#modal' }),

  // A marker attribute cannot contain a `"` -- ATTR reads up to the closing one -- so the kit's
  // line wears curly quotes. That is the only thing about it this extraction changed.
  bubble: (a) => bubble(a.text ?? ''),

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

  // The row every unit game puts on its tile. Its `body` is markup the page renders, and a marker
  // attribute is one flat string, so the kit cannot pass one -- it NAMES the primitives to compose
  // instead, and this adapter builds the body out of the same functions a game page calls. Which
  // is the point: §14 demos the row holding real parts, not a drawing of one.
  //
  // The one thing it cannot show is the `<form>` around it, because render.js renders no form
  // action anywhere and this file is not allowed to invent one. So the scavenger's send button is
  // absent here and present on the tile, and that gap is the seam #51 settled rather than a
  // section that is missing something.
  unitrow: ({ shot: src, label, bubble: quote, field: fieldLabel, options, shoot: face }) =>
    unitRow({
      shot: src ? shot({ href: SAMPLE_SHOT, src }) : '',
      label: label ?? '',
      body: [
        quote ? bubble(quote) : '',
        fieldLabel ? fieldFrom({ label: fieldLabel, name: 'demo', options }) : '',
        face ? shoot({ face }) : '',
      ]
        .filter(Boolean)
        .join('\n        '),
    }),

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

/** The primitives a marker can name -- exactly what `render.js` builds, in declaration order. */
export const injectable = Object.keys(RENDERERS);

/**
 * What each primitive is called in a sentence a person reads. Only the names that differ from the
 * key need an entry; anything missing falls back to the key itself, so a new primitive shows up in
 * the footer looking slightly wrong rather than not showing up at all. That is the trade this
 * whole ticket is about: the old footer was hand-typed and could be silently, permanently wrong.
 *
 * `shot` and `shots` deliberately share a name -- two functions, one thing a reader recognises --
 * which is why the list is deduplicated on the way out.
 */
const BUILT_NAMES = {
  scorebar: 'the scorebar',
  tile: 'the tiles',
  hero: 'the heroes',
  field: 'the fields',
  hintmodal: 'the modal',
  bubble: 'the speech bubble',
  shoot: 'the camera',
  unitrow: 'the unit rows',
  shot: 'the shots',
  shots: 'the shots',
  win: 'the window frame',
};

/** `a, b and c` -- the footer is prose, not a bullet list. */
const sentence = (items) =>
  items.length < 2 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;

const upperFirst = (text) => text.charAt(0).toUpperCase() + text.slice(1);

/**
 * The three markers that report on the PAGE rather than render a component, so unlike `RENDERERS`
 * they need to know what else is on it. `@owed` badges a hand-written demo; `@built` and
 * `@owed-list` are the two halves of the footer sentence, and neither is typed by hand.
 *
 * `@owed` without a name is an error rather than a bare badge: a badge that contributed nothing to
 * the footer would leave the page claiming a debt its own summary does not count.
 */
const pageChrome = (owed) => ({
  owed: (a) =>
    typeof a.name === 'string'
      ? `<p class="owed">still owed</p>`
      : `<p class="banner banner--bad">style kit: <code>@owed</code> needs a
        <code>name</code>, which is how the footer counts it.</p>`,

  built: () => upperFirst(sentence([...new Set(injectable.map((key) => BUILT_NAMES[key] ?? key))])),

  'owed-list': () =>
    owed.length
      ? upperFirst(sentence(owed))
      : 'Nothing — every section on this page is rendered by the app',
});

/**
 * Swap every marker for the real component. An unknown name renders a loud banner rather than
 * nothing: a marker that silently disappears would look exactly like a section somebody deleted,
 * which is the failure this whole mechanism exists to prevent.
 *
 * Two passes. The first collects the `@owed` names so the footer can report them; the second
 * injects. One pass would work only while the footer stays last in the file, and a rule that holds
 * because of line ordering is the kind that breaks the day someone moves a section.
 */
export function inject(source) {
  const owed = [];
  for (const [, name, rawAttrs] of source.matchAll(MARKER)) {
    if (name.toLowerCase() !== 'owed') continue;
    const label = parseAttrs(rawAttrs).name;
    if (typeof label === 'string') owed.push(escape(label));
  }

  const chrome = pageChrome(owed);

  return source.replace(MARKER, (whole, name, rawAttrs) => {
    const key = name.toLowerCase();
    const render = chrome[key] ?? RENDERERS[key];
    if (!render) {
      return `<p class="banner banner--bad">style kit: no primitive named <code>${name}</code>.
        Known: ${[...injectable, ...Object.keys(chrome)].join(', ')}.</p>`;
    }
    return render(parseAttrs(rawAttrs));
  });
}
