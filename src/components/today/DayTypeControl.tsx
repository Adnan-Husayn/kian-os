"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { startDay } from "@/actions/routines";
import { Button } from "@/components/ui/button";
import { DAY_TYPES, formatMinutes, type DayType } from "@/lib/routines";

export interface DayTypeSummary {
  count: number;
  minutes: number;
}

interface DayTypeControlProps {
  dayKey: string;
  /** Chosen kind of day, or null when the day has not been started. */
  dayType: DayType | null;
  /** What each kind of day would put on the plan. */
  summaries: Record<DayType, DayTypeSummary>;
  hasRoutines: boolean;
}

function summaryLabel({ count, minutes }: DayTypeSummary): string {
  if (count === 0) return "no routines";
  return `${count} routine${count === 1 ? "" : "s"} · ${formatMinutes(minutes)}`;
}

/**
 * Asks "college day or free day?" once per day and adds that day's routines
 * to the plan; afterwards it shrinks to a line with a switch.
 */
export function DayTypeControl({
  dayKey,
  dayType,
  summaries,
  hasRoutines,
}: DayTypeControlProps) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  function choose(type: DayType) {
    setError(null);
    startTransition(async () => {
      const result = await startDay(dayKey, type);
      if (!result.ok) {
        setError(result.error ?? "Could not start the day. Try again.");
        return;
      }
      router.refresh();
    });
  }

  if (!hasRoutines) {
    return (
      <p className="text-sm text-text-secondary">
        No routines yet.{" "}
        <Link href="/routines" className="text-accent underline underline-offset-4">
          Set up the things you do every day
        </Link>
        .
      </p>
    );
  }

  if (dayType === null) {
    return (
      <section aria-labelledby="day-type-heading" className="index-card">
        <h2
          id="day-type-heading"
          className="index-card-head journal-label px-5 pb-2 pt-4"
        >
          Start the day
        </h2>
        <div className="space-y-3 px-5 pb-5 pt-4">
          <p className="text-xl italic leading-snug">What kind of day is it?</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {DAY_TYPES.map(({ value, label }) => (
              <Button
                key={value}
                variant="outline"
                disabled={pending}
                onClick={() => choose(value)}
                className="h-auto flex-col items-start gap-0.5 px-4 py-3 text-left"
              >
                <span className="text-base">{label}</span>
                <span className="font-mono text-xs font-normal text-text-secondary">
                  {summaryLabel(summaries[value])}
                </span>
              </Button>
            ))}
          </div>
          {error && (
            <p role="alert" className="text-sm text-mark">
              {error}
            </p>
          )}
        </div>
      </section>
    );
  }

  const other = DAY_TYPES.find((d) => d.value !== dayType)!;
  const current = DAY_TYPES.find((d) => d.value === dayType)!;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <p className="journal-label">
        {current.label} · {summaryLabel(summaries[dayType])}
      </p>
      <Button
        variant="ghost"
        size="sm"
        disabled={pending}
        onClick={() => choose(other.value)}
        className="h-7 px-2"
      >
        {pending ? "Switching…" : `Switch to ${other.label.toLowerCase()}`}
      </Button>
      {error && (
        <p role="alert" className="w-full text-sm text-mark">
          {error}
        </p>
      )}
    </div>
  );
}
