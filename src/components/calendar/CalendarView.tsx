"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  addMonths,
  subMonths,
  isSameMonth,
} from "date-fns";
import type { TaskStatus, TaskPriority } from "@prisma/client";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  CalendarDays,
  GripVertical,
} from "lucide-react";
import {
  moveTaskToDate,
  quickAddTask,
  toggleTaskDone,
} from "@/actions/calendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  dayKeyKolkata,
  kolkataDateFromDayKey,
  addDaysKolkata,
  todayKolkata,
  formatKolkata,
} from "@/lib/dates";
import { cn } from "@/lib/utils";

export type CalendarViewMode = "month" | "week" | "day";

export interface CalendarTask {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  scheduledDate: Date | null;
  dueDate: Date | null;
}

const VIEW_TABS: { id: CalendarViewMode; label: string }[] = [
  { id: "month", label: "Month" },
  { id: "week", label: "Week" },
  { id: "day", label: "Day" },
];

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function shiftDayKey(dayKey: string, deltaDays: number): string {
  return dayKeyKolkata(
    addDaysKolkata(kolkataDateFromDayKey(dayKey), deltaDays),
  );
}

function isDone(t: CalendarTask): boolean {
  return t.status === "DONE" || t.status === "CANCELLED";
}

function tasksOnDay(tasks: CalendarTask[], dayKey: string): CalendarTask[] {
  return tasks.filter(
    (t) =>
      (t.scheduledDate && dayKeyKolkata(t.scheduledDate) === dayKey) ||
      (t.dueDate && dayKeyKolkata(t.dueDate) === dayKey),
  );
}

function TaskChip({
  task,
  dayKey,
  onDragStart,
  onDragEnd,
  compact,
}: {
  task: CalendarTask;
  dayKey: string;
  onDragStart: (taskId: string) => void;
  onDragEnd: () => void;
  compact?: boolean;
}) {
  const scheduled = task.scheduledDate && dayKeyKolkata(task.scheduledDate) === dayKey;
  const done = isDone(task);
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", task.id);
        e.dataTransfer.effectAllowed = "move";
        onDragStart(task.id);
      }}
      onDragEnd={onDragEnd}
      title={scheduled ? "Scheduled — drag to move" : "Due this day — drag to move"}
      className={cn(
        "group flex cursor-grab items-center gap-1.5 rounded-md border px-1.5 py-1 text-xs active:cursor-grabbing",
        done
          ? "border-border bg-bg text-text-secondary line-through"
          : "border-border bg-surface text-text hover:border-accent",
        compact && "py-0.5",
      )}
    >
      <GripVertical
        className="size-3 shrink-0 text-text-secondary opacity-0 group-hover:opacity-100"
        aria-hidden="true"
      />
      <span
        aria-hidden="true"
        className={cn(
          "size-1.5 shrink-0 rounded-full",
          scheduled ? "bg-accent" : "border border-accent",
        )}
      />
      <Link
        href={`/tasks/${task.id}`}
        onClick={(e) => e.stopPropagation()}
        onDragStart={(e) => e.preventDefault()}
        draggable={false}
        className="min-w-0 flex-1 truncate hover:underline"
      >
        {task.title}
      </Link>
    </div>
  );
}

function DayAgendaTaskRow({
  task,
  dayKey,
  onMoved,
}: {
  task: CalendarTask;
  dayKey: string;
  onMoved: () => void;
}) {
  const router = useRouter();
  const [busy, startTransition] = React.useTransition();
  const done = isDone(task);
  const scheduled = task.scheduledDate && dayKeyKolkata(task.scheduledDate) === dayKey;
  const due = task.dueDate && dayKeyKolkata(task.dueDate) === dayKey;

  function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    startTransition(async () => {
      const res = await action();
      if (res.ok) {
        onMoved();
        router.refresh();
      }
    });
  }

  return (
    <li className="flex items-center gap-2 log-row px-2.5 py-2">
      <Checkbox
        checked={done}
        disabled={busy}
        onChange={(e) =>
          run(() => toggleTaskDone({ id: task.id, done: e.target.checked }))
        }
        aria-label={done ? `Reopen ${task.title}` : `Mark ${task.title} done`}
      />
      <div className="min-w-0 flex-1">
        <Link
          href={`/tasks/${task.id}`}
          className={cn(
            "block truncate text-sm",
            done ? "text-text-secondary line-through" : "text-text hover:underline",
          )}
        >
          {task.title}
        </Link>
        <div className="mt-0.5 flex items-center gap-1.5">
          {scheduled && (
            <Badge variant="default" className="px-1.5 py-0 text-[10px]">
              scheduled
            </Badge>
          )}
          {due && (
            <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
              due
            </Badge>
          )}
          {task.priority === "HIGH" && !done && (
            <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
              high priority
            </Badge>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 px-0"
          disabled={busy}
          onClick={() =>
            run(() => moveTaskToDate({ id: task.id, dayKey: shiftDayKey(dayKey, -1) }))
          }
          aria-label={`Move "${task.title}" to the previous day`}
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 px-0"
          disabled={busy}
          onClick={() =>
            run(() => moveTaskToDate({ id: task.id, dayKey: shiftDayKey(dayKey, 1) }))
          }
          aria-label={`Move "${task.title}" to the next day`}
        >
          <ChevronRight className="size-4" aria-hidden="true" />
        </Button>
      </div>
    </li>
  );
}

function QuickAdd({
  dayKey,
  onAdded,
}: {
  dayKey: string;
  onAdded: () => void;
}) {
  const router = useRouter();
  const [title, setTitle] = React.useState("");
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setError(null);
    startTransition(async () => {
      const res = await quickAddTask({ title: title.trim(), dayKey });
      if (res.ok) {
        setTitle("");
        onAdded();
        router.refresh();
      } else {
        setError(res.error ?? "Could not add the task.");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="mt-3">
      <div className="flex gap-2">
        <label htmlFor={`quick-add-${dayKey}`} className="sr-only">
          New task on {dayKey}
        </label>
        <Input
          id={`quick-add-${dayKey}`}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="New task on this day…"
          maxLength={500}
          disabled={pending}
        />
        <Button type="submit" disabled={pending || !title.trim()} aria-label="Add task">
          <Plus className="size-4" aria-hidden="true" />
        </Button>
      </div>
      {error && (
        <p role="alert" className="mt-1 text-xs text-red-500">
          {error}
        </p>
      )}
    </form>
  );
}

function DayAgenda({
  tasks,
  dayKey,
  onChanged,
  compact,
}: {
  tasks: CalendarTask[];
  dayKey: string;
  onChanged: () => void;
  compact?: boolean;
}) {
  const dayTasks = tasksOnDay(tasks, dayKey);
  const [flash, setFlash] = React.useState(0);

  return (
    <div className={compact ? "" : "rounded-xl border border-border bg-bg/50 p-3"}>
      {!compact && (
        <h2 className="mb-2 text-sm font-medium text-text">
          {formatKolkata(kolkataDateFromDayKey(dayKey), "EEEE, d MMM")}
        </h2>
      )}
      {dayTasks.length === 0 ? (
        <p className="py-4 text-center text-xs text-text-secondary">
          Nothing on this day yet.
        </p>
      ) : (
        <motion.ul
          key={flash}
          initial={{ opacity: 0.4 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
          className="space-y-1.5"
          aria-label={`Tasks on ${dayKey}`}
        >
          {dayTasks.map((t) => (
            <DayAgendaTaskRow key={t.id} task={t} dayKey={dayKey} onMoved={() => setFlash((f) => f + 1)} />
          ))}
        </motion.ul>
      )}
      <QuickAdd dayKey={dayKey} onAdded={onChanged} />
    </div>
  );
}

/**
 * Calendar over tasks only: month grid, week strip, and day agenda.
 * Tasks are draggable between days (desktop) and have prev/next-day arrows
 * (accessible, mobile-friendly).
 */
export function CalendarView({
  tasks,
  view,
  selectedDayKey,
}: {
  tasks: CalendarTask[];
  view: CalendarViewMode;
  selectedDayKey: string;
}) {
  const router = useRouter();
  const selected = kolkataDateFromDayKey(selectedDayKey);
  const todayKey = dayKeyKolkata(todayKolkata());
  const [draggingId, setDraggingId] = React.useState<string | null>(null);
  const [dropDayKey, setDropDayKey] = React.useState<string | null>(null);
  const [movePending, startMove] = React.useTransition();

  function goTo(v: CalendarViewMode, dayKey: string) {
    router.push(`/calendar?view=${v}&date=${dayKey}`);
  }

  function step(delta: number) {
    if (view === "month") {
      const d = delta > 0 ? addMonths(selected, 1) : subMonths(selected, 1);
      goTo(view, dayKeyKolkata(d));
    } else if (view === "week") {
      goTo(view, shiftDayKey(selectedDayKey, delta > 0 ? 7 : -7));
    } else {
      goTo(view, shiftDayKey(selectedDayKey, delta > 0 ? 1 : -1));
    }
  }

  function handleDrop(e: React.DragEvent, dayKey: string) {
    e.preventDefault();
    setDropDayKey(null);
    setDraggingId(null);
    const taskId = e.dataTransfer.getData("text/plain");
    if (!taskId) return;
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    const current = task.scheduledDate
      ? dayKeyKolkata(task.scheduledDate)
      : null;
    if (current === dayKey) return;
    startMove(async () => {
      const res = await moveTaskToDate({ id: taskId, dayKey });
      if (res.ok) router.refresh();
    });
  }

  const dropProps = (dayKey: string) => ({
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      setDropDayKey(dayKey);
    },
    onDragLeave: () => setDropDayKey((k) => (k === dayKey ? null : k)),
    onDrop: (e: React.DragEvent) => handleDrop(e, dayKey),
  });

  const monthWeeks: Date[][] = React.useMemo(() => {
    if (view !== "month") return [];
    const start = startOfWeek(startOfMonth(selected), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(selected), { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start, end });
    const weeks: Date[][] = [];
    for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
    return weeks;
  }, [view, selected]);

  const weekDays: Date[] = React.useMemo(() => {
    if (view !== "week") return [];
    const start = startOfWeek(selected, { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end: endOfWeek(selected, { weekStartsOn: 1 }) });
  }, [view, selected]);

  const periodLabel =
    view === "month"
      ? formatKolkata(selected, "MMMM yyyy")
      : view === "week"
        ? `${formatKolkata(weekDays[0] ?? selected, "d MMM")} – ${formatKolkata(weekDays[6] ?? selected, "d MMM yyyy")}`
        : formatKolkata(selected, "EEEE, d MMMM yyyy");

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-text">
            <CalendarDays className="size-5 text-accent" aria-hidden="true" />
            Calendar
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            Your scheduled tasks, laid out by day.
          </p>
        </div>
        <div
          role="tablist"
          aria-label="Calendar view"
          className="inline-flex items-center gap-1 rounded-lg border border-border bg-bg p-1"
        >
          {VIEW_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={view === tab.id}
              onClick={() => goTo(tab.id, selectedDayKey)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-150",
                view === tab.id
                  ? "bg-surface text-text shadow-sm"
                  : "text-text-secondary hover:text-text",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => step(-1)} aria-label="Previous period">
            <ChevronLeft className="size-4" aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => goTo(view, todayKey)}
            disabled={selectedDayKey === todayKey}
          >
            Today
          </Button>
          <Button variant="ghost" size="sm" onClick={() => step(1)} aria-label="Next period">
            <ChevronRight className="size-4" aria-hidden="true" />
          </Button>
        </div>
        <h2 className="text-sm font-medium text-text">{periodLabel}</h2>
      </div>

      <p className="mb-3 flex items-center gap-4 text-xs text-text-secondary" aria-label="Legend">
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-accent" aria-hidden="true" />
          Scheduled
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full border border-accent" aria-hidden="true" />
          Due date
        </span>
        <span className="hidden sm:inline">Drag a task onto another day to move it.</span>
      </p>

      <div className={cn(view === "day" ? "" : "grid gap-4 lg:grid-cols-[1fr_320px]")}>
        <motion.div
          key={`${view}-${selectedDayKey.slice(0, 7)}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
          aria-busy={movePending}
        >
          {view === "month" && (
            <div className="overflow-hidden rounded-xl border border-border bg-surface">
              <div className="grid grid-cols-7 border-b border-border bg-bg/50">
                {WEEKDAY_LABELS.map((d) => (
                  <div
                    key={d}
                    className="px-2 py-2 text-center text-xs font-medium text-text-secondary"
                  >
                    {d}
                  </div>
                ))}
              </div>
              {monthWeeks.map((week, wi) => (
                <div key={wi} className="grid grid-cols-7 border-b border-border last:border-0">
                  {week.map((day) => {
                    const key = dayKeyKolkata(day);
                    const dayTasks = tasksOnDay(tasks, key);
                    const isSelected = key === selectedDayKey;
                    const isToday = key === todayKey;
                    const inMonth = isSameMonth(day, selected);
                    return (
                      <div
                        key={key}
                        {...dropProps(key)}
                        onClick={() => goTo("month", key)}
                        role="button"
                        tabIndex={0}
                        aria-label={`${formatKolkata(day, "EEEE, d MMMM")}, ${dayTasks.length} tasks`}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            goTo("month", key);
                          }
                        }}
                        className={cn(
                          "min-h-20 cursor-pointer border-r border-border p-1.5 last:border-r-0 transition-colors",
                          !inMonth && "bg-bg/40",
                          isSelected && "bg-accent-soft/60",
                          dropDayKey === key && "bg-accent-soft ring-2 ring-inset ring-accent",
                        )}
                      >
                        <div className="mb-1 flex items-center justify-between">
                          <span
                            className={cn(
                              "flex size-6 items-center justify-center rounded-full text-xs",
                              isToday
                                ? "bg-accent font-semibold text-white"
                                : inMonth
                                  ? "text-text"
                                  : "text-text-secondary",
                            )}
                          >
                            {formatKolkata(day, "d")}
                          </span>
                          {dayTasks.length > 3 && (
                            <span className="text-[10px] text-text-secondary">
                              +{dayTasks.length - 3}
                            </span>
                          )}
                        </div>
                        <div className="space-y-1">
                          {dayTasks.slice(0, 3).map((t) => (
                            <div key={t.id} onClick={(e) => e.stopPropagation()}>
                              <TaskChip
                                task={t}
                                dayKey={key}
                                onDragStart={setDraggingId}
                                onDragEnd={() => {
                                  setDraggingId(null);
                                  setDropDayKey(null);
                                }}
                                compact
                              />
                            </div>
                          ))}
                        </div>
                        {draggingId && (
                          <span className="sr-only">Drop a task here to schedule it</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}

          {view === "week" && (
            <div className="grid grid-cols-7 gap-1.5">
              {weekDays.map((day) => {
                const key = dayKeyKolkata(day);
                const dayTasks = tasksOnDay(tasks, key);
                const isSelected = key === selectedDayKey;
                const isToday = key === todayKey;
                return (
                  <div
                    key={key}
                    {...dropProps(key)}
                    onClick={() => goTo("week", key)}
                    role="button"
                    tabIndex={0}
                    aria-label={`${formatKolkata(day, "EEEE, d MMMM")}, ${dayTasks.length} tasks`}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        goTo("week", key);
                      }
                    }}
                    className={cn(
                      "min-h-48 cursor-pointer rounded-lg border p-1.5 transition-colors",
                      isSelected
                        ? "border-accent bg-accent-soft/50"
                        : "border-border bg-surface",
                      dropDayKey === key && "border-accent ring-2 ring-accent",
                    )}
                  >
                    <div className="mb-1.5 text-center">
                      <div className="text-[10px] uppercase text-text-secondary">
                        {formatKolkata(day, "EEE")}
                      </div>
                      <div
                        className={cn(
                          "mx-auto flex size-7 items-center justify-center rounded-full text-sm",
                          isToday ? "bg-accent font-semibold text-white" : "text-text",
                        )}
                      >
                        {formatKolkata(day, "d")}
                      </div>
                    </div>
                    <div className="space-y-1" onClick={(e) => e.stopPropagation()}>
                      {dayTasks.map((t) => (
                        <TaskChip
                          key={t.id}
                          task={t}
                          dayKey={key}
                          onDragStart={setDraggingId}
                          onDragEnd={() => {
                            setDraggingId(null);
                            setDropDayKey(null);
                          }}
                          compact
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {view === "day" && (
            <div className="mx-auto max-w-2xl">
              <DayAgenda
                tasks={tasks}
                dayKey={selectedDayKey}
                onChanged={() => router.refresh()}
              />
            </div>
          )}
        </motion.div>

        {view !== "day" && (
          <aside aria-label="Selected day">
            <div className="lg:sticky lg:top-6">
              <DayAgenda
                tasks={tasks}
                dayKey={selectedDayKey}
                onChanged={() => router.refresh()}
              />
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
