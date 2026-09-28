"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Zap, Lightbulb, StickyNote, BellRing, Check, Inbox } from "lucide-react";
import { captureQuickSmart } from "@/actions/capture";
import { captureSmartSchema } from "@/lib/validation";
import { parseCapture } from "@/lib/capture/parse";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const TYPE_HINTS = [
  { value: "TASK", label: "Task", icon: Zap },
  { value: "IDEA", label: "Idea", icon: Lightbulb },
  { value: "NOTE", label: "Note", icon: StickyNote },
  { value: "REMINDER", label: "Reminder", icon: BellRing },
] as const;

const TYPE_META: Record<string, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  TASK: { label: "Task", icon: Zap },
  IDEA: { label: "Idea", icon: Lightbulb },
  NOTE: { label: "Note", icon: StickyNote },
  REMINDER: { label: "Reminder", icon: BellRing },
  UNKNOWN: { label: "Capture", icon: Inbox },
};

type CaptureTypeValue = (typeof TYPE_HINTS)[number]["value"] | "UNKNOWN";

interface QuickCaptureModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Global quick-capture modal (Cmd/Ctrl+K). Textarea with autofocus,
 * type-hint chips, Enter to submit (Shift+Enter for newline), Esc to close.
 * Saves via the `captureQuick` server action.
 */
export function QuickCaptureModal({ open, onOpenChange }: QuickCaptureModalProps) {
  const [content, setContent] = React.useState("");
  const [type, setType] = React.useState<CaptureTypeValue>("UNKNOWN");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);

  const reset = React.useCallback(() => {
    setContent("");
    setType("UNKNOWN");
    setError(null);
    setSaved(false);
    setSaving(false);
  }, []);

  const close = React.useCallback(() => {
    onOpenChange(false);
    window.setTimeout(reset, 250);
  }, [onOpenChange, reset]);

  // Deterministic parse of the draft: detected type + date hint, shown as a
  // subtle confirmation line. A manually chosen chip always wins.
  const detected = React.useMemo(() => parseCapture(content), [content]);
  const effectiveType = type !== "UNKNOWN" ? type : detected.type;
  const showDetectedLine =
    content.trim().length > 0 &&
    (effectiveType !== "UNKNOWN" || detected.dateLabel != null);
  const DetectedIcon = TYPE_META[effectiveType]?.icon ?? Inbox;

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, close]);

  async function submit() {
    const parsed = captureSmartSchema.safeParse({
      content,
      type: type === "UNKNOWN" ? undefined : type,
    });
    if (!parsed.success) {
      setError("Write something first.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      // captureQuickSmart re-runs the parser server-side; the manual chip
      // (when set) overrides the detected type.
      const result = await captureQuickSmart({
        content: parsed.data.content,
        type: parsed.data.type,
      });
      if (result.ok) {
        setSaved(true);
        window.setTimeout(close, 450);
      } else {
        setError(result.error ?? "Could not save. Try again.");
      }
    } catch {
      setError("Could not save. Try again.");
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[18vh]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      role="presentation"
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-black/40"
        onClick={close}
      />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="Quick capture"
        className="relative w-full max-w-xl rounded-xl border border-border bg-surface p-4 shadow-xl"
        initial={{ opacity: 0, scale: 0.98, y: -8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98, y: -8 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
      >
        <label htmlFor="quick-capture-input" className="sr-only">
          What&apos;s on your mind?
        </label>
        <Textarea
          id="quick-capture-input"
          data-autofocus
          autoFocus
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void submit();
            }
          }}
          placeholder="What's on your mind?"
          rows={3}
          className="resize-none border-0 bg-transparent px-1 text-base shadow-none"
          disabled={saving}
        />

        <div className="mt-2 flex flex-wrap items-center gap-1.5" role="group" aria-label="Capture type">
          {TYPE_HINTS.map((hint) => {
            const Icon = hint.icon;
            const active = type === hint.value;
            return (
              <button
                key={hint.value}
                type="button"
                aria-pressed={active}
                onClick={() => setType(active ? "UNKNOWN" : hint.value)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors duration-150",
                  active
                    ? "border-accent bg-accent-soft text-accent"
                    : "border-border text-text-secondary hover:text-text",
                )}
              >
                <Icon className="size-3.5" />
                {hint.label}
              </button>
            );
          })}
        </div>

        {showDetectedLine && (
          <p
            className="mt-2 inline-flex items-center gap-1.5 text-xs text-text-secondary"
            aria-live="polite"
          >
            <DetectedIcon className="size-3.5" aria-hidden="true" />
            <span>
              {TYPE_META[effectiveType]?.label ?? "Capture"}
              {detected.dateLabel ? ` · ${detected.dateLabel}` : ""}
            </span>
          </p>
        )}

        <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
          <div className="text-xs text-text-secondary" aria-live="polite">
            {error ? (
              <span className="text-red-500">{error}</span>
            ) : saved ? (
              <span className="inline-flex items-center gap-1 text-accent">
                <Check className="size-3.5" /> Captured
              </span>
            ) : (
              <span>
                <Badge variant="outline" className="mr-1 font-mono">Enter</Badge>
                to save
                <Badge variant="outline" className="ml-2 mr-1 font-mono">Esc</Badge>
                to close
              </span>
            )}
          </div>
          <Button size="sm" onClick={() => void submit()} disabled={saving}>
            {saving ? "Saving…" : "Capture"}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}
