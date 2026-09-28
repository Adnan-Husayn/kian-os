import Link from "next/link";
import { BookOpen } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getJournalEntry, listJournalEntries } from "@/actions/planner";
import {
  dayKeyKolkata,
  kolkataDateFromDayKey,
  formatKolkata,
} from "@/lib/dates";
import { JournalNav } from "@/components/journal/JournalNav";
import { JournalEditor } from "@/components/journal/JournalEditor";

export const dynamic = "force-dynamic";

interface JournalPageProps {
  searchParams: Promise<{ date?: string | string[] }>;
}

function prevMonthKey(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  if (m === 1) return `${y - 1}-12`;
  return `${y}-${String(m - 1).padStart(2, "0")}`;
}

function capitalize(word: string | null): string {
  if (!word) return "";
  return word[0]!.toUpperCase() + word.slice(1);
}

export default async function JournalPage({ searchParams }: JournalPageProps) {
  await requireUser();
  const sp = await searchParams;
  const raw = Array.isArray(sp.date) ? sp.date[0] : sp.date;
  const dayKey =
    raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : dayKeyKolkata();
  const date = kolkataDateFromDayKey(dayKey);

  // Recent entries: last 7 across month boundaries, excluding the open day.
  // All three reads run in parallel (each is a round trip to the database);
  // the previous month is fetched up front instead of only when needed.
  const monthKey = dayKey.slice(0, 7);
  const [entry, thisMonth, prevMonth] = await Promise.all([
    getJournalEntry(dayKey),
    listJournalEntries(monthKey),
    listJournalEntries(prevMonthKey(monthKey)),
  ]);
  const recent = [...thisMonth, ...prevMonth]
    .filter((e) => e.dayKey !== dayKey)
    .slice(0, 7);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
            {formatKolkata(date, "EEEE · MMMM d")}
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            A few honest lines. No tracking, no scores.
          </p>
        </div>
        <JournalNav dayKey={dayKey} />
      </header>

      <JournalEditor
        key={dayKey}
        dayKey={dayKey}
        initialContent={entry?.content ?? ""}
        initialMood={
          entry?.mood === "low" ||
          entry?.mood === "okay" ||
          entry?.mood === "good" ||
          entry?.mood === "great"
            ? entry.mood
            : null
        }
        initialEnergy={
          entry?.energy === "low" ||
          entry?.energy === "medium" ||
          entry?.energy === "high"
            ? entry.energy
            : null
        }
      />

      {recent.length > 0 && (
        <section aria-labelledby="recent-entries-heading" className="space-y-3">
          <h2
            id="recent-entries-heading"
            className="text-xs font-medium uppercase tracking-[0.12em] text-text-secondary"
          >
            Recent entries
          </h2>
          <ul className="space-y-1.5">
            {recent.map((e) => {
              const excerpt = (e.content ?? "").trim().split("\n")[0] ?? "";
              return (
                <li key={e.id}>
                  <Link
                    href={`/journal?date=${e.dayKey}`}
                    className="flex items-center gap-3 log-row px-3 py-2.5 transition-colors duration-150 hover:border-accent/50"
                  >
                    <BookOpen
                      className="size-4 shrink-0 text-text-secondary"
                      aria-hidden="true"
                    />
                    <span className="shrink-0 text-xs text-text-secondary">
                      {formatKolkata(
                        kolkataDateFromDayKey(e.dayKey),
                        "EEE, MMM d",
                      )}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm">
                      {excerpt || "No words yet."}
                    </span>
                    {e.mood && (
                      <span className="shrink-0 rounded-full bg-accent-soft px-2 py-0.5 text-xs text-accent">
                        {capitalize(e.mood)}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
