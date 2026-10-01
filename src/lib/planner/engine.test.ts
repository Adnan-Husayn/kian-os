import { describe, expect, it } from "vitest";
import {
  suggestPlan,
  type EngineTaskInput,
  type SuggestPlanInput,
} from "@/lib/planner/engine";
import { kolkataDateFromDayKey } from "@/lib/dates";

const REFERENCE = kolkataDateFromDayKey("2026-10-02");
const due = (key: string) => kolkataDateFromDayKey(key);

function task(
  id: string,
  overrides: Partial<EngineTaskInput> = {},
): EngineTaskInput {
  return {
    id,
    title: id,
    estimatedMinutes: 30,
    priority: "MEDIUM",
    dueDate: null,
    ...overrides,
  };
}

function plan(
  tasks: EngineTaskInput[],
  overrides: Partial<SuggestPlanInput> = {},
) {
  return suggestPlan({
    availableMinutes: 480,
    tasks,
    energyLevel: "medium",
    referenceDate: REFERENCE,
    ...overrides,
  });
}

const ids = (result: ReturnType<typeof plan>) =>
  result.scheduled.map((s) => s.taskId);

describe("suggestPlan: capacity", () => {
  it("never schedules more than the available minutes", () => {
    const result = plan(
      [task("a", { dueDate: due("2026-10-01") }), task("b", { dueDate: due("2026-10-01") })],
      { availableMinutes: 45 },
    );
    expect(result.scheduledMinutes).toBeLessThanOrEqual(45);
    expect(ids(result)).toEqual(["a"]);
    expect(result.unscheduled).toEqual(["b"]);
    expect(result.unscheduledMinutes).toBe(30);
  });

  it("schedules nothing when there is no time", () => {
    const result = plan([task("a")], { availableMinutes: 0 });
    expect(result.scheduled).toEqual([]);
    expect(result.unscheduled).toEqual(["a"]);
  });

  it("keeps a buffer: non-urgent tasks stop once 75% of the day is filled", () => {
    // 100 minutes available → soft target 75. Four 25-minute tasks, no due dates.
    const tasks = ["a", "b", "c", "d"].map((id) => task(id, { estimatedMinutes: 25 }));
    const result = plan(tasks, { availableMinutes: 100 });
    expect(result.scheduledMinutes).toBe(75);
    expect(result.unscheduled).toEqual(["d"]);
  });

  it("lets urgent tasks use the buffer, up to full capacity", () => {
    const tasks = ["a", "b", "c", "d"].map((id) =>
      task(id, { estimatedMinutes: 25, dueDate: due("2026-10-03") }),
    );
    const result = plan(tasks, { availableMinutes: 100 });
    expect(result.scheduledMinutes).toBe(100);
    expect(result.unscheduled).toEqual([]);
  });
});

describe("suggestPlan: ordering", () => {
  it("ranks by due-date urgency first", () => {
    const result = plan([
      task("no-due"),
      task("later", { dueDate: due("2026-11-15") }),
      task("this-week", { dueDate: due("2026-10-07") }),
      task("soon", { dueDate: due("2026-10-03") }),
      task("overdue", { dueDate: due("2026-09-30") }),
    ]);
    expect(ids(result)).toEqual(["overdue", "soon", "this-week", "later", "no-due"]);
  });

  it("then by priority, then shorter estimates first", () => {
    const result = plan([
      task("low", { priority: "LOW" }),
      task("medium-long", { estimatedMinutes: 45 }),
      task("medium-short", { estimatedMinutes: 20 }),
      task("high", { priority: "HIGH" }),
    ]);
    expect(ids(result)).toEqual(["high", "medium-short", "medium-long", "low"]);
  });

  it("treats a due date as a Kolkata calendar day", () => {
    // 18:30 UTC on the 1st is 00:00 IST on the 2nd: due today, not overdue.
    const dueToday = plan([
      task("x", { dueDate: new Date("2026-10-01T18:30:00Z") }),
      task("overdue", { dueDate: new Date("2026-10-01T18:29:00Z") }),
    ]);
    expect(ids(dueToday)).toEqual(["overdue", "x"]);
  });

  it("accepts ISO strings and ignores invalid due dates", () => {
    const result = plan([
      task("bad", { dueDate: "not a date" }),
      task("iso", { dueDate: "2026-10-03T00:00:00+05:30" }),
    ]);
    expect(ids(result)).toEqual(["iso", "bad"]);
  });
});

describe("suggestPlan: guard rails", () => {
  it("schedules at most three major tasks", () => {
    const tasks = ["a", "b", "c", "d", "e"].map((id) =>
      task(id, { priority: "HIGH", estimatedMinutes: 20 }),
    );
    const result = plan(tasks, { availableMinutes: 600 });
    expect(ids(result)).toEqual(["a", "b", "c"]);
    expect(result.unscheduled).toEqual(["d", "e"]);
  });

  it("counts a 60-minute task as major even at normal priority", () => {
    const tasks = ["a", "b", "c", "d"].map((id) => task(id, { estimatedMinutes: 60 }));
    expect(plan(tasks, { availableMinutes: 600 }).scheduled).toHaveLength(3);
  });

  it("defaults a missing estimate to 30 minutes and floors tiny ones at 15", () => {
    const result = plan([
      task("none", { estimatedMinutes: null }),
      task("tiny", { estimatedMinutes: 5 }),
    ]);
    const minutes = Object.fromEntries(
      result.scheduled.map((s) => [s.taskId, s.plannedMinutes]),
    );
    expect(minutes).toEqual({ none: 30, tiny: 15 });
  });

  it("separates two 90-minute tasks with a small one when it can", () => {
    const result = plan([
      task("long-1", { estimatedMinutes: 90, dueDate: due("2026-10-03") }),
      task("long-2", { estimatedMinutes: 90, dueDate: due("2026-10-03") }),
      task("small", { estimatedMinutes: 15, priority: "LOW" }),
    ]);
    expect(ids(result)).toEqual(["long-1", "small", "long-2"]);
  });
});

describe("suggestPlan: energy and slots", () => {
  const tasks = [
    task("quick", { estimatedMinutes: 15 }),
    task("deep", { estimatedMinutes: 75 }),
    task("mid", { estimatedMinutes: 40 }),
  ];

  it("puts major work first on a high-energy day", () => {
    expect(ids(plan(tasks, { energyLevel: "high" }))[0]).toBe("deep");
  });

  it("starts with the shortest task on a low-energy day", () => {
    expect(ids(plan(tasks, { energyLevel: "low" }))).toEqual(["quick", "mid", "deep"]);
  });

  it("spreads tasks across morning, afternoon and evening", () => {
    expect(plan(tasks).scheduled.map((s) => s.slot)).toEqual([
      "morning",
      "afternoon",
      "evening",
    ]);
  });

  it("is deterministic", () => {
    expect(plan(tasks)).toEqual(plan([...tasks].reverse()));
  });
});
