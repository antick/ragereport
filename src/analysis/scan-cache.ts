import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { AnalysisOptions, ReaderContext, ReaderResult, Report } from "../types.js";
import { allReaders, discover, readerContext } from "../readers/index.js";
import { walk } from "../readers/files.js";
import { SCAN_CACHE, TIME } from "../config/constants.js";
import { pricingCachePath } from "../pricing/catalog.js";
import { writePrivateFile } from "../utils/files.js";

interface CachedScan {
  version: number;
  fingerprint: string;
  expiresAt: number;
  report: Report;
}
export interface ScanCache {
  path: string;
  fingerprint: string;
  report?: Report;
}
let buildHash: Promise<string> | undefined;
function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
async function snapshot(context: ReaderContext, options: AnalysisOptions): Promise<string> {
  const listing = readerContext({ ...context, diagnostics: [], onProgress: undefined });
  const entries: unknown[] = [];
  for (const { reader, path } of await discover(listing, options.agent)) {
    entries.push([reader.name, path]);
    for await (const file of walk(
      path,
      [".jsonl", ".json", ".db", ".sqlite", ".vscdb"],
      listing,
      reader.name,
    )) {
      for (const candidate of [file, `${file}-wal`, `${file}-journal`]) {
        try {
          const info = await stat(candidate);
          entries.push([candidate, info.size, info.mtimeMs, info.ctimeMs, info.mode]);
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        }
      }
    }
  }
  if (listing.diagnostics.some((d) => d.status === "skipped"))
    throw new Error("Incomplete history inventory");
  return hash(JSON.stringify(entries));
}
export async function loadScanCache(
  context: ReaderContext,
  options: AnalysisOptions,
): Promise<ScanCache | undefined> {
  // Explicit opt-in for library users; the CLI enables this for all-history language scans.
  if (!options.cache || options.command !== "scan" || options.since || options.until)
    return undefined;
  try {
    buildHash ??= readFile(fileURLToPath(import.meta.url), "utf8").then(hash);
    const key = hash(
      JSON.stringify([
        await buildHash,
        context.home,
        allReaders()
          .filter((reader) => !options.agent || reader.name === options.agent)
          .map((reader) => [reader.name, reader.paths(context)]),
        options.agent,
        options.config,
        options.noRoast,
      ]),
    );
    const path = join(
      dirname(pricingCachePath(context.home, context.env)),
      SCAN_CACHE.directory,
      `${key}.json`,
    );
    const fingerprint = await snapshot(context, options);
    const cache: ScanCache = { path, fingerprint };
    try {
      const saved = JSON.parse(await readFile(path, "utf8")) as CachedScan;
      if (
        saved.version === SCAN_CACHE.version &&
        saved.fingerprint === fingerprint &&
        saved.expiresAt > Date.now() &&
        saved.report?.command === "scan" &&
        Array.isArray(saved.report.agents)
      ) {
        cache.report = {
          ...saved.report,
          generatedAt: new Date().toISOString(),
          comparison: {
            ...saved.report.comparison,
            currentSince: new Date(Date.now() - TIME.weekDays * TIME.dayMs).toISOString(),
            previousSince: new Date(Date.now() - 2 * TIME.weekDays * TIME.dayMs).toISOString(),
            until: new Date().toISOString(),
          },
        };
      }
    } catch {
      /* A missing/corrupt cache falls back to a real read. */
    }
    return cache;
  } catch {
    return undefined;
  }
}
export async function saveScanCache(
  cache: ScanCache | undefined,
  report: Report,
  data: ReaderResult,
  context: ReaderContext,
  options: AnalysisOptions,
): Promise<void> {
  if (!cache || report.diagnostics.some((d) => d.status === "skipped")) return;
  try {
    // Never cache a read while histories change underneath it.
    if ((await snapshot(context, options)) !== cache.fingerprint) return;
    const now = Date.now();
    const generated = Date.parse(report.generatedAt);
    let expiresAt = now + TIME.dayMs;
    for (const record of data.messages)
      if (record.timestamp) {
        const date = Date.parse(record.timestamp);
        for (const boundary of [
          date,
          date + TIME.weekDays * TIME.dayMs,
          date + 2 * TIME.weekDays * TIME.dayMs,
        ])
          if (boundary > generated) expiresAt = Math.min(expiresAt, boundary);
      }
    if (expiresAt <= now) return;
    // The report contains aggregate counts/word variants and diagnostics, not transcripts.
    await writePrivateFile(
      cache.path,
      JSON.stringify({
        version: SCAN_CACHE.version,
        fingerprint: cache.fingerprint,
        expiresAt,
        report,
      } satisfies CachedScan),
    );
  } catch {
    /* Cache failures must not prevent a scan. */
  }
}
