/**
 * Deterministic day-planning engine.
 *
 * Pure function — no AI, no network, no clock reads (the caller passes the
 * reference date). Fully unit-testable: same input always yields same output.
 *
 * Rules:
 *  (a) Tasks are scored by due-date urgency (overdue / due within 2 days >
 *      due within a week > due later > no due date), then priority
 *      HIGH > MEDIUM > LOW, then shorter estimates first.
 *  (b) Never schedule more than `availableMinutes` in total.
 *  (c) Keep 20–30% of the day unscheduled: once ~75% of the available time is
 *      filled, only tasks that are due within 2 days (or overdue) may still
 *      be added.
 *  (d) At most 3 "major" tasks (estimatedMinutes >= 60 or HIGH priority).
 *  (e) Small tasks (<= 30m) fill remaining gaps — they are considered in
 *      score order and naturally slot into leftover capacity.
 *  (f) Two 90m+ tasks are never placed back-to-back when a small scheduled
 *      task exists to separate them.
 */

import { dayKeyKolkata } from "@/lib/dates";

export type PlanSlot = "morning" | "afternoon" | "evening";
export type EnergyLevel = "low" | "medium" | "high";
export type EngineTaskPriority = "LOW" | "MEDIUM" | "HIGH";

export interface EngineTaskInput {
  id: string;
  title: string;
  estimatedMinutes: number | null | undefined;
  priority: EngineTaskPriority;
  dueDate: Date | string | null | undefined;
}

export interface SuggestPlanInput {
  /** Total minutes the user has available that day. */
  availableMinutes: number;
  tasks: EngineTaskInput[];
  energyLevel: EnergyLevel;
  /** Day the plan is for. Due-date urgency is measured against this date. */
  referenceDate?: Date;
}

export interface ScheduledItem {
  taskId: string;
  plannedMinutes: number;
  slot: PlanSlot;
}

export interface SuggestPlanResult {
  scheduled: ScheduledItem[];
  unscheduled: string[];
  scheduledMinutes: number;
  unscheduledMinutes: number;
}

const TARGET_UTILIZATION = 0.75;
const MAX_MAJOR_TASKS = 3;
const MAJOR_MINUTES = 60;
const LONG_TASK_MINUTES = 90;
const SMALL_TASK_MINUTES = 30;
/** Fallback when a task has no estimate; also used as a floor. */
const DEFAULT_ESTIMATE_MINUTES = 30;

const PRIORITY_RANK: Record<EngineTaskPriority, number> = {
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

interface NormalizedTask {
  id: string;
  title: string;
  estimatedMinutes: number;
  priority: EngineTaskPriority;
  /** 4 overdue · 3 due within 2 days · 2 due within a week · 1 due later · 0 no due date */
  urgencyTier: number;
  isMajor: boolean;
}

function daysUntilDue(due: Date, reference: Date): number {
  const refKey = dayKeyKolkata(reference);
  const dueKey = dayKeyKolkata(due);
  const ms =
    new Date(`${dueKey}T00:00:00Z`).getTime() -
    new Date(`${refKey}T00:00:00Z`).getTime();
  return Math.round(ms / 86_400_000);
}

function urgencyTierFor(
  due: Date | string | null | undefined,
  reference: Date,
): number {
  if (!due) return 0;
  const dueDate = due instanceof Date ? due : new Date(due);
  if (Number.isNaN(dueDate.getTime())) return 0;
  const days = daysUntilDue(dueDate, reference);
  if (days < 0) return 4; // overdue — most urgent
  if (days <= 2) return 3; // due within 2 days
  if (days <= 7) return 2; // due within a week
  return 1; // due later
}

function normalize(
  task: EngineTaskInput,
  reference: Date,
): NormalizedTask {
  const raw = task.estimatedMinutes;
  const estimatedMinutes =
    typeof raw === "number" && Number.isFinite(raw)
      ? Math.max(15, Math.round(raw))
      : DEFAULT_ESTIMATE_MINUTES;
  return {
    id: task.id,
    title: task.title,
    estimatedMinutes,
    priority: task.priority,
    urgencyTier: urgencyTierFor(task.dueDate, reference),
    isMajor: estimatedMinutes >= MAJOR_MINUTES || task.priority === "HIGH",
  };
}

/** Lower comparator value = should be scheduled earlier. */
function compareScore(a: NormalizedTask, b: NormalizedTask): number {
  if (a.urgencyTier !== b.urgencyTier) return b.urgencyTier - a.urgencyTier;
  const pa = PRIORITY_RANK[a.priority];
  const pb = PRIORITY_RANK[b.priority];
  if (pa !== pb) return pb - pa;
  if (a.estimatedMinutes !== b.estimatedMinutes)
    return a.estimatedMinutes - b.estimatedMinutes;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * Reorder scheduled tasks for the day's flow:
 *  - energy "high": major tasks first (mornings carry the heavy work);
 *  - energy "low": short tasks first (ease into the day);
 *  - energy "medium": pure score order.
 * Then separate any two adjacent 90m+ tasks with a small task when possible.
 */
function orderForDay(
  scheduled: NormalizedTask[],
  energyLevel: EnergyLevel,
): NormalizedTask[] {
  const byScore = [...scheduled].sort(compareScore);
  let ordered: NormalizedTask[];
  if (energyLevel === "high") {
    ordered = byScore.sort((a, b) => {
      const major = Number(b.isMajor) - Number(a.isMajor);
      return major !== 0 ? major : compareScore(a, b);
    });
  } else if (energyLevel === "low") {
    ordered = byScore.sort((a, b) => {
      const len = a.estimatedMinutes - b.estimatedMinutes;
      return len !== 0 ? len : compareScore(a, b);
    });
  } else {
    ordered = byScore;
  }

  // Rule (f): never two 90m+ tasks back-to-back when a small task can split them.
  const isLong = (t: NormalizedTask) => t.estimatedMinutes >= LONG_TASK_MINUTES;
  const isSmall = (t: NormalizedTask) =>
    t.estimatedMinutes <= SMALL_TASK_MINUTES;
  const result: NormalizedTask[] = [];
  const rest = [...ordered];
  while (rest.length > 0) {
    const next = rest.shift()!;
    const prev = result[result.length - 1];
    if (prev && isLong(prev) && isLong(next)) {
      const smallIdx = rest.findIndex(isSmall);
      if (smallIdx >= 0) {
        const [small] = rest.splice(smallIdx, 1);
        result.push(small, next);
        continue;
      }
    }
    result.push(next);
  }
  return result;
}

function slotForIndex(index: number, total: number): PlanSlot {
  if (total <= 0) return "morning";
  const morningEnd = Math.ceil(total / 3);
  const afternoonEnd = Math.ceil((2 * total) / 3);
  if (index < morningEnd) return "morning";
  if (index < afternoonEnd) return "afternoon";
  return "evening";
}

export function suggestPlan(input: SuggestPlanInput): SuggestPlanResult {
  const capacity = Math.max(0, Math.floor(input.availableMinutes));
  const target = Math.floor(capacity * TARGET_UTILIZATION);
  const reference = input.referenceDate ?? new Date();

  const sorted = input.tasks
    .map((t) => normalize(t, reference))
    .sort(compareScore);

  // Greedy pass in score order with the guard rails:
  //  - (d) major-task cap, (b) hard capacity, (c) 75% soft target that only
  //    urgent (overdue / due within 2 days) tasks may exceed.
  const scheduled: NormalizedTask[] = [];
  const scheduledIds = new Set<string>();
  let used = 0;
  let majorCount = 0;

  for (const task of sorted) {
    if (task.isMajor && majorCount >= MAX_MAJOR_TASKS) continue; // (d)
    if (used + task.estimatedMinutes > capacity) continue; // (b)
    if (used >= target && task.urgencyTier < 3) continue; // (c): keep the buffer
    scheduled.push(task);
    scheduledIds.add(task.id);
    used += task.estimatedMinutes;
    if (task.isMajor) majorCount += 1;
  }

  const ordered = orderForDay(scheduled, input.energyLevel);
  const scheduledItems: ScheduledItem[] = ordered.map((task, index) => ({
    taskId: task.id,
    plannedMinutes: task.estimatedMinutes,
    slot: slotForIndex(index, ordered.length),
  }));

  const unscheduled = sorted
    .filter((t) => !scheduledIds.has(t.id))
    .map((t) => t.id);
  const unscheduledMinutes = sorted
    .filter((t) => !scheduledIds.has(t.id))
    .reduce((sum, t) => sum + t.estimatedMinutes, 0);

  return {
    scheduled: scheduledItems,
    unscheduled,
    scheduledMinutes: used,
    unscheduledMinutes,
  };
}

/** Slot labels for UI grouping, in day order. */
export const PLAN_SLOTS: { value: PlanSlot; label: string }[] = [
  { value: "morning", label: "Morning" },
  { value: "afternoon", label: "Afternoon" },
  { value: "evening", label: "Evening" },
];
