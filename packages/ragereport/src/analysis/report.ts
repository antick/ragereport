import { APP, TIME } from "../config/constants.js";
import type {
  AgentSummary,
  AnalysisOptions,
  DailySummary,
  PriceCatalog,
  ReaderResult,
  Report,
  SlopSummary,
  SlopMatch,
} from "../types.js";
import { createDetector } from "./detector.js";
import { detectSlop } from "./slop.js";
import { deduplicate } from "./dedupe.js";
import { addLanguage, emptyLanguage, emptySlop, finalizeLanguage, tally } from "./summaries.js";
import { dateArgument, dayKey, daysBefore, inRange } from "../utils/format.js";
import { addCost, emptyCost, priceUsage } from "../pricing/summary.js";
import { loadPricingCatalog, pricingCachePath } from "../pricing/catalog.js";
import { readerContext, readHistories } from "../readers/index.js";
import { loadScanCache, saveScanCache } from "./scan-cache.js";
import { readCachedScan } from "./scan-input-cache.js";

function addSlop(summary: SlopSummary, matches: SlopMatch[]): void {
  summary.messages++;
  summary.hits += matches.length;
  if (matches.length) summary.affectedMessages++;
  for (const match of matches) tally(summary.tells, match.tell, match.category);
  summary.tells.sort((a, b) => b.count - a.count || a.group.localeCompare(b.group));
}
export function buildReport(
  data: ReaderResult,
  options: AnalysisOptions,
  catalog: PriceCatalog,
  generatedAt = new Date().toISOString(),
): Report {
  options = {
    ...options,
    since: options.since ? dateArgument(options.since) : undefined,
    until: options.until ? dateArgument(options.until) : undefined,
  };
  const messages = deduplicate(data.messages);
  const usage = deduplicate(data.usage);
  const detect = createDetector(options.config);
  const end = options.until ?? generatedAt;
  const currentStart = daysBefore(end, TIME.weekDays);
  const previousStart = daysBefore(currentStart, TIME.weekDays);
  const report: Report = {
    schemaVersion: APP.schemaVersion,
    generatedAt,
    command: options.command,
    scope: {
      agent: options.agent,
      since: options.since,
      until: options.until,
      languages: options.config.languages,
      timezone: "UTC",
    },
    language: emptyLanguage(),
    slop: emptySlop(),
    cost: emptyCost(catalog),
    agents: [],
    days: [],
    projects: [],
    comparison: {
      current: emptyLanguage(),
      previous: emptyLanguage(),
      changePer100Messages: null,
      currentSince: currentStart,
      previousSince: previousStart,
      until: end,
    },
    diagnostics: [],
    duplicatesRemoved: { messages: messages.removed, usage: usage.removed },
    undated: { messages: 0, usage: 0, excluded: 0 },
  };
  const agents = new Map<string, AgentSummary>();
  const days = new Map<string, DailySummary>();
  const agentDays = new Map<string, DailySummary>();
  const projects = new Map<string, Report["projects"][number]>();
  const agentSummary = (agent: AgentSummary["agent"]) => {
    let summary = agents.get(agent);
    if (!summary) {
      summary = {
        agent,
        language: emptyLanguage(),
        slop: emptySlop(),
        cost: emptyCost(catalog),
        days: [],
      };
      agents.set(agent, summary);
    }
    return summary;
  };
  const dailySummary = (date: string | undefined, agent?: AgentSummary["agent"]) => {
    const day = dayKey(date);
    if (!day) return undefined;
    const map = agent ? agentDays : days;
    const key = agent ? `${agent}:${day}` : day;
    let summary = map.get(key);
    if (!summary) {
      summary = { day, language: emptyLanguage(), slop: emptySlop(), cost: emptyCost(catalog) };
      map.set(key, summary);
      if (agent) agentSummary(agent).days.push(summary);
    }
    return summary;
  };
  for (const message of messages.records) {
    if (options.agent && message.agent !== options.agent) continue;
    const included = inRange(message.timestamp, options.since, options.until);
    const compared =
      message.role === "user" &&
      !!message.timestamp &&
      inRange(message.timestamp, previousStart, end);
    const matches =
      message.role === "user" && (included || compared)
        ? (message.computed?.matches ?? detect(message.text))
        : [];
    const slopMatches = message.role === "assistant" && included ? detectSlop(message.text) : [];
    if (message.role === "user" && message.timestamp) {
      if (inRange(message.timestamp, currentStart, end))
        addLanguage(report.comparison.current, matches);
      else if (inRange(message.timestamp, previousStart, currentStart))
        addLanguage(report.comparison.previous, matches);
    }
    if (!message.timestamp) {
      report.undated.messages++;
      if (options.since || options.until) report.undated.excluded++;
    }
    if (!included) continue;
    const agent = agentSummary(message.agent);
    const day = dailySummary(message.timestamp);
    const agentDay = dailySummary(message.timestamp, message.agent);
    let project = message.project ? projects.get(message.project) : undefined;
    if (message.project && !project) {
      project = { name: message.project, language: emptyLanguage(), slop: emptySlop() };
      projects.set(message.project, project);
    }
    if (message.role === "user") {
      addLanguage(report.language, matches);
      addLanguage(agent.language, matches);
      if (day) addLanguage(day.language, matches);
      if (agentDay) addLanguage(agentDay.language, matches);
      if (project) addLanguage(project.language, matches);
    } else {
      addSlop(report.slop, slopMatches);
      addSlop(agent.slop, slopMatches);
      if (day) addSlop(day.slop, slopMatches);
      if (agentDay) addSlop(agentDay.slop, slopMatches);
      if (project) addSlop(project.slop, slopMatches);
    }
  }
  for (const record of usage.records) {
    if (options.agent && record.agent !== options.agent) continue;
    if (!record.timestamp) {
      report.undated.usage++;
      if (options.since || options.until) report.undated.excluded++;
    }
    if (!inRange(record.timestamp, options.since, options.until)) continue;
    const priced = priceUsage(record, catalog);
    addCost(report.cost, priced);
    addCost(agentSummary(record.agent).cost, priced);
    const day = dailySummary(record.timestamp);
    if (day) addCost(day.cost, priced);
    const agentDay = dailySummary(record.timestamp, record.agent);
    if (agentDay) addCost(agentDay.cost, priced);
  }
  report.agents = [...agents.values()];
  report.days = [...days.values()].sort((a, b) => a.day.localeCompare(b.day));
  report.projects = [...projects.values()];
  for (const agent of report.agents) agent.days.sort((a, b) => a.day.localeCompare(b.day));
  for (const summary of [
    report.language,
    ...report.agents.map((a) => a.language),
    ...report.days.map((d) => d.language),
    ...[...agentDays.values()].map((d) => d.language),
    ...report.projects.map((p) => p.language),
    report.comparison.current,
    report.comparison.previous,
  ])
    finalizeLanguage(summary, options.noRoast);
  report.projects.sort((a, b) => b.language.swearsPer100Messages - a.language.swearsPer100Messages);
  if (report.comparison.current.messages && report.comparison.previous.messages)
    report.comparison.changePer100Messages =
      report.comparison.current.swearsPer100Messages -
      report.comparison.previous.swearsPer100Messages;
  return report;
}
export async function analyze(options: AnalysisOptions): Promise<Report> {
  const context = readerContext({
    paths: options.config.paths,
    usage: options.command === "cost" || options.command === "report",
    roles:
      options.command === "scan"
        ? ["user"]
        : options.command === "slop"
          ? ["assistant"]
          : options.command === "doctor"
            ? []
            : undefined,
    onProgress: options.onProgress,
    ...(options.home ? { home: options.home, env: {} } : {}),
  });
  options.onProgress?.({ type: "stage", stage: "discovering" });
  const cache = await loadScanCache(context, options);
  if (cache?.report) {
    options.onProgress?.({ type: "stage", stage: "cached" });
    return cache.report;
  }
  const data = cache
    ? await readCachedScan(context, options, cache.path)
    : await readHistories(context, options.agent);
  options.onProgress?.({ type: "stage", stage: "pricing" });
  const catalog = await loadPricingCatalog({
    offline: options.offline || !context.usage || !data.usage.length,
    refresh: options.refreshPrices,
    cachePath: pricingCachePath(context.home, context.env),
  });
  options.onProgress?.({ type: "stage", stage: "analysis" });
  const report = buildReport(data, options, catalog);
  report.diagnostics = context.diagnostics;
  await saveScanCache(cache, report, data, context, options);
  return report;
}
