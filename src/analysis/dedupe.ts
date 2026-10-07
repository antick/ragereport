import type { Message, UsageRecord } from "../types.js";
import { DEDUPE } from "../config/constants.js";
import { recordIdentity, recordSignature } from "./identity.js";

export function deduplicate<T extends Message | UsageRecord>(
  records: T[],
): { records: T[]; removed: number } {
  const ids = new Map<string, number>();
  const merged: T[] = [];
  // Merge native snapshots before indexing final content for mirror detection.
  const ordered = [...records].sort(
    (a, b) => Number(a.agent === "t3code") - Number(b.agent === "t3code"),
  );
  for (const record of ordered) {
    const id = recordIdentity(record);
    const index = id ? ids.get(id) : undefined;
    if (index === undefined) {
      if (id) ids.set(id, merged.length);
      merged.push({ ...record });
      continue;
    }
    const previous = merged[index]!;
    if ("role" in previous && "role" in record) {
      if (record.text.startsWith(previous.text))
        merged[index] = { ...previous, text: record.text, computed: record.computed };
      else if (!previous.text.includes(record.text)) {
        merged[index] = {
          ...previous,
          text: `${previous.text}\n${record.text}`,
          computed: undefined,
        };
      }
    } else if (previous.agent === record.agent) merged[index] = { ...record };
  }

  const fingerprints = new Map<string, { identified: boolean; anonymous: boolean }>();
  const nativeTimes = new Map<string, number[]>();
  const result: T[] = [];
  for (const record of merged) {
    const signature = recordSignature(record);
    const role = "role" in record ? record.role : "usage";
    const time = record.timestamp ? Date.parse(record.timestamp) : NaN;
    const key = JSON.stringify([record.agent, record.session, role, signature, time]);
    const previous = Number.isFinite(time) ? fingerprints.get(key) : undefined;
    if (previous && (previous.anonymous || (!record.id && previous.identified))) continue;

    const bucket = Math.floor(time / DEDUPE.mirrorMs);
    const timeKey = (agent: string, session: string, offset: number) =>
      JSON.stringify([agent, session, role, signature, bucket + offset]);
    const { originAgent, originSession } = record;
    if (
      record.agent === "t3code" &&
      originAgent &&
      originSession &&
      Number.isFinite(time) &&
      [-1, 0, 1].some((offset) =>
        nativeTimes
          .get(timeKey(originAgent, originSession, offset))
          ?.some((native) => Math.abs(time - native) <= DEDUPE.mirrorMs),
      )
    )
      continue;

    result.push(record);
    if (Number.isFinite(time)) {
      fingerprints.set(key, {
        identified: !!record.id || !!previous?.identified,
        anonymous: !record.id || !!previous?.anonymous,
      });
      if (record.agent !== "t3code") {
        const nativeKey = timeKey(record.agent, record.session, 0);
        const times = nativeTimes.get(nativeKey) ?? [];
        times.push(time);
        nativeTimes.set(nativeKey, times);
      }
    }
  }
  return { records: result, removed: records.length - result.length };
}
