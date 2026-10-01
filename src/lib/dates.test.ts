import { describe, expect, it } from "vitest";
import {
  addDaysKolkata,
  dayKeyKolkata,
  formatDay,
  formatTime,
  isSameDayKolkata,
  kolkataDateFromDayKey,
  startOfDayKolkata,
} from "@/lib/dates";

// Asia/Kolkata is UTC+5:30 with no daylight saving: a Kolkata day starts at
// 18:30 UTC on the previous calendar day.

describe("dayKeyKolkata", () => {
  it("rolls over at 18:30 UTC, not at UTC midnight", () => {
    expect(dayKeyKolkata(new Date("2026-10-01T18:29:59Z"))).toBe("2026-10-01");
    expect(dayKeyKolkata(new Date("2026-10-01T18:30:00Z"))).toBe("2026-10-02");
  });

  it("is still the same Kolkata day late in the UTC evening before", () => {
    // 00:10 UTC on the 2nd is 05:40 IST on the 2nd.
    expect(dayKeyKolkata(new Date("2026-10-02T00:10:00Z"))).toBe("2026-10-02");
  });
});

describe("startOfDayKolkata / kolkataDateFromDayKey", () => {
  it("returns midnight IST as a UTC instant", () => {
    expect(startOfDayKolkata(new Date("2026-10-01T20:00:00Z")).toISOString()).toBe(
      "2026-10-01T18:30:00.000Z",
    );
    expect(kolkataDateFromDayKey("2026-10-02").toISOString()).toBe(
      "2026-10-01T18:30:00.000Z",
    );
  });

  it("round-trips a day key", () => {
    for (const key of ["2026-01-01", "2026-02-28", "2028-02-29", "2026-12-31"]) {
      expect(dayKeyKolkata(kolkataDateFromDayKey(key))).toBe(key);
    }
  });
});

describe("addDaysKolkata", () => {
  const key = (k: string, days: number) =>
    dayKeyKolkata(addDaysKolkata(kolkataDateFromDayKey(k), days));

  it("moves forward across month and year boundaries", () => {
    expect(key("2026-01-31", 1)).toBe("2026-02-01");
    expect(key("2026-12-31", 1)).toBe("2027-01-01");
    expect(key("2028-02-28", 1)).toBe("2028-02-29"); // leap year
  });

  it("moves backward", () => {
    expect(key("2026-03-01", -1)).toBe("2026-02-28");
    expect(key("2027-01-01", -1)).toBe("2026-12-31");
  });

  it("stays on midnight IST", () => {
    const next = addDaysKolkata(kolkataDateFromDayKey("2026-10-02"), 7);
    expect(next.toISOString()).toBe("2026-10-08T18:30:00.000Z");
  });

  it("returns the same day for a zero shift", () => {
    expect(key("2026-10-02", 0)).toBe("2026-10-02");
  });
});

describe("isSameDayKolkata", () => {
  it("compares by Kolkata calendar day", () => {
    const a = new Date("2026-10-01T18:30:00Z"); // 00:00 IST on the 2nd
    const b = new Date("2026-10-02T18:29:59Z"); // 23:59 IST on the 2nd
    const c = new Date("2026-10-02T18:30:00Z"); // 00:00 IST on the 3rd
    expect(isSameDayKolkata(a, b)).toBe(true);
    expect(isSameDayKolkata(b, c)).toBe(false);
  });
});

describe("formatting", () => {
  it("renders times and day labels in IST", () => {
    const instant = new Date("2026-10-01T18:30:00Z");
    expect(formatTime(instant)).toBe("00:00");
    expect(formatDay(instant)).toBe("Fri, 2 Oct 2026");
  });
});
