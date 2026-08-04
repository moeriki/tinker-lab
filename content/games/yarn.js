// PROTOTYPE FIXTURE — throwaway. Exists only so the animation-choreography prototype has a real
// `answer` game to walk through. Not a roster decision; delete with the branch.
//
// This is the one kind that has a genuine "correct, right now" moment: `check()` runs on submit,
// so the tile can go green before the team looks away. Every other kind cannot.

export default {
  id: 'yarn',
  kind: 'answer',
  title: 'The tangle',
  points: 10,

  hero: {
    text: 'There is a cat somewhere in this house. It has been in the wool basket. How many balls of yarn did it get through?',
  },

  hints: ['It is more than three.', 'It is fewer than nine.', 'It is seven.'],

  check: (value) => String(value ?? '').trim() === '7',
};
