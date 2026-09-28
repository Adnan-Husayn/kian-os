"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { CalendarDays, CalendarClock, Flame, ListTodo, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { dayKeyKolkata } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { NewTaskDialog } from "@/components/tasks/NewTaskDialog";
import { TaskRow } from "@/components/tasks/TaskRow";
import {
  type ProjectOption,
  type TaskListItem,
} from "@/components/tasks/types";
import type { TaskPriority } from "@prisma/client";

type Chip = "all" | "today" | "upcoming" | "high";
type StatusFilter = "open" | "all" | "INBOX" | "TODO" | "IN_PROGRESS" | "SOMEDAY" | "DONE" | "CANCELLED";

const CHIPS: Array<{ value: Chip; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { value: "all", label: "All", icon: ListTodo },
  { value: "today", label: "Today", icon: CalendarDays },
  { value: "upcoming", label: "Upcoming", icon: CalendarClock },
  { value: "high", label: "High priority", icon: Flame },
];

const PRIORITY_WEIGHT: Record<TaskPriority, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 };

interface TasksListProps {
  tasks: TaskListItem[];
  projects: ProjectOption[];
}

/**
 * Filterable task list for /tasks: chips (All / Today / Upcoming /
 * High priority), project and status dropdowns, and the new-task dialog.
 */
export function TasksList({ tasks, projects }: TasksListProps) {
  const [chip, setChip] = React.useState<Chip>("all");
  const [status, setStatus] = React.useState<StatusFilter>("open");
  const [projectId, setProjectId] = React.useState<string>("all");
  const [dialogOpen, setDialogOpen] = React.useState(false);

  const todayKey = dayKeyKolkata();

  const base = React.useMemo(() => {
    return tasks.filter((t) => {
      if (status === "open" && (t.status === "DONE" || t.status === "CANCELLED"))
        return false;
      if (status !== "open" && status !== "all" && t.status !== status)
        return false;
      if (projectId !== "all" && t.project?.id !== projectId) return false;
      return true;
    });
  }, [tasks, status, projectId]);

  const counts = React.useMemo(() => {
    const open = base.filter((t) => t.status !== "DONE" && t.status !== "CANCELLED");
    return {
      all: base.length,
      today: open.filter((t) => t.scheduledDate && dayKeyKolkata(t.scheduledDate) === todayKey).length,
      upcoming: open.filter((t) => t.dueDate).length,
      high: open.filter((t) => t.priority === "HIGH").length,
    };
  }, [base, todayKey]);

  const visible = React.useMemo(() => {
    const open = base.filter((t) => t.status !== "DONE" && t.status !== "CANCELLED");
    let list: TaskListItem[];
    if (chip === "today") {
      list = open
        .filter((t) => t.scheduledDate && dayKeyKolkata(t.scheduledDate) === todayKey)
        .sort(
          (a, b) =>
            (a.scheduledStartTime ?? "").localeCompare(b.scheduledStartTime ?? "") ||
            PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority],
        );
    } else if (chip === "upcoming") {
      list = open
        .filter((t) => t.dueDate)
        .sort((a, b) => a.dueDate!.getTime() - b.dueDate!.getTime());
    } else if (chip === "high") {
      list = open
        .filter((t) => t.priority === "HIGH")
        .sort(
          (a, b) =>
            (a.dueDate?.getTime() ?? Number.MAX_SAFE_INTEGER) -
            (b.dueDate?.getTime() ?? Number.MAX_SAFE_INTEGER),
        );
    } else {
      list = [...base].sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
      );
    }
    return list;
  }, [base, chip, todayKey]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Task filters">
        {CHIPS.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            aria-pressed={chip === value}
            onClick={() => setChip(value)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors duration-150",
              chip === value
                ? "border-accent bg-accent-soft text-accent"
                : "border-border text-text-secondary hover:text-text",
            )}
          >
            <Icon className="size-4" aria-hidden="true" />
            {label}
            <span className="text-xs opacity-70">{counts[value]}</span>
          </button>
        ))}

        <div className="ml-auto flex items-center gap-2">
          <Select
            aria-label="Filter by project"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="w-auto"
          >
            <option value="all">All projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
          <Select
            aria-label="Filter by status"
            value={status}
            onChange={(e) => setStatus(e.target.value as StatusFilter)}
            className="w-auto"
          >
            <option value="open">Open</option>
            <option value="all">All statuses</option>
            <option value="INBOX">Inbox</option>
            <option value="TODO">To do</option>
            <option value="IN_PROGRESS">In progress</option>
            <option value="SOMEDAY">Someday</option>
            <option value="DONE">Done</option>
            <option value="CANCELLED">Cancelled</option>
          </Select>
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <Plus className="size-4" aria-hidden="true" />
            New task
          </Button>
        </div>
      </div>

      <motion.div
        key={chip + status + projectId}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.18 }}
        className="index-card mt-4 px-4 py-2"
        role="list"
        aria-label="Tasks"
      >
        {visible.map((task) => (
          <div key={task.id} role="listitem">
            <TaskRow task={task} />
          </div>
        ))}
        {visible.length === 0 && (
          <p className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-text-secondary">
            {chip === "today"
              ? "Nothing scheduled for today."
              : chip === "upcoming"
                ? "No upcoming due dates."
                : chip === "high"
                  ? "No high-priority tasks."
                  : "No tasks match these filters."}
          </p>
        )}
      </motion.div>

      <NewTaskDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        projects={projects}
      />
    </div>
  );
}
