import { TIER_DEFINITIONS } from "../config/constants.js";
import type { LanguageSummary, SlopSummary, TextMatch, WordCount, Tier } from "../types.js";
import { addWord } from "./words.js";
export function tier(swears: number, polite: number, noRoast = false): Tier {
  if (!swears && !polite)
    return {
      name: "No signals",
      label: "No swears or polite expressions detected.",
      ratio: null,
      status: "no-signals",
    };
  const ratio = polite ? swears / polite : Infinity;
  const definition =
    TIER_DEFINITIONS.find((t) => ratio < t.below) ?? TIER_DEFINITIONS[TIER_DEFINITIONS.length - 1]!;
  return {
    name: definition.name,
    label: noRoast
      ? ""
      : (definition.labels[Math.floor(Math.random() * definition.labels.length)] ?? ""),
    ratio: Number.isFinite(ratio) ? ratio : null,
    status: polite ? "finite" : "no-politeness",
  };
}
export function emptyLanguage(): LanguageSummary {
  return {
    messages: 0,
    swears: 0,
    insults: 0,
    polite: 0,
    swearingMessages: 0,
    swearsPer100Messages: 0,
    severity: { mild: 0, moderate: 0, strong: 0 },
    swearWords: [],
    insultWords: [],
    politeWords: [],
    tier: tier(0, 0),
  };
}
export function emptySlop(): SlopSummary {
  return { messages: 0, hits: 0, affectedMessages: 0, tells: [] };
}
export function tally(list: WordCount[], group: string, variant: string): void {
  addWord(list, group, variant);
}
export function addLanguage(summary: LanguageSummary, matches: TextMatch[]): void {
  summary.messages++;
  if (matches.some((m) => m.kind === "swear")) summary.swearingMessages++;
  for (const match of matches) {
    if (match.kind === "swear") {
      summary.swears++;
      summary.severity[match.severity ?? "moderate"]++;
      tally(summary.swearWords, match.group, match.text.toLowerCase());
    } else if (match.kind === "insult") {
      summary.insults++;
      tally(summary.insultWords, match.group, match.text.toLowerCase());
    } else {
      summary.polite++;
      tally(summary.politeWords, match.group, match.text.toLowerCase());
    }
  }
}
export function finalizeLanguage(summary: LanguageSummary, noRoast: boolean): void {
  summary.swearsPer100Messages = summary.messages ? (summary.swears / summary.messages) * 100 : 0;
  summary.tier = tier(summary.swears, summary.polite, noRoast);
  for (const list of [summary.swearWords, summary.insultWords, summary.politeWords])
    list.sort((a, b) => b.count - a.count || a.group.localeCompare(b.group));
}
