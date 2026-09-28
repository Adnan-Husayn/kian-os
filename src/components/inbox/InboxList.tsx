"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import {
  Archive,
  BellRing,
  Inbox as InboxIcon,
  Lightbulb,
  StickyNote,
  Trash2,
  Zap,
} from "lucide-react";
import {
  archiveCapture,
  bulkProcess,
  convertCapture,
  deleteCapture,
  type InboxCapture,
} from "@/actions/inbox";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Tooltip } from "@/components/ui/tooltip";
import { EmptyState } from "@/components/layout/EmptyState";

interface InboxListProps {
  captures: InboxCapture[];
}

const TYPE_META: Record<
  InboxCapture["type"],
  { label: string; icon: React.ComponentType<{ className?: string }> }
> = {
  TASK: { label: "Task", icon: Zap },
  IDEA: { label: "Idea", icon: Lightbulb },
  NOTE: { label: "Note", icon: StickyNote },
  REMINDER: { label: "Reminder", icon: BellRing },
  UNKNOWN: { label: "Unsorted", icon: InboxIcon },
};

function relativeTime(date: Date): string {
  return `Captured ${formatDistanceToNow(date, { addSuffix: true })}`;
}

function ConvertButton({
  kind,
  label,
  onConvert,
}: {
  kind: "task" | "idea" | "note";
  label: string;
  onConvert: (kind: "task" | "idea" | "note") => void;
}) {
  const icons = { task: Zap, idea: Lightbulb, note: StickyNote } as const;
  const Icon = icons[kind];
  return (
    <Tooltip content={label}>
      <button
        type="button"
        aria-label={label}
        onClick={() => onConvert(kind)}
        className="rounded-md p-1.5 text-text-secondary transition-colors duration-150 hover:bg-accent-soft hover:text-accent"
      >
        <Icon className="size-4" aria-hidden="true" />
      </button>
    </Tooltip>
  );
}

/**
 * /inbox — unprocessed captures with per-item convert/archive/delete,
 * multi-select + bulk bar, and a "Processed" toggle to review what's
 * already handled.
 */
export function InboxList({ captures }: InboxListProps) {
  const router = useRouter();
  const [showProcessed, setShowProcessed] = React.useState(false);
  const [selectedRaw, setSelectedRaw] = React.useState<Set<string>>(new Set());
  const [busy, setBusy] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(null);

  const visible = React.useMemo(
    () => captures.filter((c) => c.processed === showProcessed),
    [captures, showProcessed],
  );

  // Selections are intersected with what's visible — no effect needed.
  const selected = React.useMemo(() => {
    const visibleIds = new Set(visible.map((c) => c.id));
    return new Set([...selectedRaw].filter((id) => visibleIds.has(id)));
  }, [selectedRaw, visible]);

  function flash(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(null), 2200);
  }

  async function refresh() {
    router.refresh();
  }

  async function onConvert(id: string, kind: "task" | "idea" | "note") {
    setBusy(true);
    const result = await convertCapture({ id, kind });
    if (result.ok) {
      setSelectedRaw((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      await refresh();
    } else {
      flash(result.error ?? "Could not convert.");
    }
    setBusy(false);
  }

  async function onArchive(id: string) {
    setBusy(true);
    const result = await archiveCapture(id);
    if (result.ok) await refresh();
    else flash(result.error ?? "Could not archive.");
    setBusy(false);
  }

  async function onDelete(id: string) {
    setBusy(true);
    const result = await deleteCapture(id);
    if (result.ok) await refresh();
    else flash(result.error ?? "Could not delete.");
    setBusy(false);
  }

  async function onBulk(
    action: "archive" | "delete" | "convert-task" | "convert-idea" | "convert-note",
  ) {
    if (selected.size === 0 || busy) return;
    setBusy(true);
    const result = await bulkProcess([...selected], action);
    if (result.ok) {
      setSelectedRaw(new Set());
      flash(
        result.failed > 0
          ? `${result.succeeded} processed, ${result.failed} failed.`
          : `${result.succeeded} processed.`,
      );
      await refresh();
    } else {
      flash(result.error ?? "Could not process.");
    }
    setBusy(false);
  }

  function toggleSelect(id: string) {
    setSelectedRaw((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const allVisibleSelected =
    visible.length > 0 && visible.every((c) => selected.has(c.id));

  if (captures.length === 0) {
    return (
      <EmptyState
        icon={InboxIcon}
        title="Your head is clear"
        description="New thoughts can go here whenever they appear. Press Cmd+K or Ctrl+K to capture one."
      />
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-text-secondary">
          <Switch
            checked={showProcessed}
            onCheckedChange={setShowProcessed}
            label="Show processed captures"
          />
          Processed
        </label>
        {visible.length > 0 && !showProcessed && (
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-text-secondary">
            <Checkbox
              checked={allVisibleSelected}
              onChange={() => {
                if (allVisibleSelected) setSelectedRaw(new Set());
                else setSelectedRaw(new Set(visible.map((c) => c.id)));
              }}
              aria-label="Select all captures"
            />
            Select all
          </label>
        )}
      </div>

      {selected.size > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18 }}
          className="sticky top-0 z-10 mt-3 flex flex-wrap items-center gap-1.5 index-card px-3 py-2 shadow-sm"
          role="toolbar"
          aria-label="Bulk actions"
        >
          <span className="mr-1 text-sm font-medium text-text">
            {selected.size} selected
          </span>
          <span className="mr-1 text-xs text-text-secondary">Convert to</span>
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => void onBulk("convert-task")}>
            <Zap className="size-4" aria-hidden="true" /> Task
          </Button>
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => void onBulk("convert-idea")}>
            <Lightbulb className="size-4" aria-hidden="true" /> Idea
          </Button>
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => void onBulk("convert-note")}>
            <StickyNote className="size-4" aria-hidden="true" /> Note
          </Button>
          <span className="mx-1 h-4 w-px bg-border" aria-hidden="true" />
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => void onBulk("archive")}>
            <Archive className="size-4" aria-hidden="true" /> Archive
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={() => void onBulk("delete")}
            className="text-red-600 hover:text-red-700 dark:text-red-400"
          >
            <Trash2 className="size-4" aria-hidden="true" /> Delete
          </Button>
          <button
            type="button"
            onClick={() => setSelectedRaw(new Set())}
            className="ml-auto text-xs text-text-secondary hover:text-text"
          >
            Clear
          </button>
        </motion.div>
      )}

      <p className="mt-2 h-4 text-xs text-text-secondary" aria-live="polite">
        {notice ?? ""}
      </p>

      <ul className="index-card mt-1 px-4 py-2" aria-label="Captures">
        {visible.map((capture) => {
          const meta = TYPE_META[capture.type];
          const TypeIcon = meta.icon;
          return (
            <motion.li
              key={capture.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.18 }}
              className={cn(
                "flex items-start gap-3 log-row px-3.5 py-3",
                capture.processed && "opacity-60",
              )}
            >
              {!showProcessed && (
                <Checkbox
                  checked={selected.has(capture.id)}
                  onChange={() => toggleSelect(capture.id)}
                  aria-label={`Select capture "${capture.content.slice(0, 40)}"`}
                  className="mt-1"
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm text-text">{capture.content}</p>
                <div className="mt-1.5 flex items-center gap-2">
                  <Badge variant="secondary" className="inline-flex items-center gap-1">
                    <TypeIcon className="size-3" aria-hidden="true" />
                    {meta.label}
                  </Badge>
                  <span className="text-xs text-text-secondary">
                    {relativeTime(capture.createdAt)}
                  </span>
                </div>
              </div>
              {!showProcessed && (
                <div className="flex shrink-0 items-center gap-0.5" role="group" aria-label="Capture actions">
                  <ConvertButton
                    kind="task"
                    label="Convert to task"
                    onConvert={(kind) => void onConvert(capture.id, kind)}
                  />
                  <ConvertButton
                    kind="idea"
                    label="Convert to idea"
                    onConvert={(kind) => void onConvert(capture.id, kind)}
                  />
                  <ConvertButton
                    kind="note"
                    label="Convert to note"
                    onConvert={(kind) => void onConvert(capture.id, kind)}
                  />
                  <Tooltip content="Archive">
                    <button
                      type="button"
                      aria-label="Archive capture"
                      onClick={() => void onArchive(capture.id)}
                      className="rounded-md p-1.5 text-text-secondary transition-colors duration-150 hover:bg-accent-soft hover:text-text"
                    >
                      <Archive className="size-4" aria-hidden="true" />
                    </button>
                  </Tooltip>
                  <Tooltip content="Delete">
                    <button
                      type="button"
                      aria-label="Delete capture"
                      onClick={() => void onDelete(capture.id)}
                      className="rounded-md p-1.5 text-text-secondary transition-colors duration-150 hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400"
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </button>
                  </Tooltip>
                </div>
              )}
            </motion.li>
          );
        })}
      </ul>

      {visible.length === 0 && (
        <p className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-text-secondary">
          {showProcessed
            ? "Nothing processed yet."
            : "Inbox zero. Nicely done."}
        </p>
      )}
    </div>
  );
}
