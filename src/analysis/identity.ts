import { createHash } from "node:crypto";
import type { Message, UsageRecord } from "../types.js";
import { TOKEN_KEYS } from "../readers/tokens.js";

export function recordIdentity(record: Message | UsageRecord): string | undefined {
  return record.id
    ? JSON.stringify([
        record.originAgent ?? record.agent,
        record.originSession ?? record.session,
        "role" in record ? record.role : "usage",
        record.id,
      ])
    : undefined;
}

export function recordSignature(record: Message | UsageRecord): string {
  return "role" in record
    ? (record.computed?.signature ??
        createHash("sha256").update(`${record.role}\0${record.text.trim()}`).digest("hex"))
    : JSON.stringify([record.provider, record.model, ...TOKEN_KEYS.map((key) => record[key])]);
}
