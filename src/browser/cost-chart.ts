import type { CostRow } from "../types.js";
import { UI } from "../config/constants.js";
import { count, formatDate, money } from "../utils/format.js";
import { escapeHtml as esc } from "../reports/escape.js";
import { empty } from "./components.js";
export function costChart(rows: CostRow[]): string {
  const days = new Map<string, { estimate: number | null; unknown: number }>();
  for (const row of rows) {
    if (!row.day) continue;
    const day = days.get(row.day) ?? { estimate: null, unknown: 0 };
    if (row.estimatedCost !== null) day.estimate = (day.estimate ?? 0) + row.estimatedCost;
    else day.unknown += row.requests;
    days.set(row.day, day);
  }
  const recent = [...days.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-UI.chartDays);
  if (!recent.length) return empty("No dated usage records to chart.");
  const maximum = Math.max(...recent.map(([, day]) => day.estimate ?? 0), Number.EPSILON);
  return `<div class="chart" aria-label="Daily priced API cost">${recent
    .map(([date, day]) => {
      const label = `${formatDate(date)}: ${money(day.estimate)} · ${count(day.unknown)} unpriced records`;
      return `<div class="chart-day" tabindex="0" aria-label="${esc(label)}" title="${esc(label)}"><div class="chart-fill" style="height:${Math.max(((day.estimate ?? 0) / maximum) * 110, 1)}px"></div><span>${esc(formatDate(date))}</span></div>`;
    })
    .join("")}</div>`;
}
