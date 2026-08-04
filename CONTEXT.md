# Context

The domain model for the `bday.moeriki.com` QR party game. This is the vocabulary — use these
words in code, issues, and conversation. Where a term has an obvious synonym we deliberately
avoid, it says so.

Decisions with a real alternative live in [`docs/adr/`](docs/adr/). This file is the glossary and
the shape; the ADRs are the *why*.

## The one-line version

Guests scan QR codes hidden around the house. Each scan unlocks a **game**, advances a **hunt**,
or shows a gag **page**. Games are content on disk; the database holds only what players did.

## The seam

**Game content is code. The database is player data.** Nothing else.

`content/` holds every game, code mapping, onboarding question and gag page, in version control.
The database holds teams, scans, unlocks, submissions, hint reveals and awards — and refers to
content by bare string id (`game_id TEXT`), with **no foreign key**. The database does not know
what games exist. See [ADR-0001](docs/adr/0001-game-content-lives-on-disk.md).

## Glossary

### Team

The unit of play and of scoring. 20–30 guests in teams of **2**, so ~10–15 teams.

**The cookie is the team.** One phone per team carries `team=<token>`; there are no accounts,
passwords or join codes — and no way back out either. There is no sign-out, no rejoin and no
recovery, because there is nothing to sign out of: one phone, carried by whichever member
volunteers, and a charger in the hall.

A team has **members** — named explicitly during onboarding, because member-scoped questions need
subjects to be asked about. Two name fields, the second optional: a solo arrival is a legal team
of one, and a trio enters two.

**The name is dealt, not typed.** Onboarding hands out a word from `content/team-names.js` — TEAM
BADGER — with a reroll. That word is the team's display name *and* the **handle** a stranger types
into a Human Bingo square to name the team that matches, which is the whole reason it is dealt:
uniqueness is free, there is no duplicate-name error at the door, and it survives being shouted
across a loud kitchen. The pool's rules are enforced at boot, because they only bite hours later
in someone else's game — see `src/matching.js`.

> Not "player", not "user". A single human is a **member**; the thing that scores is a **team**.
> Not "team code" — a **code** is the physical QR thing. A team's word is its **handle**.

### Code

A QR code hidden in the house, identified by an opaque random **slug** (`/q/k7f2qx`). Codes are
content (`content/codes.js`), mapping slug → target. A slug either belongs to a game:

```js
k7f2qx: { game: 'yarn' },            // unlock this game and open it
m3p8zz: { game: 'lights', step: 1 }, // a hunt step
```

…or is a pure gag with no game and no points:

```js
b4xk7m: { page: 'rickroll' },
```

Slugs are opaque but **not secret** — teams shouting hiding places at each other is the goal.
Nothing here distrusts a scan, and the other half of that is that the site is only reachable from
inside the house: see [ADR-0012](docs/adr/0012-the-house-network-is-the-boundary.md).

The roster fixes **19 codes**. Each entry also carries three fields for humans: a `label` (host
key only — never printed on the card, or a gag announces itself), a `where` (its hiding place, or
`null` while the hiding plan is open), and `pending: true` while the content it points at has not
been authored. A pending code **warns at boot** and shows a placeholder when scanned; an
*unflagged* dangling target is still a boot error. Printing is gated on the flag being gone.

`node scripts/qr-sheet.js` reads this file and emits one self-contained A4 sheet — six cards per
page at error-correction level H, plus a host key sheet that is not for cutting. Slugs are minted
once and frozen, so `--only=<slug>` reprints a single lost card. See
[ADR-0010](docs/adr/0010-codes-are-printed-from-the-inventory.md).

A slug the inventory does not contain is a dead end: `/q/<unknown>` renders the `no-such-code`
page with a 404 and offers no near-miss guess.

> Not "QR", not "tag". The physical thing is a **code**; its identifier is a **slug**.

### Scan

The event of a code being visited by a team — every visit to `/q/:slug`, recorded whether or not
it did anything. A scan is an **event**; an unlock is **state**. Scans carry `accepted` (`0` when
the scan was out of order or after game end), which is what makes hunt progress derivable.

### Game

A unit of play, defined entirely in `content/games/<id>.js`. Four **kinds**:

| kind | the game page shows | scored by |
| --- | --- | --- |
| `answer` | hero + form, **one** submission, editable until game end | `check()` on submit, or `resolve()` at game end |
| `tally` | hero + form, **many** submissions (one point per photo) | per submission |
| `hunt` | the current step's hero and hints, **no form** | auto-awarded **per step**, as each is reached |
| `trophy` | the hero and nothing else — **no form** | the host awards it by hand at `/admin/game/:id` |

`hunt` and `trophy` are the **formless** kinds: they can never hold a submission, and the code
asks `takesForm(game)` rather than naming them, so a fifth formless kind cannot inherit a form by
accident. A trophy is a physical object in the house — Mr Bean's Teddy in his timer lockbox — and
must declare `points`, since the admin button has to print a number and nothing later in the
night can work one out. It declares no judging: there is nothing to judge.

### Tile

A game as it appears on the dashboard grid. Five designs: locked, unlocked, answered-correctly,
answered-incorrectly, and **unknown** (submitted, but not judgeable until game end). A tile shows
the game title, a corner badge for its state, and a line about points — which is a *number* only
once there is one to report: a locked tile says `go find it` and an unlocked, unplayed one says
`not played`, because zero is what you scored, not what an unmet tile is worth.

Built by `tile()` in `src/render.js`, which is the only markup for one (see **Component**).

A `trophy` tile has no submissions to read, so the **ledger** is what turns it green: awarded
means correct. A team that was never handed it stays *unlocked* at zero — never *wrong*, since
they were never asked a question they could get wrong.

> A tile is a *view* of a game, never a separate entity.

### Moment

The one thing that **just happened**, carried across a redirect so the arriving page can react.
Every state change here is a POST-and-redirect or a scan redirect, so the only channel is a query
param on the destination: `?just=<moment>`, with a closed vocabulary in `src/moments.js` —
`unlock`, `step`, `correct`, `incorrect`, `banked`, `pending`, `shot`, `rescan`.

A moment is always delivered to **the page that caused it**. Scanning opens the game and the hero
plays the unlock; submitting keeps the team on the game page and answers them there. Nobody is
routed to the dashboard to be told something. See
[ADR-0009](docs/adr/0009-the-page-you-are-on-is-the-stage.md).

The param is **spent on arrival** — `public/js/app.js` strips it after first paint, so refreshing
does not replay the animation. The animation is never load-bearing: `prefers-reduced-motion`
flattens all of it, and everything a moment says is also said in text.

`rescan` is the odd one: it carries an **instruction** rather than a verdict, and it exists
because one scan on this site is not live. See *Deferred scan* below.

> Not "flash", not "toast". There is no notification layer — a moment decorates the page that was
> already being rendered.

### Deferred scan

The first scan of the night cannot be applied when it happens: the team it would belong to does
not exist yet. `/q/:slug` holds the slug in a cookie, sends the guest through onboarding, and
applies it on the way out — so the code they scanned costs them nothing.

**A deferred scan keeps its state and drops its physical effect.** The scan row, the unlock and
the hunt position are all written exactly as a live scan would write them; the step's **webhook
does not fire**. A lamp flashing in an empty hallway while the team fills in a form spends the
clue it was supposed to be, and Home Assistant returns `200 OK` for everything, so nothing can
detect it. Instead the game page carries `rescan` and asks them to scan it again for real —
which is the retry loop the hunt was already built on.

Derived, never declared: the discriminator is whether the step has a `webhook` at all, so the
riddle hunt needs no prompt and gets none. See
[ADR-0011](docs/adr/0011-the-first-scan-is-not-live.md).

### Unlock

State: this team may open this game. Created by scanning a code that names the game; permanent
once granted. One tile is unlocked during onboarding by whichever code they arrived through.

**Starters** are unlocked on top of that, for every team, at the moment the team is created. A
game declares `starter: true` itself rather than onboarding holding a list, so the roster's two
(Human Bingo, Longest yarn) start working the moment their own tickets land. The rule for being
one: *a tile starts open only if learning about it late is unrecoverable.* A hunt may not be a
starter — it has no step until it is scanned — and boot refuses one that tries.

### Hunt and step

A **hunt** is one game with an ordered list of **steps**. Each step has its own hero text
(deliberately vague — *"Nothing happens?"*), its own **points**, its own hints, and optionally a
**webhook** to fire. Each step is bound to one code slug.

Steps are **1-based** in content and in the database.

**Points live on the step, never on the hunt**, and bank as each step is reached — `2 + 3 + 5`
across three steps, back-loaded so finishing pays. A hunt that declares a game-level `points` is
a boot error. Partial credit is what makes buying a hint on a hunt rational rather than a
gamble: these are the two tiles where a team can pay and still fail.

A team's position is **derived**: the longest *contiguous* run of steps whose slugs they have an
accepted scan for. There is no progress column. Progression is strictly sequential — stumbling on
step 4's code while at step 1 does nothing but record a flagged scan and show the "you're not
supposed to be here" page. See [ADR-0006](docs/adr/0006-hunt-progress-is-derived-from-scans.md).

`/g/:id` always means *the current step*. `?step=n` browses steps already reached, clamped.

**Webhooks re-fire on every scan** — but only from `/q/:slug`, never from step navigation. Making
the lights blink again means physically walking back to the code. That retry loop is the game.

### Submission

What a team did in a game: `body` (typed answer), `photo_path`, or both. `answer` games hold at
most **one** row per team per game and upsert it; `tally` games insert a new row per POST; hunts
and trophies have none, and a POST to their `/submit` is bounced rather than stored. Enforced in
the app, not the schema — the kind lives in content.

A submission carries a **verdict** (`pending` | `correct` | `incorrect`) and **never points**.
A submission is *what the team did*; an award is *what it was worth*.

A game whose form carries a file input declares `photo: true`. Photo games return the team to the
game page after submitting rather than to the dashboard, so sending another is one tap.

### Photo

Stored **exactly as the camera produced it** — no conversion, no resizing. `photo_mime` is
sniffed from magic bytes, never the filename; `photo_thumb` is the JPEG the camera embedded in
EXIF, and is **null** whenever there wasn't one. A format the browser may refuse (HEIC on
anything but Safari) gets a download tile rather than a broken `<img>`. See
[ADR-0008](docs/adr/0008-photos-are-stored-as-they-arrive.md).

Filenames are self-describing — `0007-yarn-20260814T2134-a3f9.jpg` is team, game, when, random —
so `data/uploads` is already a labelled archive and needs no export feature. The random tail is
what keeps the URL unguessable: `/uploads/*` has no cookie gate.

> Not "image", not "upload". The thing a team sends is a **photo**; it hangs off a submission.

### Award

One row per point movement: `(team_id, game_id, kind, points, reason, source_id)`. `kind` is one
of `answer`, `tally`, `hunt`, `hint`, `manual`, `trophy`; hint rows are **negative**. Score is a
single `SUM(points)`; a tile's score is the same sum filtered by `game_id`.

`kind` is the only record of *why* points moved, which is why a trophy has its own rather than
riding in as a `manual` award against a game. A trophy row carries **no `source_id`**, so its
upsert key is `(team, game, 'trophy', 0)`: a team holds a given trophy exactly once, however many
times the button is pressed. Freehand `manual` awards do the opposite — they stamp a timestamp
into `source_id` so two consolation points are two rows.

Unique on `(team, game, kind, source_id)`, so re-running scoring **upserts** rather than
duplicates — which is what makes `/admin/rescore` safe. See
[ADR-0002](docs/adr/0002-points-are-a-ledger.md).

> Not "score" — a **score** is the sum of awards, not a stored thing.

### The economy

The numbers live in `content/economy.js`. The scale is deliberately fine-grained — **the atom is
1 point, every tile is worth 10, a perfect score is exactly 100** — because that is what makes a
3-point hint land: three bingo squares, 30% of a tile in the moment, 3% of the night by 01:00.

**Every tile is flat 10**, and a game spends that budget however its own shape wants: per square,
per photo, per step, plus a completion bonus where the units don't divide evenly (Human Bingo's
nine squares, the photo scavenger's six prompts). `economy.tilePoints` is the contract the
per-game tickets author against; only hunts can have it checked at boot, since answer and tally
games spend theirs inside `check()` and `resolve()`.

**Finding a code pays nothing.** Points mean *you played the game*, never *you walked past it* —
so a team that scans everything and submits nothing scores 0. Hunts are the deliberate exception,
because there the walking **is** the mechanic.

**Scores may go negative.** Hints are the only debit, and nothing clamps: `score = SUM(awards)`
stays literally true, with no special case in the tile, the header or the showdown.
See [ADR-0011](docs/adr/0011-the-tile-is-the-unit-of-value.md).

### Standing

The vague message in the dashboard header, and the **only** comparative signal a team ever gets —
no rank, no other team's score, no distance to the podium. Three **bands**, and only the first is
a rank:

| band | who is in it |
| --- | --- |
| `podium` | score at or above the **third-place** score |
| `chasing` | within `podiumGap` (30) of it — three tiles, catchable |
| `rest` | further back than that |

Band 2 is **proximity, not a slice of the field**: if third has 60, a team on 59 is close whether
they are fourth or eleventh. Ties take the better band, and before anyone has scored the whole
party is `chasing` — there is no podium made of zeroes.

> Not "rank", not "leaderboard". A team has a **standing**, which is one of three sentences. The
> true board exists only at `/admin`, and the numbers only ever come out at the showdown.

### Hint reveal

A record that a team has seen hint *n* of a game (or of a hunt step; `step` is `0` for non-hunt
games). Sequential: the next index is simply `COUNT(*)` for that `(team, game, step)`.

Revealing writes the reveal row **and** its negative award in one transaction.

The **first reveal per team, across all games, is free** — the modal announces the price as a
gift rather than a fine. Every reveal after it costs. The rules page unlocks its hidden line
("hints cost you N points") once the team has any reveal at all.

The modal is a **notification, not a confirmation**: the reveal is written, charged and rendered
in the hint list before the modal exists, and nothing about it waits for a tap. It rides
`?hint=free|paid` — the one sibling of `?just=`, spent on arrival the same way — and the server
renders it *already open*, so a phone with JavaScript blocked still gets the announcement and
still dismisses it, because both its buttons are ordinary links.

### Judging

Four modes. Two are *derived* from the presence of a function; two are *declared* as
`judging: 'manual' | 'trust'`. Declaring both a mode and a function is a boot-time error.

- **`check(value)`** — judged immediately on submit. The tile goes green at once.
- **`resolve(submissions)`** — a pure function over *every team's* submissions, run at game end.
  This is what "closest to the average height" and "who shares your favourite colour" need, and
  why the Unknown tile design exists.
- **`trust`** — points land on submit, unjudged. One point per photo, no host involved. A trust
  game must declare `points`, and the gallery deliberately gives it **no buttons**: the points
  are already banked and a second press would double-pay.
- **`manual`** — the host judges in the admin gallery: award or reject, per submission.

**The default is `manual`**, deliberately: a game that forgot to say gets a human looking at it,
never silent free points.

The gallery reads this mode and never hardcodes a game — so locking the roster requires no change
to the admin surface.

A **`trophy` has no judging mode at all**, and declaring one is a boot error: a mode is how
*submissions* become points, and a trophy has none. Its admin page is the team list, not a
gallery.

### Game end

A real event: `game_ended_at` in the `settings` key/value table, stamped when the host presses
**End game**. In one transaction it stamps the timestamp and runs every game's `resolve()`.

After it, the site is **read-only for teams**: every mutating POST — submit, hint, and any scan
that would unlock or advance — redirects to the wrap page. Scans are still recorded, so you can
see who was still hunting at midnight; they just buy nothing.

**Reversible.** Reopening clears the timestamp; resolvers are idempotent, so re-running is free.

### Profile answer

An onboarding questionnaire answer, keyed by `question_id` from `content/questions.js`. Its
`member_id` is **nullable**: `NULL` means a team-level answer. Questions declare
`scope: 'team' | 'member'`; member-scoped ones are asked once per member.

Every question is here because **a game eats it** — that is the whole admission test. One
member-scoped question (what you wanted to be aged eight) is Guess Who's answer key; five
team-scoped ones are the honest **harvest** that Herd Mentality asks you to predict hours later.
A team that skipped would put a hole in everyone's tile, not just their own, which is why
onboarding is a **gate**: `onboardingComplete()` means the team exists *and* owes no answers, and
every route past the door asks that rather than merely 'has a cookie'.

Answers are stored **verbatim** and normalised only when counted. `src/matching.js` owns that —
lowercase, accents, punctuation, a trailing plural, then roughly one edit of slack per five
characters and **exact below five**, because `cat`/`bat` and `bear`/`beer` are two teams
disagreeing rather than one typing badly.

## Storage

`node:sqlite` — zero dependencies, no native compilation. WAL, foreign keys on. Schema changes
go through numbered files in `db/migrations/` tracked by `PRAGMA user_version`. See
[ADR-0004](docs/adr/0004-sqlite-via-node-sqlite.md).

Everything mutable lives under `$DATA_DIR` (default `./data`):

```
$DATA_DIR/bday.sqlite        the database
$DATA_DIR/bday.sqlite-wal    ┐ WAL sidecars — which is why the deployment must
$DATA_DIR/bday.sqlite-shm    ┘ bind-mount the DIRECTORY, never the .sqlite file
$DATA_DIR/uploads/0007-yarn-20260814T2134-a3f9.jpg        a photo, as the camera made it
$DATA_DIR/uploads/0007-yarn-20260814T2134-a3f9.thumb.jpg  its EXIF thumbnail, where there was one
```

## Route inventory

Team-facing:

| method | route | what | idempotent |
| --- | --- | --- | --- |
| GET | `/q/:slug` | **the front door** — resolve a code, apply its effect, redirect | mutating, see [ADR-0003](docs/adr/0003-qr-entry-mutates-on-get.md) |
| GET | `/` | dashboard: header, score, tile grid | ✓ |
| GET | `/welcome` | onboarding, screen 1: a dealt team name + member names. Reroll re-submits this form as a GET | ✓ |
| POST | `/welcome` | create team + members, set cookie → `/questions` | PRG |
| GET | `/questions` | onboarding, screen 2: the questionnaire, and **the gate** — every team-facing route bounces here until it is answered | ✓ |
| POST | `/questions` | save profile answers; incomplete returns here, complete applies the held code (deferred) or lands on `/` | PRG |
| GET | `/g/:gameId` | game page; `?step=n` for hunts, clamped to reached; `?just=` is the moment, `?hint=` the reveal notice | ✓ |
| POST | `/g/:gameId/submit` | upsert (`answer`) / insert (`tally`); multipart for photos → back to `/g/:gameId` | PRG |
| POST | `/g/:gameId/hint` | reveal next hint, write the negative award | PRG |
| GET | `/rules` | rules; the hidden hint rule appears after the first reveal | ✓ |
| GET | `/p/:pageId` | gag and hidden pages | ✓ |
| GET | `/showdown` | final standings, after game end | ✓ |

Admin, all behind one cookie gate ([ADR-0005](docs/adr/0005-admin-is-a-one-time-secret-url.md)):

| method | route | what |
| --- | --- | --- |
| GET | `/admin/key/:secret` | set the admin cookie, redirect to `/admin` |
| GET | `/admin` | live board: teams, scores, hunt progress, unjudged count |
| GET | `/admin/game/:gameId` | the gallery: every submission for one game, with the actions its judging mode calls for — or, for a `trophy`, the team list with one button each |
| POST | `/admin/judge` | verdict + award on one submission; rejecting writes a zero rather than deleting, so re-judging upserts |
| POST | `/admin/trophy` | hand a trophy over, or take it back (which writes a zero) |
| POST | `/admin/award` | manual points to a team |
| POST | `/admin/end` · `/admin/reopen` | the freeze, and its undo |
| POST | `/admin/rescore` | re-run content scoring over existing player data |
| GET | `/admin/codes` | slug → target inventory with scan counts, for debugging a code someone says is broken |

Static: `/css/*`, `/js/*`, `/fonts/*`, `/img/*` from `public/`; `/uploads/*` from `$DATA_DIR`;
`/kit` is the style kit — served from `public/kit.html`, with the real components injected into it
(see **Component** below).

## Component

A piece of markup the design system ships: a tile, a hero, a form field, the scorebar, the hint
modal. The styles are shared by construction — `public/css/app.css` is linked by every page and by
`/kit`, so appearance cannot drift. The markup is what had to be settled.

> **A component's markup exists in exactly one place** ([ADR-0013](docs/adr/0013-a-component-has-one-markup.md)).

Where the app renders a component, that place is a function in `src/render.js`, and `/kit` calls it
through a marker comment — `@tile state="unlocked" title="Longest Yarn"` — which `src/kit.js` swaps
for the real output. The kit holds no copy, so it cannot show something the site does not do.

Where the app does **not** render it yet — the window frame, the starburst, the speech bubble, the
stamp, the marquee, the status bar, the three `.standing--*` colours — the markup is hand-written in
`kit.html` and that page is its only home. Those sections are the design the site still owes.
Building one into a page means **moving** its markup into `render.js` and leaving a marker behind in
the same change, so a second copy is never created.

`GET /healthz` is the container health check and the pre-party liveness probe — JSON, no cookie
required, `503` if the database is unreachable. It reports nothing about teams or scores, being
the one route reachable by anyone ([#13](https://github.com/moeriki/tinker-lab/issues/13)).
