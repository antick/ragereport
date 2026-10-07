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
