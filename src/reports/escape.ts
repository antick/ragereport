import { singleLineText } from "../utils/text.js";

export function escapeHtml(value: unknown): string {
  return String(value).replace(
    /[&<>"']/gu,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!,
  );
}
export function projectLabel(value: string): string {
  return value.replaceAll("\\", "/").split("/").filter(Boolean).at(-1) ?? "Unknown project";
}

export function escapeMarkdown(value: unknown): string {
  // Escape data before adding report markup, including raw HTML and Markdown link syntax.
  return escapeHtml(singleLineText(value).replace(/[\\`*_{}[\]()#+.!|~-]/gu, "\\$&"));
}
