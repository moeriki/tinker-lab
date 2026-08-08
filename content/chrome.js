// The site's chrome: the two strips of nonsense that frame every team-facing page.
//
// This is branding, not a game. It says the same thing to every team, never mentions a score, a
// rank or another team, and nothing on any page depends on having read it -- which is what lets
// both strips be `aria-hidden` decoration rather than content (#14: nothing may be load-bearing).
// Settled in "The five primitives the kit still owes" (#58).
//
// It lives in `content/` for the reason `content/rules.js` does, and NOT in `content/pages/`,
// which is auto-registered at `/p/:pageId` and would mint a live URL serving a bare list of gags.
//
// **One line is missing on purpose.** An early draft carried "HINTS COST YOU POINTS", which reads
// as harmless small print and is not: rule 4 is the one thing on this site hidden until a team
// stumbles into it (MISSION.md), `/rules` withholds it until a hint has actually been bought, and
// the 404 page insists there is no rule 4 either. A banner announcing the debit on every page
// from minute one deletes that. What replaced it -- "YOUR SCORE CAN GO BELOW ZERO" -- is the tease
// `/rules` already prints in public: it concedes a debit exists without naming what one costs.

/**
 * The marquee, scrolling across the top of every page. One long jumble, deliberately unsorted:
 * house rules, mundane complaints from the hosts, small print and the occasional existential
 * lurch, interleaved so no two neighbours share a register. Reading three in a row should not
 * feel like reading a list.
 *
 * The order is **fixed and shuffled once, here**, rather than shuffled per request. The strip is
 * long enough to take minutes to loop, so a guest sees different fragments on different pages
 * without any randomness being involved -- and a fixed order is one that can be read back and
 * checked, which a random one is not.
 *
 * "THE POINTS DO NOT MEAN ANYTHING" and "THE POINTS MEAN EVERYTHING" are both here and are
 * deliberately far apart. Adjacent they are one joke; a couple of minutes apart they are the
 * banner contradicting itself, which is the better one.
 */
export const marquee = [
  'HAVE FUN',
  'GOT ICE?',
  'EVERY PARTY ENDS',
  'WE PUT THE FUN IN NO REFUNDS',
  'TWO PER TEAM',
  'WHOSE COAT IS THIS',
  'THE POINTS DO NOT MEAN ANYTHING',
  'BEST VIEWED ON A PHONE, IN A KITCHEN, SLIGHTLY DRUNK',
  'BE NICE',
  'THE BIN IS FULL',
  'VOID WHERE PROHIBITED',
  'YOU WILL NOT REMEMBER MOST OF TONIGHT',
  'ONE PHONE PER TEAM',
  "I'M TIRED",
  "MANAGEMENT'S DECISION IS FINAL",
  'TIME PASSES',
  'THE BEDROOM IS OFF LIMITS',
  'SOMEBODY CHECK THE OVEN',
  'BATTERIES NOT INCLUDED',
  'NOTHING HERE IS BACKED UP',
  'NOBODY CAN SEE YOUR SCORE',
  'MIND THE STEP',
  'THIS BANNER IS THE ONLY THING THAT MOVES',
  'SOMEBODY MADE THIS BY HAND',
  'YOUR SCORE CAN GO BELOW ZERO',
  'TAKE YOUR GLASS WITH YOU',
  'SERVING SUGGESTION',
  'THE POINTS MEAN EVERYTHING',
  'YOUR COOKIE IS YOUR TEAM',
  "SOMEONE'S PHONE IS RINGING",
  'SCAN RESPONSIBLY',
  'THIS WEBSITE DIES TOMORROW',
  'DO NOT CLEAR YOUR COOKIES',
  'IS THE MUSIC TOO LOUD? NO.',
  'MAY CONTAIN TRACES OF EFFORT',
  'YOU ARE HERE, WHICH IS SOMETHING',
  'THERE IS NO APP TO DOWNLOAD',
  'WE HAVE ENOUGH CRISPS',
  'THE HOSTS ARE NOT ACCEPTING QUESTIONS',
  'NONE OF THIS WAS NECESSARY',
  "PLEASE DON'T SIT ON THAT",
  'AS SEEN ON A PHONE',
  'NOTHING IS LOADING, IT IS ALREADY HERE',
];

/**
 * The status bar along the foot of every page. Two of these are drawn per page load, which is the
 * one thing about the chrome that is *not* fixed -- the marquee churns by scrolling, this one
 * churns by being resampled.
 *
 * The gag pages deliberately rotate rather than shuffle (#28), because there a repeat kills the
 * invitation to scan again. Nobody navigates in order to see the status bar, so a repeat costs
 * nothing here and the precedent does not reach. `statusbar()` samples without replacement, so the
 * only repeat that would actually look like a bug -- the same line twice, side by side -- cannot
 * happen.
 *
 * Every line is something a machine of roughly 1998 vintage would say with total confidence and
 * no useful information, which is the register the strip is imitating.
 */
export const status = [
  'MADE IN MS PAINT™ (SPIRITUALLY)',
  '✦ BEST VIEWED AT 800×600 ✦',
  'PRESS ANY KEY',
  'BDAY.MOERIKI.COM',
  '100% ORGANIC HTML',
  'CTRL+ALT+DEL DOES NOTHING HERE',
  'SESSION EXPIRES WHEN THE PARTY DOES',
  'NO UNSAVED CHANGES',
  'ALL SYSTEMS NOMINAL',
  'DISK: FULL',
  '1 USER ONLINE',
  'SOUND CARD DETECTED',
];

/** How many of `status` are drawn per page load. */
export const STATUS_SLOTS = 2;

/**
 * The sunburst on `/rules`, sitting beside the block that explains the points. Its own words are
 * about points, which is why that page and not `/league`: the disclaimer undercuts the
 * arithmetic the page has just finished doing, four inches away.
 *
 * "100% REAL POINTS" is deliberately absent from the marquee above. Both would be on screen at
 * once on `/rules`, and a gag repeated within one viewport is a mistake rather than a motif.
 */
export const starburst = {
  top: '100% REAL',
  big: 'POINTS',
  fine: '*points subject to availability',
};

/**
 * The rubber stamp on the door -- the arrival screen, the one page every team passes exactly once
 * and the only moment on this site that is genuinely an arrival.
 *
 * The kit drew it reading "R.S.V.P. OR ELSE", which is invite copy: RSVP happens before a party
 * and everyone reading any page of this has already walked in, so the words were dead on every
 * route. What replaced them is the most important sentence on the site. The cookie IS the team
 * (CONTEXT.md), onboarding deliberately ships no sign-out, no rejoin and no recovery (#9), so a
 * team that loses this phone at 22:00 loses the whole night -- and until now nothing anywhere
 * said so. A stamp is how you say it without it becoming a warning notice.
 */
export const stamp = 'DO NOT LOSE THIS PHONE';

/**
 * What the site says to a team with nothing to do (#95). One of these is drawn into the box behind
 * the dashboard's **I'm bored** button, and both of the box's answers close it and do nothing else
 * -- no points, no record, no route. The site makes a suggestion and has no follow-through; that
 * is the whole joke, and it is the reason this list is chrome rather than a game. It says the same
 * thing to every team, never mentions a score or a rank, and nothing depends on having read it.
 *
 * It is a **slot machine**: the sample changes per *press*, not per page load, because teams will
 * pull it all night to see what else is in there. `/js/app.js` resamples from the list on every
 * press and never draws the one already on screen -- with eighteen entries an immediate repeat is
 * the one outcome that reads as broken rather than dry.
 *
 * **The balance across three registers is deliberate and should survive any later edit.** Eight
 * party games a room of twenty-five could actually start, five genuinely useful, five gags. A list
 * that drifts all-gag stops being occasionally worth pressing; one that drifts all-useful stops
 * being funny. Cut down from a batch of fifty by Dieter, 7 Aug.
 *
 * Two entries carry a note. **"Read the rules?"** is the only one pointing at a real page on this
 * site, and it is a pull-through, not navigation: if it ever gains an actual link it stops being a
 * suggestion and this box becomes a menu, which it is not. **"Queue a song?"** is the one place an
 * agent smoothed Dieter's own wording -- his note said *queue song* -- and the copy pass can put
 * it back.
 */
export const bored = [
  // party games -- things a room of twenty-five could actually start
  'Limbo?',
  'Beer pong?',
  'Macarena?',
  'Hide and seek?',
  'Whistle competition?',
  'Staring contest?',
  'Conga line?',
  'Human pyramid?',

  // useful -- the ones that make pressing it occasionally worth something
  'Drink?',
  'Queue a song?',
  'Read the rules?',
  'Check the ice?',
  'Compliment a stranger?',

  // gags -- nothing to do, or nothing you would do
  'Flirt?',
  'Fight club?',
  'Sulk?',
  'Complain?',
  'Cheat?',
];

/** The words on the button that opens it. */
export const boredFace = "I'm bored";

/**
 * The menu bar's words (#76, [ADR-the-menu-bar-is-pinned-to-the-bottom]).
 *
 * The one part of the site's chrome that is **not** decoration: these are links, they differ per
 * request, and a guest who never reads them cannot reach four of the surfaces. Everything above is
 * `aria-hidden` nonsense; this is navigation. It lives here anyway because the words are copy, a
 * copy pass has to be able to find them, and the alternative was six strings inline in a route
 * handler where nobody looking for the site's words would think to look.
 *
 * `who`, `when` and `which build` -- no request, no database. `navFor()` in `src/app.js` reads the
 * admin cookie, `gameHasEnded()` and `IS_DEV` and hands the three booleans down; `/kit` calls the
 * same function with them typed by hand, which is what stops the kit demoing a menu the site has
 * never rendered.
 *
 * **`dev` opens everything, and that is the whole of it** (#96). A dev build has no night to be
 * partway through: `gameHasEnded()` is false there from the first boot to the last, so `recap`
 * and `shots` -- the two words that only exist after the reveal -- were unreachable in the one
 * build anybody develops against. Dev says yes to both, and `showRecap`/`showShots` say yes with
 * it, because a link the route redirects away from is a dead word in the bar.
 *
 * **`board` is dev-only, and not as a preference.** It is the fourth of `devBar()`'s links and the
 * one that had to go somewhere (#96). `/` demands a team; a host on the night holds the admin
 * cookie and no team cookie -- a host is never a team, settled in #76 -- so on a production build
 * this link would land the host on `/welcome` and invite him to register into his own league. It
 * works in dev for the one reason it works at all: `devAttach()` plants BOTH cookies, so the
 * walker is admin and team at once.
 *
 * **`dashboard` is deliberately not a word here.** It was #11's candidate and it meant two
 * different pages depending on who read it -- the host's bird's-eye view, or a guest's tiles. It
 * is `HQ` for one and `games` for the other, which is only safe because a host is never a team.
 *
 * **Width is a budget.** At 390px the bar holds roughly 44 characters including gaps. Five items
 * spend about 8 of those on gaps, so the labels share ~36. The host's five come to 23. #11's own
 * sketch -- `dashboard queue results highlights gallery` -- came to 41 and did not fit, which is
 * how the words got cut rather than the type size.
 *
 * The budget is spent by the NIGHT, and dev does not draw on it. The widest thing a guest or a
 * host can ever hold is still five words and still 23 characters; the six-word bar below exists
 * only in a build no guest loads, which is what let #96 add a word without cutting one.
 */
export const menuFor = ({ admin, ended: reallyEnded, dev = false }) => {
  // A dev build is every hour of the night at once, so it holds the words the reveal unlocks.
  const ended = reallyEnded || dev;

  const ending = ended
    ? [
        { href: '/recap', label: 'recap' },
        { href: '/shots', label: 'shots' },
      ]
    : [];

  // `league` is not gated for the host. #8 locked out showing a GUEST anything comparative all
  // night; the person running the night has to be able to read the rankings whenever they want,
  // including during #77's gap between the freeze and the publish -- which is exactly when they
  // are reading the top three off something.
  if (admin) {
    return [
      // First, where it sat in the strip this replaced, and because it is the only word here
      // pointing at the guest side of the site.
      ...(dev ? [{ href: '/', label: 'board' }] : []),
      { href: '/admin', label: 'HQ' },
      { href: '/league', label: 'league' },
      ...ending,
    ];
  }

  // A guest has no bar at all until the night has ended -- the tiles are the navigation, and this
  // list is empty for five of the night's five hours.
  if (!ended) return [];

  return [
    { href: '/', label: 'games' },
    { href: '/league', label: 'league' },
    ...ending,
  ];
};
