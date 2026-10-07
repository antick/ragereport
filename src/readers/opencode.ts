import type { DatabaseSync } from "node:sqlite";
import { sep } from "node:path";
import type { Message, ReaderContext, UsageRecord } from "../types.js";
import { contentText, json, object, string } from "../utils/value.js";
import { timestamp } from "../utils/format.js";
import { walk, readJson } from "./files.js";
import { columns, dbWarning, identifier, openDatabase, rows, tables } from "./sqlite.js";
import { usageFrom } from "./tokens.js";
import { legacyPartFiles } from "./legacy-parts.js";

export async function* readOpenCode(
  path: string,
  context: ReaderContext,
): AsyncGenerator<Message | UsageRecord> {
  context = { ...context, historyRoot: context.historyRoot ?? path };
  for await (const file of walk(path, [".db", ".sqlite", ".json"], context, "opencode")) {
    if (file.endsWith(".json")) {
      yield* readLegacy(file, context);
      continue;
    }
    let db: DatabaseSync | undefined;
    try {
      db = await openDatabase(file);
      if (!tables(db).includes("message") || !columns(db, "message").includes("data"))
        throw new Error("Unsupported OpenCode message schema");
      const partColumns = tables(db).includes("part") ? columns(db, "part") : [];
      const parts =
        partColumns.includes("message_id") && partColumns.includes("data")
          ? db.prepare(
              `SELECT data FROM part WHERE message_id = ?${partColumns.includes("time_created") ? ` ORDER BY ${identifier("time_created")}` : ""}`,
            )
          : undefined;
      for (const row of rows(
        db,
        "message",
        columns(db, "message").includes("time_created") ? "time_created" : undefined,
      )) {
        const data = object(json(row.data));
        const role = data.role;
        const session = string(row.session_id) ?? string(data.sessionID) ?? file;
        const date = timestamp(row.time_created ?? object(data.time).created);
        const id = string(row.id);
        if (role === "user" || role === "assistant") {
          const text =
            parts && id
              ? parts
                  .all(id)
                  .flatMap((part) => {
                    const p = object(json(part.data));
                    return p.type === "text" && string(p.text) ? [p.text as string] : [];
                  })
                  .join("\n")
              : contentText(data.content);
          if (text.trim()) yield { agent: "opencode", role, session, id, timestamp: date, text };
        }
        if (context.usage && role === "assistant") {
          const model = object(data.model);
          const usage = usageFrom("opencode", session, data.tokens, {
            id,
            timestamp: date,
            model: string(data.modelID) ?? string(model.modelID),
            provider: string(data.providerID) ?? string(model.providerID),
            billedCost: typeof data.cost === "number" ? data.cost : undefined,
          });
          if (usage) yield usage;
        }
      }
      context.diagnostics.push({
        agent: "opencode",
        path: file,
        status: "read",
        detail: "Read OpenCode database",
      });
    } catch (error) {
      dbWarning("opencode", file, context, error);
    } finally {
      db?.close();
    }
  }
}
async function* readLegacy(
  file: string,
  context: ReaderContext,
): AsyncGenerator<Message | UsageRecord> {
  // Older OpenCode installations split message metadata and parts into JSON files.
  const marker = file.lastIndexOf(`${sep}message${sep}`);
  if (marker < 0) return;
  const data = object(await readJson(file, context, "opencode"));
  const role = data.role;
  if (role !== "user" && role !== "assistant") return;
  const id = string(data.id);
  const session = string(data.sessionID) ?? file;
  const date = timestamp(object(data.time).created);
  let text = contentText(data.content);
  if (id) {
    const root = file.slice(0, marker) || sep;
    for await (const partFile of legacyPartFiles(root, id, file, context)) {
      const part = object(await readJson(partFile, context, "opencode"));
      if (part.type === "text" && string(part.text)) text += `${text ? "\n" : ""}${part.text}`;
    }
  }
  if (text.trim()) yield { agent: "opencode", session, role, text, timestamp: date, id };
  if (context.usage && role === "assistant") {
    const usage = usageFrom("opencode", session, data.tokens, {
      id,
      timestamp: date,
      model: string(data.modelID),
      provider: string(data.providerID),
      billedCost: typeof data.cost === "number" ? data.cost : undefined,
    });
    if (usage) yield usage;
  }
}
