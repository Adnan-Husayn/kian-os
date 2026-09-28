"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, Plus, StickyNote, Target, Trash2 } from "lucide-react";
import { createTask } from "@/actions/tasks";
import {
  deleteProject,
  setProjectStatus,
  updateProject,
} from "@/actions/projects";
import { cn } from "@/lib/utils";
import { formatKolkata } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { TaskRow } from "@/components/tasks/TaskRow";
import { PRIORITY_WEIGHT, type TaskListItem } from "@/components/tasks/types";
import type { ProjectStatus } from "@prisma/client";

interface ProjectDetailViewProps {
  project: {
    id: string;
    name: string;
    description: string | null;
    color: string | null;
    status: ProjectStatus;
  };
  tasks: TaskListItem[];
  progress: { total: number; done: number; percent: number };
  notes: Array<{ id: string; title: string; updatedAt: Date }>;
}

const PROJECT_STATUSES: ProjectStatus[] = [
  "ACTIVE",
  "PAUSED",
  "COMPLETED",
  "ARCHIVED",
];

const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  ACTIVE: "Active",
  PAUSED: "Paused",
  COMPLETED: "Completed",
  ARCHIVED: "Archived",
};

function nextAction(tasks: TaskListItem[]): TaskListItem | null {
  const open = tasks.filter(
    (t) => t.status !== "DONE" && t.status !== "CANCELLED",
  );
  if (open.length === 0) return null;
  return [...open].sort(
    (a, b) =>
      PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority] ||
      (a.dueDate?.getTime() ?? Number.MAX_SAFE_INTEGER) -
        (b.dueDate?.getTime() ?? Number.MAX_SAFE_INTEGER) ||
      a.createdAt.getTime() - b.createdAt.getTime(),
  )[0]!;
}

/**
 * /projects/[id]: header with editable name/description, status control,
 * NEXT ACTION card, inline task add + task list, linked notes, and delete
 * (tasks are kept, unassigned — the dialog says so).
 */
export function ProjectDetailView({
  project,
  tasks,
  progress,
  notes,
}: ProjectDetailViewProps) {
  const router = useRouter();
  const color = project.color ?? "#6366f1";

  const [name, setName] = React.useState(project.name);
  const [description, setDescription] = React.useState(project.description ?? "");
  const [savedFlash, setSavedFlash] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [quickAdd, setQuickAdd] = React.useState("");
  const [adding, setAdding] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  const action = nextAction(tasks);

  async function saveProject(patch: { name?: string; description?: string | null }) {
    const result = await updateProject(project.id, patch);
    if (result.ok) {
      setSavedFlash(true);
      window.setTimeout(() => setSavedFlash(false), 1600);
      router.refresh();
    } else {
      setError(result.error ?? "Could not save.");
    }
  }

  async function onStatusChange(status: ProjectStatus) {
    const result = await setProjectStatus(project.id, status);
    if (result.ok) router.refresh();
    else setError(result.error ?? "Could not update status.");
  }

  async function onQuickAdd() {
    const title = quickAdd.trim();
    if (!title || adding) return;
    setAdding(true);
    const result = await createTask({ title, projectId: project.id });
    if (result.ok) {
      setQuickAdd("");
      router.refresh();
    } else {
      setError(result.error ?? "Could not add the task.");
    }
    setAdding(false);
  }

  async function onDelete() {
    setConfirmDelete(false);
    const result = await deleteProject(project.id);
    if (result.ok) router.push("/projects");
    else setError(result.error ?? "Could not delete the project.");
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
    >
      <Link
        href="/projects"
        className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Projects
      </Link>

      <header className="mt-4 flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <span
            aria-hidden="true"
            className="mt-1.5 size-4 shrink-0 rounded-full"
            style={{ backgroundColor: color }}
          />
          <div className="min-w-0 flex-1">
            <Label htmlFor="project-name" className="sr-only">
              Project name
            </Label>
            <Input
              id="project-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => {
                const n = name.trim();
                if (n && n !== project.name) void saveProject({ name: n });
                else setName(project.name);
              }}
              maxLength={200}
              className="h-auto border-0 bg-transparent px-0 text-2xl font-semibold shadow-none"
              aria-label="Project name"
            />
            <p className="h-4 text-xs text-text-secondary" aria-live="polite">
              {savedFlash ? "Saved" : error ?? ""}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Select
            aria-label="Project status"
            value={project.status}
            onChange={(e) => void onStatusChange(e.target.value as ProjectStatus)}
            className="w-auto"
          >
            {PROJECT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {PROJECT_STATUS_LABEL[s]}
              </option>
            ))}
          </Select>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setConfirmDelete(true)}
            className="text-text-secondary hover:text-red-600"
            aria-label={`Delete project ${project.name}`}
          >
            <Trash2 className="size-4" aria-hidden="true" />
          </Button>
        </div>
      </header>

      <div className="mt-1">
        <Label htmlFor="project-description" className="sr-only">
          Project description
        </Label>
        <Textarea
          id="project-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={() => {
            if (description !== (project.description ?? ""))
              void saveProject({ description: description.trim() || null });
          }}
          placeholder="What is this project about?"
          rows={2}
          className="resize-none border-0 bg-transparent px-0 text-sm text-text-secondary shadow-none"
        />
      </div>

      <div className="mt-3 flex items-center gap-3">
        <div
          className="h-1.5 flex-1 overflow-hidden rounded-full bg-border"
          role="progressbar"
          aria-valuenow={progress.percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${progress.percent}% of tasks done`}
        >
          <div
            className="h-full rounded-full transition-[width] duration-200"
            style={{ width: `${progress.percent}%`, backgroundColor: color }}
          />
        </div>
        <span className="text-xs text-text-secondary">
          {progress.done} of {progress.total} done
        </span>
      </div>

      <section aria-label="Next action" className="mt-6">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-text">
          <Target className="size-4" aria-hidden="true" />
          Next action
        </h2>
        <div className="mt-2 rounded-xl border border-border bg-surface p-4">
          {action ? (
            <TaskRow task={action} />
          ) : (
            <p className="text-sm text-text-secondary">
              No next action — add one below to keep this project moving.
            </p>
          )}
        </div>
      </section>

      <section aria-label="Project tasks" className="mt-6">
        <h2 className="text-sm font-semibold text-text">Tasks</h2>
        <div className="mt-2 flex gap-2">
          <Input
            value={quickAdd}
            onChange={(e) => setQuickAdd(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void onQuickAdd();
              }
            }}
            placeholder="Add a task to this project…"
            maxLength={500}
            aria-label="New task title"
            disabled={adding}
          />
          <Button
            variant="secondary"
            onClick={() => void onQuickAdd()}
            disabled={adding || !quickAdd.trim()}
          >
            <Plus className="size-4" aria-hidden="true" />
            Add
          </Button>
        </div>
        <div className="mt-3 space-y-2">
          {tasks.map((t) => (
            <TaskRow key={t.id} task={t} />
          ))}
          {tasks.length === 0 && (
            <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-text-secondary">
              No tasks yet.
            </p>
          )}
        </div>
      </section>

      <section aria-label="Linked notes" className="mt-6">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-text">
            <StickyNote className="size-4" aria-hidden="true" />
            Linked notes
          </h2>
          <Link href="/notes" className="text-sm text-accent hover:underline">
            Open notes
          </Link>
        </div>
        {notes.length > 0 ? (
          <ul className="mt-2 divide-y divide-border rounded-xl border border-border bg-surface">
            {notes.map((n) => (
              <li key={n.id} className="px-4 py-3">
                <p className="text-sm font-medium text-text">{n.title}</p>
                <p className="mt-0.5 text-xs text-text-secondary">
                  {formatKolkata(n.updatedAt, "EEE, d MMM yyyy")}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-text-secondary">
            No notes linked to this project yet.
          </p>
        )}
      </section>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete} label="Delete project">
        <DialogTitle>Delete this project?</DialogTitle>
        <DialogDescription>
          The project will be deleted, but its{" "}
          <span className={cn("font-medium text-text")}>
            tasks and notes will be kept
          </span>{" "}
          — they will simply become unassigned. This cannot be undone.
        </DialogDescription>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setConfirmDelete(false)}>
            Keep
          </Button>
          <Button variant="destructive" onClick={() => void onDelete()}>
            Delete project
          </Button>
        </div>
      </Dialog>
    </motion.div>
  );
}
