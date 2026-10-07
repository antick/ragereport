import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { AGENTS, type RageConfig, type WordEntry } from "../types.js";
import { object } from "../utils/value.js";

export const DEFAULT_CONFIG: RageConfig = {
  languages: ["en", "hi"],
  looseMatching: false,
  includeCode: false,
  words: [],
  ignoreWords: [],
  paths: {},
};
export async function loadConfig(path?: string): Promise<RageConfig> {
  if (!path) return structuredClone(DEFAULT_CONFIG);
  const absolute = resolve(path);
  const value: unknown = JSON.parse(await readFile(absolute, "utf8"));
  if (value === null || typeof value !== "object" || Array.isArray(value))
    throw new Error("Configuration must be a JSON object.");
  const raw = object(value);
  const allowed = new Set(Object.keys(DEFAULT_CONFIG));
  for (const key of Object.keys(raw))
    if (!allowed.has(key)) throw new Error(`Unknown configuration key: ${key}`);
  const result = structuredClone(DEFAULT_CONFIG);
  if (raw.languages !== undefined) {
    if (
      !Array.isArray(raw.languages) ||
      !raw.languages.length ||
      raw.languages.some((v) => v !== "en" && v !== "hi")
    )
      throw new Error("languages must contain en and/or hi.");
    result.languages = [...new Set(raw.languages)] as RageConfig["languages"];
  }
  for (const key of ["includeCode", "looseMatching"] as const) {
    if (raw[key] !== undefined && typeof raw[key] !== "boolean")
      throw new Error(`${key} must be true or false.`);
    if (typeof raw[key] === "boolean") result[key] = raw[key];
  }
  if (raw.ignoreWords !== undefined) {
    if (
      !Array.isArray(raw.ignoreWords) ||
      raw.ignoreWords.some((w) => typeof w !== "string" || !w.trim())
    )
      throw new Error("ignoreWords must be a list of words.");
    result.ignoreWords = raw.ignoreWords.map((w) => String(w).toLowerCase());
  }
  if (raw.words !== undefined) {
    if (!Array.isArray(raw.words)) throw new Error("words must be a list.");
    result.words = raw.words.map(validateWord);
  }
  if (raw.paths !== undefined) {
    if (raw.paths === null || typeof raw.paths !== "object" || Array.isArray(raw.paths))
      throw new Error("paths must be an object.");
    for (const [agent, paths] of Object.entries(object(raw.paths))) {
      if (
        !AGENTS.includes(agent as (typeof AGENTS)[number]) ||
        !Array.isArray(paths) ||
        paths.some((p) => typeof p !== "string" || !p.trim())
      )
        throw new Error(`Invalid paths for ${agent}.`);
      result.paths[agent as (typeof AGENTS)[number]] = paths.map((p) =>
        resolve(dirname(absolute), p),
      );
    }
  }
  return result;
}
function validateWord(value: unknown): WordEntry {
  const word = object(value);
  if (
    typeof word.word !== "string" ||
    !word.word.trim() ||
    !["en", "hi"].includes(String(word.language)) ||
    !["swear", "insult", "polite"].includes(String(word.kind))
  )
    throw new Error(
      "Each custom word needs word, language (en/hi), and kind (swear/insult/polite).",
    );
  if (
    word.severity !== undefined &&
    !["mild", "moderate", "strong"].includes(String(word.severity))
  )
    throw new Error(`Invalid severity for ${word.word}.`);
  if (word.group !== undefined && (typeof word.group !== "string" || !word.group.trim()))
    throw new Error("Word groups must be non-empty strings.");
  if (word.ambiguous !== undefined && typeof word.ambiguous !== "boolean")
    throw new Error("ambiguous must be true or false.");
  return {
    word: word.word.trim().toLowerCase(),
    language: word.language as WordEntry["language"],
    kind: word.kind as WordEntry["kind"],
    group: word.group as string | undefined,
    severity: word.severity as WordEntry["severity"],
    ambiguous: word.ambiguous as boolean | undefined,
  };
}
