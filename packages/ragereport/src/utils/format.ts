import { TIME } from "../config/constants.js";
export function formatDuration(milliseconds: number): string {
  const seconds = milliseconds / TIME.secondMs;
  if (seconds < TIME.minuteSeconds) return `${seconds.toFixed(2)}s`;
  const rounded = Math.round(seconds);
  return `${Math.floor(rounded / TIME.minuteSeconds)}m ${rounded % TIME.minuteSeconds}s`;
}
export function timestamp(value: unknown): string | undefined {
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  const ms = typeof value === "number" && value < 100_000_000_000 ? value * 1_000 : value;
  const date = new Date(ms);
  return Number.isFinite(date.getTime()) ? date.toISOString() : undefined;
}
export function formatDate(value: string | Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}
export function formatMonth(value: string | Date): string {
  return new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "UTC" }).format(
    new Date(value),
  );
}
export function dayKey(value: string | undefined): string | null {
  return value ? (timestamp(value)?.slice(0, 10) ?? null) : null;
}
export function money(value: number | null): string {
  if (value === null) return "Unavailable";
  if (value > 0 && value < 0.000001) return "<$0.000001";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: value > 0 && value < 0.01 ? 6 : 4,
  }).format(value);
}
export function count(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value);
}
export function dateArgument(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}(?:T.*)?$/u.test(value))
    throw new Error("Use YYYY-MM-DD or an ISO timestamp for dates.");
  const iso = timestamp(value);
  const calendar = timestamp(`${value.slice(0, 10)}T00:00:00.000Z`);
  if (!iso || calendar?.slice(0, 10) !== value.slice(0, 10))
    throw new Error(`Invalid date: ${value}`);
  return iso;
}
export function daysBefore(value: string, days: number): string {
  return new Date(new Date(value).getTime() - days * TIME.dayMs).toISOString();
}
export function inRange(value: string | undefined, since?: string, until?: string): boolean {
  if (!value) return !since && !until;
  const date = Date.parse(value);
  return (
    Number.isFinite(date) &&
    (!since || date >= Date.parse(since)) &&
    (!until || date < Date.parse(until))
  );
}

export function calendarRange(
  end: string,
  days: number,
  exclusiveEnd = false,
): { since: string; until: string } {
  const last = dayKey(new Date(Date.parse(end) - (exclusiveEnd ? 1 : 0)).toISOString())!;
  return { since: daysBefore(last, days - 1), until: daysBefore(last, -1) };
}
