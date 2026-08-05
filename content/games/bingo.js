// SIGN HERE -- the roster's second starter tile (#7), open for every team from onboarding, and the
// other game with no QR code, because there is nothing to scan. Decisions in #21.
//
// Nine traits on a 3x3 card. You find a team the trait is true of, they give you their handle, and
// you write it in. THE HANDLE IS A SIGNATURE, and that is the whole design: in the playground
// version the person who matches signs your square, and nobody has ever audited a signature. So
// nothing here checks whether Joris really has been stung by a jellyfish. Getting his team's word
// out of him required walking up to him, which is the thing the tile exists to cause.
//
// WHAT THIS TILE IS NOT. It was very nearly Guess Who twice. The near-miss shape is: harvest a
// secret at the door, print it on a square, and have the player work out whose it is -- which is
// exactly what content/games/guess-who.js already does, down to the dropdown. Two of the roster's
// three cross-team talkers would have been one mechanic wearing two hats, and 20 of the night's
// 100 points would come from reading a stranger's answer and naming them. So the tiles were split
// on the social act rather than on the material:
//
//   Guess Who is a SEARCH -- one right answer, and you are hunting one specific person.
//   This is a SWEEP    -- many right answers, and you are working the room until one sticks.
//
// It also means this tile needs NOTHING at the door. The nine traits are authored here, which
// keeps the hallway at nine boxes (#9, #52) at the cost of them being guesses about the room
// rather than facts from it. That trade is revisited below.
//
// EITHER MEMBER SATISFIES A TRAIT. A team is two people and a trait is usually one person's, so
// "have either of you ever been on the radio?" is the question, and one yes is enough. The
// alternative halves every hit rate exactly where the low end can least afford it, and turns a
// friendly question into a two-person interrogation where one no kills the square and the pair
// you just met have nothing left to say to you.
//
// ONE SIGNATURE PER TEAM, ACROSS THE WHOLE CARD. The classic rule, and here it is load-bearing
// twice over: it is what forces a line to cost three separate conversations, and it quietly makes
// the card an allocation puzzle. If WALRUS matches four of your squares but they are the only team
// in the house who has been on television, spending them on "has broken a bone" at 21:30 costs you
// the television square for the rest of the night.

// -----------------------------------------------------------------------------------------------
// THE NINE.
//
// Every one of them has to pass four tests, and the first two are the ones that are easy to miss.
//
//   ASKABLE, NOT OBSERVABLE. If you can tell by looking, there is no conversation and the tile has
//   produced nothing. "Has a tattoo you cannot see right now" says this out loud; the rest get
//   there by being about a past nobody wears.
//
//   BROAD. A trait matching two teams out of twelve is a dead square at the low end -- and the low
//   end is real, since 20-30 guests in pairs is 10-15 teams. These are aimed at roughly a third to
//   a half of teams once BOTH members count, so you usually find a match within two or three
//   approaches and rarely from whoever is standing nearest.
//
//   Then: answerable in one word by the person being asked, and worth a follow-up question. A
//   trait that ends the conversation the moment it is answered has done half a job.
//
// THESE ARE GUESSES ABOUT THIS CROWD, and they are the one thing in this file worth overwriting.
// Rewriting any of them costs one line and no code -- no migration, no `pending` flag, nothing
// downstream reads them but the page. If a better one occurs to you in the week before the party,
// take it. What must not change after the 14th is the COUNT: nine, because the geometry below
// assumes a square, and boot refuses anything else.
// -----------------------------------------------------------------------------------------------

const TRAITS = [
  'has broken a bone',
  'has lived in another country',
  'speaks four or more languages',
  'has worked in a bar or a kitchen',
  'has a tattoo you cannot see right now',
  'has sung into a microphone in front of strangers',
  'has fallen asleep on a train and missed their stop',
  'has been stung by a jellyfish',
  'has been on television or the radio',
];

export default {
  id: 'bingo',
  kind: 'tally',
  title: 'Sign Here',

  // Open for every team from the moment they are through the door, with no code and nothing to
  // scan. A tile starts open only when learning about it late is unrecoverable (#7), and this is
  // the clearest case on the roster: it is a tile you play across the entire night, one stranger
  // at a time, and a team that met it at 23:00 has already missed most of its own game.
  starter: true,

  // A signed square. Nine of them is 9, one short of the tile budget -- see `bingo` below, which
  // is what spends the tenth point.
  points: 1,

  // A 3x3 card, and the reason the grid is a declared number rather than assumed: it is the
  // scoring rule. `src/bingo.js` builds the lines from it, boot checks that the units make a
  // square, and the page lays them out in that many columns. There are 8 lines on a 3x3 -- three
  // rows, three columns, two diagonals.
  grid: 3,

  // A LINE PAYS THE WHOLE TILE, and it is not cumulative: three in a row is 10, full stop, not 10
  // on top of the three squares that made it. The tile therefore pays `min(signed, 10)` until a
  // line lands and a flat 10 afterwards, and it cannot exceed the budget by construction.
  //
  // The geometry does something nice here that is worth knowing before anyone retunes it. Two
  // empty squares can never break all eight lines -- the best any two cells cover is the centre
  // plus a corner, which is seven -- so ANY card with seven or more signatures already contains a
  // line. Scores of 7, 8 and 9 are therefore impossible: the curve runs 1, 2, 3, 4, 5, 6, then 10.
  // The only way to hold six and no line is the three empties sitting on a diagonal.
  //
  // The known cost, taken deliberately: a line arrives at around six signatures for a team working
  // the room, and the tile is finished from that moment. On a starter tile that is a game which
  // ends before the night does -- accepted, because the shout across a kitchen at 21:30 is worth
  // more than four more hours of a card nobody can finish, and because there are nine other tiles.
  bingo: 10,

  // A refused signature shuts the card for this long. See src/bingo.js for what counts as refused
  // -- it is only ever a handle nobody holds, never a rule you broke by tapping.
  //
  // THIS IS NOT ANTI-CHEAT, and the distinction matters because "no anti-cheat" is a locked
  // constraint. Nothing here verifies a trait; Joris's jellyfish is still between you and Joris.
  // What it prices is FORGING A SIGNATURE. content/team-names.js holds 38 words and about a dozen
  // are in play on the night, so roughly one guess in three lands -- and a line needs only three.
  // Left open, the fastest ten points on the board are available from the sofa, talking to nobody,
  // in about nine guesses. At half an hour a miss that becomes about three hours, which is not a
  // strategy any more.
  //
  // It catches an honest mishearing too -- MARZIPAN heard as MARSHMALLOW is a real word that
  // nobody holds -- and that is the honest cost of the above. It cannot be designed away without
  // reopening the sofa route, because the two are indistinguishable at the point of typing.
  lockMinutes: 30,

  units: TRAITS,

  hero: {
    text:
      'Nine things. Every one of them is true of somebody in this house, and none of them are ' +
      'written on anybody.\n\n' +
      'Find the team it fits, ask them for their name, write it in the square. One name per ' +
      'card — nobody signs twice, so spend them carefully. Three in a row and the tile is yours.',
  },

  // NO HINTS, and this is a firmer no than the one Longest yarn and Guess Who give. Theirs is
  // arithmetic: a hint costs 3 and a card is worth 1, so nobody sane buys one. This tile has
  // nothing to sell. There is no hidden information anywhere in it -- every square says exactly
  // what it wants in plain words, and the only unknown is which of the people in the kitchen
  // matches it, which is a fact about the room rather than about the game. The one hint this tile
  // could possibly give is the name of a team that matches, and that IS the tile.
};
