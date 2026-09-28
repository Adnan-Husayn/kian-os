import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { getOrCreateDailyPlan } from "@/actions/planner";
import {
  todayKolkata,
  addDaysKolkata,
  dayKeyKolkata,
  formatKolkata,
} from "@/lib/dates";
import { PlanTomorrow } from "@/components/plan/PlanTomorrow";

export const dynamic = "force-dynamic";

export default async function PlanPage() {
  const user = await requireUser();
  const tomorrowStart = addDaysKolkata(todayKolkata(), 1);
  const tomorrowKey = dayKeyKolkata(tomorrowStart);

  const plan = await getOrCreateDailyPlan(tomorrowKey);
  // Entries already moved on from tomorrow (">") aren't part of its plan.
  const planTasks = plan.tasks.filter((t) => !t.migrated);
  const plannedIds = planTasks.map((t) => t.taskId);

  // Candidate list: open tasks not already in tomorrow's plan.
  const candidates = await prisma.task.findMany({
    where: {
      userId: user.id,
      status: { in: ["TODO", "IN_PROGRESS"] },
      id: { notIn: plannedIds },
    },
    orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
    take: 100,
    select: {
      id: true,
      title: true,
      estimatedMinutes: true,
      priority: true,
      dueDate: true,
    },
  });

  const existingItems = planTasks.map((pt) => ({
    taskId: pt.taskId,
    title: pt.task.title,
    plannedMinutes: pt.plannedMinutes ?? pt.task.estimatedMinutes ?? 30,
  }));

  return (
    <PlanTomorrow
      dayKey={tomorrowKey}
      dateLabel={formatKolkata(tomorrowStart, "EEEE · MMMM d")}
      initialFocus={plan.mainFocus}
      initialEnergy={plan.energyLevel}
      initialItems={existingItems}
      candidates={candidates.map((c) => ({
        id: c.id,
        title: c.title,
        estimatedMinutes: c.estimatedMinutes,
        priority: c.priority,
        dueDate: c.dueDate,
      }))}
    />
  );
}
