import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { getOrCreateDailyPlan } from "@/actions/planner";
import {
  addDaysKolkata,
  dayKeyKolkata,
  kolkataDateFromDayKey,
  formatKolkata,
} from "@/lib/dates";
import { FocusCard } from "@/components/today/FocusCard";
import { PlanList, type PlanListItem } from "@/components/today/PlanList";
import { InlineCapture } from "@/components/today/InlineCapture";
import { OverloadNudge } from "@/components/today/OverloadNudge";
import { FirstDay } from "@/components/today/FirstDay";
import { quoteByline, quoteForDay, type Quote } from "@/lib/quotes";

export const dynamic = "force-dynamic";

/** Default planning day length for the overload nudge (8h), in minutes. */
const DEFAULT_DAY_MINUTES = 8 * 60;
const OVERLOAD_RATIO = 0.7;

function greetingForHour(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

/**
 * Daily-log heading: the big day number, the date, and the greeting, with a
 * red ribbon bookmark hanging from the top of the page.
 */
function DailyLogHeader({
  dayNumber,
  dateLabel,
  greeting,
}: {
  dayNumber: string;
  dateLabel: string;
  greeting: string;
}) {
  return (
    <header className="relative flex items-end gap-4 pr-10">
      <span
        aria-hidden="true"
        className="absolute -top-6 right-2 h-20 w-3.5 bg-mark [clip-path:polygon(0_0,100%_0,100%_100%,50%_82%,0_100%)] md:right-4"
      />
      <span className="text-6xl font-semibold leading-[0.85] tabular-nums">
        {dayNumber}
      </span>
      <div className="min-w-0">
        <h1 className="text-2xl italic leading-tight md:text-3xl">{dateLabel}</h1>
        <p className="journal-label mt-1">{greeting} · Daily log · IST</p>
      </div>
    </header>
  );
}

/** The day's quote, written under the date like a line copied into a journal. */
function DailyQuote({ quote }: { quote: Quote }) {
  return (
    <figure className="border-l-2 border-mark pl-4">
      <blockquote className="text-lg italic leading-snug text-text">
        {quote.text}
      </blockquote>
      <figcaption className="journal-label mt-1.5 normal-case tracking-normal">
        {quoteByline(quote)}
      </figcaption>
    </figure>
  );
}

function capitalize(name: string): string {
  return name.length > 0 ? name[0]!.toUpperCase() + name.slice(1) : name;
}

export default async function TodayPage() {
  const user = await requireUser();
  const now = new Date();
  const dayKey = dayKeyKolkata(now);
  const todayStart = kolkataDateFromDayKey(dayKey);
  const tomorrowKey = dayKeyKolkata(addDaysKolkata(todayStart, 1));

  // Independent reads run in parallel: each is a round trip to the database.
  const [plan, upNext] = await Promise.all([
    getOrCreateDailyPlan(dayKey),
    // "UP NEXT": tasks scheduled for today with a start time, not finished.
    prisma.task.findMany({
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
    }),
  ]);

  const hour = Number(formatKolkata(now, "H"));
  const dayNumber = formatKolkata(now, "d");
  const dateLabel = formatKolkata(now, "EEEE, MMMM");

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
    migrated: pt.migrated,
  }));
  // Moved-on (">") entries stay visible but don't count toward the day.
  const activeItems = items.filter((i) => !i.migrated);

  const plannedMinutes = activeItems.reduce(
    (sum, i) => sum + (i.plannedMinutes ?? i.estimatedMinutes ?? 0),
    0,
  );
  const doneCount = activeItems.filter((i) => i.status === "DONE").length;
  const hasMigrated = activeItems.length < items.length;

  const greeting = `${greetingForHour(hour)}, ${capitalize(user.username)}`;
  const quote = quoteForDay(dayKey);

  if (isFresh) {
    return (
      <div className="space-y-6">
        <DailyLogHeader dayNumber={dayNumber} dateLabel={dateLabel} greeting={greeting} />
        <DailyQuote quote={quote} />
        <FirstDay dayKey={dayKey} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <DailyLogHeader dayNumber={dayNumber} dateLabel={dateLabel} greeting={greeting} />

      <DailyQuote quote={quote} />

      <FocusCard dayKey={dayKey} initialFocus={plan.mainFocus} />

      <OverloadNudge
        plannedMinutes={plannedMinutes}
        thresholdMinutes={Math.round(DEFAULT_DAY_MINUTES * OVERLOAD_RATIO)}
      />

      <section aria-labelledby="today-plan-heading" className="index-card">
        <div className="index-card-head flex items-baseline justify-between px-5 pb-2 pt-4">
          <h2 id="today-plan-heading" className="journal-label">
            Today
          </h2>
          {activeItems.length > 0 && (
            <p className="journal-label tabular-nums" aria-live="polite">
              {doneCount} of {activeItems.length} done
            </p>
          )}
        </div>
        <div className="px-4 pb-3 pt-1">
          <PlanList dayKey={dayKey} tomorrowKey={tomorrowKey} initialItems={items} />
        </div>
        {items.length > 0 && (
          <p className="journal-label flex flex-wrap gap-x-4 gap-y-1 px-5 pb-4 normal-case tracking-normal">
            <span>• to do</span>
            <span>× done</span>
            {hasMigrated && <span>&gt; moved to tomorrow</span>}
          </p>
        )}
      </section>

      <section aria-label="Quick capture" className="space-y-2">
        <InlineCapture />
      </section>

      {upNext.length > 0 && (
        <section aria-labelledby="up-next-heading" className="index-card">
          <h2
            id="up-next-heading"
            className="index-card-head journal-label px-5 pb-2 pt-4"
          >
            Up next
          </h2>
          <ul className="px-4 pb-3">
            {upNext.map((t) => (
              <li
                key={t.id}
                className="log-row flex items-center gap-3 px-1 py-2.5"
              >
                <span
                  aria-hidden="true"
                  className="w-5 shrink-0 text-center font-mono text-sm text-text-secondary"
                >
                  ○
                </span>
                <span className="shrink-0 font-mono text-xs tabular-nums text-text-secondary">
                  {t.scheduledStartTime}
                </span>
                <span className="min-w-0 flex-1 truncate text-base">
                  {t.title}
                </span>
                {t.estimatedMinutes != null && (
                  <span className="shrink-0 font-mono text-xs tabular-nums text-text-secondary">
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
