import { describe, expect, it } from "vitest";
import {
  appliesOnWeekday,
  formatMinutes,
  isDayType,
  isoWeekdayOfDayKey,
  minutesFor,
  routinesForDay,
  totalMinutes,
  type RoutineLike,
} from "@/lib/routines";

function routine(id: string, overrides: Partial<RoutineLike> = {}): RoutineLike {
  return {
    id,
    title: id,
    projectId: null,
    minutesCollege: 30,
    minutesFree: 60,
    startTime: null,
    weekdays: [],
    active: true,
    position: 0,
    ...overrides,
  };
}

describe("isoWeekdayOfDayKey", () => {
  it("returns 1 for Monday through 7 for Sunday", () => {
    expect(isoWeekdayOfDayKey("2026-09-28")).toBe(1); // Monday
    expect(isoWeekdayOfDayKey("2026-10-02")).toBe(5); // Friday
    expect(isoWeekdayOfDayKey("2026-10-04")).toBe(7); // Sunday
  });
});

describe("minutesFor", () => {
  it("picks the duration for the kind of day", () => {
    const r = routine("dsa", { minutesCollege: 60, minutesFree: 90 });
    expect(minutesFor(r, "college")).toBe(60);
    expect(minutesFor(r, "free")).toBe(90);
  });

  it("treats a missing or zero duration as skipped", () => {
    expect(minutesFor(routine("x", { minutesCollege: null }), "college")).toBeNull();
    expect(minutesFor(routine("x", { minutesFree: 0 }), "free")).toBeNull();
  });
});

describe("appliesOnWeekday", () => {
  it("runs every day when no weekdays are set", () => {
    for (let d = 1; d <= 7; d++) expect(appliesOnWeekday(routine("x"), d)).toBe(true);
  });

  it("runs only on the listed weekdays", () => {
    const laundry = routine("laundry", { weekdays: [7] });
    expect(appliesOnWeekday(laundry, 7)).toBe(true);
    expect(appliesOnWeekday(laundry, 5)).toBe(false);
  });
});

describe("routinesForDay", () => {
  const routines = [
    routine("gym", { position: 3, minutesCollege: 60, minutesFree: 60, startTime: "20:00" }),
    routine("dsa", { position: 0, minutesCollege: 60, minutesFree: 90 }),
    routine("build", { position: 4, minutesCollege: null, minutesFree: 120 }),
    routine("laundry", { position: 5, weekdays: [7], minutesCollege: null, minutesFree: 45 }),
    routine("paused", { position: 1, active: false }),
  ];

  it("returns active routines with minutes for that kind of day, in order", () => {
    // Friday 2 Oct 2026, college day: no build block, no laundry.
    const day = routinesForDay(routines, "college", "2026-10-02");
    expect(day.map((o) => o.routineId)).toEqual(["dsa", "gym"]);
    expect(day.map((o) => o.minutes)).toEqual([60, 60]);
    expect(totalMinutes(day)).toBe(120);
  });

  it("uses free-day durations and includes free-only routines", () => {
    const day = routinesForDay(routines, "free", "2026-10-02");
    expect(day.map((o) => [o.routineId, o.minutes])).toEqual([
      ["dsa", 90],
      ["gym", 60],
      ["build", 120],
    ]);
  });

  it("adds weekday-only routines on their day", () => {
    // Sunday 4 Oct 2026.
    const day = routinesForDay(routines, "free", "2026-10-04");
    expect(day.map((o) => o.routineId)).toEqual(["dsa", "gym", "build", "laundry"]);
  });

  it("carries the start time and project through", () => {
    const [gym] = routinesForDay(
      [routine("gym", { startTime: "20:00", projectId: "p1" })],
      "college",
      "2026-10-02",
    );
    expect(gym).toMatchObject({ startTime: "20:00", projectId: "p1" });
  });

  it("returns nothing when there are no routines", () => {
    expect(routinesForDay([], "free", "2026-10-02")).toEqual([]);
  });
});

describe("formatMinutes / isDayType", () => {
  it("formats durations", () => {
    expect(formatMinutes(45)).toBe("45m");
    expect(formatMinutes(120)).toBe("2h");
    expect(formatMinutes(215)).toBe("3h 35m");
  });

  it("accepts only the two day types", () => {
    expect(isDayType("college")).toBe(true);
    expect(isDayType("free")).toBe(true);
    expect(isDayType("holiday")).toBe(false);
    expect(isDayType(null)).toBe(false);
  });
});
