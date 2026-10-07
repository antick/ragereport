import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readHistories, readerContext } from "../dist/index.js";
import { writeLines, DATE } from "./fixtures.mjs";

test("language scans skip decoding large irrelevant native records", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ragereport-fast-read-"));
  const marker = "UNNEEDED_TOOL_PAYLOAD";
  const large = marker + "x".repeat(1024 * 1024);
  const path = join(directory, "history.jsonl");
  await writeLines(path, [
    { type: "session_meta", timestamp: DATE, payload: { id: "fast" } },
    { type: "response_item", payload: { type: "function_call_output", output: large } },
    { type: "event_msg", payload: { type: "token_count", unrelated: large } },
    {
      type: "response_item",
      timestamp: DATE,
      payload: {
        type: "message",
        role: "assistant",
        content: [{ type: "output_text", text: large }],
      },
    },
    {
      type: "response_item",
      timestamp: DATE,
      payload: {
        type: "message",
        role: "user",
        content: [{ type: "input_text", text: "wtf please" }],
      },
    },
  ]);
  const parse = JSON.parse;
  let unwantedDecodes = 0;
  JSON.parse = (value, ...args) => {
    if (typeof value === "string" && value.includes(marker)) unwantedDecodes++;
    return parse(value, ...args);
  };
  try {
    const result = await readHistories(
      readerContext({ paths: { codex: [path] }, usage: false, roles: ["user"] }),
      "codex",
    );
    assert.equal(result.messages.length, 1);
    assert.equal(result.messages[0].text, "wtf please");
    assert.equal(unwantedDecodes, 0, "Tool/assistant payloads were decoded during a user scan");
  } finally {
    JSON.parse = parse;
    await rm(directory, { recursive: true, force: true });
  }
});

test("header shortcuts preserve unusual key order, mixed content, and UTF-8 chunk boundaries", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ragereport-header-"));
  const path = join(directory, "claude.jsonl");
  try {
    await writeLines(path, [
      {
        message: { content: [{ type: "text", role: "assistant", text: "thanks" }], role: "user" },
        type: "user",
        timestamp: DATE,
      },
      {
        type: "user",
        timestamp: DATE,
        message: {
          role: "user",
          content: [
            { type: "tool_result", content: "x".repeat(1024 * 1024) },
            { type: "text", text: "chutiya shukriya 🥵" },
          ],
        },
      },
      {
        type: "assistant",
        message: { role: "assistant", content: [{ type: "text", text: "skip this" }] },
      },
    ]);
    const events = [];
    const result = await readHistories(
      readerContext({
        paths: { claude: [path] },
        roles: ["user"],
        usage: false,
        onProgress: (event) => events.push(event),
      }),
      "claude",
    );
    assert.deepEqual(
      result.messages.map((message) => message.text),
      ["thanks", "chutiya shukriya 🥵"],
    );
    assert.ok(events.some((event) => event.type === "bytes"));
    assert.equal(
      events
        .filter((event) => event.type === "records")
        .reduce((sum, event) => sum + event.messages, 0),
      2,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
