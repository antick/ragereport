export type RecordValue = Record<string, unknown>;
export function object(value: unknown): RecordValue {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as RecordValue)
    : {};
}
export function string(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}
export function number(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0;
}
export function first(record: RecordValue, keys: string[]): unknown {
  for (const key of keys) if (record[key] !== undefined && record[key] !== null) return record[key];
  return undefined;
}
export function json(value: unknown): unknown {
  if (value instanceof Uint8Array) value = Buffer.from(value).toString("utf8");
  if (typeof value !== "string") return value;
  try {
    const decoded: unknown = JSON.parse(value);
    return typeof decoded === "string" && /^[[{]/u.test(decoded) ? JSON.parse(decoded) : decoded;
  } catch {
    return undefined;
  }
}
export function contentText(value: unknown): string {
  if (typeof value === "string") return value;
  if (!Array.isArray(value)) return "";
  return value
    .flatMap((part) => {
      const p = object(part);
      return ["text", "input_text", "output_text"].includes(String(p.type)) &&
        typeof p.text === "string"
        ? [p.text]
        : [];
    })
    .join("\n");
}
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
