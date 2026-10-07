import { readdir, readFile, stat } from "node:fs/promises";
import { extname, join } from "node:path";
import { LIMITS } from "../config/constants.js";
import type { AgentName, ReaderContext } from "../types.js";
import { errorMessage } from "../utils/value.js";
import { lineBuffers, type LineCandidate } from "./jsonl-stream.js";

export async function* walk(
  path: string,
  extensions: string[],
  context: ReaderContext,
  agent: AgentName,
): AsyncGenerator<string> {
  let info;
  try {
    info = await stat(path);
  } catch (error) {
    context.diagnostics.push({ agent, path, status: "skipped", detail: errorMessage(error) });
    return;
  }
  if (info.isFile()) {
    if (extensions.includes(extname(path))) yield path;
    return;
  }
  if (!info.isDirectory()) return;
  try {
    for (const entry of (await readdir(path, { withFileTypes: true })).sort((a, b) =>
      a.name.localeCompare(b.name),
    )) {
      // Avoid following directory symlinks into loops or unrelated histories.
      if (entry.isSymbolicLink()) continue;
      const child = join(path, entry.name);
      if (entry.isDirectory()) yield* walk(child, extensions, context, agent);
      else if (entry.isFile() && extensions.includes(extname(entry.name))) yield child;
    }
  } catch (error) {
    context.diagnostics.push({ agent, path, status: "skipped", detail: errorMessage(error) });
  }
}
export async function* jsonLines(
  path: string,
  context: ReaderContext,
  agent: AgentName,
  candidate?: LineCandidate,
): AsyncGenerator<unknown> {
  context.onProgress?.({ type: "file", agent });
  let malformed = 0;
  try {
    for await (const buffer of lineBuffers(path, context, agent, candidate)) {
      const line = buffer.toString("utf8");
      if (!line.trim()) continue;
      if (candidate && !candidate(line, true)) continue;
      try {
        yield JSON.parse(line) as unknown;
      } catch {
        malformed++;
      }
    }
    context.diagnostics.push({ agent, path, status: "read", detail: "Read JSONL history" });
    if (malformed)
      context.diagnostics.push({
        agent,
        path,
        status: "warning",
        detail: `Skipped ${malformed} malformed JSONL rows`,
      });
  } catch (error) {
    context.diagnostics.push({ agent, path, status: "skipped", detail: errorMessage(error) });
  }
}
export async function readJson(
  path: string,
  context: ReaderContext,
  agent: AgentName,
): Promise<unknown> {
  try {
    context.onProgress?.({ type: "file", agent });
    if ((await stat(path)).size > LIMITS.jsonBytes)
      throw new Error("JSON file exceeds the reader size limit");
    const value: unknown = JSON.parse(await readFile(path, "utf8"));
    context.diagnostics.push({ agent, path, status: "read", detail: "Read JSON history" });
    return value;
  } catch (error) {
    context.diagnostics.push({ agent, path, status: "skipped", detail: errorMessage(error) });
    return undefined;
  }
}
