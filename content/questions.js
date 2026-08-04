// The onboarding questionnaire. Every question is here because a GAME EATS IT -- that is the
// whole admission test, and a question no game consumes should be cut rather than kept because
// it is funny. Settled in #9; the roster that named the consumers is #7.
//
// Nine fields is the door: a dealt team name (not typed), two member names, one aged-eight answer
// per member, and five one-word answers. It is the single biggest friction point of the night and
// every addition here is paid for by twenty-five people standing in a hallway with their coats on.
//
//   id           stable. profile_answers.question_id refers to it by bare string with no foreign
//                key (ADR-0001), so RENAMING ONE ORPHANS EVERY ANSWER ALREADY GIVEN.
//   scope        'member' asks once per member; 'team' asks once
//   label        the question, as asked
//   input        text | number | select
//   options      for input: 'select'
//   maxLength    what fits, and a gentle argument against writing a sentence
//   placeholder  shows the SHAPE of the answer without suggesting its content
//   feeds        documentation only: which game eats this
//
// The five herd questions are harvested HONESTLY here and counted hours later by Herd Mentality,
// which asks a team to predict what most teams answered. So a good one has four to six plausible
// answers: too obvious and every team predicts it and nobody is separated, too open and no answer
// clusters at all. "Name a colour" was cut for exactly that -- blue takes ~40% of any room.
//
// Answers are stored verbatim and normalised only when counted (src/matching.js).

export default [
  {
    id: 'age-eight',
    scope: 'member',
    label: 'What did you want to be when you were eight?',
    input: 'text',
    maxLength: 40,
    placeholder: 'astronaut',
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
  {
    id: 'herd-gift',
    scope: 'team',
    label: 'Name a bad gift.',
    input: 'text',
    maxLength: 24,
    placeholder: 'one word',
    feeds: 'herd',
  },
];
