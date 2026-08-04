# PROTOTYPE — animation choreography

Throwaway. Answers [issue #14](https://github.com/moeriki/tinker-lab/issues/14): which moment in
the real flow fires which animation, and does a page transition earn client JS at all.

**Do not merge this branch.** Only the decision goes back to `main`.

## Run it

Several sessions share the main checkout, so take a worktree rather than switching its branch:

```sh
git worktree add /tmp/proto-anim prototype/animation-choreography
cd /tmp/proto-anim
PORT=3141 node server.js
```

Then open <http://localhost:3141> **on a phone or in a narrow window** — this is a mobile-only
site and the tile grid is the thing being judged. Onboarding takes one tap.

Flip variants with the bar pinned at the bottom, or `←` / `→`, or `?variant=A|B|C`. The choice
rides in a cookie, so it survives every redirect in the flow.

## The three schemes

| | where the moment lives | scan of a new game lands on | submitting an answer lands on | client JS |
| --- | --- | --- | --- | --- |
| **A** STILL | nowhere — nothing celebrates | `/g/yarn` (today's behaviour) | `/` | none |
| **B** GRID | the dashboard tile | `/?unlocked=yarn` — **one extra tap** to open the game | `/?correct=yarn` | needed, to strip the param |
| **C** IN PLACE | the page you are already on | `/g/yarn?just=unlock` — hero plays the unlock | `/g/yarn?verdict=correct` — **you stay put** | needed, to strip the param |

All three animate page arrival (`anim-page`); that is the one thing they do not argue about.

## What to walk

The fixture content is three throwaway games and six slugs, since `content/` is empty until the
roster locks:

| scan this | what it is | why it is interesting |
| --- | --- | --- |
| `/q/k7f2qx` | `yarn`, an `answer` game, `check()` on submit, answer is **7** | the only kind with a real "correct, right now" moment |
| `/q/w9d4tn` | `snaps`, a `tally` photo game on trust | never returns to the dashboard, so B has nothing to animate |
| `/q/m3p8zz` → `/q/r6h1vb` → `/q/z2c5jq` | `lights`, a 3-step hunt | step 1 unlocks; steps 2–3 are step transitions, not unlocks |
| `/q/b4xk7m` | a gag page | page arrival with no state change |

Worth doing deliberately: submit **7** (correct) and then **3** (wrong) on `yarn`, under B and
then under C. That is where the schemes disagree most.

## What the build already settled

Things that stopped being opinions once the flow was wired:

1. **A query param is the only channel.** Every one of these moments is a POST-and-redirect or a
   scan redirect, so the server has nowhere else to say what happened. Confirmed by the fact that
   the *variant switch itself* had to fall back to a cookie.
2. **The codebase already does this.** `?problem=toobig` and `?first=1` predate this ticket, so
   B and C add a convention rather than inventing one.
3. **`anim-correct` has one honest trigger.** Only `check()` games know a verdict at submit time.
   `resolve`, `manual` and `trust` games go to Unknown, so on a full roster most submissions have
   nothing to celebrate. Whatever wins must not look broken for them.
4. **Photo games are outside the argument.** They return to the game page by design, so a tile
   animation can never fire for them.
5. **Every scheme degrades to A.** `public/css/app.css` ships a `prefers-reduced-motion` guard
   that flattens all animation to 0.001ms. So the flow must already be legible with no motion at
   all, and no animation can be load-bearing.
6. **`first=1` is written but never read.** `revealHint` redirects with it, and the hint modal
   exists only in `public/kit.html` — the real layout has no modal. Unrelated to the choreography
   question, but it is a live gap.

## Then

Fold the winner into `main` by hand — the variant code here was written under prototype rules.
Everything else stays on this branch as the primary source.
