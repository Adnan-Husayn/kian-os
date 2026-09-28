"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { assertSameOrigin } from "@/lib/auth/csrf";
import { kolkataDateFromDayKey } from "@/lib/dates";
import {
  moveTaskSchema,
  quickAddTaskSchema,
  toggleTaskDoneSchema,
  type MoveTaskInput,
  type QuickAddTaskInput,
  type ToggleTaskDoneInput,
} from "@/lib/validation";

export interface CalendarActionResult {
  ok: boolean;
  error?: string;
  id?: string;
}

function err(message: string): CalendarActionResult {
  return { ok: false, error: message };
}

async function getTaskOrNull(userId: string, id: string) {
  return prisma.task.findFirst({
    where: { id, userId },
    select: { id: true, status: true },
  });
}

/**
 * Move a task to a calendar day (drag-and-drop or the prev/next-day arrows).
 * `dayKey: null` unschedules the task without deleting it.
 */
export async function moveTaskToDate(
  input: MoveTaskInput,
): Promise<CalendarActionResult> {
  await assertSameOrigin();
  const user = await requireUser();

  const parsed = moveTaskSchema.safeParse(input);
  if (!parsed.success) return err("Invalid date.");

  const existing = await getTaskOrNull(user.id, parsed.data.id);
  if (!existing) return err("Task not found.");

  await prisma.task.update({
    where: { id: existing.id },
    data: {
      scheduledDate: parsed.data.dayKey
        ? kolkataDateFromDayKey(parsed.data.dayKey)
        : null,
    },
  });

  revalidatePath("/calendar");
  return { ok: true, id: existing.id };
}

/** Create a task directly on a calendar day (quick-add). */
export async function quickAddTask(
  input: QuickAddTaskInput,
): Promise<CalendarActionResult> {
  await assertSameOrigin();
  const user = await requireUser();

  const parsed = quickAddTaskSchema.safeParse(input);
  if (!parsed.success) return err("Give the task a title first.");

  const row = await prisma.task.create({
    data: {
      userId: user.id,
      title: parsed.data.title,
      status: "TODO",
      scheduledDate: kolkataDateFromDayKey(parsed.data.dayKey),
    },
    select: { id: true },
  });

  revalidatePath("/calendar");
  return { ok: true, id: row.id };
}

/** Toggle a task between DONE and TODO from the calendar day list. */
export async function toggleTaskDone(
  input: ToggleTaskDoneInput,
): Promise<CalendarActionResult> {
  await assertSameOrigin();
  const user = await requireUser();

  const parsed = toggleTaskDoneSchema.safeParse(input);
  if (!parsed.success) return err("Invalid task.");

  const existing = await getTaskOrNull(user.id, parsed.data.id);
  if (!existing) return err("Task not found.");

  await prisma.task.update({
    where: { id: existing.id },
    data: parsed.data.done
      ? { status: "DONE", completedAt: new Date() }
      : { status: "TODO", completedAt: null },
  });

  revalidatePath("/calendar");
  return { ok: true, id: existing.id };
}
