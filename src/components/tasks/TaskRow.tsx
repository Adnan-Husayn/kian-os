"use client";

import * as React from "react";
import Link from "next/link";
import { Check, Clock } from "lucide-react";
import { toggleTaskDone } from "@/actions/tasks";
import { cn } from "@/lib/utils";
import { dayKeyKolkata, formatKolkata, startOfDayKolkata } from "@/lib/dates";
import { Badge } from "@/components/ui/badge";
import type { TaskListItem } from "@/components/tasks/types";

interface TaskRowProps {
  task: TaskListItem;
}

function isOverdue(dueDate: Date | null, done: boolean): boolean {
  if (!dueDate || done) return false;
  return dueDate.getTime() < startOfDayKolkata().getTime();
}

/**
 * One task row: circular done-toggle, title (links to detail), and quiet
 * badges for priority, project, due date, schedule and estimate.
 */
export function TaskRow({ task }: TaskRowProps) {
  const [done, setDone] = React.useState(task.status === "DONE");
  const [busy, setBusy] = React.useState(false);

  const overdue = isOverdue(task.dueDate, done);
  const dueLabel = task.dueDate
    ? formatKolkata(task.dueDate, "EEE, d MMM")
    : null;
  const scheduledLabel = task.scheduledDate
    ? dayKeyKolkata(task.scheduledDate) === dayKeyKolkata()
      ? "Today"
      : formatKolkata(task.scheduledDate, "EEE, d MMM")
    : null;

  async function onToggle() {
    if (busy) return;
    setBusy(true);
    const next = !done;
    setDone(next); // optimistic
    const result = await toggleTaskDone(task.id);
    if (!result.ok) setDone(!next); // revert on failure
    setBusy(false);
  }

  return (
    <div
      className={cn(
        "group flex items-start gap-3 rounded-lg border border-border bg-surface px-3.5 py-3",
        "transition-colors duration-150 hover:border-text-secondary/40",
      )}
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        aria-label={done ? `Mark "${task.title}" as not done` : `Mark "${task.title}" as done`}
        onClick={() => void onToggle()}
        disabled={busy}
        className={cn(
          "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border transition-all duration-150",
          done
            ? "border-accent bg-accent text-white"
            : "border-text-secondary/50 hover:border-accent hover:bg-accent-soft",
        )}
      >
        {done && <Check className="size-3" aria-hidden="true" />}
      </button>

      <div className="min-w-0 flex-1">
        <Link
          href={`/tasks/${task.id}`}
          className={cn(
            "block truncate text-sm font-medium text-text hover:text-accent",
            done && "text-text-secondary line-through decoration-text-secondary/50",
          )}
        >
          {task.title}
        </Link>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {task.priority === "HIGH" && (
            <Badge
              variant="outline"
              className="border-red-500/30 text-red-600 dark:text-red-400"
            >
              High
            </Badge>
          )}
          {task.project && (
            <span className="inline-flex items-center gap-1.5 text-xs text-text-secondary">
              <span
                aria-hidden="true"
                className="size-2 rounded-full"
                style={{ backgroundColor: task.project.color ?? "#6366f1" }}
              />
              {task.project.name}
            </span>
          )}
          {dueLabel && (
            <span
              className={cn(
                "inline-flex items-center gap-1 text-xs",
                overdue ? "font-medium text-red-600 dark:text-red-400" : "text-text-secondary",
              )}
              title={overdue ? "Overdue" : "Due date"}
            >
              <Clock className="size-3" aria-hidden="true" />
              {dueLabel}
            </span>
          )}
          {scheduledLabel && (
            <Badge variant="secondary" className="font-normal">
              {scheduledLabel}
            </Badge>
          )}
          {task.estimatedMinutes != null && (
            <span className="text-xs text-text-secondary">
              {task.estimatedMinutes}m
            </span>
          )}
          {task._count.subtasks > 0 && (
            <span className="text-xs text-text-secondary">
              {task._count.subtasks} subtask{task._count.subtasks === 1 ? "" : "s"}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
