// Free-text answers, compared the way a human would compare them. Settled in #9.
//
// The five harvest questions are answered honestly at onboarding and counted hours later by Herd
// Mentality, which scores a team's PREDICTION against the answer most teams actually gave. That
// count only means anything if "Socks", "socks " and "sock" are one answer rather than three --
// so answers are stored verbatim and normalised at counting time, never on the way in. What a
// team typed is preserved; what we do with it is our problem.
//
// Fuzziness is deliberately weak on short words, and that is the whole design. One edit turns
// `cat` into `bat` and `bear` into `beer`, and on "name an animal you would not want to fight"
// those are two teams DISAGREEING, not one team typing badly. Merging them would score a herd
// answer that nobody gave. The budget is therefore length-scaled -- roughly one edit per five
// characters -- and zero below five characters, where every neighbour is a different word.
//
// Human Bingo wants this too: a stranger typing another team's word across a loud kitchen should
// survive a slipped key, which is why content/team-names.js refuses to hold two words close
// enough to be confused, and refuses any word short enough to get a budget of zero.

const EDITS_PER = 5; // one edit of slack per five characters
const MAX_EDITS = 2; // and never more than two, however long the word
const EXACT_BELOW = 5; // under five characters, neighbours are different words, not typos

/**
 * Everything that is presentation rather than answer: case, accents, punctuation, stray spacing,
 * and a trailing plural. `ss` is left alone so `glass` does not become `gla`, and a word of three
 * characters or fewer keeps its `s` because `gas` and `bus` are not plurals.
 */
export function normalise(value) {
  const flattened = String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');

  if (flattened.length > 3 && flattened.endsWith('s') && !flattened.endsWith('ss')) {
    return flattened.slice(0, -1);
  }
  return flattened;
}

/**
 * Levenshtein distance, abandoned as soon as it cannot come in under `ceiling`. Two rolling rows
 * rather than a full matrix: these are single words, but this runs once per pair per cluster and
 * there is no reason to allocate a grid for it.
 */
function editDistance(a, b, ceiling) {
  if (Math.abs(a.length - b.length) > ceiling) return ceiling + 1;

  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);

  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    let best = i;

    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + cost);
      if (current[j] < best) best = current[j];
    }

    // Every remaining row can only add to the best score on this one, so once the whole row is
    // over budget the answer is settled.
    if (best > ceiling) return ceiling + 1;
    previous = current;
  }

  return previous[b.length];
}

/** How many edits two normalised answers are allowed, given the shorter of the two. */
export function editBudget(a, b) {
  const shortest = Math.min(a.length, b.length);
  if (shortest < EXACT_BELOW) return 0;
  return Math.min(Math.floor(shortest / EDITS_PER), MAX_EDITS);
}

/** Whether two raw answers are the same answer. Normalises both first. */
export function fuzzyEquals(left, right) {
  const a = normalise(left);
  const b = normalise(right);

  if (!a || !b) return false;
  if (a === b) return true;

  const budget = editBudget(a, b);
  return budget > 0 && editDistance(a, b, budget) <= budget;
}

/**
 * Group raw answers into clusters of the same answer, commonest first.
 *
 * Each cluster's `answer` is the spelling MOST TEAMS actually typed, not the first one seen and
 * not a normalised stub -- because this string gets shown to humans at the end of the night, and
 * "sock" is a worse thing to put on a screen than "socks" when eleven people wrote the latter.
 *
 * Ties are broken by first appearance, so the order is stable across runs -- `resolve()` is
 * re-runnable by `/admin/rescore` and must not hand out different points the second time.
 */
export function cluster(values) {
  const clusters = [];

  for (const raw of values) {
    const normalised = normalise(raw);
    if (!normalised) continue;

    const found = clusters.find((candidate) => fuzzyEquals(candidate.seed, normalised));
    const target = found ?? { seed: normalised, count: 0, spellings: new Map() };
    if (!found) clusters.push(target);

    target.count += 1;
    const trimmed = String(raw).trim();
    target.spellings.set(trimmed, (target.spellings.get(trimmed) ?? 0) + 1);
  }

  return clusters
    .map(({ seed, count, spellings }) => {
      const [answer] = [...spellings.entries()].reduce((best, entry) =>
        entry[1] > best[1] ? entry : best,
      );
      return { answer, count, variants: [...spellings.keys()], seed };
    })
    .sort((a, b) => b.count - a.count);
}

/** The single answer most teams gave, or null when nobody answered at all. */
export const modalAnswer = (values) => cluster(values)[0] ?? null;
