"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { assertSameOrigin } from "@/lib/auth/csrf";
import {
  dayKeySchema,
  monthKeySchema,
  setPlanTasksSchema,
  updateDailyPlanSchema,
  reorderPlanTasksSchema,
  movePlanTaskSchema,
  planTaskRefSchema,
  brainDumpSchema,
  saveJournalSchema,
  cuidSchema,
  type PlanTaskItemInput,
  type UpdateDailyPlanInput,
  type SaveJournalInput,
} from "@/lib/validation";
import {
  kolkataDateFromDayKey,
  addDaysKolkata,
  dayKeyKolkata,
} from "@/lib/dates";

// ---------------------------------------------------------------------------
// DTOs (JSON-serializable)
// ---------------------------------------------------------------------------

export interface PlanTaskDTO {
  /** DailyPlanTask row id */
  id: string;
  taskId: string;
  position: number;
  plannedMinutes: number | null;
  /** Moved forward to a later day; shown as ">" in this day's log. */
  migrated: boolean;
  task: {
    id: string;
    title: string;
    status: string;
    priority: string;
    estimatedMinutes: number | null;
    dueDate: Date | null;
    scheduledStartTime: string | null;
    /** Set when the task was generated from a routine. */
    routineId: string | null;
  };
}

export interface DailyPlanDTO {
  id: string;
  dayKey: string;
  mainFocus: string | null;
  intention: string | null;
  energyLevel: string | null;
  notes: string | null;
  /** "college" | "free" once the day has been started; null before. */
  dayType: string | null;
  tasks: PlanTaskDTO[];
}

export interface JournalDTO {
  id: string;
  dayKey: string;
  content: string | null;
  mood: string | null;
  energy: string | null;
}

export interface ActionResult {
  ok: boolean;
  error?: string;
}

const planInclude = {
  tasks: {
    orderBy: { position: "asc" as const },
    include: {
      task: {
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          estimatedMinutes: true,
          dueDate: true,
          scheduledStartTime: true,
          routineId: true,
        },
      },
    },
  },
};

function toPlanDTO(
  plan: {
    id: string;
    date: Date;
    mainFocus: string | null;
    intention: string | null;
    energyLevel: string | null;
    notes: string | null;
    dayType: string | null;
    tasks: Array<{
      id: string;
      taskId: string;
      position: number;
      plannedMinutes: number | null;
      migratedAt: Date | null;
      task: {
        id: string;
        title: string;
        status: string;
        priority: string;
        estimatedMinutes: number | null;
        dueDate: Date | null;
        scheduledStartTime: string | null;
        routineId: string | null;
      };
    }>;
  },
  dayKey: string,
): DailyPlanDTO {
  return {
    id: plan.id,
    dayKey,
    mainFocus: plan.mainFocus,
    intention: plan.intention,
    energyLevel: plan.energyLevel,
    notes: plan.notes,
    dayType: plan.dayType,
    tasks: plan.tasks.map((pt) => ({
      id: pt.id,
      taskId: pt.taskId,
      position: pt.position,
      plannedMinutes: pt.plannedMinutes,
      migrated: pt.migratedAt !== null,
      task: {
        id: pt.task.id,
        title: pt.task.title,
        status: pt.task.status,
        priority: pt.task.priority,
        estimatedMinutes: pt.task.estimatedMinutes,
        dueDate: pt.task.dueDate,
        scheduledStartTime: pt.task.scheduledStartTime,
        routineId: pt.task.routineId,
      },
    })),
  };
}

// ---------------------------------------------------------------------------
// Daily plans
// ---------------------------------------------------------------------------

/** Read-only fetch of a plan (no creation). Returns null when absent. */
export async function getDailyPlan(dayKey: string): Promise<DailyPlanDTO | null> {
  const user = await requireUser();
  const parsed = dayKeySchema.safeParse(dayKey);
  if (!parsed.success) return null;
  const plan = await prisma.dailyPlan.findUnique({
    where: { userId_date: { userId: user.id, date: kolkataDateFromDayKey(dayKey) } },
    include: planInclude,
  });
  return plan ? toPlanDTO(plan, dayKey) : null;
}

/**
 * Fetch the plan for a day, creating an empty one when it does not exist.
 * Called from server components on page load — no CSRF check (idempotent).
 */
export async function getOrCreateDailyPlan(dayKey: string): Promise<DailyPlanDTO> {
  const user = await requireUser();
  const parsed = dayKeySchema.parse(dayKey);
  const date = kolkataDateFromDayKey(parsed);
  const plan = await prisma.dailyPlan.upsert({
    where: { userId_date: { userId: user.id, date } },
    update: {},
    create: { userId: user.id, date },
    include: planInclude,
  });
  return toPlanDTO(plan, parsed);
}

export async function updateDailyPlan(
  input: UpdateDailyPlanInput,
): Promise<ActionResult> {
  await assertSameOrigin();
  const user = await requireUser();
  const parsed = updateDailyPlanSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid plan input." };
  const { dayKey, ...fields } = parsed.data;
  const date = kolkataDateFromDayKey(dayKey);
  const data: Record<string, string | null> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) data[key] = value;
  }
  await prisma.dailyPlan.upsert({
    where: { userId_date: { userId: user.id, date } },
    update: data,
    create: { userId: user.id, date, ...data },
  });
  revalidatePath("/today");
  revalidatePath("/plan");
  return { ok: true };
}

/**
 * Replace a plan's task list wholesale. Positions follow the array order.
 * Task ids that do not belong to the user are silently dropped.
 */
export async function setPlanTasks(
  dayKey: string,
  items: PlanTaskItemInput[],
): Promise<ActionResult> {
  await assertSameOrigin();
  const user = await requireUser();
  const parsed = setPlanTasksSchema.safeParse({ dayKey, tasks: items });
  if (!parsed.success) return { ok: false, error: "Invalid plan tasks." };
  const date = kolkataDateFromDayKey(parsed.data.dayKey);

  const plan = await prisma.dailyPlan.upsert({
    where: { userId_date: { userId: user.id, date } },
    update: {},
    create: { userId: user.id, date },
    select: { id: true },
  });

  const owned = await prisma.task.findMany({
    where: {
      userId: user.id,
      id: { in: parsed.data.tasks.map((t) => t.taskId) },
    },
    select: { id: true },
  });
  const ownedIds = new Set(owned.map((t) => t.id));
  const rows = parsed.data.tasks
    .filter((t) => ownedIds.has(t.taskId))
    .map((t, index) => ({
      dailyPlanId: plan.id,
      taskId: t.taskId,
      position: index,
      plannedMinutes: t.plannedMinutes ?? null,
    }));

  await prisma.$transaction([
    // Keep ">" (migrated) entries as history, unless that task is being
    // planned on this day again.
    prisma.dailyPlanTask.deleteMany({
      where: {
        dailyPlanId: plan.id,
        OR: [{ migratedAt: null }, { taskId: { in: rows.map((r) => r.taskId) } }],
      },
    }),
    ...(rows.length > 0
      ? [prisma.dailyPlanTask.createMany({ data: rows })]
      : []),
  ]);

  revalidatePath("/today");
  revalidatePath("/plan");
  revalidatePath("/review");
  return { ok: true };
}

/** Append a task to the end of a plan (no-op when already present). */
export async function addTaskToPlan(
  dayKey: string,
  taskId: string,
): Promise<ActionResult> {
  await assertSameOrigin();
  const user = await requireUser();
  const dayParsed = dayKeySchema.safeParse(dayKey);
  const idParsed = cuidSchema.safeParse(taskId);
  if (!dayParsed.success || !idParsed.success)
    return { ok: false, error: "Invalid input." };
  const date = kolkataDateFromDayKey(dayParsed.data);

  const task = await prisma.task.findFirst({
    where: { id: taskId, userId: user.id },
    select: { id: true },
  });
  if (!task) return { ok: false, error: "Task not found." };

  const plan = await prisma.dailyPlan.upsert({
    where: { userId_date: { userId: user.id, date } },
    update: {},
    create: { userId: user.id, date },
    select: { id: true },
  });

  const existing = await prisma.dailyPlanTask.findUnique({
    where: { dailyPlanId_taskId: { dailyPlanId: plan.id, taskId } },
    select: { id: true, migratedAt: true },
  });
  if (existing) {
    // Re-adding a task that was moved away brings it back onto this day.
    if (existing.migratedAt) {
      await prisma.dailyPlanTask.update({
        where: { id: existing.id },
        data: { migratedAt: null },
      });
      revalidatePath("/today");
    }
    return { ok: true };
  }

  const max = await prisma.dailyPlanTask.aggregate({
    where: { dailyPlanId: plan.id },
    _max: { position: true },
  });
  await prisma.dailyPlanTask.create({
    data: {
      dailyPlanId: plan.id,
      taskId,
      position: (max._max.position ?? -1) + 1,
    },
  });
  revalidatePath("/today");
  revalidatePath("/plan");
  return { ok: true };
}

/** Remove a task from a plan (the task itself is untouched). */
export async function removeTaskFromPlan(
  dayKey: string,
  taskId: string,
): Promise<ActionResult> {
  await assertSameOrigin();
  const user = await requireUser();
  const parsed = planTaskRefSchema.safeParse({ dayKey, taskId });
  if (!parsed.success) return { ok: false, error: "Invalid input." };
  const date = kolkataDateFromDayKey(parsed.data.dayKey);
  await prisma.dailyPlanTask.deleteMany({
    where: {
      taskId: parsed.data.taskId,
      dailyPlan: { userId: user.id, date },
    },
  });
  revalidatePath("/today");
  revalidatePath("/plan");
  revalidatePath("/review");
  return { ok: true };
}

/** Persist a new ordering of a plan's tasks (given as task ids in order). */
export async function reorderPlanTasks(
  dayKey: string,
  orderedTaskIds: string[],
): Promise<ActionResult> {
  await assertSameOrigin();
  const user = await requireUser();
  const parsed = reorderPlanTasksSchema.safeParse({ dayKey, orderedTaskIds });
  if (!parsed.success) return { ok: false, error: "Invalid input." };
  const date = kolkataDateFromDayKey(parsed.data.dayKey);
  const plan = await prisma.dailyPlan.findUnique({
    where: { userId_date: { userId: user.id, date } },
    select: { id: true },
  });
  if (!plan) return { ok: false, error: "Plan not found." };

  await prisma.$transaction(
    parsed.data.orderedTaskIds.map((taskId, index) =>
      prisma.dailyPlanTask.updateMany({
        where: { dailyPlanId: plan.id, taskId },
        data: { position: index },
      }),
    ),
  );
  revalidatePath("/today");
  return { ok: true };
}

/**
 * Move a plan task from one day's plan to another, keeping planned minutes.
 * Moving forward leaves the source row in place, marked migrated (">" in the
 * daily log); moving backward removes it.
 */
export async function movePlanTaskToDate(
  taskId: string,
  fromDayKey: string,
  toDayKey: string,
): Promise<ActionResult> {
  await assertSameOrigin();
  const user = await requireUser();
  const parsed = movePlanTaskSchema.safeParse({ taskId, fromDayKey, toDayKey });
  if (!parsed.success) return { ok: false, error: "Invalid input." };

  const task = await prisma.task.findFirst({
    where: { id: parsed.data.taskId, userId: user.id },
    select: { id: true },
  });
  if (!task) return { ok: false, error: "Task not found." };

  const fromDate = kolkataDateFromDayKey(parsed.data.fromDayKey);
  const toDate = kolkataDateFromDayKey(parsed.data.toDayKey);

  const source = await prisma.dailyPlanTask.findFirst({
    where: {
      taskId: parsed.data.taskId,
      dailyPlan: { userId: user.id, date: fromDate },
    },
    select: { id: true, plannedMinutes: true },
  });
  const forward = toDate.getTime() > fromDate.getTime();

  const target = await prisma.dailyPlan.upsert({
    where: { userId_date: { userId: user.id, date: toDate } },
    update: {},
    create: { userId: user.id, date: toDate },
    select: { id: true },
  });

  const alreadyThere = await prisma.dailyPlanTask.findUnique({
    where: {
      dailyPlanId_taskId: { dailyPlanId: target.id, taskId: parsed.data.taskId },
    },
    select: { id: true, migratedAt: true },
  });

  await prisma.$transaction([
    ...(source
      ? [
          forward
            ? prisma.dailyPlanTask.update({
                where: { id: source.id },
                data: { migratedAt: new Date() },
              })
            : prisma.dailyPlanTask.delete({ where: { id: source.id } }),
        ]
      : []),
    ...(alreadyThere
      ? alreadyThere.migratedAt
        ? [
            prisma.dailyPlanTask.update({
              where: { id: alreadyThere.id },
              data: { migratedAt: null },
            }),
          ]
        : []
      : [
          prisma.dailyPlanTask.create({
            data: {
              dailyPlanId: target.id,
              taskId: parsed.data.taskId,
              position: 0,
              plannedMinutes: source?.plannedMinutes ?? null,
            },
          }),
        ]),
  ]);

  // Re-pack positions on the target plan.
  const rows = await prisma.dailyPlanTask.findMany({
    where: { dailyPlanId: target.id },
    orderBy: [{ position: "asc" }, { id: "asc" }],
    select: { id: true },
  });
  await prisma.$transaction(
    rows.map((row, index) =>
      prisma.dailyPlanTask.update({
        where: { id: row.id },
        data: { position: index },
      }),
    ),
  );

  revalidatePath("/today");
  revalidatePath("/plan");
  revalidatePath("/review");
  return { ok: true };
}

/**
 * Gentle "not today": removes the task from the day's plan and returns it to
 * the TODO backlog. Terminal states (DONE/CANCELLED) are left untouched.
 */
export async function notToday(
  taskId: string,
  dayKey: string,
): Promise<ActionResult> {
  await assertSameOrigin();
  const user = await requireUser();
  const parsed = planTaskRefSchema.safeParse({ taskId, dayKey });
  if (!parsed.success) return { ok: false, error: "Invalid input." };
  const date = kolkataDateFromDayKey(parsed.data.dayKey);

  const task = await prisma.task.findFirst({
    where: { id: parsed.data.taskId, userId: user.id },
    select: { id: true, status: true },
  });
  if (!task) return { ok: false, error: "Task not found." };

  await prisma.$transaction([
    prisma.dailyPlanTask.deleteMany({
      where: {
        taskId: parsed.data.taskId,
        dailyPlan: { userId: user.id, date },
      },
    }),
    ...(task.status === "DONE" || task.status === "CANCELLED"
      ? []
      : [
          prisma.task.update({
            where: { id: task.id },
            data: { status: "TODO", completedAt: null },
          }),
        ]),
  ]);

  revalidatePath("/today");
  revalidatePath("/review");
  return { ok: true };
}

/** Toggle a plan task's completion; completing marks the task DONE. */
export async function togglePlanTaskComplete(
  taskId: string,
  done: boolean,
): Promise<ActionResult> {
  await assertSameOrigin();
  const user = await requireUser();
  const idParsed = cuidSchema.safeParse(taskId);
  if (!idParsed.success) return { ok: false, error: "Invalid input." };

  const task = await prisma.task.findFirst({
    where: { id: taskId, userId: user.id },
    select: { id: true },
  });
  if (!task) return { ok: false, error: "Task not found." };

  await prisma.task.update({
    where: { id: task.id },
    data: done
      ? { status: "DONE", completedAt: new Date() }
      : { status: "TODO", completedAt: null },
  });
  revalidatePath("/today");
  revalidatePath("/review");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Journal
// ---------------------------------------------------------------------------

export async function getJournalEntry(dayKey: string): Promise<JournalDTO | null> {
  const user = await requireUser();
  const parsed = dayKeySchema.safeParse(dayKey);
  if (!parsed.success) return null;
  const entry = await prisma.journalEntry.findUnique({
    where: {
      userId_date: { userId: user.id, date: kolkataDateFromDayKey(parsed.data) },
    },
  });
  if (!entry) return null;
  return {
    id: entry.id,
    dayKey: parsed.data,
    content: entry.content,
    mood: entry.mood,
    energy: entry.energy,
  };
}

/** Create or update the journal entry for a day. */
export async function saveJournalEntry(
  input: SaveJournalInput,
): Promise<ActionResult> {
  await assertSameOrigin();
  const user = await requireUser();
  const parsed = saveJournalSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid journal input." };
  const date = kolkataDateFromDayKey(parsed.data.dayKey);
  const data: { content?: string; mood?: string | null; energy?: string | null } = {};
  if (parsed.data.content !== undefined) data.content = parsed.data.content;
  if (parsed.data.mood !== undefined) data.mood = parsed.data.mood;
  if (parsed.data.energy !== undefined) data.energy = parsed.data.energy;
  await prisma.journalEntry.upsert({
    where: { userId_date: { userId: user.id, date } },
    update: data,
    create: {
      userId: user.id,
      date,
      content: parsed.data.content ?? "",
      mood: parsed.data.mood ?? null,
      energy: parsed.data.energy ?? null,
    },
  });
  revalidatePath("/journal");
  return { ok: true };
}

/** Entries for a calendar month (yyyy-MM), newest first. */
export async function listJournalEntries(monthKey: string): Promise<JournalDTO[]> {
  const user = await requireUser();
  const parsed = monthKeySchema.safeParse(monthKey);
  if (!parsed.success) return [];
  const start = kolkataDateFromDayKey(`${parsed.data}-01`);
  const end = addDaysKolkata(start, 32);
  // True start of next month (Kolkata).
  const nextMonthStart = kolkataDateFromDayKey(
    dayKeyKolkata(end).slice(0, 7) + "-01",
  );
  const entries = await prisma.journalEntry.findMany({
    where: {
      userId: user.id,
      date: { gte: start, lt: nextMonthStart },
    },
    orderBy: { date: "desc" },
  });
  return entries.map((entry) => ({
    id: entry.id,
    dayKey: dayKeyKolkata(entry.date),
    content: entry.content,
    mood: entry.mood,
    energy: entry.energy,
  }));
}

// ---------------------------------------------------------------------------
// Brain dump
// ---------------------------------------------------------------------------

/**
 * One Capture row per non-empty line, type UNKNOWN, unprocessed — the inbox
 * triage flow can sort them out later.
 */
export async function brainDump(input: {
  content: string;
}): Promise<ActionResult & { count?: number }> {
  await assertSameOrigin();
  const user = await requireUser();
  const parsed = brainDumpSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Write something first." };
  const lines = parsed.data.content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (lines.length === 0) return { ok: false, error: "Write something first." };
  await prisma.capture.createMany({
    data: lines.map((content) => ({
      userId: user.id,
      content,
      type: "UNKNOWN" as const,
    })),
  });
  revalidatePath("/inbox");
  return { ok: true, count: lines.length };
}
