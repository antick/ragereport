import { UI } from "../config/constants.js";
import type { DailySummary, WordCount } from "../types.js";
import { count, formatDate } from "../utils/format.js";
import { calendarData } from "../utils/calendar.js";
import { escapeHtml as esc } from "../reports/escape.js";
export function panel(title: string, content: string, subtitle = ""): string {
  return `<section class="panel"><div class="panel-heading"><h2>${esc(title)}</h2><span>${esc(subtitle)}</span></div>${content}</section>`;
}
export function empty(message: string): string {
  return `<div class="empty">${esc(message)}</div>`;
}
export function stat(label: string, value: string, note: string, accent = false): string {
  return `<div class="stat${accent ? " accent" : ""}"><div class="kicker">${esc(label)}</div><div class="stat-value">${esc(value)}</div><div class="stat-note">${esc(note)}</div></div>`;
}
export function table(headers: string[], rows: string[][]): string {
  if (!rows.length) return empty("No matching records in this view.");
  return `<div class="table-wrap"><table><thead><tr>${headers.map((h) => `<th scope="col">${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${esc(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}
export function bars(words: WordCount[], limit = 6): string {
  if (!words.length) return empty("No matches found. A quiet day for the keyboard.");
  const maximum = Math.max(...words.map((w) => w.count), 1);
  return words
    .slice(0, limit)
    .map(
      (word) =>
        `<div class="bar-row"><span class="bar-label">${esc(word.group)}</span><div class="bar-track"><div class="bar-fill" style="width:${(word.count / maximum) * 100}%"></div></div><span class="bar-number">${count(word.count)}</span></div>`,
    )
    .join("");
}
export function dailyChart(days: DailySummary[]): string {
  const recent = days.slice(-UI.chartDays);
  if (!recent.length) return empty("No dated records available for a timeline.");
  const maximum = Math.max(...recent.map((d) => d.language.swears), 1);
  return `<div class="chart" aria-label="Daily swears">${recent.map((day) => `<div class="chart-day" tabindex="0" aria-label="${esc(formatDate(day.day))}: ${day.language.swears} swears" title="${esc(formatDate(day.day))}: ${day.language.swears} swears"><div class="chart-fill" style="height:${Math.max((day.language.swears / maximum) * 110, 1)}px"></div><span>${esc(formatDate(day.day))}</span></div>`).join("")}</div>`;
}
export function heatmap(days: DailySummary[], end: string): string {
  const { cells, maximum } = calendarData(days, end);
  return `<div class="heatmap" aria-label="Daily swear calendar">${cells
    .map(({ day, swears }) => {
      const label = `${formatDate(day)}: ${swears === null ? "No recorded messages" : `${swears} swears`}`;
      return `<div tabindex="0" class="heat-cell" style="opacity:${swears === null ? 0.2 : Math.max(0.35, swears / Math.max(maximum, 1))}" title="${esc(label)}" aria-label="${esc(label)}"></div>`;
    })
    .join(
      "",
    )}</div><p class="small-copy">Last ${UI.heatmapDays} days. Faint cells mean no recorded messages.</p>`;
}
