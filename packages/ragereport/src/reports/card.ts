import type { CostSummary, LanguageSummary } from "../types.js";
import { count, formatDate, money } from "../utils/format.js";
import { escapeHtml as esc } from "./escape.js";
export function renderCard(data: {
  generatedAt: string;
  language: LanguageSummary;
  cost: CostSummary;
}): string {
  const fields = [
    ["SWEARS", count(data.language.swears)],
    ["POLITE EXPRESSIONS", count(data.language.polite)],
    ["YOUR MESSAGES", count(data.language.messages)],
    ["PRICED API ESTIMATE", money(data.cost.estimatedCost)],
  ];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" role="img" aria-label="RageReport summary"><rect width="1200" height="630" fill="#f4f1e9"/><rect x="50" y="48" width="46" height="46" rx="9" fill="#d4562b"/><g font-family="Arial, sans-serif" fill="#252824"><text x="64" y="81" font-size="32" fill="white" font-weight="bold">R</text><text x="112" y="80" font-size="26" font-weight="bold">RAGE REPORT</text><text x="1150" y="80" text-anchor="end" font-size="18">${esc(formatDate(data.generatedAt))}</text><text x="50" y="175" font-size="17" letter-spacing="3">THE STATE OF MY KEYBOARD</text><text x="50" y="260" font-size="68" font-weight="bold">${esc(data.language.tier.name)}</text><text x="50" y="308" font-size="24">${esc(data.language.tier.label)}</text>${fields.map(([label, value], index) => `<text x="${50 + index * 285}" y="418" font-size="14" letter-spacing="1">${esc(label)}</text><text x="${50 + index * 285}" y="482" font-size="40" font-weight="bold">${esc(value)}</text>`).join("")}<text x="50" y="580" font-size="18" fill="#707369">${esc(count(data.language.swearsPer100Messages))} swears per 100 messages · Local analysis · Aggregate counts only</text></g></svg>`;
}
