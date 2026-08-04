// The onboarding questionnaire. Each question feeds at least one game -- that is the point of
// asking it. Shape and copy are settled by the "Onboarding flow and questionnaire" ticket.
//
//   {
//     id: 'height',              // stable; profile_answers.question_id refers to it
//     scope: 'member',           // 'member' asks once per member, 'team' asks once
//     label: 'How tall are you, in cm?',
//     input: 'number',           // text | number | select
//     options: [],               // for input: 'select'
//     feeds: 'average-height',   // documentation only: which game consumes it
//   }

export default [];
