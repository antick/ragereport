import type { Report } from "../types.js";
import { TERMINAL } from "../config/terminal.js";
import { calendarData } from "../utils/calendar.js";
import { count, formatDate, formatMonth } from "../utils/format.js";
import { fit, paint, wrap, type TerminalOptions } from "./terminal-style.js";

export function terminalCalendar(report: Report, options: TerminalOptions): string[] {
  const { cells, maximum, offset } = calendarData(
    report.days,
    report.scope.until ?? report.generatedAt,
    { since: report.scope.since, exclusiveEnd: !!report.scope.until },
  );
  if (!cells.length) return ["  No calendar days in the selected range."];
  const { calendar } = TERMINAL;
  const columns = Math.ceil((offset + cells.length) / calendar.weekdays.length);
  const width = options.width ?? TERMINAL.width;
  const color = options.color ?? false;
  const monthAxis = Array<string>(
    columns * calendar.cellWidth + formatMonth(cells.at(-1)!.day).length,
  ).fill(" ");
  let previousMonth = "";
  let labelEnd = 0;
  for (let column = 0; column < columns; column++) {
    const cell = cells[Math.max(0, column * calendar.weekdays.length - offset)];
    if (!cell) continue;
    const month = formatMonth(cell.day);
    const position = column * calendar.cellWidth;
    if (
      month !== previousMonth &&
      position >= labelEnd &&
      position + month.length <= monthAxis.length
    ) {
      [...month].forEach((letter, index) => {
        monthAxis[position + index] = letter;
      });
      labelEnd = position + month.length;
      previousMonth = month;
    }
  }
  const lines = [
    ...wrap(
      `${formatDate(cells[0]!.day)} to ${formatDate(cells.at(-1)!.day)} · UTC`,
      width - 4,
    ).map((line) => `  ${paint(color, "gray", line)}`),
    `      ${paint(color, "gray", monthAxis.join("").trimEnd())}`,
  ];
  for (const [row, weekday] of calendar.weekdays.entries()) {
    const values = Array.from({ length: columns }, (_, column) => {
      const cell = cells[column * calendar.weekdays.length + row - offset];
      if (!cell) return " ".repeat(calendar.cellWidth);
      const glyph =
        cell.swears === null
          ? calendar.missing
          : cell.swears === 0
            ? calendar.zero
            : calendar.levels[cell.level - 1]!;
      const tone = cell.level ? calendar.tones[cell.level - 1]! : "gray";
      return paint(color, tone, glyph) + " ";
    });
    lines.push(`  ${paint(color, "gray", fit(weekday, 3))} ${values.join("").trimEnd()}`);
  }
  lines.push(
    "",
    ...wrap(`${calendar.missing} No messages · ${calendar.zero} No swears`, width - 4).map(
      (line) => `  ${paint(color, "gray", line)}`,
    ),
    `  Less ${calendar.levels.map((glyph, index) => paint(color, calendar.tones[index]!, glyph)).join(" ")} More`,
    ...wrap(
      `Days with messages: ${count(cells.filter((cell) => cell.swears !== null).length)} · Swears: ${count(cells.reduce((total, cell) => total + (cell.swears ?? 0), 0))} · Peak ${count(maximum)}/day`,
      width - 4,
    ).map((line) => `  ${line}`),
  );
  return lines;
}
