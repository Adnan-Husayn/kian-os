import { describe, expect, it } from "vitest";
import { parseCapture } from "@/lib/capture/parse";
import { kolkataDateFromDayKey } from "@/lib/dates";

// Friday 2 October 2026, 11:30 IST.
const NOW = new Date("2026-10-02T06:00:00Z");
const day = (key: string) => kolkataDateFromDayKey(key).toISOString();

describe("parseCapture: type prefixes", () => {
  it("detects each prefix and strips it from the title", () => {
    expect(parseCapture("idea: build a kite", NOW)).toMatchObject({
      type: "IDEA",
      title: "Build a kite",
    });
    expect(parseCapture("note - bring the charger", NOW)).toMatchObject({
      type: "NOTE",
      title: "Bring the charger",
    });
    expect(parseCapture("todo: pay electricity bill", NOW)).toMatchObject({
      type: "TASK",
      title: "Pay electricity bill",
    });
    expect(parseCapture("TASK - Renew passport", NOW)).toMatchObject({
      type: "TASK",
      title: "Renew passport",
    });
    expect(parseCapture("reminder: water the plants", NOW)).toMatchObject({
      type: "REMINDER",
      title: "Water the plants",
    });
  });

  it("leaves unprefixed text as UNKNOWN", () => {
    expect(parseCapture("buy milk", NOW)).toMatchObject({
      type: "UNKNOWN",
      title: "Buy milk",
    });
  });

  it("does not treat a prefix word mid-sentence as a prefix", () => {
    expect(parseCapture("great idea: nope", NOW).type).toBe("UNKNOWN");
  });

  it("returns an empty UNKNOWN capture for blank input", () => {
    expect(parseCapture("   ", NOW)).toEqual({ title: "", type: "UNKNOWN" });
  });
});

describe("parseCapture: date hints", () => {
  it("schedules 'today' and 'tomorrow' and strips the word", () => {
    const today = parseCapture("todo - pay bill today", NOW);
    expect(today.title).toBe("Pay bill");
    expect(today.scheduledDate?.toISOString()).toBe(day("2026-10-02"));
    expect(today.dateLabel).toBe("Today");

    const tomorrow = parseCapture("call the bank tomorrow", NOW);
    expect(tomorrow.title).toBe("Call the bank");
    expect(tomorrow.scheduledDate?.toISOString()).toBe(day("2026-10-03"));
    expect(tomorrow.dateLabel).toBe("Tomorrow");
  });

  it("puts a reminder's date on dueDate, not scheduledDate", () => {
    const parsed = parseCapture("remind me to call Nani tomorrow", NOW);
    expect(parsed.type).toBe("REMINDER");
    expect(parsed.title).toBe("Call Nani");
    expect(parsed.dueDate?.toISOString()).toBe(day("2026-10-03"));
    expect(parsed.scheduledDate).toBeUndefined();
  });

  it("resolves 'next week' to seven days out", () => {
    const parsed = parseCapture("plan trip next week", NOW);
    expect(parsed.title).toBe("Plan trip");
    expect(parsed.scheduledDate?.toISOString()).toBe(day("2026-10-09"));
    expect(parsed.dateLabel).toBe("Fri, 9 Oct");
  });

  it("resolves a weekday to its next occurrence and drops a dangling preposition", () => {
    const parsed = parseCapture("gym on monday", NOW);
    expect(parsed.title).toBe("Gym");
    expect(parsed.scheduledDate?.toISOString()).toBe(day("2026-10-05"));
    expect(parsed.dateLabel).toBe("Mon, 5 Oct");
  });

  it("understands weekday abbreviations", () => {
    expect(parseCapture("dentist wed", NOW).scheduledDate?.toISOString()).toBe(
      day("2026-10-07"),
    );
  });

  it("treats today's own weekday as today", () => {
    const parsed = parseCapture("friday review", NOW);
    expect(parsed.title).toBe("Review");
    expect(parsed.scheduledDate?.toISOString()).toBe(day("2026-10-02"));
    expect(parsed.dateLabel).toBe("Today");
  });

  it("anchors 'today' to the Kolkata day, not the UTC day", () => {
    // 19:00 UTC on the 2nd is already 00:30 IST on the 3rd.
    const lateNight = new Date("2026-10-02T19:00:00Z");
    expect(
      parseCapture("stretch today", lateNight).scheduledDate?.toISOString(),
    ).toBe(day("2026-10-03"));
  });

  it("keeps the original text as the title when only a date word was typed", () => {
    expect(parseCapture("tomorrow", NOW).title).toBe("Tomorrow");
  });

  it("leaves dates undefined when there is no hint", () => {
    const parsed = parseCapture("idea: a reading list", NOW);
    expect(parsed.scheduledDate).toBeUndefined();
    expect(parsed.dueDate).toBeUndefined();
    expect(parsed.dateLabel).toBeUndefined();
  });
});
