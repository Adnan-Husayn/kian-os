"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { assertSameOrigin } from "@/lib/auth/csrf";
import {
  cuidSchema,
  createIdeaSchema,
  updateIdeaSchema,
  ideaStatusSchema,
  turnIntoProjectSchema,
  type CreateIdeaInput,
  type UpdateIdeaInput,
  type TurnIntoProjectInput,
} from "@/lib/validation";

export interface IdeaActionResult {
  ok: boolean;
  error?: string;
  id?: string;
}

function err(message: string): IdeaActionResult {
  return { ok: false, error: message };
}

async function getIdeaOrNull(userId: string, id: string) {
  return prisma.idea.findFirst({ where: { id, userId }, select: { id: true } });
}

/** Create a new idea. */
export async function createIdea(
  input: CreateIdeaInput,
): Promise<IdeaActionResult> {
  await assertSameOrigin();
  const user = await requireUser();

  const parsed = createIdeaSchema.safeParse(input);
  if (!parsed.success) return err("Give the idea a title first.");

  const row = await prisma.idea.create({
    data: {
      userId: user.id,
      title: parsed.data.title,
      content: parsed.data.content ?? "",
      category: parsed.data.category?.trim() ? parsed.data.category : "General",
      status: parsed.data.status ?? "NEW",
      why: parsed.data.why || null,
      couldBecome: parsed.data.couldBecome || null,
      nextAction: parsed.data.nextAction || null,
    },
    select: { id: true },
  });

  revalidatePath("/ideas");
  return { ok: true, id: row.id };
}

/** Update an idea's editable fields. */
export async function updateIdea(
  id: string,
  input: UpdateIdeaInput,
): Promise<IdeaActionResult> {
  await assertSameOrigin();
  const user = await requireUser();

  const parsed = cuidSchema.safeParse(id);
  if (!parsed.success) return err("Invalid idea.");
  const data = updateIdeaSchema.safeParse(input);
  if (!data.success) return err("Could not save those changes.");

  const existing = await getIdeaOrNull(user.id, parsed.data);
  if (!existing) return err("Idea not found.");

  const { title, content, category, status, why, couldBecome, nextAction } =
    data.data;

  await prisma.idea.update({
    where: { id: existing.id },
    data: {
      ...(title !== undefined ? { title } : {}),
      ...(content !== undefined ? { content } : {}),
      ...(category !== undefined
        ? { category: category.trim() ? category : "General" }
        : {}),
      ...(status !== undefined ? { status } : {}),
      ...(why !== undefined ? { why: why || null } : {}),
      ...(couldBecome !== undefined ? { couldBecome: couldBecome || null } : {}),
      ...(nextAction !== undefined ? { nextAction: nextAction || null } : {}),
    },
  });

  revalidatePath("/ideas");
  revalidatePath(`/ideas/${existing.id}`);
  return { ok: true, id: existing.id };
}

/** Move an idea between status columns. */
export async function setIdeaStatus(
  id: string,
  status: string,
): Promise<IdeaActionResult> {
  await assertSameOrigin();
  const user = await requireUser();

  const idParsed = cuidSchema.safeParse(id);
  const statusParsed = ideaStatusSchema.safeParse(status);
  if (!idParsed.success || !statusParsed.success) {
    return err("Invalid idea or status.");
  }

  const existing = await getIdeaOrNull(user.id, idParsed.data);
  if (!existing) return err("Idea not found.");

  await prisma.idea.update({
    where: { id: existing.id },
    data: { status: statusParsed.data },
  });

  revalidatePath("/ideas");
  revalidatePath(`/ideas/${existing.id}`);
  return { ok: true, id: existing.id };
}

/**
 * Turn an idea into a project: creates the Project and marks the idea
 * TURNED_INTO_PROJECT. Deliberately creates NO tasks — the idea never
 * auto-becomes work.
 */
export async function turnIntoProject(
  input: TurnIntoProjectInput,
): Promise<IdeaActionResult> {
  await assertSameOrigin();
  const user = await requireUser();

  const parsed = turnIntoProjectSchema.safeParse(input);
  if (!parsed.success) return err("Give the project a name first.");

  const idea = await getIdeaOrNull(user.id, parsed.data.ideaId);
  if (!idea) return err("Idea not found.");

  const project = await prisma.$transaction(async (tx) => {
    const created = await tx.project.create({
      data: {
        userId: user.id,
        name: parsed.data.name,
        description: parsed.data.description?.trim()
          ? parsed.data.description
          : undefined,
      },
      select: { id: true },
    });
    await tx.idea.update({
      where: { id: idea.id },
      data: { status: "TURNED_INTO_PROJECT" },
    });
    return created;
  });

  revalidatePath("/ideas");
  revalidatePath("/projects");
  return { ok: true, id: project.id };
}

/** Archive an idea (soft move to the Archived column). */
export async function archiveIdea(id: string): Promise<IdeaActionResult> {
  return setIdeaStatus(id, "ARCHIVED");
}

/** Permanently delete an idea. */
export async function deleteIdea(id: string): Promise<IdeaActionResult> {
  await assertSameOrigin();
  const user = await requireUser();

  const parsed = cuidSchema.safeParse(id);
  if (!parsed.success) return err("Invalid idea.");

  const existing = await getIdeaOrNull(user.id, parsed.data);
  if (!existing) return err("Idea not found.");

  await prisma.idea.delete({ where: { id: existing.id } });

  revalidatePath("/ideas");
  return { ok: true };
}
