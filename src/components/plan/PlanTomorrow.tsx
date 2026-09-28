"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Sparkles,
  X,
  Check,
  Plus,
  Save,
  Sunrise,
  Sun,
  Sunset,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { suggestPlan, PLAN_SLOTS, type PlanSlot } from "@/lib/planner/engine";
import { kolkataDateFromDayKey, dayKeyKolkata } from "@/lib/dates";
import { setPlanTasks, updateDailyPlan } from "@/actions/planner";

export interface CandidateTask {
  id: string;
  title: string;
  estimatedMinutes: number | null;
  priority: "LOW" | "MEDIUM" | "HIGH";
  dueDate: Date | null;
}

export interface ExistingPlanItem {
  taskId: string;
  title: string;
  plannedMinutes: number;
}

interface PlanTomorrowProps {
  dayKey: string;
  dateLabel: string;
  initialFocus: string | null;
  initialEnergy: string | null;
  initialItems: ExistingPlanItem[];
  candidates: CandidateTask[];
}

type EnergyChoice = "low" | "normal" | "high";

interface ProposalItem {
  taskId: string;
  title: string;
  plannedMinutes: number;
  slot: PlanSlot;
}

const SLOT_ICONS: Record<PlanSlot, typeof Sunrise> = {
  morning: Sunrise,
  afternoon: Sun,
  evening: Sunset,
};

function parseTime(value: string): number | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function formatMinutes(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function thirdsSlot(index: number, total: number): PlanSlot {
  if (total <= 0) return "morning";
  const morningEnd = Math.ceil(total / 3);
  const afternoonEnd = Math.ceil((2 * total) / 3);
  if (index < morningEnd) return "morning";
  if (index < afternoonEnd) return "afternoon";
  return "evening";
}

const ENERGY_OPTIONS: { value: EnergyChoice; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
];

/**
 * Plan-tomorrow workflow: focus, available time, energy, candidates, then
 * the deterministic engine proposes a schedule the user can fully override.
 */
export function PlanTomorrow({
  dayKey,
  dateLabel,
  initialFocus,
  initialEnergy,
  initialItems,
  candidates,
}: PlanTomorrowProps) {
  const [focus, setFocus] = React.useState(initialFocus ?? "");
  const [energy, setEnergy] = React.useState<EnergyChoice>(
    initialEnergy === "low" || initialEnergy === "high" ? initialEnergy : "normal",
  );
  const [startTime, setStartTime] = React.useState("09:00");
  const [endTime, setEndTime] = React.useState("23:00");
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [proposal, setProposal] = React.useState<ProposalItem[] | null>(
    initialItems.length > 0
      ? initialItems.map((item, index) => ({
          taskId: item.taskId,
          title: item.title,
          plannedMinutes: item.plannedMinutes,
          slot: thirdsSlot(index, initialItems.length),
        }))
      : null,
  );
  const [didNotFit, setDidNotFit] = React.useState<string[]>([]);
  const [showCandidates, setShowCandidates] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);

  const startMins = parseTime(startTime);
  const endMins = parseTime(endTime);
  const timeValid =
    startMins !== null && endMins !== null && endMins > startMins;
  const availableMinutes = timeValid ? endMins - startMins : 0;

  const candidateById = React.useMemo(
    () => new Map(candidates.map((c) => [c.id, c])),
    [candidates],
  );

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function runSuggestion() {
    const tasks = [...selected]
      .map((id) => candidateById.get(id))
      .filter((c): c is CandidateTask => c !== undefined)
      .map((c) => ({
        id: c.id,
        title: c.title,
        estimatedMinutes: c.estimatedMinutes,
        priority: c.priority,
        dueDate: c.dueDate,
      }));
    const result = suggestPlan({
      availableMinutes,
      tasks,
      energyLevel: energy === "normal" ? "medium" : energy,
      referenceDate: kolkataDateFromDayKey(dayKey),
    });
    const byId = new Map(tasks.map((t) => [t.id, t]));
    setProposal(
      result.scheduled.map((s) => ({
        taskId: s.taskId,
        title: byId.get(s.taskId)?.title ?? "Untitled",
        plannedMinutes: s.plannedMinutes,
        slot: s.slot,
      })),
    );
    setDidNotFit(result.unscheduled);
    setSaved(false);
  }

  function removeFromProposal(taskId: string) {
    setProposal((prev) => (prev ? prev.filter((p) => p.taskId !== taskId) : prev));
    setSaved(false);
  }

  function addBack(taskId: string) {
    const c = candidateById.get(taskId);
    if (!c) return;
    setProposal((prev) => [
      ...(prev ?? []),
      {
        taskId: c.id,
        title: c.title,
        plannedMinutes: c.estimatedMinutes ?? 30,
        slot: "evening" as PlanSlot,
      },
    ]);
    setDidNotFit((prev) => prev.filter((id) => id !== taskId));
    setSaved(false);
  }

  function updateMinutes(taskId: string, minutes: number) {
    if (!Number.isFinite(minutes) || minutes < 1) return;
    setProposal((prev) =>
      prev
        ? prev.map((p) =>
            p.taskId === taskId
              ? { ...p, plannedMinutes: Math.min(480, Math.round(minutes)) }
              : p,
          )
        : prev,
    );
    setSaved(false);
  }

  async function savePlan() {
    if (!proposal || saving) return;
    setSaving(true);
    const focusRes = await updateDailyPlan({
      dayKey,
      mainFocus: focus.trim() || null,
      energyLevel: energy,
    });
    const tasksRes = await setPlanTasks(
      dayKey,
      proposal.map((p) => ({ taskId: p.taskId, plannedMinutes: p.plannedMinutes })),
    );
    setSaving(false);
    if (focusRes.ok && tasksRes.ok) setSaved(true);
  }

  const scheduledMinutes = (proposal ?? []).reduce(
    (sum, p) => sum + p.plannedMinutes,
    0,
  );

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-medium uppercase tracking-[0.12em] text-text-secondary">
          Plan tomorrow
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl">
          {dateLabel}
        </h1>
      </header>

      <Card>
        <CardContent className="space-y-5 p-5 md:p-6">
          <div className="space-y-2">
            <Label htmlFor="plan-focus">What matters most?</Label>
            <Input
              id="plan-focus"
              value={focus}
              onChange={(e) => {
                setFocus(e.target.value);
                setSaved(false);
              }}
              placeholder="Tomorrow's one thing…"
              maxLength={500}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="plan-start">Day starts</Label>
              <Input
                id="plan-start"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="plan-end">Day ends</Label>
              <Input
                id="plan-end"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>
          {!timeValid ? (
            <p className="text-sm text-text-secondary" role="alert">
              The end time needs to be after the start time.
            </p>
          ) : (
            <p className="text-sm text-text-secondary">
              {formatMinutes(availableMinutes)} available tomorrow.
            </p>
          )}

          <div className="space-y-2">
            <Label id="plan-energy-label">Energy</Label>
            <div
              role="group"
              aria-labelledby="plan-energy-label"
              className="grid grid-cols-3 gap-1 rounded-lg border border-border bg-bg p-1"
            >
              {ENERGY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  aria-pressed={energy === opt.value}
                  onClick={() => {
                    setEnergy(opt.value);
                    setSaved(false);
                  }}
                  className={cn(
                    "rounded-md px-3 py-2 text-sm transition-colors duration-150",
                    energy === opt.value
                      ? "bg-surface font-medium text-text shadow-sm"
                      : "text-text-secondary hover:text-text",
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <section aria-labelledby="candidates-heading" className="space-y-3">
        <button
          type="button"
          onClick={() => setShowCandidates((v) => !v)}
          aria-expanded={showCandidates}
          className="flex w-full items-center justify-between"
        >
          <h2
            id="candidates-heading"
            className="text-xs font-medium uppercase tracking-[0.12em] text-text-secondary"
          >
            Candidates ({candidates.length})
          </h2>
          <ChevronDown
            className={cn(
              "size-4 text-text-secondary transition-transform duration-200",
              !showCandidates && "-rotate-90",
            )}
            aria-hidden="true"
          />
        </button>

        <AnimatePresence initial={false}>
          {showCandidates && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="overflow-hidden"
            >
              {candidates.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border bg-surface px-4 py-6 text-center text-sm text-text-secondary">
                  No open tasks to choose from. Everything is planned or done.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {candidates.map((c) => (
                    <li key={c.id}>
                      <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2.5 transition-colors duration-150 hover:border-accent/50 has-checked:border-accent">
                        <Checkbox
                          checked={selected.has(c.id)}
                          onChange={() => toggleSelected(c.id)}
                          aria-label={`Select "${c.title}"`}
                        />
                        <span className="min-w-0 flex-1 truncate text-sm">
                          {c.title}
                        </span>
                        {c.dueDate && (
                          <span className="shrink-0 text-xs text-text-secondary">
                            due {dayKeyKolkata(c.dueDate)}
                          </span>
                        )}
                        {c.estimatedMinutes != null && (
                          <span className="shrink-0 rounded-full bg-accent-soft px-2 py-0.5 text-xs text-accent">
                            {c.estimatedMinutes}m
                          </span>
                        )}
                      </label>
                    </li>
                  ))}
                </ul>
              )}
              <Button
                className="mt-4"
                onClick={runSuggestion}
                disabled={!timeValid || selected.size === 0}
              >
                <Sparkles className="size-4" aria-hidden="true" />
                Suggest a plan
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      <AnimatePresence>
        {proposal && (
          <motion.section
            aria-labelledby="proposal-heading"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="space-y-4"
          >
            <div className="flex items-baseline justify-between">
              <h2
                id="proposal-heading"
                className="text-xs font-medium uppercase tracking-[0.12em] text-text-secondary"
              >
                Proposed schedule
              </h2>
              <p className="text-xs text-text-secondary">
                {formatMinutes(scheduledMinutes)} of{" "}
                {formatMinutes(availableMinutes)} planned
              </p>
            </div>

            {proposal.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border bg-surface px-4 py-6 text-center text-sm text-text-secondary">
                Nothing fit the day. Try a longer day or fewer tasks.
              </p>
            ) : (
              PLAN_SLOTS.map(({ value, label }) => {
                const slotItems = proposal.filter((p) => p.slot === value);
                if (slotItems.length === 0) return null;
                const Icon = SLOT_ICONS[value];
                return (
                  <div key={value} className="space-y-2">
                    <h3 className="flex items-center gap-2 text-sm font-medium text-text-secondary">
                      <Icon className="size-4" aria-hidden="true" />
                      {label}
                    </h3>
                    <ul className="space-y-1.5">
                      {slotItems.map((item) => (
                        <motion.li
                          key={item.taskId}
                          layout
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.18 }}
                          className="flex items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2"
                        >
                          <span className="min-w-0 flex-1 truncate text-sm">
                            {item.title}
                          </span>
                          <label className="flex shrink-0 items-center gap-1.5 text-xs text-text-secondary">
                            <input
                              type="number"
                              min={1}
                              max={480}
                              value={item.plannedMinutes}
                              onChange={(e) =>
                                updateMinutes(item.taskId, Number(e.target.value))
                              }
                              aria-label={`Planned minutes for "${item.title}"`}
                              className="w-16 rounded-md border border-border bg-surface px-2 py-1 text-right text-sm text-text"
                            />
                            min
                          </label>
                          <button
                            type="button"
                            onClick={() => removeFromProposal(item.taskId)}
                            aria-label={`Remove "${item.title}" from the plan`}
                            className="rounded-md p-1 text-text-secondary hover:text-text"
                          >
                            <X className="size-4" aria-hidden="true" />
                          </button>
                        </motion.li>
                      ))}
                    </ul>
                  </div>
                );
              })
            )}

            {didNotFit.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-text-secondary">
                  Didn&apos;t fit ({didNotFit.length})
                </h3>
                <ul className="space-y-1.5">
                  {didNotFit.map((id) => {
                    const c = candidateById.get(id);
                    if (!c) return null;
                    return (
                      <li
                        key={id}
                        className="flex items-center gap-3 rounded-lg border border-dashed border-border bg-surface px-3 py-2"
                      >
                        <span className="min-w-0 flex-1 truncate text-sm text-text-secondary">
                          {c.title}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => addBack(id)}
                        >
                          <Plus className="size-3.5" aria-hidden="true" />
                          Add anyway
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            <div className="flex items-center gap-3 pt-1">
              <Button onClick={() => void savePlan()} disabled={saving || proposal.length === 0}>
                <Save className="size-4" aria-hidden="true" />
                {saving ? "Saving…" : "Save tomorrow's plan"}
              </Button>
              <AnimatePresence>
                {saved && (
                  <motion.p
                    role="status"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.18 }}
                    className="flex items-center gap-1.5 text-sm text-text-secondary"
                  >
                    <Check className="size-4 text-accent" aria-hidden="true" />
                    Saved.
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
            <p className="text-xs text-text-secondary">
              You can always change everything — this is a starting point, not
              a contract.
            </p>
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}
