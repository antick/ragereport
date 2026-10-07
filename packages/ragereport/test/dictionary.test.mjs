import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  buildReport,
  createDetector,
  DEFAULT_CONFIG,
  detect,
  renderTerminal,
} from "../dist/index.js";

const { researched, requestedHindi } = JSON.parse(
  await readFile(new URL("./dictionary-expansion.json", import.meta.url), "utf8"),
);
const loose = { ...DEFAULT_CONFIG, looseMatching: true };
const guarded = new Set(["af", "rand", "laura", "lora", "mut"]);

test("every explicitly requested Hindi spelling counts as one swear by default", () => {
  for (const word of requestedHindi) {
    const matches = detect(word);
    assert.equal(matches.length, 1, word);
    assert.equal(matches[0].language, "hi", word);
    assert.equal(matches[0].kind, "swear", word);
    assert.equal(matches[0].text, word);
  }
  assert.equal(detect(requestedHindi.join(", ")).length, requestedHindi.length);
});

test("every researched missing entry is tracked, with ambiguous terms reserved for loose mode", () => {
  assert.equal(researched.length, 126);
  for (const word of researched) {
    assert.equal(detect(word).length, guarded.has(word) ? 0 : 1, word);
    assert.equal(detect(word, loose).length, 1, `${word} in loose mode`);
  }
});

test("related requested spellings share families and preserve case and stretches", () => {
  for (const [text, group] of [
    ["BHADWEEE", "bhadwa"],
    ["bhoshda", "bhosdike"],
    ["fudda", "fuddi"],
    ["lulla", "lauda"],
    ["suwar", "suar"],
    ["pencho", "behenchod"],
    ["machod", "madarchod"],
    ["motherfuckers", "fuck"],
    ["arsehole", "ass"],
  ]) {
    const [match] = detect(text);
    assert.equal(match?.group, group, text);
    assert.equal(match.text, text);
  }
});

test("phrases and their component words count once with identical fast and custom matching", () => {
  const fast = createDetector();
  const general = createDetector({
    ...DEFAULT_CONFIG,
    words: [{ word: "customsentinel", kind: "insult", language: "en" }],
  });
  for (const text of [
    "behen chod",
    "madar chod",
    "randi rona",
    "chudai khanaa",
    "chudam chudai",
    "chudam chudai khanaa",
    "behen chod randi rona chudai khanaa",
  ]) {
    const expected = general(text);
    assert.deepEqual(fast(text), expected, text);
    assert.equal(expected.length, text === "behen chod randi rona chudai khanaa" ? 3 : 1);
  }
  assert.equal(fast("son of a bitch holy shit fuck off").length, 3);
});

test("expanded terms respect language, ignores, code, hosts, and whole-word boundaries", () => {
  assert.equal(detect("bhoshda bollocks", { ...DEFAULT_CONFIG, languages: ["hi"] }).length, 1);
  assert.equal(detect("bhoshda bollocks", { ...DEFAULT_CONFIG, languages: ["en"] }).length, 1);
  assert.equal(detect("bhadwe bhoshda", { ...DEFAULT_CONFIG, ignoreWords: ["bhadwa"] }).length, 1);
  assert.equal(detect("`bhadwe` ```\nfuddi\n``` suwar").length, 1);
  assert.equal(detect("`bhadwe`", { ...DEFAULT_CONFIG, includeCode: true }).length, 1);
  assert.equal(detect("https://bhadwa.dev admin@bollocks.com bhasad.example").length, 0);
  assert.equal(detect("https://example.com/bhadwe").length, 1);
  assert.equal(detect("column luncheon cocksure cockpit prickle mutation brand").length, 0);
  assert.equal(detect("rand af lora laura mut").length, 0);
  assert.equal(detect("rand af lora laura mut", loose).length, 5);
});

test("reports include expanded English and Hindi families and keep report messages in English", () => {
  const report = buildReport(
    {
      messages: [
        {
          agent: "codex",
          session: "expanded",
          role: "user",
          text: "bhadwe fuddi suwar motherfuckers bollocks",
        },
      ],
      usage: [],
    },
    {
      command: "scan",
      config: DEFAULT_CONFIG,
      offline: true,
      refreshPrices: false,
      noRoast: false,
    },
    { source: "fallback", models: {} },
  );
  assert.equal(report.language.swears, 5);
  assert.equal(
    report.language.swearWords.find((word) => word.group === "bhadwa").variants.bhadwe,
    1,
  );
  const terminal = renderTerminal(report);
  assert.match(terminal, /fuddi/u);
  assert.doesNotMatch(terminal, /Bhai|Thoda Garam|Full Kalesh/u);
});

test("many repeated multiword matches stay non-overlapping without a pairwise scan", () => {
  const text = "randi rona ".repeat(20000);
  const matches = detect(text);
  assert.equal(matches.length, 20000);
  assert.equal(matches.at(-1).end, text.trimEnd().length);
});
