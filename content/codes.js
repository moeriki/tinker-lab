// The QR inventory: slug -> target. This file is the ONLY source of truth for which codes exist.
// It is content-as-code (ADR-game-content-lives-on-disk): version-controlled, never in the
// database, and the printer reads exactly this file (`node scripts/qr-sheet.js`). See
// ADR-codes-are-printed-from-the-inventory.
//
// Slugs are opaque random strings, but NOT secret: teams shouting hiding places at each other is
// the goal. They are minted once and then frozen -- a slug that has been printed never changes,
// which is what makes a single lost card reprintable on its own
// (`node scripts/qr-sheet.js --only=k7rbt9`) without regenerating the other twenty-one.
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
// Order matters: the position in this file is the card number (#01..#22) on the printed sheet and
// on the host key. Insert new codes at the end, never in the middle, or every number shifts.

export default {
  // --- Lights hunt (4 steps) -- #01..#03, then #22 ----------------------------------------------
  // A CHAIN, NOT A SET. Each card sits on the fixture the PREVIOUS card lit up, so these
  // placements are fixed by the design (#18) and are not part of the free hiding plan. Only card
  // #01 is a free choice, and it is the only one a team can find without having found another.
  //
  // Step 4 was minted after this block was written and sits at the bottom of the file with the
  // card number that goes with it, for the same reason the riddle hunt's last two steps do:
  // position in this file IS the card number and #34's test print already fixed them. On the host
  // key sheet, read #01, #02, #03, then jump to #22.
  k7rbt9: {
    game: 'lights',
    step: 1,
    label: 'Lights hunt, step 1',
    where:
      'FREE PLACEMENT -- the only card in this hunt that is. Anywhere a team can stumble on it ' +
      'cold, and NOT in the kitchen: the kitchen is where the hunt ends, and a team that starts ' +
      'there has the last room spoiled. Scanning it turns Liane 5 cyan for five seconds.',
  },
  nx9ufv: {
    game: 'lights',
    step: 2,
    label: 'Lights hunt, step 2',
    where: 'ON LIANE 5 -- the fixture card #01 turns cyan. Fixed by the chain, not a free choice.',
  },
  pknn8v: {
    game: 'lights',
    step: 3,
    label: 'Lights hunt, step 3',
    where: 'ON FUGATO -- the fixture card #02 turns magenta. Fixed by the chain.',
  },

  // --- Riddle hunt (5 steps) -- #04..#06, then #20..#21 -----------------------------------------
  // Five cards, four riddles: each card's hero says where the next one is, and the fifth is the
  // end. Steps 4 and 5 were minted after this block was written, so they sit at the bottom of the
  // file with the card numbers that go with it -- inserting them here would renumber every card
  // from #07 down. On the host key sheet, read #04, #05, #06, then jump to #20 and #21. See #27.
  '5sjjsh': {
    game: 'riddle',
    step: 1,
    label: 'Riddle hunt, step 1 (THE ONLY UNHIDDEN CARD)',
    where:
      'IN PLAIN SIGHT, at eye height, on a wall or door where people gather. This is the one ' +
      'card in the house that is deliberately not hidden -- it is how the hunt starts, and it ' +
      'has no second slug. If nobody sees it, nobody plays this tile at all.',
  },
  eh8tgu: {
    game: 'riddle',
    step: 2,
    label: 'Riddle hunt, step 2',
    where:
      'On the coat rack in the living room. Tape it to the FRAME, never to a coat -- a coat ' +
      'leaves at 01:00 and takes the middle of the hunt with it.',
  },
  w5q2tc: {
    game: 'riddle',
    step: 3,
    label: 'Riddle hunt, step 3',
    where:
      'On the piano. Inside the lid or under the keyboard cover -- somewhere anybody who opens ' +
      'it sees it at once, rather than somewhere they have to grope for.',
  },

  // --- Roaming tiles, two slugs each so a tile is findable from more than one room -- #07..#14 ---
  // A slug is not consumed when it is scanned; every team can scan the same one. Two slugs buy
  // findability across rooms, not capacity.
  c4jm8x: { game: 'guess-who', label: 'Guess Who (a)', where: null },
  awyuv2: { game: 'guess-who', label: 'Guess Who (b)', where: null },
  bgue88: { game: 'herd', label: 'Herd Mentality (a)', where: null },
  '46ezp7': { game: 'herd', label: 'Herd Mentality (b)', where: null },
  '38bpnu': { game: 'scavenger', label: 'Photo scavenger (a)', where: null },
  pydzrd: { game: 'scavenger', label: 'Photo scavenger (b)', where: null },
  zfu45r: { game: 'portrait', label: 'Portrait of a stranger (a)', where: null },
  '2mu2xg': { game: 'portrait', label: 'Portrait of a stranger (b)', where: null },

  // --- Fixed-location tiles -- #15..#16 ---------------------------------------------------------
  // These two placements are settled by the roster (#7) rather than by the hiding plan.
  bbdcbz: {
    game: 'triangle',
    label: 'Triangle Test',
    where:
      'On the Triangle Test station, beside the three numbered jugs. THE ODD COLA GOES IN JUG 2 ' +
      '-- get that wrong and the site scores the whole night backwards. If it is already wrong, ' +
      'leave the code alone and swap the number tags until the odd jug wears the 2.',
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

  // --- Riddle hunt, the last two steps -- #20..#21 ----------------------------------------------
  // Appended rather than filed beside #04..#06 on purpose: position in this file IS the card
  // number, so slotting them in the middle would shift every card from #07 to #19 and invalidate
  // the numbers already test-printed (#34). Two more codes cost no extra paper -- the sheet holds
  // six per A4 and four sheets is 24 slots.
  h933qh: {
    game: 'riddle',
    step: 4,
    label: 'Riddle hunt, step 4',
    where:
      'In the garden shed. Taped INSIDE the door at eye height, where a phone torch finds it in ' +
      'one sweep. Not among the bin bags -- people will be out there in the dark, and the card ' +
      'is not the puzzle.',
  },
  '6gcteu': {
    game: 'riddle',
    step: 5,
    label: 'Riddle hunt, step 5 (THE END -- put the treasure here)',
    where:
      'Inside the technical cabinet above the toilet, together with whatever the treasure turns ' +
      'out to be. Nothing on the outside of the cabinet may suggest it opens: the whole joke is ' +
      'that everyone has stood underneath it all night without looking up.',
  },

  // --- Lights hunt, the last step -- #22 --------------------------------------------------------
  // Appended for the same reason #20..#21 were: position in this file IS the card number and the
  // test print (#34) already fixed #01..#19. Belongs with #01..#03 on the trail, not on the sheet.
  '3rmk4d': {
    game: 'lights',
    step: 4,
    label: 'Lights hunt, step 4 (THE END -- goes with #01..#03)',
    where:
      'ON THE DOME -- the fixture card #03 turns green. Fixed by the chain. Scanning this one ' +
      'ends the hunt and rolls Kitchen Blinds 4 for two seconds; there is NOTHING to hide at the ' +
      'blind, so do not put a card there.',
  },

  // Human Bingo and Longest yarn deliberately have no code: both are starter tiles, unlocked for
  // every team at onboarding. `too-soon` and `no-such-code` are pages the app renders directly and
  // are not scannable, so they are not codes either.
};
