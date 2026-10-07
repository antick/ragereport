import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  readHistories,
  readerContext,
  priceUsage,
  parseTokens,
  buildReport,
  DEFAULT_CONFIG,
  renderHtml,
} from "../dist/index.js";
import { DATE, writeLines, writeJson } from "./fixtures.mjs";

async function fixture(t) {
  const home = await mkdtemp(join(tmpdir(), "ragereport-usage-"));
  t.after(() => rm(home, { recursive: true, force: true }));
  return home;
}

const catalog = {
  source: "catalog",
  models: { "openai/test": { input: 2, output: 10, cacheRead: 0.2 } },
};

test("Pi output includes reasoning while its input excludes cached tokens", async (t) => {
  const path = join(await fixture(t), "pi.jsonl");
  await writeLines(path, [
    {
      type: "message",
      id: "response",
      message: {
        role: "assistant",
        model: "test",
        provider: "openai",
        usage: { input: 100, output: 30, reasoning: 10, cacheRead: 50, cacheWrite: 5 },
      },
    },
  ]);
  const { usage } = await readHistories(readerContext({ paths: { pi: [path] } }), "pi");
  assert.deepEqual(
    parseTokens({ input: 100, output: 30, reasoning: 10, cacheRead: 50 }, { output: true }),
    { input: 100, output: 20, reasoning: 10, cacheRead: 50, cacheWrite: 0 },
  );
  assert.equal(usage[0].input, 100);
  assert.equal(usage[0].cacheWrite, 5);
  assert.equal(usage[0].output, 20);
  assert.equal(priceUsage(usage[0], catalog).estimatedCost, 0.00052);
});

test("Amp preserves inner ledger charges and distinguishes missing counters from explicit zero", async (t) => {
  const path = join(await fixture(t), "amp.json");
  await writeJson(path, {
    id: "amp",
    messages: [],
    usageLedger: {
      entries: [
        { id: "charge-only", model: "test", provider: "openai", usage: { costUSD: 3 } },
        {
          id: "zero",
          model: "test",
          provider: "openai",
          usage: { inputTokens: 0, outputTokens: 0, costUSD: 0 },
        },
        {
          id: "partial",
          model: "test",
          provider: "openai",
          usage: { inputTokens: 20, costUSD: 1 },
        },
      ],
    },
  });
  const { usage } = await readHistories(readerContext({ paths: { amp: [path] } }), "amp");
  assert.equal(usage.length, 3);
  assert.equal(usage[0].billedCost, 3);
  assert.equal(usage[0].tokensAvailable, false);
  assert.equal(priceUsage(usage[0], catalog).estimatedCost, null);
  assert.equal(priceUsage(usage[1], catalog).estimatedCost, 0);
  assert.equal(usage[1].billedCost, 0);
  assert.equal(priceUsage(usage[2], catalog).estimatedCost, null);
});

test("Codex recognizes token events when info precedes type beyond the fast header", async (t) => {
  const path = join(await fixture(t), "codex.jsonl");
  await writeLines(path, [
    {
      type: "event_msg",
      timestamp: DATE,
      payload: {
        info: {
          padding: "x".repeat(3000),
          last_token_usage: { input_tokens: 100, output_tokens: 10 },
        },
        type: "token_count",
      },
    },
  ]);
  const { usage } = await readHistories(readerContext({ paths: { codex: [path] } }), "codex");
  assert.equal(usage.length, 1);
  assert.equal(usage[0].input, 100);
});

test("Claude carries authored cwd forward and hides encoded directory fallbacks in shared reports", async (t) => {
  const home = await fixture(t);
  const path = join(home, "-Users-alice-private-client", "session.jsonl");
  const rows = [
    {
      type: "user",
      uuid: "user",
      timestamp: DATE,
      cwd: "/Users/alice/private-client",
      message: { role: "user", content: "please" },
    },
    {
      type: "assistant",
      uuid: "assistant",
      timestamp: DATE,
      message: { role: "assistant", content: "thanks" },
    },
  ];
  await writeLines(path, rows);
  const context = readerContext({ paths: { claude: [path] } });
  const data = await readHistories(context, "claude");
  assert.ok(data.messages.every((message) => message.project === rows[0].cwd));
  delete rows[0].cwd;
  await writeLines(path, rows);
  const fallback = await readHistories(context, "claude");
  const report = await buildReport(
    fallback,
    {
      command: "scan",
      config: DEFAULT_CONFIG,
      offline: true,
    },
    catalog,
  );
  const html = renderHtml(report);
  assert.ok(!html.includes("-Users-alice-private-client"));
  assert.ok(html.includes("Unknown project"));
});
