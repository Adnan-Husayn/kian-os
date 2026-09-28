"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import {
  ArrowLeft,
  Pin,
  PinOff,
  Trash2,
  Eye,
  Pencil,
  X,
} from "lucide-react";
import {
  updateNote,
  setNoteTags,
  linkNoteToProject,
  togglePin,
  deleteNote,
} from "@/actions/notes";
import { Dialog, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface NoteDetailData {
  id: string;
  title: string;
  content: string | null;
  tags: string[];
  pinned: boolean;
  projectId: string | null;
}

export interface ProjectOption {
  id: string;
  name: string;
}

/** Editor for one note: title, tags, markdown content with preview. */
export function NoteEditor({
  note,
  projects,
}: {
  note: NoteDetailData;
  projects: ProjectOption[];
}) {
  const router = useRouter();
  const [title, setTitle] = React.useState(note.title);
  const [content, setContent] = React.useState(note.content ?? "");
  const [preview, setPreview] = React.useState(false);
  const [tagInput, setTagInput] = React.useState("");
  const [deleteConfirm, setDeleteConfirm] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [savedNote, setSavedNote] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  const dirty =
    title !== note.title || content !== (note.content ?? "");

  function saveField(patch: { title?: string; content?: string }) {
    setError(null);
    startTransition(async () => {
      const res = await updateNote(note.id, patch);
      if (res.ok) {
        setSavedNote("Saved.");
        router.refresh();
      } else {
        setError(res.error ?? "Could not save.");
      }
    });
  }

  function onSave() {
    saveField({ title, content });
  }

  function onTitleBlur() {
    if (title !== note.title && title.trim()) saveField({ title });
  }

  function onContentBlur() {
    if (content !== (note.content ?? "")) saveField({ content });
  }

  function addTag(raw: string) {
    const tag = raw.trim().toLowerCase().replace(/\s+/g, "-");
    if (!tag || note.tags.includes(tag)) {
      setTagInput("");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await setNoteTags({ id: note.id, tags: [...note.tags, tag] });
      if (res.ok) router.refresh();
      else setError(res.error ?? "Could not add the tag.");
      setTagInput("");
    });
  }

  function removeTag(tag: string) {
    setError(null);
    startTransition(async () => {
      const res = await setNoteTags({
        id: note.id,
        tags: note.tags.filter((t) => t !== tag),
      });
      if (res.ok) router.refresh();
      else setError(res.error ?? "Could not remove the tag.");
    });
  }

  function onProjectChange(projectId: string) {
    setError(null);
    startTransition(async () => {
      const res = await linkNoteToProject({
        id: note.id,
        projectId: projectId === "" ? null : projectId,
      });
      if (res.ok) router.refresh();
      else setError(res.error ?? "Could not update the project link.");
    });
  }

  function onTogglePin() {
    setError(null);
    startTransition(async () => {
      const res = await togglePin(note.id);
      if (res.ok) router.refresh();
      else setError(res.error ?? "Could not change pin.");
    });
  }

  function onDelete() {
    startTransition(async () => {
      const res = await deleteNote(note.id);
      if (res.ok) {
        router.push("/notes");
        router.refresh();
      } else {
        setError(res.error ?? "Could not delete.");
        setDeleteConfirm(false);
      }
    });
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/notes"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Back to notes
      </Link>

      <article className="rounded-xl border border-border bg-surface p-5 md:p-6">
        <div className="flex items-start justify-between gap-2">
          <label htmlFor="note-title" className="sr-only">
            Note title
          </label>
          <Input
            id="note-title"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setSavedNote(null);
            }}
            onBlur={onTitleBlur}
            maxLength={500}
            className="border-0 bg-transparent px-0 text-lg font-semibold shadow-none focus-visible:ring-0"
            aria-label="Note title"
          />
          <div className="flex shrink-0 items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={onTogglePin}
              disabled={pending}
              aria-pressed={note.pinned}
              aria-label={note.pinned ? "Unpin note" : "Pin note"}
              title={note.pinned ? "Unpin" : "Pin"}
            >
              {note.pinned ? (
                <PinOff className="size-4" aria-hidden="true" />
              ) : (
                <Pin className="size-4" aria-hidden="true" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDeleteConfirm(true)}
              disabled={pending}
              aria-label="Delete note"
              className="text-red-500 hover:text-red-500"
            >
              <Trash2 className="size-4" aria-hidden="true" />
            </Button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap items-center gap-1.5" aria-label="Tags">
            {note.tags.map((tag) => (
              <Badge key={tag} variant="outline" className="gap-1 pr-1">
                {tag}
                <button
                  type="button"
                  onClick={() => removeTag(tag)}
                  disabled={pending}
                  aria-label={`Remove tag ${tag}`}
                  className="rounded-full p-0.5 hover:bg-accent-soft"
                >
                  <X className="size-3" aria-hidden="true" />
                </button>
              </Badge>
            ))}
          </div>
          <label htmlFor="note-tag-input" className="sr-only">
            Add a tag
          </label>
          <Input
            id="note-tag-input"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault();
                addTag(tagInput.replace(/,+$/, ""));
              }
            }}
            onBlur={() => {
              if (tagInput.trim()) addTag(tagInput);
            }}
            placeholder="Add tag…"
            className="h-7 w-28 border-dashed text-xs"
            maxLength={60}
            disabled={pending}
          />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="note-project">Project</Label>
            <Select
              id="note-project"
              value={note.projectId ?? ""}
              onChange={(e) => onProjectChange(e.target.value)}
              disabled={pending}
            >
              <option value="">No project</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex items-end justify-end">
            <div
              role="group"
              aria-label="Editor mode"
              className="inline-flex items-center gap-1 rounded-lg border border-border bg-bg p-1"
            >
              <Button
                variant={!preview ? "default" : "ghost"}
                size="sm"
                onClick={() => setPreview(false)}
                aria-pressed={!preview}
              >
                <Pencil className="size-3.5" aria-hidden="true" />
                Write
              </Button>
              <Button
                variant={preview ? "default" : "ghost"}
                size="sm"
                onClick={() => setPreview(true)}
                aria-pressed={preview}
              >
                <Eye className="size-3.5" aria-hidden="true" />
                Preview
              </Button>
            </div>
          </div>
        </div>

        <div className="mt-3">
          {preview ? (
            <div
              className="note-body min-h-48 rounded-md border border-border bg-bg/50 px-4 py-3"
              aria-label="Note preview"
            >
              {content.trim() ? (
                <ReactMarkdown>{content}</ReactMarkdown>
              ) : (
                <p className="text-sm text-text-secondary">
                  Nothing to preview yet.
                </p>
              )}
            </div>
          ) : (
            <>
              <label htmlFor="note-content" className="sr-only">
                Note content (markdown)
              </label>
              <Textarea
                id="note-content"
                value={content}
                onChange={(e) => {
                  setContent(e.target.value);
                  setSavedNote(null);
                }}
                onBlur={onContentBlur}
                rows={14}
                placeholder="Write in markdown…"
                className={cn("font-mono text-sm leading-relaxed")}
              />
            </>
          )}
        </div>

        {error && (
          <p role="alert" className="mt-3 text-sm text-red-500">
            {error}
          </p>
        )}

        <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
          <p className="text-xs text-text-secondary" aria-live="polite">
            {error
              ? "Something went wrong."
              : savedNote ?? (dirty ? "Unsaved changes." : "Everything is saved.")}
          </p>
          <Button onClick={onSave} disabled={pending || !dirty || !title.trim()}>
            {pending ? "Saving…" : "Save"}
          </Button>
        </div>
      </article>

      <Dialog
        open={deleteConfirm}
        onOpenChange={setDeleteConfirm}
        label="Delete note"
      >
        <DialogTitle>Delete this note?</DialogTitle>
        <DialogDescription>
          “{note.title}” will be permanently deleted. This cannot be undone.
        </DialogDescription>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setDeleteConfirm(false)}>
            Keep it
          </Button>
          <Button variant="destructive" onClick={onDelete} disabled={pending}>
            {pending ? "Deleting…" : "Delete note"}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
