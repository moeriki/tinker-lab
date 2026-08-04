// PROTOTYPE FIXTURE — throwaway. A `tally` + photo + trust game, which is the case that never
// returns to the dashboard: submitting sends you back to the game page so the next photo is one
// tap. Included because it is the moment where "animate the tile" has nothing to animate.

export default {
  id: 'snaps',
  kind: 'tally',
  title: 'Evidence',
  photo: true,
  judging: 'trust',
  points: 1,

  hero: {
    text: 'One point per photograph of a guest doing something they would rather you had not photographed. No judging. We trust you. Mostly.',
  },

  hints: ['The kitchen is where people forget there are windows.'],
};
