import { kolkataDateFromDayKey } from "@/lib/dates";

/** "2026-09" style month key. */
const MONTH_KEY = /^(\d{4})-(0[1-9]|1[0-2])$/;

export function isMonthKey(value: string): boolean {
  return MONTH_KEY.test(value);
}

/**
 * Half-open [start, end) range of a calendar month in Asia/Kolkata, as UTC
 * instants: start is midnight IST on the 1st, end is midnight IST on the 1st
 * of the following month. Returns null for a malformed key.
 */
export function monthRangeKolkata(
  monthKey: string,
): { start: Date; end: Date } | null {
  const match = MONTH_KEY.exec(monthKey);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  return {
    start: kolkataDateFromDayKey(`${monthKey}-01`),
    end: kolkataDateFromDayKey(
      `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`,
    ),
  };
}
