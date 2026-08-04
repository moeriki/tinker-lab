// Card #17. The one page on this site that reaches off the network on purpose.
//
// Everything else here self-hosts -- five woff2 fonts in `public/fonts`, no CDN, nothing that can
// fail to arrive on the night. This embed breaks that rule, and it is allowed to, because of how
// it fails: a slow phone, a dead wifi or an iPhone in Low Power Mode (which blocks autoplay even
// when muted) leaves a black rectangle sitting directly above the words "a handful of nothing".
// The joke does not break when the network does. It gets drier.
//
// `mute=1` is not a compromise, it is the only version that plays. Mobile browsers refuse
// autoplay with sound outright and allow it muted, so the muted embed starts on its own where an
// unmuted one would sit on a poster frame waiting for a tap -- and a rickroll you have to consent
// to is not a rickroll. The player keeps its own unmute control for anyone in a quiet room, and
// the trench coat is recognisable with the sound off anyway.
//
// The title is the setup and the line underneath is the punchline, with the video as the beat in
// between. That is why the h1 does not name the song.

// `&amp;` rather than `&`: this is a URL inside an HTML attribute, and the spec wants ampersands
// escaped there. Nothing here happens to collide with a named entity, so a bare `&` would work by
// luck rather than by rule.
const VIDEO =
  'https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1&amp;mute=1&amp;playsinline=1&amp;rel=0';

export default {
  id: 'rickroll',
  title: "You've found…",
  body: `
    <div class="hero hero--video">
      <iframe class="hero__video" src="${VIDEO}"
              title="Rick Astley — Never Gonna Give You Up"
              allow="autoplay; encrypted-media; picture-in-picture"
              allowfullscreen></iframe>
    </div>
    <p>… a handful of nothing.</p>
    <p><small>No points. No unlock. Just this, and the walk back.</small></p>
  `,
  showClose: true,
};
