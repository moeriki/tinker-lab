// The numbers. Settled by the "Points economy and hint cost" ticket.
//
// The scale is deliberately fine-grained: the smallest earnable thing is 1 point, every tile is
// worth 10, and a perfect score is 100. That is what makes `hintCost: 3` land -- it is three
// bingo squares or three photos, 30% of a tile in the moment and 3% of the night by 01:00. On a
// coarser scale the modal's "oh yeah, a hint costs you 3 points" stops being a joke and becomes
// pocket change.

export default {
  // Every hint after the first costs this. The first reveal per team, across all games, is free:
  // the modal announces the price as a gift rather than a fine.
  hintCost: 3,
  firstHintFree: true,

  // Every tile is worth this, flat -- ten tiles, ten points each, a ceiling of exactly 100. A
  // game spends its budget however its own shape wants (per square, per photo, per step, plus a
  // completion bonus where the units do not divide evenly), but the total may not exceed it.
  // This is the contract the per-game tickets author against; nothing reads it at runtime.
  tilePoints: 10,

  // Standings. Band 1 is a true rank; band 2 is proximity to the podium rather than a slice of
  // the field, so a near-tie is "close" no matter how many teams sit in between it and third.
  podiumSize: 3,
  podiumGap: 30,

  // The one comparative signal a team gets all night, so each line has to be true across the
  // whole width of its band. Four of them, not three: `fresh` is a team on exactly zero, which
  // the thresholds alone would scatter across the other bands depending on the time of night.
  //
  // `fresh` may not say "welcome" or "you just got here". A team can play hard for two hours,
  // submit to nothing but the resolve games, and still sit on zero -- those are not scored until
  // game end. "Nothing on the board yet" is true for them and for the team that walked in a
  // minute ago; "you just arrived" would be an insult to one of them.
  //
  // `rest` keeps the mission's own words, and they only became cruel once zero moved out: every
  // team that lands here now has actually played and is actually losing.
  standingsBands: {
    fresh: 'Nothing on the board yet. That is a state, not a verdict.',
    podium: 'Top three. Enjoy it — nobody else can see it.',
    chasing: 'The top three is catchable from here. That is all we are prepared to say.',
    rest: 'Your effort is appreciated.',
  },
};
