import type {
  AgentSummary,
  CostSummary,
  DailySummary,
  LanguageSummary,
  Report,
  SlopSummary,
  WordCount,
} from "../types.js";
import { emptyLanguage, emptySlop, finalizeLanguage } from "../analysis/summaries.js";
import { emptyCost, addCost } from "../pricing/summary.js";
import { daysBefore } from "../utils/format.js";
export interface Filters {
  agent: string;
  range: string;
  model: string;
}
export interface View {
  language: LanguageSummary;
  slop: SlopSummary;
  cost: CostSummary;
  days: DailySummary[];
  agents: AgentSummary[];
  filtered: boolean;
}
function mergeWords(target: WordCount[], words: WordCount[]): void {
  for (const word of words) {
    let entry = target.find((w) => w.group === word.group);
    if (!entry) {
      entry = { group: word.group, count: 0, variants: {} };
      target.push(entry);
    }
    entry.count += word.count;
    for (const [variant, count] of Object.entries(word.variants))
      entry.variants[variant] = (entry.variants[variant] ?? 0) + count;
  }
  target.sort((a, b) => b.count - a.count || a.group.localeCompare(b.group));
}
export function sumLanguage(values: LanguageSummary[], noRoast = false): LanguageSummary {
  const total = emptyLanguage();
  for (const value of values) {
    for (const key of ["messages", "swears", "insults", "polite", "swearingMessages"] as const)
      total[key] += value[key];
    for (const key of ["mild", "moderate", "strong"] as const)
      total.severity[key] += value.severity[key];
    mergeWords(total.swearWords, value.swearWords);
    mergeWords(total.insultWords, value.insultWords);
    mergeWords(total.politeWords, value.politeWords);
  }
  finalizeLanguage(total, noRoast);
  return total;
}
function sumSlop(values: SlopSummary[]): SlopSummary {
  const total = emptySlop();
  for (const value of values) {
    total.messages += value.messages;
    total.hits += value.hits;
    total.affectedMessages += value.affectedMessages;
    mergeWords(total.tells, value.tells);
  }
  return total;
}
export function filterReport(report: Report, filters: Filters): View {
  const agents = report.agents.filter((a) => filters.agent === "all" || a.agent === filters.agent);
  const since =
    filters.range === "all"
      ? undefined
      : daysBefore(report.scope.until ?? report.generatedAt, Number(filters.range));
  const allowedDay = (day: string) => !since || day >= since.slice(0, 10);
  const days = (filters.agent === "all" ? report.days : agents.flatMap((a) => a.days)).filter((d) =>
    allowedDay(d.day),
  );
  const language = since
    ? sumLanguage(
        days.map((d) => d.language),
        !report.language.tier.label,
      )
    : filters.agent === "all"
      ? report.language
      : sumLanguage(
          agents.map((a) => a.language),
          !report.language.tier.label,
        );
  const slop = since
    ? sumSlop(days.map((d) => d.slop))
    : filters.agent === "all"
      ? report.slop
      : sumSlop(agents.map((a) => a.slop));
  const cost = emptyCost({ ...report.cost.pricing, models: {} });
  for (const row of report.cost.rows) {
    if (filters.agent !== "all" && row.agent !== filters.agent) continue;
    if (since && (!row.day || !allowedDay(row.day))) continue;
    if (filters.model !== "all" && `${row.provider}/${row.model}` !== filters.model) continue;
    addCost(cost, row);
  }
  return {
    language,
    slop,
    cost,
    days,
    filtered: filters.agent !== "all" || filters.range !== "all",
    agents: agents.map((a) => {
      const agentDays = a.days.filter((d) => allowedDay(d.day));
      const agentCost = emptyCost({ ...report.cost.pricing, models: {} });
      for (const row of cost.rows.filter((r) => r.agent === a.agent)) addCost(agentCost, row);
      return {
        ...a,
        language: since
          ? sumLanguage(
              agentDays.map((d) => d.language),
              !report.language.tier.label,
            )
          : a.language,
        slop: since ? sumSlop(agentDays.map((d) => d.slop)) : a.slop,
        cost: agentCost,
      };
    }),
  };
}
