// FIVE CARDS -- the roster's second treasure hunt (#7), and the half of the pair that has no
// hardware in it. Decisions in #27.
//
// The lights hunt makes the house react; this one makes the house get looked at. Nothing here
// fires a webhook, which is deliberate rather than an omission: `applyCode` decides whether a
// deferred scan owes a "go and scan it again for real" prompt by asking whether the step has a
// `webhook` at all, so a hunt with none needs no prompt and gets none. See
// docs/adr/the-first-scan-is-not-live.md.
//
// FIVE CARDS, FOUR RIDDLES. Each card's hero names where the next card is; the fifth card is the
// end of it. That is the whole mechanism, and it means the number of riddles is one less than the
// number of steps -- a fact worth stating because it is the thing that is wrong in every draft of
// this game that has three cards and three riddles in it.
//
// THE FIRST CARD IS NOT HIDDEN. It hangs in plain sight wherever people gather. Every other tile
// on the roster got two slugs so it stays findable from two rooms; a hunt gets one slug per step,
// so a hidden first card is a single point of failure for the entire tile -- nobody finds it,
// nobody ever plays. Putting it on a wall at eye height costs nothing and removes that.
//
// It is also why STEP 1 PAYS NOTHING. The economy's rule is that points mean *you played*, never
// *you walked past it* (#8), and reading a card somebody hung at eye level is not playing. The
// ten points sit entirely on the four riddles.

export default {
  id: 'riddle',
  title: 'Five Cards',
  kind: 'hunt',

  // No game-level `points` -- a hunt pays per step and boot refuses one that declares a total.
  // The steps below sum to exactly 10, which boot checks against economy.tilePoints.

  steps: [
    // --- 1. the card in plain sight -> the coat rack ------------------------------------------
    {
      // Zero, and the only zero-point step on the board. See the header: this card was handed to
      // them. Boot requires a number here, not a truthy one, so 0 is a declaration and not a hole.
      points: 0,

      hero: {
        text:
          'There are five of these. You are holding the one we left in plain sight, so nothing ' +
          'has happened yet.\n\n' +
          'Arms without hands, a back without bone, dressed by the crowd and standing alone.',
      },

      // TWO HINTS, ON THE STEP THAT PAYS NOTHING, and #101 is where that inversion was argued.
      // This step used to have none, refused on the grounds that anything useful here IS the
      // answer sold at 3 points -- which borrowed the Triangle Test's arithmetic and does not
      // survive being applied to a hunt. The step pays 0; solving its riddle opens a chain worth
      // 10. A team stuck on the card we handed them at eye level does not lose nothing, it loses
      // the tile. So this is the highest-stakes hint on the roster and it was the one that did
      // not exist.
      hints: [
        'It was empty when the first guests arrived. It is not empty now.',
        'It is holding something of yours right now.',
      ],
    },

    // --- 2. the coat rack -> the piano ---------------------------------------------------------
    {
      points: 1,

      hero: {
        text:
          'Two. Every card tells you where the next one is. None of them will make it easy.\n\n' +
          'It has keys but opens no doors. It has a lid but nothing it stores.',
      },

      // Narrows the room without naming the object. "Furniture that makes a noise" is worth the
      // three points; "the piano" would not be a hint, it would be a sale.
      //
      // The second attacks the LID half of the riddle rather than being the first one turned up
      // louder, which is the shape every pair on this hunt uses: two angles on the same object,
      // never a name. It also rules out the creaky chair that "furniture that makes a noise"
      // leaves standing.
      hints: [
        'You are looking for a piece of furniture that makes a noise.',
        'It has a lid, and what is under the lid is the noise.',
      ],
    },

    // --- 3. the piano -> the garden shed --------------------------------------------------------
    {
      points: 2,

      hero: {
        text:
          'Three. Halfway is behind you. That was the good half.\n\n' +
          'Go past the lit part, past the chairs, to the small dark thing that no one airs.',
      },

      // The one piece of information that actually unsticks this riddle is that the answer is
      // outdoors, and this says so without saying "shed".
      //
      // The second names the KIND of thing once they are out there, and stops deliberately short
      // of "shed" -- a garage or an outhouse would satisfy it, which is fine, because a team
      // standing in the garden with this much has already been unstuck.
      hints: ['You are going to need shoes.', 'It is a building, and nobody lives in it.'],
    },

    // --- 4. the garden shed -> the technical cabinet ---------------------------------------------
    {
      points: 3,

      hero: {
        // The first beat is a deliberate pre-echo of the punchline: they HAVE walked past it,
        // repeatedly, and the joke only lands if that is true when they read it. It does not name
        // the room, so it narrows nothing.
        text:
          'Four. One left. It is back indoors, and you have already walked past it several times ' +
          'tonight without noticing.\n\n' +
          "Discreet and alone. For one man a throne. Not locked but concealed. Now it's revealed.",
      },

      // Names the posture rather than the room, which is the same clue told sideways.
      //
      // The pair splits room from object here, which no other step needs to: the first lands the
      // room and leaves a team standing in it with nothing found, because "not locked but
      // concealed" is the actual difficulty. The second says where to look without saying what is
      // behind it -- and it is the only hint on the hunt that tells a team to stop searching.
      hints: [
        'You have been in the right room several times tonight, and you were sitting down at the time.',
        'You are not looking for the room any more. You are looking at a wall in it.',
      ],
    },

    // --- 5. the technical cabinet -- the end -----------------------------------------------------
    {
      points: 4,

      hero: {
        // Deliberately does NOT name what is in the cabinet. The object is a physical prop that
        // can change any time up to the party without touching this file, and a finish line that
        // named it would be a lie the moment somebody put something else in there.
        text:
          'That is all five. Whatever is in there with this card is yours.\n\n' +
          'Close the door on your way out. The next lot can find it themselves.',
      },

      // No hints: there is nothing left to find.
    },
  ],
};
