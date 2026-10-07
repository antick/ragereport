import type { Report } from "../types.js";
import { LIMITS } from "../config/constants.js";
import { TERMINAL } from "../config/terminal.js";
import { count } from "../utils/format.js";
import { projectLabel } from "./escape.js";
import { paint, wrap, type TerminalOptions } from "./terminal-style.js";

export function terminalProjects(report: Report, options: TerminalOptions): string[] {
  const projects = report.projects
    .filter((project) => project.language.messages > 0)
    .sort(
      (a, b) =>
        b.language.swearsPer100Messages - a.language.swearsPer100Messages ||
        b.language.swears - a.language.swears ||
        a.name.localeCompare(b.name),
    );
  if (!projects.length) return ["  No project metadata in the selected history."];
  const color = options.color ?? false;
  const width = (options.width ?? TERMINAL.width) - 4;
  const lines: string[] = [];
  for (const project of projects.slice(0, LIMITS.wordsShown)) {
    lines.push(
      ...wrap(projectLabel(project.name), width).map(
        (line) => `  ${paint(color, "cyan", line, true)}`,
      ),
    );
    lines.push(
      ...wrap(
        `${count(project.language.swears)} swears · ${count(project.language.swearsPer100Messages)} / 100 messages · ${count(project.language.messages)} messages · ${count(project.language.polite)} polite`,
        width - 2,
      ).map((line) => `    ${line}`),
    );
  }
  lines.push("  Ranked by swears per 100 messages.");
  if (projects.length > LIMITS.wordsShown)
    lines.push(`  Showing ${LIMITS.wordsShown} of ${count(projects.length)} projects.`);
  return lines;
}
