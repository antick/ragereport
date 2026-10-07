import { TERMINAL } from "../config/terminal.js";
import { terminalText } from "../utils/terminal.js";
export type TerminalColor = keyof typeof TERMINAL.colors;
export interface TerminalOptions {
  color?: boolean;
  width?: number;
}
export function paint(enabled: boolean, color: TerminalColor, text: string, bold = false): string {
  const safe = terminalText(text);
  return enabled
    ? `${bold ? TERMINAL.colors.bold : ""}${TERMINAL.colors[color]}${safe}${TERMINAL.colors.reset}`
    : safe;
}
export function fit(text: string, width: number): string {
  const safe = terminalText(text);
  return safe.length > width ? `${safe.slice(0, Math.max(0, width - 1))}…` : safe.padEnd(width);
}
export function wrap(text: string, width: number): string[] {
  const words = terminalText(text).trim().split(/\s+/u);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    let characters = [...word];
    if (line && [...line].length + characters.length + 1 > width) {
      lines.push(line);
      line = "";
    }
    while (characters.length > width) {
      lines.push(characters.slice(0, width).join(""));
      characters = characters.slice(width);
    }
    const tail = characters.join("");
    if (tail) line = line ? `${line} ${tail}` : tail;
  }
  if (line) lines.push(line);
  return lines;
}
