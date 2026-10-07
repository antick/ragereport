import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { dirname, extname, join } from "node:path";
import { setImmediate } from "node:timers/promises";
import type {
  AnalysisOptions,
  Diagnostic,
  Message,
  Reader,
  ReaderContext,
  ReaderResult,
} from "../types.js";
import { discover } from "../readers/index.js";
import { walk } from "../readers/files.js";
import { LIMITS, SCAN_CACHE } from "../config/constants.js";
import { writePrivateFile } from "../utils/files.js";
import { createDetector } from "./detector.js";

interface FileCache {
  version: number;
  fingerprint: string;
  records: Message[];
  diagnostics: Diagnostic[];
}
interface Batch {
  reader: Reader;
  path: string;
  root: string;
  records: Message[];
  cached: boolean;
}
const CACHEABLE = new Set(["claude", "codex", "pi", "cursor", "t3code", "opencode"]);
function hash(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}
async function fingerprint(path: string): Promise<string> {
  const entries = [];
  for (const candidate of [path, `${path}-wal`, `${path}-journal`]) {
    try {
      const info = await stat(candidate);
      entries.push([candidate, info.size, info.mtimeMs, info.ctimeMs, info.mode]);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  return hash(JSON.stringify(entries));
}
async function collect(
  reader: Reader,
  path: string,
  context: ReaderContext,
  root: string,
): Promise<Message[]> {
  const records: Message[] = [];
  let count = 0;
  try {
    for await (const record of reader.read(path, { ...context, historyRoot: root })) {
      if (!("role" in record) || record.role !== "user") continue;
      records.push(record);
      if (++count >= LIMITS.recordBatch) {
        context.onProgress?.({ type: "records", messages: count, usage: 0 });
        count = 0;
        await setImmediate();
      }
    }
  } catch (error) {
    context.diagnostics.push({
      agent: reader.name,
      path,
      status: "skipped",
      detail: error instanceof Error ? error.message : String(error),
    });
  }
  if (count) context.onProgress?.({ type: "records", messages: count, usage: 0 });
  return records;
}
function identity(record: Message): string | undefined {
  return record.id
    ? JSON.stringify([
        record.originAgent ?? record.agent,
        record.originSession ?? record.session,
        record.role,
        record.id,
      ])
    : undefined;
}

export async function readCachedScan(
  context: ReaderContext,
  options: AnalysisOptions,
  reportPath: string,
): Promise<ReaderResult> {
  const detect = createDetector(options.config);
  const batches: Batch[] = [];
  for (const { reader, path } of await discover(context, options.agent)) {
    context.onProgress?.({ type: "source", agent: reader.name });
    const cacheable = CACHEABLE.has(reader.name);
    const files = cacheable
      ? walk(path, [".jsonl", ".db", ".sqlite", ".vscdb", ".json"], context, reader.name)
      : [path];
    for await (const file of files) {
      // Legacy split OpenCode JSON depends on other part files; keep that path uncached.
      const canCache = cacheable && extname(file) !== ".json";
      let saved: FileCache | undefined;
      let stamp: string | undefined;
      const target = join(dirname(reportPath), `${hash(reportPath)}-files`, `${hash(file)}.json`);
      if (canCache) {
        try {
          stamp = await fingerprint(file);
          const parsed = JSON.parse(await readFile(target, "utf8")) as FileCache;
          if (
            parsed.version === SCAN_CACHE.version &&
            parsed.fingerprint === stamp &&
            Array.isArray(parsed.records) &&
            Array.isArray(parsed.diagnostics) &&
            parsed.records.every(
              (record) =>
                record.text === "" &&
                record.role === "user" &&
                typeof record.computed?.signature === "string" &&
                Array.isArray(record.computed.matches),
            )
          )
            saved = parsed;
        } catch {
          /* New/changed/corrupt file cache: read the source. */
        }
      }
      if (saved) {
        context.onProgress?.({ type: "cached-file", agent: reader.name });
        context.diagnostics.push(...saved.diagnostics);
        context.onProgress?.({ type: "records", messages: saved.records.length, usage: 0 });
        batches.push({ reader, path: file, root: path, records: saved.records, cached: true });
        continue;
      }
      const diagnosticsStart = context.diagnostics.length;
      const records = await collect(reader, file, context, path);
      batches.push({ reader, path: file, root: path, records, cached: false });
      if (canCache && stamp) {
        try {
          const diagnostics = context.diagnostics.slice(diagnosticsStart);
          if (
            !diagnostics.some((d) => d.status === "skipped") &&
            (await fingerprint(file)) === stamp
          ) {
            const aggregates = records.map((record) => ({
              ...record,
              text: "",
              computed: {
                signature: hash(`${record.role}\0${record.text.trim()}`),
                matches: detect(record.text),
              },
            }));
            await writePrivateFile(
              target,
              JSON.stringify({
                version: SCAN_CACHE.version,
                fingerprint: stamp,
                records: aggregates,
                diagnostics,
              } satisfies FileCache),
            );
            // Reuse the work just computed without retaining a second transcript copy.
            records.forEach((record, index) => {
              record.computed = aggregates[index]!.computed;
            });
          }
        } catch {
          /* Read-only cache directories never prevent a scan. */
        }
      }
    }
  }
  // If one native identity has different snapshots, get the raw records for an
  // exact merge. Ordinary cached rows can be deduplicated by their hashes alone.
  const seen = new Map<string, { signature: string; batch: Batch }>();
  const reload = new Set<Batch>();
  for (const batch of batches)
    for (const record of batch.records) {
      const id = identity(record);
      if (!id) continue;
      const signature = record.computed?.signature ?? hash(`${record.role}\0${record.text.trim()}`);
      const previous = seen.get(id);
      if (previous && previous.signature !== signature) {
        if (batch.cached) reload.add(batch);
        if (previous.batch.cached) reload.add(previous.batch);
      } else seen.set(id, { signature, batch });
    }
  for (const batch of reload)
    batch.records = await collect(batch.reader, batch.path, context, batch.root);
  return { messages: batches.flatMap((batch) => batch.records), usage: [] };
}
