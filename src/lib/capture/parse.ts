import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { addDays } from "date-fns";
import type { CaptureType } from "@prisma/client";
import { KOLKATA_TZ } from "@/lib/dates";

/**
 * Deterministic quick-capture parser (no AI).
 *
 * Rules:
 * - Leading "idea:" / "idea -"        → IDEA
 * - Leading "note:" / "note -"        → NOTE
 * - Leading "remind me to" / "remember to" / "reminder:" → REMINDER
 * - Leading "task:" / "todo:" / "task -" / "todo -"      → TASK
 * - Anything else                     → UNKNOWN
 *
 * Date hints (case-insensitive, word-boundary matched):
 * - "today"     → scheduledDate = today
 * - "tomorrow"  → scheduledDate = today + 1
 * - "next week" → scheduledDate = today + 7
 * - "monday"…"sunday" (plus 3-letter abbreviations) → next occurrence
 *   of that weekday on or after today
 *
 * Matched type prefixes and date hints are stripped from the title.
 * Date placement: REMINDER hints land on `dueDate` (a reminder is a
 * deadline); everything else lands on `scheduledDate` (a day to work on it).
 */

export interface ParsedCapture {
  title: string;
  type: CaptureType;
  dueDate?: Date;
  scheduledDate?: Date;
  /** Human-friendly label for the parsed date, e.g. "Today", "Tomorrow", "Fri, 3 Oct". */
  dateLabel?: string;
}

interface DateHint {
  /** Offset in days from `now`, in the target timezone. */
  offset: number;
  /** Exact text matched, used to strip the hint from the title. */
  matched: string;
  /** Label shown to the user. */
  label: string;
}

const WEEKDAYS: Array<{ names: string[]; jsDay: number }> = [
  { names: ["sunday", "sun"], jsDay: 0 },
  { names: ["monday", "mon"], jsDay: 1 },
  { names: ["tuesday", "tues", "tue"], jsDay: 2 },
  { names: ["wednesday", "wed"], jsDay: 3 },
  { names: ["thursday", "thurs", "thur", "thu"], jsDay: 4 },
  { names: ["friday", "fri"], jsDay: 5 },
  { names: ["saturday", "sat"], jsDay: 6 },
];

/** ISO day-of-week in the target timezone (1 = Monday … 7 = Sunday). */
function isoDayOfWeek(date: Date, timeZone: string): number {
  return Number(formatInTimeZone(date, timeZone, "i"));
}

/** Midnight (start of day) for a yyyy-MM-dd day key, in the target timezone. */
function midnightForDayKey(dayKey: string, timeZone: string): Date {
  return fromZonedTime(`${dayKey}T00:00:00`, timeZone);
}

function findDateHint(
  text: string,
  now: Date,
  timeZone: string,
): DateHint | null {
  const todayKey = formatInTimeZone(now, timeZone, "yyyy-MM-dd");
  const todayMidnight = midnightForDayKey(todayKey, timeZone);

  const relMatch = /\b(today|tomorrow|next\s+week)\b/i.exec(text);
  if (relMatch) {
    const word = relMatch[1]!.toLowerCase().replace(/\s+/, " ");
    const offset =
      word === "today" ? 0 : word === "tomorrow" ? 1 : 7;
    const label =
      offset === 0
        ? "Today"
        : offset === 1
          ? "Tomorrow"
          : formatInTimeZone(
              addDays(todayMidnight, offset),
              timeZone,
              "EEE, d MMM",
            );
    return { offset, matched: relMatch[0], label };
  }

  const alternation = WEEKDAYS.flatMap((w) =>
    w.names.slice().sort((a, b) => b.length - a.length),
  ).join("|");
  const weekdayRegex = new RegExp(`\\b(${alternation})\\b`, "i");
  const weekdayMatch = weekdayRegex.exec(text);
  if (weekdayMatch) {
    const word = weekdayMatch[1]!.toLowerCase();
    const target = WEEKDAYS.find((w) => w.names.includes(word))!;
    // JS day (0 = Sunday … 6 = Saturday) derived from the ISO day.
    const currentJsDay = isoDayOfWeek(now, timeZone) % 7;
    const offset = (target.jsDay - currentJsDay + 7) % 7;
    const label =
      offset === 0
        ? "Today"
        : offset === 1
          ? "Tomorrow"
          : formatInTimeZone(
              addDays(todayMidnight, offset),
              timeZone,
              "EEE, d MMM",
            );
    return { offset, matched: weekdayMatch[0], label };
  }

  return null;
}

/**
 * Parse raw capture text into a title, capture type and optional date hints.
 *
 * @param text     Raw text from the capture input.
 * @param now      Reference instant ("today" anchors here). Defaults to now.
 * @param timeZone IANA timezone for day boundaries. Defaults to Asia/Kolkata.
 */
export function parseCapture(
  text: string,
  now: Date = new Date(),
  timeZone: string = KOLKATA_TZ,
): ParsedCapture {
  const raw = text.trim();
  if (!raw) return { title: "", type: "UNKNOWN" };

  let working = raw;
  let type: CaptureType = "UNKNOWN";

  const prefixRules: Array<{ regex: RegExp; type: CaptureType }> = [
    { regex: /^(remind\s+me\s+to|remember\s+to)\s+/i, type: "REMINDER" },
    { regex: /^reminder\s*[:\-–—]\s*/i, type: "REMINDER" },
    { regex: /^idea\s*[:\-–—]\s*/i, type: "IDEA" },
    { regex: /^note\s*[:\-–—]\s*/i, type: "NOTE" },
    { regex: /^(task|todo)\s*[:\-–—]\s*/i, type: "TASK" },
  ];

  for (const rule of prefixRules) {
    if (rule.regex.test(working)) {
      type = rule.type;
      working = working.replace(rule.regex, "");
      break;
    }
  }

  let scheduledDate: Date | undefined;
  let dueDate: Date | undefined;
  let dateLabel: string | undefined;

  const hint = findDateHint(working, now, timeZone);
  if (hint) {
    const todayKey = formatInTimeZone(now, timeZone, "yyyy-MM-dd");
    const date = midnightForDayKey(todayKey, timeZone);
    const target = addDays(date, hint.offset);
    if (type === "REMINDER") {
      dueDate = target;
    } else {
      scheduledDate = target;
    }
    dateLabel = hint.label;
    // Strip every occurrence of the matched hint words from the title.
    const escaped = hint.matched.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    working = working
      .replace(new RegExp(`\\b${escaped}\\b`, "gi"), " ")
      .replace(/\s{2,}/g, " ")
      .trim();
  }

  working = working.trim();
  let title = working.length > 0 ? working : raw;
  // Light cleanup: drop a stray trailing punctuation or a preposition left
  // dangling after a date hint was stripped ("water the plants on friday").
  title = title
    .replace(/\s+(on|by|for|in|at|before|until)\s*$/i, "")
    .replace(/[,\-–—:;]\s*$/, "")
    .trim();
  // Capitalize the first letter for a tidy list appearance.
  if (title.length > 0) {
    title = title.charAt(0).toUpperCase() + title.slice(1);
  }

  return { title, type, dueDate, scheduledDate, dateLabel };
}
