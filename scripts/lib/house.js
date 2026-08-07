// A HOUSE FULL OF GUESTS, for the flows that cannot be walked alone.
//
// Seven of this roster's ten tiles can be played by one team on an empty board. Three cannot, and
// they are not edge cases -- they are the three tiles the party's whole social mechanic rests on:
//
//   Guess Who   deals ten cards out of what OTHER guests answered at the door. One team on the
//               board is dealt nothing and reads "No cards yet -- nobody else has been through
//               the door", which is the correct empty state and tells you nothing about the game.
//   Herd        asks you to predict what MOST teams said. With one team the crowd is you.
//   Sign Here   takes another team's handle as a signature, and refuses a word nobody holds.
//
// So this is the fixture those flows seed first: a cast of teams, walked through the real front
// door, with answers chosen rather than generated.
//
// WHY THE ANSWERS ARE WRITTEN DOWN AND NOT RANDOM. `page.fillForm()` fills what it finds with
// distinct filler words, which is right for a flow that only needs the gate to open. It is wrong
// here, because two of these three games read the room as a CORPUS and a corpus of unrelated
// words has no shape:
//
//   - A herd question wants answers that CLUSTER, so a prediction can be right. Fifteen distinct
//     words make every prediction wrong and the tile looks like it works while proving nothing.
//   - A Guess Who rung wants answers that SEPARATE, because two members who answered the same
//     thing are indistinguishable by definition and the card has no single right name.
//
// Those two pull in opposite directions (CONTEXT.md, "Profile answer"), which is exactly why the
// fixture states both on purpose instead of hoping a generator lands between them.
//
// THE TRAP THIS MODULE EXISTS TO ABSORB. A questionnaire field is named `<questionId>:<memberId>`
// for a member-scoped question -- `wanted-to-be:17` -- and `<questionId>:` for a team-scoped one.
// The member id is a database id, so it is not knowable when a fixture is written and it is
// different on every run. A seeder that hardcodes `wanted-to-be:1` writes its answers against
// ANOTHER team's members: the rows land, the counts look right, and the team silently never
// passes the gate -- so it is dropped from every pool and every harvest, and Guess Who reports an
// empty house that has eight teams in it. Measured, while reviewing #82. `answersFor()` below
// reads the names off the rendered form instead, which is the only thing that cannot go stale.

/** The `herd` questions, in the order onboarding asks them. Team-scoped: one answer per team. */
const HERD = ['herd-pizza', 'herd-fridge', 'herd-leave', 'herd-animal', 'herd-fire'];

/**
 * The cast. Seven teams, fourteen members -- four more than a Guess Who hand needs, so the deal
 * has something to choose from rather than handing out the whole room.
 *
 * `herd` is one answer per question in HERD order, and the columns are tuned so each has a clear
 * winner and a plausible field behind it. With the walking team's own answers added (the roster
 * flow answers the same way), the majorities are: pepperoni 5, milk 5, headache 4, bear 5,
 * passport 4 -- enough to be predictable without being unanimous, which is the only interesting
 * shape for a prediction game.
 *
 * `wanted` is one answer per member, and every one of the fourteen is different. That is the
 * separating half: a card reading "Wanted to be: a lighthouse keeper" has exactly one right name.
 */
export const HOUSE = [
  {
    members: ['Joris', 'Lien'],
    wanted: ['firefighter', 'ballerina'],
    herd: ['pepperoni', 'milk', 'babysitter', 'bear', 'photos'],
  },
  {
    members: ['Tom', 'Sofie'],
    wanted: ['pilot', 'schoolteacher'],
    herd: ['mushroom', 'cheese', 'work in the morning', 'lion', 'laptop'],
  },
  {
    members: ['Ruben', 'Elke'],
    wanted: ['archaeologist', 'surgeon'],
    herd: ['pepperoni', 'beer', 'tired', 'bear', 'the cat'],
  },
  {
    members: ['Wout', 'Maaike'],
    wanted: ['footballer', 'session drummer'],
    herd: ['pineapple', 'milk', 'headache', 'goose', 'passport'],
  },
  {
    members: ['Karel', 'Nele'],
    wanted: ['spy', 'war reporter'],
    herd: ['pepperoni', 'butter', 'work in the morning', 'bear', 'the dog'],
  },
  {
    members: ['Bram', 'Julie'],
    wanted: ['lion tamer', 'barrister'],
    herd: ['mushroom', 'milk', 'headache', 'crocodile', 'passport'],
  },
  {
    members: ['Stien', 'Ward'],
    wanted: ['glassblower', 'air traffic controller'],
    herd: ['pepperoni', 'milk', 'headache', 'bear', 'passport'],
  },
];

/** What the walking team answers, so it is one of the crowd rather than an outlier. */
export const US = {
  members: ['Ilse', 'Pieter'],
  wanted: ['lighthouse keeper', 'glacier guide'],
  herd: ['pepperoni', 'milk', 'headache', 'bear', 'passport'],
};

/** The answer the majority gave, per herd question — what a prediction has to match to pay. */
export const HERD_MAJORITY = {
  'herd-pizza': 'pepperoni',
  'herd-fridge': 'milk',
  'herd-leave': 'headache',
  'herd-animal': 'bear',
  'herd-fire': 'passport',
};

/**
 * The overrides `fillForm` wants for ONE screen of the questionnaire, read off the field names the
 * server actually rendered rather than guessed at.
 *
 * The door is a wizard (#97): one screen per member, then one screen holding the team's five herd
 * words. So this is called per screen and told which one it is on -- `nth` is the member's index
 * on a member screen, and is ignored on the herd screen, where every field is team-scoped.
 *
 * A member-scoped name is `<questionId>:<memberId>` and a team-scoped one ends in a bare colon.
 * Anything the fixture has no opinion about is left out of the map entirely, so `fillForm` fills
 * it with a distinct filler word the way it always has -- which is what happens to the four
 * guess-who rungs that are not rung 1, since onboarding only ever shows one of them.
 */
export async function answersFor(page, guest, nth = 0) {
  const names = JSON.parse(
    (await page.evaluate(
      `return JSON.stringify([...document.querySelectorAll('form [name]')]
         .map((el) => el.name)
         .filter((name) => name.includes(':') && !name.startsWith('rung:')))`,
    )) ?? '[]',
  );

  const overrides = {};

  for (const name of names) {
    const [questionId, memberId] = name.split(':');

    if (!memberId) {
      const index = HERD.indexOf(questionId);
      if (index >= 0) overrides[name] = guest.herd[index];
    } else if (questionId === 'wanted-to-be' && guest.wanted[nth]) {
      overrides[name] = guest.wanted[nth];
    }
  }

  return overrides;
}
