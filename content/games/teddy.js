// TEDDY -- the roster's trophy (#7, #36): a physical object in the house, no form, awarded by
// hand at /admin/game/teddy. Decisions in #24.
//
// Mr Bean's Teddy sits in a timer lockbox that opens by itself some time in the evening. The QR
// on the box (`6cd3rd`) is what unlocks this tile, so the box explains itself by being the thing
// you just scanned -- which is why the page carries no lockbox exposition and no rules about who
// may take him off whom. Possession at game end is the whole game, and one line says so.

export default {
  id: 'teddy',
  title: 'Teddy',
  kind: 'trophy',

  // The full tile budget. A trophy must declare this: the admin's award button has to print a
  // number and nothing later in the night can work one out.
  points: 10,

  // A picture, not words -- the one tile where the hero IS the object. Shot on the table rather
  // than in the lockbox, because the box had not been bought yet (#44); the alt describes what is
  // actually in the frame, so a team holding him can tell it is the same bear. If the box arrives
  // in time and he is reshot on it, this line moves with the picture. Until a file lands at this
  // path boot warns and the page shows the style kit's placeholder frame rather than a broken
  // image.
  hero: {
    asset: '/img/teddy.jpg',
    alt: 'Teddy: a small grey knitted bear in a braided pastel collar, sitting on a table',
  },

  blurb: 'Whoever is holding Teddy when the game ends takes 10 points.',
};
