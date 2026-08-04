// Shown when a team scans a hunt step they have not earned. It deliberately does not name the
// game -- knowing something is there is the whole tension.
// See docs/adr/0006-hunt-progress-is-derived-from-scans.md.

export default {
  id: 'too-soon',
  title: "You're not supposed to be here",
  body: `
    <p>Congratulations. You have found something.</p>
    <p>You were not supposed to find it. Not yet. Not like this.</p>
    <p>
      Nothing has been unlocked. Nothing has been awarded. This moment has been
      <em>written down</em>, and it will be read out later.
    </p>
    <p><small>Put it back where you found it. We both know you won't.</small></p>
  `,
  showClose: true,
};
