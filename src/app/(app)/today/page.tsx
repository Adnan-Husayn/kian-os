import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { getOrCreateDailyPlan } from "@/actions/planner";
import {
  dayKeyKolkata,
  kolkataDateFromDayKey,
  formatKolkata,
} from "@/lib/dates";
import { FocusCard } from "@/components/today/FocusCard";
import { PlanList, type PlanListItem } from "@/components/today/PlanList";
import { InlineCapture } from "@/components/today/InlineCapture";
import { OverloadNudge } from "@/components/today/OverloadNudge";
import { FirstDay } from "@/components/today/FirstDay";
import { Clock } from "lucide-react";

export const dynamic = "force-dynamic";

/** Default planning day length for the overload nudge (8h), in minutes. */
const DEFAULT_DAY_MINUTES = 8 * 60;
const OVERLOAD_RATIO = 0.7;

function greetingForHour(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function capitalize(name: string): string {
  return name.length > 0 ? name[0]!.toUpperCase() + name.slice(1) : name;
}

export default async function TodayPage() {
  const user = await requireUser();
  const now = new Date();
  const dayKey = dayKeyKolkata(now);
  const todayStart = kolkataDateFromDayKey(dayKey);

  const plan = await getOrCreateDailyPlan(dayKey);

  // "UP NEXT": tasks scheduled for today with a start time, not finished.
  const upNext = await prisma.task.findMany({
    where: {
      userId: user.id,
      scheduledDate: todayStart,
      scheduledStartTime: { not: null },
      status: { in: ["TODO", "IN_PROGRESS"] },
    },
    orderBy: { scheduledStartTime: "asc" },
    take: 8,
    select: {
      id: true,
      title: true,
      scheduledStartTime: true,
      estimatedMinutes: true,
    },
  });

  const hour = Number(formatKolkata(now, "H"));
  const dateLabel = formatKolkata(now, "EEEE · MMMM d");

  const isFresh =
    !plan.mainFocus && plan.tasks.length === 0 && !plan.intention;

  const items: PlanListItem[] = plan.tasks.map((pt) => ({
    id: pt.id,
    taskId: pt.taskId,
    plannedMinutes: pt.plannedMinutes,
    title: pt.task.title,
    status: pt.task.status,
    estimatedMinutes: pt.task.estimatedMinutes,
    priority: pt.task.priority,
  }));

  const plannedMinutes = items.reduce(
    (sum, i) => sum + (i.plannedMinutes ?? i.estimatedMinutes ?? 0),
    0,
  );
  const doneCount = items.filter((i) => i.status === "DONE").length;

  if (isFresh) {
    return (
      <div className="space-y-6">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
            {greetingForHour(hour)}, {capitalize(user.username)}.
          </h1>
          <p className="mt-1 text-sm text-text-secondary">{dateLabel}</p>
        </header>
        <FirstDay dayKey={dayKey} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
          {greetingForHour(hour)}, {capitalize(user.username)}.
        </h1>
        <p className="mt-1 text-sm text-text-secondary">{dateLabel}</p>
      </header>

      <FocusCard dayKey={dayKey} initialFocus={plan.mainFocus} />

      <OverloadNudge
        plannedMinutes={plannedMinutes}
        thresholdMinutes={Math.round(DEFAULT_DAY_MINUTES * OVERLOAD_RATIO)}
      />

      <section aria-labelledby="today-plan-heading" className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2
            id="today-plan-heading"
            className="text-xs font-medium uppercase tracking-[0.12em] text-text-secondary"
          >
            Today
          </h2>
          {items.length > 0 && (
            <p className="text-xs text-text-secondary" aria-live="polite">
              {doneCount} of {items.length} done
            </p>
          )}
        </div>
        <PlanList dayKey={dayKey} initialItems={items} />
      </section>

      <section aria-label="Quick capture" className="space-y-2">
        <InlineCapture />
      </section>

      {upNext.length > 0 && (
        <section aria-labelledby="up-next-heading" className="space-y-3">
          <h2
            id="up-next-heading"
            className="text-xs font-medium uppercase tracking-[0.12em] text-text-secondary"
          >
            Up next
          </h2>
          <ul className="space-y-1.5">
            {upNext.map((t) => (
              <li
                key={t.id}
                className="flex items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2"
              >
                <Clock
                  className="size-4 shrink-0 text-text-secondary"
                  aria-hidden="true"
                />
                <span className="shrink-0 font-mono text-xs text-text-secondary">
                  {t.scheduledStartTime}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm">
                  {t.title}
                </span>
                {t.estimatedMinutes != null && (
                  <span className="shrink-0 text-xs text-text-secondary">
                    {t.estimatedMinutes}m
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

    </div>
  );
}
