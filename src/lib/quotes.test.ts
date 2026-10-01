import { describe, expect, it } from "vitest";
import { QUOTES, quoteByline, quoteForDay } from "@/lib/quotes";
import { addDaysKolkata, dayKeyKolkata, kolkataDateFromDayKey } from "@/lib/dates";

const dayAfter = (key: string, n: number) =>
  dayKeyKolkata(addDaysKolkata(kolkataDateFromDayKey(key), n));

describe("QUOTES", () => {
  it("has text and an author for every entry", () => {
    for (const q of QUOTES) {
      expect(q.text.trim().length).toBeGreaterThan(10);
      expect(q.author.trim().length).toBeGreaterThan(0);
    }
  });

  it("marks every quote as either sourced or attributed, never both", () => {
    for (const q of QUOTES) {
      expect(Boolean(q.source) !== Boolean(q.attributed)).toBe(true);
    }
  });

  it("has no duplicates", () => {
    expect(new Set(QUOTES.map((q) => q.text)).size).toBe(QUOTES.length);
  });
});

describe("quoteForDay", () => {
  it("is deterministic for a day", () => {
    expect(quoteForDay("2026-10-02")).toBe(quoteForDay("2026-10-02"));
  });

  it("never repeats on consecutive days", () => {
    for (let i = 0; i < 60; i++) {
      const today = dayAfter("2026-10-02", i);
      expect(quoteForDay(today)).not.toBe(quoteForDay(dayAfter(today, 1)));
    }
  });

  it("shows every quote exactly once per cycle", () => {
    const seen = new Set<string>();
    for (let i = 0; i < QUOTES.length; i++) {
      seen.add(quoteForDay(dayAfter("2026-10-02", i)).text);
    }
    expect(seen.size).toBe(QUOTES.length);
  });

  it("does not show the same author three days running", () => {
    for (let i = 0; i < QUOTES.length; i++) {
      const authors = [0, 1, 2].map(
        (d) => quoteForDay(dayAfter("2026-10-02", i + d)).author,
      );
      expect(new Set(authors).size).toBeGreaterThan(1);
    }
  });

  it("falls back to the first quote for a malformed key", () => {
    expect(quoteForDay("not-a-date")).toBe(QUOTES[0]);
  });
});

describe("quoteByline", () => {
  it("names the source when there is one", () => {
    expect(
      quoteByline({ text: "x", author: "Marcus Aurelius", source: "Meditations, 2.5" }),
    ).toBe("Marcus Aurelius, Meditations, 2.5");
  });

  it("says so when a quote is only attributed", () => {
    expect(
      quoteByline({ text: "x", author: "Napoleon Bonaparte", attributed: true }),
    ).toBe("attributed to Napoleon Bonaparte");
  });
});
