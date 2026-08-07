// The words on /rules. Settled by the "Rules page copy and the three band messages" ticket.
//
// This is content, not a page: it lives here rather than in `content/pages/` because that folder
// is auto-registered at `/p/:pageId` for the hidden pages a QR code takes you to. A rules entry
// there would mint a second live URL serving this same copy with rule 4 permanently missing,
// since only `showRules` knows whether the team has bought a hint.
//
// Two constraints bind every string below.
//
// **It may not name the price of a hint.** That sentence is the hint rule's entire reason to
// exist, and it is the only thing on this site that is hidden until you stumble into it
// (MISSION.md). The closing line of the points block -- "your score can go below zero" -- is the
// tease: it concedes that a debit exists without saying what one costs, so the hint rule still has
// something to reveal.
//
// **No part of it is exempt from ridicule**, including the block that explains the arithmetic.
// The register is the one `too-soon` and `no-such-code` already set: short flat sentences,
// second person, the menace under the surface rather than on it.
//
// THIS PAGE CARRIES EVERY RULE (#97). Onboarding shows a SUBSET of them, one per screen, and the
// subset is the `onboarding` flag below rather than a second list -- so a rule cannot be worded one
// way at the door and another way here, and cannot be shown at the door and then be missing from
// the page a team is sent to when they want to check. Dieter's rule, stated in those words: the
// rules page has all the rules, onboarding has a few important ones, and everything onboarding
// shows is on this page too.
//
// The hint rule is the one exception, and it is an exception in the safe direction: it is on this
// page and NEVER at the door, because the door is where every team is standing at minute zero and
// that is exactly where the reveal is most fragile.

export default {
  title: 'The rules',

  // The window frame's title bar. The style kit drew this page as a document (kit.html §8) and
  // captioned the fake file `de_regels.txt` -- Dutch, and the map's locked constraints say English
  // throughout, so it is anglicised here rather than quoted. The `.txt` is the joke; the language
  // was not carrying it.
  filename: 'the_rules.txt',

  // The mission's three rules, rewritten, plus the drawers rule that #97 added. The message is
  // MISSION.md's; the tone is the house's. The bedroom rule deliberately implies there is something
  // in the bedroom. There is not. That is the joke, and it makes the instruction more memorable
  // than stating it flatly would.
  //
  //   text        the rule, as printed on `/rules` and, if flagged, at the door
  //   onboarding  shown during onboarding as well, one rule per screen
  //
  // `onboarding` is the whole subset mechanism. Flipping one to `true` costs a word and adds a
  // screen to the door; flipping one to `false` takes the screen away and leaves the rule on the
  // page. Nothing else has to change, which is the point -- the door and the page can never drift
  // apart into two different wordings of the same rule.
  //
  // Three of the four are flagged. "Be nice" is the one left off, and it is left off for the
  // reason every other addition to the door is argued against (#9): twenty-five people are standing
  // in a hallway with their coats on, and it is the only one of the four that changes nobody's
  // behaviour in the house. It is still on `/rules`, where it costs nobody a tap.
  rules: [
    { text: 'Have fun. This is not a suggestion.', onboarding: true },
    { text: 'Be nice. Even to the people you are about to lie to.', onboarding: false },
    {
      text: 'Stay out of the bedroom. There is nothing in there. That is why it is a rule.',
      onboarding: true,
    },
    // The drawers rule. It is PERMISSION, not prohibition, and that is the only reading that makes
    // sense of a house with codes hidden in it: a team that does not know the cupboards are in play
    // never opens one, and card #19 is going in the hardest spot in the house. The hidden gag page
    // already ranks who walked furthest into a cupboard, so the site has been assuming this rule
    // for some time without ever printing it.
    //
    // The third sentence is the actual ask, and it is last because that is where it gets remembered.
    { text: 'Open the drawers. Open the cupboards. Close them again.', onboarding: true },
  ],

  /**
   * The hint rule, revealed only once a team has revealed a hint -- and rendered with no
   * announcement, no highlight and no "new", sitting at the bottom of the numbered list as though
   * it had been there all evening.
   *
   * It used to be rule 4 and the 404 page used to say "there is no rule 4 either", which was a lie
   * the site told until a team made it true. #97 added a visible fourth rule, which would have made
   * that line honest and killed it; Dieter's call was that he never got the gag and does not care,
   * so the 404 stopped counting rules rather than being renumbered to chase one. THE REVEAL ITSELF
   * IS UNTOUCHED -- it is still the one thing on this site hidden until you stumble into it, it is
   * still absent from the marquee, and onboarding still never shows it.
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
