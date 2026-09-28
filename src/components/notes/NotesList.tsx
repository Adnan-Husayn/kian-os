"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import { Plus, Search, StickyNote, Pin, Tag } from "lucide-react";
import { createNote } from "@/actions/notes";
import { Dialog, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface NoteSummary {
  id: string;
  title: string;
  content: string | null;
  tags: string[];
  pinned: boolean;
  projectId: string | null;
  projectName: string | null;
  updatedAt: Date;
}

function NewNoteDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [title, setTitle] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function close() {
    onOpenChange(false);
    window.setTimeout(() => {
      setTitle("");
      setError(null);
    }, 250);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await createNote({ title });
      if (res.ok && res.id) {
        close();
        router.push(`/notes/${res.id}`);
      } else {
        setError(res.error ?? "Could not create the note.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} label="New note">
      <DialogTitle>New note</DialogTitle>
      <DialogDescription>
        Give it a title — you can write the rest on the note page.
      </DialogDescription>
      <form onSubmit={onSubmit} className="mt-4 space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="note-title">Title</Label>
          <Input
            id="note-title"
            data-autofocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What is this note about?"
            maxLength={500}
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
          <Button type="submit" disabled={pending || !title.trim()}>
            {pending ? "Creating…" : "Create note"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function NoteCard({
  note,
  highlighted,
  cardRef,
}: {
  note: NoteSummary;
  highlighted: boolean;
  cardRef?: React.Ref<HTMLAnchorElement>;
}) {
  const preview = (note.content ?? "").replace(/\s+/g, " ").trim();
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
    >
      <Link
        ref={cardRef}
        href={`/notes/${note.id}`}
        aria-label={`Open note: ${note.title}`}
        className={cn(
          "block rounded-lg border bg-surface p-4 transition-shadow hover:shadow-sm",
          highlighted
            ? "border-accent shadow-[0_0_0_2px_var(--accent-soft)]"
            : "border-border",
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-medium leading-snug text-text">
            {note.title}
          </h3>
          {note.pinned && (
            <Pin
              className="size-3.5 shrink-0 text-accent"
              aria-label="Pinned"
            />
          )}
        </div>
        {preview && (
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-text-secondary">
            {preview.slice(0, 160)}
          </p>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {note.tags.slice(0, 4).map((tag) => (
            <Badge key={tag} variant="outline" className="text-[11px]">
              {tag}
            </Badge>
          ))}
          {note.projectName && (
            <Badge variant="secondary" className="text-[11px]">
              {note.projectName}
            </Badge>
          )}
          <span className="ml-auto text-[11px] text-text-secondary">
            {formatDistanceToNow(new Date(note.updatedAt), { addSuffix: true })}
          </span>
        </div>
      </Link>
    </motion.div>
  );
}

/**
 * Notes index: pinned section, tag filter chips, text search, new-note
 * dialog. Filtering is client-side over the user's notes.
 */
export function NotesList({
  notes,
  highlightId,
}: {
  notes: NoteSummary[];
  highlightId?: string;
}) {
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [activeTag, setActiveTag] = React.useState<string | null>(null);
  const highlightRef = React.useRef<HTMLAnchorElement>(null);

  const allTags = React.useMemo(() => {
    const counts = new Map<string, number>();
    for (const n of notes) {
      for (const t of n.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [notes]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return notes.filter((n) => {
      if (activeTag && !n.tags.includes(activeTag)) return false;
      if (!q) return true;
      return (
        n.title.toLowerCase().includes(q) ||
        (n.content ?? "").toLowerCase().includes(q)
      );
    });
  }, [notes, query, activeTag]);

  const pinned = filtered.filter((n) => n.pinned);
  const rest = filtered.filter((n) => !n.pinned);

  React.useEffect(() => {
    if (highlightId && highlightRef.current) {
      highlightRef.current.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [highlightId]);

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-text">
            <StickyNote className="size-5 text-accent" aria-hidden="true" />
            Notes
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            {notes.length === 0
              ? "A quiet place for longer thoughts."
              : `${notes.length} note${notes.length === 1 ? "" : "s"}.`}
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="size-4" aria-hidden="true" />
          New note
        </Button>
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-secondary"
            aria-hidden="true"
          />
          <label htmlFor="notes-search" className="sr-only">
            Search notes
          </label>
          <Input
            id="notes-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search title or content…"
            className="pl-9"
          />
        </div>
      </div>

      {allTags.length > 0 && (
        <div
          className="mb-5 flex flex-wrap items-center gap-1.5"
          role="group"
          aria-label="Filter by tag"
        >
          <Tag className="size-3.5 text-text-secondary" aria-hidden="true" />
          <Button
            variant={activeTag === null ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTag(null)}
          >
            All
          </Button>
          {allTags.map(([tag, count]) => (
            <Button
              key={tag}
              variant={activeTag === tag ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTag(activeTag === tag ? null : tag)}
              aria-pressed={activeTag === tag}
            >
              {tag}
              <span className="ml-1 text-[11px] opacity-70">{count}</span>
            </Button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-bg/50 px-6 py-14 text-center">
          <StickyNote
            className="mx-auto size-8 text-text-secondary"
            aria-hidden="true"
          />
          <p className="mt-3 text-sm font-medium text-text">
            {notes.length === 0 ? "No notes yet" : "No notes match"}
          </p>
          <p className="mt-1 text-sm text-text-secondary">
            {notes.length === 0
              ? "Create your first note to get started."
              : "Try a different search or tag."}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {pinned.length > 0 && (
            <section aria-label="Pinned notes">
              <h2 className="mb-2 flex items-center gap-1.5 text-sm font-medium text-text-secondary">
                <Pin className="size-3.5" aria-hidden="true" />
                Pinned
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {pinned.map((n) => (
                  <NoteCard
                    key={n.id}
                    note={n}
                    highlighted={n.id === highlightId}
                    cardRef={n.id === highlightId ? highlightRef : undefined}
                  />
                ))}
              </div>
            </section>
          )}
          <section aria-label="All notes">
            {pinned.length > 0 && (
              <h2 className="mb-2 text-sm font-medium text-text-secondary">
                All notes
              </h2>
            )}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {rest.map((n) => (
                <NoteCard
                  key={n.id}
                  note={n}
                  highlighted={n.id === highlightId}
                  cardRef={n.id === highlightId ? highlightRef : undefined}
                />
              ))}
            </div>
          </section>
        </div>
      )}

      <NewNoteDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
