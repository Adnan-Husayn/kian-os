"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { assertSameOrigin } from "@/lib/auth/csrf";
import type { ActionResult, ActionResultWithId } from "@/lib/action-result";
import {
  createProjectSchema,
  updateProjectSchema,
  setProjectStatusSchema,
  taskIdSchema,
  type CreateProjectInput,
  type UpdateProjectInput,
} from "@/lib/validation";

export interface ProjectProgress {
  total: number;
  done: number;
  /** Whole-number percent, 0 when there are no tasks. */
  percent: number;
}

/** Create a project. */
export async function createProject(
  input: CreateProjectInput,
): Promise<ActionResultWithId> {
  await assertSameOrigin();
  const user = await requireUser();

  const parsed = createProjectSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Give the project a name first." };
  }

  const row = await prisma.project.create({
    data: {
      userId: user.id,
      name: parsed.data.name,
      description: parsed.data.description?.length
        ? parsed.data.description
        : null,
      color: parsed.data.color ?? "#6366f1",
      status: parsed.data.status ?? "ACTIVE",
    },
    select: { id: true },
  });

  revalidatePath("/projects");
  return { ok: true, id: row.id };
}

/** Update a project's fields. */
export async function updateProject(
  projectId: string,
  input: UpdateProjectInput,
): Promise<ActionResult> {
  await assertSameOrigin();
  const user = await requireUser();

  const idParsed = taskIdSchema.safeParse(projectId);
  const parsed = updateProjectSchema.safeParse(input);
  if (!idParsed.success || !parsed.success) {
    return { ok: false, error: "That update doesn't look right." };
  }

  const existing = await prisma.project.findFirst({
    where: { id: idParsed.data, userId: user.id },
    select: { id: true },
  });
  if (!existing) return { ok: false, error: "Project not found." };

  const data = parsed.data;
  await prisma.project.update({
    where: { id: existing.id },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.description !== undefined
        ? { description: data.description?.length ? data.description : null }
        : {}),
      ...(data.color !== undefined ? { color: data.color } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
    },
  });

  revalidatePath("/projects");
  revalidatePath(`/projects/${existing.id}`);
  return { ok: true };
}

/** Archive a project (kept, just out of the active list). */
export async function archiveProject(projectId: string): Promise<ActionResult> {
  return setProjectStatus(projectId, "ARCHIVED");
}

/** Set a project's status explicitly. */
export async function setProjectStatus(
  projectId: string,
  status: z.infer<typeof setProjectStatusSchema>["status"],
): Promise<ActionResult> {
  await assertSameOrigin();
  const user = await requireUser();

  const parsed = setProjectStatusSchema.safeParse({ projectId, status });
  if (!parsed.success) return { ok: false, error: "Invalid status." };

  const existing = await prisma.project.findFirst({
    where: { id: parsed.data.projectId, userId: user.id },
    select: { id: true },
  });
  if (!existing) return { ok: false, error: "Project not found." };

  await prisma.project.update({
    where: { id: existing.id },
    data: { status: parsed.data.status },
  });

  revalidatePath("/projects");
  revalidatePath(`/projects/${existing.id}`);
  return { ok: true };
}

/**
 * Delete a project. Its tasks are kept and unassigned (the FK is
 * onDelete: SetNull in the schema), as are its notes.
 */
export async function deleteProject(projectId: string): Promise<ActionResult> {
  await assertSameOrigin();
  const user = await requireUser();

  const idParsed = taskIdSchema.safeParse(projectId);
  if (!idParsed.success) return { ok: false, error: "Project not found." };

  const existing = await prisma.project.findFirst({
    where: { id: idParsed.data, userId: user.id },
    select: { id: true },
  });
  if (!existing) return { ok: false, error: "Project not found." };

  await prisma.project.delete({ where: { id: existing.id } });

  revalidatePath("/projects");
  revalidatePath("/tasks");
  return { ok: true };
}

/**
 * Lightweight project list for selects and dialogs (read-only).
 */
export async function listProjects(): Promise<
  Array<{ id: string; name: string; color: string | null }>
> {
  const user = await requireUser();
  return prisma.project.findMany({
    where: { userId: user.id, status: { not: "ARCHIVED" } },
    select: { id: true, name: true, color: true },
    orderBy: { name: "asc" },
  });
}

/**
 * Progress of a project: share of its top-level tasks that are DONE
 * (read-only).
 */
export async function projectProgress(
  projectId: string,
): Promise<ProjectProgress> {
  const user = await requireUser();

  const project = await prisma.project.findFirst({
    where: { id: projectId, userId: user.id },
    select: { id: true },
  });
  if (!project) return { total: 0, done: 0, percent: 0 };

  const [total, done] = await Promise.all([
    prisma.task.count({
      where: { userId: user.id, projectId: project.id, parentTaskId: null },
    }),
    prisma.task.count({
      where: {
        userId: user.id,
        projectId: project.id,
        parentTaskId: null,
        status: "DONE",
      },
    }),
  ]);

  return {
    total,
    done,
    percent: total === 0 ? 0 : Math.round((done / total) * 100),
  };
}
