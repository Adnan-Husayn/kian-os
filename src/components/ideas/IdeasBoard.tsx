"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import { Plus, Lightbulb } from "lucide-react";
import { createIdea, setIdeaStatus } from "@/actions/ideas";
import { Dialog, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface IdeaSummary {
  id: string;
  title: string;
  content: string | null;
  category: string | null;
  status: "NEW" | "EXPLORING" | "TURNED_INTO_PROJECT" | "ARCHIVED";
  createdAt: Date;
  updatedAt: Date;
}

const COLUMNS: {
  status: IdeaSummary["status"];
  label: string;
  emptyText: string;
}[] = [
  { status: "NEW", label: "New", emptyText: "No new sparks yet." },
  { status: "EXPLORING", label: "Exploring", emptyText: "Nothing being explored." },
  {
    status: "TURNED_INTO_PROJECT",
    label: "Turned into projects",
    emptyText: "No ideas have become projects yet.",
  },
  { status: "ARCHIVED", label: "Archived", emptyText: "Archive is empty." },
];

const STATUS_LABELS: Record<IdeaSummary["status"], string> = {
  NEW: "New",
  EXPLORING: "Exploring",
  TURNED_INTO_PROJECT: "Turned into projects",
  ARCHIVED: "Archived",
};

function excerpt(content: string | null, max = 140): string {
  const text = (content ?? "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
}

function IdeaCard({
  idea,
  highlighted,
  cardRef,
}: {
  idea: IdeaSummary;
  highlighted: boolean;
  cardRef?: React.Ref<HTMLDivElement>;
}) {
  const [pending, startTransition] = React.useTransition();
  const router = useRouter();

  function onStatusChange(status: string) {
    startTransition(async () => {
      const res = await setIdeaStatus(idea.id, status);
      if (res.ok) router.refresh();
    });
  }

  return (
    <motion.div
      ref={cardRef}
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className={cn(
        "rounded-lg border bg-surface p-3 transition-shadow",
        highlighted
          ? "border-accent shadow-[0_0_0_2px_var(--accent-soft)]"
          : "border-border hover:shadow-sm",
      )}
    >
      <Link href={`/ideas/${idea.id}`} className="block" aria-label={`Open idea: ${idea.title}`}>
        <h3 className="text-sm font-medium leading-snug text-text">
          {idea.title}
        </h3>
        {excerpt(idea.content) && (
          <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-text-secondary">
            {excerpt(idea.content)}
          </p>
        )}
      </Link>
      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          {idea.category && (
            <Badge variant="outline" className="max-w-24 truncate text-[11px]">
              {idea.category}
            </Badge>
          )}
          <span className="shrink-0 text-[11px] text-text-secondary">
            {formatDistanceToNow(new Date(idea.createdAt), { addSuffix: true })}
          </span>
        </div>
        <label className="sr-only" htmlFor={`status-${idea.id}`}>
          Move idea to status
        </label>
        <Select
          id={`status-${idea.id}`}
          aria-label={`Move "${idea.title}" to another column`}
          value={idea.status}
          disabled={pending}
          onChange={(e) => onStatusChange(e.target.value)}
          className="h-7 w-auto border-0 bg-transparent py-0 pl-1 pr-7 text-[11px] text-text-secondary"
        >
          {(Object.keys(STATUS_LABELS) as IdeaSummary["status"][]).map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </Select>
      </div>
    </motion.div>
  );
}

function NewIdeaDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [title, setTitle] = React.useState("");
  const [category, setCategory] = React.useState("");
  const [content, setContent] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function close() {
    onOpenChange(false);
    window.setTimeout(() => {
      setTitle("");
      setCategory("");
      setContent("");
      setError(null);
    }, 250);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await createIdea({
        title,
        category: category.trim() ? category : undefined,
        content: content.trim() ? content : undefined,
      });
      if (res.ok) {
        close();
        router.refresh();
      } else {
        setError(res.error ?? "Could not save the idea.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} label="New idea">
      <DialogTitle>New idea</DialogTitle>
      <DialogDescription>
        Capture the spark. You can explore it, or archive it, later.
      </DialogDescription>
      <form onSubmit={onSubmit} className="mt-4 space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="idea-title">Title</Label>
          <Input
            id="idea-title"
            data-autofocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What is the idea?"
            maxLength={500}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="idea-category">Category</Label>
          <Input
            id="idea-category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="General"
            maxLength={100}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="idea-content">Notes</Label>
          <Textarea
            id="idea-content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Why it caught your attention…"
            rows={4}
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
            {pending ? "Saving…" : "Save idea"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

/**
 * Kanban-style board of ideas grouped by status. "I" (when not typing)
 * opens the new-idea dialog.
 */
export function IdeasBoard({
  ideas,
  highlightId,
}: {
  ideas: IdeaSummary[];
  highlightId?: string;
}) {
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const highlightRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target;
      if (target instanceof HTMLElement) {
        const tag = target.tagName;
        if (
          tag === "INPUT" ||
          tag === "TEXTAREA" ||
          tag === "SELECT" ||
          target.isContentEditable
        ) {
          return;
        }
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key.toLowerCase() === "i") {
        e.preventDefault();
        setDialogOpen(true);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

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
            <Lightbulb className="size-5 text-accent" aria-hidden="true" />
            Ideas
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            Sparks worth keeping. Ideas never become tasks on their own.
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="size-4" aria-hidden="true" />
          New idea
          <kbd className="ml-1 rounded border border-border bg-bg px-1 font-mono text-[10px] text-text-secondary">
            I
          </kbd>
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {COLUMNS.map((col) => {
          const items = ideas.filter((i) => i.status === col.status);
          return (
            <section key={col.status} aria-label={`${col.label} ideas`}>
              <h2 className="mb-2 flex items-center justify-between text-sm font-medium text-text-secondary">
                {col.label}
                <span
                  className="rounded-full bg-accent-soft px-2 py-0.5 text-xs text-accent"
                  aria-label={`${items.length} ideas`}
                >
                  {items.length}
                </span>
              </h2>
              <div className="space-y-2 rounded-xl border border-dashed border-border bg-bg/50 p-2">
                {items.length === 0 ? (
                  <p className="px-2 py-6 text-center text-xs text-text-secondary">
                    {col.emptyText}
                  </p>
                ) : (
                  items.map((idea) => (
                    <IdeaCard
                      key={idea.id}
                      idea={idea}
                      highlighted={idea.id === highlightId}
                      cardRef={idea.id === highlightId ? highlightRef : undefined}
                    />
                  ))
                )}
              </div>
            </section>
          );
        })}
      </div>

      <NewIdeaDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
