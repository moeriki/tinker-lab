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
The database holds teams, scans, unlocks, submissions, deals, hint reveals and awards — and refers to
content by bare string id (`game_id TEXT`), with **no foreign key**. The database does not know
what games exist. See [ADR-game-content-lives-on-disk](docs/adr/game-content-lives-on-disk.md).

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
inside the house: see
[ADR-the-house-network-is-the-boundary](docs/adr/the-house-network-is-the-boundary.md).

The roster fixes **19 codes**. Each entry also carries four fields for humans: a `label` (host
key only — never printed on the card, or a gag announces itself), a `where` (its hiding place, or
`null` while the hiding plan is open), a `spot` (the same place in one line, for the caption above
each QR on the cutting sheet), and `pending: true` while the content it points at has not
been authored. A pending code **warns at boot** and shows a placeholder when scanned; an
*unflagged* dangling target is still a boot error. Printing is gated on the flag being gone.

`node scripts/qr-sheet.js` reads this file and emits one self-contained A4 sheet — four cards per
page at error-correction level H, plus a host key sheet that is not for cutting. Slugs are minted
once and frozen, so `--only=<slug>` reprints a single lost card. See
[ADR-codes-are-printed-from-the-inventory](docs/adr/codes-are-printed-from-the-inventory.md).

**Both are grouped by game, not by card number.** The two hunts have their last cards numbered at
the end of the inventory — position in `content/codes.js` is the printed card number and cannot
be reshuffled — so a numbered sheet scattered the lights across #01–#03 and #22, fifteen rows
apart. Grouping prints each trail whole. Above every QR, and **outside its black border**, sits a
caption naming the game and the `spot`: cut on the border and the instruction stays behind on the
sheet, so the card a guest finds still says nothing about what it does.

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
| `answer` | hero + form, **one** submission, editable until game end unless `final` | `check()` on submit, or `resolve()` at game end |
| `tally` | hero + form, **many** submissions (one point per photo) | per **unit**, see below |
| `hunt` | the current step's hero and hints, **no form** | auto-awarded **per step**, as each is reached |
| `trophy` | the hero and nothing else — **no form** | the host awards it by hand at `/admin/game/:id` |

`hunt` and `trophy` are the **formless** kinds: they can never hold a submission, and the code
asks `takesForm(game)` rather than naming them, so a fifth formless kind cannot inherit a form by
accident. A trophy is a physical object in the house — Mr Bean's Teddy in his timer lockbox — and
must declare `points`, since the admin button has to print a number and nothing later in the
night can work one out. It declares no judging: there is nothing to judge.

### Hero, and blurb

The top half of a game page. Three flavours, and the style kit's rule is **words or a picture,
never both**: `hero: { text }` or `hero: { asset, alt }`. Declaring both is a boot error. The third
is a **video** embed, which no game declares — it belongs to the rickroll gag page alone
([#28](https://github.com/moeriki/tinker-lab/issues/28)) and is the one piece of markup on this
site that reaches off the network.

A game that needs a picture *and* a sentence puts the sentence in its **blurb**, which renders
underneath the frame rather than inside it. Teddy is the case that forced it: a photograph, then
the one rule that matters.

Hero text splits on blank lines into paragraphs — nothing in the CSS preserves newlines, so
without that a two-beat hero collapses into one run-on line.

An asset is a path under `public/`, served by the existing `/img/` static route. A file that is
**missing** is a loud boot warning and the style kit's placeholder frame on the page — never a
broken image, and never a refusal to boot. A path that could never resolve is a typo, and stays
fatal.

### Unfinished content

A game may export `unfinished()`, returning the reasons it is not done. Boot warns loudly for
each. It is the same bargain `pending: true` strikes for a code whose game is unwritten: the hole
is loud in the log and honest on the page, and it never stops the site coming up.

Longest yarn uses it for the two numbers that cannot exist before the day — the true length of
the longest yarn, and the tolerance band around it. Until they land, `resolve()` still pays the
floor and the ranking, and simply awards no jackpot.

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

A **`trust`** tile reads the ledger for the opposite reason: its submissions are never judged, so
they sit at `pending` all night and the verdict would paint it *unknown* — "unscoreable until
game end" — when it holds the only points on the board that are already certain. Green means what
it means on a hunt: **finished**, every unit paid. A half-filled tile stays *unlocked* and lets
its points do the talking.

A **grid** tile reads the ledger for a third reason: its rows carry real verdicts, so the generic
rule would paint it *correct* on the very first signature — when green everywhere else means
finished — and *wrong* for a team whose only row so far is a refused one, marking a tile as failed
on a mishearing at 20:40. There is no wrong answer on a card: there is a line, or there is not yet.
So green means a completed line and `wrong` is unreachable by construction.

**Every ledger-reads-it branch is guarded on `unlocked`**, and that is not decoration. Without it
the branch overwrites `locked`, which is exactly what had happened to the two `trust` tiles: both
photo tiles rendered as open links from the first minute of the night, for every team, before
either code had been scanned — and tapping one hit the 404 page, because `showGame` checks the
unlock properly. A tile that looks open, is not, and only says so after a tap. Found and fixed in
#21 while giving the signature card the same treatment.

> A tile is a *view* of a game, never a separate entity.

### Moment

The one thing that **just happened**, carried across a redirect so the arriving page can react.
Every state change here is a POST-and-redirect or a scan redirect, so the only channel is a query
param on the destination: `?just=<moment>`, with a closed vocabulary in `src/moments.js` —
`unlock`, `step`, `correct`, `incorrect`, `banked`, `pending`, `shot`, `spare`, `rescan`, `signed`,
`bingo`.

A moment is always delivered to **the page that caused it**. Scanning opens the game and the hero
plays the unlock; submitting keeps the team on the game page and answers them there. Nobody is
routed to the dashboard to be told something. See
[ADR-the-page-you-are-on-is-the-stage](docs/adr/the-page-you-are-on-is-the-stage.md).

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
[ADR-the-first-scan-is-not-live](docs/adr/the-first-scan-is-not-live.md).

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
supposed to be here" page. See
[ADR-hunt-progress-is-derived-from-scans](docs/adr/hunt-progress-is-derived-from-scans.md).

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
game page after submitting rather than to the dashboard, so sending another is one tap. A game
that needs *both* halves declares `requiresBody: true` — Portrait of a stranger is the only one,
because a photograph with nothing said is not a portrait.

A submission also carries the **unit** it claims (below), or `NULL` where its game has none.

### Final answer

A game may declare **`final: true`**, and then its first submission is its last: the form leaves
the page the moment a row exists, and a POST that arrives anyway is bounced with `spent` rather
than upserted. `answer` games only — a tally game's shape is many submissions and a formless kind
has no form to close.

It exists because **`check()` plus editable is a brute force**. The Triangle Test is the first
game on this site judged on submit, and under the editable default a team taps 1, is told wrong,
taps 2, is told wrong, taps 3, and holds the whole tile without tasting anything: the row upserts
and the award upserts with it, so only the last verdict survives.

A final game **must declare `verdicts.incorrect`**, and boot refuses one that does not. The
site-wide line in `src/moments.js` promises *"you can change your answer right up to the end"* —
true everywhere else, a lie here, and told at the moment it costs most. See
[ADR-an-answer-may-be-final](docs/adr/an-answer-may-be-final.md).

> Not "locked", not "one-shot" in code. A game is **final**; a spent second POST is `spent`.

### Verdicts, and a form that offers a list

`verdicts: { correct, incorrect }` in content overrides the site-wide submission lines for one
game. Everything else falls back to `SUBMITTED` in `src/moments.js`.

`form: { label, options }` renders a `<select>` instead of a text input, through the same
`field()` every other control on the site goes through. Entries are bare strings or
`{ value, label }`; `submissions.body` stores the **value**, so anything reading an answer back to
a human wants the label. A form that offers a list refuses an empty choice — which is what stops a
`final` game spending its one shot on a mis-tap.

### Photo

Stored **exactly as the camera produced it** — no conversion, no resizing. `photo_mime` is
sniffed from magic bytes, never the filename; `photo_thumb` is the JPEG the camera embedded in
EXIF, and is **null** whenever there wasn't one. A format the browser may refuse (HEIC on
anything but Safari) gets a download tile — `.shot--dl` — rather than a broken `<img>`, and gets
it **everywhere a photo is shown**: one `shot()` in `render.js` renders every photo cell on the
site, so there is one answer to what an unrenderable photo looks like. See
[ADR-photos-are-stored-as-they-arrive](docs/adr/photos-are-stored-as-they-arrive.md).

Filenames are self-describing — `0007-yarn-20260814T2134-a3f9.jpg` is team, game, when, random —
so `data/uploads` is already a labelled archive and needs no export feature. The random tail is
what keeps the URL unguessable: `/uploads/*` has no cookie gate.

> Not "image", not "upload". The thing a team sends is a **photo**; it hangs off a submission.

### Unit

What a `tally` game actually pays for: the countable thing a submission claims. Declared in
content as either a **count** of anonymous slots or an **array of labels**:

```js
units: 10                            // ten portraits, one indistinguishable from another
units: ['Someone eating', ...]       // the photo scavenger's ten prompts
```

The unit — not the submission — is what the ledger keys on. `awards` is unique on
`(team, game, kind, source_id)`, so writing the unit into `source_id` makes a second photo of the
same prompt **upsert one row at the same value**. That single substitution *is* the cap: there is
no counting, no ceiling check and no deleting anywhere.

Which means **retakes are free, unlimited, and stored**. Dedup happens in the awards table and
never in the photos, so `submissions` keeps every shot a team ever sent while the score stays
honest. A photo that moved no points is a **spare** — it says so on arrival, and the wording
never suggests stopping, because the photographs are what the pair is for.

Anonymous units take the next ordinal, so past the last slot they simply run off the end.
Boot checks `units × points ≤ tilePoints`, the same arithmetic a hunt gets.

> Not "prompt" in code — a prompt is one **label** of one **unit**. Not "slot".

### Hand

Units that are **not the same for every team**. A game declares one instead of `units`:

```js
hand: { size: 10, fromLadder: 'guess-who' }
```

The scavenger's ten prompts are ten strings on disk, identical for everybody, so nothing about
them is player data. Guess Who's ten cards are drawn out of what *other guests* answered at the
door — so which ten a team holds is a fact about that team, and lives in `deals`.

`src/deals.js` owns dealing and hands the game back plain facts; content never learns the table
exists, and the table never learns what a `ref` means — it is an opaque integer belonging to the
game that dealt it ([ADR-game-content-lives-on-disk](docs/adr/game-content-lives-on-disk.md)
intact). A hand **tops up** on every open until it holds `size`, and a dealt card is never
re-dealt or displaced, so a guess made at 21:00 cannot be taken away by somebody arriving at
23:00. See [ADR-units-may-be-dealt-per-team](docs/adr/units-may-be-dealt-per-team.md).

> Not "deck" — the **pool** is what is available, a **hand** is what one team holds, and a
> **card** is one unit of it. Declaring both `hand` and `units` is a boot error.

### Harvest

Units that are **questions already asked at the door**. A game declares one instead of `units`:

```js
harvest: ['herd-pizza', 'herd-fridge', 'herd-leave', 'herd-animal', 'herd-fire']
```

Unlike a **hand**, a harvest is the same for everybody and is still content — the questions live
in `content/questions.js`. Naming them by id rather than restating their wording is the whole
point: the question a guest is asked at 20:00 and the one they are asked to predict at 23:00 are
the same string and cannot drift apart. The index into the list is the unit.

`src/harvest.js` reads what teams answered and clusters it (`src/matching.js`), handing the game,
per unit, a predicate and a sentence — so content never learns that `profile_answers` exists and
never gets its own opinion on how loosely two words are the same word. Answers from teams that
never passed the onboarding gate are dropped, the same way `deals.js` drops them from a pool.

Boot refuses an id no question declares, a question that is not **team-scoped** (a prediction is
made once per team), the same id twice, and `harvest` alongside `units` or `hand`.

> A **harvest** is the honest answers collected at the door; a **prediction** is what a team
> later guesses most teams said. Herd Mentality is the only game with one.

### Grid, and signature

Units whose **layout is a scoring rule**. Everywhere else the units are an unordered bag — the
scavenger's ten prompts pay a point each and nothing about prompt 3 sitting beside prompt 4 means
anything. Sign Here's nine are a card, and three in a row pays the whole tile:

```js
grid: 3,      // the units are a 3x3 card, read left to right, top to bottom
bingo: 10,    // what a completed line pays, INSTEAD of the squares (never on top of them)
lockMinutes: 30,
```

`src/bingo.js` builds the lines from `grid` rather than listing them, so a 4×4 card gets its ten
without anyone remembering to write them down. Boot refuses a grid whose units do not make a
square, one that can pay over the tile budget, one whose line is worth less than its squares, and
one that also declares a judging mode — a card is scored by its own geometry and a second scorer
would write a second award row against the same tile.

A **signature** is the unit's content: another team's handle, written into a square by a team that
matched its trait. **Nothing verifies the trait** — the handle is the signature and no signature
has ever been audited, which is the no-anti-cheat constraint rather than a gap in it. What *is*
checked is that the handle is real, is not your own, and is not already on your card.

A refused signature is scored differently depending on which of those three it broke, and only one
of them costs anything. A word nobody holds is a **forged signature**: the row is written with an
`incorrect` verdict, and the card is shut for `lockMinutes` afterwards. The other two bounce free.
The lock is **derived** from that row's timestamp the way hunt position is derived from scans —
nothing stores it, so nothing has to clear it, and it expires by arithmetic.

The whole card is rescored on every signature and written as a **single award row** on
`sourceId: 0`, which is the one place the ledger's award-per-unit habit does not apply: a line pays
instead of the squares, so the tile's worth is a function of the grid rather than a sum over its
units, and nine rows plus a bonus could not express "the 3 you had stops counting" without deleting
from a ledger.

> Worth knowing before anyone retunes it: on a 3×3 there are **8 lines**, and two empty squares can
> never break all of them — so any card with 7 or more signatures already contains one. Scores of
> 7, 8 and 9 are impossible; the curve runs 1, 2, 3, 4, 5, 6, then 10.

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
[ADR-points-are-a-ledger](docs/adr/points-are-a-ledger.md).

> Not "score" — a **score** is the sum of awards, not a stored thing.

### The economy

The numbers live in `content/economy.js`. The scale is deliberately fine-grained — **the atom is
1 point, every tile is worth 10, a perfect score is exactly 100** — because that is what makes a
3-point hint land: three bingo squares, 30% of a tile in the moment, 3% of the night by 01:00.

**Every tile is flat 10**, and a game spends that budget however its own shape wants: per square,
per photo, per step, plus a completion bonus where the units don't divide evenly (Human Bingo's
nine squares, Guess Who's ten cards). `economy.tilePoints` is the contract the
per-game tickets author against; only hunts can have it checked at boot, since answer and tally
games spend theirs inside `check()` and `resolve()`.

**Finding a code pays nothing.** Points mean *you played the game*, never *you walked past it* —
so a team that scans everything and submits nothing scores 0. Hunts are the deliberate exception,
because there the walking **is** the mechanic.

**Scores may go negative.** Hints are the only debit, and nothing clamps: `score = SUM(awards)`
stays literally true, with no special case in the tile, the header or the league.
See [ADR-the-tile-is-the-unit-of-value](docs/adr/the-tile-is-the-unit-of-value.md).

### Standing

The vague message in the dashboard header, and the **only** comparative signal a team ever gets —
no rank, no other team's score, no distance to the podium. Four **bands**, and only the second is
a rank:

| band | who is in it |
| --- | --- |
| `fresh` | exactly zero — nothing on the board, whatever the reason |
| `podium` | score at or above the **third-place** score |
| `chasing` | within `podiumGap` (30) of it — three tiles, catchable |
| `rest` | further back than that |

`fresh` is tested first and it takes precedence over the thresholds entirely. Zero is not a
position on the board, so it is not scored like one: at 20:05 it holds the whole party, and at
22:30 it holds the team that has just walked in — who would otherwise fall into `rest` and be
told their effort was appreciated as the first sentence they ever read. It is **not** "welcome",
because a team can play the resolve games hard for two hours and still be on zero until game end.
A **negative** score is not `fresh`: hints are the only debit, so that team has spent something
and belongs in `rest`.

Band 3 is **proximity, not a slice of the field**: if third has 60, a team on 59 is close whether
they are fourth or eleventh. Ties take the better band, and the first team to score anything at
all leads immediately — there is no podium made of zeroes.

> Not "rank", not "leaderboard". A team has a **standing**, which is one of four sentences. The
> true board exists only at `/league`, which the admin cookie reaches at any hour and a guest
> cannot see until the night has ended.

### The league

The board a **standing** is being vague about: every team, best first, with its score. It is the
only surface on this site where one team sees another team's number, and until the night has
**ended** a guest cannot reach it at all.

**Ties share a place** — 1, 2, 2, 4. `standings()` orders equal scores on arrival time, which is
fine for the sequence rows print in and wrong for the numeral beside them, on the same reasoning
the bands already use: nobody drops a place for having walked in later.

**A guest's own row is a different component**, not a marked-up one — thicker edge, harder shadow,
the tile gradient, roughly double the type, and `that's you` written in the aside face. After five
hours of a deliberately vague sentence, a guest opens this to a column of strangers' numbers, and
the first thing they want is not first place. **First place is deliberately quieter** than that
row: the yellow and the shout face, and nothing louder.

**A host gets no expanded row**, enforced by the page rather than inferred from "a host is never a
team" — that rule is about people, and the page is handed a cookie jar. It is also the right
five-hour working board: the pop is a reveal, and a reveal that re-arrives every 30 seconds is a
flicker.

> The page is one page. Hosts and guests read the **same words**; what differs is chrome — a host
> gets the 30s refresh and no arrival animation, a guest gets the animation and no refresh.

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

### Focus

**This site does no focus management** — no trap, no move-in, no restore, nowhere, and that is
settled rather than outstanding ([ADR-document-order-instead-of-focus-management](docs/adr/document-order-instead-of-focus-management.md), #31).

The hint modal is not a conventional dialog: it arrives on a **full page load**, so nothing was
focused to take focus from and the button that triggered it is in a document that no longer exists.
What a trap would have been for is done in HTML instead — `layout()` renders the modal slot **first
in `<body>`**, ahead of `.app`, so the box you see first reads first and tabs first. Before that it
was last, and a hint reveal put six tab stops behind a dim backdrop in front of the thing you were
looking at.

There is a **second modal** since #95 — the **bored box**, behind the dashboard's *I'm bored*
button — and it is the one place that reasoning does not reach, which is said here rather than
left to be discovered. It is opened by **script**, not by a page load, so unlike the hint box there
*is* a triggering element still in the document. Nothing moves focus into it and nothing restores
focus on close, exactly as everywhere else; and because the modal slot is first in `<body>` while
the button that opens it is near the end, **its two answers sit behind the button in tab order**. A
keyboard user who opens it tabs forward into the page rather than into the box.

That is left as it is, and the reason is not that nobody thought of it. The box is decoration —
**both of its answers close it and do nothing else**, so reaching neither costs nothing — `Escape`
and the backdrop close it, and this site is mobile-only by decision, which makes tab order a
question about a device it is not built for. Buying the site's first exception to *no focus
management anywhere* for a joke box would be the worse trade. Nobody has checked it with a screen
reader, and per the map nobody is going to.

It carries **no ARIA role**. `role="alertdialog"` was asserted until #31 and was untrue in every
clause — nothing focuses the box, nothing behind it is inert, nothing waits for it, and a role
sitting in the initial HTML never fires as an alert regardless.

> Writing the trap in `public/js/app.js` would have made the JS-blocked phone the only one that
> does not get it. Document order costs no script and cannot be blocked.

### Judging

Four modes. Two are *derived* from the presence of a function; two are *declared* as
`judging: 'manual' | 'trust'`. Declaring both a mode and a function is a boot-time error.

- **`check(value)`** — judged immediately on submit. The tile goes green at once.
- **`resolve(submissions)`** — a pure function over *every team's* submissions, run at game end.
  This is what "closest to the average height" and "who shares your favourite colour" need, and
  why the Unknown tile design exists.
- **`trust`** — points land on submit, unjudged. One point per **unit**, no host involved. A trust
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

### HQ, and the controls

The two halves of the admin surface, split by [#79](https://github.com/moeriki/tinker-lab/issues/79)
along one line: **a page that refreshes itself may not carry a form.**

**HQ** is `/admin` — a dashboard and nothing else. It carries **no board**: the board lives once, at
`/league`, which the host reaches from the menu bar at any hour. It carries **no form**, which is
what buys it a refresh. And it carries **no "teams who look lost"** — #11 asked for one and #79 cut
it, because a quiet team is not a lost team and an idle timer would flag half the room at midnight.

Its one **loud** number is **codes nobody has found**, and it is the only thing on the page that
sends the host to a room rather than to a thought. A count and not a fraction — `18 / 21` is a
thing you nod at — and not the slugs either, because `k7rbt9` is not a place. `where` is the field
that sends you somewhere and it is on `/admin/codes`, which the row is a door to.

Everything else is a **gauge**: quiet, glanced at, and there to answer *is this working* rather
than *what do I do*. [#94](https://github.com/moeriki/tinker-lab/issues/94) added four, which is
where that word comes from — a gauge is explicitly held to a weaker standard than #79's
send-you-to-a-room test, and the hierarchy on the page is what keeps the two apart.

| gauge | what it says |
| --- | --- |
| **progress** | the average team score, on the headline line. A perfect night is exactly 100 (`content/economy.js`), so the average **is** the percentage — no denominator to argue about, and points already weigh partial progress that a tile count could not. It cannot reach 100 and is not meant to: Teddy's ten go to one team all night, and Longest yarn pays most teams its floor of two |
| **codes found** | the same fact as the loud row from the other end. Kept anyway, deliberately: a to-do and a progress bar read differently at a glance |
| **scans** | every visit, including the eleven teams who all scanned the same kitchen code |
| **the pulse** | scans **and submissions** in the last **30 minutes**. Both, because teams stop scanning once they have found everything and start grinding tiles — a scans-only pulse would report an empty house at 23:00. Thirty minutes because a short window swings to zero every time the room pauses for a conversation, and a gauge that cries wolf is one nobody reads by midnight |

The pulse's window and the page's refresh are **different dials** and it is worth keeping them
straight: the window is thirty minutes and slow on purpose; the refresh is ten seconds.

**The controls** are `/admin/controls`, off the menu bar: freeze/unfreeze, end, hand out points,
recompute, delete a team, reset. Everything with a consequence, on the page you visit twice a night
— which keeps your thumb away from it on the page you glance at ten times an hour.

> **The refresh is new, and the claim was not.** Three comments in this repository said `/admin`
> polls, including the one explaining why the admin board drops the marquee, and no page had ever
> carried a timer or a meta refresh until #79 added a `<meta http-equiv="refresh">`.
>
> **Since #94 that meta refresh is the `<noscript>` fallback.** The two host readouts — `/admin`,
> and `/league` **for a host** — poll `/admin/live` every ten seconds and swap in fragments the
> server rendered, so the numbers move without the page flashing or losing its scroll position.
> This is the site's only data-fetching JavaScript and the only thing outside "animation and the
> hint modal"; it is host-only, and nothing a guest sees updates itself. There is one renderer —
> `liveFragments()` — used by both the page and the endpoint, so the browser holds no opinion about
> how anything looks. See
> [ADR-the-host-readouts-poll-fragments](docs/adr/the-host-readouts-poll-fragments.md).

### The freeze, and the end

**The night ends twice**, and the gap between the two is deliberate — see
[ADR-the-night-ends-twice](docs/adr/the-night-ends-twice.md). Two rows in the `settings` key/value
table, `frozen_at` and `ended_at`, and three states in one order: **running → frozen → ended**.
Only the first arrow goes both ways. Both presses live on `/admin/controls`, which shows whichever
one the state allows and never the other.

**The freeze** stops the players. Stamped when the host presses **freeze the game**; in one
transaction it writes the timestamp and runs every game's `resolve()`, which is what makes the
numbers final — Herd Mentality, Guess Who and the Triangle Test do not have a score until it runs.

After it, the site is **read-only for teams**: every mutating POST — submit, hint, and any scan
that would unlock or advance — is refused and lands the team back on the page it came from. Scans
are still recorded, so you can see who was still hunting at midnight; they just buy nothing. Teams
**keep their own dashboard**, tiles and all, with a banner saying why nothing responds.

**Reversible, and no confirm.** Unfreezing clears the timestamp; resolvers are idempotent, so
freezing, unfreezing and re-freezing land on the same numbers.

**The end** is the publish, and nothing else: it computes nothing and freezes nothing, both of
which already happened. It writes `ended_at` and that is the only thing gating `/league` for a
guest. Behind a **confirm page** — it is irreversible socially rather than technically, so what it
needs is a sentence in front of it, not a harder gate.

> **"End" means the second press**, which is the opposite of what this file said until
> [#79](https://github.com/moeriki/tinker-lab/issues/79) — *game end* used to be the freeze.
> Nothing ends for a guest at press one; they just find the buttons dead. Not "lock": a signature
> card locks for 30 minutes and Teddy is in a lockbox, and one word cannot mean three things.

**The gap is where the hosts work.** Between the two presses the numbers are final and nobody has
seen them: that is when they empty the queue, hand out anything they owe with the freehand award,
and read the top three off `/league` — which the admin cookie has reached all night.

**The announcement has no trigger.** The hosts read the top three whenever they like; the button
only publishes.

Once the night has ended, **the game does not unfreeze** — `unfreezeGame()` refuses and the button
is gone. Publishing final standings for a game that is accepting answers again is the one state
this split exists to make unreachable.

### Reset

The other end of the night from the freeze, and the only control that empties the board: **every
table in the database, and the uploads directory with them**. Pressed once, shortly before guests
arrive, to get the rehearsal out of the way — but it is a live control on `/admin/reset`, reached
from `/admin/controls`, not a dev tool: 19:45 on a phone is when it is needed and a shell on Tower
is not reachable then.

**What it clears is not a list.** The database holds player data *only* — content is files in this
repository — so a reset empties whatever tables `sqlite_master` reports, read at the moment it
runs. Nothing enumerates them, so a migration that adds a table never has to remember to update a
wipe. Migrations themselves survive: `user_version` is a pragma on the file, not a row.

**Nothing is deleted.** `VACUUM INTO` snapshots the database and the uploads directory is *moved*,
both into `$DATA_DIR/resets/<timestamp>/`, before a row is emptied. That is what makes it safe to
have on the board at 23:00: the worst a mis-press does is file the night away, restorable by the
recipe in `MM-HANDOFF.md`.

**Two guards, no dialog.** It is a page rather than a button, so one tap destroys nothing; and the
page counts what it would clear and says **how long ago somebody last played**, which is the line
that separates a rehearsal from a party in progress. It states the risk and never refuses — at
19:45 the recent activity is the host's own testing, and a machine that blocked him then would be
wrong.

There was a **third guard and [#79](https://github.com/moeriki/tinker-lab/issues/79) removed it**:
the form used to take the typed word `RESET`. **Nothing on this site asks anyone to spell anything
any more** — a plain confirmation is enough for anything dangerous, and a page that already counts
what it is about to destroy *is* one. The rule reaches the end and the delete too.

Still deliberately no `confirm()`: client JS here is animation and the hint modal, and a control
that files away five hours of a party should not be the one thing needing a script to run.

### Deleting a team

The site's other destructive control, and **a door tool rather than a small reset**
([#87](https://github.com/moeriki/tinker-lab/issues/87)). What it is for is 20:10: a pair who
registered, changed their minds, and want to be on different teams — or the same phone through the
door twice. It exists so the night does not run with ghost teams on the league table.

That hour decides the design. **There is no snapshot and no `data/deleted/`**, where reset has
both, because at the door a team is a dealt handle, two names and nine onboarding answers and
there is nothing to file away. What guards the press instead is the **count**: `/admin/delete-team`
lists every team with what it has done, and the confirmation says it again. `nothing yet` means the
press is free; `14 scans · 6 submitted · 31 points` is the sentence that stops the thumb, without
the page ever having to know what time it is.

It is a **list, not a dropdown**, and rows carry the **two members' names** as well as the handle —
handles are dealt animals, so choosing between PENGUIN and PELICAN in a collapsed picker in a loud
hall is a coin toss with an irreversible button on the end of it. A team that never finished the
door questions says so, because that is the likeliest dud and the freest one to remove.

Three consequences, two of them invisible from the page:

- **The phone starts over.** No row means no team behind the cookie, so the next tap lands on
  `/welcome`. This is the *start over on this phone* hatch [#9](https://github.com/moeriki/tinker-lab/issues/9)
  refused to build for guests — here it is the entire point, and it is host-gated.
- **The handle goes back in the bag**, since `dealTeamName` deals from words no live team holds.
- **Other teams' Guess Who cards** pointing at the deleted members are taken back, and the guesses
  written on them go too. `deals.ref` is an opaque integer with no foreign key, so no cascade can
  see it; `forgetMembers()` in `src/deals.js` is the one thing that can, and dropping beats leaving
  because a hand tops up on every open — leave the row and a stranger holds a blank square,
  counting against their ten, that they can never fill.

**Not repaired, deliberately:** a Human Bingo signature naming the deleted handle stays on the
stranger's card with its points banked. A signature is a word, not a reference, and there is
nothing to repoint it at. Dieter's steer covers it — *"in the end it's their choice. If it impacts
other teams then we should accept that."* At the door there are no signatures anyway.

`src/removal.js`, walked by `node scripts/walk.js delete`.

### Profile answer

An onboarding questionnaire answer, keyed by `question_id` from `content/questions.js`. Its
`member_id` is **nullable**: `NULL` means a team-level answer. Questions declare
`scope: 'team' | 'member'`; member-scoped ones are asked once per member.

Every question is here because **a game eats it** — that is the whole admission test. One
member-scoped answer per person becomes a Guess Who card; five team-scoped ones are the honest
**harvest** that Herd Mentality asks you to predict hours later. A team that skipped would put a
hole in everyone's tile, not just their own, which is why onboarding is a **gate**:
`onboardingComplete()` means the team exists *and* owes no answers, and every route past the door
asks that rather than merely 'has a cookie'.

The two blocks want **opposite things**, which is the one thing to know before editing the file.
A herd question wants answers that **cluster** — four to six plausible ones, so the crowd has a
shape to guess at. A Guess Who rung wants answers that **separate**, because two identical
answers are indistinguishable by definition. Do not improve one into the other.

### Ladder, and slot

Several questions sharing a `ladder` id are **rungs**, of which a subject answers exactly **one**.
Onboarding shows rung 1; *"ask me something else"* walks down the list; the last rung has **no
skip**, so everybody contributes exactly one answer and there is no opt-out to represent.

It exists because rung 1 of the Guess Who ladder — *what did you want to be when you were young* —
is a **memory** question, and somebody who genuinely cannot remember has nothing to type into a
required field. The alternatives were a weaker question for everyone, or a hole in the deck.

A **slot** is what the gate actually counts: one answer a team owes. A whole ladder is **one
slot**, however many rungs it has (`questionSlots()`). Counting question *rows* instead would
demand all five rungs from every member — the exact opposite of a ladder — so `onboardingComplete`
asks per slot and never totals. Answering a rung **deletes** the member's answer to any rung they
have skipped past, so a member holds exactly one and no abandoned answer is ever dealt as a card.

Skipping re-submits the form as a **GET**, so nothing typed is lost and no client JS comes near
onboarding — the same trick the team name's reroll and the wizard's back button use. See
[ADR-a-question-may-be-a-ladder](docs/adr/a-question-may-be-a-ladder.md).

> A **rung** is one question of a ladder. A **slot** is one answer owed. Not "optional question" —
> nothing here is optional; the ladder always ends in one that is answered.

Answers are stored **verbatim** and normalised only when counted. `src/matching.js` owns that —
lowercase, accents, punctuation, a trailing plural, then roughly one edit of slack per five
characters and **exact below five**, because `cat`/`bat` and `bear`/`beer` are two teams
disagreeing rather than one typing badly.

## Storage

`node:sqlite` — zero dependencies, no native compilation. WAL, foreign keys on. Schema changes
go through numbered files in `db/migrations/` tracked by `PRAGMA user_version`. See
[ADR-sqlite-via-node-sqlite](docs/adr/sqlite-via-node-sqlite.md).

**A migration's version is the number written on its filename**, and the numbers must run `001`,
`002`, `003` with no gaps and no repeats — boot refuses otherwise. `user_version` is one integer,
so it can only mean "everything up to N has run"; that sentence is only true while the numbering
is dense and unique. If you are adding a migration and someone else took your number while you
were working, renumber yours before you land it.

**Run `node scripts/migrate-check.js` before you land a migration.** A fresh database is the one
case that never breaks; the check builds a throwaway database at every earlier `user_version`,
fills every table, rolls it forward through the real runner and checks the rows came out the other
side. It never opens `$DATA_DIR`. When a migration adds a table, add a row for it to that script's
`SEED` — it refuses to pass while a table has nothing in it, because a table with no rows is not
being checked at all.

The trap it exists to catch is the **table rebuild**, which SQLite needs whenever a `check`
constraint changes (`004`). `alter table awards rename to awards_old` is safe only because
nothing references `awards`. Rebuild a table something *does* reference — `teams` — the same
way, and the rename silently repoints every child's foreign key at `teams_old`; dropping it
then cascades, taking every member, answer, scan, unlock, submission, hint and award with it.
On an empty database that migration looks flawless.

Everything mutable lives under `$DATA_DIR` (default `./data`):

```
$DATA_DIR/bday.sqlite        the database
$DATA_DIR/bday.sqlite-wal    ┐ WAL sidecars — which is why the deployment must
$DATA_DIR/bday.sqlite-shm    ┘ bind-mount the DIRECTORY, never the .sqlite file
$DATA_DIR/uploads/0007-yarn-20260814T2134-a3f9.jpg        a photo, as the camera made it
$DATA_DIR/uploads/0007-yarn-20260814T2134-a3f9.thumb.jpg  its EXIF thumbnail, where there was one
$DATA_DIR/backups/bday-<timestamp>.sqlite                 scripts/backup.js
$DATA_DIR/resets/<timestamp>/bday.sqlite  ┐ a night filed away by /admin/reset — see **Reset**.
$DATA_DIR/resets/<timestamp>/uploads/     ┘ Deletable once the party it holds is over.
```

## Route inventory

Team-facing:

| method | route | what | idempotent |
| --- | --- | --- | --- |
| GET | `/q/:slug` | **the front door** — resolve a code, apply its effect, redirect | mutating, see [ADR-qr-entry-mutates-on-get](docs/adr/qr-entry-mutates-on-get.md) |
| GET | `/` | dashboard: header, score, tile grid | ✓ |
| GET | `/welcome` | **the door**, screen 1: your name. Screens 1–2 write nothing, so they are GET forms and the names ride in the query string | ✓ |
| GET | `/welcome/mate` | door screen 2: *you're the captain now* — the second name, or `on my own` | ✓ |
| GET | `/welcome/team` | door screen 3: the dealt team name. Reroll re-submits this form as a GET | ✓ |
| POST | `/welcome` | create team + members, set cookie → `/questions`. The door's first press that mutates anything | PRG |
| GET | `/questions` | door screen 4a, and **the gate** — every team-facing route bounces here until the questionnaire is answered | ✓ |
| GET | `/questions/:at` | the remaining question screens, one subject each. Renders even for a complete team, which is what lets the rules screens have a back button | ✓ |
| POST | `/questions[/:at]` | save this screen's answers; blanks return here, otherwise the next screen, then the rules | PRG |
| GET | `/questions/rules/:n` | the door's last screens: the house rules, one per screen, pressed through rather than tapped away. The last one goes to bare `/questions` to finish | ✓ |
| GET | `/g/:gameId` | game page; `?step=n` for hunts, clamped to reached; `?just=` is the moment, `?hint=` the reveal notice | ✓ |
| POST | `/g/:gameId/submit` | upsert (`answer`) / insert (`tally`); multipart for photos → back to `/g/:gameId` | PRG |
| POST | `/g/:gameId/hint` | reveal next hint, write the negative award | PRG |
| GET | `/rules` | rules; the hidden hint rule appears after the first reveal | ✓ |
| GET | `/p/:pageId` | gag and hidden pages | ✓ |
| GET | `/league` | the board: every team, ranked. Once the night has **ended** — not merely once it is frozen. The admin cookie reaches it at any time ([ADR-the-menu-bar-is-pinned-to-the-bottom](docs/adr/the-menu-bar-is-pinned-to-the-bottom.md)), and refreshes it every 30s. A guest's own row is expanded; a host's board is uniform | ✓ |
| GET | `/recap` | the night played back from its own material; once the night has ended. Honest stub, owned by #81 | ✓ |
| GET | `/shots` | every photograph of the night, open to the teams; once the night has ended. Honest stub, owned by #80 | ✓ |

Admin, all behind one cookie gate
([ADR-admin-is-a-one-time-secret-url](docs/adr/admin-is-a-one-time-secret-url.md)):

| method | route | what |
| --- | --- | --- |
| GET | `/admin/key/:secret` | set the admin cookie, redirect to `/admin` |
| GET | `/admin` | **HQ**: the host's dashboard. Team count, how long the night has run, the progress percent, the three code numbers, the half-hour pulse, and what is waiting on a human. Refreshes itself, which is why it holds no form |
| GET | `/admin/live` | the fragments HQ and the host's league poll every 10s. The site's one non-page endpoint; admin-gated, because it hands back the whole board in one request |
| GET | `/admin/controls` | everything with a consequence, on one page and off the menu bar: freeze/unfreeze, end, hand out points, recompute, delete a team, reset |
| GET | `/admin/delete-team` | the teams, each with its two members' names and what it has done; `?team=<id>` is the confirmation in front of the press — see **Removing a team** |
| POST | `/admin/delete-team` | remove one team, its photographs, and the dead cards it leaves in other hands |
| GET | `/admin/court` | everything waiting on a human verdict, across all games, in one list. Honest stub, owned by #83 |
| GET | `/admin/game/:gameId` | the gallery: every submission for one game, with the actions its judging mode calls for — or, for a `trophy`, the team list with one button each |
| POST | `/admin/judge` | verdict + award on one submission; rejecting writes a zero rather than deleting, so re-judging upserts |
| POST | `/admin/trophy` | hand a trophy over, or take it back (which writes a zero) |
| POST | `/admin/award` | manual points to a team |
| POST | `/admin/freeze` · `/admin/unfreeze` | the freeze, and its undo. Unfreezing is refused once the night has ended |
| GET | `/admin/end` | the sentence in front of the second press, see **The freeze, and the end** |
| POST | `/admin/end` | publish the league; lands the host on `/league`, which is what they read from |
| POST | `/admin/rescore` | re-run content scoring over existing player data |
| GET | `/admin/codes` | slug → target inventory with scan counts, for debugging a code someone says is broken |
| GET | `/admin/reset` | what a reset would clear, and the confirmation in front of it — see **Reset** |
| POST | `/admin/reset` | file the night into `$DATA_DIR/resets/` and empty every table |

**`HEAD` is answered wherever `GET` is** — `route()` matches a HEAD against a GET route and Node
drops the body — so `curl -I` and the uptime monitors that default to HEAD read a healthy site as
healthy ([#40](https://github.com/moeriki/tinker-lab/issues/40)). Every route above is safe to
answer that way except one: `HEAD /q/:slug` has a route of its own that reports whether the code
exists (`200` / `404`) and touches nothing, because computing the `303` a GET returns IS the scan
([ADR-qr-entry-mutates-on-get](docs/adr/qr-entry-mutates-on-get.md)) — a link-preview crawler
must not spend a code or flash a lamp. The only other GET that can mutate is `/questions`, which
replays a held code once onboarding completes; that replay is skipped on a HEAD and the slug
stays pending.

Static: `/css/*`, `/js/*`, `/fonts/*`, `/img/*` from `public/`; `/uploads/*` from `$DATA_DIR`;
`/kit` is the style kit — served from `public/kit.html`, with the real components injected into it
(see **Component** below).

Dev build only — these two routes are appended to the inventory when `NODE_ENV=development` and
are **absent**, not forbidden, on any other build:

| method | route | what |
| --- | --- | --- |
| GET | `/dev/logout` | drop the test team and stop re-attaching it → `/welcome`, so real onboarding can be walked |
| GET | `/dev/login` | back into the test team → `/` |

## Dev build

`NODE_ENV=development` builds a harness around the site, so that testing a change does not start
with nine onboarding fields and nineteen slugs tapped out of `/admin/codes`
([#62](https://github.com/moeriki/tinker-lab/issues/62)). It gives you:

- a **test team** — `TEST TEAM`, two members, through the questionnaire, attached automatically to
  any browser that is not already carrying a team;
- **every tile unlocked** and nothing played, which is the seed in full: no fabricated rival teams,
  no submissions, no photographs;
- the **admin cookie**, so `/admin` and `/` link to each other from the menu bar rather than
  through a secret URL;
- a **yellow menu bar** instead of the black one, which is the only thing on screen saying this is
  not the night, and which holds **every link there is** — `board HQ court league recap shots`.
  `board` is dev-only because `/` demands a team and a host on the night is never one; `recap` and
  `shots` show whatever the clock says, because a dev build has no night to be partway through, and
  both routes let a dev build through the gate that bounces production;
- a **menu bar on every screen of the door**, which carries none on the night — so the front door
  still says which build it is, and so the walk back in from a logout is a tap;
- a **logout**, which is a dev affordance and not a change of heart — this site still has no
  sign-out, no rejoin and no recovery (see **Team**). It and its way back are one toggle at the
  foot of `/admin/controls`, below the dangerous end and not inside it: nothing there destroys
  anything.

Everything it does lives in `src/dev.js`. Production imports it and calls nothing: the routes are
an empty array, no `style` attribute is emitted on the menu bar, `/welcome` and `/questions` draw
no bar, and no test team is ever written.

> **There was a fourth menu until [#96](https://github.com/moeriki/tinker-lab/issues/96)**:
> `devBar()`, a yellow strip across the top of every page carrying `DEV · board · admin · test team
> · log out`. It was the only navigation this site had when it was written, and by the time the
> menu bar existed three of its four links had homes — `admin` is `HQ`, `board` moved down, the
> toggle moved to `/admin/controls`. It also sat at the top of the screen, which is the one place
> this site decided navigation does not go
> ([ADR-the-menu-bar-is-pinned-to-the-bottom](docs/adr/the-menu-bar-is-pinned-to-the-bottom.md)).
> Its colour is what survives it.

The switch is an explicit equality, so an **unset `NODE_ENV` is production**. That asymmetry is
deliberate: a laptop that forgets the flag shows locked tiles and you notice within one screen,
while a container that lost its env file would hand every guest every game and say nothing.

`npm run dev` sets it, and `pitchfork.toml` keeps one such build permanently up on this laptop at
<http://bday.localhost:8080> (see [`docs/agents/dev-server.md`](docs/agents/dev-server.md)).
`npm run dev:prod` is the same watcher without it, for the times the locked
wall is the thing being tested. Docker builds either flavour — `NODE_ENV=development docker compose
up -d --build` — and defaults to production when the arg is unset.

## Component

A piece of markup the design system ships: a tile, a hero, a form field, the scorebar, the hint
modal. The styles are shared by construction — `public/css/app.css` is linked by every page and by
`/kit`, so appearance cannot drift. The markup is what had to be settled.

> **A component's markup exists in exactly one place** ([ADR-a-component-has-one-markup](docs/adr/a-component-has-one-markup.md)).

Where the app renders a component, that place is a function in `src/render.js`, and `/kit` calls it
through a marker comment — `@tile state="unlocked" title="Longest Yarn"` — which `src/kit.js` swaps
for the real output. The kit holds no copy, so it cannot show something the site does not do.

Where the app does **not** render it yet, the markup is hand-written in `kit.html` and that page is
its only home. Those demos wear a red **STILL OWED** badge, and the kit's footer generates the list
of them from those badges. Building one into a page means **moving** its markup into `render.js` and
leaving a marker behind in the same change, so a second copy is never created.

> **The kit is the source of truth, and this file does not keep a copy of what it owes.** Read the
> footer of `/kit`.

That is deliberate and it was learned the hard way: the list used to be typed by hand here, in the
kit's footer, in the kit page's header comment, and in `src/kit.js` — four copies, three of them
stale, naming the window frame long after [#37](https://github.com/moeriki/tinker-lab/issues/37)
built it and the speech bubble long after hints started rendering one. Now the page counts its own
badges ([#55](https://github.com/moeriki/tinker-lab/issues/55)), so there is nothing to keep in step.

> **New design is drawn on the kit first, then built into a page.** A component that appears
> directly on a page, having never been on `/kit`, is the drift this rule exists to stop.

That rule reaches as far as the kit's contract does, so the **admin surface is not held to it**
([#66](https://github.com/moeriki/tinker-lab/issues/66)) — its markup is written inline in
`src/app.js` and is allowed to stay there. What does **not** lapse with it is the naming rule
below: admin classes share one cascade with everything else, which is precisely how the collision
in the next paragraph happened.

> **Two unrelated components may never wear one class name**, and this is a stronger rule than it
> sounds, because the failure is silent and it is not a naming complaint. The signature card and
> the admin gallery's judging boxes were both `.card`
> ([#60](https://github.com/moeriki/tinker-lab/issues/60)), and CSS does not pick a winner between
> two rule blocks — it merges them **per property**, later block winning each one it declares. So
> the gallery took `display: grid` and `padding: 0` and drew every submission as a padding-less
> three-column grid, while the card took a `border`, a `box-shadow` and a paper `background` and
> wore a heavy frame around nine squares that each already had one. **Neither look was designed and
> both rendered**, which is why nothing looked broken enough to report. The word came from the
> glossary in the end: a **card** is something a team holds, so the gallery's box became a
> `.submission`.

Sweeping every rule block in `app.css` for a selector declared twice found **exactly one** genuine
collision — this one. Every other repeat is a group rule setting shared properties before a
per-component rule specialises them (`.tile__lock, .tile__flag`, `.starburst, .stamp`,
`.board th, .board td`), or the reduced-motion guard, and in all of those the two blocks belong to
the same component. Deliberately **not** landed as a check: there is no test suite and no CI, so it
would be a file nobody runs that looks like enforcement — [#32](https://github.com/moeriki/tinker-lab/issues/32)'s
reasoning, unchanged.

No **component** the app renders is missing from `/kit` any more. The last one was the **signature
card** — `card()` and `square()`, demoed at §16 in all three of its states, and the one component
the kit can show *completely*, since the grid takes no `<form>` and the dropdown under it belongs
to the page. Before that it was the `.unit` /
`.units` row — the list every game that pays **per unit** puts on its tile — which looked like a
page composition because the scavenger wraps each row in a form. It is not: Guess Who and Herd wrap
the whole list in one form and the portrait gallery has none, so the row never needed a route.
`unitRow()` takes the caller's rendered markup as its `body`, `render.js` still renders no form
action anywhere, and §15 demos the row holding real parts
([#51](https://github.com/moeriki/tinker-lab/issues/51)).

The **spacing utilities** now have a home too — `/kit` §4, *Layout & spacing*, which is where the
rule *a primitive carries no outer margin* is stated to the people who have to obey it rather than
only in a comment in `app.css` ([#59](https://github.com/moeriki/tinker-lab/issues/59)). It sits
with the tokens, ahead of every component, because a rule met after nine component sections has
already been broken nine times. `.stack--loose` was retired there: it shipped with the rule in
`126369b` and no page ever used it, which is #58's rule taking its second branch for the first
time.

> **`.field` carries no CSS at all, and that is the point.** It used to say
> `margin-bottom: 1rem`, landed by the same commit that wrote the no-outer-margin rule. A
> `<label>` is inline, so in ordinary flow the margin never applied — but inside a `.stack` the
> label is a flex item, gets blockified, and the margin **adds to the gap**. Every form on this
> site measured 2rem where the design says 1rem, and `.stack--tight` measured 1.4rem instead of
> 0.4rem, so the tighter of the two gaps had never once been the thing on screen.

> **The kit counts its coverage as well as its debt.** The footer's third sentence is every class
> `public/css/app.css` declares, compared against every class the rendered page wears — read per
> request, so it cannot go stale. **Read it rather than this file for the current number.**

The `@owed` badges cannot catch that class of gap on their own: they count hand-written demos, so a
section that exists and is unbuilt wears one, and a class with *no section* has no demo to badge.
That blind spot was found by accident four times running — the photo section
([#41](https://github.com/moeriki/tinker-lab/issues/41)), the scavenger's row
([#51](https://github.com/moeriki/tinker-lab/issues/51)), the signature card
([#60](https://github.com/moeriki/tinker-lab/issues/60)) and these — each by a session doing
something else. [#32](https://github.com/moeriki/tinker-lab/issues/32) ruled out a drift *script*
because no test suite and no CI makes a check nobody runs worse than none — and that reasoning is
why the duplicate-selector check two paragraphs above was declined as well. It does not reach this
one, and the difference is the only thing that matters here: **a script has to be remembered, and a
sentence in a footer does not.** Nobody runs this; it runs because somebody opened the page, which
is exactly the property #55 found when it made the debt list count itself. If it ever becomes a
file in `scripts/`, #32 applies again and it should go.

> **`scripts/walk.js` is a file in `scripts/` carrying 31 checks, and it survives that rule rather
> than breaking it** ([#65](https://github.com/moeriki/tinker-lab/issues/65)). The test is not
> whether a check lives in a script; it is whether the check has to be *remembered*. Nobody will
> run a suite eight days before a party. Everybody wants to see the page — and every flow in
> `walk.js` both walks a state and **shoots** it, so a broken flow cannot produce its screenshot.
> You run it because you want the picture; the regression check is what you get on the way past.
> That is the footer's property, moved. What #32 forbids is still forbidden: there is **no `test`
> script and no CI**, and if `walk.js` ever stops taking screenshots it becomes exactly the thing
> that rule is against.

Classes deliberately kept off the kit are named with their reason in `OFF_KIT` in `src/kit.js`, and
an exemption naming a class `app.css` no longer declares is reported just as loudly as a missing
section, so the list cannot rot in either direction.

> **The kit's contract covers the pages guests see, and stops there**
> ([#66](https://github.com/moeriki/tinker-lab/issues/66)). The **admin surface** — the judging
> table, the photo gallery, the verdict buttons and HQ's own three classes — is outside it. It is a
> working tool one person uses on one night, opted out of the party's chrome by
> `layout({ still: true })`, and nothing is ever assembled out of its parts, which is the drift
> `/kit` exists to catch.

**Being off the contract is not being off the cascade**, which is why `hq-` is a prefix and not a
convenience. Admin classes share one stylesheet with the guest side, and `.card` meant two
unrelated things until [#60](https://github.com/moeriki/tinker-lab/issues/60) — CSS merged them
per property and drew two components nobody had designed. `.hq-galleries a` is also the one place
on this site an anchor is styled without being a `.btn`; everywhere else that shape is a bug.

Those classes live in `OFF_REMIT` in `src/kit.js`, kept apart from `OFF_KIT` because they are a
different claim: `OFF_KIT` says a class **cannot** be drawn on the page — it would animate on every
load, look permanently broken, or fetch from YouTube — and `OFF_REMIT` says it **should** not be.
One is a fact and the other is an argument, and merging them costs the rule that keeps `OFF_KIT`
short. Both are staleness-checked the same way. **The stated cost:** admin has no visual contract at
all, so the only thing that catches a break there is the host looking at it — which is how the
judging boxes rendered as padding-less three-column grids from #21 until
[#60](https://github.com/moeriki/tinker-lab/issues/60) found them.

**The owed list is empty for the first time since it existed**
([#58](https://github.com/moeriki/tinker-lab/issues/58)). The last five hand-written demos each
found a page: the marquee and the status bar became site **chrome**, the sunburst went to `/rules`
beside the block explaining the points, the stamp went to the arrival screen, and the standing
colours reached the dashboard, which had emitted a bare `.standing` since #5 while the kit showed
three modifiers. Nothing was retired, which was a live option and not a defeat.

## Chrome

The two strips that frame every team-facing page and belong to no page: the **marquee** across the
top, and the **status bar** along the foot. Both are branding rather than features — they say
the same thing to every team, never mention a score, a rank or another team, and no page depends on
having read them, which is what makes them `aria-hidden` decoration rather than content.

> **The marquee scrolls away with the page** ([#88](https://github.com/moeriki/tinker-lab/issues/88)).
> It was `position: sticky` until then and rode the top of the viewport on every scrolling page.
> Unsticking it took the last sticky rule off the site, and with it the black tint Safari 26 was
> sampling for the phone's own top bar — so the frame is now black along the bottom and the
> browser's own colour along the top, on purpose. The **status bar and menu bar stay pinned**:
> being reachable without scrolling is the menu bar's whole reason
> ([ADR](docs/adr/the-menu-bar-is-pinned-to-the-bottom.md)).

Their words live in `content/chrome.js`, and `layout()` is the only caller — the one place in
`src/render.js` that reaches into `content/`, because a frame has no page to be handed its words by.
The marquee's order is fixed and shuffled once, in the file; the status bar draws two of twelve
lines per request.

> **`layout({ still: true })` drops both.** `still` already meant *this is a working surface, not a
> party* ([#14](https://github.com/moeriki/tinker-lab/issues/14)), so the admin board gets no
> scrolling banner and no strip that would resample itself under a host every thirty seconds.

The **menu bar** is the third strip, and the only one that is content rather than decoration: it is
the site's navigation, pinned to the bottom of the screen with the status bar under it
([ADR-the-menu-bar-is-pinned-to-the-bottom](docs/adr/the-menu-bar-is-pinned-to-the-bottom.md)). It
is the exception to everything above — its words are links, not branding, and they differ per
request, so `navbar()` is a **slot** filled by `navFor()` in `src/app.js` rather than something
`render.js` reaches into `content/` for. `still` does **not** drop it: an admin surface is exactly
the surface that needs it.

**A guest has no menu bar while the game is playing.** The tiles are the navigation for five hours;
the bar arrives at the reveal, when there are suddenly four places to be and the board has stopped
being one of them.

One line is deliberately absent from the marquee: an early draft carried *HINTS COST YOU POINTS*,
which would have announced rule 4 on every page from minute one — the one thing on this site that
is hidden until a team stumbles into it. The replacement, *YOUR SCORE CAN GO BELOW ZERO*, is the
tease `/rules` already prints in public.

`GET /healthz` is the container health check and the pre-party liveness probe — JSON, no cookie
required, `503` if the database is unreachable. It reports nothing about teams or scores, being
the one route reachable by anyone ([#13](https://github.com/moeriki/tinker-lab/issues/13)).

It also carries `build`, the commit the running container was built from, and it is the **only**
thing on the site that says which build is live
([#46](https://github.com/moeriki/tinker-lab/issues/46)).
There is no registry and no version number, so a deploy is `git pull && docker compose up -d
--build` and two containers weeks apart are otherwise indistinguishable. The sha is handed in as a
Dockerfile `ARG` because `.dockerignore` drops `.git/` on purpose; `BUILD_COMMIT` unset reports
`unknown` inside a container and `dev` outside one, and neither is ever a wrong sha. Check a
deploy landed with `curl -s https://bday.moeriki.com/healthz`, and measure the lag with
`git log --oneline <build>..origin/main`.

**The live site is reachable from a session on the house WiFi.** `bday.moeriki.com` is LAN-only
([ADR-the-house-network-is-the-boundary](docs/adr/the-house-network-is-the-boundary.md)), which
means unreachable from *outside* the house — not unreachable from an agent. A session on the
house network can `curl` the deployed site directly, so "does the live site do this?" is a
question that can be answered rather than assumed.
