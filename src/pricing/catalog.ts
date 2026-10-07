import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import snapshot from "../config/pricing-snapshot.json" with { type: "json" };
import { PRICING } from "../config/constants.js";
import type { ModelRates, PriceCatalog } from "../types.js";
import { number, object } from "../utils/value.js";
import { writePrivateFile } from "../utils/files.js";

export interface PricingOptions {
  offline?: boolean;
  refresh?: boolean;
  cachePath?: string;
  now?: Date;
  fetcher?: typeof fetch;
}
function rate(value: unknown): ModelRates | undefined {
  const r = object(value);
  if (
    typeof r.input !== "number" ||
    typeof r.output !== "number" ||
    !Number.isFinite(r.input) ||
    !Number.isFinite(r.output) ||
    r.input < 0 ||
    r.output < 0
  )
    return undefined;
  const result: ModelRates = { input: r.input, output: r.output };
  if (typeof r.cache_read === "number") result.cacheRead = number(r.cache_read);
  if (typeof r.cache_write === "number") result.cacheWrite = number(r.cache_write);
  if (Array.isArray(r.tiers)) {
    result.tiers = r.tiers
      .flatMap((item) => {
        const t = object(item);
        const info = object(t.tier);
        const rates = rate(t);
        const above = number(info.size);
        return rates && above && (info.type === undefined || info.type === "context")
          ? [{ above, rates }]
          : [];
      })
      .sort((a, b) => a.above - b.above);
  }
  const large = rate(r.context_over_200k);
  if (large) result.tiers = [...(result.tiers ?? []), { above: 200_000, rates: large }];
  return result;
}
export function parseCatalog(catalog: unknown): Record<string, ModelRates> {
  const models: Record<string, ModelRates> = {};
  for (const [provider, providerData] of Object.entries(object(catalog)))
    for (const [model, entry] of Object.entries(object(object(providerData).models))) {
      const rates = rate(object(entry).cost);
      if (rates) models[`${provider}/${model}`] = rates;
    }
  return models;
}
export function pricingCachePath(
  home = homedir(),
  env: Record<string, string | undefined> = process.env,
): string {
  const base =
    env.XDG_CACHE_HOME ??
    (process.platform === "darwin"
      ? join(home, "Library", "Caches")
      : process.platform === "win32"
        ? (env.LOCALAPPDATA ?? join(home, "AppData", "Local"))
        : join(home, ".cache"));
  return join(base, "ragereport", PRICING.filename);
}
function fallback(warning?: string): PriceCatalog {
  return {
    source: "fallback",
    fetchedAt: snapshot.fetchedAt,
    warning,
    models: Object.fromEntries(
      Object.entries(snapshot.models).flatMap(([key, value]) => {
        const rates = rate(value);
        return rates ? [[key, rates]] : [];
      }),
    ),
  };
}
export async function loadPricingCatalog(options: PricingOptions = {}): Promise<PriceCatalog> {
  const path = options.cachePath ?? pricingCachePath();
  const now = options.now ?? new Date();
  let cache: { fetchedAt: string; raw: unknown } | undefined;
  try {
    const stored = object(JSON.parse(await readFile(path, "utf8")));
    if (typeof stored.fetchedAt === "string" && Object.keys(parseCatalog(stored.raw)).length)
      cache = { fetchedAt: stored.fetchedAt, raw: stored.raw };
  } catch {
    /* A missing or damaged cache falls back to the bundled snapshot. */
  }
  const age = cache ? now.getTime() - Date.parse(cache.fetchedAt) : Infinity;
  const fresh = age >= 0 && age < PRICING.ttlMs;
  if (cache && ((fresh && !options.refresh) || options.offline))
    return {
      source: fresh ? "catalog" : "stale-cache",
      fetchedAt: cache.fetchedAt,
      models: parseCatalog(cache.raw),
      warning: fresh ? undefined : "Using an older cached price catalog.",
    };
  if (options.offline) return fallback("Offline mode: using the bundled price snapshot.");
  try {
    const response = await (options.fetcher ?? fetch)(PRICING.url, {
      signal: AbortSignal.timeout(PRICING.timeoutMs),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const raw: unknown = await response.json();
    const models = parseCatalog(raw);
    if (!Object.keys(models).length) throw new Error("Unrecognized pricing catalog");
    const fetchedAt = now.toISOString();
    let warning: string | undefined;
    try {
      await writePrivateFile(path, `${JSON.stringify({ fetchedAt, raw })}\n`);
    } catch {
      warning = "Prices loaded, but the local cache could not be saved.";
    }
    return { source: "catalog", fetchedAt, models, warning };
  } catch {
    return cache
      ? {
          source: "stale-cache",
          fetchedAt: cache.fetchedAt,
          models: parseCatalog(cache.raw),
          warning: "Price refresh failed: using the older cached catalog.",
        }
      : fallback("Price refresh failed: using the bundled price snapshot.");
  }
}
