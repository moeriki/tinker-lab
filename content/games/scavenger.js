// Photo scavenger -- ten prompts, one point each, a photo apiece.
//
// The tile's real job is VOLUME: the party wants photographs of itself, and every point this
// game spends is a point buying one more picture. That is why there is no completion bonus and
// no cap beyond the prompt list -- four points held back for "finish the set" would have bought
// four photos instead of one.
//
// Every prompt has to point the camera at a PERSON. Anything satisfiable by walking round the
// house alone was cut however funny it was, because a lap of the empty hallway is exactly the
// failure this tile exists to avoid. Several go further and make you perform first -- you cannot
// photograph someone you have just told a terrible joke to without telling one.
//
// Retakes are free and unpaid: shooting prompt 3 again stores a second photo and pays nothing,
// because the ledger keys on the prompt index. The form never closes and never tells anyone to
// stop.

export default {
  id: 'scavenger',
  kind: 'tally',
  title: 'Photo scavenger',
  judging: 'trust',
  photo: true,

  // One point per prompt, ten prompts, a flat ten-point tile. Boot checks the arithmetic.
  points: 1,

  // Labelled units. The index into this array is what lands in `submissions.unit` and in the
  // award's `source_id`, so REORDERING THIS LIST AFTER THE PARTY STARTS re-labels photos already
  // taken. Adding to the end is safe; rewriting the text of one in place is safe. Swapping two
  // rows is not.
  units: [
    'Someone eating or drinking',
    'Both hosts in one shot',
    'Two people laughing at the same time',
    "Someone you've just told a terrible joke to",
    "Three people who didn't arrive together",
    'Someone showing you something on their phone',
    'The best item of clothing in the house',
    'Two strangers doing the same pose',
    "Someone holding a drink that isn't theirs",
    'The most convincing fake laugh in the house',
  ],

  hero: {
    text: 'Ten photographs. One point each. Nobody is judging them, so the only way to lose is to stand still.',
  },
};
