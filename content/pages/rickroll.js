// Card #17. The one page on this site that reaches off the network on purpose.
//
// Everything else here self-hosts -- five woff2 fonts in `public/fonts`, no CDN, nothing that can
// fail to arrive on the night. This embed breaks that rule, and it is allowed to, because of how
// it fails: whatever is in the frame, the words "a handful of nothing" are still directly under
// it. The joke does not break when the network does. It gets drier.
//
// HOW IT ACTUALLY FAILS, looked at rather than assumed (Chrome 390x844, 2026-08-06). Three
// different pictures, and only two of them are the black rectangle this comment used to promise:
//
//   slow -- the player is up and the video is not. Black, with a spinner. The intended shape.
//   Low Power Mode -- the embed loads fine and simply does not autoplay. A poster frame with a
//     play button on it: still Rick Astley, still funny, and arguably the best of the three.
//   no route to YouTube at all -- the browser paints its OWN error page inside the frame, and
//     that is not ours to style. Chrome fills it light grey with a sad-document glyph; the ink
//     background of `.hero--video` is behind it and never shows. It reads as a broken embed, not
//     as a dead screen. WebKit is untested here and is the half of the party that matters most.
//
// Nothing short of script can fix the third one -- a cross-origin frame gives the parent no
// load signal to swap on, and this page's whole argument is that it needs no script. So the
// frame stays inked (right for the first two, harmless for the third) and the punchline carries
// it, which it does: "a handful of nothing" under a broken embed is still the joke.
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
