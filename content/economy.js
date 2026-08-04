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

  // Copy is still owned by the "Rules page copy and score-band messages" work -- these are the
  // mission's own words, held until that lands. The thresholds above are settled.
  standingsBands: {
    podium: 'You are in the top 3 (amazing)',
    chasing: 'You have a chance for top 3 (work harder)',
    rest: 'Your effort is appreciated',
  },
};
