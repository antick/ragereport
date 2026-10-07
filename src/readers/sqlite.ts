import type { DatabaseSync } from "node:sqlite";
import type { AgentName, ReaderContext } from "../types.js";
import { SQLITE } from "../config/constants.js";
import { errorMessage, object, string } from "../utils/value.js";

export async function openDatabase(path: string): Promise<DatabaseSync> {
  const { DatabaseSync: Database } = await import("node:sqlite");
  return new Database(path, { readOnly: true, timeout: SQLITE.timeoutMs, allowExtension: false });
}
export function tables(db: DatabaseSync): string[] {
  return db
    .prepare("SELECT name FROM sqlite_master WHERE type='table'")
    .all()
    .flatMap((row) => string(row.name) ?? []);
}
export function identifier(name: string): string {
  return `"${name.replaceAll('"', '""')}"`;
}
export function columns(db: DatabaseSync, table: string): string[] {
  return db
    .prepare(`PRAGMA table_info(${identifier(table)})`)
    .all()
    .flatMap((row) => string(row.name) ?? []);
}
export function* rows(
  db: DatabaseSync,
  table: string,
  order?: string,
): Generator<Record<string, unknown>> {
  const query = `SELECT * FROM ${identifier(table)}${order ? ` ORDER BY ${identifier(order)}` : ""}`;
  for (const row of db.prepare(query).iterate()) yield object(row);
}
export function dbWarning(
  agent: AgentName,
  path: string,
  context: ReaderContext,
  error: unknown,
): void {
  context.diagnostics.push({
    agent,
    path,
    status: "skipped",
    detail: `Could not read SQLite history: ${errorMessage(error)}`,
  });
}
