import { LIMITS } from "../config/constants.js";
import type { Report } from "../types.js";
import type { View } from "./data.js";
import { count, formatDate, money } from "../utils/format.js";
import { escapeHtml as esc } from "../reports/escape.js";
import { bars, dailyChart, empty, heatmap, panel, stat, table } from "./components.js";
import { costChart } from "./cost-chart.js";
function stats(view: View): string {
  return `<div class="stats">${stat("SWEARS", count(view.language.swears), `${count(view.language.swearingMessages)} messages with swears`, true)}${stat("POLITE EXPRESSIONS", count(view.language.polite), "A little kindness goes a long way")}${stat("YOUR MESSAGES", count(view.language.messages), `${count(view.language.insults)} mild insults counted separately`)}${stat("SWEARS / 100 MESSAGES", count(view.language.swearsPer100Messages), "Normalized for how much you chat")}</div>`;
}
function comparison(report: Report, view: View): string {
  if (view.filtered)
    return empty(
      "Reset agent and period filters to see the weekly comparison for the original scan scope.",
    );
  const c = report.comparison;
  const period = `${formatDate(c.currentSince)} to ${formatDate(c.until)} · preceding week starts ${formatDate(c.previousSince)}`;
  if (c.changePer100Messages === null)
    return `${empty("Not enough dated messages in both weeks to compare.")}<p class="small-copy">${esc(period)}</p>`;
  const change = c.changePer100Messages;
  return `<div class="trend"><div class="trend-value${change > 0 ? " hot" : ""}">${change > 0 ? "+" : ""}${count(change)}</div><div class="trend-copy">swears per 100 messages<small>${change < 0 ? "A calmer week for your keyboard." : change > 0 ? "Your keyboard is running a little hotter." : "Same spice level as last week."}</small></div></div><p class="small-copy">${esc(period)}. Based on ${c.current.messages} vs ${c.previous.messages} messages.</p>`;
}
export function overview(report: Report, view: View): string {
  const t = view.language.tier;
  const ratio =
    t.status === "finite"
      ? (t.ratio?.toFixed(2) ?? "Unavailable")
      : t.status === "no-signals"
        ? "No signals"
        : "No polite words";
  const tier = `<section class="panel tier-panel"><div class="tier-orbit"></div><div class="kicker">YOUR KEYBOARD TEMPERATURE</div><h2 class="tier-title">${esc(t.name)}</h2><p>${esc(t.label || "Roast labels are disabled for this report.")}</p><div class="tier-bottom"><div>SWEARS / POLITE<strong>${esc(ratio)}</strong></div><div>LANGUAGE SIGNALS<strong>${count(view.language.swears + view.language.polite)}</strong></div></div></section>`;
  return `${stats(view)}<div class="grid">${tier}${panel("Your vocabulary, ranked", bars(view.language.swearWords), "WORD FAMILIES")}</div><div class="grid">${panel("The week in perspective", comparison(report, view))}${panel("Daily spice levels", dailyChart(view.days), "SWEARS PER DAY")}</div><div class="stats">${stat("PRICED API ESTIMATE", money(view.cost.estimatedCost), `${view.cost.unpricedRequests} records missing usage or prices`)}${stat("RECORDED CHARGES", money(view.cost.billedCost), "Subscriptions and discounts can differ")}${stat("ASSISTANT PATTERNS", count(view.slop.hits), `${view.slop.affectedMessages} messages with matches`)}${stat("ACTIVE AGENTS", count(view.agents.length), "Local histories with matching records")}</div>${panel("The keyboard calendar", heatmap(view.days, report.scope.until ?? report.generatedAt, view.calendar))}`;
}
export function language(report: Report, view: View): string {
  return `${stats(view)}<div class="grid">${panel("Top swears", bars(view.language.swearWords, LIMITS.wordsShown))}${panel("Polite expressions", bars(view.language.politeWords, LIMITS.wordsShown))}</div><div class="grid">${panel("Mild insults", bars(view.language.insultWords), "SEPARATE FROM SWEARS")}${panel(
    "Swear severity",
    table(
      ["Severity", "Count"],
      Object.entries(view.language.severity).map(([severity, value]) => [severity, count(value)]),
    ),
  )}</div>${panel(
    "Agent comparison",
    table(
      ["Agent", "Messages", "Swears", "Polite", "Swears / 100"],
      view.agents.map((a) => [
        a.agent,
        count(a.language.messages),
        count(a.language.swears),
        count(a.language.polite),
        count(a.language.swearsPer100Messages),
      ]),
    ),
  )}<br>${panel(
    "Project comparison",
    view.filtered
      ? empty("Project comparisons apply to the original scan scope. Reset filters to view them.")
      : table(
          ["Project", "Messages", "Swears", "Polite", "Swears / 100"],
          report.projects.map((p) => [
            p.name,
            count(p.language.messages),
            count(p.language.swears),
            count(p.language.polite),
            count(p.language.swearsPer100Messages),
          ]),
        ),
  )}`;
}
export function costs(view: View): string {
  const c = view.cost;
  const models = new Map<
    string,
    { estimate: number | null; requests: number; input: number; output: number; cache: number }
  >();
  for (const r of c.rows) {
    const key = `${r.provider}/${r.model}`;
    const m = models.get(key) ?? { estimate: null, requests: 0, input: 0, output: 0, cache: 0 };
    if (r.estimatedCost !== null) m.estimate = (m.estimate ?? 0) + r.estimatedCost;
    m.requests += r.requests;
    m.input += r.input;
    m.output += r.output + r.reasoning;
    m.cache += r.cacheRead + r.cacheWrite;
    models.set(key, m);
  }
  return `<div class="stats">${stat("PRICED API ESTIMATE", money(c.estimatedCost), "Only usage with a known price is included", true)}${stat("RECORDED CHARGES", money(c.billedCost), "Charges recorded by the agent")}${stat("USAGE RECORDS", count(c.requests), `${c.unpricedRequests} missing usage or prices`)}${stat("CACHE TOKENS", count(c.cacheRead + c.cacheWrite), `${count(c.cacheRead)} read · ${count(c.cacheWrite)} write`)}</div><div class="notice">Prices: ${esc(c.pricing.source)}${c.pricing.fetchedAt ? ` · ${esc(formatDate(c.pricing.fetchedAt))}` : ""}. ${esc(c.pricing.warning ?? "")} Estimates use API token prices; your subscription, service tier, or discounts can differ. Unknown usage is unavailable, not free.</div>${panel(
    "Model breakdown",
    table(
      ["Model", "Records", "Input", "Output + reasoning", "Cache", "Estimate"],
      [...models.entries()]
        .sort((a, b) => (b[1].estimate ?? 0) - (a[1].estimate ?? 0))
        .map(([name, m]) => [
          name,
          count(m.requests),
          count(m.input),
          count(m.output),
          count(m.cache),
          money(m.estimate),
        ]),
    ),
  )}<br>${panel(
    "Agent breakdown",
    table(
      ["Agent", "Records", "Estimate", "Recorded"],
      view.agents.map((a) => [
        a.agent,
        count(a.cost.requests),
        money(a.cost.estimatedCost),
        money(a.cost.billedCost),
      ]),
    ),
  )}<br>${panel("Daily cost chart", costChart(c.rows))}<br>${panel(
    "Daily priced usage",
    table(
      ["Day", "Agent", "Model", "Records", "Estimate"],
      c.rows.map((r) => [
        r.day ? formatDate(r.day) : "Undated",
        r.agent,
        r.model,
        count(r.requests),
        money(r.estimatedCost),
      ]),
    ),
  )}`;
}
export function assistant(view: View): string {
  return `<div class="stats">${stat("PATTERN HITS", count(view.slop.hits), "Common stock phrases and formatting habits", true)}${stat("AFFECTED MESSAGES", count(view.slop.affectedMessages), "Messages containing at least one pattern")}${stat("ASSISTANT MESSAGES", count(view.slop.messages), "Only assistant prose is inspected")}${stat("AFFECTED SHARE", view.slop.messages ? `${count((view.slop.affectedMessages / view.slop.messages) * 100)}%` : "Unavailable", "Code blocks are excluded")}</div><div class="notice">These are writing-pattern matches, not proof of low quality. Context matters, and normal phrases can also match.</div><div class="grid">${panel("Most common patterns", bars(view.slop.tells, LIMITS.slopShown))}${panel(
    "Agent writing patterns",
    table(
      ["Agent", "Messages", "Hits", "Affected"],
      view.agents.map((a) => [
        a.agent,
        count(a.slop.messages),
        count(a.slop.hits),
        count(a.slop.affectedMessages),
      ]),
    ),
  )}</div>`;
}
