"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  FolderPlus,
  Archive,
  Trash2,
  Lightbulb,
} from "lucide-react";
import {
  updateIdea,
  setIdeaStatus,
  turnIntoProject,
  deleteIdea,
} from "@/actions/ideas";
import { Dialog, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface IdeaDetailData {
  id: string;
  title: string;
  content: string | null;
  category: string | null;
  status: "NEW" | "EXPLORING" | "TURNED_INTO_PROJECT" | "ARCHIVED";
  why: string | null;
  couldBecome: string | null;
  nextAction: string | null;
}

const STATUS_LABELS: Record<IdeaDetailData["status"], string> = {
  NEW: "New",
  EXPLORING: "Exploring",
  TURNED_INTO_PROJECT: "Turned into project",
  ARCHIVED: "Archived",
};

function TurnIntoProjectDialog({
  open,
  onOpenChange,
  ideaId,
  ideaTitle,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ideaId: string;
  ideaTitle: string;
}) {
  const router = useRouter();
  const [name, setName] = React.useState(ideaTitle);
  const [description, setDescription] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function close() {
    onOpenChange(false);
    window.setTimeout(() => {
      setName(ideaTitle);
      setDescription("");
      setError(null);
    }, 250);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await turnIntoProject({
        ideaId,
        name,
        description: description.trim() ? description : undefined,
      });
      if (res.ok) {
        close();
        router.push("/ideas");
        router.refresh();
      } else {
        setError(res.error ?? "Could not create the project.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} label="Turn idea into project">
      <DialogTitle>Turn into project</DialogTitle>
      <DialogDescription>
        Creates a new project from this idea and marks the idea as turned into
        a project. No tasks are created — you decide what the first steps are.
      </DialogDescription>
      <form onSubmit={onSubmit} className="mt-4 space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="project-name">Project name</Label>
          <Input
            id="project-name"
            data-autofocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={200}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="project-description">Description</Label>
          <Textarea
            id="project-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="What is this project about?"
          />
        </div>
        {error && (
          <p role="alert" className="text-sm text-red-500">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button type="submit" disabled={pending || !name.trim()}>
            {pending ? "Creating…" : "Create project"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

/** Detail editor for one idea: the three exploration fields plus metadata. */
export function IdeaDetail({ idea }: { idea: IdeaDetailData }) {
  const router = useRouter();
  const [title, setTitle] = React.useState(idea.title);
  const [category, setCategory] = React.useState(idea.category ?? "");
  const [content, setContent] = React.useState(idea.content ?? "");
  const [why, setWhy] = React.useState(idea.why ?? "");
  const [couldBecome, setCouldBecome] = React.useState(idea.couldBecome ?? "");
  const [nextAction, setNextAction] = React.useState(idea.nextAction ?? "");
  const [dirty, setDirty] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [savedAt, setSavedAt] = React.useState<Date | null>(null);
  const [saving, startSaving] = React.useTransition();
  const [projectDialogOpen, setProjectDialogOpen] = React.useState(false);
  const [deleteConfirm, setDeleteConfirm] = React.useState(false);

  function markDirty(setter: React.Dispatch<React.SetStateAction<string>>) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setter(e.target.value);
      setDirty(true);
      setSavedAt(null);
    };
  }

  function onSave() {
    setError(null);
    startSaving(async () => {
      const res = await updateIdea(idea.id, {
        title,
        category: category.trim() ? category : undefined,
        content,
        why,
        couldBecome,
        nextAction,
      });
      if (res.ok) {
        setDirty(false);
        setSavedAt(new Date());
        router.refresh();
      } else {
        setError(res.error ?? "Could not save.");
      }
    });
  }

  function onStatus(status: IdeaDetailData["status"]) {
    startSaving(async () => {
      const res = await setIdeaStatus(idea.id, status);
      if (res.ok) router.refresh();
      else setError(res.error ?? "Could not update status.");
    });
  }

  function onDelete() {
    startSaving(async () => {
      const res = await deleteIdea(idea.id);
      if (res.ok) {
        router.push("/ideas");
        router.refresh();
      } else {
        setError(res.error ?? "Could not delete.");
        setDeleteConfirm(false);
      }
    });
  }

  const isArchived = idea.status === "ARCHIVED";
  const isProject = idea.status === "TURNED_INTO_PROJECT";

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/ideas"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Back to ideas
      </Link>

      <div className="rounded-xl border border-border bg-surface p-5 md:p-6">
        <div className="flex items-start justify-between gap-3">
          <span className="flex items-center gap-2 text-text-secondary">
            <Lightbulb className="size-4" aria-hidden="true" />
            <Badge variant="outline">{STATUS_LABELS[idea.status]}</Badge>
          </span>
          <div className="flex items-center gap-1">
            {!isProject && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setProjectDialogOpen(true)}
                disabled={saving}
              >
                <FolderPlus className="size-4" aria-hidden="true" />
                Turn into project
              </Button>
            )}
            {!isArchived && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onStatus("ARCHIVED")}
                disabled={saving}
                aria-label="Archive idea"
              >
                <Archive className="size-4" aria-hidden="true" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDeleteConfirm(true)}
              disabled={saving}
              aria-label="Delete idea"
              className="text-red-500 hover:text-red-500"
            >
              <Trash2 className="size-4" aria-hidden="true" />
            </Button>
          </div>
        </div>

        <div className="mt-4 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="detail-title">Title</Label>
            <Input
              id="detail-title"
              value={title}
              onChange={markDirty(setTitle)}
              maxLength={500}
              className="text-base font-medium"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="detail-category">Category</Label>
            <Input
              id="detail-category"
              value={category}
              onChange={markDirty(setCategory)}
              placeholder="General"
              maxLength={100}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="detail-why">Why it&apos;s interesting</Label>
            <Textarea
              id="detail-why"
              value={why}
              onChange={markDirty(setWhy)}
              rows={3}
              placeholder="What about this idea keeps pulling you back?"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="detail-become">What could it become?</Label>
            <Textarea
              id="detail-become"
              value={couldBecome}
              onChange={markDirty(setCouldBecome)}
              rows={3}
              placeholder="If this grew up, what would it look like?"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="detail-next">Potential next action</Label>
            <Textarea
              id="detail-next"
              value={nextAction}
              onChange={markDirty(setNextAction)}
              rows={2}
              placeholder="The smallest step that would move this forward."
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="detail-notes">Notes</Label>
            <Textarea
              id="detail-notes"
              value={content}
              onChange={markDirty(setContent)}
              rows={4}
              placeholder="Anything else worth remembering."
            />
          </div>

          <div className="space-y-1.5">
            <span id="detail-status-label" className="text-sm font-medium text-text">
              Status
            </span>
            <div
              role="group"
              aria-labelledby="detail-status-label"
              className="flex flex-wrap gap-2"
            >
              {(Object.keys(STATUS_LABELS) as IdeaDetailData["status"][]).map(
                (s) => (
                  <Button
                    key={s}
                    type="button"
                    variant={idea.status === s ? "default" : "outline"}
                    size="sm"
                    onClick={() => onStatus(s)}
                    disabled={saving || idea.status === s}
                    className={cn(idea.status === s && "pointer-events-none")}
                  >
                    {STATUS_LABELS[s]}
                  </Button>
                ),
              )}
            </div>
          </div>
        </div>

        {error && (
          <p role="alert" className="mt-4 text-sm text-red-500">
            {error}
          </p>
        )}

        <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
          <p className="text-xs text-text-secondary" aria-live="polite">
            {savedAt
              ? "Saved just now."
              : dirty
                ? "Unsaved changes."
                : "Everything is saved."}
          </p>
          <Button onClick={onSave} disabled={saving || !dirty || !title.trim()}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </div>

      <TurnIntoProjectDialog
        open={projectDialogOpen}
        onOpenChange={setProjectDialogOpen}
        ideaId={idea.id}
        ideaTitle={idea.title}
      />

      <Dialog
        open={deleteConfirm}
        onOpenChange={setDeleteConfirm}
        label="Delete idea"
      >
        <DialogTitle>Delete this idea?</DialogTitle>
        <DialogDescription>
          “{idea.title}” will be permanently deleted. This cannot be undone.
        </DialogDescription>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setDeleteConfirm(false)}>
            Keep it
          </Button>
          <Button variant="destructive" onClick={onDelete} disabled={saving}>
            {saving ? "Deleting…" : "Delete idea"}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
