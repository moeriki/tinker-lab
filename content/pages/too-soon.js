// Shown when a team scans a hunt step they have not earned. It deliberately does not name the
// game -- knowing something is there is the whole tension.
// See docs/adr/hunt-progress-is-derived-from-scans.md.
//
// IT DENIES, IT DOES NOT ACKNOWLEDGE (#18). The previous copy opened "Congratulations. You have
// found something" and promised the moment would be read out later, which handed a team that had
// stumbled onto a hunt card two things: confirmation that a trail exists, and a thread to pull.
// The lights hunt is built on a house that flatly denies everything -- its step page reads
// "Nothing happened?" while a lamp five metres away changes colour -- and this is the same voice
// from the other side. A dead end while they are playing: no clues, nothing to work with.
//
// The rejected scan is still recorded exactly as it was. We simply stop advertising it, which
// costs the team nothing and makes the reveal land harder for not having been promised.
//
// Shared with the riddle hunt (#27), so this register now covers both trails.

export default {
  id: 'too-soon',
  title: 'Move along',
  body: `
    <p>Move along. Nothing to see here.</p>
  `,
  showClose: true,
};
