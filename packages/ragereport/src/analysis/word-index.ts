import type { WordEntry } from "../types.js";
import { selectMatches } from "./matches.js";

export interface WordCandidate {
  entry: WordEntry;
  text: string;
  index: number;
  end: number;
}
function folded(text: string): string {
  return text.toLowerCase().replaceAll("ſ", "s");
}
function key(text: string): string {
  return folded(text).replace(/([a-z])\1+/gu, "$1");
}

// Index stretched whole words instead of testing every dictionary entry against
// the text; resolve phrase overlaps only when a phrase actually matches.
export function createWordIndex(
  entries: WordEntry[],
  spelling: (word: string) => string,
): (text: string) => WordCandidate[] {
  const words = new Map<string, { entry: WordEntry; pattern: RegExp }[]>();
  const phrases: { entry: WordEntry; pattern: RegExp }[] = [];
  const initials = new Set<string>();
  for (const entry of entries) {
    if (/[^a-z]/iu.test(entry.word)) {
      phrases.push({
        entry,
        pattern: new RegExp(
          `(?<![\\p{L}\\p{N}_])${spelling(entry.word)}(?![\\p{L}\\p{N}_])`,
          "giu",
        ),
      });
    } else {
      const name = key(entry.word);
      const pool = words.get(name) ?? [];
      pool.push({ entry, pattern: new RegExp(`^${spelling(entry.word)}$`, "iu") });
      words.set(name, pool);
      initials.add(name[0]!);
    }
  }
  return (text) => {
    const found: WordCandidate[] = [];
    for (const token of text.matchAll(/[\p{L}\p{N}_]+/gu)) {
      if (!initials.has(folded(token[0][0]!))) continue;
      const pool = words.get(key(token[0]));
      const match = pool?.find((candidate) => candidate.pattern.test(token[0]));
      if (match)
        found.push({
          entry: match.entry,
          text: token[0],
          index: token.index,
          end: token.index + token[0].length,
        });
    }
    const wordCount = found.length;
    for (const { entry, pattern } of phrases)
      for (const match of text.matchAll(pattern))
        found.push({
          entry,
          text: match[0],
          index: match.index,
          end: match.index + match[0].length,
        });
    return found.length === wordCount ? found : selectMatches(found);
  };
}
