"use server";

import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { assertSameOrigin } from "@/lib/auth/csrf";
import { deleteAllDataSchema } from "@/lib/validation";

export interface DeleteAllDataResult {
  ok: boolean;
  error?: string;
}

/**
 * Delete ALL of the current user's data — every record in every table —
 * except the User row itself (the account stays intact; the user is logged
 * out because their sessions are deleted too).
 *
 * Order respects foreign keys: children first, then parents. This only runs
 * after an explicit typed "DELETE" confirmation.
 */
export async function deleteAllUserData(
  input: unknown,
): Promise<DeleteAllDataResult> {
  await assertSameOrigin();
  const user = await requireUser();

  const parsed = deleteAllDataSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'Type DELETE to confirm.' };
  }

  await prisma.$transaction([
    prisma.dailyPlanTask.deleteMany({ where: { dailyPlan: { userId: user.id } } }),
    prisma.dailyPlan.deleteMany({ where: { userId: user.id } }),
    prisma.capture.deleteMany({ where: { userId: user.id } }),
    prisma.journalEntry.deleteMany({ where: { userId: user.id } }),
    prisma.note.deleteMany({ where: { userId: user.id } }),
    prisma.task.deleteMany({ where: { userId: user.id } }),
    prisma.idea.deleteMany({ where: { userId: user.id } }),
    prisma.project.deleteMany({ where: { userId: user.id } }),
    prisma.session.deleteMany({ where: { userId: user.id } }),
  ]);

  // The User row is intentionally never deleted. Sessions were deleted
  // above, so the client redirects to /login after this completes.
  return { ok: true };
}
