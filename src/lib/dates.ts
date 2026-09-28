import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { addDays, subDays } from "date-fns";

/** The user's timezone. All date-only semantics (daily plans, journal dates,
 * scheduled dates) are anchored to midnight in this zone. */
export const KOLKATA_TZ = "Asia/Kolkata";

const DAY_KEY_FORMAT = "yyyy-MM-dd";

/**
 * Midnight (start of day) in Asia/Kolkata for the given instant, returned as a
 * UTC Date. This is the canonical value to store for `scheduledDate`,
 * DailyPlan.date and JournalEntry.date (date-only semantics).
 */
export function startOfDayKolkata(date: Date = new Date()): Date {
  const dayKey = formatInTimeZone(date, KOLKATA_TZ, DAY_KEY_FORMAT);
  return fromZonedTime(`${dayKey}T00:00:00`, KOLKATA_TZ);
}

/** Midnight Kolkata for "today". */
export function todayKolkata(): Date {
  return startOfDayKolkata(new Date());
}

/** Build a midnight-Kolkata Date from an explicit yyyy-MM-dd day key. */
export function kolkataDateFromDayKey(dayKey: string): Date {
  return fromZonedTime(`${dayKey}T00:00:00`, KOLKATA_TZ);
}

/** Shift a midnight-Kolkata date by N days, staying on midnight Kolkata. */
export function addDaysKolkata(date: Date, days: number): Date {
  const dayKey = formatInTimeZone(date, KOLKATA_TZ, DAY_KEY_FORMAT);
  const shifted = days >= 0 ? addDays(new Date(dayKey), days) : subDays(new Date(dayKey), -days);
  const shiftedKey = formatInTimeZone(shifted, "UTC", DAY_KEY_FORMAT);
  return fromZonedTime(`${shiftedKey}T00:00:00`, KOLKATA_TZ);
}

/** Format any instant using a date-fns pattern, rendered in Asia/Kolkata. */
export function formatKolkata(date: Date, pattern: string): string {
  return formatInTimeZone(date, KOLKATA_TZ, pattern);
}

/** "Mon, 28 Sep 2026" style day label in Kolkata time. */
export function formatDay(date: Date): string {
  return formatKolkata(date, "EEE, d MMM yyyy");
}

/** "04:37" style time label in Kolkata time. */
export function formatTime(date: Date): string {
  return formatKolkata(date, "HH:mm");
}

/** yyyy-MM-dd day key of an instant in Kolkata time. */
export function dayKeyKolkata(date: Date = new Date()): string {
  return formatInTimeZone(date, KOLKATA_TZ, DAY_KEY_FORMAT);
}

/** True when the two instants fall on the same calendar day in Kolkata. */
export function isSameDayKolkata(a: Date, b: Date): boolean {
  return dayKeyKolkata(a) === dayKeyKolkata(b);
}
