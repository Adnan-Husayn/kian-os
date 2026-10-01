"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { assertSameOrigin } from "@/lib/auth/csrf";
import type { ActionResult, ActionResultWithId } from "@/lib/action-result";
import { cuidSchema, dayKeySchema } from "@/lib/validation";
import { addDaysKolkata, kolkataDateFromDayKey } from "@/lib/dates";
import { routinesForDay, type DayType } from "@/lib/routines";

const minutesSchema = z.number().int().min(5).max(600).nullable();

const routineInputSchema = z.object({
  title: z.string().trim().min(1).max(200),
  projectId: cuidSchema.nullable(),
  minutesCollege: minutesSchema,
  minutesFree: minutesSchema,
  startTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .nullable(),
  weekdays: z.array(z.number().int().min(1).max(7)).max(7),
});

export type RoutineInput = z.infer<typeof routineInputSchema>;

const dayTypeSchema = z.enum(["college", "free"]);

export interface RoutineDTO extends RoutineInput {
  id: string;
  active: boolean;
  position: number;
  projectName: string | null;
  /** Days this routine was completed in the last 7 days (including today). */
  doneLast7: number;
}

function revalidateRoutinePaths() {
  revalidatePath("/routines");
  revalidatePath("/today");
}

/** Resolve a project id to one the user owns, or null. */
async function ownedProjectId(
  userId: string,
  projectId: string | null,
): Promise<string | null> {
  if (!projectId) return null;
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId },
    select: { id: true },
  });
  return project?.id ?? null;
}

/** All of the user's routines with a 7-day completion count. */
export async function listRoutines(todayKey: string): Promise<RoutineDTO[]> {
  const user = await requireUser();
  const today = kolkataDateFromDayKey(dayKeySchema.parse(todayKey));
  const weekAgo = addDaysKolkata(today, -6);

  const [routines, done] = await Promise.all([
    prisma.routine.findMany({
      where: { userId: user.id },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      include: { project: { select: { name: true } } },
    }),
    prisma.task.groupBy({
      by: ["routineId"],
      where: {
        userId: user.id,
        routineId: { not: null },
        status: "DONE",
        scheduledDate: { gte: weekAgo, lte: today },
      },
      _count: { _all: true },
    }),
  ]);
  const doneByRoutine = new Map(done.map((d) => [d.routineId, d._count._all]));

  return routines.map((r) => ({
    id: r.id,
    title: r.title,
    projectId: r.projectId,
    projectName: r.project?.name ?? null,
    minutesCollege: r.minutesCollege,
    minutesFree: r.minutesFree,
    startTime: r.startTime,
    weekdays: r.weekdays,
    active: r.active,
    position: r.position,
    doneLast7: doneByRoutine.get(r.id) ?? 0,
  }));
}

export async function createRoutine(
  input: RoutineInput,
): Promise<ActionResultWithId> {
  await assertSameOrigin();
  const user = await requireUser();
  const parsed = routineInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Give the routine a name and valid durations." };
  }
  if (parsed.data.minutesCollege === null && parsed.data.minutesFree === null) {
    return { ok: false, error: "Set minutes for at least one kind of day." };
  }

  const max = await prisma.routine.aggregate({
    where: { userId: user.id },
    _max: { position: true },
  });
  const row = await prisma.routine.create({
    data: {
      ...parsed.data,
      projectId: await ownedProjectId(user.id, parsed.data.projectId),
      userId: user.id,
      position: (max._max.position ?? -1) + 1,
    },
    select: { id: true },
  });
  revalidateRoutinePaths();
  return { ok: true, id: row.id };
}

export async function updateRoutine(
  id: string,
  input: RoutineInput,
): Promise<ActionResult> {
  await assertSameOrigin();
  const user = await requireUser();
  const parsed = routineInputSchema.safeParse(input);
  if (!cuidSchema.safeParse(id).success || !parsed.success) {
    return { ok: false, error: "Give the routine a name and valid durations." };
  }
  if (parsed.data.minutesCollege === null && parsed.data.minutesFree === null) {
    return { ok: false, error: "Set minutes for at least one kind of day." };
  }

  const result = await prisma.routine.updateMany({
    where: { id, userId: user.id },
    data: {
      ...parsed.data,
      projectId: await ownedProjectId(user.id, parsed.data.projectId),
    },
  });
  if (result.count === 0) return { ok: false, error: "Routine not found." };
  revalidateRoutinePaths();
  return { ok: true };
}

/** Pause or resume a routine. Paused routines stop appearing on new days. */
export async function setRoutineActive(
  id: string,
  active: boolean,
): Promise<ActionResult> {
  await assertSameOrigin();
  const user = await requireUser();
  if (!cuidSchema.safeParse(id).success) {
    return { ok: false, error: "Invalid input." };
  }
  const result = await prisma.routine.updateMany({
    where: { id, userId: user.id },
    data: { active },
  });
  if (result.count === 0) return { ok: false, error: "Routine not found." };
  revalidateRoutinePaths();
  return { ok: true };
}

/** Delete a routine. Tasks it already created stay as history. */
export async function deleteRoutine(id: string): Promise<ActionResult> {
  await assertSameOrigin();
  const user = await requireUser();
  if (!cuidSchema.safeParse(id).success) {
    return { ok: false, error: "Invalid input." };
  }
  await prisma.routine.deleteMany({ where: { id, userId: user.id } });
  revalidateRoutinePaths();
  return { ok: true };
}

/**
 * Set what kind of day it is and put that day's routines on the plan.
 *
 * Idempotent, and safe to call again to switch the day type: routine tasks
 * not yet done are updated to the new durations, ones that no longer apply
 * are removed, and finished ones are left alone. Routine tasks left undone on
 * earlier days are marked CANCELLED so they do not pile up as open tasks.
 */
export async function startDay(
  dayKey: string,
  dayType: DayType,
): Promise<ActionResult> {
  await assertSameOrigin();
  const user = await requireUser();
  const parsedKey = dayKeySchema.safeParse(dayKey);
  const parsedType = dayTypeSchema.safeParse(dayType);
  if (!parsedKey.success || !parsedType.success) {
    return { ok: false, error: "Invalid input." };
  }
  const date = kolkataDateFromDayKey(parsedKey.data);

  const [plan, routines, existing] = await Promise.all([
    prisma.dailyPlan.upsert({
      where: { userId_date: { userId: user.id, date } },
      update: { dayType: parsedType.data },
      create: { userId: user.id, date, dayType: parsedType.data },
      select: { id: true },
    }),
    prisma.routine.findMany({ where: { userId: user.id, active: true } }),
    prisma.task.findMany({
      where: { userId: user.id, routineId: { not: null }, scheduledDate: date },
      select: { id: true, routineId: true, status: true },
    }),
    // Missed routines from earlier days are closed out, not carried forward.
    prisma.task.updateMany({
      where: {
        userId: user.id,
        routineId: { not: null },
        scheduledDate: { lt: date },
        status: { in: ["TODO", "IN_PROGRESS"] },
      },
      data: { status: "CANCELLED" },
    }),
  ]);

  const occurrences = routinesForDay(routines, parsedType.data, parsedKey.data);
  const wanted = new Set(occurrences.map((o) => o.routineId));
  const existingByRoutine = new Map(existing.map((t) => [t.routineId, t]));

  // Routine tasks that no longer apply to this kind of day (unless done).
  const stale = existing.filter(
    (t) => !wanted.has(t.routineId!) && t.status !== "DONE",
  );
  if (stale.length > 0) {
    await prisma.task.deleteMany({
      where: { id: { in: stale.map((t) => t.id) }, userId: user.id },
    });
  }

  const max = await prisma.dailyPlanTask.aggregate({
    where: { dailyPlanId: plan.id },
    _max: { position: true },
  });
  let nextPosition = (max._max.position ?? -1) + 1;

  for (const occ of occurrences) {
    const current = existingByRoutine.get(occ.routineId);
    if (current?.status === "DONE") continue;

    const data = {
      title: occ.title,
      projectId: occ.projectId,
      estimatedMinutes: occ.minutes,
      scheduledStartTime: occ.startTime,
    };
    const task = current
      ? await prisma.task.update({
          where: { id: current.id },
          data,
          select: { id: true },
        })
      : await prisma.task.create({
          data: {
            ...data,
            userId: user.id,
            routineId: occ.routineId,
            scheduledDate: date,
          },
          select: { id: true },
        });

    await prisma.dailyPlanTask.upsert({
      where: { dailyPlanId_taskId: { dailyPlanId: plan.id, taskId: task.id } },
      update: { plannedMinutes: occ.minutes, migratedAt: null },
      create: {
        dailyPlanId: plan.id,
        taskId: task.id,
        position: nextPosition++,
        plannedMinutes: occ.minutes,
      },
    });
  }

  revalidatePath("/today");
  revalidatePath("/review");
  revalidatePath("/tasks");
  return { ok: true };
}
