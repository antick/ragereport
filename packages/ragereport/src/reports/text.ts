import { APP, LIMITS } from "../config/constants.js";
import type { Report } from "../types.js";
import { count, formatDate, money } from "../utils/format.js";
import { AGENTS } from "../types.js";
import { diagnosticSummary } from "../readers/index.js";
import { scopeLabel, ratioLabel, wordLines, coverageLines } from "./report-details.js";
import { escapeMarkdown as cell } from "./escape.js";
export { renderTerminal } from "./terminal.js";
export function renderMarkdown(report: Report): string {
  const lines = [
    `# ${APP.name}`,
    "",
    `${cell(scopeLabel(report))}. Generated ${formatDate(report.generatedAt)}.`,
    "",
  ];
  if (report.command === "doctor") {
    lines.push(
      "| Agent | Coverage |",
      "| --- | --- |",
      ...AGENTS.map(
        (agent) => `| ${agent} | ${cell(diagnosticSummary(report.diagnostics, agent))} |`,
      ),
    );
  } else {
    if (report.command === "scan" || report.command === "report")
      lines.push(
        `**${cell(report.language.tier.name)}** — ${report.language.swears} swears, ${report.language.polite} polite expressions, ${report.language.messages} messages.`,
        "",
        `Rage ratio: ${ratioLabel(report)}. Swears per 100 messages: ${count(report.language.swearsPer100Messages)}.`,
        "",
        cell(report.language.tier.label),
        "",
        "| Agent | Messages | Swears | Polite | Swears / 100 messages |",
        "| --- | ---: | ---: | ---: | ---: |",
        ...report.agents.map(
          (a) =>
            `| ${cell(a.agent)} | ${a.language.messages} | ${a.language.swears} | ${a.language.polite} | ${count(a.language.swearsPer100Messages)} |`,
        ),
        "",
        ...wordLines("Top swears", report.language.swearWords, cell).map((line) =>
          line.trim() ? `- ${line.trim()}` : "",
        ),
      );
    if (report.command === "cost" || report.command === "report")
      lines.push(
        "",
        `Estimated priced usage: **${money(report.cost.estimatedCost)}**. Recorded charges: ${money(report.cost.billedCost)}. Unknown prices: ${report.cost.unpricedRequests}.`,
        "",
        "| Agent | Model | Day | Records | Estimate |",
        "| --- | --- | --- | ---: | ---: |",
        ...report.cost.rows.map(
          (r) =>
            `| ${cell(r.agent)} | ${cell(`${r.provider}/${r.model}`)} | ${r.day ? formatDate(r.day) : "Undated"} | ${r.requests} | ${money(r.estimatedCost)} |`,
        ),
        "",
        `Pricing: ${cell(report.cost.pricing.source)}. ${cell(report.cost.pricing.warning ?? "")}`,
        "",
        "Estimates use API token prices; subscriptions and discounts can differ.",
      );
    if (report.command === "slop" || report.command === "report")
      lines.push(
        "",
        `Assistant writing patterns: **${report.slop.hits}** hits across ${report.slop.affectedMessages}/${report.slop.messages} messages. This is a writing-style heuristic, not a quality rating.`,
        "",
        ...report.slop.tells
          .slice(0, LIMITS.slopShown)
          .map((w) => `- ${cell(w.group)}: ${w.count}`),
      );
  }
  lines.push("", ...coverageLines(report), "");
  return lines.join("\n");
}
