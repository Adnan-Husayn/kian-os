"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { createTask, type CreateTaskInput } from "@/actions/tasks";
import { listProjects } from "@/actions/projects";
import { cn } from "@/lib/utils";
import { Dialog, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import {
  PRIORITY_LABEL,
  type ProjectOption,
} from "@/components/tasks/types";
import type { TaskPriority } from "@prisma/client";

interface NewTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When omitted, projects are fetched when the dialog opens. */
  projects?: ProjectOption[];
  defaultProjectId?: string;
  /** Prefilled title, e.g. from search. */
  defaultTitle?: string;
}

/** Midnight-Kolkata instant for a yyyy-MM-dd day key (no DST in Kolkata). */
function kolkataMidnight(dayKey: string): Date {
  return new Date(`${dayKey}T00:00:00+05:30`);
}

const PRIORITIES: TaskPriority[] = ["LOW", "MEDIUM", "HIGH"];

/**
 * New-task dialog used by the tasks page, project pages and the global
 * "N" shortcut. Projects load lazily when the dialog opens so it can be
 * mounted globally without data.
 */
export function NewTaskDialog({
  open,
  onOpenChange,
  projects: projectsProp,
  defaultProjectId,
  defaultTitle,
}: NewTaskDialogProps) {
  const router = useRouter();
  const [projects, setProjects] = React.useState<ProjectOption[]>(
    projectsProp ?? [],
  );
  const [title, setTitle] = React.useState(defaultTitle ?? "");
  const [projectId, setProjectId] = React.useState(defaultProjectId ?? "");
  const [priority, setPriority] = React.useState<TaskPriority>("MEDIUM");
  const [scheduledDate, setScheduledDate] = React.useState("");
  const [dueDate, setDueDate] = React.useState("");
  const [estimatedMinutes, setEstimatedMinutes] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Reset the form each time the dialog opens (render-phase reset keyed on
  // the open transition — the sanctioned alternative to setState-in-effect).
  const [wasOpen, setWasOpen] = React.useState(false);
  if (open && !wasOpen) {
    setWasOpen(true);
    setTitle(defaultTitle ?? "");
    setProjectId(defaultProjectId ?? "");
    setPriority("MEDIUM");
    setScheduledDate("");
    setDueDate("");
    setEstimatedMinutes("");
    setError(null);
    if (!projectsProp) {
      void listProjects().then(setProjects).catch(() => undefined);
    }
  } else if (!open && wasOpen) {
    setWasOpen(false);
  }

  async function submit() {
    if (!title.trim()) {
      setError("Give the task a title first.");
      return;
    }
    setSaving(true);
    setError(null);

    const input: CreateTaskInput = {
      title: title.trim(),
      priority,
      projectId: projectId || undefined,
      scheduledDate: scheduledDate ? kolkataMidnight(scheduledDate) : undefined,
      dueDate: dueDate ? kolkataMidnight(dueDate) : undefined,
      estimatedMinutes: estimatedMinutes ? Number(estimatedMinutes) : undefined,
    };

    try {
      const result = await createTask(input);
      if (result.ok) {
        onOpenChange(false);
        router.refresh();
      } else {
        setError(result.error ?? "Could not create the task.");
      }
    } catch {
      setError("Could not create the task.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} label="New task">
      <DialogTitle>New task</DialogTitle>
      <DialogDescription>
        Capture it now, organize it later.
      </DialogDescription>

      <form
        className="mt-4 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="new-task-title">Title</Label>
          <Input
            id="new-task-title"
            data-autofocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What needs doing?"
            maxLength={500}
            disabled={saving}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="new-task-project">Project</Label>
            <Select
              id="new-task-project"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              disabled={saving}
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
            <Label htmlFor="new-task-estimate">Estimate (min)</Label>
            <Input
              id="new-task-estimate"
              type="number"
              min={1}
              max={1440}
              value={estimatedMinutes}
              onChange={(e) => setEstimatedMinutes(e.target.value)}
              placeholder="30"
              disabled={saving}
            />
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
                onClick={() => setPriority(p)}
                disabled={saving}
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

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="new-task-scheduled">Scheduled</Label>
            <Input
              id="new-task-scheduled"
              type="date"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              disabled={saving}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-task-due">Due</Label>
            <Input
              id="new-task-due"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              disabled={saving}
            />
          </div>
        </div>

        {error && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Creating…" : "Create task"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
