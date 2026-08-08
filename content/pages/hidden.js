// Card #19. The one gag that pays.
//
// The other two spend the finder: the rickroll punishes curiosity and the motivational page hands
// out warm nothings. This one is sincere and means it, and it is the reason the hiding plan owes
// card #19 the hardest spot in the house -- the copy claims it was hidden properly, so the
// placement has to make that true. `where` in content/codes.js carries that as an instruction
// rather than a suggestion.
//
// MISSION.md's phrase "a hidden page" describes the PAGE, not the code: no tile, no route from
// the dashboard, close is the only way out. That is true of all three gags. What made this one
// worth finding had to be decided rather than read off the brief, and it was, in #28.
//
// The find-order line is the only comparative number the site shows all night, against a
// constraint locked in #8 that says it shows none. Deliberate, and narrow enough to be safe: it
// ranks who walked furthest into a cupboard, not who is winning, and this page awards nothing. It
// cannot leak the standings the league exists to reveal.
//
// COPY OWNERSHIP: the note is Dieter's, not an agent's. This is a draft in his shape, and the
// map's "copy pass in the host's voice" is where it gets replaced. It does not name an age --
// MISSION.md gives the date and not the number, and guessing that is worse than omitting it.

// At most fifteen teams, so words rather than digits; the numeral fallback exists so a bigger
// party degrades to "the 17th team" instead of "the undefined team".
const PLACES = [
  'first',
  'second',
  'third',
  'fourth',
  'fifth',
  'sixth',
  'seventh',
  'eighth',
  'ninth',
  'tenth',
  'eleventh',
  'twelfth',
  'thirteenth',
  'fourteenth',
  'fifteenth',
];

const place = (rank) => PLACES[rank - 1] ?? `${rank}th`;

export default {
  id: 'hidden',
  title: 'Well. You actually found it.',

  // `finderRank` is frozen at the moment of their first scan, so this sentence reads the same at
  // midnight as it did when they found it. A visitor with no team gets 0 and no line at all,
  // rather than a claim about an order they were never in.
  //
  // The two paragraphs are on a `.paper` sheet (#105): two or more paragraphs the page exists to
  // have read get one, and this page exists for nothing else. The rank line above it keeps its own
  // hero and the sign-off below stays bare on the gradient, both for the same reason -- neither is
  // the read, and a sheet around one line is a box for its own sake. Markup is written out here
  // rather than calling `paper()` because content hands the app HTML and already does this for
  // `.hero`; the em dash and the `<small>` are why it cannot be a list of escaped strings.
  body: ({ finderRank }) => `
    ${finderRank ? `<p class="hero hero--text">You are the ${place(finderRank)} team to find this.</p>` : ''}
    <div class="paper">
      <p>
        I hid this one properly. I wanted at least one thing tonight to be worth genuinely
        looking for, and this is it.
      </p>
      <p>
        There is no game here and no points. Just — thank you for coming. Getting everyone I like
        into one house on one night is the whole present, and you are part of it.
      </p>
    </div>
    <p><small>Now go back and talk to someone.</small></p>
  `,

  showClose: true,
};
