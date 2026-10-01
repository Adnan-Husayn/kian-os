import { formatInTimeZone } from "date-fns-tz";
import { KOLKATA_TZ, kolkataDateFromDayKey } from "@/lib/dates";

/**
 * Routines: repeating commitments (DSA practice, gym, ...). Pure helpers —
 * no database, no clock — deciding which routines land on a given day.
 */

export type DayType = "college" | "free";

export const DAY_TYPES: { value: DayType; label: string }[] = [
  { value: "college", label: "College day" },
  { value: "free", label: "Free day" },
];

export function isDayType(value: unknown): value is DayType {
  return value === "college" || value === "free";
}

export interface RoutineLike {
  id: string;
  title: string;
  projectId: string | null;
  minutesCollege: number | null;
  minutesFree: number | null;
  startTime: string | null;
  /** ISO weekdays (1 = Monday ... 7 = Sunday); empty = every day. */
  weekdays: number[];
  active: boolean;
  position: number;
}

export interface RoutineOccurrence {
  routineId: string;
  title: string;
  projectId: string | null;
  minutes: number;
  startTime: string | null;
}

/** ISO weekday (1 = Monday ... 7 = Sunday) of a yyyy-MM-dd day key in Kolkata. */
export function isoWeekdayOfDayKey(dayKey: string): number {
  return Number(formatInTimeZone(kolkataDateFromDayKey(dayKey), KOLKATA_TZ, "i"));
}

/** Minutes a routine takes on this kind of day; null when it is skipped. */
export function minutesFor(
  routine: Pick<RoutineLike, "minutesCollege" | "minutesFree">,
  dayType: DayType,
): number | null {
  const minutes =
    dayType === "college" ? routine.minutesCollege : routine.minutesFree;
  return minutes != null && minutes > 0 ? minutes : null;
}

/** True when the routine runs on this weekday (no weekdays = every day). */
export function appliesOnWeekday(
  routine: Pick<RoutineLike, "weekdays">,
  isoWeekday: number,
): boolean {
  return routine.weekdays.length === 0 || routine.weekdays.includes(isoWeekday);
}

/**
 * The routine tasks for one day, in routine order: active routines that run
 * on this weekday and have minutes for this kind of day.
 */
export function routinesForDay(
  routines: RoutineLike[],
  dayType: DayType,
  dayKey: string,
): RoutineOccurrence[] {
  const weekday = isoWeekdayOfDayKey(dayKey);
  return [...routines]
    .sort((a, b) => a.position - b.position || a.title.localeCompare(b.title))
    .flatMap((routine) => {
      if (!routine.active || !appliesOnWeekday(routine, weekday)) return [];
      const minutes = minutesFor(routine, dayType);
      if (minutes === null) return [];
      return [
        {
          routineId: routine.id,
          title: routine.title,
          projectId: routine.projectId,
          minutes,
          startTime: routine.startTime,
        },
      ];
    });
}

/** Total minutes of a day's routine occurrences. */
export function totalMinutes(occurrences: RoutineOccurrence[]): number {
  return occurrences.reduce((sum, o) => sum + o.minutes, 0);
}

/** "3h 35m", "45m", "2h". */
export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}
