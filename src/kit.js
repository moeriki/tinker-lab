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

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  askModal,
  blurb,
  boredButton,
  boredModal,
  bubble,
  card,
  doorStep,
  field,
  hero,
  hintModal,
  league,
  openedBox,
  rulesList,
  scorebar,
  marquee,
  navbar,
  shoot,
  shot,
  shots,
  stamp,
  wall,
  standing,
  starburst,
  statusbar,
  tile,
  unitRow,
  win,
} from './render.js';
import * as chrome from '../content/chrome.js';
import economy from '../content/economy.js';
import { PUBLIC_DIR } from './config.js';
import { escape } from './http.js';

/** `<!--@name key="value" bare-key-->` */
const MARKER = /<!--@([\w-]+)((?:\s+[\w-]+(?:="[^"]*")?)*)\s*-->/g;
const ATTR = /([\w-]+)(?:="([^"]*)")?/g;

const num = (value, fallback = 0) => (value === undefined ? fallback : Number(value));

/**
 * A marker's flat bag of strings onto `field()`. Its own function rather than an inline adapter
 * because §15 needs to put a field *inside* a unit row, and a second copy of this mapping is the
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

  // `asset` is what tells the two states apart, and both are worth showing. Without a file the
  // frame holds the placeholder, which is the boot-warning state a game renders while its
  // photograph is unshot; with one it holds the picture, which is what every game actually looks
  // like on the night. §7 demoed only the first, so `.hero__img` -- the normal state -- was one of
  // the classes #59's count had nowhere to point at (#66). `assetExists` is deliberately NOT a
  // marker attribute: the file is committed, so the kit lying about its presence would demo a
  // state the page can reach only by being broken.
  hero: (a) =>
    hero({
      text: a.text ?? '',
      kicker: a.kicker ?? '',
      flavour: a.flavour ?? (a.asset ? 'asset' : 'text'),
      asset: a.asset ?? '',
      alt: a.alt ?? '',
    }),

  blurb: (a) => blurb(a.text ?? ''),

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

  // The two-answer shape. It gets its own marker rather than a flag on `hintmodal` because they
  // are two boxes on the page at once -- the point is seeing `No?` drawn beside a real `Okay?`,
  // and one `#hint-modal` cannot be both. Its words come from `modalActions()`, not from here.
  askmodal: (a) =>
    askModal({
      title: a.title ?? 'sure?',
      body: a.body ?? 'nothing is being deleted. this is the shape, not a question.',
      denyHref: a.deny ?? '#modal',
      confirmHref: a.href ?? '#modal',
    }),

  // The bored box and its button, both REAL and both wired by `app.js` rather than by `kit.js` --
  // this is the one demo on the page that actually works the way the dashboard works, because
  // nothing about it needs a team or a database. Press it here and it resamples here.
  //
  // Which makes it the only place the `hidden`-until-JS trick can be seen at all: the button
  // arrives hidden and app.js reveals it, so a kit loaded with scripts blocked shows an empty slot
  // exactly as a dashboard would. Its words come from `content/chrome.js`, so this takes no
  // arguments -- a kit that could pass its own list would be demoing a list the site never ships.
  boredbutton: () => boredButton(),
  boredmodal: () => boredModal(),

  /**
   * A screen of the onboarding wizard (#97), drawn in **both** the shapes it ships in.
   *
   * `back` and `extra` are what vary between the eight or nine screens a team walks -- screen one
   * has neither, the captain screen has both, the rules screens have back and no extra. Demoing
   * only the loaded shape is exactly the failure #66 caught, where `/kit` drew every `.btn` on a
   * `<button>` and `<a class="btn">` shipped as a raw blue link site-wide. So the marker takes the
   * two optional slots and the section below passes them on one demo and omits them on the other.
   *
   * The field inside it is a real `field()` call rather than typed markup here, for the reason this
   * whole file exists: a component's markup lives in one place.
   */
  door: (a) =>
    doorStep({
      step: num(a.step, 2),
      of: num(a.of, 9),
      title: a.title ?? "You're the captain now.",
      intro: a.intro ?? 'Anyone with you?',
      action: '#door',
      method: 'get',
      back: a.back ?? '',
      forward: a.forward ?? 'carry on',
      body: a.field ? fieldFrom({ label: a.field, name: 'k-door' }) : '',
      extra: a.extra
        ? `<button class="btn btn--close" type="button">${escape(a.extra)}</button>`
        : '',
    }),

  /** The one banner a team meets once, on the board, straight out of the door (#97). */
  opened: (a) => openedBox({ tiles: num(a.tiles, 2) }),

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

  // The wall at `/shots` (#80). Same pipe-separated cells as the strip above, and the same
  // reading of them -- but every cell here taps through to a PAGE rather than at bytes, which is
  // the one thing that makes it a different call: `shot()`'s download tile must not carry
  // `download` when its href is a document. The kit has no viewer to link at, so the cells point
  // at the sample the way the strip's do.
  wall: (a) =>
    wall(
      (a.cells ?? '')
        .split('|')
        .filter(Boolean)
        .map((cell, index) =>
          cell.startsWith('/')
            ? { id: index + 1, href: SAMPLE_SHOT, src: cell }
            : { id: index + 1, href: SAMPLE_SHOT, src: '', label: cell },
        ),
      { filters: '' },
    ),

  // The row every unit game puts on its tile. Its `body` is markup the page renders, and a marker
  // attribute is one flat string, so the kit cannot pass one -- it NAMES the primitives to compose
  // instead, and this adapter builds the body out of the same functions a game page calls. Which
  // is the point: §15 demos the row holding real parts, not a drawing of one.
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

  // Sign Here's 3x3. The one component on this page the kit can show COMPLETELY -- every other
  // stage here is missing the `<form>` its real tile wraps around it, but the card takes no form
  // at all, so an empty one, a part-signed one and a lit line are the whole component and not a
  // drawing of it. Which is why #60 turned out to be an extraction rather than a seam question.
  //
  // Squares are pipe separated the way `shots` and `win` flatten their lists, and a square may be
  // `trait=SIGNATURE` where somebody has signed it -- the same `value=label` split `field` uses.
  // `line` is a comma-separated list of indices, and it is separate BECAUSE it is separate in the
  // real component: signed derives itself from the signature, a completed line never can.
  card: (a) => {
    const lit = new Set(
      (a.line ?? '')
        .split(',')
        .filter(Boolean)
        .map(Number),
    );

    return card(
      (a.squares ?? '')
        .split('|')
        .filter(Boolean)
        .map((one, index) => {
          const split = one.indexOf('=');
          return {
            trait: split === -1 ? one : one.slice(0, split),
            signature: split === -1 ? '' : one.slice(split + 1),
            line: lit.has(index),
          };
        }),
      num(a.cols, 3),
    );
  },

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

  // The five #58 built into pages, and the only adapters here that take NO arguments from the
  // marker. Everything above is a component a page hands its own words to, so the kit has to
  // invent some to demo it. These four are chrome and one is a band lookup: their words are fixed
  // site-wide in `content/`, there is exactly one correct value, and a marker attribute could only
  // ever disagree with it. Passing nothing is what makes them impossible to show wrong.
  marquee: () => marquee(),

  // Deliberately resampled per request, exactly as a page gets it -- so reloading /kit is the way
  // to see the other ten lines.
  statusbar: () => statusbar(),

  // The one chrome strip that is NOT fixed site-wide: its links depend on who is asking and how
  // far the night has got. The marker types those two booleans by hand, and the LIST still comes
  // from `menuFor()` in `content/chrome.js` -- the same call `navFor()` makes in `src/app.js` --
  // so this page cannot demo a menu the site has never rendered. That is the whole point of the
  // detour through `content/`: a hand-typed list here would have been the fifth thing #55 deleted.
  //
  // `here` names a LABEL rather than an href, because the label is what a reader of this page
  // sees; naming the route would mean checking the section against the route table to know which
  // word is meant to be lit.
  // `build="dev"` draws the yellow one (#96). The kit is the only place both colourways are on
  // screen together, and it has to be: a dev build is the one a walker looks at, so the black bar
  // is now the shape nobody develops against. Demoing only the working shape is exactly how a
  // `<a class="btn">` shipped as a raw blue link site-wide.
  navbar: (a) =>
    navbar(
      chrome
        .menuFor({
          admin: a.who === 'host',
          ended: a.ended === 'up',
          dev: a.build === 'dev',
        })
        .map((item) => ({ ...item, here: item.label === a.here })),
      { dev: a.build === 'dev' },
    ),

  starburst: () => starburst(chrome.starburst),
  stamp: () => stamp(chrome.stamp),

  // The marker names a BAND, never a sentence. The kit used to hand-copy all four lines out of
  // `content/economy.js` and they drifted twice -- once when the mission's placeholder copy was
  // left behind after economy.js moved (#37), and once more before that. Reading them here means
  // the kit cannot show band copy the site does not have. An unknown band falls back to `fresh`'s
  // line rather than rendering an empty paragraph, which would look like a styling bug.
  standing: (a) => {
    const band = a.band ?? 'fresh';
    return standing({ band, text: economy.standingsBands[band] ?? economy.standingsBands.fresh });
  },

  // The one component here whose DATA has to be invented, and the marker names only which row is
  // yours. Everything else on this page either takes its words from the marker or reads them out
  // of `content/`; a board has neither, because teams and scores exist only in the database and
  // this file never opens one.
  //
  // The scores are chosen to demo the two things the row treatments have to survive: a TIE at the
  // top -- so the shared place, the skipped 3rd, and two rows wearing `--first` at once are all on
  // screen -- and a `you` row that is neither first nor last, which is where about ten of twelve
  // teams will actually find themselves. The longest name is the longest one `content/team-names.js`
  // can deal, so the wrap this component claims to handle is demonstrated rather than asserted.
  league: (a) =>
    league(
      [
        { id: 1, name: 'DE VLIEGENDE PANNENKOEK', score: 71 },
        { id: 2, name: 'BADGER', score: 71 },
        { id: 3, name: 'OTTERSPOOR', score: 58 },
        { id: 4, name: 'MOSSEL', score: 44 },
        { id: 5, name: 'NAAMLOOS', score: 44 },
        { id: 6, name: 'KRIEK', score: 12 },
        { id: 7, name: 'STOEP', score: -3 },
      ],
      { youId: num(a.you, 4) },
    ),
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
  blurb: 'the blurb',
  field: 'the fields',
  hintmodal: 'the modal',
  askmodal: 'the modal',
  bubble: 'the speech bubble',
  shoot: 'the camera',
  unitrow: 'the unit rows',
  card: 'the signature card',
  shot: 'the shots',
  shots: 'the shots',
  win: 'the window frame',
  door: 'the door wizard',
  opened: 'the door wizard',
  marquee: 'the marquee',
  statusbar: 'the status bar',
  navbar: 'the menu bar',
  league: 'the league board',
  starburst: 'the starburst',
  stamp: 'the stamp',
  standing: 'the standing colours',
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

  // The WHOLE sentence, both halves, rather than a subject the page supplies a predicate for.
  // It used to be the subject only, with "... are written by hand here" typed after the marker in
  // kit.html -- which reads correctly for every list except the empty one, and #58 is the ticket
  // that emptied it: "Nothing — every section on this page is rendered by the app ARE WRITTEN BY
  // HAND HERE". The empty branch had been written and never once rendered. A sentence whose
  // grammar depends on how many items it has cannot be half-owned by a template.
  'owed-list': () =>
    owed.length
      ? `${upperFirst(sentence(owed))} ${owed.length === 1 ? 'is' : 'are'} written by hand here,
        and this page is their only home. <strong>That is the design the site still owes.</strong>
        Building one means moving its markup into <code>render.js</code> and leaving a marker here
        in the same change.`
      : `Nothing. Every section on this page is rendered by the app, so the site owes the kit no
        design at all right now — <strong>the list is empty for the first time since it existed
        (#58).</strong> When new design is drawn here it wears an <code>@owed</code> badge, and
        this sentence starts counting again on its own.`,
});

// ---------------------------------------------------------------------------------------------
// Coverage: the gap `@owed` cannot see (#59).
//
// `@owed` counts hand-written demos -- sections that EXIST and are not yet built. It is blind by
// construction to a class that ships in `app.css` and has no section at all, because a section
// that was never written has no badge to wear. That blindness has now been discovered by accident
// four times running -- #41 (eight photo classes), #51 (the scavenger's row), #60 (the signature
// card) and #59 (these spacing utilities) -- each time by a session doing something else and
// noticing. Four accidents is a pattern, not bad luck.
//
// #32 ruled out a drift CHECK on reasoning that still holds: there is no test suite and no CI, so
// a script nobody runs is worse than none, because it looks like enforcement. That objection is
// about a script. It is not about this. #55 had already found the way out without naming it -- the
// kit COUNTS rather than remembers, and the count is rendered into the page, so nobody has to run
// anything and nobody can forget. This is the same move pointed at the other half of the gap.
//
// So: every class `app.css` declares, against every class this page actually renders. The
// difference is either owed a section or listed below with a reason.

const APP_CSS = join(PUBLIC_DIR, 'css/app.css');

/**
 * Classes `app.css` declares that `/kit` deliberately does not render, and why. Everything not
 * named here and not on the page is reported in the footer as a gap.
 *
 * This is a hand-maintained list, which is the thing #55 spent a whole ticket deleting -- so it is
 * kept honest in BOTH directions rather than trusted. A class that goes missing from `app.css`
 * leaves its exemption behind, and a stale exemption is reported just as loudly as a missing
 * section. The list can therefore be wrong only for as long as it takes somebody to open the page.
 *
 * Keep it small. An exemption is a claim that a class cannot be shown, not that showing it is
 * inconvenient.
 */
const OFF_KIT = {
  'anim-page':
    'the page-arrival animation, applied to <code>.app</code> on every team-facing page — the ' +
    'real class here would make the kit itself animate on every load, which is why §13 replays ' +
    'motion inside its own box instead',

  'anim-unlock': 'the same reason as <code>.anim-page</code>, and §13 replays it on a real tile',

  'banner--bad':
    'this page’s own error state, for a marker naming a primitive that does not exist — a ' +
    'permanent example of it would be a page that always looks broken',

  'hero--video':
    'the rickroll’s 16:9 embed (#28) — demoing it means this page fetching YouTube on every ' +
    'load, and everything else here is self-hosted on purpose: five woff2 fonts, one committed ' +
    '7KB drawing, nothing that can fail to arrive on the night. §7 names the flavour in words ' +
    'instead of opening a socket to show it',

  'hero__video': 'the same reason as <code>.hero--video</code>, and §7 names it',

  foot:
    'the fixed frame the menu bar sits in — <code>position: fixed</code> at the bottom of the ' +
    'viewport, so the real class here would pin a bar over this documentation for its whole ' +
    'length. Same reason as <code>.anim-page</code>, and §17 draws the bar itself flat',

  'shell--nav':
    'the bottom clearance a page owes the fixed foot — 8rem of dead space at the end of this one, ' +
    'demonstrating nothing without <code>.foot</code> above it to be clear of. §17 says what it ' +
    'pays for',
};

/**
 * The one part of this site the kit's contract does not cover, and why (#66).
 *
 * Kept apart from `OFF_KIT` on purpose, because it is a different claim. An entry above says a
 * class CANNOT be drawn here — the page would animate on every load, or look permanently broken,
 * or reach off the network. An entry here says it SHOULD not be, which is an argument rather than
 * a fact. Merging them would cost the rule that keeps `OFF_KIT` short: a list that holds both
 * facts and arguments becomes somewhere to put things.
 *
 * Staleness is checked the same way in both, so a class deleted from `app.css` is reported here
 * too rather than quietly keeping its own name alive.
 */
const OFF_REMIT = {
  reason:
    'the host’s judging table and photo gallery. This page is the contract for the pages GUESTS ' +
    'see, and an admin surface is not one of them: it is a working tool one person uses on one ' +
    'night, opted out of the party’s <em>animation</em> by <code>layout({ still: true })</code> ' +
    '— though not out of its frame, since #113 put the small print back under the menu on every ' +
    'page — and ' +
    'nothing will ever be assembled out of its parts — which is the drift this page exists to ' +
    'catch. The cost is named rather than denied: these have no visual contract at all, so a ' +
    'break is caught only by the host looking at it, which is how the judging boxes rendered as ' +
    'padding-less three-column grids from #21 until #60 noticed',

  classes: [
    'board',
    'gallery',
    'judge',
    'submission',
    'submission--correct',
    'submission--incorrect',
    'submission--pending',
    'submission__body',
    'submission__who',
    'hq-row',
    'hq-heading',
    'hq-galleries',
  ],
};

const CSS_COMMENT = /\/\*[\s\S]*?\*\//g;
const CSS_URL = /url\([^)]*\)/g;
const CSS_CLASS = /\.([a-zA-Z][\w-]*)/g;
const CLASS_ATTR = /class="([^"]*)"/g;

/**
 * Every class selector in `app.css`. Comments go first because they are full of prose class names
 * -- this file's own rules are documented in them -- and `url(...)` goes with them, or the five
 * `@font-face` sources contribute a class called `woff2`.
 *
 * Read per request, like `kit.html` itself, so an edit to the stylesheet shows up on reload.
 */
function declaredClasses() {
  const css = readFileSync(APP_CSS, 'utf8').replace(CSS_COMMENT, '').replace(CSS_URL, '');
  return new Set([...css.matchAll(CSS_CLASS)].map(([, name]) => name));
}

/** Every class this page renders -- after injection, so a component's own classes count. */
function renderedClasses(html) {
  const shown = new Set();
  for (const [, list] of html.matchAll(CLASS_ATTR)) {
    for (const name of list.trim().split(/\s+/)) if (name) shown.add(name);
  }
  return shown;
}

const code = (names) => names.map((name) => `<code>.${escape(name)}</code>`).join(', ');

/**
 * The footer's third generated sentence. Takes the INJECTED html, because most of what the kit
 * shows arrives from `render.js` and is not in `kit.html` at all -- counting the source would
 * report every component on the site as missing.
 */
function coverageSentence(html) {
  const declared = declaredClasses();
  const shown = renderedClasses(html);

  const excused = new Set([...Object.keys(OFF_KIT), ...OFF_REMIT.classes]);

  const missing = [...declared].filter((name) => !shown.has(name) && !excused.has(name)).sort();
  const stale = [...excused].filter((name) => !declared.has(name)).sort();

  // The three numbers partition `declared` exactly, which is the point of printing them together:
  // drawn + excused + missing can only ever add up to the first figure in the sentence, so a
  // reader can check the claim rather than take it. `excused` counts only classes that are also
  // absent, so an exemption somebody stopped needing is counted as drawn and its own line goes
  // stale, rather than being double-counted into a total that no longer adds up.
  const drawn = [...declared].filter((name) => shown.has(name)).length;
  const excusedHere = [...declared].filter((name) => !shown.has(name) && excused.has(name)).length;

  const exemptions = Object.entries(OFF_KIT)
    .filter(([name]) => declared.has(name))
    .map(([name, why]) => `<code>.${escape(name)}</code> — ${why}`)
    .join('; ');

  // Named as a group rather than one entry each. The reason is identical for all nine and it is a
  // paragraph long, so nine copies of it would be the noise that makes a footer ignorable -- the
  // same failure #32 warned about, which is what this whole sentence is here to avoid.
  const remitLine = OFF_REMIT.classes.some((name) => declared.has(name))
    ? ` Outside this page's remit: ${code(OFF_REMIT.classes.filter((name) => declared.has(name)))}
        — ${OFF_REMIT.reason}.`
    : '';

  const staleLine = stale.length
    ? ` <strong>${code(stale)} ${stale.length === 1 ? 'is' : 'are'} excused below and no longer
        exist${stale.length === 1 ? 's' : ''} in <code>app.css</code></strong> — delete the
        exemption, it is now the only thing keeping the name alive.`
    : '';

  const headline = missing.length
    ? `<code>app.css</code> declares ${declared.size} classes. This page draws ${drawn}, excuses
       ${excusedHere} below, and has nowhere to put <strong>${missing.length}</strong>:
       ${code(missing)}. Not broken — undocumented. Each one ships, some page wears it, and there
       is nowhere here to look it up.`
    : `<code>app.css</code> declares ${declared.size} classes. This page draws
       <strong>${drawn}</strong> and excuses the other ${excusedHere} below, with a reason each —
       <strong>nothing is undocumented by accident.</strong>`;

  return `${headline}${staleLine} Counted on every load by comparing the stylesheet against this
    page's own rendered markup, because the <code>STILL OWED</code> badges above cannot see this:
    they count sections that exist and are unbuilt, and a class with no section has no badge to
    wear (#59). Deliberately not shown: ${exemptions}.${remitLine}`;
}

/**
 * Swap every marker for the real component. An unknown name renders a loud banner rather than
 * nothing: a marker that silently disappears would look exactly like a section somebody deleted,
 * which is the failure this whole mechanism exists to prevent.
 *
 * Three passes. The first collects the `@owed` names so the footer can report them; the second
 * injects. One pass would work only while the footer stays last in the file, and a rule that holds
 * because of line ordering is the kind that breaks the day someone moves a section.
 *
 * The third is `@coverage`, which has to run last for the same reason in reverse: it counts the
 * classes on the finished page, and almost none of them are in `kit.html` -- they arrive from
 * `render.js` during pass two. Counting any earlier would report the whole design system missing.
 */
export function inject(source) {
  const owed = [];
  for (const [, name, rawAttrs] of source.matchAll(MARKER)) {
    if (name.toLowerCase() !== 'owed') continue;
    const label = parseAttrs(rawAttrs).name;
    if (typeof label === 'string') owed.push(escape(label));
  }

  const chrome = pageChrome(owed);

  const injected = source.replace(MARKER, (whole, name, rawAttrs) => {
    const key = name.toLowerCase();
    // Left standing for the third pass. It is a known name, so it must be skipped here by name
    // rather than by falling through to the unknown-primitive banner.
    if (key === 'coverage') return whole;

    const render = chrome[key] ?? RENDERERS[key];
    if (!render) {
      return `<p class="banner banner--bad">style kit: no primitive named <code>${name}</code>.
        Known: ${[...injectable, ...Object.keys(chrome), 'coverage'].join(', ')}.</p>`;
    }
    return render(parseAttrs(rawAttrs));
  });

  return injected.replace(MARKER, () => coverageSentence(injected));
}
