import type { DatabaseSync } from "node:sqlite";
import type { AgentName, Message, ReaderContext, UsageRecord } from "../types.js";
import { first, json, object, string } from "../utils/value.js";
import { timestamp } from "../utils/format.js";
import { walk } from "./files.js";
import { columns, dbWarning, openDatabase, rows, tables } from "./sqlite.js";
import { parseTokens, hasTokens } from "./tokens.js";

interface Thread {
  model?: string;
  provider?: string;
  originAgent?: AgentName;
  originSession?: string;
}
function origin(provider: string | undefined, model?: string): AgentName | undefined {
  const name = provider?.toLowerCase() ?? "";
  if (name.includes("codex") || (!name && model?.startsWith("gpt-"))) return "codex";
  if (name.includes("claude") || name.includes("anthropic")) return "claude";
  if (name.includes("opencode")) return "opencode";
  if (name.includes("cursor")) return "cursor";
  return undefined;
}
function threadMap(db: DatabaseSync): Map<string, Thread> {
  const result = new Map<string, Thread>();
  const available = tables(db);
  for (const table of ["projection_threads", "projection_thread_sessions"]) {
    if (!available.includes(table)) continue;
    for (const row of rows(db, table)) {
      const id = string(row.thread_id);
      if (!id) continue;
      const existing = result.get(id) ?? {};
      const selected = object(json(row.model_selection_json));
      const provider =
        string(row.provider_name) ??
        string(selected.provider) ??
        string(selected.instanceId) ??
        existing.provider;
      const model = string(selected.model) ?? string(row.model) ?? existing.model;
      result.set(id, {
        model,
        provider,
        originAgent: origin(provider, model),
        originSession:
          string(first(row, ["provider_session_id", "provider_thread_id", "session_id"])) ??
          existing.originSession,
      });
    }
  }
  return result;
}
export async function* readT3Code(
  path: string,
  context: ReaderContext,
): AsyncGenerator<Message | UsageRecord> {
  for await (const file of walk(path, [".sqlite", ".db"], context, "t3code")) {
    let db: DatabaseSync | undefined;
    try {
      db = await openDatabase(file);
      const available = tables(db);
      if (
        !available.includes("projection_thread_messages") &&
        !available.includes("orchestration_events")
      )
        throw new Error("Unsupported T3 Code history schema");
      const threads = threadMap(db);
      if (available.includes("projection_thread_messages"))
        for (const row of rows(
          db,
          "projection_thread_messages",
          columns(db, "projection_thread_messages").includes("created_at")
            ? "created_at"
            : undefined,
        )) {
          const role = row.role;
          const text = string(row.text);
          const session = string(row.thread_id) ?? file;
          const info = threads.get(session);
          if (text && (role === "user" || role === "assistant"))
            yield {
              agent: "t3code",
              role,
              text,
              session,
              id: string(row.message_id),
              timestamp: timestamp(row.created_at),
              originAgent: info?.originAgent,
              originSession: info?.originSession,
            };
        }
      if (context.usage && available.includes("orchestration_events"))
        for (const row of rows(
          db,
          "orchestration_events",
          columns(db, "orchestration_events").includes("sequence") ? "sequence" : "occurred_at",
        )) {
          if (row.event_type !== "thread.activity-appended") continue;
          const payload = object(json(row.payload_json));
          const activity = object(payload.activity);
          if (activity.kind !== "context-window.updated") continue;
          const details = object(activity.payload);
          const session = string(payload.threadId) ?? string(row.stream_id) ?? file;
          const info = threads.get(session);
          const hasLast = Object.keys(details).some((key) => key.startsWith("last"));
          const source = hasLast
            ? {
                inputTokens: details.lastInputTokens ?? details.last_input_tokens,
                cachedInputTokens:
                  details.lastCachedInputTokens ?? details.last_cached_input_tokens,
                outputTokens: details.lastOutputTokens ?? details.last_output_tokens,
                reasoningOutputTokens:
                  details.lastReasoningOutputTokens ?? details.last_reasoning_output_tokens,
              }
            : details;
          const tokens = parseTokens(source, true);
          if (!hasTokens(tokens)) continue;
          yield {
            agent: "t3code",
            session,
            ...tokens,
            id: string(activity.turnId) ?? string(row.event_id),
            timestamp: timestamp(activity.createdAt ?? row.occurred_at),
            model: string(details.model) ?? info?.model,
            provider:
              string(details.provider) ??
              (info?.originAgent === "codex"
                ? "openai"
                : info?.originAgent === "claude"
                  ? "anthropic"
                  : undefined),
            originAgent: info?.originAgent,
            originSession: info?.originSession,
          };
        }
      context.diagnostics.push({
        agent: "t3code",
        path: file,
        status: "read",
        detail: "Read T3 Code message projections and usage events",
      });
    } catch (error) {
      dbWarning("t3code", file, context, error);
    } finally {
      db?.close();
    }
  }
}
