import { zstdDecompressSync } from "node:zlib";
import { LIMITS } from "../config/constants.js";
import type { DatabaseSync } from "node:sqlite";
import type { Message, ReaderContext, UsageRecord } from "../types.js";
import { contentText, errorMessage, first, json, object, string } from "../utils/value.js";
import { timestamp } from "../utils/format.js";
import { walk } from "./files.js";
import { columns, dbWarning, openDatabase, rows, tables } from "./sqlite.js";
import { readJsonHistory } from "./json.js";

export async function* readZed(
  path: string,
  context: ReaderContext,
): AsyncGenerator<Message | UsageRecord> {
  yield* readJsonHistory("zed", path, context);
  for await (const file of walk(path, [".db", ".sqlite"], context, "zed")) {
    let db: DatabaseSync | undefined;
    try {
      db = await openDatabase(file);
      const available = tables(db);
      const threadColumns = available.includes("threads") ? columns(db, "threads") : [];
      if (["id", "data_type", "data"].every((name) => threadColumns.includes(name))) {
        yield* readThreads(db, file, context);
      } else {
        const table = available.find(
          (t) => ["messages", "thread_messages"].includes(t) || t.includes("message"),
        );
        const names = table ? columns(db, table) : [];
        if (
          !table ||
          !names.includes("role") ||
          !names.some((c) => ["content", "text", "body"].includes(c))
        )
          throw new Error("Unsupported Zed message schema");
        for (const row of rows(db, table)) {
          if (row.role !== "user" && row.role !== "assistant") continue;
          const raw = first(row, ["content", "text", "body"]);
          const parsed = json(raw);
          const text = contentText(parsed ?? raw);
          if (text.trim())
            yield {
              agent: "zed",
              role: row.role,
              text,
              session: string(first(row, ["thread_id", "session_id"])) ?? file,
              id: string(row.id),
              timestamp: timestamp(first(row, ["timestamp", "created_at", "time_created"])),
            };
        }
      }
      context.diagnostics.push({
        agent: "zed",
        path: file,
        status: "read",
        detail: "Read Zed database",
      });
    } catch (error) {
      dbWarning("zed", file, context, error);
    } finally {
      db?.close();
    }
  }
}

function* readThreads(db: DatabaseSync, file: string, context: ReaderContext): Generator<Message> {
  for (const row of rows(db, "threads")) {
    try {
      if (!(row.data instanceof Uint8Array)) throw new Error("Missing thread data");
      if (row.data.byteLength > LIMITS.jsonBytes) throw new Error("Thread data exceeds size limit");
      const bytes =
        row.data_type === "zstd"
          ? zstdDecompressSync(row.data, { maxOutputLength: LIMITS.jsonBytes })
          : row.data_type === "json"
            ? row.data
            : undefined;
      if (!bytes) throw new Error("Unsupported thread encoding");
      const thread = object(json(bytes));
      if (!Array.isArray(thread.messages)) throw new Error("Missing thread messages");
      const session = string(row.id) ?? file;
      for (const [index, value] of thread.messages.entries()) {
        const message = object(value);
        const role = message.User ? "user" : message.Agent ? "assistant" : undefined;
        if (!role) continue;
        const body = object(message.User ?? message.Agent);
        // Only authored text; mentions, tools, thinking, and compaction context are excluded.
        const text = Array.isArray(body.content)
          ? body.content.flatMap((part) => string(object(part).Text) ?? []).join("\n")
          : "";
        if (text.trim())
          yield {
            agent: "zed",
            session,
            role,
            text,
            id: string(body.id) ?? `${session}:${index}`,
            // Native threads have a save date, but no individual message timestamps.
          };
      }
    } catch (error) {
      context.diagnostics.push({
        agent: "zed",
        path: file,
        status: "warning",
        detail: `Could not read Zed thread: ${errorMessage(error)}`,
      });
    }
  }
}
