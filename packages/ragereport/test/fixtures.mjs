import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { DatabaseSync } from "node:sqlite";

export const DATE = "2026-10-04T12:00:00.000Z";
export const NOW = "2026-10-05T12:00:00.000Z";
export async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(value));
}
export async function writeLines(path, rows) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(
    path,
    `${rows.map((row) => (typeof row === "string" ? row : JSON.stringify(row))).join("\n")}\n`,
  );
}
export async function database(path, setup) {
  await mkdir(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  try {
    setup(db);
  } finally {
    db.close();
  }
}
export async function fixtureHome() {
  const home = await mkdtemp(join(tmpdir(), "ragereport-fixture-"));
  await populateHome(home);
  return home;
}
export async function populateHome(home) {
  await writeLines(join(home, ".claude/projects/project-one/session-claude.jsonl"), [
    {
      type: "user",
      uuid: "claude-user",
      timestamp: DATE,
      sessionId: "claude-session",
      cwd: "/private/projects/project-one",
      message: { role: "user", content: "fuck, please fix it. thanks" },
    },
    {
      type: "assistant",
      timestamp: DATE,
      requestId: "claude-request",
      message: {
        id: "claude-assistant",
        role: "assistant",
        model: "claude-sonnet-4-6",
        content: [
          { type: "text", text: "You're absolutely right. The key insight is load-bearing." },
        ],
        usage: {
          input_tokens: 100,
          output_tokens: 20,
          cache_read_input_tokens: 30,
          cache_creation_input_tokens: 10,
        },
      },
    },
  ]);
  await writeLines(join(home, ".codex/sessions/2026/10/04/rollout-codex.jsonl"), [
    {
      type: "session_meta",
      timestamp: DATE,
      payload: { id: "codex-session", cwd: "/private/projects/project-two" },
    },
    { type: "turn_context", timestamp: DATE, payload: { model: "gpt-5.3-codex" } },
    {
      type: "response_item",
      timestamp: DATE,
      payload: {
        type: "message",
        id: "codex-user",
        role: "user",
        content: [{ type: "input_text", text: "chutiya bug, shukriya for fixing it" }],
      },
    },
    {
      type: "response_item",
      timestamp: DATE,
      payload: {
        type: "message",
        id: "codex-assistant",
        role: "assistant",
        content: [{ type: "output_text", text: "Great question. Let us delve into it." }],
      },
    },
    {
      type: "event_msg",
      timestamp: DATE,
      payload: {
        type: "token_count",
        info: {
          last_token_usage: {
            input_tokens: 125,
            cached_input_tokens: 25,
            output_tokens: 15,
            reasoning_output_tokens: 5,
          },
          total_token_usage: {
            input_tokens: 125,
            cached_input_tokens: 25,
            output_tokens: 15,
            reasoning_output_tokens: 5,
          },
        },
      },
    },
  ]);
  await writeJson(join(home, ".local/share/amp/threads/amp-session.json"), {
    id: "amp-session",
    cwd: "/private/projects/project-one",
    messages: [
      { id: "amp-user", role: "user", content: "shit, please", timestamp: DATE },
      {
        id: "amp-assistant",
        role: "assistant",
        content: "An honest take: this is the key insight.",
        timestamp: DATE,
      },
    ],
    usageLedger: {
      entries: [
        {
          id: "amp-request",
          model: "gpt-4o",
          provider: "openai",
          timestamp: DATE,
          usage: { inputTokens: 100, outputTokens: 20 },
          cost: 0.002,
        },
      ],
    },
  });
  await writeLines(join(home, ".pi/agent/sessions/project-two/pi-session.jsonl"), [
    { type: "session", id: "pi-session", cwd: "/private/projects/project-two" },
    {
      type: "message",
      id: "pi-user",
      timestamp: DATE,
      message: { role: "user", content: "bhosdike, kripya correct this" },
    },
    {
      type: "message",
      id: "pi-assistant",
      timestamp: DATE,
      message: {
        role: "assistant",
        content: [{ type: "text", text: "The precise mechanism works without ceremony." }],
        provider: "openrouter",
        responseModel: "openai/gpt-4o-mini",
        usage: { input: 100, output: 20, cacheRead: 40 },
      },
    },
  ]);
  await writeJson(join(home, ".cline/data/tasks/cline-session/api_conversation_history.json"), [
    { role: "user", content: "luxx.wtf is our domain, thanks", ts: Date.parse(DATE) },
    { role: "assistant", content: "The key insight is simple.", ts: Date.parse(DATE) },
  ]);
  await database(join(home, ".local/share/opencode/opencode.db"), (db) => {
    db.exec(
      "CREATE TABLE message(id TEXT, session_id TEXT, time_created INTEGER, data TEXT); CREATE TABLE part(id TEXT, message_id TEXT, time_created INTEGER, data TEXT)",
    );
    const insert = db.prepare("INSERT INTO message VALUES (?, ?, ?, ?)");
    insert.run("open-user", "open-session", Date.parse(DATE), JSON.stringify({ role: "user" }));
    insert.run(
      "open-assistant",
      "open-session",
      Date.parse(DATE),
      JSON.stringify({
        role: "assistant",
        modelID: "claude-sonnet-4-6",
        providerID: "anthropic",
        tokens: { input: 100, output: 20, reasoning: 5, cache: { read: 30, write: 10 } },
        cost: 0.001,
      }),
    );
    db.prepare("INSERT INTO part VALUES (?, ?, ?, ?)").run(
      "p1",
      "open-user",
      Date.parse(DATE),
      JSON.stringify({ type: "text", text: "madarchod failure, dhanyavaad for helping" }),
    );
    db.prepare("INSERT INTO part VALUES (?, ?, ?, ?)").run(
      "p2",
      "open-assistant",
      Date.parse(DATE),
      JSON.stringify({ type: "text", text: "You're absolutely right, an honest assessment." }),
    );
  });
  await database(join(home, ".config/Cursor/User/globalStorage/state.vscdb"), (db) => {
    db.exec("CREATE TABLE cursorDiskKV(key TEXT, value BLOB)");
    const insert = db.prepare("INSERT INTO cursorDiskKV VALUES (?, ?)");
    insert.run(
      "composerData:cursor-session",
      Buffer.from(
        JSON.stringify({ composerId: "cursor-session", modelConfig: { modelName: "gpt-4o" } }),
      ),
    );
    insert.run(
      "bubbleId:cursor-session:cursor-user",
      Buffer.from(
        JSON.stringify({ type: 1, text: "behenchod, meherbani fix this", createdAt: DATE }),
      ),
    );
    insert.run(
      "bubbleId:cursor-session:cursor-assistant",
      Buffer.from(
        JSON.stringify({
          type: 2,
          text: "The precise mechanism earns its keep.",
          createdAt: DATE,
          tokenCount: {
            inputTokens: 100,
            outputTokens: 20,
            reasoningTokens: 5,
            cacheReadTokens: 10,
          },
        }),
      ),
    );
    insert.run(
      "unrelated.application.settings",
      Buffer.from(JSON.stringify({ role: "user", content: "fuck" })),
    );
  });
  await database(join(home, ".t3/userdata/state.sqlite"), (db) => {
    db.exec(
      "CREATE TABLE projection_thread_messages(thread_id TEXT, message_id TEXT, role TEXT, text TEXT, created_at TEXT); CREATE TABLE projection_threads(thread_id TEXT, model_selection_json TEXT); CREATE TABLE projection_thread_sessions(thread_id TEXT, provider_name TEXT, provider_session_id TEXT); CREATE TABLE orchestration_events(event_id TEXT, stream_id TEXT, event_type TEXT, occurred_at TEXT, payload_json TEXT, sequence INTEGER)",
    );
    db.prepare("INSERT INTO projection_threads VALUES (?, ?)").run(
      "t3-session",
      JSON.stringify({ model: "gpt-5.3-codex", provider: "codex" }),
    );
    db.prepare("INSERT INTO projection_thread_sessions VALUES (?, ?, ?)").run(
      "t3-session",
      "codex",
      "t3-native-session",
    );
    db.prepare("INSERT INTO projection_thread_messages VALUES (?, ?, ?, ?, ?)").run(
      "t3-session",
      "t3-user",
      "user",
      "fuuuuck, please help",
      DATE,
    );
    db.prepare("INSERT INTO projection_thread_messages VALUES (?, ?, ?, ?, ?)").run(
      "t3-session",
      "t3-assistant",
      "assistant",
      "The architectural seam keeps things honest.",
      DATE,
    );
    db.prepare("INSERT INTO orchestration_events VALUES (?, ?, ?, ?, ?, ?)").run(
      "t3-event",
      "t3-session",
      "thread.activity-appended",
      DATE,
      JSON.stringify({
        threadId: "t3-session",
        activity: {
          kind: "context-window.updated",
          turnId: "t3-turn",
          createdAt: DATE,
          payload: {
            lastInputTokens: 120,
            lastCachedInputTokens: 20,
            lastOutputTokens: 25,
            lastReasoningOutputTokens: 5,
          },
        },
      }),
      1,
    );
  });
  await writeJson(join(home, ".local/share/zed/conversations/zed-session.json"), {
    messages: [
      { id: "zed-user", role: "user", content: "damn bug, please fix", timestamp: DATE },
      {
        id: "zed-assistant",
        role: "assistant",
        content: "A belt-and-suspenders fix.",
        timestamp: DATE,
      },
    ],
  });
}
