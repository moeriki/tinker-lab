// TRIANGLE TEST -- the roster's drinking-game tile (#7), and the only game on the board where
// being right is deliberately worth nothing in particular. Decisions in #26.
//
// A triangle test is the method food companies use when they reformulate a recipe and want to
// know whether anybody can actually tell: three samples, two identical, one different, name the
// odd one out. Chance alone gets you there one time in three, which is the entire joke -- a
// single person being correct proves nothing at all, and this tile exists to say so to their
// face.
//
// TWO COLAS, NOT BEER. The roster reached for alcohol-free versus real beer, and that does not
// survive the mechanic: a triangle test means tasting all THREE cups, so one alcoholic jug means
// anybody pregnant, driving or sober cannot take the test. The whole reason this tile is on the
// roster is that it is the drinking game nobody is shut out of, so the liquids have to be two
// soft drinks and the ritual carries the rest.

/**
 * The jug holding the odd cola. Two jugs hold one brand; this one holds the other.
 *
 * Two, which reverses #26. That ticket picked 3 because 2 is the reflex answer when somebody
 * names a number between one and three, and it wanted accidental winners to be rare. Rare is not
 * what this tile is for: the punchline is that being correct proves nothing, and "one in three
 * people who taste nothing at all get there too" is a claim about chance that holds whichever jug
 * is odd. Putting the odd cola under the modal guess means more of the room scores without
 * tasting, and every one of them reads a line saying we cannot tell them apart from someone who
 * did. That is the joke landing harder rather than leaking. Decided in #57.
 *
 * WHOEVER FILLS THE JUGS ON THE DAY MUST PUT THE ODD COLA IN JUG 2. Nothing in this file can
 * check that, and a mis-poured station means the site spends five hours confidently scoring the
 * exact inverse of the truth. It is the only game on the roster a physical setup error can turn
 * upside down in silence -- which is why the code's `where` in content/codes.js says so too.
 *
 * If it happens anyway the fix is physical and takes ten seconds: two of the three jugs hold the
 * SAME cola, so nobody has to pour anything -- move the number tags until the odd jug wears the
 * 2. Do NOT edit this constant on the night. `/admin/rescore` re-runs resolvers and never
 * `check()`, so a verdict already written stays written; teams scored before the swap are put
 * right one at a time with /admin/award, and everybody after it is simply correct. See #57.
 */
const ODD_JUG = '2';

export default {
  id: 'triangle',
  title: 'Triangle Test',
  kind: 'answer',

  // Ten on the nose for the correct jug, nothing for a wrong one -- no floor for turning up.
  // That is what keeps the copy honest: "which is nothing" has to mean nothing, or the page
  // argues with the ledger. Boot checks this against the tile budget, which it can do here and
  // cannot do for yarn: a check() game pays a flat game-level `points` and nothing is computed.
  points: 10,

  /**
   * ONE SHOT. Every other `answer` game on this site is editable until game end, and for a
   * check() game that is a three-tap brute force: pick 1, told wrong, pick 2, told wrong, pick 3,
   * ten points, having tasted nothing and never left the sofa. The submission upserts and the
   * award upserts with it, so the last verdict is the only one that survives.
   *
   * Closing the form is what makes the whole tile mean anything. See
   * docs/adr/an-answer-may-be-final.md.
   */
  final: true,

  hero: {
    text:
      'Three jugs. Two hold the same thing. One does not.\n\n' +
      'Taste all three and say which one is the odd one out. You get one answer, and it is ' +
      'final.',
  },

  // A dropdown of the jug numbers, opening on nothing chosen. The jugs are physically numbered,
  // so A/B/C would be a translation layer between the table and the phone -- and with a final
  // answer a free-text box means somebody typing "the middle one" and losing ten points to a
  // parser. An empty choice bounces back with the form intact rather than spending the one shot.
  form: {
    label: 'which jug was the odd one out?',
    options: [
      { value: '', label: '— pick one —' },
      { value: '1', label: 'Jug 1' },
      { value: '2', label: 'Jug 2' },
      { value: '3', label: 'Jug 3' },
    ],
  },

  /**
   * This game's own words on submit, overriding the site-wide lines in src/moments.js.
   *
   * The override is forced rather than decorative: the global `incorrect` line promises "you can
   * change your answer right up to the end", which is true of every other answer game and a flat
   * lie here, told at the exact moment it does the most damage. Boot refuses a `final` game that
   * does not replace it.
   *
   * The 33% belongs on the WIN. A wrong answer scored 0%, not 33% -- the third is the guesser's
   * expected score, so the line is an insult aimed at people who got it right, which is also the
   * real finding of every triangle test ever run.
   *
   * Both name the jug. That accelerates the leak, knowingly: one station holds one secret and
   * fifteen teams have five hours, so the answer was always going to travel, and the wrong-answer
   * line owns it rather than pretending otherwise.
   */
  verdicts: {
    correct:
      `Correct. It was jug ${ODD_JUG}. One in three people who taste nothing at all get there ` +
      `too, and we cannot tell you apart from them. Ten points.`,
    incorrect:
      `Wrong. It was jug ${ODD_JUG}. That was your one answer and it is spent. Tell whoever you ` +
      `like; it is no use to you now.`,
  },

  // NO HINTS, and not close. A hint costs 3 points. Anything genuinely useful here IS the answer,
  // sold at a 7-point profit; anything less useful narrows three jugs to two, which is worth
  // about 1.7 points in expectation and still costs 3. Same arithmetic that left Guess Who and
  // Longest yarn hintless.

  /** The stored body is the option's value, so the whole judgement is one string comparison. */
  check: (value) => (value ?? '').trim() === ODD_JUG,
};
