import { describe, expect, it } from "vitest";
import { isMonthKey, monthRangeKolkata } from "@/lib/export";

describe("isMonthKey", () => {
  it("accepts yyyy-MM only", () => {
    expect(isMonthKey("2026-09")).toBe(true);
    expect(isMonthKey("2026-12")).toBe(true);
    for (const bad of ["2026-13", "2026-00", "2026-9", "26-09", "2026-09-01", "", "abcd-ef"]) {
      expect(isMonthKey(bad)).toBe(false);
    }
  });
});

describe("monthRangeKolkata", () => {
  it("spans midnight IST on the 1st to midnight IST on the next 1st", () => {
    const range = monthRangeKolkata("2026-09")!;
    expect(range.start.toISOString()).toBe("2026-08-31T18:30:00.000Z");
    expect(range.end.toISOString()).toBe("2026-09-30T18:30:00.000Z");
  });

  it("rolls December into January of the next year", () => {
    const range = monthRangeKolkata("2026-12")!;
    expect(range.start.toISOString()).toBe("2026-11-30T18:30:00.000Z");
    expect(range.end.toISOString()).toBe("2026-12-31T18:30:00.000Z");
  });

  it("handles February in a leap year", () => {
    const range = monthRangeKolkata("2028-02")!;
    const days = (range.end.getTime() - range.start.getTime()) / 86_400_000;
    expect(days).toBe(29);
  });

  it("returns null for a malformed key", () => {
    expect(monthRangeKolkata("2026-13")).toBeNull();
    expect(monthRangeKolkata("nope")).toBeNull();
  });
});
