import { createHash } from "node:crypto";
import type { Message, UsageRecord } from "../types.js";
import { TOKEN_KEYS } from "../readers/tokens.js";

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
function identity(record: Message | UsageRecord): string | undefined {
  const session = record.originSession ?? record.session;
  const agent = record.originAgent ?? record.agent;
  return record.id
    ? JSON.stringify([agent, session, "role" in record ? record.role : "usage", record.id])
    : undefined;
}
function signature(record: Message | UsageRecord): string {
  return "role" in record
    ? (record.computed?.signature ?? hash(`${record.role}\0${record.text.trim()}`))
    : JSON.stringify([record.model, ...TOKEN_KEYS.map((key) => record[key])]);
}
function sameTime(a: Message | UsageRecord, b: Message | UsageRecord): boolean {
  return (
    !!a.timestamp &&
    !!b.timestamp &&
    Math.abs(Date.parse(a.timestamp) - Date.parse(b.timestamp)) <= 2_000
  );
}
export function deduplicate<T extends Message | UsageRecord>(
  records: T[],
): { records: T[]; removed: number } {
  const ids = new Map<string, number>();
  const fingerprints = new Map<string, number[]>();
  const result: T[] = [];
  let removed = 0;
  // Prefer native records when a mirrored T3 projection has the same content and time.
  const ordered = [...records].sort(
    (a, b) => Number(a.agent === "t3code") - Number(b.agent === "t3code"),
  );
  for (const record of ordered) {
    const id = identity(record);
    const existing = id ? ids.get(id) : undefined;
    if (existing !== undefined) {
      const previous = result[existing]!;
      if ("role" in previous && "role" in record) {
        if (record.text.startsWith(previous.text)) result[existing] = record;
        else if (!previous.text.includes(record.text)) {
          previous.text += `\n${record.text}`;
          delete previous.computed;
        }
      } else result[existing] = record;
      removed++;
      continue;
    }
    const sig = signature(record);
    const matches = fingerprints.get(sig) ?? [];
    const duplicate = matches.some((index) => {
      const previous = result[index]!;
      if (record.agent === previous.agent)
        return (
          (!record.id || !previous.id) &&
          record.session === previous.session &&
          record.timestamp !== undefined &&
          record.timestamp === previous.timestamp
        );
      const mirror =
        record.agent === "t3code" && (!record.originAgent || record.originAgent === previous.agent);
      return (
        mirror &&
        sameTime(record, previous) &&
        (!record.originSession || record.originSession === previous.session)
      );
    });
    if (duplicate) {
      removed++;
      continue;
    }
    if (id) ids.set(id, result.length);
    matches.push(result.length);
    fingerprints.set(sig, matches);
    result.push(record);
  }
  return { records: result, removed };
}
