import { access, realpath } from "node:fs/promises";
import { homedir } from "node:os";
import type { AgentName, Reader, ReaderContext, ReaderResult, Diagnostic } from "../types.js";
import { AGENTS } from "../types.js";
import { readJsonl } from "./jsonl.js";
import { readJsonHistory } from "./json.js";
import { readCursor } from "./cursor.js";
import { readOpenCode } from "./opencode.js";
import { readT3Code } from "./t3code.js";
import { readZed } from "./zed.js";
import { sourcePaths } from "./paths.js";
import { errorMessage } from "../utils/value.js";
import { setImmediate } from "node:timers/promises";
import { LIMITS } from "../config/constants.js";

export function createReader(name: AgentName): Reader {
  if (!AGENTS.includes(name)) throw new Error(`Unknown agent: ${name}`);
  return {
    name,
    paths: (context) => sourcePaths(name, context),
    read: (path, context) => {
      if (name === "claude" || name === "codex" || name === "pi")
        return readJsonl(name, path, context);
      if (name === "cursor") return readCursor(path, context);
      if (name === "opencode") return readOpenCode(path, context);
      if (name === "t3code") return readT3Code(path, context);
      if (name === "zed") return readZed(path, context);
      return readJsonHistory(name, path, context);
    },
  };
}
export function allReaders(): Reader[] {
  return AGENTS.map(createReader);
}
export function readerContext(options: Partial<ReaderContext> = {}): ReaderContext {
  return {
    home: homedir(),
    env: process.env,
    platform: process.platform,
    diagnostics: [],
    usage: true,
    ...options,
  };
}
export async function discover(
  context: ReaderContext,
  agent?: AgentName,
): Promise<{ reader: Reader; path: string }[]> {
  const sources: { reader: Reader; path: string }[] = [];
  for (const reader of agent ? [createReader(agent)] : allReaders()) {
    const seen = new Set<string>();
    for (const path of reader.paths(context)) {
      try {
        await access(path);
        const resolved = await realpath(path);
        if (seen.has(resolved)) continue;
        seen.add(resolved);
        sources.push({ reader, path: resolved });
        context.diagnostics.push({
          agent: reader.name,
          path,
          status: "found",
          detail: "History location found",
        });
      } catch (error) {
        const missing = (error as NodeJS.ErrnoException).code === "ENOENT";
        context.diagnostics.push({
          agent: reader.name,
          path,
          status: missing ? "missing" : "skipped",
          detail: missing ? "No history at this location" : errorMessage(error),
        });
      }
    }
  }
  return sources;
}
export async function readHistories(
  context: ReaderContext,
  agent?: AgentName,
): Promise<ReaderResult> {
  const result: ReaderResult = { messages: [], usage: [] };
  let pendingMessages = 0;
  let pendingUsage = 0;
  const flush = () => {
    context.onProgress?.({ type: "records", messages: pendingMessages, usage: pendingUsage });
    pendingMessages = pendingUsage = 0;
  };
  for (const { reader, path } of await discover(context, agent)) {
    context.onProgress?.({ type: "source", agent: reader.name });
    try {
      for await (const record of reader.read(path, { ...context, historyRoot: path })) {
        if ("role" in record) {
          if (context.roles && !context.roles.includes(record.role)) continue;
          result.messages.push(record);
          pendingMessages++;
        } else {
          result.usage.push(record);
          pendingUsage++;
        }
        if (pendingMessages + pendingUsage >= LIMITS.recordBatch) {
          flush();
          await setImmediate();
        }
      }
    } catch (error) {
      context.diagnostics.push({
        agent: reader.name,
        path,
        status: "skipped",
        detail: errorMessage(error),
      });
    }
    flush();
  }
  return result;
}
export function diagnosticSummary(diagnostics: Diagnostic[], agent: AgentName): string {
  const records = diagnostics.filter((d) => d.agent === agent);
  const found = records.filter((d) => d.status === "found").length;
  const read = records.filter((d) => d.status === "read").length;
  const skipped = records.filter((d) => d.status === "skipped" || d.status === "warning").length;
  return `${found} locations · ${read} files read · ${skipped} warnings`;
}
