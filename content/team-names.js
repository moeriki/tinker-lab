// The pool of team names. Onboarding DEALS one rather than asking a team to type one, and that
// single word does two jobs: it is the team's display name, and it is the handle a stranger types
// into a Human Bingo square to say "this team matches". Dealing it is what makes the second job
// work -- uniqueness is free, nobody has to validate a duplicate at the door, and there is no
// error state on the first screen of the night. Settled in #9.
//
// Rules for adding a word:
//
//   - one word, no spaces, no accents, no punctuation
//   - six letters or more. Human Bingo will match a typed word fuzzily, and the fuzzy budget is
//     zero below five characters (src/matching.js) -- a short name would have to be typed
//     perfectly by a stranger holding a drink.
//   - no two words within two edits of each other, for the same reason. BADGER and BADGES would
//     be one team as far as a bingo square is concerned.
//   - funny out loud, because "TEAM BADGER" said across a kitchen is the entire joke.
//
// Keep comfortably more words than teams. ~10-15 teams are expected; a team that rerolls does not
// burn a word (only a claimed name is taken), so the pool only has to outnumber the teams.

export default [
  'BADGER',
  'WAFFLE',
  'PENGUIN',
  'TRACTOR',
  'WALRUS',
  'MUSTARD',
  'GOBLIN',
  'PANCAKE',
  'MARZIPAN',
  'VOLCANO',
  'NOODLE',
  'HAMSTER',
  'BISCUIT',
  'FLAMINGO',
  'KETTLE',
  'MAMMOTH',
  'PICKLE',
  'DONKEY',
  'TURNIP',
  'LOBSTER',
  'SPUTNIK',
  'MEERKAT',
  'CROISSANT',
  'BAGPIPE',
  'WOMBAT',
  'PRETZEL',
  'NARWHAL',
  'CACTUS',
  'GHERKIN',
  'TOUCAN',
  'MUPPET',
  'RACCOON',
  'TROMBONE',
  'PLATYPUS',
  'IGUANA',
  'SAUSAGE',
  'FERRET',
  'ZEPPELIN',
];
