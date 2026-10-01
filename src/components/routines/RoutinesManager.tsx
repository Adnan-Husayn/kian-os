"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import {
  createRoutine,
  deleteRoutine,
  setRoutineActive,
  updateRoutine,
  type RoutineDTO,
  type RoutineInput,
} from "@/actions/routines";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { formatMinutes } from "@/lib/routines";
import { cn } from "@/lib/utils";

const WEEKDAYS = [
  { value: 1, short: "Mon" },
  { value: 2, short: "Tue" },
  { value: 3, short: "Wed" },
  { value: 4, short: "Thu" },
  { value: 5, short: "Fri" },
  { value: 6, short: "Sat" },
  { value: 7, short: "Sun" },
];

interface ProjectOption {
  id: string;
  name: string;
}

interface FormState {
  title: string;
  projectId: string;
  minutesCollege: string;
  minutesFree: string;
  startTime: string;
  weekdays: number[];
}

const EMPTY_FORM: FormState = {
  title: "",
  projectId: "",
  minutesCollege: "",
  minutesFree: "",
  startTime: "",
  weekdays: [],
};

function toForm(r: RoutineDTO): FormState {
  return {
    title: r.title,
    projectId: r.projectId ?? "",
    minutesCollege: r.minutesCollege?.toString() ?? "",
    minutesFree: r.minutesFree?.toString() ?? "",
    startTime: r.startTime ?? "",
    weekdays: r.weekdays,
  };
}

/** Blank → null (skip that kind of day); otherwise whole minutes. */
function parseMinutes(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? Math.round(n) : NaN;
}

function toInput(form: FormState): RoutineInput {
  return {
    title: form.title.trim(),
    projectId: form.projectId || null,
    minutesCollege: parseMinutes(form.minutesCollege),
    minutesFree: parseMinutes(form.minutesFree),
    startTime: form.startTime || null,
    weekdays: [...form.weekdays].sort((a, b) => a - b),
  };
}

function scheduleLabel(r: RoutineDTO): string {
  const days =
    r.weekdays.length === 0
      ? "Every day"
      : r.weekdays.map((d) => WEEKDAYS[d - 1]!.short).join(", ");
  return r.startTime ? `${days} · ${r.startTime}` : days;
}

function durationLabel(minutes: number | null): string {
  return minutes ? formatMinutes(minutes) : "skip";
}

function RoutineForm({
  initial,
  projects,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: FormState;
  projects: ProjectOption[];
  submitLabel: string;
  onSubmit: (input: RoutineInput) => Promise<string | null>;
  onCancel?: () => void;
}) {
  const [form, setForm] = React.useState(initial);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const id = React.useId();

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function toggleWeekday(day: number) {
    set(
      "weekdays",
      form.weekdays.includes(day)
        ? form.weekdays.filter((d) => d !== day)
        : [...form.weekdays, day],
    );
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const failure = await onSubmit(toInput(form));
      if (failure) setError(failure);
      else if (!onCancel) setForm(EMPTY_FORM);
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-title`}>Routine</Label>
          <Input
            id={`${id}-title`}
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="DSA practice"
            maxLength={200}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-project`}>Project (optional)</Label>
          <Select
            id={`${id}-project`}
            value={form.projectId}
            onChange={(e) => set("projectId", e.target.value)}
          >
            <option value="">No project</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-college`}>Minutes on a college day</Label>
          <Input
            id={`${id}-college`}
            type="number"
            inputMode="numeric"
            min={5}
            max={600}
            value={form.minutesCollege}
            onChange={(e) => set("minutesCollege", e.target.value)}
            placeholder="blank = skip"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-free`}>Minutes on a free day</Label>
          <Input
            id={`${id}-free`}
            type="number"
            inputMode="numeric"
            min={5}
            max={600}
            value={form.minutesFree}
            onChange={(e) => set("minutesFree", e.target.value)}
            placeholder="blank = skip"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-time`}>Start time (optional)</Label>
          <Input
            id={`${id}-time`}
            type="time"
            value={form.startTime}
            onChange={(e) => set("startTime", e.target.value)}
          />
        </div>
      </div>

      <fieldset className="space-y-1.5">
        <legend className="text-sm font-medium">
          Days{" "}
          <span className="font-normal text-text-secondary">
            (none selected = every day)
          </span>
        </legend>
        <div className="flex flex-wrap gap-1.5">
          {WEEKDAYS.map((day) => {
            const on = form.weekdays.includes(day.value);
            return (
              <button
                key={day.value}
                type="button"
                aria-pressed={on}
                onClick={() => toggleWeekday(day.value)}
                className={cn(
                  "h-8 cursor-pointer rounded-md border px-2.5 font-mono text-xs transition-colors duration-150",
                  on
                    ? "border-accent bg-accent-soft text-accent"
                    : "border-border text-text-secondary hover:text-text",
                )}
              >
                {day.short}
              </button>
            );
          })}
        </div>
      </fieldset>

      {error && (
        <p role="alert" className="text-sm text-mark">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {!onCancel && <Plus aria-hidden="true" />}
          {pending ? "Saving…" : submitLabel}
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            <X aria-hidden="true" />
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}

/** Routines page: the list of repeating commitments and a form to add one. */
export function RoutinesManager({
  routines,
  projects,
}: {
  routines: RoutineDTO[];
  projects: ProjectOption[];
}) {
  const router = useRouter();
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [confirmingId, setConfirmingId] = React.useState<string | null>(null);
  const [, startTransition] = React.useTransition();

  const active = routines.filter((r) => r.active);
  const collegeTotal = active.reduce((s, r) => s + (r.minutesCollege ?? 0), 0);
  const freeTotal = active.reduce((s, r) => s + (r.minutesFree ?? 0), 0);

  async function save(input: RoutineInput, id?: string): Promise<string | null> {
    const result = id ? await updateRoutine(id, input) : await createRoutine(input);
    if (!result.ok) return result.error ?? "Could not save the routine.";
    setEditingId(null);
    router.refresh();
    return null;
  }

  function toggleActive(r: RoutineDTO, next: boolean) {
    startTransition(async () => {
      await setRoutineActive(r.id, next);
      router.refresh();
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      await deleteRoutine(id);
      setConfirmingId(null);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl italic leading-tight md:text-3xl">Routines</h1>
        <p className="mt-1 text-sm text-text-secondary">
          The things you do most days. Each morning, Today asks whether it&apos;s
          a college day or a free day and adds these to the plan with the
          matching durations.
        </p>
        {active.length > 0 && (
          <p className="journal-label mt-2 normal-case tracking-normal">
            College day {formatMinutes(collegeTotal)} · Free day{" "}
            {formatMinutes(freeTotal)}
            {active.some((r) => r.weekdays.length > 0) && " (if every routine runs)"}
          </p>
        )}
      </header>

      <section aria-labelledby="routines-list-heading" className="index-card">
        <h2
          id="routines-list-heading"
          className="index-card-head journal-label px-5 pb-2 pt-4"
        >
          Your routines
        </h2>
        {routines.length === 0 ? (
          <p className="px-5 py-6 text-sm text-text-secondary">
            Nothing here yet. Add the first one below.
          </p>
        ) : (
          <ul className="px-4 pb-3">
            {routines.map((r) => (
              <li key={r.id} className="log-row px-1 py-3">
                {editingId === r.id ? (
                  <RoutineForm
                    initial={toForm(r)}
                    projects={projects}
                    submitLabel="Save changes"
                    onSubmit={(input) => save(input, r.id)}
                    onCancel={() => setEditingId(null)}
                  />
                ) : (
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <div className="min-w-0 flex-1 basis-56">
                      <p
                        className={cn(
                          "truncate text-base",
                          !r.active && "text-text-secondary line-through",
                        )}
                      >
                        {r.title}
                      </p>
                      <p className="mt-0.5 text-xs text-text-secondary">
                        {scheduleLabel(r)}
                        {r.projectName && ` · ${r.projectName}`}
                      </p>
                    </div>
                    <dl className="flex gap-4 font-mono text-xs tabular-nums text-text-secondary [&>div]:w-16 [&>div:last-child]:w-24">
                      <div>
                        <dt className="text-[10px] uppercase tracking-wider">College</dt>
                        <dd className="text-text">{durationLabel(r.minutesCollege)}</dd>
                      </div>
                      <div>
                        <dt className="text-[10px] uppercase tracking-wider">Free</dt>
                        <dd className="text-text">{durationLabel(r.minutesFree)}</dd>
                      </div>
                      <div>
                        <dt className="text-[10px] uppercase tracking-wider">Last 7 days</dt>
                        <dd className="text-text">{r.doneLast7} done</dd>
                      </div>
                    </dl>
                    <div className="flex items-center gap-1">
                      <Switch
                        checked={r.active}
                        onCheckedChange={(next) => toggleActive(r, next)}
                        label={r.active ? `Pause ${r.title}` : `Resume ${r.title}`}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setEditingId(r.id)}
                        aria-label={`Edit ${r.title}`}
                      >
                        <Pencil aria-hidden="true" />
                      </Button>
                      {confirmingId === r.id ? (
                        <>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => remove(r.id)}
                          >
                            Delete
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setConfirmingId(null)}
                          >
                            Keep
                          </Button>
                        </>
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setConfirmingId(r.id)}
                          aria-label={`Delete ${r.title}`}
                        >
                          <Trash2 aria-hidden="true" />
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="routines-add-heading" className="index-card">
        <h2
          id="routines-add-heading"
          className="index-card-head journal-label px-5 pb-2 pt-4"
        >
          Add a routine
        </h2>
        <div className="px-5 pb-5 pt-4">
          <RoutineForm
            initial={EMPTY_FORM}
            projects={projects}
            submitLabel="Add routine"
            onSubmit={(input) => save(input)}
          />
        </div>
      </section>
    </div>
  );
}
