"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { assertSameOrigin } from "@/lib/auth/csrf";
import type { ActionResult, ActionResultWithId } from "@/lib/action-result";
import {
  createTaskSchema,
  updateTaskSchema,
  setTaskStatusSchema,
  rescheduleTaskSchema,
  createSubtaskSchema,
  taskIdSchema,
  type CreateTaskInput,
  type UpdateTaskInput,
} from "@/lib/validation";
import { addDaysKolkata, kolkataDateFromDayKey, todayKolkata } from "@/lib/dates";

/** Re-exported for components that import task input types from the actions. */
export type { CreateTaskInput, UpdateTaskInput };

const REVALIDATED = ["/tasks", "/today", "/projects", "/inbox"] as const;

function revalidateTaskPages(id?: string) {
  for (const path of REVALIDATED) revalidatePath(path);
  if (id) revalidatePath(`/tasks/${id}`);
}

/** Fetch a task scoped to the current user, or null. */
async function ownedTask(userId: string, taskId: string) {
  return prisma.task.findFirst({
    where: { id: taskId, userId },
    include: { project: { select: { id: true } } },
  });
}

/** Verify an optional projectId belongs to the user before assigning it. */
async function assertProjectOwned(userId: string, projectId: string) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId },
    select: { id: true },
  });
  if (!project) throw new Error("Project not found.");
}

/**
 * Create a task. Subtasks inherit the parent's project unless overridden.
 */
export async function createTask(
  input: CreateTaskInput,
): Promise<ActionResultWithId> {
  await assertSameOrigin();
  const user = await requireUser();

  const parsed = createTaskSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Give the task a title first." };
  }
  const data = parsed.data;

  if (data.projectId) {
    try {
      await assertProjectOwned(user.id, data.projectId);
    } catch {
      return { ok: false, error: "Project not found." };
    }
  }

  let projectId = data.projectId ?? null;
  if (data.parentTaskId) {
    const parent = await ownedTask(user.id, data.parentTaskId);
    if (!parent) return { ok: false, error: "Parent task not found." };
    if (parent.parentTaskId) {
      return { ok: false, error: "Subtasks cannot have their own subtasks." };
    }
    if (!projectId) projectId = parent.projectId;
  }

  const row = await prisma.task.create({
    data: {
      userId: user.id,
      title: data.title,
      description: data.description ?? null,
      status: data.status ?? "TODO",
      priority: data.priority ?? "MEDIUM",
      dueDate: data.dueDate ?? null,
      scheduledDate: data.scheduledDate ?? null,
      scheduledStartTime: data.scheduledStartTime ?? null,
      scheduledEndTime: data.scheduledEndTime ?? null,
      estimatedMinutes: data.estimatedMinutes ?? null,
      actualMinutes: data.actualMinutes ?? null,
      projectId,
      parentTaskId: data.parentTaskId ?? null,
    },
    select: { id: true },
  });

  revalidateTaskPages(data.parentTaskId ?? undefined);
  return { ok: true, id: row.id };
}

/** Update a task's fields. Subtask rows stay with the task. */
export async function updateTask(
  taskId: string,
  input: UpdateTaskInput,
): Promise<ActionResult> {
  await assertSameOrigin();
  const user = await requireUser();

  const idParsed = taskIdSchema.safeParse(taskId);
  const parsed = updateTaskSchema.safeParse(input);
  if (!idParsed.success || !parsed.success) {
    return { ok: false, error: "That update doesn't look right." };
  }
  const data = parsed.data;

  const existing = await ownedTask(user.id, idParsed.data);
  if (!existing) return { ok: false, error: "Task not found." };

  if (data.projectId !== undefined && data.projectId !== null) {
    try {
      await assertProjectOwned(user.id, data.projectId);
    } catch {
      return { ok: false, error: "Project not found." };
    }
  }

  await prisma.task.update({
    where: { id: existing.id },
    data: {
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined
        ? { description: data.description?.length ? data.description : null }
        : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.priority !== undefined ? { priority: data.priority } : {}),
      ...(data.dueDate !== undefined ? { dueDate: data.dueDate ?? null } : {}),
      ...(data.scheduledDate !== undefined
        ? { scheduledDate: data.scheduledDate ?? null }
        : {}),
      ...(data.scheduledStartTime !== undefined
        ? { scheduledStartTime: data.scheduledStartTime ?? null }
        : {}),
      ...(data.scheduledEndTime !== undefined
        ? { scheduledEndTime: data.scheduledEndTime ?? null }
        : {}),
      ...(data.estimatedMinutes !== undefined
        ? { estimatedMinutes: data.estimatedMinutes ?? null }
        : {}),
      ...(data.actualMinutes !== undefined
        ? { actualMinutes: data.actualMinutes ?? null }
        : {}),
      ...(data.projectId !== undefined ? { projectId: data.projectId } : {}),
      ...(data.completedAt !== undefined
        ? { completedAt: data.completedAt }
        : {}),
    },
  });

  revalidateTaskPages(existing.id);
  return { ok: true };
}

/**
 * Delete a task. Its subtasks are deleted too (FK cascade) — projects and
 * everything else are untouched.
 */
export async function deleteTask(taskId: string): Promise<ActionResult> {
  await assertSameOrigin();
  const user = await requireUser();

  const idParsed = taskIdSchema.safeParse(taskId);
  if (!idParsed.success) return { ok: false, error: "Task not found." };

  const existing = await ownedTask(user.id, idParsed.data);
  if (!existing) return { ok: false, error: "Task not found." };

  await prisma.task.delete({ where: { id: existing.id } });

  revalidateTaskPages(existing.parentTaskId ?? undefined);
  return { ok: true };
}

/**
 * Toggle done state: DONE → back to TODO (completedAt cleared); anything
 * else → DONE (completedAt set).
 */
export async function toggleTaskDone(taskId: string): Promise<ActionResult> {
  await assertSameOrigin();
  const user = await requireUser();

  const idParsed = taskIdSchema.safeParse(taskId);
  if (!idParsed.success) return { ok: false, error: "Task not found." };

  const existing = await ownedTask(user.id, idParsed.data);
  if (!existing) return { ok: false, error: "Task not found." };

  const done = existing.status !== "DONE";
  await prisma.task.update({
    where: { id: existing.id },
    data: {
      status: done ? "DONE" : "TODO",
      completedAt: done ? new Date() : null,
    },
  });

  revalidateTaskPages(existing.id);
  return { ok: true };
}

/** Set a task's status explicitly. */
export async function setTaskStatus(
  taskId: string,
  status: z.infer<typeof setTaskStatusSchema>["status"],
): Promise<ActionResult> {
  await assertSameOrigin();
  const user = await requireUser();

  const parsed = setTaskStatusSchema.safeParse({ taskId, status });
  if (!parsed.success) return { ok: false, error: "Invalid status." };

  const existing = await ownedTask(user.id, parsed.data.taskId);
  if (!existing) return { ok: false, error: "Task not found." };

  await prisma.task.update({
    where: { id: existing.id },
    data: {
      status: parsed.data.status,
      completedAt: parsed.data.status === "DONE" ? (existing.completedAt ?? new Date()) : null,
    },
  });

  revalidateTaskPages(existing.id);
  return { ok: true };
}

/** Set (or clear, with null) a task's scheduled day. */
export async function rescheduleTask(
  taskId: string,
  date: string | null,
): Promise<ActionResult> {
  await assertSameOrigin();
  const user = await requireUser();

  const parsed = rescheduleTaskSchema.safeParse({ taskId, date });
  if (!parsed.success) return { ok: false, error: "Use a yyyy-MM-dd date." };

  const existing = await ownedTask(user.id, parsed.data.taskId);
  if (!existing) return { ok: false, error: "Task not found." };

  await prisma.task.update({
    where: { id: existing.id },
    data: {
      scheduledDate: parsed.data.date
        ? kolkataDateFromDayKey(parsed.data.date)
        : null,
    },
  });

  revalidateTaskPages(existing.id);
  return { ok: true };
}

/** Move a task to tomorrow (midnight Kolkata). Reactivates inbox/someday tasks. */
export async function moveToTomorrow(taskId: string): Promise<ActionResult> {
  await assertSameOrigin();
  const user = await requireUser();

  const idParsed = taskIdSchema.safeParse(taskId);
  if (!idParsed.success) return { ok: false, error: "Task not found." };

  const existing = await ownedTask(user.id, idParsed.data);
  if (!existing) return { ok: false, error: "Task not found." };

  await prisma.task.update({
    where: { id: existing.id },
    data: {
      scheduledDate: addDaysKolkata(todayKolkata(), 1),
      ...(existing.status === "INBOX" || existing.status === "SOMEDAY"
        ? { status: "TODO" }
        : {}),
    },
  });

  revalidateTaskPages(existing.id);
  return { ok: true };
}

/** Take a task out of today's view without deleting it: clears the
 * schedule and parks it back in TODO. */
export async function notToday(taskId: string): Promise<ActionResult> {
  await assertSameOrigin();
  const user = await requireUser();

  const idParsed = taskIdSchema.safeParse(taskId);
  if (!idParsed.success) return { ok: false, error: "Task not found." };

  const existing = await ownedTask(user.id, idParsed.data);
  if (!existing) return { ok: false, error: "Task not found." };

  await prisma.task.update({
    where: { id: existing.id },
    data: { scheduledDate: null, status: "TODO" },
  });

  revalidateTaskPages(existing.id);
  return { ok: true };
}

/** "Let go" of a task: marks it CANCELLED (kept for the record, never deleted). */
export async function letGoTask(taskId: string): Promise<ActionResult> {
  await assertSameOrigin();
  const user = await requireUser();

  const idParsed = taskIdSchema.safeParse(taskId);
  if (!idParsed.success) return { ok: false, error: "Task not found." };

  const existing = await ownedTask(user.id, idParsed.data);
  if (!existing) return { ok: false, error: "Task not found." };

  await prisma.task.update({
    where: { id: existing.id },
    data: { status: "CANCELLED", completedAt: null },
  });

  revalidateTaskPages(existing.id);
  return { ok: true };
}

/** Add a subtask under a parent task (one level only). */
export async function createSubtask(
  parentId: string,
  title: string,
): Promise<ActionResultWithId> {
  await assertSameOrigin();
  const user = await requireUser();

  const parsed = createSubtaskSchema.safeParse({ parentId, title });
  if (!parsed.success) {
    return { ok: false, error: "Give the subtask a title first." };
  }

  const parent = await ownedTask(user.id, parsed.data.parentId);
  if (!parent) return { ok: false, error: "Parent task not found." };
  if (parent.parentTaskId) {
    return { ok: false, error: "Subtasks cannot have their own subtasks." };
  }

  const row = await prisma.task.create({
    data: {
      userId: user.id,
      title: parsed.data.title,
      status: "TODO",
      priority: "MEDIUM",
      parentTaskId: parent.id,
      projectId: parent.projectId,
    },
    select: { id: true },
  });

  revalidateTaskPages(parent.id);
  return { ok: true, id: row.id };
}
