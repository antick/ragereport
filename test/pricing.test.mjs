import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadPricingCatalog, parseCatalog, priceUsage, emptyCost, addCost } from "../dist/index.js";
const record = {
  agent: "codex",
  session: "test",
  provider: "openai",
  model: "test-model",
  timestamp: "2026-10-04T00:00:00Z",
  input: 100,
  output: 10,
  reasoning: 5,
  cacheRead: 20,
  cacheWrite: 0,
};
const raw = {
  openai: {
    models: {
      "test-model": {
        cost: {
          input: 2,
          output: 10,
          cache_read: 0.2,
          tiers: [{ tier: { type: "context", size: 200 }, input: 4, output: 20, cache_read: 0.4 }],
        },
      },
    },
  },
};
test("cache, refresh, stale fallback, and offline mode have distinct behavior", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ragereport-prices-"));
  try {
    const path = join(directory, "pricing.json");
    let calls = 0;
    const fetcher = async () => {
      calls++;
      return new Response(JSON.stringify(raw));
    };
    const now = new Date("2026-10-05T00:00:00Z");
    const first = await loadPricingCatalog({ cachePath: path, now, fetcher });
    assert.equal(first.source, "catalog");
    assert.equal(calls, 1);
    assert.equal(JSON.parse(await readFile(path)).fetchedAt, now.toISOString());
    await loadPricingCatalog({ cachePath: path, now, fetcher });
    assert.equal(calls, 1);
    await loadPricingCatalog({ cachePath: path, now, fetcher, refresh: true });
    assert.equal(calls, 2);
    const never = async () => {
      throw new Error("offline fetch must not happen");
    };
    const stale = await loadPricingCatalog({
      cachePath: path,
      now: new Date("2026-11-01"),
      offline: true,
      fetcher: never,
    });
    assert.equal(stale.source, "stale-cache");
    const failed = await loadPricingCatalog({
      cachePath: path,
      now,
      refresh: true,
      fetcher: async () => {
        throw new Error("network down");
      },
    });
    assert.equal(failed.source, "stale-cache");
    await writeFile(path, "not json");
    const fallback = await loadPricingCatalog({ cachePath: path, offline: true, fetcher: never });
    assert.equal(fallback.source, "fallback");
    assert.ok(fallback.models["openai/gpt-5.3-codex"]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
test("cost estimates account for cache, reasoning, and context tiers", () => {
  const catalog = { source: "catalog", models: parseCatalog(raw) };
  assert.ok(Math.abs(priceUsage(record, catalog).estimatedCost - 0.000354) < 1e-12);
  assert.ok(
    Math.abs(priceUsage({ ...record, input: 200 }, catalog).estimatedCost - 0.001108) < 1e-12,
  );
});
test("unknown pricing and missing billed usage stay unavailable, known free usage is zero", () => {
  const catalog = { source: "catalog", models: parseCatalog(raw) };
  const unknown = priceUsage({ ...record, model: "unknown-model" }, catalog);
  assert.equal(unknown.estimatedCost, null);
  assert.equal(unknown.billedCost, null);
  const summary = emptyCost(catalog);
  addCost(summary, unknown);
  assert.equal(summary.estimatedCost, null);
  assert.equal(summary.unpricedRequests, 1);
  addCost(summary, priceUsage({ ...record, billedCost: 0 }, catalog));
  assert.equal(summary.billedCost, 0);
  assert.equal(summary.requests, 2);
  assert.equal(
    priceUsage(record, {
      source: "catalog",
      models: { "openai/test-model": { input: 0, output: 0, cacheRead: 0 } },
    }).estimatedCost,
    0,
  );
});
test("bundled prices have a dated source and large-context rates", async () => {
  const catalog = await loadPricingCatalog({
    offline: true,
    cachePath: "/nonexistent/ragereport-price-test",
  });
  assert.ok(catalog.fetchedAt);
  assert.equal(
    priceUsage(
      { ...record, model: "gpt-5.5", input: 272000, output: 0, reasoning: 0, cacheRead: 0 },
      catalog,
    ).estimatedCost,
    2.72,
  );
});
