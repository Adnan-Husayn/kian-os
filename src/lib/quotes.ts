/**
 * Quote of the day, shown on Today.
 *
 * Accuracy matters here: many famous "quotes" by these figures are later
 * inventions. Entries with a `source` come from a named work in a
 * public-domain translation; entries marked `attributed` are traditional
 * attributions with no reliable primary source, and the UI says so.
 */

export interface Quote {
  text: string;
  author: string;
  /** Work the line comes from, when it can be traced. */
  source?: string;
  /** True when the line is traditionally credited to the author but unsourced. */
  attributed?: boolean;
}

export const QUOTES: readonly Quote[] = [
  // Marcus Aurelius — Meditations (tr. George Long)
  {
    text: "No longer talk at all about the kind of man that a good man ought to be, but be such.",
    author: "Marcus Aurelius",
    source: "Meditations, 10.16",
  },
  {
    text: "Do every act of thy life as if it were the last.",
    author: "Marcus Aurelius",
    source: "Meditations, 2.5",
  },
  {
    text: "Such as are thy habitual thoughts, such also will be the character of thy mind.",
    author: "Marcus Aurelius",
    source: "Meditations, 5.16",
  },
  {
    text: "The best way of avenging thyself is not to become like the wrong doer.",
    author: "Marcus Aurelius",
    source: "Meditations, 6.6",
  },
  {
    text: "Do not act as if thou wert going to live ten thousand years. While thou livest, while it is in thy power, be good.",
    author: "Marcus Aurelius",
    source: "Meditations, 4.17",
  },

  // Socrates — as recorded by Plato (tr. Benjamin Jowett)
  {
    text: "The unexamined life is not worth living.",
    author: "Socrates",
    source: "Plato, Apology",
  },
  {
    text: "Not life, but a good life, is to be chiefly valued.",
    author: "Socrates",
    source: "Plato, Crito",
  },
  {
    text: "Wonder is the feeling of a philosopher, and philosophy begins in wonder.",
    author: "Socrates",
    source: "Plato, Theaetetus",
  },

  // Alexander the Great
  {
    text: "I had rather excel others in the knowledge of what is excellent, than in the extent of my power and dominion.",
    author: "Alexander the Great",
    source: "Plutarch, Life of Alexander",
  },
  {
    text: "There is nothing impossible to him who will try.",
    author: "Alexander the Great",
    attributed: true,
  },
  {
    text: "I am not afraid of an army of lions led by a sheep; I am afraid of an army of sheep led by a lion.",
    author: "Alexander the Great",
    attributed: true,
  },

  // Napoleon Bonaparte
  {
    text: "Impossible is a word to be found only in the dictionary of fools.",
    author: "Napoleon Bonaparte",
    attributed: true,
  },
  {
    text: "Victory belongs to the most persevering.",
    author: "Napoleon Bonaparte",
    attributed: true,
  },
  {
    text: "Take time to deliberate, but when the time for action has arrived, stop thinking and go in.",
    author: "Napoleon Bonaparte",
    attributed: true,
  },
  {
    text: "The truest wisdom is a resolute determination.",
    author: "Napoleon Bonaparte",
    attributed: true,
  },

  // Sultan Mehmed II, the Conqueror
  {
    text: "Either I will conquer Constantinople, or Constantinople will conquer me.",
    author: "Sultan Mehmed II",
    attributed: true,
  },
  {
    text: "If a single hair of my beard knew my plans, I would pluck it out.",
    author: "Sultan Mehmed II",
    attributed: true,
  },

  // In the same spirit
  {
    text: "It is not that we have a short space of time, but that we waste much of it.",
    author: "Seneca",
    source: "On the Shortness of Life",
  },
  {
    text: "Men are disturbed, not by things, but by the principles and notions which they form concerning things.",
    author: "Epictetus",
    source: "Enchiridion, 5",
  },
  {
    text: "Better to live one day as a tiger than a thousand years as a sheep.",
    author: "Tipu Sultan",
    attributed: true,
  },
];

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/**
 * Step used to walk the list: the smallest stride above a third of its
 * length that shares no factor with it. Being coprime, it still visits every
 * quote once per cycle, while hopping between authors instead of showing one
 * author several days running (the list is grouped by author).
 */
function strideFor(length: number): number {
  let stride = Math.max(1, Math.floor(length / 3) + 1);
  while (gcd(stride, length) !== 1) stride += 1;
  return stride;
}

/**
 * The quote for a yyyy-MM-dd day key. Deterministic (same day → same quote);
 * consecutive days never repeat and every quote appears once per cycle.
 */
export function quoteForDay(dayKey: string): Quote {
  const dayNumber = Math.floor(
    new Date(`${dayKey}T00:00:00Z`).getTime() / 86_400_000,
  );
  if (!Number.isFinite(dayNumber)) return QUOTES[0]!;
  const n = QUOTES.length;
  const index = (((dayNumber * strideFor(n)) % n) + n) % n;
  return QUOTES[index]!;
}

/** Byline: "Marcus Aurelius, Meditations, 2.5" or "attributed to Napoleon Bonaparte". */
export function quoteByline(quote: Quote): string {
  if (quote.attributed) return `attributed to ${quote.author}`;
  return quote.source ? `${quote.author}, ${quote.source}` : quote.author;
}
