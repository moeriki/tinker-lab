// THE LIGHTS HUNT -- four cards, four rooms, and a house that denies everything. Decisions in #18.
//
// The mechanic is never stated anywhere a team can read it. Scanning a card changes the colour of
// ONE fixture somewhere in the house for five seconds; the next card is taped to whatever just
// changed. The page says "Nothing happened?" and nothing else. Working that out IS the game, which
// is why the tile is not called "the lights hunt" on the dashboard -- a locked tile renders `???`,
// but an unlocked one renders this title, and a title naming lights hands over the whole puzzle on
// the walk back from card one.
//
// THE LIGHTS ARE THE CLUE, NOT A FLOURISH. There is no fallback: the page carries no direction,
// the hints name no fixture, and Home Assistant answers 200 OK to a dead automation (ADR-0007), so
// the site cannot tell whether anything fired. If MM's automation is down on the night this tile
// is simply unplayable and no team completes it. That was chosen deliberately (#18) with the risk
// stated -- which is what makes the end-to-end lamp test (#17) load-bearing rather than a nicety.
//
// The `webhook` name is the thing that LIGHTS UP, not where the card is. Scanning the card at
// Liane 5 fires `fugato`, because Fugato is where they go next. The last step fires the blind and
// there is nothing behind it: the hunt is already over by the time it moves.
//
// Colours are kit tokens (public/css/app.css), picked to survive being rendered by a bulb rather
// than a screen: a lamp has a hue and a brightness, so the dark tokens all collapse into "dim
// red". Cyan, magenta and green cannot be confused from the far side of a room, which also lets a
// team tell their glow from another team's without the page ever naming a colour.

export default {
  id: 'lights',
  kind: 'hunt',

  // Names nothing. The house's line on the whole tile, and the same words the step page uses.
  title: 'Nothing Happened',

  // ONE list for the whole hunt, not one per step: pressing Hint on step 2 gives the SECOND hint,
  // not the first one again. Neither names a fixture or a room -- they sell the mechanic once and
  // then there is nothing left to buy, which is why there are two of them and not four.
  hints: ['Something did happen.', 'The colour reveals everything.'],

  // Escalating, summing to exactly the 10-point tile budget (boot checks the arithmetic). Steps
  // bank as they are reached rather than at the finish, so a team that stalls on step 3 still
  // keeps what it walked.
  steps: [
    {
      points: 1,
      webhook: 'liane-5',
      hero: { text: 'Nothing happened?' },
    },
    {
      points: 2,
      webhook: 'fugato',
      hero: { text: 'Nothing happened?' },
    },
    {
      points: 3,
      webhook: 'dome',
      hero: { text: 'Nothing happened?' },
    },
    {
      // The finale. Scanning this card completes the hunt and banks the points whether or not
      // anybody was looking at the kitchen -- the blind is the curtain call, not a clue, so
      // missing it costs the moment and nothing else. Re-scanning this card rolls it again.
      points: 4,
      webhook: 'kitchen-blind',
      hero: { text: 'Nothing happened.' },
    },
  ],
};
