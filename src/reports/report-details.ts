import { LIMITS } from "../config/constants.js";
import type { Report, WordCount } from "../types.js";
import { count, formatDate } from "../utils/format.js";

export function ratioLabel(report: Report): string {
  const tier = report.language.tier;
  return tier.status === "no-signals"
    ? "No signals"
    : tier.status === "no-politeness"
      ? "No polite expressions"
      : (tier.ratio?.toFixed(2) ?? "Unavailable");
}
export function wordLines(
  title: string,
  words: WordCount[],
  format: (text: string) => string = (text) => text,
): string[] {
  if (!words.length) return [];
  return [
    "",
    title,
    ...words.slice(0, LIMITS.wordsShown).map((w) => {
      return `  ${format(w.group).padEnd(18)} ${count(w.count).padStart(6)}  ${wordVariants(w, format)}`;
    }),
  ];
}
export function wordVariants(
  word: WordCount,
  format: (text: string) => string = (text) => text,
): string {
  return Object.entries(word.variants)
    .sort((a, b) => b[1] - a[1])
    .map(([variant, total]) => `${format(variant)} (${total})`)
    .join(", ");
}
export function scopeLabel(report: Report): string {
  return [
    report.scope.agent ?? "All agents",
    report.scope.since ? `from ${formatDate(report.scope.since)}` : "all local history",
    report.scope.until ? `before ${formatDate(report.scope.until)}` : "",
    "UTC",
  ]
    .filter(Boolean)
    .join(" · ");
}
export function coverageLines(report: Report): string[] {
  const warnings = report.diagnostics.filter(
    (d) => d.status === "warning" || d.status === "skipped",
  ).length;
  const lines = [
    `${report.duplicatesRemoved.messages} duplicate messages and ${report.duplicatesRemoved.usage} duplicate usage records removed.`,
  ];
  if (report.undated.excluded)
    lines.push(`${report.undated.excluded} undated records excluded by date filters.`);
  if (warnings)
    lines.push(
      `${warnings} history warnings. Run ragereport doctor for locations and read errors.`,
    );
  return lines;
}
