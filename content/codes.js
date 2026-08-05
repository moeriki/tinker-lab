// The QR inventory: slug -> target. This file is the ONLY source of truth for which codes exist.
// It is content-as-code (ADR-0001): version-controlled, never in the database, and the printer
// reads exactly this file (`node scripts/qr-sheet.js`). See ADR-0010.
//
// Slugs are opaque random strings, but NOT secret: teams shouting hiding places at each other is
// the goal. They are minted once and then frozen -- a slug that has been printed never changes,
// which is what makes a single lost card reprintable on its own
// (`node scripts/qr-sheet.js --only=k7rbt9`) without regenerating the other eighteen.
//
//   'k7f2qx': { game: 'yarn' }              unlock this game and open it
//   'm3p8zz': { game: 'lights', step: 1 }   a hunt step, 1-based
//   'b4xk7m': { page: 'rickroll' }          a pure gag: no game, no points
//
// Every hunt step must have exactly one slug or content validation fails at boot.
//
// Three fields exist for humans rather than for the app:
//
//   label    what to call this code out loud. Printed on the HOST KEY sheet only, never on the
//            card a guest finds -- a rickroll that announces itself isn't a rickroll.
//   where    the intended hiding place, or `null` while the hiding plan is unsettled.
//   pending  the target's content is not authored yet, and this is a deliberate hole rather than
//            a typo. Boot warns instead of failing; `scripts/qr-sheet.js` REFUSES TO PRINT while
//            any pending flag survives. Delete the flag in the same commit that lands the game.
//
// Order matters: the position in this file is the card number (#01..#19) on the printed sheet and
// on the host key. Insert new codes at the end, never in the middle, or every number shifts.

export default {
  // --- Lights hunt (3 steps) -- #01..#03 --------------------------------------------------------
  k7rbt9: { game: 'lights', step: 1, label: 'Lights hunt, step 1', where: null, pending: true },
  nx9ufv: { game: 'lights', step: 2, label: 'Lights hunt, step 2', where: null, pending: true },
  pknn8v: { game: 'lights', step: 3, label: 'Lights hunt, step 3', where: null, pending: true },

  // --- Riddle hunt (3 steps) -- #04..#06 --------------------------------------------------------
  '5sjjsh': { game: 'riddle', step: 1, label: 'Riddle hunt, step 1', where: null, pending: true },
  eh8tgu: { game: 'riddle', step: 2, label: 'Riddle hunt, step 2', where: null, pending: true },
  w5q2tc: { game: 'riddle', step: 3, label: 'Riddle hunt, step 3', where: null, pending: true },

  // --- Roaming tiles, two slugs each so a tile is findable from more than one room -- #07..#14 ---
  // A slug is not consumed when it is scanned; every team can scan the same one. Two slugs buy
  // findability across rooms, not capacity.
  c4jm8x: { game: 'guess-who', label: 'Guess Who (a)', where: null },
  awyuv2: { game: 'guess-who', label: 'Guess Who (b)', where: null },
  bgue88: { game: 'herd', label: 'Herd Mentality (a)', where: null, pending: true },
  '46ezp7': { game: 'herd', label: 'Herd Mentality (b)', where: null, pending: true },
  '38bpnu': { game: 'scavenger', label: 'Photo scavenger (a)', where: null },
  pydzrd: { game: 'scavenger', label: 'Photo scavenger (b)', where: null },
  zfu45r: { game: 'portrait', label: 'Portrait of a stranger (a)', where: null },
  '2mu2xg': { game: 'portrait', label: 'Portrait of a stranger (b)', where: null },

  // --- Fixed-location tiles -- #15..#16 ---------------------------------------------------------
  // These two placements are settled by the roster (#7) rather than by the hiding plan.
  bbdcbz: {
    game: 'triangle',
    label: 'Triangle Test',
    where: 'On the Triangle Test station, beside the three numbered jugs.',
    pending: true,
  },
  '6cd3rd': {
    game: 'teddy',
    label: 'Teddy',
    where: "On Teddy's timer lockbox -- deliberately the most visible object in the house.",
  },

  // --- Gags: no game, no points -- #17..#19 -----------------------------------------------------
  // Their cards carry no label for the same reason the punchline isn't in the setup.
  f7ge9z: { page: 'rickroll', label: 'GAG: rickroll', where: null },
  q6dd59: { page: 'motivation', label: 'GAG: motivational message', where: null },
  kyw3bx: {
    page: 'hidden',
    label: 'GAG: the hidden page',
    // Not a free placement. The page tells its finder it was "hidden properly" and names how many
    // teams got there first, so this card has to earn that: the hardest spot in the house, and
    // deliberately harder than the other two gags. Settled in #28 -- if it ends up somewhere
    // obvious, the copy is a lie and the counter is pointless.
    where: 'THE HARDEST SPOT IN THE HOUSE. Not yet chosen -- see the hiding plan.',
  },

  // Human Bingo and Longest yarn deliberately have no code: both are starter tiles, unlocked for
  // every team at onboarding. `too-soon` and `no-such-code` are pages the app renders directly and
  // are not scannable, so they are not codes either.
};
