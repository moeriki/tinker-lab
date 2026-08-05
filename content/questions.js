// The onboarding questionnaire. Every question is here because a GAME EATS IT -- that is the
// whole admission test, and a question no game consumes should be cut rather than kept because
// it is funny. Settled in #9; the roster that named the consumers is #7; the Guess Who ladder
// below is #22.
//
// Nine fields is the door: a dealt team name (not typed), two member names, one Guess Who answer
// per member, and five one-word answers. It is the single biggest friction point of the night and
// every addition here is paid for by twenty-five people standing in a hallway with their coats on.
// Nothing polices that total -- each question is justified on its own and the sum is nobody's job
// -- which is why #52 exists to count it once every game has declared what it needs.
//
//   id           stable. profile_answers.question_id refers to it by bare string with no foreign
//                key (ADR-game-content-lives-on-disk), so RENAMING ONE ORPHANS EVERY ANSWER
//                ALREADY GIVEN.
//   ladder       questions sharing one of these are RUNGS, and a member answers exactly one
//   scope        'member' asks once per member; 'team' asks once
//   label        the question, as asked
//   card         the rung's short name, worn by a Guess Who card. Ladder rungs only.
//   input        text | number | select
//   options      for input: 'select'
//   maxLength    what fits, and a gentle argument against writing a sentence
//   placeholder  shows the SHAPE of the answer without suggesting its content
//   feeds        documentation only: which game eats this
//
// THE TWO BLOCKS BELOW WANT OPPOSITE THINGS, and it is worth knowing which you are editing.
//
// The five herd questions are harvested honestly here and counted hours later by Herd Mentality,
// which asks a team to predict what most teams answered. A good one CLUSTERS: four to six
// plausible answers, so the crowd has a shape to guess at. "Name a colour" was cut for failing
// that -- blue takes ~40% of any room and nobody is separated.
//
// The Guess Who ladder wants the exact inverse. A good rung SEPARATES: few people share an answer,
// because the game attributes an answer to a person and two identical answers are indistinguish-
// able by definition. Do not "improve" a rung into a herd question, or the other way round.
//
// Answers are stored verbatim and normalised only when counted (src/matching.js).

export default [
  // --- the Guess Who ladder: one answer per member, from whichever rung they will answer --------
  //
  // Rung 1 is what everyone is asked. The rest exist because "what did you want to be" is a MEMORY
  // question, and a person who genuinely cannot remember has nothing to type. Skipping walks down
  // this list in this order, and the last rung has no skip under it -- everyone contributes
  // exactly one card, which is what lets onboarding stay a gate (#9) with no opt-out to represent.
  //
  // A rung has to pass four tests, and the first is the one that is easy to miss:
  //
  //   MEMORABLE TO THE ANSWERER. At 23:00 a stranger walks up and asks "what did you put at the
  //   door?", and the person has to be able to say. This kills every present-tense question --
  //   "the last thing you bought for yourself" is a fine puzzle that nobody remembers writing, so
  //   the card becomes unwinnable through nobody's fault.
  //
  //   Then: distinctive, so two people rarely collide; short; and something you would happily tell
  //   a stranger who interrupted you, because being interrupted by strangers is the whole tile.
  {
    id: 'wanted-to-be',
    ladder: 'guess-who',
    scope: 'member',
    label: 'What did you want to be when you were young?',
    card: 'Wanted to be',
    input: 'text',
    maxLength: 40,
    placeholder: 'astronaut',
    feeds: 'guess-who',
  },
  {
    id: 'worst-job',
    ladder: 'guess-who',
    scope: 'member',
    label: "What's the worst job you've ever had?",
    card: 'Worst job',
    input: 'text',
    maxLength: 40,
    placeholder: 'night shift at a petrol station',
    feeds: 'guess-who',
  },
  {
    id: 'weirdly-good',
    ladder: 'guess-who',
    scope: 'member',
    label: "What's something you're weirdly good at?",
    card: 'Weirdly good at',
    input: 'text',
    maxLength: 40,
    placeholder: 'reversing a trailer',
    feeds: 'guess-who',
  },
  {
    id: 'leave-tonight',
    ladder: 'guess-who',
    scope: 'member',
    label: 'Where would you go if you had to leave the country tonight?',
    card: 'Would flee to',
    input: 'text',
    maxLength: 40,
    placeholder: 'Lisbon',
    feeds: 'guess-who',
  },
  // The last rung, so it carries no skip and everybody has to be able to answer it. That is why it
  // is a possession rather than a memory, an opinion or an experience: everyone owns something
  // useless, and nobody has to remember anything to say what it is.
  {
    id: 'useless-thing',
    ladder: 'guess-who',
    scope: 'member',
    label: "What's the most useless thing you own?",
    card: 'Most useless possession',
    input: 'text',
    maxLength: 40,
    placeholder: 'a bread maker',
    feeds: 'guess-who',
  },

  // --- the herd harvest: one word each, four to six plausible answers apiece ---------------------
  {
    id: 'herd-pizza',
    scope: 'team',
    label: 'Name a pizza topping.',
    input: 'text',
    maxLength: 24,
    placeholder: 'one word',
    feeds: 'herd',
  },
  {
    id: 'herd-fridge',
    scope: 'team',
    label: "Name something you'd find in a fridge.",
    input: 'text',
    maxLength: 24,
    placeholder: 'one word',
    feeds: 'herd',
  },
  {
    id: 'herd-leave',
    scope: 'team',
    label: 'Name a reason to leave a party early.',
    input: 'text',
    maxLength: 24,
    placeholder: 'one word',
    feeds: 'herd',
  },
  {
    id: 'herd-animal',
    scope: 'team',
    label: 'Name an animal you would not want to fight.',
    input: 'text',
    maxLength: 24,
    placeholder: 'one word',
    feeds: 'herd',
  },
  // This slot used to be "name a bad gift", and it was cut in #23 for failing the clustering test
  // from the other direction: socks, soap, a candle, a mug, a voucher, a tie, fruitcake -- seven
  // plausible answers and no shape, where ~12 teams would plausibly land on twelve different words.
  // A question that scatters is a content bug and gets fixed HERE, which is the whole reason
  // src/games/herd.js has no minimum-count rule in it.
  {
    id: 'herd-fire',
    scope: 'team',
    label: "Name the one thing you'd grab from a burning house.",
    input: 'text',
    maxLength: 24,
    placeholder: 'one word',
    feeds: 'herd',
  },
];
