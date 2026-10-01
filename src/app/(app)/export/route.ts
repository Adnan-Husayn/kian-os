import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { dayKeyKolkata } from "@/lib/dates";
import { isMonthKey, monthRangeKolkata } from "@/lib/export";

export const dynamic = "force-dynamic";

/**
 * Data export as a downloadable JSON file.
 *
 *   GET /export                → everything
 *   GET /export?month=2026-09  → that calendar month (Asia/Kolkata)
 *
 * A month export contains what was written or changed in that month: journal
 * entries and daily plans dated in it, tasks created, completed, scheduled or
 * due in it, and notes, ideas and captures created or edited in it. Projects
 * are always included in full so task references resolve. Password hashes,
 * sessions and login attempts are never exported.
 */
export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return new Response("Not signed in.", { status: 401 });

  const monthParam = new URL(request.url).searchParams.get("month");
  if (monthParam !== null && !isMonthKey(monthParam)) {
    return new Response("Invalid month. Use YYYY-MM.", { status: 400 });
  }
  const range = monthParam ? monthRangeKolkata(monthParam) : null;
  const within = range ? { gte: range.start, lt: range.end } : undefined;
  const userId = user.id;

  const [projects, tasks, notes, ideas, captures, journal, dailyPlans] =
    await Promise.all([
      prisma.project.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
      prisma.task.findMany({
        where: within
          ? {
              userId,
              OR: [
                { createdAt: within },
                { completedAt: within },
                { scheduledDate: within },
                { dueDate: within },
              ],
            }
          : { userId },
        orderBy: { createdAt: "asc" },
      }),
      prisma.note.findMany({
        where: within
          ? { userId, OR: [{ createdAt: within }, { updatedAt: within }] }
          : { userId },
        orderBy: { createdAt: "asc" },
      }),
      prisma.idea.findMany({
        where: within
          ? { userId, OR: [{ createdAt: within }, { updatedAt: within }] }
          : { userId },
        orderBy: { createdAt: "asc" },
      }),
      prisma.capture.findMany({
        where: within ? { userId, createdAt: within } : { userId },
        orderBy: { createdAt: "asc" },
      }),
      prisma.journalEntry.findMany({
        where: within ? { userId, date: within } : { userId },
        orderBy: { date: "asc" },
      }),
      prisma.dailyPlan.findMany({
        where: within ? { userId, date: within } : { userId },
        orderBy: { date: "asc" },
        include: { tasks: { orderBy: { position: "asc" } } },
      }),
    ]);

  const body = {
    app: "Kian OS",
    formatVersion: 1,
    exportedAt: new Date().toISOString(),
    scope: monthParam ? { month: monthParam, timeZone: "Asia/Kolkata" } : "all",
    user: { username: user.username },
    counts: {
      projects: projects.length,
      tasks: tasks.length,
      notes: notes.length,
      ideas: ideas.length,
      captures: captures.length,
      journal: journal.length,
      dailyPlans: dailyPlans.length,
    },
    projects,
    tasks,
    notes,
    ideas,
    captures,
    journal,
    dailyPlans,
  };

  const filename = monthParam
    ? `kian-os-${monthParam}.json`
    : `kian-os-all-${dayKeyKolkata()}.json`;

  return new Response(JSON.stringify(body, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
