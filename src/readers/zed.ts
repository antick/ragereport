import type { DatabaseSync } from "node:sqlite";
import type { Message, ReaderContext, UsageRecord } from "../types.js";
import { contentText, first, json, string } from "../utils/value.js";
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
      const table = tables(db).find(
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
