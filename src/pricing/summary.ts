import { PRICING } from "../config/constants.js";
import type { CostRow, CostSummary, PriceCatalog, UsageRecord } from "../types.js";
import { addTokens, emptyTokens } from "../readers/tokens.js";
import { dayKey } from "../utils/format.js";

const MODEL_ALIASES: Record<string, string> = { "gpt-5.5-chat-latest": "gpt-5.5" };
function modelIdentity(record: UsageRecord): { provider: string; model: string } {
  let model = record.model ?? "unknown";
  let provider = record.provider?.toLowerCase() ?? "";
  if (model.includes("/")) {
    const prefix = model.split("/")[0]!;
    if (!provider) provider = prefix;
    if (prefix === provider) model = model.slice(prefix.length + 1);
  }
  if (provider === "claude" || provider === "claude-code") provider = "anthropic";
  if (provider === "codex") provider = "openai";
  if (!provider)
    provider = model.startsWith("claude-")
      ? "anthropic"
      : /^(?:gpt-|o\d)/u.test(model)
        ? "openai"
        : model.startsWith("gemini-")
          ? "google"
          : "unknown";
  model = MODEL_ALIASES[model] ?? model;
  return { provider, model };
}
export function priceUsage(record: UsageRecord, catalog: PriceCatalog): CostRow {
  const identity = modelIdentity(record);
  let rates = catalog.models[`${identity.provider}/${identity.model}`];
  // Date-suffixed Anthropic model IDs share their canonical model's rates.
  if (!rates && identity.provider === "anthropic")
    rates = catalog.models[`${identity.provider}/${identity.model.replace(/-\d{8}$/u, "")}`];
  const context = record.input + record.cacheRead + record.cacheWrite;
  if (rates)
    for (const tier of rates.tiers ?? [])
      if (context >= tier.above) rates = { ...rates, ...tier.rates };
  const estimatedCost = rates
    ? (record.input * rates.input +
        (record.output + record.reasoning) * rates.output +
        record.cacheRead * (rates.cacheRead ?? rates.input) +
        record.cacheWrite * (rates.cacheWrite ?? rates.input)) /
      PRICING.perTokens
    : null;
  return {
    agent: record.agent,
    ...identity,
    day: dayKey(record.timestamp),
    requests: 1,
    input: record.input,
    output: record.output,
    reasoning: record.reasoning,
    cacheRead: record.cacheRead,
    cacheWrite: record.cacheWrite,
    estimatedCost,
    billedCost: record.billedCost ?? null,
    priceSource: rates ? catalog.source : "unknown",
  };
}
export function emptyCost(catalog: PriceCatalog): CostSummary {
  return {
    ...emptyTokens(),
    requests: 0,
    estimatedCost: null,
    billedCost: null,
    unpricedRequests: 0,
    rows: [],
    pricing: { source: catalog.source, fetchedAt: catalog.fetchedAt, warning: catalog.warning },
  };
}
export function addCost(summary: CostSummary, row: CostRow): void {
  addTokens(summary, row);
  summary.requests += row.requests;
  if (row.estimatedCost !== null)
    summary.estimatedCost = (summary.estimatedCost ?? 0) + row.estimatedCost;
  else summary.unpricedRequests += row.requests;
  if (row.billedCost !== null) summary.billedCost = (summary.billedCost ?? 0) + row.billedCost;
  const existing = summary.rows.find(
    (r) =>
      r.agent === row.agent &&
      r.model === row.model &&
      r.provider === row.provider &&
      r.day === row.day &&
      r.priceSource === row.priceSource,
  );
  if (!existing) {
    summary.rows.push({ ...row });
    return;
  }
  addTokens(existing, row);
  existing.requests += row.requests;
  if (row.estimatedCost !== null)
    existing.estimatedCost = (existing.estimatedCost ?? 0) + row.estimatedCost;
  if (row.billedCost !== null) existing.billedCost = (existing.billedCost ?? 0) + row.billedCost;
}
