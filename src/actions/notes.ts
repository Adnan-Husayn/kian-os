"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { assertSameOrigin } from "@/lib/auth/csrf";
import {
  cuidSchema,
  createNoteSchema,
  updateNoteSchema,
  updateNoteTagsSchema,
  linkNoteToProjectSchema,
  type CreateNoteInput,
  type UpdateNoteInput,
  type UpdateNoteTagsInput,
  type LinkNoteToProjectInput,
} from "@/lib/validation";

export interface NoteActionResult {
  ok: boolean;
  error?: string;
  id?: string;
}

function err(message: string): NoteActionResult {
  return { ok: false, error: message };
}

async function getNoteOrNull(userId: string, id: string) {
  return prisma.note.findFirst({ where: { id, userId }, select: { id: true } });
}

function normalizeTags(tags: string[] | undefined): string[] {
  if (!tags) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tags) {
    const t = raw.trim().toLowerCase();
    if (t && !seen.has(t)) {
      seen.add(t);
      out.push(t);
    }
  }
  return out;
}

/** Create a new note. */
export async function createNote(
  input: CreateNoteInput,
): Promise<NoteActionResult> {
  await assertSameOrigin();
  const user = await requireUser();

  const parsed = createNoteSchema.safeParse(input);
  if (!parsed.success) return err("Give the note a title first.");

  const projectId: string | null = parsed.data.projectId ?? null;
  if (projectId) {
    const project = await prisma.project.findFirst({
      where: { id: projectId, userId: user.id },
      select: { id: true },
    });
    if (!project) return err("That project does not exist.");
  }

  const row = await prisma.note.create({
    data: {
      userId: user.id,
      title: parsed.data.title,
      content: parsed.data.content ?? "",
      tags: normalizeTags(parsed.data.tags),
      pinned: parsed.data.pinned ?? false,
      projectId,
    },
    select: { id: true },
  });

  revalidatePath("/notes");
  return { ok: true, id: row.id };
}

/** Update a note's title/content/pin/project. */
export async function updateNote(
  id: string,
  input: UpdateNoteInput,
): Promise<NoteActionResult> {
  await assertSameOrigin();
  const user = await requireUser();

  const idParsed = cuidSchema.safeParse(id);
  if (!idParsed.success) return err("Invalid note.");
  const data = updateNoteSchema.safeParse(input);
  if (!data.success) return err("Could not save those changes.");

  const existing = await getNoteOrNull(user.id, idParsed.data);
  if (!existing) return err("Note not found.");

  if (data.data.projectId !== undefined && data.data.projectId !== null) {
    const project = await prisma.project.findFirst({
      where: { id: data.data.projectId, userId: user.id },
      select: { id: true },
    });
    if (!project) return err("That project does not exist.");
  }

  const { title, content, tags, pinned, projectId } = data.data;

  await prisma.note.update({
    where: { id: existing.id },
    data: {
      ...(title !== undefined ? { title } : {}),
      ...(content !== undefined ? { content } : {}),
      ...(tags !== undefined ? { tags: normalizeTags(tags) } : {}),
      ...(pinned !== undefined ? { pinned } : {}),
      ...(projectId !== undefined ? { projectId } : {}),
    },
  });

  revalidatePath("/notes");
  revalidatePath(`/notes/${existing.id}`);
  return { ok: true, id: existing.id };
}

/** Replace a note's tag list (covers add/remove of tags). */
export async function setNoteTags(
  input: UpdateNoteTagsInput,
): Promise<NoteActionResult> {
  await assertSameOrigin();
  const user = await requireUser();

  const parsed = updateNoteTagsSchema.safeParse(input);
  if (!parsed.success) return err("Invalid tags.");

  const existing = await getNoteOrNull(user.id, parsed.data.id);
  if (!existing) return err("Note not found.");

  await prisma.note.update({
    where: { id: existing.id },
    data: { tags: normalizeTags(parsed.data.tags) },
  });

  revalidatePath("/notes");
  revalidatePath(`/notes/${existing.id}`);
  return { ok: true, id: existing.id };
}

/** Link a note to a project, or unlink it (null). */
export async function linkNoteToProject(
  input: LinkNoteToProjectInput,
): Promise<NoteActionResult> {
  await assertSameOrigin();
  const user = await requireUser();

  const parsed = linkNoteToProjectSchema.safeParse(input);
  if (!parsed.success) return err("Invalid note or project.");

  const existing = await getNoteOrNull(user.id, parsed.data.id);
  if (!existing) return err("Note not found.");

  if (parsed.data.projectId) {
    const project = await prisma.project.findFirst({
      where: { id: parsed.data.projectId, userId: user.id },
      select: { id: true },
    });
    if (!project) return err("That project does not exist.");
  }

  await prisma.note.update({
    where: { id: existing.id },
    data: { projectId: parsed.data.projectId },
  });

  revalidatePath("/notes");
  revalidatePath(`/notes/${existing.id}`);
  return { ok: true, id: existing.id };
}

/** Flip a note's pinned state. */
export async function togglePin(id: string): Promise<NoteActionResult> {
  await assertSameOrigin();
  const user = await requireUser();

  const parsed = cuidSchema.safeParse(id);
  if (!parsed.success) return err("Invalid note.");

  const existing = await prisma.note.findFirst({
    where: { id: parsed.data, userId: user.id },
    select: { id: true, pinned: true },
  });
  if (!existing) return err("Note not found.");

  await prisma.note.update({
    where: { id: existing.id },
    data: { pinned: !existing.pinned },
  });

  revalidatePath("/notes");
  revalidatePath(`/notes/${existing.id}`);
  return { ok: true, id: existing.id };
}

/** Permanently delete a note. */
export async function deleteNote(id: string): Promise<NoteActionResult> {
  await assertSameOrigin();
  const user = await requireUser();

  const parsed = cuidSchema.safeParse(id);
  if (!parsed.success) return err("Invalid note.");

  const existing = await getNoteOrNull(user.id, parsed.data);
  if (!existing) return err("Note not found.");

  await prisma.note.delete({ where: { id: existing.id } });

  revalidatePath("/notes");
  return { ok: true };
}
