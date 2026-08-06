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
  'NO REFUNDS',
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
 * about points, which is why that page and not the showdown: the disclaimer undercuts the
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
