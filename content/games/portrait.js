// Portrait of a stranger -- the Humans of New York shape. A photograph of someone, plus one
// sentence they actually said tonight.
//
// The QUOTE is the whole mechanic, and the only required typing in the photo pair. You cannot
// invent a sentence someone said without having stood near them and listened, which is what
// makes this tile produce conversations rather than snapshots. It is also what keeps it a
// different tile from the scavenger now that both are ten-units-at-a-point.
//
// It deliberately records NOTHING about who is in the shot -- no team, no name. An earlier draft
// keyed each portrait to the photographed team's id and deduped on it; that was anti-cheat
// wearing a scoring hat (no anti-cheat is a locked constraint on this map), it made guests
// organise themselves at a party, and the roster already has two tiles that teach you who
// everybody is. The photograph is the identity. See #25.
//
// Anonymous units, so the tenth photograph is the last one that pays and the eleventh is a
// retake. The form stays open afterwards: the party wants the pictures more than it wants the
// arithmetic.

export default {
  id: 'portrait',
  kind: 'tally',
  title: 'Portrait of a stranger',
  judging: 'trust',
  photo: true,

  // The quote. Nothing else on the site asks for a body alongside a photo, so this is the flag
  // that makes a photo-only submission bounce rather than bank.
  requiresBody: true,
  form: { placeholder: 'What did they say?' },

  points: 1,

  // Ten anonymous slots -- a number rather than a list, because one portrait is not
  // distinguishable from another. The ordinal is what lands in `submissions.unit`.
  units: 10,

  hero: {
    text: 'A photograph of someone, and one thing they actually said tonight. Ten of them. You will have to listen.',
  },
};
