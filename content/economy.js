// The numbers. Owned by the "Points economy and hint cost" ticket -- these are placeholders that
// keep the spine runnable, not decisions.

export default {
  // Every hint after the first costs this. See docs/adr ... the first reveal per team, across
  // all games, is free: the modal announces the price as a gift rather than a fine.
  hintCost: 3,
  firstHintFree: true,

  // The three vague standings messages on the dashboard header, best band first.
  standingsBands: [
    { topFraction: 0.25, message: 'You are in the top 3 (amazing)' },
    { topFraction: 0.6, message: 'You have a chance for top 3 (work harder)' },
    { topFraction: 1, message: 'Your effort is appreciated' },
  ],
};
