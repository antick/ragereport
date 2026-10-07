import { stripVTControlCharacters } from "node:util";
import { singleLineText } from "./text.js";

export function terminalText(value: unknown): string {
  // History text is data, never terminal commands or extra report rows.
  return singleLineText(stripVTControlCharacters(String(value)));
}
