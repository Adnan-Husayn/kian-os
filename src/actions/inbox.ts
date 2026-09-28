"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { assertSameOrigin } from "@/lib/auth/csrf";
import type { ActionResult, ActionResultWithId } from "@/lib/action-result";
import {
  convertCaptureSchema,
  bulkProcessSchema,
  taskIdSchema,
  type ConvertCaptureInput,
} from "@/lib/validation";
import { parseCapture } from "@/lib/capture/parse";

export interface InboxCapture {
  id: string;
  content: string;
  type: "TASK" | "IDEA" | "NOTE" | "REMINDER" | "UNKNOWN";
  processed: boolean;
  createdAt: Date;
}

function revalidateInbox() {
  revalidatePath("/inbox");
  revalidatePath("/tasks");
}

/**
 * Unprocessed captures, newest first (read-only). Pass
 * `includeProcessed` to also return processed ones for the toggle.
 */
export async function listCaptures(
  includeProcessed = false,
): Promise<InboxCapture[]> {
  const user = await requireUser();
  return prisma.capture.findMany({
    where: { userId: user.id, ...(includeProcessed ? {} : { processed: false }) },
    select: {
      id: true,
      content: true,
      type: true,
      processed: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}

/** Fetch a capture scoped to the current user, or null. */
async function ownedCapture(userId: string, captureId: string) {
  return prisma.capture.findFirst({
    where: { id: captureId, userId },
  });
}

/**
 * Turn a capture into a task, idea or note, then mark the capture
 * processed (the row is kept so the processed filter can show it).
 *
 * Task conversions re-run the deterministic parser over the capture
 * content so date hints ("tomorrow", "friday") prefill the scheduled day.
 */
export async function convertCapture(
  input: ConvertCaptureInput,
): Promise<ActionResultWithId> {
  await assertSameOrigin();
  const user = await requireUser();

  const parsed = convertCaptureSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "That conversion doesn't look right." };
  }
  const { id, kind, title: titleOverride, projectId } = parsed.data;

  const capture = await ownedCapture(user.id, id);
  if (!capture) return { ok: false, error: "Capture not found." };

  if (projectId) {
    const project = await prisma.project.findFirst({
      where: { id: projectId, userId: user.id },
      select: { id: true },
    });
    if (!project) return { ok: false, error: "Project not found." };
  }

  const detected = parseCapture(capture.content);
  const title = titleOverride ?? detected.title;
  if (!title) return { ok: false, error: "Nothing to convert." };

  let entityId: string | undefined;

  if (kind === "task") {
    const row = await prisma.task.create({
      data: {
        userId: user.id,
        title,
        description: null,
        status: "INBOX",
        priority: "MEDIUM",
        dueDate: detected.dueDate ?? null,
        scheduledDate: detected.scheduledDate ?? null,
        projectId: projectId ?? null,
      },
      select: { id: true },
    });
    entityId = row.id;
  } else if (kind === "idea") {
    const row = await prisma.idea.create({
      data: {
        userId: user.id,
        title,
        content: capture.content,
        category: "General",
        status: "NEW",
      },
      select: { id: true },
    });
    entityId = row.id;
  } else {
    const row = await prisma.note.create({
      data: {
        userId: user.id,
        title,
        content: capture.content,
        tags: [],
        pinned: false,
        projectId: projectId ?? null,
      },
      select: { id: true },
    });
    entityId = row.id;
  }

  await prisma.capture.update({
    where: { id: capture.id },
    data: { processed: true },
  });

  revalidateInbox();
  return { ok: true, id: entityId };
}

/** Mark a capture processed without converting it. */
export async function archiveCapture(captureId: string): Promise<ActionResult> {
  await assertSameOrigin();
  const user = await requireUser();

  const idParsed = taskIdSchema.safeParse(captureId);
  if (!idParsed.success) return { ok: false, error: "Capture not found." };

  const capture = await ownedCapture(user.id, idParsed.data);
  if (!capture) return { ok: false, error: "Capture not found." };

  await prisma.capture.update({
    where: { id: capture.id },
    data: { processed: true },
  });

  revalidateInbox();
  return { ok: true };
}

/** Permanently delete a capture row. */
export async function deleteCapture(captureId: string): Promise<ActionResult> {
  await assertSameOrigin();
  const user = await requireUser();

  const idParsed = taskIdSchema.safeParse(captureId);
  if (!idParsed.success) return { ok: false, error: "Capture not found." };

  const capture = await ownedCapture(user.id, idParsed.data);
  if (!capture) return { ok: false, error: "Capture not found." };

  await prisma.capture.delete({ where: { id: capture.id } });

  revalidateInbox();
  return { ok: true };
}

/**
 * Bulk-process captures: archive, delete, or convert each to
 * task / idea / note. Converts skip already-empty titles.
 */
export async function bulkProcess(
  ids: string[],
  action: "archive" | "delete" | "convert-task" | "convert-idea" | "convert-note",
): Promise<ActionResult & { succeeded: number; failed: number }> {
  await assertSameOrigin();
  const user = await requireUser();

  const parsed = bulkProcessSchema.safeParse({ ids, action });
  if (!parsed.success) {
    return { ok: false, error: "Nothing to process.", succeeded: 0, failed: 0 };
  }

  const captures = await prisma.capture.findMany({
    where: { userId: user.id, id: { in: parsed.data.ids } },
  });

  let succeeded = 0;
  let failed = 0;

  for (const capture of captures) {
    try {
      if (parsed.data.action === "archive") {
        await prisma.capture.update({
          where: { id: capture.id },
          data: { processed: true },
        });
      } else if (parsed.data.action === "delete") {
        await prisma.capture.delete({ where: { id: capture.id } });
      } else {
        const kind =
          parsed.data.action === "convert-task"
            ? "task"
            : parsed.data.action === "convert-idea"
              ? "idea"
              : "note";
        const detected = parseCapture(capture.content);
        if (!detected.title) throw new Error("empty title");

        if (kind === "task") {
          await prisma.task.create({
            data: {
              userId: user.id,
              title: detected.title,
              status: "INBOX",
              priority: "MEDIUM",
              dueDate: detected.dueDate ?? null,
              scheduledDate: detected.scheduledDate ?? null,
            },
          });
        } else if (kind === "idea") {
          await prisma.idea.create({
            data: {
              userId: user.id,
              title: detected.title,
              content: capture.content,
            },
          });
        } else {
          await prisma.note.create({
            data: {
              userId: user.id,
              title: detected.title,
              content: capture.content,
            },
          });
        }
        await prisma.capture.update({
          where: { id: capture.id },
          data: { processed: true },
        });
      }
      succeeded += 1;
    } catch {
      failed += 1;
    }
  }

  revalidateInbox();
  return { ok: true, succeeded, failed };
}
