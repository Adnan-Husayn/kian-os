"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  addDaysKolkata,
  dayKeyKolkata,
  kolkataDateFromDayKey,
  formatKolkata,
} from "@/lib/dates";

interface JournalNavProps {
  dayKey: string;
}

function shift(dayKey: string, days: number): string {
  return dayKeyKolkata(addDaysKolkata(kolkataDateFromDayKey(dayKey), days));
}

/** Prev / Today / Next buttons plus a native date picker. */
export function JournalNav({ dayKey }: JournalNavProps) {
  const router = useRouter();
  const todayKey = dayKeyKolkata();

  function go(key: string) {
    router.push(key === todayKey ? "/journal" : `/journal?date=${key}`);
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => go(shift(dayKey, -1))}
        aria-label="Previous day"
      >
        <ChevronLeft className="size-4" aria-hidden="true" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => go(todayKey)}
        disabled={dayKey === todayKey}
      >
        Today
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => go(shift(dayKey, 1))}
        aria-label="Next day"
      >
        <ChevronRight className="size-4" aria-hidden="true" />
      </Button>
      <input
        type="date"
        value={dayKey}
        max={todayKey}
        onChange={(e) => {
          if (e.target.value) go(e.target.value);
        }}
        aria-label="Jump to date"
        className="ml-1 h-9 rounded-md border border-border bg-surface px-2 text-sm text-text"
      />
      <span className="sr-only">
        Currently viewing {formatKolkata(kolkataDateFromDayKey(dayKey), "EEEE, MMMM d")}
      </span>
    </div>
  );
}
