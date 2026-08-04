# Research: party games that get people talking

Resolves [#3](https://github.com/moeriki/tinker-lab/issues/3). Part of [#2](https://github.com/moeriki/tinker-lab/issues/2).

**This is a menu, not a roster.** 62 candidates to cut down from. Nothing here is chosen.

## The question

What party games, icebreakers and pub-style games suit **10–15 teams of 2 adults, roaming a house
between 20:00 and 01:00, with a phone in hand** — and which adapt cleanly to a "scan a QR code,
answer on a web form" shape?

Two gaps drove the search:

1. **Cross-team talking.** The existing ideas are solo estimation puzzles. Nothing forces a team to
   approach a stranger.
2. **Drinking.** Absent entirely. Wanted: drinking that is *optional*, so non-drinkers are not
   excluded and nobody is pressured.

Secondary asks: games judged only at the end of the night, games that reward wandering the house,
games that are funny to *lose*.

## The constraints every candidate had to survive

| Constraint | Consequence for game design |
| --- | --- |
| One phone per team of 2; cookie is team identity | No per-person answers unless the form asks twice |
| A game = one dashboard tile, unlocked by scanning its QR | One hero (text or image) + one form |
| Plain HTML POST; photo upload available | No live multiplayer, no realtime, no chat, no push |
| Some tiles take one updatable answer, some take many submissions | Both shapes are cheap; pick per game |
| Scoring is self-scoring, host-judged, or resolved at game end | "Resolved at game end" is the most powerful of the three |
| No facilitator, no seated rounds, no announcements | Anything needing a caller or a circle is out |
| 20:00–01:00, free-roaming, house (bedroom off limits) | Long games beat 5-minute rounds |
| Home Assistant can fire on a scan | Lights/sound as a reward channel |
| Tone: deadpan-absurd, MS Paint / geocities | Failure messages are content |

**Legend.** `REAL` = published/documented game used close to as-written · `ADAPTED` = real game with
a changed scoring or delivery mechanism · `INVENTED` = built for these constraints, no source.

**Talk?** = does scoring depend on other guests being present and engaged.

---

## Index

| # | Candidate | Talk? | Drink? | Scored | Build |
| --- | --- | --- | --- | --- | --- |
| 1 | Human Bingo | ●●● | – | end | med |
| 2 | Human Scavenger Hunt (photo proof) | ●●● | – | host | low |
| 3 | Guess Who — Anonymous Fun Facts | ●●● | – | end | med |
| 4 | The Game of THINGS… | ●●● | – | end | med |
| 5 | Two Truths and a Lie | ●●● | – | end | med |
| 6 | Who Am I? (forehead sticker) | ●●● | – | instant | low |
| 7 | Just One (duplicate-clue elimination) | ●●● | – | end | low |
| 8 | Scattergories (uniqueness) | ●● | – | end | low |
| 9 | Herd Mentality | ●● | – | end | low |
| 10 | Family Fortunes — House Survey | ●●● | – | end | med |
| 11 | The Voting Game / Most Likely To | ●● | ○ | end | low |
| 12 | Blankety Blank (match one rival team) | ●●● | – | end | med |
| 13 | Mr & Mrs | ○ | ○ | instant | low |
| 14 | Balderdash / Fibbage | ●● | – | end | med |
| 15 | Say Anything (bet on the host) | ●●● | – | end+host | med |
| 16 | Wavelength (async slider) | ●● | – | end | med |
| 17 | Trading Cards Mixer | ●●● | – | end | med |
| 18 | Speed Meeting (assigned target) | ●●● | – | end | high |
| 19 | Pub-Quiz Cross-Marking | ●● | – | end | med |
| 20 | Doppelgänger `INVENTED` | ●●● | – | end | med |
| 21 | The Rumour Mill `INVENTED` | ●●● | – | end | low |
| 22 | The Deck of Consequences (Kings) | ●●● | ●●● | host | med |
| 23 | Never Have I Ever — Rarity Edition | ● | ●● | end | low |
| 24 | The Nomination Engine (Most Likely To) | ●●● | ●●● | end | low |
| 25 | Ibble Dibble | ●●● | ●● | host | low |
| 26 | Cardinal Puff | ●● | ●● | host | low |
| 27 | Fuzzy Duck | ●●● | ●● | host | low |
| 28 | Roxanne | ●● | ●● | instant | low |
| 29 | The Triangle Test | ○ | ●●● | instant | low |
| 30 | Iron Bartender | ● | ●●● | host | low |
| 31 | Buzz / Fizz-Buzz | ○ | ○ | instant | low |
| 32 | Play Your Cards Right | ● | – | end | med |
| 33 | The Pub Throwing Station | ● | ○ | end | low+props |
| 34 | Wits & Wagers | ● | – | end | high |
| 35 | Guess ⅔ of the Average | ● | – | end | low |
| 36 | Galton's Ox / Guess the Weight | ○ | – | end | low |
| 37 | Fermi Estimation | ○ | – | end | low |
| 38 | One Bid (Price Is Right) | ○ | – | end | low |
| 39 | The Joker | ○ | – | end | low |
| 40 | High Offer / Low Offer (The Chase) | ○ | – | instant | med |
| 41 | Split or Steal (Golden Balls) | ●●● | – | end | med |
| 42 | Prediction Bingo | ● | ○ | host | low |
| 43 | The Sweepstake | ○ | – | end | low |
| 44 | Party Prediction Market | ● | ○ | end | high |
| 45 | Photo Scavenger Hunt | ●● | ○ | mixed | low |
| 46 | Photo Bingo | ● | – | instant | med |
| 47 | Extreme Close-Up Picture Quiz | ○ | – | end | low |
| 48 | Recreate the Photo | ●● | – | host | low |
| 49 | Portrait of a Stranger | ●●● | – | instant | low |
| 50 | Write the Museum Label | ○ | – | end | low |
| 51 | Hunt the Thimble (server as oracle) | ○ | – | instant | med |
| 52 | Score-O (orienteering, with late penalty) | ○ | – | instant | low |
| 53 | Letterboxing (unclued) | ○ | – | instant | low |
| 54 | Cipher Hunt | ○ | – | instant | med |
| 55 | Munzee | ○ | – | instant | low |
| 56 | Assassin / Killer (word or object trigger) | ●●● | – | instant | med |
| 57 | Wink Murder (async) | ●●● | – | end | med |
| 58 | Don't Say ___ (clothespins) | ●●● | ○ | instant | low |
| 59 | The Game | ●●● | – | instant | low |
| 60 | Travel Bug / Trackables | ●● | – | end+host | med |
| 61 | The Cursed Owl (hot potato at 01:00) | ●●● | – | end | low |
| 62 | The Wooden Spoon | ○ | – | end | free |

`●●●` central · `●●` strong · `●` incidental · `○` none · `–` n/a

---

## 1. Cross-team talking — the priority gap

Mechanics where a team's score genuinely depends on approaching people they did not arrive with.

### 1.1 Fact-collecting mingle hunts

**1. Human Bingo / "Find Someone Who"** `REAL`
[icebreaker-games.org](https://icebreaker-games.org/human-bingo) ·
[ventureteambuilding.co.uk](https://ventureteambuilding.co.uk/human-scavenger-hunt/)

- *Mechanic:* A 5×5 grid of traits ("has broken a bone", "has been to Albania"). Find a person who
  matches, take their signature. Canonical rule: one person may sign only once.
- *Physical:* Roam, ask strangers "have you ever…", collect their team code.
- *Form:* 25 text fields, one per square, each taking a 4-character team code. Repeat submissions,
  latest wins.
- *Scores:* Instant per square (server knows every code). 1 pt per square, bonus for a line, penalty
  for reusing a code. Cross-checked at game end against the signing team's own onboarding answers —
  if they lied to get you a signature, both lose the point.
- *Needs others:* Yes, up to 25 different people. The strongest pure mingling engine found.
- *QR fit:* Excellent. One form, many fields, updatable all night.

**2. Human Scavenger Hunt, photo-proof variant** `ADAPTED`
[ultimatecampresource.com](https://ultimatecampresource.com/ice-breakers/common-ground-icebreakers/human-treasure-hunt/)

- *Mechanic:* Same as above but proof is a photo, not a signature: "photograph three people who are
  all wearing something green".
- *Physical:* Assemble strangers into a tableau, shoot it.
- *Form:* One photo upload + text field for the team codes in shot.
- *Scores:* Host-judged, binary per task.
- *Needs others:* Yes, 1–5 per task.
- *QR fit:* Good, but one tile = one task unless the tile carries a task-picker `<select>` and
  accepts many photos.

**3. Guess Who — Anonymous Fun Facts** `REAL`
[icebreaker-games.org](https://icebreaker-games.org/guess-who-facts)

- *Mechanic:* Everyone submits one obscure fact anonymously. The dashboard lists all of them
  unattributed. You must work the room to attribute them.
- *Physical:* Cornering guests and asking "did you write the one about the ferret?"
- *Form:* Phase 1 one textarea; phase 2 fifteen `<select>`s mapping fact → team.
- *Scores:* At game end. 1 pt per correct attribution, 1 pt per team that failed to guess yours.
  Fully self-scoring.
- *Needs others:* Yes, everyone.
- *QR fit:* Very good. Phase 2 is one big updatable form — the canonical "one answer, editable until
  game end" shape.

**4. The Game of THINGS…** `REAL` (Hasbro)
[thegameofthings.com](https://www.thegameofthings.com/game-things-current-instructions) ·
[instructions.hasbro.com](https://instructions.hasbro.com/en-us/instruction/the-game-of-things)

- *Mechanic:* A prompt ("Things you shouldn't say at a funeral"). Everyone writes a response; the
  game is matching responses back to authors.
- *Physical:* Same social shape as #3, but the material is funny rather than factual — much better
  conversation bait, and much closer to the party's tone.
- *Form:* Phase 1 one text field; phase 2 a dropdown per response.
- *Scores:* End-of-night attributions, plus an optional host-judged "best answer".
- *Needs others:* Yes, everyone.
- *QR fit:* Very good, identical code path to #3.

**5. Two Truths and a Lie** `REAL`
[icebreakers.ws](https://icebreakers.ws/small-group/two-truths-and-a-lie.html)

- *Mechanic:* Each team submits three statements about itself, two true. Every other team votes on
  which is the lie.
- *Physical:* You have to find and interrogate people — the dashboard shows statements, not tells.
- *Form:* Phase 1 three text fields plus a radio marking the lie; phase 2 a radio-triple per rival
  team.
- *Scores:* At game end. Points for detecting lies plus points for fooling others.
- *Needs others:* Yes, indirectly all of them.
- *QR fit:* Strains — two distinct phases on one tile. Solve with two QRs unlocked at different
  times ("The Lie Deposit", "The Lie Detector").

**6. Who Am I? / Celebrity Head** `ADAPTED`
[icebreakers.ws](https://icebreakers.ws/medium-group/who-am-i.html) ·
[Wikipedia: Celebrity](https://en.wikipedia.org/wiki/Celebrity_(game))

- *Mechanic:* Scanning assigns your team a secret identity. You write it on a sticker and slap it on
  *another* team's forehead, then ask yes/no questions of anyone to deduce your own.
- *Physical:* Sticker handling, then roaming asking yes/no questions.
- *Form:* One text field — "who are you?" — plus optionally "how many people did you ask".
- *Scores:* Instant, self-scoring; points scale down the longer you take.
- *Needs others:* Yes, many. Unsolvable alone.
- *QR fit:* Excellent. Requires stickers and markers physically at the QR location.

### 1.2 Convergence and divergence — matching or avoiding other teams

**7. Just One** `ADAPTED` (Repos Production, Spiel des Jahres 2019)
[rprod.com](https://www.rprod.com/en/games/just-one) ·
[Wikipedia](https://en.wikipedia.org/wiki/Just_One_(board_game))

- *Mechanic:* Everyone writes a one-word clue for a secret word. Identical clues cancel out and are
  discarded before scoring.
- *Physical:* Teams must go negotiate — "don't write cheese, I'm writing cheese". Collusion *is* the
  game, which is exactly the cross-team talking wanted.
- *Form:* One text field, one word, hard-capped to a single token server-side.
- *Scores:* At game end. Duplicates score 0, surviving distinct clues score. Pure string comparison.
- *Needs others:* Yes, everyone.
- *QR fit:* Excellent — literally one word in one box. Cleanest tile in this whole section.

**8. Scattergories** `ADAPTED` (Hasbro)
[instructions.hasbro.com](https://instructions.hasbro.com/en-us/instruction/the-game-of-scattergories)
· [Wikipedia](https://en.wikipedia.org/wiki/Scattergories)

- *Mechanic:* The inverse of #9 — an answer scores only if *no other team* wrote it. Duplicates
  cancel to zero.
- *Physical:* Teams interrogate each other to find out what's taken, and lie about it.
- *Form:* 12 category fields, all answers starting with a given letter.
- *Scores:* At game end, uniqueness comparison, host override for nonsense.
- *Needs others:* Yes, indirectly all; directly if strategic.
- *QR fit:* Excellent.

**9. Herd Mentality** `REAL` (Big Potato Games, 2020)
[Wikipedia](https://en.wikipedia.org/wiki/Herd_Mentality_(party_game)) ·
[bigpotato.com](https://bigpotato.com/products/herd-mentality)

- *Mechanic:* Answer a question the way you think the *majority* will. Matching the herd scores.
  Being the sole odd-one-out earns the Pink Cow, a penalty that blocks you from winning until you
  can pass it on.
- *Physical:* Canvassing — running around asking "what did you put for the beige question?"
- *Form:* One short text field per question, several questions on one tile. Server normalises
  case/whitespace.
- *Scores:* At game end by clustering answers and awarding the modal group.
- *Needs others:* Yes, all teams. That is the entire point.
- *QR fit:* Perfect, and the strongest structural match to this platform found anywhere in the
  research. Note it generalises the host's existing "how many share your favourite colour" idea —
  see [Overlaps](#overlaps-with-the-existing-idea-list).

**10. Family Fortunes / Family Feud — House Survey** `ADAPTED`
[Wikipedia](https://en.wikipedia.org/wiki/Family_Fortunes_(Irish_game_show)) ·
[familyfeud.fandom.com](https://familyfeud.fandom.com/wiki/Family_Fortunes)

- *Mechanic:* The show surveys 100 people; you survey *this house*. An early tile harvests honest
  answers ("name a reason to leave a party early"); a late tile asks you to predict the top answer.
- *Physical:* You conduct the survey by walking up to guests and asking them.
- *Form:* Early tile one text field; late tile three ranked text fields or a radio of the top 8.
- *Scores:* At game end, weighted by how many teams actually gave the answer you predicted.
- *Needs others:* Yes, ideally all.
- *QR fit:* Very good, but needs two tiles hours apart. The delay is a feature — it forces a second
  lap of the house.

**11. The Voting Game / Most Likely To** `ADAPTED` (Buffalo Games)
[buffalogames.com](https://buffalogames.com/the-voting-game/) ·
[gamerules.com](https://gamerules.com/rules/the-voting-game/)

- *Mechanic:* "Which team is most likely to be found asleep in the bath?" Everyone votes anonymously
  for a team other than their own.
- *Physical:* You have to know the other teams to vote well, and campaign not to be voted for.
- *Form:* One `<select>` of team names per question, ~8 questions. No free text.
- *Scores:* At game end. Plurality target wins the card; the original also awards points for
  guessing who voted for you.
- *Needs others:* Yes, all.
- *QR fit:* Excellent. Pure dropdown form, no judging.

**12. Blankety Blank / Match Game, cross-team** `ADAPTED`
[Wikipedia](https://en.wikipedia.org/wiki/Blankety_Blank)

- *Mechanic:* Fill in a blank ("The birthday boy's worst habit is ______"). You are told which
  *specific* rival team you must match. Both write blind.
- *Physical:* Find that team and read them — either without asking directly, or with open
  negotiation. Deadpan-absurd blanks work best.
- *Form:* One text field per blank, 5–6 blanks, plus a hidden target-team id.
- *Scores:* At game end by fuzzy string match against the target team's submission.
- *Needs others:* Yes, exactly one team. Pairings must be symmetric or the graph gets ugly.
- *QR fit:* Very good — one form, one submit, resolved at end.

**13. Mr & Mrs / The Newlywed Game** `ADAPTED`
[Wikipedia](https://en.wikipedia.org/wiki/Mr_and_Mrs_(game_show)) ·
[theweddingsecret.co.uk](https://www.theweddingsecret.co.uk/magazine/mr-and-mrs-game-questions/)

- *Mechanic:* Each team is two adults. Answer questions *as your partner would*, then compare.
- *Physical:* The partners must physically separate — one leaves the room while the other answers.
  That separation is itself a mingling forcing-function.
- *Form:* Five text/select fields ("what did your partner answer at onboarding for…"). One
  submission, locked.
- *Scores:* Instant — onboarding already captured each individual's answers, so the server knows the
  truth on submit. This makes the onboarding questionnaire pay off twice.
- *Needs others:* No. The low-friction outlier in this section.
- *QR fit:* Very strong if it draws on onboarding data. Weaker if it needs both partners to type
  into the same form in sequence — that's two POSTs, or two QRs in two rooms.

### 1.3 Bluffing and lobbying

**14. Balderdash / Fibbage** `ADAPTED` (Canada Games, 1984)
[drumondpark.co.uk](https://www.drumondpark.co.uk/rules/absolutebalderdash) ·
[Wikipedia](https://en.wikipedia.org/wiki/Balderdash) ·
[Fibbage](https://jackboxgames.fandom.com/wiki/Fibbage_(series))

- *Mechanic:* An obscure word — or an obscure fact about the birthday person. Teams write a
  plausible fake definition. Later, everyone votes on which is real.
- *Physical:* Campaigning for your fake in person. High deadpan-absurd density.
- *Form:* Phase 1 one text field (~80 chars); phase 2 a radio list of all fakes plus the truth,
  shuffled.
- *Scores:* At game end. +2 for finding truth, +1 per team you fooled. Self-scoring; needs
  server-side dedupe of identical lies (a real Fibbage edge case).
- *Needs others:* No, but lobbying multiplies the payoff.
- *QR fit:* Very good. Two tiles hours apart.

**15. Say Anything** `ADAPTED` (North Star Games)
[Wikipedia](https://en.wikipedia.org/wiki/Say_Anything_(party_game))

- *Mechanic:* An open prompt; all teams write a creative answer; the birthday person secretly picks
  a favourite. Teams then bet tokens on which answer was chosen.
- *Physical:* Lobbying the host in person. Blatant bribery encouraged.
- *Form:* Phase 1 one textarea; phase 2 radio over all answers plus a token split.
- *Scores:* Host-judged for the pick, self-scoring for the bets, resolved at game end.
- *Needs others:* Yes, all, plus the host.
- *QR fit:* Good. The only genuinely host-judged tile in this section.

**16. Wavelength, async** `ADAPTED` (CMYK, 2019)
[Wikipedia](https://en.wikipedia.org/wiki/Wavelength_(game))

- *Mechanic:* A spectrum ("Overrated ← → Underrated") with a hidden target. One team writes a
  one-word clue; every other team later moves a slider 0–100.
- *Physical:* The clue-writer roams and hypes their clue verbally; guessers interrogate them without
  ever being told the number.
- *Form:* Phase 1 one text field; phase 2 one `<input type=range>`.
- *Scores:* At game end by distance from target. Server generated the target, so it's self-scoring.
- *Needs others:* Yes, at least the clue-giver.
- *QR fit:* Good. A range slider is plain HTML and a genuinely pleasant mobile form.

### 1.4 Structural mixers

**17. Trading Cards Mixer** `ADAPTED`
[buildingyourteam.com](https://www.buildingyourteam.com/the-trading-cards-icebreaker-how-to-deal-your-team-a-winning-hand/)

- *Mechanic:* Each team is issued a physical card (team code plus a stupid attribute). Cards are
  traded; the goal is to have *held* as many distinct cards as possible.
- *Physical:* Printed cards handed over, swapped, hoarded.
- *Form:* One text field, repeat submissions — "code of the card you now hold".
- *Scores:* At game end by counting distinct codes logged. Two teams logging the same swap confirms
  the chain of custody server-side.
- *Needs others:* Yes, unlimited.
- *QR fit:* Good. Needs props printed in advance.

**18. Speed Meeting** `ADAPTED`
[Wikipedia: speed networking](https://en.wikipedia.org/wiki/Speed_networking)

- *Mechanic:* The tile assigns you a target team ("find the team with the yellow badge"), you
  interview them, log the answer, and receive a new target.
- *Physical:* Hunt down one named team, ask them the tile's question.
- *Form:* Hidden target id plus one free-text answer.
- *Scores:* At game end — the interviewed team answered the same question about themselves, so a
  match scores. No host needed.
- *Needs others:* Yes, exactly one per round, 5–10 rounds.
- *QR fit:* Strains. The hero text changes per submission, so the tile is stateful. Doable but it is
  the highest-effort item in this section.

**19. Pub-Quiz Cross-Marking** `ADAPTED` — *a scoring layer, not a game*
[quizquizquiz.com](https://quizquizquiz.com/2012/04/to-mark-or-not-to-mark/) ·
[pubquizinfo.org](https://www.pubquizinfo.org/)

- *Mechanic:* Standard pub etiquette is that tables swap sheets and mark each other. As a meta-tile:
  you are assigned another team's photo/text submissions to judge.
- *Physical:* You have to physically find that team to argue about a ruling.
- *Form:* Accept/reject radios over the assigned team's submissions.
- *Scores:* At game end.
- *Needs others:* Yes, one team.
- *QR fit:* Good — and worth building because it **unlocks every host-judged tile without a host**,
  which is the single biggest structural constraint on this party.

**20. Doppelgänger** `INVENTED`

- *Mechanic:* Teams answer ten quick-fire questions, then guess which *other* team's answer sheet is
  most similar to their own. The server computes the true nearest neighbour at game end.
- *Physical:* Forces teams to compare notes verbally with as many others as possible.
- *Form:* Ten short fields, then one `<select>` of team names.
- *Scores:* At game end, self-scoring. Bonus if the match is mutual.
- *Needs others:* Yes, all.
- *QR fit:* Very good. One form, zero props, no host.

**21. The Rumour Mill** `INVENTED`

- *Mechanic:* The QR gives you an absurd sentence you may transmit only verbally. You must get a
  *different* team to submit it, verbatim, on their own tile. Telephone as a scoring function.
- *Physical:* Whispering nonsense at strangers with conviction.
- *Form:* One text field: "a sentence someone told you".
- *Scores:* At game end. Both origin and repeater score, scaled by Levenshtein distance from the
  original.
- *Needs others:* Yes, and it cascades.
- *QR fit:* Excellent. One field, many submissions, purely self-scoring.

---

## 2. Drinking, without requiring drinking — the priority gap

Two design rules emerged from the sources and should be house rules on the dashboard:

- **The recipient always chooses.** In published "Do or Drink" rules, the person facing the forfeit
  picks drink *or* dare — the nominator never decides.
  ([officialgamerules.org](https://officialgamerules.org/game-rules/do-or-drink/))
- **State the opt-out up front, not on request.** Standard inclusive-play guidance is to announce
  that alcohol is optional and alternatives exist *before* play, so declining reads as normal rather
  than as abstaining. Verbatim phrasing worth stealing: *"any player can opt out of any drink at any
  time without explanation."*

Also worth noting: **most of the best "drinking games" are not about drinking.** In Kings, Ibble
Dibble, Cardinal Puff and Fuzzy Duck, the drink is a bolt-on and the mechanic is a ritual, a
tongue-twister or a photograph. Those survive the swap fully intact. Beer Pong, Flip Cup and Boat
Race do not — they reduce to volume and speed, and were rejected (see
[Rejected](#rejected-and-why)).

**22. The Deck of Consequences** `ADAPTED` from Kings / Ring of Fire
[Wikipedia](https://en.wikipedia.org/wiki/Kings_(card_game)) ·
[officialgamerules.org](https://officialgamerules.org/game-rules/ring-of-fire/)

- *Mechanic:* Each card value maps to an action — Jack: impose a rule on the whole house; 8: recruit
  another team as your permanent "Mate"; Queen: questions only; Ace: waterfall. The server deals one
  card per team, deterministic from the cookie so re-opening shows the same card.
- *Physical:* Perform the real Kings action on the actual party, not on a table.
- *Form:* One photo upload (proof) plus a short text field ("what you did / who your Mate is").
- *Scores:* Host-judged at game end; flat points for completing the card, bonus for the best Jack
  rule.
- *Needs others:* Yes, at least one other team.
- *Drink-optional:* Roughly 60% of the Kings deck is already pure social action. Cut the King's Cup
  card — it is the only one that is purely volume — and nothing is lost.
- *QR fit:* Perfect. Card as hero image, one form.

**23. Never Have I Ever — Rarity Edition** `ADAPTED`
[Wikipedia](https://en.wikipedia.org/wiki/Never_have_I_ever)

- *Mechanic:* Each team submits one "never have I ever…" that *they* have done, betting no other
  team has. Everyone else ticks the statements they've done.
- *Physical:* Argue with your partner about your most improbable true fact, then fish around the
  house to see whether anyone else has done it.
- *Form:* One text field (your statement) plus a checkbox list of everyone else's statements so far.
  Updatable until game end.
- *Scores:* At game end. Your statement scores the number of teams who did *not* tick it. Ticking
  honestly costs nothing — no penalty for having lived.
- *Needs others:* Only their data, not their presence.
- *Drink-optional:* Wikipedia documents a finger-counting variant with no drink at all. Here the
  tick replaces the drink entirely and *is* the scoring signal.
- *QR fit:* Excellent, and the canonical updatable-answer shape.

**24. The Nomination Engine** `ADAPTED` from Most Likely To
[gamerules.com](https://gamerules.com/rules/most-likely/) ·
[thedrinkinghub.org](https://www.thedrinkinghub.org/games/most-likely)

- *Mechanic:* Teams nominate other *teams* against absurd superlatives. The nominated team receives
  a "do or drink" they discharge whichever way they like.
- *Physical:* Nominate, then find the team you nominated and tell them to their face.
- *Form:* Three prompts, each a `<select>` of team names.
- *Scores:* At game end — points for nominating with the majority (you read the room correctly),
  plus a small self-reported point to the nominee for discharging the forfeit.
- *Needs others:* Yes, the whole field; needs ~8+ teams registered to mean anything.
- *Drink-optional:* This is the safest possible shape for "make someone else drink", because the
  chooser is always the recipient. Overlaps #11 — pick one.
- *QR fit:* Three selects, one POST.

**25. Ibble Dibble** `REAL` (British; the one from *The Crown*)
[huffingtonpost.co.uk](https://www.huffingtonpost.co.uk/entry/the-crown-ibble-dibble-how-to-play_uk_5fb264fbc5b6f79d60190825)
· [studentdrinkinggames.com](https://www.studentdrinkinggames.com/word/ibble-dibble.html)

- *Mechanic:* A verbal chain — "one ibble-dibble with no dibble-ibbles calling five ibble-dibble
  with four dibble-ibbles". Fluff the line, get a dot drawn on your face.
- *Physical:* Gather 3+ others around the eyeliner pencil taped next to the QR, play a round, get
  dotted.
- *Form:* One photo upload (dotted face) plus a number field (how many dots).
- *Scores:* Host-judged at end — points for fewest dots, plus a flat "you played" point.
- *Needs others:* Yes, four players minimum per the real rules, so two teams.
- *Drink-optional:* The dot *was always* the penalty; the drink is the bolt-on. Use eyeliner or
  lipstick instead of burnt cork — safer, no matches. Arguably better without alcohol, because the
  photo is the payoff.
- *QR fit:* Ideal. Best photo of the night.

**26. Cardinal Puff** `REAL` (British/military ritual)
[thechuggernauts.com](https://thechuggernauts.com/cardinal-puff-rules/) ·
[barnonedrinks.com](https://www.barnonedrinks.com/games/c/cardinal-of-puff-394.html)

- *Mechanic:* A precise, unexplained ritual — grip the glass with one finger, one sip, one knock,
  tap above and below the table, stand and sit; then repeat with two, then three. Any error means
  starting over. Nobody explains the rules; you must copy.
- *Physical:* Watch the hero diagram once, then perform the full three-round ritual in front of a
  witnessing team.
- *Form:* One photo upload (glass inverted over the head — the ritual's final "not a drop" move)
  plus a number field for attempts taken.
- *Scores:* Peer-verified/host-judged at end; fewer attempts scores more.
- *Needs others:* Yes, one witness team.
- *Drink-optional:* The three sips work with any liquid. "Finish it on the third sip, not a drop
  left" reads *better* with 20ml of squash.
- *QR fit:* Strong — a numbered MS Paint diagram is the perfect hero.

**27. Fuzzy Duck** `REAL` (British pub classic)
[Wikipedia](https://en.wikipedia.org/wiki/Fuzzy_duck) ·
[drinkinggames.co.uk](https://www.drinkinggames.co.uk/fuzzy-duck-drinking-game.php)

- *Mechanic:* The circle says "fuzzy duck"; "does he?" reverses direction and flips the phrase to
  "ducky fuzz". Mistakes are inevitable and obscene.
- *Physical:* Recruit a circle of four or more and run a round until someone produces the
  spoonerism.
- *Form:* Two text fields — exactly what the loser said, and who they were.
- *Scores:* Host-judged at end, for the funniest transcribed failure. Deliberately not about winning
  the round.
- *Needs others:* Yes, 4+ people.
- *Drink-optional:* The forfeit is the transcription and the public shame. The comedy is purely
  phonetic.
- *QR fit:* Good. A pure comedy-harvesting device — the host reads the best submissions at the end.

**28. Roxanne** `ADAPTED`
[drinkinggames.co.uk](https://www.drinkinggames.co.uk/roxanne-drinking-game.php) ·
[alcohol-stuff.co.uk](http://www.alcohol-stuff.co.uk/games/music/roxanne)

- *Mechanic:* Team A acts on every "Roxanne", team B on every "put on the red light". Sting says one
  of them 25 times in 3:12.
- *Physical:* One team squats on "Roxanne", the other star-jumps on "red light", for the whole song.
  Genuinely exhausting.
- *Form:* One number field — "how many times does Sting sing 'put on the red light'?" — submitted
  after surviving the song. Optional photo of the two collapsed teams.
- *Scores:* Instant; the server knows the answer. Closest guess scores, exact gets a bonus.
- *Needs others:* Yes, one other team; the game is inherently two-sided.
- *Drink-optional:* The cleanest swap on the list — sip becomes squat, one for one. The original
  joke is "the count is brutal", which a physical action preserves exactly.
- *QR fit:* Very good. Hero is an embedded audio player plus the two team assignments.

**29. The Triangle Test** `ADAPTED` from sensory science (Carlsberg, 1923)
[beerandbrewing.com](https://www.beerandbrewing.com/dictionary/W1py09rfO1) ·
[bjcp.org](https://www.bjcp.org/newsletter/triangle-tests-applying-common-sensory-panel-practices-for-the-homebrewer/)

- *Mechanic:* Three numbered cups; two identical, one different. Identify the odd one. This is the
  actual industry-standard discrimination test.
- *Physical:* Go to the kitchen table, sip cups 137, 482 and 906 in order, decide.
- *Form:* One radio group (137/482/906) plus an optional "describe the difference" field. Locked
  after submission.
- *Scores:* Instant. Baseline is 33%, so beating it is real. Three QRs gives you a curve.
- *Needs others:* No.
- *Drink-optional:* **The alcohol-free version is the scientifically standard one.** Coke vs Pepsi,
  two tonics, tap vs filtered water. Alcohol is not merely optional here, it is irrelevant.
- *QR fit:* Perfect. And the honest feedback message — *"you scored 33%, which is chance, which is
  nothing"* — is the funniest line available on the dashboard.

**30. Iron Bartender** `ADAPTED`
[diffordsguide.com](https://www.diffordsguide.com/encyclopedia/1671/competitions/cocktail-competition-rules)

- *Mechanic:* A mandatory mystery ingredient is announced; you build an original drink around it and
  name it. Judged on originality, name, presentation and palate — the real competition criteria.
- *Physical:* Build a drink from whatever is on the table plus the mystery ingredient (pickle brine,
  Marmite, a single Haribo).
- *Form:* Drink name, ingredients-and-method textarea, photo upload.
- *Scores:* Host-judged at end. Deadpan-absurd names should score highest.
- *Needs others:* No to make it; yes if you want anyone to taste it.
- *Drink-optional:* The real competition circuit has a full zero-proof category. Judged on
  invention, not consumption — nobody has to drink their own creation.
- *QR fit:* Strong. The photo gallery at the end is a highlight reel.

**31. Buzz / Fizz-Buzz** `REAL`
[Wikipedia](https://en.wikipedia.org/wiki/Fizz_buzz) ·
[classicgamesandpuzzles.com](https://www.classicgamesandpuzzles.com/Buzz-Fizz.html)

- *Mechanic:* Count up, replacing multiples of 3 with "fizz", 5 with "buzz", both with "fizzbuzz".
  Hesitate or err and you pay a forfeit.
- *Physical:* Two people alternate aloud, at speed, no writing, no phone. Then type what you managed.
- *Form:* One textarea — the sequence you actually said, comma-separated.
- *Scores:* Instant and fully server-verified: score the length of the correct prefix, first error
  truncates.
- *Needs others:* No. Good "we're alone in the corridor" filler.
- *Drink-optional:* Wikipedia frames the drink as one forfeit among several; here the forfeit is
  simply that your score stops.
- *QR fit:* Best-in-class. One textarea, deterministic scoring, no host — and a party game that is
  also a programmer job interview is exactly the requested tone.

**32. Play Your Cards Right** `ADAPTED`
[Wikipedia](https://en.wikipedia.org/wiki/Play_Your_Cards_Right) ·
[ukgameshows.com](https://www.ukgameshows.com/ukgs/Play_Your_Cards_Right)

- *Mechanic:* Higher or lower, five in a row. "You don't get anything for a pair in this game." The
  "cards" are real party statistics harvested at onboarding.
- *Physical:* Mostly on-phone, but interrogating other teams is the intended strategy since the deck
  is built from their answers.
- *Form:* Five Higher/Lower radio pairs. Updatable until game end.
- *Scores:* At game end once all onboarding data is in. Streak scoring — a wrong call ends the run.
- *Needs others:* Indirectly, yes.
- *Drink-optional:* No alcohol in the source at all; included for pub-TV texture. Recycles
  onboarding data for free.
- *QR fit:* Excellent.

**33. The Pub Throwing Station** `REAL` — vogelpik / around the clock / toad in the hole / shove ha'penny
[tradgames.org.uk](https://www.tradgames.org.uk/features/pub-games.htm) ·
[Wikipedia: toad in the hole](https://en.wikipedia.org/wiki/Toad_in_the_hole_(game)) ·
[Wikipedia: shove ha'penny](https://en.wikipedia.org/wiki/Shove_ha%27penny) ·
[belgiandarts.com](https://belgiandarts.com/)

- *Mechanic:* One physical station. Belgian *vogelpik* (velcro darts) played as Around the Clock —
  hit 1 through 20 in order — or coins pitched at a hole (2 points in, 1 on top).
- *Physical:* Throw things at a wall or a board. The only genuinely physical tile here.
- *Form:* One number field (score / how far up the clock) plus a photo of the board as evidence.
- *Scores:* Self-reported, host spot-checked, leaderboard resolved at end. The photo deters
  inflation.
- *Needs others:* No, but a queue forms naturally.
- *Drink-optional:* These are *pub games*, not drinking games — alcohol has never been part of the
  rules. This is the British/Belgian pub texture the brief asked for.
- *QR fit:* Good, but needs real kit: a velcro dartboard (~€15) or a shoebox with a hole and four
  coins (€0). Around the Clock is the right variant because it works when one partner is good and
  the other has never thrown.

---

## 3. Estimation, prediction and betting

**34. Wits & Wagers** `REAL` (North Star Games, Mensa Select)
[ultraboardgames.com](https://www.ultraboardgames.com/wits-and-wagers/game-rules.php) ·
[Wikipedia](https://en.wikipedia.org/wiki/Wits_and_Wagers)

- *Mechanic:* A numeric trivia question. Everyone submits a guess; then everyone *bets* on which
  team's guess is closest **without going over**. Judging people matters more than knowing facts.
- *Physical:* Between the phases you talk your own number up, or trash-talk the rivals'.
- *Form:* Tile A one number field; tile B a radio list of anonymised guesses plus a stake.
- *Scores:* At game end; long-shot outer guesses pay more.
- *Needs others:* Only their data, though the talking is the fun part.
- *QR fit:* Strains — genuinely needs two tiles, with the bet tile opening only after guesses close.
  That split does force a second lap of the house.

**35. Guess ⅔ of the Average** `REAL` (Keynesian beauty contest / p-beauty contest)
[Wikiversity](https://en.wikiversity.org/wiki/Economic_Classroom_Experiments/Guessing_Game) ·
[Chicago Booth Review](https://www.chicagobooth.edu/review/keyness-beauty-contest)

- *Mechanic:* Pick a number 0–100. Winner is closest to ⅔ of the mean of all teams' numbers. Pure
  recursive second-guessing; the clever answer is wrong if everyone is clever.
- *Physical:* Scan, type a number, agonise, lie to people about what you picked.
- *Form:* One integer field, updatable until close.
- *Scores:* At game end, automatic.
- *Needs others:* No, but they will talk and they will lie.
- *QR fit:* Ideal. Offer no explanation whatsoever — that is the tone.

**36. Galton's Ox / Guess the Weight** `REAL` (Galton, *Vox Populi*, 1907; British fete stall)
[Vox Populi (PDF)](https://www.simpsonswealth.co.uk/wp-content/uploads/2020/10/Research-Vox-populi-and-the-wisdom-of-crowds.pdf)
· [better-fundraising-ideas.com](https://www.better-fundraising-ideas.com/fete-games.html)

- *Mechanic:* A physical object sits in a room; guess its weight or the count of sweets. Galton's
  twist: reveal at the end that the *crowd mean* beat almost every individual.
- *Physical:* Walk to the object, pick it up, guess. QR on the jar.
- *Form:* One number field plus an optional confidence slider.
- *Scores:* Withhold to game end. Award "closest team" and a mock trophy to **The Crowd** if the
  mean wins.
- *Needs others:* No.
- *QR fit:* Perfect, and the cheapest tile on this list to build.

**37. Fermi Estimation** `REAL`
[fermi.org](https://fermi.org/) · [Wikipedia](https://en.wikipedia.org/wiki/Fermi_problem) ·
[eagroups.org](https://resources.eagroups.org/workshops-talks-ideas/fermi-estimation-competition)

- *Mechanic:* Absurd order-of-magnitude questions ("how many hairs are on the host's head?"), scored
  on *log error* — within a factor of 8 is a win.
- *Physical:* No lookups; questions answerable only by looking around the house.
- *Form:* A point estimate plus a lower and upper bound (the calibration variant).
- *Scores:* At game end, |log10(guess/truth)|, with a calibration bonus if the truth falls inside
  your stated interval.
- *Needs others:* No.
- *QR fit:* Perfect, and the three-field interval version is the most interesting form on the whole
  dashboard.

**38. One Bid** `REAL` (The Price Is Right, Contestants' Row)
[priceisright.fandom.com](https://priceisright.fandom.com/wiki/One_Bid)

- *Mechanic:* Closest **without going over**, and **no duplicate bids allowed**. Over = instantly
  dead; exactly right pays a bonus.
- *Physical:* Price a genuinely-priced object in the house, with the receipt sellotaped face-down
  underneath it.
- *Form:* One integer field; the server rejects a value another team already took — *"Taken. Try
  again."*
- *Scores:* At game end, automatic.
- *Needs others:* No.
- *QR fit:* Perfect, and the duplicate-rejection message is free comedy.

**39. The Joker** `REAL` pub-quiz mechanic
[quizquizquiz.com](https://quizquizquiz.com/2012/11/jokers-in-quiz-nights/) ·
[Wikipedia: pub quiz](https://en.wikipedia.org/wiki/Pub_quiz)

- *Mechanic:* Each team may play one Joker on exactly one other tile, doubling its points. Must be
  declared *before* seeing that tile's result.
- *Physical:* Find the Joker QR, hidden somewhere annoying — behind the boiler.
- *Form:* A dropdown of the tiles you have already unlocked, plus a confirm checkbox. One shot, not
  updatable.
- *Scores:* Multiplier applied at game end.
- *Needs others:* No.
- *QR fit:* Excellent. A meta-tile that makes every *other* tile more tense at zero content cost —
  the highest-leverage item in the whole menu.

**40. High Offer / Low Offer** `ADAPTED` (The Chase)
[gameshows.com](https://www.gameshows.com/the-chase/how-to-play)

- *Mechanic:* Before seeing the question, pick your tier: Low (easy, few points, possibly negative),
  Middle, or High (brutal, big points).
- *Physical:* Scan, choose, then the question is revealed at that tier.
- *Form:* A radio, then a single answer field — two POSTs on one tile.
- *Scores:* Instant self-scoring, banked to the end.
- *Needs others:* No.
- *QR fit:* Slight strain (form → form), but that is not realtime, so it's acceptable.

**41. Split or Steal** `REAL` (Golden Balls)
[Wikipedia](https://en.wikipedia.org/wiki/Golden_Balls) ·
[Cornell INFO2040](https://blogs.cornell.edu/info2040/2022/10/03/exploiting-the-prisoners-dilemma-in-the-game-show-golden-balls/)

- *Mechanic:* A pot of points between two teams. Both Split → 50/50. One Steals → takes all. Both
  Steal → both get nothing.
- *Physical:* Find another team, both enter each other's code, then walk away and choose separately.
- *Form:* Text field for the other team's code plus a SPLIT/STEAL radio. Locked once submitted.
- *Scores:* At game end when both halves are in.
- *Needs others:* Yes, exactly one team.
- *QR fit:* Good. The most socially explosive item in the menu and the one most likely to produce a
  story people repeat.

**42. Prediction Bingo** `REAL` (wedding-reception genre)
[bingocardcreator.com](https://www.bingocardcreator.com/blog/50-wedding-activities-and-games-to-keep-your-guests-entertained/)

- *Mechanic:* A card of predictions about *tonight* — "first to spill a drink", "first to mention
  work", "first to fall asleep". Each square names a guest.
- *Physical:* Scan once at 20:15, then spend the night quietly hoping your victim humiliates
  themselves.
- *Form:* 8–12 dropdowns of guest names. Updatable until ~22:00, then locked.
- *Scores:* Host-judged at game end. The one tile that genuinely needs a human adjudicator at 00:45.
- *Needs others:* No interaction, but it makes teams *watch* everyone all night.
- *QR fit:* Fine — a big form, but still one POST.

**43. The Sweepstake** `REAL` (Grand National office pool)
[grandnational.org.uk](https://www.grandnational.org.uk/grand-national-sweepstake.php)

- *Mechanic:* Pure luck. Scan and you are randomly assigned a guest — your "horse". If your horse
  wins some end-of-night superlative, you take the pot. Zero skill, maximum indignation.
- *Physical:* Scan; receive a name; you are now stuck with them.
- *Form:* A single DRAW button. No fields. No takebacks.
- *Scores:* At game end — the winning horse can be resolved by any criterion, e.g. who held Teddy
  longest.
- *Needs others:* No.
- *QR fit:* The purest one-form tile here: the form has no fields.

**44. Party Prediction Market** `ADAPTED` (Manifold-style play money)
[manifold.markets](https://manifold.markets/about)

- *Mechanic:* Yes/no propositions about the night ("someone will break a glass before midnight").
  Teams stake fake currency; the tile shows the crowd probability, which moves as teams bet.
- *Physical:* One market QR per room. Revisiting a room to re-bet is the wandering driver.
- *Form:* YES/NO radio plus a stake field. Multiple submissions, each a separate bet.
- *Scores:* At game end when the host resolves each market; payout proportional to stake and to the
  odds *at the time you bet*.
- *Needs others:* No.
- *QR fit:* Good — a hideous MS Paint probability bar that updates on page load. A refresh is the
  realtime.

---

## 4. Photo games

**45. Photo Scavenger Hunt** `REAL` (published wedding genre)
[weddingqr.codes](https://weddingqr.codes/blog/wedding-photo-scavenger-hunt-ideas-for-guests) ·
[scavenger-hunt.org](https://scavenger-hunt.org/blog/wedding-photo-scavenger-hunt/)

- *Mechanic:* A fixed prompt list ("someone dancing", "the oldest guest", "a reflection"). Published
  sweet spot is 12–18 prompts for about an hour.
- *Physical:* Roam, hunt subjects, ambush guests, shoot.
- *Form:* `select` (prompt) plus `file`. Many submissions all night.
- *Scores:* 1 pt per unique prompt, automatic (server dedupes on prompt id), plus a host-judged best
  of each prompt at the end.
- *Needs others:* Yes for roughly half the prompts.
- *QR fit:* Perfect. The canonical repeat-POST shape. Note this subsumes the host's existing "take a
  picture of someone drinking or eating".

**46. Photo Bingo** `REAL`
[bingobaker.com](https://bingobaker.com/view/1631180) ·
[playpartyplan.com](https://www.playpartyplan.com/picture-bingo/)

- *Mechanic:* A grid of photo tasks (bird's-eye view, a reflection, something that grows). Winning
  is a *line*, not the whole card — so teams chase geometry, not volume.
- *Physical:* Same as #45 but with a visible grid driving the route.
- *Form:* `select` (cell) plus `file`.
- *Scores:* Instant — the server marks the cell and detects lines. First line / double / full house.
  Ties break on timestamp.
- *Needs others:* Optional, depends on the cells.
- *QR fit:* Excellent. The grid *is* the tile hero.

**47. Extreme Close-Up Picture Quiz** `REAL` quiz-round format, shot in this house
[quiztriviagames.com](https://www.quiztriviagames.com/close-up-picture-quiz/)

- *Mechanic:* 15 pre-shot macro photos of objects in *this* house. Identify the object and the room.
- *Physical:* Wander comparing textures to the screen, into corners nobody would otherwise look.
- *Form:* 15 text fields plus 15 room selects. One updatable answer.
- *Scores:* Self-scoring; hide the result until game end so nothing leaks between teams.
- *Needs others:* No. The best pure-solo tile found.
- *QR fit:* Perfect. Static hero grid, one long form, zero moving parts.

**48. Recreate the Photo** `ADAPTED` ("I'm Just a Kid" challenge)
[grapevinequest.com](https://grapevinequest.com/capture-the-fun-25-creative-photo-scavenger-hunt-ideas-for-all-ages/)

- *Mechanic:* The tile hero is a photo already hanging on the host's wall, or a host baby photo.
  Reproduce it: pose, framing, props, crop.
- *Physical:* Find the original in the house, then stage it — dragging furniture, borrowing lamps,
  recruiting stand-ins.
- *Form:* One upload, plus optional text for what they substituted for the missing prop.
- *Scores:* Host-judged at end. Render side-by-side diptychs — judging becomes trivial and the
  reveal is the funniest slide of the night.
- *Needs others:* Sometimes — if the original has four people in it, they must recruit. A good
  forced-mingle lever.
- *QR fit:* Perfect. The hero image *is* the brief.

**49. Portrait of a Stranger** `ADAPTED` from Humans of New York
[Wikipedia](https://en.wikipedia.org/wiki/Humans_of_New_York) ·
[brandonstanton.com](https://brandonstanton.com/humans-of-new-york)

- *Mechanic:* HONY is a portrait plus one quote. Here: photograph a team you haven't yet
  photographed and submit one sentence they actually said tonight.
- *Physical:* Approach an unfamiliar pair, ask a real question, take a real portrait.
- *Form:* `file` plus quote text plus a `select` of team names.
- *Scores:* 1 pt per **distinct** team portrayed — self-scoring, instant, dedupe on team id. Bonus
  at end for the best quote.
- *Needs others:* Yes, and specifically ones you don't know. The strongest social-mixer photo tile.
- *QR fit:* Excellent. The team dropdown is the only place needing a roster.

**50. Write the Museum Label** `REAL` museum-education activity
[huntington.org](https://www.huntington.org/activity-write-museum-label-0) ·
[museumnext.com](https://www.museumnext.com/article/what-makes-a-great-museum-label/)

- *Mechanic:* The real exercise answers two questions in very few words: "what am I looking at?" and
  "why should I care?" Here, a numbered card sits beside a mundane object (the bread bin, a dead
  houseplant) and the team writes its wall plaque.
- *Physical:* Roam to numbered objects around the house.
- *Form:* Title (40 chars), label (60 words), optional fictional date and provenance.
- *Scores:* At game end, all teams' plaques for the same object shown side by side and voted on.
- *Needs others:* No, until voting.
- *QR fit:* Perfect, and the tone lands exactly here. **Also funny to lose** — award the worst plaque
  a plaque of its own.

---

## 5. Rewarding wandering the house

**51. Hunt the Thimble / Hot & Cold** `ADAPTED` (Victorian parlour game)
[Wikipedia](https://en.wikipedia.org/wiki/Hunt_the_Thimble) ·
[thegamegal.com](https://www.thegamegal.com/2012/03/31/hot-or-cold/)

- *Mechanic:* One small object hidden in plain sight; seekers are steered by "warmer/colder". There
  is no facilitator here — **the server is the oracle.**
- *Physical:* The team physically walks the house; each guess narrows the space.
- *Form:* Room `select` plus a text field for the specific spot ("inside the piano"). Repeatable.
- *Scores:* Instant — the server replies FREEZING / COLD / WARM / BOILING. Descending ladder: 20 pts
  in ≤3 guesses, 15 in ≤6, 10 in ≤10, 5 ever.
- *Needs others:* No.
- *QR fit:* Ideal — the form's *response* is the game. The one tile with a genuine feedback loop and
  no realtime requirement.

**52. Score-O** `REAL` (score-format orienteering)
[learnorienteering.com](https://www.learnorienteering.com/Basics.html)

- *Mechanic:* Controls visited in **any order**, each worth points scaled to difficulty and
  distance, inside a hard time limit, with a **penalty for finishing late**.
- *Physical:* Ten hidden control markers around the house. Route planning under a clock — teams must
  decide whether to abandon the attic control at 00:50.
- *Form:* One text field for the control's 2-letter code, submitted repeatedly.
- *Scores:* Instant, plus a *negative* penalty per minute past the cut-off. The late penalty is the
  whole design; without it there is no decision to make.
- *Needs others:* No.
- *QR fit:* Excellent, and pairs naturally with Home Assistant — scanning the attic control fires a
  light.

**53. Letterboxing** `REAL` (Dartmoor, 1854)
[Wikipedia](https://en.wikipedia.org/wiki/Letterboxing_(hobby)) ·
[letterboxing.org](https://www.letterboxing.org/faq/faq.html) ·
[atlasquest.com](https://www.atlasquest.com/about/getting-started/)

- *Mechanic:* Two things separate it from geocaching: each box holds a **unique stamp** you copy,
  and each finder leaves a **personal signature and trail name** in the box's logbook. Clues are
  cryptic directions, not coordinates.
- *Physical:* Solve a cryptic clue ("where the house breathes out" = extractor fan), find the box,
  find the stamp.
- *Form:* The secret word printed at that location, plus your team's trail name / log message.
- *Scores:* Instant on the secret word; bonus for a full set.
- *Needs others:* No.
- *QR fit:* Perfect — and the public logbook of trail names is pure geocities guestbook energy,
  giving the tile a reason to be revisited. To differentiate from the host's existing riddle hunt,
  make these **unclued**: no map, no riddle, just "there are 11 of them, good luck".

**54. Cipher Hunt** `ADAPTED` (Alex Hirsch's Gravity Falls ARG, 2016)
[Wikipedia](https://en.wikipedia.org/wiki/Cipher_Hunt) ·
[argn.com](https://www.argn.com/2024/08/gravity_falls_and_a_decade_long_education_in_bill_ciphering/)

- *Mechanic:* A chain — each decoded clue names the next physical location, which holds the next
  clue. Hirsch's opening move was a Caesar shift of 3. Escape-room theory calls this a *linear
  path*: tight pacing, easy to read.
- *Physical:* Decode at one spot, walk to the next, repeat. Five to seven links.
- *Form:* One text field for the plaintext of the current link; a correct answer reveals the next
  hero text on the same tile.
- *Scores:* Instant, by depth reached, with a completion bonus. Timestamp breaks ties.
- *Needs others:* No.
- *QR fit:* Strains slightly — the tile needs stateful hero text. Keep it short: the real Cipher
  Hunt took two weeks and thousands of people.

**55. Munzee** `REAL` (QR-code geocaching, since 2011)
[Wikipedia](https://en.wikipedia.org/wiki/Munzee) ·
[Munzee guide (PDF)](https://assets.cuppazee.com/static/Guide%20to%20Munzee%20January%202025.pdf)

- *Mechanic:* A Munzee is a registered QR sticker in the real world and **the scan itself is the
  proof of find** — no logbook, no photo. Different code types are worth different points.
- *Physical:* Hunt physical QR stickers hidden in odd places. This is literally the party's core
  loop, which is the argument for making it a *game* rather than just plumbing.
- *Form:* None — the scan is the submission.
- *Scores:* Instant, with per-code values by difficulty (fridge back = 5, behind the boiler = 50).
- *Needs others:* No.
- *QR fit:* It *is* the QR shape. The only strain is that a zero-field tile breaks the
  one-form-per-tile rule; give it a dummy "sign the log" field, i.e. build it as #53.

---

## 6. All-night long games, resolved at the end

These are the highest-value shapes for a 20:00–01:00 party: they run in the background for five
hours, need no facilitator, and produce the end-of-night reveal.

**56. Assassin / Killer** `REAL` (campus game; published by Steve Jackson Games as *Killer*)
[Wikipedia](https://en.wikipedia.org/wiki/Assassin_(game)) ·
[funny-party-games.com](https://www.funny-party-games.com/en/games/killer-game-rules-and-mission-ideas/)

- *Mechanic:* Every team has a secret target and is someone's unknown target. Kills use an agreed
  harmless method — get them to say a trigger word, accept an object, hold your drink. On success
  you inherit your victim's target. Designed to induce low-grade paranoia across a whole event.
- *Physical:* Sustained social manipulation for five hours. The strongest anti-clique mechanic found
  anywhere in this research.
- *Form:* Who you killed, plus the victim's secret word as proof of contact, plus optional photo.
  Repeatable.
- *Scores:* Instant and self-scoring — the server knows each team's word, so no host is needed.
  Chain resolves at 01:00: last team standing plus most kills.
- *Needs others:* Yes, one specific team at a time, cascading across all 10–15.
- *QR fit:* Very good, and it genuinely uses the hero-plus-form shape — **the hero is the secret
  briefing**, rendered per team. Two caveats: the tile is stateful, and the victim has no way to
  dispute without a form of their own. Bedroom = permanent safe zone.

**57. Wink Murder, async** `ADAPTED`
[Wikipedia](https://en.wikipedia.org/wiki/Wink_murder) ·
[icebreakers.ws](https://icebreakers.ws/medium-group/wink-murder.html)

- *Mechanic:* One secret murderer kills by winking; victims must wait before "dying". Everyone else
  hunts the winker. The roaming variant needs no circle and no moderator.
- *Physical:* Winked-at teams log their own death five minutes later; everyone else accuses.
- *Form:* One `<select>` to accuse a team, updatable until 01:00, plus a button for victims: "I have
  been winked".
- *Scores:* At game end. Correct accusers score; the murderer scores per kill. Because accusations
  are updatable, late evidence still matters.
- *Needs others:* Yes, everyone. Scales fine to 15 teams.
- *QR fit:* Good. The delay before dying is exactly what protects the murderer without any realtime
  system — this is the moderator-free substitute for Mafia.

**58. Don't Say ___ (clothespins)** `REAL` (baby-shower standard; also Kings' "Jack = make a rule")
[gamerules.com](https://gamerules.com/rules/dont-say-baby/) ·
[thegamegal.com](https://www.thegamegal.com/2011/04/30/clothespins-party-game/)

- *Mechanic:* Everyone wears 5 clothespins. Say the taboo word and whoever catches you takes one.
  **Once you are at zero you may say it freely** — that rule is what keeps the game alive at hour
  four. Most pins at the end wins.
- *Physical:* Real clothespins on clothing, physically transferred. The only tile with a real-world
  token, which matters late at night.
- *Form:* Current pin count plus which team you took it from. Many submissions.
- *Scores:* Instant self-scoring against a server tally, capped by pins physically held; host
  adjudicates disputes from the log at the end.
- *Needs others:* Yes, everyone, passively, with zero coordination cost.
- *Drink-optional:* There is no drink in the original at all — it is already a token game. This is
  the purest form of "drinking-game energy, no drink". Good words for this party: the host's name,
  "birthday", "QR code".
- *QR fit:* Excellent. Unlock it early; it is the cheapest five-hour engine available.

**59. The Game** `REAL` (the mind game; first documented 2002)
[Wikipedia](https://en.wikipedia.org/wiki/The_Game_(mind_game)) ·
[ilostthegame.org](https://ilostthegame.org/rules)

- *Mechanic:* Three rules — everyone is playing, you lose by thinking about it, and when you lose
  you must announce it, which makes listeners lose too. Unwinnable by design.
- *Physical:* Scanning the QR makes you lose immediately. Then you go make other people lose.
- *Form:* The team you infected plus their secret word.
- *Scores:* Instant, 1 pt per infection; resolves at 01:00 as a contagion graph.
- *Needs others:* Yes, unlimited, viral.
- *QR fit:* Ideal — a one-field tile with no end state. **Funny to lose: losing is the entire
  premise.** Pair with Home Assistant so every scan dims the whole house for one second.

**60. Travel Bug / Trackables** `REAL` (geocaching)
[Wikipedia](https://en.wikipedia.org/wiki/Trackable_(Geocaching)) ·
[geocaching.com](https://www.geocaching.com/track/travelbugfaq.aspx)

- *Mechanic:* A physical tagged item with a unique code and a **goal set by its owner**. Each holder
  logs it, then passes it onward toward the goal; movement is publicly traceable.
- *Physical:* Five absurd objects circulate — a garden gnome, a single oven glove — each with a
  mission: "I want to be photographed in every room", "I want to reach the highest shelf".
- *Form:* Tracking code, room `select`, photo of it there.
- *Scores:* Points for advancing an object's goal; a large end-of-night bonus to every team that
  touched an object which actually *completed* its mission.
- *Needs others:* Indirectly yes — the objects must keep moving.
- *QR fit:* Excellent, and it creates physical drift across the house with no coordination. Tape the
  QR to the object.

**61. The Cursed Owl** `ADAPTED` from Hot Potato + White Elephant
[Wikipedia: hot potato](https://en.wikipedia.org/wiki/Hot_potato) ·
[whiteelephantrules.com](https://www.whiteelephantrules.com/)

- *Mechanic:* One hideous object circulates by gift or theft all night. Whoever is logged as holder
  at 01:00 takes the booby prize.
- *Physical:* Foisting a ceramic owl onto another team, ideally without them noticing.
- *Form:* `select` (team you passed it to) plus a photo of the handover as proof. Repeatable.
- *Scores:* Resolved at 01:00 from the last valid log. No points — only shame.
- *Needs others:* Yes, two per pass.
- *QR fit:* Perfect (QR taped to the owl), but needs an anti-abuse rule: a pass is valid only if the
  receiving team also scans, and — borrowing White Elephant's steal cap — no team may receive it
  twice in a row. **This is the direct sibling of the host's existing Teddy idea; run one, not both.**

**62. The Wooden Spoon** `REAL` (Cambridge Mathematical Tripos, 1753–1909)
[Wikipedia: wooden spoon](https://en.wikipedia.org/wiki/Wooden_spoon_(award)) ·
[Wikipedia: booby prize](https://en.wikipedia.org/wiki/Booby_prize)

- *Mechanic:* A ceremonial award for coming **dead last**. Historically a five-foot spoon dangled
  mockingly from the balcony.
- *Physical:* The losing team retrieves an actual comically large wooden spoon at 01:00 and carries
  it for the rest of the night.
- *Form:* None, or one optional tile: "predict who gets the Wooden Spoon".
- *Scores:* Computed from the bottom of the leaderboard.
- *Needs others:* No.
- *QR fit:* A meta-tile needing no form. Its real function is making the *bottom* of the leaderboard
  a contested position — teams will start tanking deliberately, which is the funniest available
  outcome and worth engineering for.

### Funny to lose — the shortlist

#59 The Game (losing is the only outcome) · #61 whoever holds the owl at 01:00 · #58 the team that
hits zero clothespins first · #50 the worst museum plaque · #29 the Triangle Test's *"you scored
33%, which is chance, which is nothing"* · #38 One Bid's instant death on going over · #62 the
Wooden Spoon itself.

---

## Reusable engines

Several candidates collapse onto the same server-side pattern. Building three engines yields well
over half this menu.

| Engine | Shape | Feeds |
| --- | --- | --- |
| **Prompt → collect → reveal → vote** | Two tiles hours apart; second shows all submissions shuffled | #3, #4, #5, #14, #15, #50 |
| **Collect → compare strings at game end** | One field, normalise, cluster or dedupe | #7, #8, #9, #10, #35 |
| **Code capture** | One text field, server knows the valid codes, many submissions | #1, #17, #52, #53, #55, #56, #58, #59 |
| **Photo + tag** | `file` + one `select` + optional caption | #2, #45, #46, #48, #49, #60, #61 |
| **Numeric truth** | One number, server knows the answer, scored by distance | #28, #36, #37, #38, #34 |
| **Per-team secret hero** | Tile renders differently per cookie | #6, #22, #43, #56 |

The one genuinely new capability worth calling out: **#19 Pub-Quiz Cross-Marking removes the need
for a host-judged tile to actually have a host.** Any tile marked "host-judged" above could instead
be peer-judged. Given there is one host and fifteen teams across five hours, that is probably the
most valuable single item in this document.

---

## Overlaps with the existing idea list

- **"How many others share your favourite colour"** is Herd Mentality (#9) with one question.
  Consider replacing it with four Herd tiles plus one Scattergories tile (#8), so the
  herd/anti-herd inversion becomes a running joke.
- **"Closest to the average height"** and **"longest yarn"** are both Galton-family estimation. #36
  (external truth), #35 (recursive) and #37 (order-of-magnitude) are three genuinely different
  flavours — pick one or two, not all three, or the night gets samey.
- **"Whoever holds Teddy at the end"** is hot potato / pass the parcel (#61). Do not add a second
  token-passing game. Better: let Teddy be the *resolution criterion* for the Sweepstake (#43) or a
  prediction market proposition (#44).
- **"Take a picture of someone drinking or eating"** is one prompt inside Photo Scavenger Hunt
  (#45). Keep the photo pipeline, expand the prompt list. Dixit-style captioning and #49 Portrait of
  a Stranger reuse the same upload path with different *subjects* — objects vs strangers vs induced
  behaviour — so that's reuse, not duplication.
- **Riddle treasure hunt** overlaps Letterboxing (#53) and Cipher Hunt (#54). Differentiate by
  making letterboxes *unclued* and the cipher chain *linear*.
- **Smart-light treasure hunt** pairs naturally with Score-O (#52) — controls that fire Home
  Assistant on scan — and with The Game (#59), where every loss dims the house for a second.

---

## Rejected, and why

| Candidate | Source | Why not |
| --- | --- | --- |
| Beer Pong, Flip Cup, Boat Race | [WSOBP rules](https://bpong.com/wsobp/official-rules-of-the-world-series-of-beer-pong/) | Reduce to volume and speed of consumption. The water-pong swap is real, but they need a dedicated table, a referee and simultaneous opponents — breaks free-roaming, no-facilitator |
| Kings' King's Cup card | [Kings](https://en.wikipedia.org/wiki/Kings_(card_game)) | The one card in the deck that is pure volume. Cut it, keep the rest |
| Paranoia, Medusa | — | Require a seated circle with simultaneous participation |
| Do You Love Your Neighbour | [playmeo.com](https://www.playmeo.com/activities/fun-large-group-games/do-you-love-your-neighbours/) | Needs a seated circle and a caller |
| Werewords, One Night Ultimate Werewolf | [werewords.com](https://werewords.com/rules.php?ver=3) | Advertised as moderator-free but needs simultaneous co-located play and a timer. No async path |
| Mafia proper | [Wikipedia](https://en.wikipedia.org/wiki/Mafia_(party_game)) | Needs a moderator and day/night phases. #57 Wink Murder is the moderator-free substitute |
| Wavelength as published | [Wikipedia](https://en.wikipedia.org/wiki/Wavelength_(game)) | Needs a live psychic at the dial. Only the async adaptation (#16) survives |
| Sardines | [Britannica](https://www.britannica.com/topic/sardines-game) | Brilliant house game, but with the bedroom off limits the hiding spots run out, and it cannot produce a form submission |
| Guess the Baby Photo | [tulamama.com](https://tulamama.com/guess-baby-picture-game/) | Resolves cleanly at game end, but needs photos collected from guests *before* the party |
| Geocaching proper | [geocaching.com](https://www.geocaching.com/play/guidelines) | Same shape as Letterboxing (#53) and Munzee (#55). Redundant |
| Polaroid guest book | [theknot.com](https://www.theknot.com/content/polaroid-wedding-guest-book) | A tradition, not a game. Folds into #45 as a prompt |

---

## Method

Four parallel searches, one per slice: cross-team talking mechanics, drinking-optional games,
prediction/betting/estimation, and photo/roaming/all-night formats. Sources were pushed toward
first-party rules where they exist (Hasbro instruction sheets, Repos Production, Big Potato, Drumond
Park, the World Series of Beer Pong rulebook, the Munzee guide, letterboxing.org, learnorienteering.com,
Galton's original *Vox Populi*) and Wikipedia or established genre references where a game has no
single owner. Every candidate above carries a link; anything with no defensible source is marked
`INVENTED`.

Not decided here: the roster, the points economy, the QR-to-tile mapping, or which of the overlapping
pairs survives. Those belong to the roster-lock.
