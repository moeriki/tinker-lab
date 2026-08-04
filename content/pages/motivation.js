// Card #18. A different line every time you scan it.
//
// The voice is deliberately NOT the house voice. `too-soon` and `no-such-code` are dry, second
// person and faintly menacing; these are sincere, and they mean it. The site is arch everywhere
// else, so the contrast is a one-time resource and this is the page that spends it. No wink, no
// punchline, nothing that turns out to be a joke on the reader.
//
// LINES ROTATE, THEY DO NOT SHUFFLE. Random would serve the same line twice in a row roughly one
// scan in twelve, and the immediate repeat is exactly the outcome that kills "scan it again" --
// it tells you the machine is dumb. Indexing on the team's own scan count makes a repeat
// impossible until they have seen all twelve.
//
// It also holds still on a refresh, because only a real scan moves the count. That matters more
// than it sounds: the thing people do with a line they like is hand the phone to someone, and the
// line has to still be there when they do.

const LINES = [
  'You are, on balance, doing better than you think you are.',
  'Someone in this house is glad you came. Probably more than one.',
  'The thing you have been putting off is smaller than it has become in your head.',
  'You do not have to be interesting tonight. You just have to be here.',
  'Whatever you decided about yourself at nineteen is not binding.',
  'It is fine to leave a conversation. People do it constantly and nobody remembers.',
  'You are allowed to like the things you like without defending them.',
  'The version of you other people describe is kinder than the one in your head.',
  'Drink some water. Less profound, more useful.',
  'Nobody is keeping score of the things you think they are keeping score of.',
  'You have already survived every worst day you have had so far.',
  'Go and talk to whoever is standing on their own. You will both be relieved.',
];

export default {
  id: 'motivation',
  title: 'A message for you',

  // `scanCount` counts this scan, so the first visit is 1 and lands on the first line. A visitor
  // with no team -- someone who typed the URL, or came back after clearing a cookie -- gets 0 and
  // the same first line, which is a fine thing to show a stranger.
  body: ({ scanCount }) => `
    <div class="hero hero--text">
      ${LINES[Math.max(0, scanCount - 1) % LINES.length]}
    </div>
    <p><small>Scan it again if you want another one.</small></p>
  `,

  showClose: true,
};
