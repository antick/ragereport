import test from "node:test";
import assert from "node:assert/strict";
import { stripVTControlCharacters } from "node:util";
import {
  buildReport,
  DEFAULT_CONFIG,
  formatDuration,
  renderMarkdown,
  renderTerminal,
} from "../dist/index.js";

const report = buildReport(
  {
    messages: [
      { agent: "codex", role: "user", session: "terminal", text: "wtf chutiya please thanks" },
    ],
    usage: [],
  },
  { command: "scan", config: DEFAULT_CONFIG, offline: true, refreshPrices: false, noRoast: true },
  { source: "fallback", models: {} },
  "2026-10-05T12:00:00Z",
);
test("terminal reports have colored headings, numbers, and vocabulary bars", () => {
  const colored = renderTerminal(report, { color: true, width: 80 });
  assert.ok(colored.includes(`${String.fromCharCode(27)}[`));
  const plain = stripVTControlCharacters(colored);
  assert.match(plain, /RAGE REPORT/u);
  assert.match(plain, /chutiya/u);
  assert.match(plain, /[█━]/u);
  assert.ok(!/[\u0900-\u097f]/u.test(plain));
  assert.equal(renderTerminal(report, { color: false, width: 80 }), plain);
});

test("completion durations use minutes after a minute, with correct rounding and seconds", () => {
  assert.equal(formatDuration(0), "0.00s");
  assert.equal(formatDuration(1234), "1.23s");
  assert.equal(formatDuration(59790), "59.79s");
  assert.equal(formatDuration(60000), "1m 0s");
  assert.equal(formatDuration(121790), "2m 2s");
  assert.equal(formatDuration(119990), "2m 0s");
});

test("vocabulary text wraps without cutting off variants, counts, or long family names", () => {
  const variants = Object.fromEntries(
    Array.from({ length: 20 }, (_, index) => [`fuc${"k".repeat(index + 1)}`, index + 1]),
  );
  const longVariant = `fuc${"k".repeat(100)}`;
  variants[longVariant] = 21;
  const group = "a very long family name that should remain completely readable";
  const words = [{ group, count: 231, variants }];
  const detailed = { ...report, language: { ...report.language, swearWords: words } };
  for (const color of [false, true]) {
    const terminal = stripVTControlCharacters(renderTerminal(detailed, { color, width: 42 }));
    const continuous = terminal.replace(/\s+/gu, "");
    assert.ok(!terminal.includes("…"));
    assert.ok(continuous.includes(group.replace(/\s+/gu, "")));
    for (const [variant, total] of Object.entries(variants))
      assert.ok(continuous.includes(`${variant}(${total})`), `Missing full variant: ${variant}`);
  }
  const markdown = renderMarkdown(detailed);
  for (const [variant, total] of Object.entries(variants))
    assert.ok(markdown.includes(`${variant} (${total})`));
});

test("narrow terminal reports wrap every section without losing numbers or model names", () => {
  const data = {
    messages: [
      {
        agent: "codex",
        role: "user",
        session: "session",
        id: "user",
        text: "fuck please",
        timestamp: "2026-10-05T00:00:00Z",
      },
    ],
    usage: [
      {
        agent: "codex",
        session: "session",
        id: "usage",
        provider: "openai",
        model: "a-very-long-historical-model-name",
        timestamp: "2026-10-05T00:00:00Z",
        input: 123456789,
        output: 234567890,
        reasoning: 0,
        cacheRead: 0,
        cacheWrite: 0,
      },
    ],
  };
  const report = buildReport(
    data,
    { command: "report", config: DEFAULT_CONFIG, noRoast: false },
    { source: "fallback", models: {} },
    "2026-10-07T00:00:00Z",
  );
  for (const color of [false, true]) {
    const output = stripVTControlCharacters(renderTerminal(report, { width: 42, color }));
    assert.ok(output.split("\n").every((line) => [...line].length <= 42));
    assert.match(output, /123,456,789/);
    assert.match(output, /234,567,890/);
    assert.ok(output.replace(/\s+/gu, "").includes("a-very-long-historical-model-name"));
  }
});
