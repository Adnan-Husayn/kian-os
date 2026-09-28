"use server";

import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { assertSameOrigin } from "@/lib/auth/csrf";
import {
  createCaptureSchema,
  captureSmartSchema,
  type CreateCaptureInput,
  type CaptureSmartInput,
} from "@/lib/validation";
import { parseCapture } from "@/lib/capture/parse";

export interface CaptureQuickResult {
  ok: boolean;
  error?: string;
  id?: string;
}

/**
 * Save a quick capture from the Cmd/Ctrl+K modal. Type defaults to UNKNOWN;
 * the type-hint chips in the UI let the user set TASK/IDEA/NOTE/REMINDER.
 */
export async function captureQuick(
  input: CreateCaptureInput,
): Promise<CaptureQuickResult> {
  await assertSameOrigin();
  const user = await requireUser();

  const parsed = createCaptureSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Write something first." };
  }

  const row = await prisma.capture.create({
    data: {
      userId: user.id,
      content: parsed.data.content,
      type: parsed.data.type ?? "UNKNOWN",
    },
    select: { id: true },
  });

  return { ok: true, id: row.id };
}

/**
 * Smart quick capture: runs the deterministic parser over the content and
 * stores the detected type, unless the caller explicitly passed a manual
 * type hint (from the UI chips), which wins.
 *
 * The parsed date hints are NOT stored on the Capture row (it has no date
 * fields) — they are re-applied when the capture is converted to a task
 * from the inbox, and shown as a confirmation line in the capture modal.
 */
export async function captureQuickSmart(
  input: CaptureSmartInput,
): Promise<CaptureQuickResult> {
  await assertSameOrigin();
  const user = await requireUser();

  const parsed = captureSmartSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Write something first." };
  }

  const detected = parseCapture(parsed.data.content);
  const type = parsed.data.type ?? detected.type;

  const row = await prisma.capture.create({
    data: {
      userId: user.id,
      content: parsed.data.content,
      type,
    },
    select: { id: true },
  });

  return { ok: true, id: row.id };
}
