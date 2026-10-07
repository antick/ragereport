import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { zstdCompressSync } from "node:zlib";
import { readHistories, readerContext, deduplicate } from "../dist/index.js";
import { database, DATE } from "./fixtures.mjs";

async function fixture(t) {
  const home = await mkdtemp(join(tmpdir(), "ragereport-native-"));
  t.after(() => rm(home, { recursive: true, force: true }));
  return join(home, "history.db");
}

test("Zed reads JSON and zstd native threads without counting tool, mention, or thinking content", async (t) => {
  const path = await fixture(t);
  const thread = {
    version: "0.3.0",
    updated_at: DATE,
    messages: [
      {
        User: {
          id: "u1",
          content: [
            { Text: "please fix" },
            { Mention: { content: "fuck tool context" } },
            { Image: {} },
          ],
        },
      },
      {
        Agent: {
          content: [
            { Text: "The key insight." },
            { Thinking: { text: "hidden" } },
            { ToolUse: { input: "hidden" } },
          ],
          tool_results: { tool: "hidden" },
        },
      },
      "Resume",
      { Compaction: { Summary: "hidden" } },
    ],
  };
  await database(path, (db) => {
    db.exec(
      "CREATE TABLE threads(id TEXT, summary TEXT, updated_at TEXT, data_type TEXT, data BLOB)",
    );
    const insert = db.prepare("INSERT INTO threads VALUES (?, ?, ?, ?, ?)");
    insert.run("bad", "bad", DATE, "zstd", Buffer.from("corrupt"));
    for (const type of ["json", "zstd"])
      insert.run(
        type,
        "thread",
        DATE,
        type,
        type === "json"
          ? Buffer.from(JSON.stringify(thread))
          : zstdCompressSync(Buffer.from(JSON.stringify(thread))),
      );
  });
  const before = await readFile(path);
  const context = readerContext({ paths: { zed: [path] } });
  const data = await readHistories(context, "zed");
  assert.deepEqual(
    data.messages.map((message) => message.text),
    ["please fix", "The key insight.", "please fix", "The key insight."],
  );
  assert.ok(data.messages.every((message) => message.timestamp === undefined));
  assert.ok(context.diagnostics.some((diagnostic) => diagnostic.status === "warning"));
  assert.deepEqual(await readFile(path), before);
});

async function t3Fixture(t, events) {
  const path = await fixture(t);
  await database(path, (db) => {
    db.exec(
      "CREATE TABLE projection_threads(thread_id TEXT, model_selection_json TEXT); CREATE TABLE projection_thread_sessions(thread_id TEXT, provider_name TEXT, provider_session_id TEXT); CREATE TABLE orchestration_events(event_id TEXT, stream_id TEXT, event_type TEXT, occurred_at TEXT, payload_json TEXT, sequence INTEGER)",
    );
    db.prepare("INSERT INTO projection_threads VALUES (?, ?)").run(
      "thread",
      JSON.stringify({ model: "gpt-latest", provider: "codex" }),
    );
    db.prepare("INSERT INTO projection_thread_sessions VALUES (?, ?, ?)").run(
      "thread",
      "codex",
      "native",
    );
    const insert = db.prepare("INSERT INTO orchestration_events VALUES (?, ?, ?, ?, ?, ?)");
    for (const [index, event] of events.entries())
      insert.run(
        `event-${index}`,
        "thread",
        event.type ?? "thread.activity-appended",
        DATE,
        JSON.stringify({ threadId: "thread", ...event.payload }),
        index,
      );
  });
  return readHistories(readerContext({ paths: { t3code: [path] } }), "t3code");
}

function snapshot(payload, turnId = "turn") {
  return {
    payload: { activity: { kind: "context-window.updated", turnId, createdAt: DATE, payload } },
  };
}

test("T3 preserves multiple last-request records per turn and skips repeated cumulative snapshots", async (t) => {
  const first = {
    lastInputTokens: 100,
    lastOutputTokens: 30,
    lastCachedInputTokens: 20,
    lastReasoningOutputTokens: 10,
    totalProcessedTokens: 130,
  };
  const second = { ...first, lastInputTokens: 200, totalProcessedTokens: 360 };
  const data = await t3Fixture(t, [snapshot(first), snapshot(first), snapshot(second)]);
  const unique = deduplicate(data.usage).records;
  assert.equal(unique.length, 2);
  assert.deepEqual(
    unique.map((usage) => usage.input),
    [80, 180],
  );
  assert.ok(unique.every((usage) => usage.model === undefined));
  assert.equal(
    unique.reduce((sum, usage) => sum + usage.output + usage.reasoning, 0),
    60,
  );
});

test("T3 reconstructs historical model changes and uses cumulative deltas rather than whole totals", async (t) => {
  const data = await t3Fixture(t, [
    {
      type: "thread.created",
      payload: { modelSelection: { model: "gpt-old", provider: "codex" } },
    },
    snapshot({
      inputTokens: 100,
      outputTokens: 30,
      cachedInputTokens: 20,
      reasoningOutputTokens: 10,
      lastInputTokens: 100,
      lastOutputTokens: 30,
    }),
    snapshot({
      inputTokens: 300,
      outputTokens: 60,
      cachedInputTokens: 40,
      reasoningOutputTokens: 20,
      lastInputTokens: 200,
      lastOutputTokens: 30,
    }),
    {
      type: "thread.meta-updated",
      payload: { modelSelection: { model: "gpt-new", provider: "codex" } },
    },
    snapshot({ lastInputTokens: 50, lastOutputTokens: 5 }, "next-turn"),
  ]);
  assert.deepEqual(
    data.usage.map((usage) => usage.model),
    ["gpt-old", "gpt-old", "gpt-new"],
  );
  assert.deepEqual(
    data.usage.map((usage) => usage.input),
    [80, 180, 50],
  );
  assert.equal(deduplicate(data.usage).records.length, 3);
});

test("T3 does not call an active Claude context snapshot a complete cost record", async (t) => {
  const data = await t3Fixture(t, [
    {
      type: "thread.created",
      payload: { modelSelection: { model: "claude-old", provider: "claude-code" } },
    },
    snapshot({ inputTokens: 100, outputTokens: 20, totalProcessedTokens: 1000 }),
  ]);
  assert.equal(data.usage[0].tokensAvailable, false);
  assert.equal(data.usage[0].model, "claude-old");
});
