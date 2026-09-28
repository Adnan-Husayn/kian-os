import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { getOrCreateDailyPlan, getDailyPlan } from "@/actions/planner";
import {
  dayKeyKolkata,
  kolkataDateFromDayKey,
  addDaysKolkata,
  formatKolkata,
} from "@/lib/dates";
import { ReviewClient } from "@/components/review/ReviewClient";

export const dynamic = "force-dynamic";

export default async function ReviewPage() {
  const user = await requireUser();
  const dayKey = dayKeyKolkata();
  const todayStart = kolkataDateFromDayKey(dayKey);
  const tomorrowStart = addDaysKolkata(todayStart, 1);
  const tomorrowKey = dayKeyKolkata(tomorrowStart);

  // Independent reads run in parallel: each is a round trip to the database.
  const [plan, doneToday, tomorrowPlan] = await Promise.all([
    getOrCreateDailyPlan(dayKey),
    prisma.task.findMany({
      where: {
        userId: user.id,
        status: "DONE",
        completedAt: { gte: todayStart, lt: tomorrowStart },
      },
      orderBy: { completedAt: "desc" },
      take: 50,
      select: { id: true, title: true },
    }),
    getDailyPlan(tomorrowKey),
  ]);

  const incomplete = plan.tasks
    .filter(
      (pt) =>
        !pt.migrated &&
        pt.task.status !== "DONE" &&
        pt.task.status !== "CANCELLED",
    )
    .map((pt) => ({
      taskId: pt.taskId,
      title: pt.task.title,
      plannedMinutes: pt.plannedMinutes ?? pt.task.estimatedMinutes,
    }));

  return (
    <ReviewClient
      dateLabel={formatKolkata(todayStart, "EEEE · MMMM d")}
      doneToday={doneToday}
      initialIncomplete={incomplete}
      todayKey={dayKey}
      tomorrowKey={tomorrowKey}
      tomorrowFocus={tomorrowPlan?.mainFocus ?? null}
    />
  );
}
