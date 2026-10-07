import { DEFAULT_WORDS } from "../config/words.js";
import { DEFAULT_CONFIG } from "../config/load.js";
import type { RageConfig, TextMatch, WordEntry } from "../types.js";
import { hostRanges, insideRange, maskCode } from "./masking.js";
import { createWordIndex, type WordCandidate } from "./word-index.js";
import { selectMatches } from "./matches.js";

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}
function spelling(word: string): string {
  return (word.match(/(.)\1*/gu) ?? [])
    .map((run) => {
      const character = run[0] ?? "";
      if (/\s/u.test(character)) return "\\s+";
      // Keep meaningful doubled letters; only allow stretches, never delete letters.
      return /[a-z]/iu.test(character) ? `${escape(character)}{${run.length},}` : escape(run);
    })
    .join("");
}
export function createDetector(config: RageConfig = DEFAULT_CONFIG): (text: string) => TextMatch[] {
  const words = new Map<string, WordEntry>();
  const ignored = new Set(config.ignoreWords.map((word) => word.toLowerCase()));
  for (const entry of [...DEFAULT_WORDS, ...config.words]) {
    if (
      config.languages.includes(entry.language) &&
      (!entry.ambiguous || config.looseMatching) &&
      !ignored.has(entry.word) &&
      !ignored.has(entry.group ?? entry.word)
    )
      words.set(entry.word.toLowerCase(), entry);
  }
  const entries = [...words.values()].sort((a, b) => b.word.length - a.word.length);
  const patterns = entries.map((entry) => ({
    entry,
    pattern: new RegExp(`(?<![\\p{L}\\p{N}_])${spelling(entry.word)}(?![\\p{L}\\p{N}_])`, "giu"),
  }));
  const indexed = config.words.length ? undefined : createWordIndex(entries, spelling);
  return (text: string): TextMatch[] => {
    const search = config.includeCode ? text : maskCode(text);
    const candidates: TextMatch[] = [];
    const found: WordCandidate[] = indexed
      ? indexed(search)
      : patterns.flatMap(({ entry, pattern }) =>
          [...search.matchAll(pattern)].map((match) => ({
            entry,
            text: match[0],
            index: match.index,
            end: match.index + match[0].length,
          })),
        );
    for (const { entry, index, end } of found) {
      candidates.push({
        word: entry.word,
        text: text.slice(index, end),
        index,
        end,
        group: entry.group ?? entry.word,
        kind: entry.kind,
        language: entry.language,
        severity: entry.severity,
      });
    }
    if (!candidates.length) return [];
    const hosts = hostRanges(search);
    const prose = candidates.filter(
      (candidate) => !insideRange(candidate.index, candidate.end, hosts),
    );
    if (indexed) return prose;
    return selectMatches(prose);
  };
}
export function detect(text: string, config: RageConfig = DEFAULT_CONFIG): TextMatch[] {
  return createDetector(config)(text);
}
