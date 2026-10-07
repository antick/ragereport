import { UI, TIME } from "../config/constants.js";
import type { DailySummary } from "../types.js";
import { dayKey, daysBefore } from "./format.js";

export interface CalendarCell {
  day: string;
  swears: number | null;
  level: number;
}
export interface CalendarOptions {
  since?: string;
  exclusiveEnd?: boolean;
}
export function calendarData(days: DailySummary[], end: string, options: CalendarOptions = {}) {
  const last = dayKey(new Date(Date.parse(end) - (options.exclusiveEnd ? 1 : 0)).toISOString())!;
  const windowStart = dayKey(daysBefore(last, UI.heatmapDays - 1))!;
  const since = dayKey(options.since);
  const first = since && since > windowStart ? since : windowStart;
  const length = Math.max(0, (Date.parse(last) - Date.parse(first)) / TIME.dayMs + 1);
  const values = new Map(
    days
      .filter((day) => day.language.messages > 0 && day.day >= first && day.day <= last)
      .map((day) => [day.day, day.language.swears]),
  );
  const maximum = Math.max(...values.values(), 0);
  const cells: CalendarCell[] = Array.from({ length }, (_, index) => {
    const day = dayKey(daysBefore(last, length - 1 - index))!;
    const swears = values.get(day) ?? null;
    return { day, swears, level: swears ? Math.ceil((swears / maximum) * UI.heatmapLevels) : 0 };
  });
  return {
    cells,
    maximum,
    offset: cells.length ? new Date(cells[0]!.day).getUTCDay() : 0,
  };
}
