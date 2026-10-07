import type { Report, WordCount } from "../types.js";
import { AGENTS } from "../types.js";
import { LIMITS, TIER_DEFINITIONS } from "../config/constants.js";
import { TERMINAL } from "../config/terminal.js";
import { diagnosticSummary } from "../readers/index.js";
import { count, formatDate, money } from "../utils/format.js";
import { coverageLines, ratioLabel, scopeLabel, wordVariants } from "./report-details.js";
import { paint, fit, wrap, type TerminalColor, type TerminalOptions } from "./terminal-style.js";
import { terminalCalendar } from "./terminal-calendar.js";
import { terminalProjects } from "./terminal-projects.js";
import { terminalText } from "../utils/terminal.js";

export function renderTerminal(report: Report, options: TerminalOptions = {}): string {
  const color = options.color ?? false;
  const width = Math.max(
    TERMINAL.minimumWidth,
    Math.min(options.width ?? TERMINAL.width, TERMINAL.maximumWidth),
  );
  const p = (tone: TerminalColor, text: string, bold = false) => paint(color, tone, text, bold);
  const lines: string[] = [
    "",
    p("orange", `╭${"─".repeat(width - 2)}╮`),
    `${p("orange", "│")} ${p("orange", "RAGE REPORT", true)} ${p("gray", ` / ${TERMINAL.commands[report.command]}`)}`,
    `${p("orange", "│")} ${p("gray", "Your keyboard has stories.")}`,
    p("orange", `╰${"─".repeat(width - 2)}╯`),
    `  ${p("gray", scopeLabel(report))}`,
    "",
  ];
  const section = (title: string, tone: TerminalColor = "cyan") => {
    lines.push(
      "",
      p(tone, `  ${title.toUpperCase()}`, true),
      p("gray", `  ${"─".repeat(width - 4)}`),
    );
  };
  const row = (label: string, value: string, tone: TerminalColor = "white") =>
    lines.push(`  ${fit(label, 26)} ${p(tone, value, true)}`);
  const words = (title: string, values: WordCount[], tone: TerminalColor) => {
    if (!values.length) return;
    section(title, tone);
    const max = Math.max(...values.map((v) => v.count));
    for (const value of values.slice(0, LIMITS.wordsShown)) {
      const filled = Math.max(1, Math.round((value.count / max) * TERMINAL.barWidth));
      const labelWidth = Math.min(TERMINAL.wordWidth, width - 28);
      const longLabel = value.group.length > labelWidth;
      if (longLabel)
        lines.push(...wrap(value.group, width - 4).map((line) => `  ${p(tone, line)}`));
      lines.push(
        `  ${fit(longLabel ? "" : value.group, labelWidth)} ${p(tone, "█".repeat(filled))}${p("gray", "░".repeat(TERMINAL.barWidth - filled))} ${p(tone, count(value.count), true)}`,
      );
      lines.push(...wrap(wordVariants(value), width - 6).map((line) => `    ${p("gray", line)}`));
    }
  };
  if (report.command === "doctor") {
    section("History locations");
    for (const agent of report.scope.agent ? [report.scope.agent] : AGENTS) {
      lines.push(
        `  ${p("cyan", fit(agent, 12), true)} ${diagnosticSummary(report.diagnostics, agent)}`,
      );
      for (const d of report.diagnostics.filter((d) => d.agent === agent && d.status !== "missing"))
        lines.push(
          `    ${p(d.status === "warning" || d.status === "skipped" ? "yellow" : "gray", `[${d.status}] ${d.path ?? ""} ${d.detail}`)}`,
        );
    }
  }
  if (report.command === "scan" || report.command === "report") {
    const language = report.language;
    section("The numbers");
    row("Your messages", count(language.messages), "blue");
    row("Swears", count(language.swears), "red");
    row("Polite expressions", count(language.polite), "green");
    row("Mild insults (separate)", count(language.insults), "yellow");
    row("Swears / 100 messages", count(language.swearsPer100Messages), "magenta");
    row("Messages with swears", count(language.swearingMessages), "red");
    row("Rage ratio", ratioLabel(report), "orange");
    section("Keyboard temperature", "orange");
    const tone: TerminalColor =
      TERMINAL.tierColors[
        TIER_DEFINITIONS.findIndex((definition) => definition.name === language.tier.name)
      ] ?? "cyan";
    lines.push(`  ${p(tone, language.tier.name.toUpperCase(), true)}`);
    if (language.tier.label) lines.push(`  ${p(tone, language.tier.label)}`);
    words("Top swears", language.swearWords, "red");
    words("Polite expressions", language.politeWords, "green");
    words("Mild insults", language.insultWords, "yellow");
    section("Agent comparison");
    for (const agent of report.agents)
      lines.push(
        `  ${p("cyan", fit(agent.agent, 12), true)} ${p("red", `${count(agent.language.swears)} swears`)} · ${p("green", `${count(agent.language.polite)} polite`)} · ${count(agent.language.messages)} messages`,
      );
    section("Weekly comparison", "magenta");
    const change = report.comparison.changePer100Messages;
    lines.push(
      `  ${change === null ? p("gray", "Not enough dated messages in both weeks.") : p(change <= 0 ? "green" : "red", `${count(Math.abs(change))} ${change < 0 ? "fewer" : "more"} swears / 100 messages than the previous week.`)}`,
    );
    section("The keyboard calendar", "green");
    lines.push(...terminalCalendar(report, { color, width }));
    section("Project comparison");
    lines.push(...terminalProjects(report, { color, width }));
  }
  if (report.command === "cost" || report.command === "report") {
    section("Token costs", "green");
    row("Estimated, priced usage", money(report.cost.estimatedCost), "green");
    row("Recorded charges", money(report.cost.billedCost), "blue");
    row("Usage records", count(report.cost.requests));
    row("Missing usage or prices", count(report.cost.unpricedRequests), "yellow");
    row("Input / output tokens", `${count(report.cost.input)} / ${count(report.cost.output)}`);
    row("Reasoning tokens", count(report.cost.reasoning), "magenta");
    row("Cache read / write", `${count(report.cost.cacheRead)} / ${count(report.cost.cacheWrite)}`);
    row(
      "Pricing source",
      `${report.cost.pricing.source}${report.cost.pricing.fetchedAt ? ` · ${formatDate(report.cost.pricing.fetchedAt)}` : ""}`,
      "gray",
    );
    if (report.cost.pricing.warning) lines.push(`  ${p("yellow", report.cost.pricing.warning)}`);
    section("Model breakdown");
    for (const entry of report.cost.rows)
      lines.push(
        `  ${p("cyan", entry.agent)} · ${terminalText(`${entry.provider}/${entry.model}`)} · ${entry.day ? formatDate(entry.day) : "Undated"} · ${p("green", money(entry.estimatedCost), true)} · ${count(entry.requests)} records`,
      );
    lines.push(`  ${p("gray", "API price estimates; subscriptions and discounts can differ.")}`);
  }
  if (report.command === "slop" || report.command === "report") {
    section("Assistant writing patterns", "magenta");
    row("Pattern hits", count(report.slop.hits), "magenta");
    row(
      "Affected / total messages",
      `${count(report.slop.affectedMessages)} / ${count(report.slop.messages)}`,
    );
    words("Most common patterns", report.slop.tells, "magenta");
    lines.push(`  ${p("gray", "A writing-style heuristic, not a quality rating.")}`);
  }
  if (!report.agents.length && report.command !== "doctor")
    lines.push(
      "",
      `  ${p("yellow", "No matching history. Run ragereport doctor to check locations.")}`,
    );
  lines.push("", ...coverageLines(report).map((line) => `  ${p("gray", line)}`), "");
  return lines
    .flatMap((line) => {
      const plain = terminalText(line);
      if ([...plain].length <= width) return [line];
      const indent = line.startsWith("    ") ? "    " : "  ";
      return wrap(plain, width - indent.length).map((part) => `${indent}${p("gray", part)}`);
    })
    .join("\n");
}
