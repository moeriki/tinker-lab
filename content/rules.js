// The words on /rules. Settled by the "Rules page copy and the three band messages" ticket.
//
// This is content, not a page: it lives here rather than in `content/pages/` because that folder
// is auto-registered at `/p/:pageId` for the hidden pages a QR code takes you to. A rules entry
// there would mint a second live URL serving this same copy with rule 4 permanently missing,
// since only `showRules` knows whether the team has bought a hint.
//
// Two constraints bind every string below.
//
// **It may not name the price of a hint.** That sentence is rule 4's entire reason to exist, and
// it is the only thing on this site that is hidden until you stumble into it (MISSION.md). The
// closing line of the points block -- "your score can go below zero" -- is the tease: it concedes
// that a debit exists without saying what one costs, so rule 4 still has something to reveal.
//
// **No part of it is exempt from ridicule**, including the block that explains the arithmetic.
// The register is the one `too-soon` and `no-such-code` already set: short flat sentences,
// second person, the menace under the surface rather than on it.

export default {
  title: 'The rules',

  // The window frame's title bar. The style kit drew this page as a document (kit.html §8) and
  // captioned the fake file `de_regels.txt` -- Dutch, and the map's locked constraints say English
  // throughout, so it is anglicised here rather than quoted. The `.txt` is the joke; the language
  // was not carrying it.
  filename: 'the_rules.txt',

  // The mission's three rules, rewritten. The message is MISSION.md's; the tone is the house's.
  // Rule 3 deliberately implies there is something in the bedroom. There is not. That is the joke,
  // and it makes the instruction more memorable than stating it flatly would.
  rules: [
    'Have fun. This is not a suggestion.',
    'Be nice. Even to the people you are about to lie to.',
    'Stay out of the bedroom. There is nothing in there. That is why it is a rule.',
  ],

  /**
   * Rule 4, revealed only once a team has revealed a hint -- and rendered with no announcement,
   * no highlight and no "new", sitting in the numbered list as though it had been there all
   * evening. The 404 page insists "there is no rule 4 either"; this is what makes that a lie.
   *
   * It is also where the hint modal's "What?" button lands, so it has to actually answer the
   * question rather than change the subject.
   */
  hintRule: (cost) =>
    `Hints cost you ${cost} point${cost === 1 ? '' : 's'}. This rule was always here.`,

  // Everything the page admits to about the economy. Four disclosures, each chosen deliberately:
  //
  // - the ceiling, because the dashboard already shows ten tiles from minute one, so the number
  //   is one multiplication away and stating it confirms an inference rather than leaking a
  //   secret -- and because ADR-the-tile-is-the-unit-of-value priced the whole scale on the
  //   argument that a joke about a price only works if the audience knows what things cost;
  // - that finding a code pays nothing, which is the one genuinely wasted night this page can
  //   prevent: a team can collect all nineteen codes and finish on zero;
  // - that nothing comparative is ever shown, which is what stops the vague standing message
  //   reading as a bug;
  // - that scores go below zero, which is both honest about "100 is perfect" implying a floor
  //   that does not exist, and the setup for rule 4.
  points: [
    'Ten games. Ten points each. A perfect night is exactly 100. Nobody is going to have a perfect night.',
    'Scanning a code unlocks a game. It does not play it. You could find every code in this house and finish on nothing at all. The treasure hunts are the exception — there, the walking is the game.',
    'Most of tonight cannot be marked until tonight is over, so you can keep changing your answers right up to the end.',
    "Nobody's score is shown to anybody. You get your own number and one unhelpful sentence about it. That is the entire signal until the end of the night.",
    'Your score can go below zero. This has been considered, and allowed.',
  ],
  pointsTitle: 'How points work',
};
