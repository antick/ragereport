import type { DatabaseSync } from "node:sqlite";
import type { Message, ReaderContext, UsageRecord } from "../types.js";
import { LIMITS } from "../config/constants.js";
import { contentText, first, json, object, string } from "../utils/value.js";
import { timestamp } from "../utils/format.js";
import { walk } from "./files.js";
import { columns, dbWarning, identifier, openDatabase, tables } from "./sqlite.js";
import { usageFrom } from "./tokens.js";

const KEYS = [
  "bubbleId:",
  "composerData:",
  "composer.composerData",
  "aiService.prompts",
  "aiService.generations",
  "workbench.panel.composerChatViewPane.",
];
function modelName(value: unknown): string | undefined {
  const r = object(value);
  const direct = string(first(r, ["model", "modelName", "modelId", "modelID"]));
  if (direct) return direct;
  for (const nested of [r.modelInfo, r.modelConfig]) {
    const info = object(nested);
    const model = string(first(info, ["modelName", "modelId", "id", "name"]));
    if (model && model !== "default") return model;
    if (Array.isArray(info.selectedModels))
      for (const selected of info.selectedModels) {
        const name = string(first(object(selected), ["modelName", "modelId", "id", "name"]));
        if (name) return name;
      }
  }
  return undefined;
}
export async function* readCursor(
  path: string,
  context: ReaderContext,
): AsyncGenerator<Message | UsageRecord> {
  for await (const file of walk(path, [".vscdb", ".db", ".sqlite"], context, "cursor")) {
    context.onProgress?.({ type: "file", agent: "cursor" });
    let db: DatabaseSync | undefined;
    try {
      db = await openDatabase(file);
      const available = tables(db).filter(
        (table) =>
          ["ItemTable", "cursorDiskKV"].includes(table) &&
          columns(db!, table).includes("key") &&
          columns(db!, table).includes("value"),
      );
      if (!available.length) throw new Error("Unsupported Cursor key/value schema");
      const models = new Map<string, string>();
      if (context.usage)
        for (const table of available)
          for (const row of prefixRows(db, table, ["composerData:"])) {
            const key = string(row.key) ?? "";
            if (!key.startsWith("composerData:")) continue;
            const data = object(json(row.value));
            const model = modelName(data);
            if (model) models.set(string(data.composerId) ?? key.split(":")[1] ?? key, model);
          }
      for (const table of available)
        for (const row of prefixRows(db, table, KEYS, context)) {
          const key = string(row.key) ?? "";
          if (!KEYS.some((prefix) => key.startsWith(prefix))) continue;
          const value = json(row.value);
          const session = key.split(":")[1] ?? file;
          if (key.startsWith("bubbleId:")) {
            yield* cursorBubble(value, session, key.split(":").slice(2).join(":"), models, context);
          } else {
            yield* authoredObjects(value, session, 0, key.startsWith("aiService."));
          }
        }
      context.diagnostics.push({
        agent: "cursor",
        path: file,
        status: "read",
        detail: "Read Cursor state database",
      });
    } catch (error) {
      dbWarning("cursor", file, context, error);
    } finally {
      db?.close();
    }
  }
}
function* prefixRows(
  db: DatabaseSync,
  table: string,
  prefixes: string[],
  context?: ReaderContext,
): Generator<Record<string, unknown>> {
  const excluded =
    context?.roles?.length === 1 && !context.usage
      ? context.roles[0] === "user"
        ? 2
        : 1
      : undefined;
  const selection = excluded
    ? `CASE WHEN key >= ? AND key < ? AND CASE WHEN json_valid(CAST(value AS TEXT)) THEN json_extract(CAST(value AS TEXT), '$.type') ELSE NULL END = ${excluded} THEN NULL ELSE value END`
    : "value";
  const query = `SELECT key, ${selection} AS value FROM ${identifier(table)} WHERE ${prefixes.map(() => "(key >= ? AND key < ?)").join(" OR ")}`;
  const parameters = [
    ...(excluded ? [KEYS[0]!, `${KEYS[0]}\uffff`] : []),
    ...prefixes.flatMap((prefix) => [prefix, `${prefix}\uffff`]),
  ];
  for (const row of db.prepare(query).iterate(...parameters)) {
    if (row.value !== null) yield row;
  }
}
function* cursorBubble(
  value: unknown,
  session: string,
  id: string,
  models: Map<string, string>,
  context: ReaderContext,
): Generator<Message | UsageRecord> {
  const r = object(value);
  if (r.type !== 1 && r.type !== 2) return;
  const role = r.type === 1 ? "user" : "assistant";
  const text = contentText(r.text ?? r.richText ?? r.content);
  const date = timestamp(first(r, ["timestamp", "createdAt", "created_at", "time"]));
  if (text.trim())
    yield {
      agent: "cursor",
      role,
      session,
      id: string(r.bubbleId) ?? string(r.id) ?? id,
      text,
      timestamp: date,
    };
  if (role === "assistant" && context.usage) {
    const usage = usageFrom("cursor", session, r.tokenCount, {
      id,
      timestamp: date,
      model: modelName(r) ?? models.get(session),
      provider: string(r.provider),
    });
    if (usage) yield usage;
  }
}
function* authoredObjects(
  value: unknown,
  inheritedSession: string,
  depth: number,
  prompts: boolean,
): Generator<Message | UsageRecord> {
  if (depth > LIMITS.depth) return;
  if (Array.isArray(value)) {
    for (const child of value) yield* authoredObjects(child, inheritedSession, depth + 1, prompts);
    return;
  }
  if (typeof value === "string" && prompts) {
    if (value.trim())
      yield { agent: "cursor", session: inheritedSession, role: "user", text: value };
    return;
  }
  const r = object(value);
  const session =
    string(first(r, ["composerId", "sessionId", "conversationId"])) ?? inheritedSession;
  const actor = first(r, ["role", "speaker", "sender", "author", "source", "from", "type", "kind"]);
  const rawRole = (string(actor) ?? string(object(actor).role) ?? string(object(actor).type) ?? "")
    .toLowerCase()
    .replace(/[^a-z]/gu, "");
  const role = ["user", "human", "usermessage"].includes(rawRole)
    ? "user"
    : ["assistant", "ai", "assistantmessage"].includes(rawRole)
      ? "assistant"
      : undefined;
  const text = contentText(
    first(
      r,
      role
        ? ["text", "content", "message", "prompt", "input"]
        : ["prompt", "userPrompt", "originalPrompt", "currentPrompt", "query"],
    ),
  );
  if (text.trim() && (role || prompts))
    yield {
      agent: "cursor",
      session,
      role: role ?? "user",
      text,
      id: string(r.bubbleId) ?? string(r.id),
      timestamp: timestamp(first(r, ["timestamp", "createdAt", "time"])),
    };
  // Stop at an authored message; its content blocks are not separate messages.
  if (role) return;
  for (const child of Object.values(r))
    if (child && typeof child === "object")
      yield* authoredObjects(child, session, depth + 1, prompts);
}
