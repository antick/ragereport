import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { AGENTS, readHistories, readerContext, parseTokens, deduplicate } from "../dist/index.js";
import { fixtureHome, DATE, writeLines, writeJson, database } from "./fixtures.mjs";
let home;
before(async () => {
  home = await fixtureHome();
});
after(async () => {
  await rm(home, { recursive: true, force: true });
});

for (const agent of AGENTS)
  test(`${agent} reads authored user and assistant prose from its native format`, async () => {
    const context = readerContext({ home, env: {}, platform: "linux" });
    const result = await readHistories(context, agent);
    assert.equal(result.messages.filter((m) => m.role === "user").length, 1);
    assert.equal(result.messages.filter((m) => m.role === "assistant").length, 1);
    assert.ok(result.messages.every((m) => m.timestamp === DATE));
    assert.ok(context.diagnostics.some((d) => d.status === "read"));
    if (!["cline", "zed"].includes(agent)) assert.equal(result.usage.length, 1);
  });
test("SQLite readers leave original databases unchanged", async () => {
  const path = join(home, ".local/share/opencode/opencode.db");
  const beforeBytes = await readFile(path);
  await readHistories(readerContext({ home, env: {}, platform: "linux" }), "opencode");
  assert.deepEqual(await readFile(path), beforeBytes);
});
test("Codex inclusive cache/reasoning counts are not charged twice", async () => {
  const result = await readHistories(readerContext({ home, env: {} }), "codex");
  assert.deepEqual(
    parseTokens(
      { input_tokens: 125, cached_input_tokens: 25, output_tokens: 15, reasoning_output_tokens: 5 },
      true,
    ),
    { input: 100, output: 10, reasoning: 5, cacheRead: 25, cacheWrite: 0 },
  );
  assert.equal(result.usage[0].input, 100);
  assert.equal(result.usage[0].output, 10);
});
test("cumulative Codex events use deltas, skip repeats, and skip environment injections", async () => {
  const path = join(home, "custom-codex/usage.jsonl");
  await writeLines(path, [
    { type: "session_meta", timestamp: DATE, payload: { id: "custom" } },
    {
      type: "response_item",
      timestamp: DATE,
      payload: {
        type: "message",
        role: "user",
        content: [{ type: "input_text", text: "<environment_context>shit</environment_context>" }],
      },
    },
    {
      type: "event_msg",
      timestamp: DATE,
      payload: {
        type: "token_count",
        info: { total_token_usage: { input_tokens: 100, output_tokens: 10 } },
      },
    },
    {
      type: "event_msg",
      timestamp: DATE,
      payload: {
        type: "token_count",
        info: { total_token_usage: { input_tokens: 100, output_tokens: 10 } },
      },
    },
    {
      type: "event_msg",
      timestamp: "2026-10-04T12:01:00Z",
      payload: {
        type: "token_count",
        info: { total_token_usage: { input_tokens: 150, output_tokens: 20 } },
      },
    },
    "{broken",
  ]);
  const context = readerContext({ home, env: {}, paths: { codex: [path] } });
  const data = await readHistories(context, "codex");
  assert.equal(data.messages.length, 0);
  assert.deepEqual(
    data.usage.map((u) => u.input),
    [100, 50],
  );
  assert.ok(context.diagnostics.some((d) => d.detail.includes("malformed")));
});
test("Cline standalone and Roo Code paths are both discovered", async () => {
  const path = join(
    home,
    ".config/Code/User/globalStorage/rooveterinaryinc.roo-cline/tasks/roo/api_conversation_history.json",
  );
  await writeJson(path, [{ role: "user", content: "thanks", timestamp: DATE }]);
  const data = await readHistories(readerContext({ home, env: {}, platform: "linux" }), "cline");
  assert.equal(data.messages.length, 3);
});
test("legacy OpenCode JSON parts are grouped into one message", async () => {
  const root = join(home, "legacy-open");
  await writeJson(join(root, "message/s1/m1.json"), {
    id: "m1",
    sessionID: "s1",
    role: "user",
    time: { created: Date.parse(DATE) },
  });
  await writeJson(join(root, "part/m1/p1.json"), { type: "text", text: "please" });
  await writeJson(join(root, "part/m1/p2.json"), { type: "text", text: "thanks" });
  const result = await readHistories(readerContext({ paths: { opencode: [root] } }), "opencode");
  assert.equal(result.messages.length, 1);
  assert.equal(result.messages[0].text, "please\nthanks");
});
test("Zed SQLite role/body schema is read with timestamps", async () => {
  const path = join(home, "zed-extra.db");
  await database(path, (db) => {
    db.exec(
      "CREATE TABLE thread_messages(id TEXT, thread_id TEXT, role TEXT, body TEXT, created_at TEXT)",
    );
    db.prepare("INSERT INTO thread_messages VALUES (?, ?, ?, ?, ?)").run(
      "zed-extra",
      "thread",
      "user",
      "wtf",
      DATE,
    );
  });
  const data = await readHistories(readerContext({ paths: { zed: [path] } }), "zed");
  assert.equal(data.messages[0].text, "wtf");
  assert.equal(data.messages[0].timestamp, DATE);
});
test("dedupe removes mirrors and streamed snapshots but keeps distinct user turns", () => {
  const message = {
    agent: "codex",
    session: "native",
    id: "a",
    role: "user",
    timestamp: DATE,
    text: "fuck",
  };
  const mirror = {
    ...message,
    agent: "t3code",
    session: "t3",
    id: "b",
    originAgent: "codex",
    originSession: "native",
  };
  assert.equal(deduplicate([mirror, message]).records.length, 1);
  assert.equal(
    deduplicate([message, { ...message, id: "different", timestamp: "2026-10-04T12:01:00.000Z" }])
      .records.length,
    2,
  );
  const streamed = deduplicate([
    { ...message, role: "assistant", text: "The key" },
    { ...message, role: "assistant", text: "The key insight." },
  ]);
  assert.equal(streamed.records[0].text, "The key insight.");
});
