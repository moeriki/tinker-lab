// PROTOTYPE FIXTURE — throwaway. The lights hunt, three steps, so the prototype can show what a
// *step* transition feels like as distinct from a page transition. Hero text is deliberately
// vague, per the domain model. The real one is owned by "Design the lights treasure hunt" (#18).

export default {
  id: 'lights',
  kind: 'hunt',
  title: 'Something in the house',
  points: 25,

  steps: [
    {
      hero: { text: 'Nothing happens?' },
      hints: ['Look up.', 'The room you were just standing in.'],
      webhook: 'hunt-step-1',
    },
    {
      hero: { text: 'That was not nothing. Do it again, somewhere colder.' },
      hints: ['Colder is not a feeling. It is a room.'],
      webhook: 'hunt-step-2',
    },
    {
      hero: { text: 'Last one. It is outside, and it has been watching you all evening.' },
      hints: ['The patio.'],
      webhook: 'hunt-step-3',
    },
  ],
};
