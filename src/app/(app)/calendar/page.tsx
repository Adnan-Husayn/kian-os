import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  subDays,
  addDays,
} from "date-fns";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import {
  todayKolkata,
  kolkataDateFromDayKey,
  dayKeyKolkata,
} from "@/lib/dates";
import {
  CalendarView,
  type CalendarTask,
  type CalendarViewMode,
} from "@/components/calendar/CalendarView";

export const dynamic = "force-dynamic";

const DAY_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseView(raw: unknown): CalendarViewMode {
  return raw === "week" || raw === "day" ? raw : "month";
}

type PageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function CalendarPage({ searchParams }: PageProps) {
  const user = await requireUser();
  const params = await searchParams;

  const view = parseView(params.view);
  const dateParam = typeof params.date === "string" ? params.date : "";
  const selected = DAY_KEY_RE.test(dateParam)
    ? kolkataDateFromDayKey(dateParam)
    : todayKolkata();
  const selectedDayKey = dayKeyKolkata(selected);

  // Fetch window depends on the view; tasks only (no event model).
  let rangeStart: Date;
  let rangeEnd: Date;
  if (view === "month") {
    rangeStart = startOfWeek(startOfMonth(selected), { weekStartsOn: 1 });
    rangeEnd = endOfWeek(endOfMonth(selected), { weekStartsOn: 1 });
  } else if (view === "week") {
    rangeStart = startOfWeek(selected, { weekStartsOn: 1 });
    rangeEnd = endOfWeek(selected, { weekStartsOn: 1 });
  } else {
    rangeStart = subDays(selected, 1);
    rangeEnd = addDays(selected, 1);
  }

  const rows = await prisma.task.findMany({
    where: {
      userId: user.id,
      OR: [
        { scheduledDate: { gte: rangeStart, lte: rangeEnd } },
        { dueDate: { gte: rangeStart, lte: rangeEnd } },
      ],
    },
    select: {
      id: true,
      title: true,
      status: true,
      priority: true,
      scheduledDate: true,
      dueDate: true,
    },
    orderBy: [{ scheduledDate: "asc" }, { createdAt: "asc" }],
    take: 500,
  });

  const tasks: CalendarTask[] = rows.map((r) => ({
    id: r.id,
    title: r.title,
    status: r.status,
    priority: r.priority,
    scheduledDate: r.scheduledDate,
    dueDate: r.dueDate,
  }));

  return (
    <CalendarView tasks={tasks} view={view} selectedDayKey={selectedDayKey} />
  );
}
