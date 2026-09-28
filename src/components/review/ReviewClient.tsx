"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import {
  CheckCircle2,
  ArrowRight,
  X,
  Brain,
  Sunrise,
  CircleDashed,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  movePlanTaskToDate,
  brainDump,
  updateDailyPlan,
} from "@/actions/planner";
import { letGoTask } from "@/actions/tasks";

interface IncompleteItem {
  taskId: string;
  title: string;
  plannedMinutes: number | null;
}

interface ReviewClientProps {
  dateLabel: string;
  doneToday: { id: string; title: string }[];
  initialIncomplete: IncompleteItem[];
  todayKey: string;
  tomorrowKey: string;
  tomorrowFocus: string | null;
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      aria-label={title}
      className="space-y-3"
    >
      <h2 className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.12em] text-text-secondary">
        <Icon className="size-4" aria-hidden="true" />
        {title}
      </h2>
      {children}
    </motion.section>
  );
}

/** Daily review: what happened, what didn't, what's on your mind, tomorrow. */
export function ReviewClient({
  dateLabel,
  doneToday,
  initialIncomplete,
  todayKey,
  tomorrowKey,
  tomorrowFocus,
}: ReviewClientProps) {
  const [incomplete, setIncomplete] = React.useState(initialIncomplete);
  const [lettingGo, setLettingGo] = React.useState<IncompleteItem | null>(null);
  const [dump, setDump] = React.useState("");
  const [dumpDone, setDumpDone] = React.useState(false);
  const [dumping, setDumping] = React.useState(false);
  const [focus, setFocus] = React.useState(tomorrowFocus ?? "");
  const [focusSaved, setFocusSaved] = React.useState(false);
  const [savingFocus, setSavingFocus] = React.useState(false);

  async function handleMoveToTomorrow(item: IncompleteItem) {
    setIncomplete((prev) => prev.filter((i) => i.taskId !== item.taskId));
    await movePlanTaskToDate(item.taskId, todayKey, tomorrowKey);
  }

  async function handleLetGo() {
    if (!lettingGo) return;
    const item = lettingGo;
    setLettingGo(null);
    setIncomplete((prev) => prev.filter((i) => i.taskId !== item.taskId));
    await letGoTask(item.taskId);
  }

  async function handleDump() {
    if (!dump.trim() || dumping) return;
    setDumping(true);
    const res = await brainDump({ content: dump });
    setDumping(false);
    if (res.ok) {
      setDump("");
      setDumpDone(true);
    }
  }

  async function handleSaveFocus() {
    const trimmed = focus.trim();
    if (savingFocus) return;
    setSavingFocus(true);
    const res = await updateDailyPlan({
      dayKey: tomorrowKey,
      mainFocus: trimmed || null,
    });
    setSavingFocus(false);
    if (res.ok) setFocusSaved(true);
  }

  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs font-medium uppercase tracking-[0.12em] text-text-secondary">
          Daily review
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl">
          How did today go?
        </h1>
        <p className="mt-1 text-sm text-text-secondary">{dateLabel}</p>
      </header>

      <Section icon={CheckCircle2} title="What did you get done">
        {doneToday.length === 0 ? (
          <p className="text-sm text-text-secondary">
            Nothing finished today. Some days are for tending, not finishing.
          </p>
        ) : (
          <Card>
            <CardContent className="space-y-1 p-3">
              {doneToday.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center gap-3 px-2 py-1.5"
                >
                  <CheckCircle2
                    className="size-4 shrink-0 text-accent"
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1 truncate text-sm">{t.title}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </Section>

      <Section icon={CircleDashed} title="What didn't happen">
        {incomplete.length === 0 ? (
          <p className="text-sm text-text-secondary">
            Everything on the plan found its place. Nice.
          </p>
        ) : (
          <ul className="space-y-2">
            <AnimatePresence initial={false}>
              {incomplete.map((item) => (
                <motion.li
                  key={item.taskId}
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, x: 24 }}
                  transition={{ duration: 0.18 }}
                  className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2.5"
                >
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {item.title}
                  </span>
                  {item.plannedMinutes != null && (
                    <span className="shrink-0 text-xs text-text-secondary">
                      {item.plannedMinutes}m
                    </span>
                  )}
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => void handleMoveToTomorrow(item)}
                  >
                    <ArrowRight className="size-3.5" aria-hidden="true" />
                    Move to tomorrow
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setLettingGo(item)}
                  >
                    <X className="size-3.5" aria-hidden="true" />
                    Let go
                  </Button>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </Section>

      <Section icon={Brain} title="Anything on your mind?">
        {dumpDone ? (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
            className="rounded-lg border border-border bg-surface px-4 py-5 text-center text-sm text-text-secondary"
          >
            You don&apos;t need to deal with all of this right now.
          </motion.p>
        ) : (
          <div className="space-y-3">
            <Textarea
              value={dump}
              onChange={(e) => setDump(e.target.value)}
              placeholder="Spill it all out — no structure needed…"
              aria-label="Brain dump — anything on your mind?"
              rows={4}
              maxLength={20_000}
            />
            <Button
              variant="secondary"
              onClick={() => void handleDump()}
              disabled={!dump.trim() || dumping}
            >
              {dumping ? "Saving…" : "Set it aside"}
            </Button>
          </div>
        )}
      </Section>

      <Section icon={Sunrise} title="Tomorrow">
        <Card>
          <CardContent className="space-y-3 p-5">
            <div className="space-y-2">
              <Label htmlFor="review-tomorrow-focus">
                What matters most tomorrow?
              </Label>
              <div className="flex gap-2">
                <Input
                  id="review-tomorrow-focus"
                  value={focus}
                  onChange={(e) => {
                    setFocus(e.target.value);
                    setFocusSaved(false);
                  }}
                  placeholder="Tomorrow's one thing…"
                  maxLength={500}
                />
                <Button
                  variant="secondary"
                  onClick={() => void handleSaveFocus()}
                  disabled={savingFocus}
                >
                  {savingFocus ? "Saving…" : focusSaved ? "Saved" : "Save"}
                </Button>
              </div>
            </div>
            <Link
              href="/plan"
              className="inline-flex items-center gap-1.5 text-sm text-accent hover:underline"
            >
              Plan tomorrow in detail
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
          </CardContent>
        </Card>
      </Section>

      <Dialog
        open={lettingGo !== null}
        onOpenChange={(open) => {
          if (!open) setLettingGo(null);
        }}
        label="Let go of this task"
      >
        <DialogTitle>Let this one go?</DialogTitle>
        <DialogDescription>
          Are you sure you no longer need{" "}
          <span className="font-medium text-text">
            &ldquo;{lettingGo?.title}&rdquo;
          </span>
          ? It will be marked as cancelled — you can always bring it back
          later.
        </DialogDescription>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setLettingGo(null)}>
            Keep
          </Button>
          <Button variant="destructive" onClick={() => void handleLetGo()}>
            Let go
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
