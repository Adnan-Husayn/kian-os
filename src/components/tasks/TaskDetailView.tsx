"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  CalendarMinus,
  CalendarPlus,
  Check,
  CircleX,
  Plus,
  Trash2,
} from "lucide-react";
import {
  createSubtask,
  deleteTask,
  letGoTask,
  moveToTomorrow,
  notToday,
  toggleTaskDone,
  updateTask,
} from "@/actions/tasks";
import { cn } from "@/lib/utils";
import { dayKeyKolkata } from "@/lib/dates";
import type { UpdateTaskInput } from "@/lib/validation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  PRIORITY_LABEL,
  STATUS_LABEL,
  type ProjectOption,
  type SubtaskItem,
  type TaskDetailData,
} from "@/components/tasks/types";
import type { TaskPriority, TaskStatus } from "@prisma/client";

interface TaskDetailViewProps {
  task: TaskDetailData;
  projects: ProjectOption[];
}

function toDayKey(date: Date | null): string {
  return date ? dayKeyKolkata(date) : "";
}

/** Midnight-Kolkata instant for a yyyy-MM-dd day key (no DST in Kolkata). */
function kolkataMidnight(dayKey: string): Date {
  return new Date(`${dayKey}T00:00:00+05:30`);
}

const PRIORITIES: TaskPriority[] = ["LOW", "MEDIUM", "HIGH"];
const STATUSES: TaskStatus[] = [
  "INBOX",
  "TODO",
  "IN_PROGRESS",
  "SOMEDAY",
  "DONE",
  "CANCELLED",
];

function SubtaskRow({ subtask }: { subtask: SubtaskItem }) {
  const router = useRouter();
  const [done, setDone] = React.useState(subtask.status === "DONE");

  async function onToggle() {
    const next = !done;
    setDone(next);
    const result = await toggleTaskDone(subtask.id);
    if (result.ok) router.refresh();
    else setDone(!next);
  }

  async function onDelete() {
    const result = await deleteTask(subtask.id);
    if (result.ok) router.refresh();
  }

  return (
    <li className="group flex items-center gap-3 rounded-md px-2 py-2 hover:bg-bg">
      <Checkbox
        checked={done}
        onChange={() => void onToggle()}
        aria-label={`Mark subtask "${subtask.title}" ${done ? "not done" : "done"}`}
      />
      <span
        className={cn(
          "flex-1 text-sm text-text",
          done && "text-text-secondary line-through",
        )}
      >
        {subtask.title}
      </span>
      <button
        type="button"
        onClick={() => void onDelete()}
        aria-label={`Delete subtask "${subtask.title}"`}
        className="rounded p-1 text-text-secondary opacity-0 transition-opacity duration-150 hover:text-red-600 group-hover:opacity-100"
      >
        <Trash2 className="size-4" aria-hidden="true" />
      </button>
    </li>
  );
}

/**
 * Task detail: editable fields (auto-save on blur/change), subtask
 * checklist, and the danger-lite actions — Move to tomorrow, Not today,
 * Let go (confirmed), plus delete.
 */
export function TaskDetailView({ task, projects }: TaskDetailViewProps) {
  const router = useRouter();

  const [title, setTitle] = React.useState(task.title);
  const [description, setDescription] = React.useState(task.description ?? "");
  const [projectId, setProjectId] = React.useState(task.project?.id ?? "");
  const [priority, setPriority] = React.useState<TaskPriority>(task.priority);
  const [status, setStatus] = React.useState<TaskStatus>(task.status);
  const [dueDate, setDueDate] = React.useState(toDayKey(task.dueDate));
  const [scheduledDate, setScheduledDate] = React.useState(
    toDayKey(task.scheduledDate),
  );
  const [startTime, setStartTime] = React.useState(task.scheduledStartTime ?? "");
  const [endTime, setEndTime] = React.useState(task.scheduledEndTime ?? "");
  const [estimated, setEstimated] = React.useState(
    task.estimatedMinutes != null ? String(task.estimatedMinutes) : "",
  );
  const [actual, setActual] = React.useState(
    task.actualMinutes != null ? String(task.actualMinutes) : "",
  );

  const [saveState, setSaveState] = React.useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = React.useState<string | null>(null);
  const [subtaskTitle, setSubtaskTitle] = React.useState("");
  const [addingSubtask, setAddingSubtask] = React.useState(false);
  const [confirmLetGo, setConfirmLetGo] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const saveTimer = React.useRef<number | null>(null);

  function flashSaved() {
    setSaveState("saved");
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => setSaveState("idle"), 1600);
  }

  async function save(patch: UpdateTaskInput) {
    setSaveState("saving");
    setError(null);
    try {
      const result = await updateTask(task.id, patch);
      if (result.ok) {
        flashSaved();
        router.refresh();
      } else {
        setSaveState("error");
        setError(result.error ?? "Could not save.");
      }
    } catch {
      setSaveState("error");
      setError("Could not save.");
    }
  }

  async function addSubtask() {
    const t = subtaskTitle.trim();
    if (!t || addingSubtask) return;
    setAddingSubtask(true);
    const result = await createSubtask(task.id, t);
    if (result.ok) {
      setSubtaskTitle("");
      router.refresh();
    } else {
      setError(result.error ?? "Could not add the subtask.");
    }
    setAddingSubtask(false);
  }

  async function onMoveToTomorrow() {
    const result = await moveToTomorrow(task.id);
    if (result.ok) {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      setScheduledDate(toDayKey(d));
      flashSaved();
      router.refresh();
    } else setError(result.error ?? "Could not reschedule.");
  }

  async function onNotToday() {
    const result = await notToday(task.id);
    if (result.ok) {
      setScheduledDate("");
      setStatus("TODO");
      flashSaved();
      router.refresh();
    } else setError(result.error ?? "Could not update.");
  }

  async function onLetGo() {
    setConfirmLetGo(false);
    const result = await letGoTask(task.id);
    if (result.ok) router.push("/tasks");
    else setError(result.error ?? "Could not let go of the task.");
  }

  async function onDelete() {
    setConfirmDelete(false);
    const result = await deleteTask(task.id);
    if (result.ok) router.push("/tasks");
    else setError(result.error ?? "Could not delete the task.");
  }

  const isDone = status === "DONE";

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="mx-auto max-w-2xl"
    >
      <Link
        href="/tasks"
        className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Tasks
      </Link>

      <div className="mt-4 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <Label htmlFor="task-title" className="sr-only">
            Task title
          </Label>
          <Input
            id="task-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => {
              const t = title.trim();
              if (t && t !== task.title) void save({ title: t });
              else setTitle(task.title);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
            maxLength={500}
            className={cn(
              "h-auto border-0 bg-transparent px-0 text-2xl font-semibold shadow-none",
              isDone && "text-text-secondary line-through",
            )}
            aria-label="Task title"
          />
        </div>
        <Badge variant={isDone ? "default" : "secondary"} className="mt-2 shrink-0">
          {STATUS_LABEL[status]}
        </Badge>
      </div>

      <p className="mt-1 h-4 text-xs text-text-secondary" aria-live="polite">
        {saveState === "saving" && "Saving…"}
        {saveState === "saved" && "Saved"}
        {saveState === "error" && <span className="text-red-600 dark:text-red-400">{error ?? "Could not save."}</span>}
      </p>

      <div className="mt-2 space-y-5 rounded-xl border border-border bg-surface p-5">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="task-project">Project</Label>
            <Select
              id="task-project"
              value={projectId}
              onChange={(e) => {
                setProjectId(e.target.value);
                void save({ projectId: e.target.value || null });
              }}
            >
              <option value="">No project</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="task-status">Status</Label>
            <Select
              id="task-status"
              value={status}
              onChange={(e) => {
                const s = e.target.value as TaskStatus;
                setStatus(s);
                void save({ status: s });
              }}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <span className="text-sm font-medium text-text-secondary leading-none">
            Priority
          </span>
          <div className="flex gap-1.5" role="group" aria-label="Priority">
            {PRIORITIES.map((p) => (
              <button
                key={p}
                type="button"
                aria-pressed={priority === p}
                onClick={() => {
                  setPriority(p);
                  void save({ priority: p });
                }}
                className={cn(
                  "flex-1 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors duration-150",
                  priority === p
                    ? "border-accent bg-accent-soft text-accent"
                    : "border-border text-text-secondary hover:text-text",
                )}
              >
                {PRIORITY_LABEL[p]}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="task-scheduled">Scheduled</Label>
            <Input
              id="task-scheduled"
              type="date"
              value={scheduledDate}
              onChange={(e) => {
                setScheduledDate(e.target.value);
                void save({
                  scheduledDate: e.target.value ? kolkataMidnight(e.target.value) : null,
                });
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="task-due">Due</Label>
            <Input
              id="task-due"
              type="date"
              value={dueDate}
              onChange={(e) => {
                setDueDate(e.target.value);
                void save({
                  dueDate: e.target.value ? kolkataMidnight(e.target.value) : null,
                });
              }}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="task-start">Start time</Label>
            <Input
              id="task-start"
              type="time"
              value={startTime}
              onChange={(e) => {
                setStartTime(e.target.value);
                void save({ scheduledStartTime: e.target.value || null });
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="task-end">End time</Label>
            <Input
              id="task-end"
              type="time"
              value={endTime}
              onChange={(e) => {
                setEndTime(e.target.value);
                void save({ scheduledEndTime: e.target.value || null });
              }}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="task-estimated">Estimated (min)</Label>
            <Input
              id="task-estimated"
              type="number"
              min={1}
              max={1440}
              value={estimated}
              onChange={(e) => setEstimated(e.target.value)}
              onBlur={() =>
                void save({
                  estimatedMinutes: estimated ? Number(estimated) : null,
                })
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="task-actual">Actual (min)</Label>
            <Input
              id="task-actual"
              type="number"
              min={0}
              max={1440}
              value={actual}
              onChange={(e) => setActual(e.target.value)}
              onBlur={() =>
                void save({ actualMinutes: actual ? Number(actual) : null })
              }
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="task-notes">Notes</Label>
          <Textarea
            id="task-notes"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={() => {
              if (description !== (task.description ?? ""))
                void save({ description });
            }}
            placeholder="Anything worth remembering about this task…"
            rows={4}
          />
        </div>
      </div>

      <section aria-label="Subtasks" className="mt-6">
        <h2 className="text-sm font-semibold text-text">
          Subtasks
          <span className="ml-2 font-normal text-text-secondary">
            {task.subtasks.filter((s) => s.status === "DONE").length}/
            {task.subtasks.length} done
          </span>
        </h2>
        {task.subtasks.length > 0 ? (
          <ul className="mt-2 rounded-xl border border-border bg-surface px-2 py-1">
            {task.subtasks.map((s) => (
              <SubtaskRow key={s.id} subtask={s} />
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-text-secondary">
            No subtasks yet. Break it down below.
          </p>
        )}
        <div className="mt-3 flex gap-2">
          <Input
            value={subtaskTitle}
            onChange={(e) => setSubtaskTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void addSubtask();
              }
            }}
            placeholder="Add a subtask…"
            maxLength={500}
            aria-label="New subtask title"
            disabled={addingSubtask}
          />
          <Button
            variant="secondary"
            onClick={() => void addSubtask()}
            disabled={addingSubtask || !subtaskTitle.trim()}
          >
            <Plus className="size-4" aria-hidden="true" />
            Add
          </Button>
        </div>
      </section>

      <section aria-label="Task actions" className="mt-8 border-t border-border pt-5">
        <h2 className="text-sm font-semibold text-text">Reschedule or let go</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => void onMoveToTomorrow()}>
            <CalendarPlus className="size-4" aria-hidden="true" />
            Move to tomorrow
          </Button>
          <Button variant="secondary" size="sm" onClick={() => void onNotToday()}>
            <CalendarMinus className="size-4" aria-hidden="true" />
            Not today
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setConfirmLetGo(true)}
            className="text-text-secondary hover:text-red-600"
          >
            <CircleX className="size-4" aria-hidden="true" />
            Let go
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setConfirmDelete(true)}
            className="ml-auto text-text-secondary hover:text-red-600"
          >
            <Trash2 className="size-4" aria-hidden="true" />
            Delete
          </Button>
        </div>
      </section>

      <Dialog open={confirmLetGo} onOpenChange={setConfirmLetGo} label="Let go of this task">
        <DialogTitle>Let go of this task?</DialogTitle>
        <DialogDescription>
          Are you sure you no longer need this? It will be marked as
          cancelled and kept for the record.
        </DialogDescription>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setConfirmLetGo(false)}>
            Keep
          </Button>
          <Button variant="destructive" onClick={() => void onLetGo()}>
            Let go
          </Button>
        </div>
      </Dialog>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete} label="Delete this task">
        <DialogTitle>Delete this task?</DialogTitle>
        <DialogDescription>
          This will permanently delete the task
          {task.subtasks.length > 0
            ? ` and its ${task.subtasks.length} subtask${task.subtasks.length === 1 ? "" : "s"}`
            : ""}
          . This cannot be undone.
        </DialogDescription>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setConfirmDelete(false)}>
            Keep
          </Button>
          <Button variant="destructive" onClick={() => void onDelete()}>
            <Check className="size-4" aria-hidden="true" />
            Delete
          </Button>
        </div>
      </Dialog>
    </motion.div>
  );
}
