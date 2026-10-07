import { SLOP_SIGNALS } from "../config/slop.js";
import type { SlopMatch } from "../types.js";
import { maskCode } from "./masking.js";
import { selectMatches } from "./matches.js";
export function detectSlop(text: string): SlopMatch[] {
  const prose = maskCode(text);
  const candidates: SlopMatch[] = [];
  for (const [category, tell, pattern] of SLOP_SIGNALS)
    for (const match of prose.matchAll(pattern))
      candidates.push({ category, tell, index: match.index, end: match.index + match[0].length });
  for (const match of prose.matchAll(/—/gu))
    candidates.push({
      category: "formatting",
      tell: "em dash",
      index: match.index,
      end: match.index + match[0].length,
    });
  const marks = [...prose.matchAll(/^[\t ]*(?:[-*]\s*)?[✅✓]\s+/gmu)];
  if (marks.length >= 3 && marks[0])
    candidates.push({
      category: "formatting",
      tell: "checkmark wall",
      index: marks[0].index,
      end: marks[0].index + marks[0][0].length,
    });
  return selectMatches(candidates);
}
