import test from "node:test";
import assert from "node:assert/strict";
import {
  buildReport,
  DEFAULT_CONFIG,
  renderHtml,
  renderCard,
  renderMarkdown,
} from "../dist/index.js";
const options = {
  command: "report",
  config: DEFAULT_CONFIG,
  offline: true,
  refreshPrices: false,
  noRoast: true,
};
const catalog = { source: "fallback", fetchedAt: "2026-10-05T00:00:00Z", models: {} };
const now = "2026-10-05T12:00:00.000Z";
const message = {
  agent: "codex",
  role: "user",
  session: "s1",
  timestamp: "2026-10-04T12:00:00.000Z",
  project: "/private/secret/project",
  text: "fuck please thanks",
};
test("reports aggregate language, assistant patterns, projects, and weekly rates separately", () => {
  const data = {
    messages: [
      message,
      { ...message, timestamp: "2026-09-26T12:00:00.000Z", text: "fuck shit" },
      { ...message, role: "assistant", text: "The key insight is load-bearing." },
    ],
    usage: [],
  };
  const report = buildReport(data, options, catalog, now);
  assert.equal(report.language.messages, 2);
  assert.equal(report.language.swears, 3);
  assert.equal(report.language.polite, 2);
  assert.equal(report.slop.messages, 1);
  assert.equal(report.slop.hits, 2);
  assert.equal(report.comparison.current.swearsPer100Messages, 100);
  assert.equal(report.comparison.previous.swearsPer100Messages, 200);
  assert.equal(report.comparison.changePer100Messages, -100);
  assert.equal(report.projects.length, 1);
  assert.equal(report.agents[0].days.length, 2);
});
test("date filters exclude undated records and use an exclusive end", () => {
  const report = buildReport(
    {
      messages: [
        message,
        { ...message, text: "wtf", timestamp: undefined },
        { ...message, text: "shit", timestamp: now },
      ],
      usage: [],
    },
    { ...options, since: "2026-10-01T00:00:00Z", until: now },
    catalog,
    now,
  );
  assert.equal(report.language.messages, 1);
  assert.equal(report.undated.excluded, 1);
});
test("project comparisons rank by the finalized rate rather than raw counts", () => {
  const report = buildReport(
    {
      messages: [
        { ...message, project: "busy", text: "fuck" },
        { ...message, project: "busy", text: "shit" },
        { ...message, project: "busy", text: "please" },
        { ...message, project: "busy", text: "thanks" },
        { ...message, project: "short", text: "chutiya" },
      ],
      usage: [],
    },
    options,
    catalog,
    now,
  );
  assert.equal(report.projects[0].name, "short");
  assert.equal(report.projects[0].language.swearsPer100Messages, 100);
  assert.equal(report.projects[1].language.swearsPer100Messages, 50);
});
test("no data produces no-signal language and unavailable cost", () => {
  const report = buildReport({ messages: [], usage: [] }, options, catalog, now);
  assert.equal(report.language.tier.status, "no-signals");
  assert.equal(report.cost.estimatedCost, null);
  assert.match(renderMarkdown(report), /Unavailable/);
});
test("exports distinguish tiny priced amounts, zero, and unavailable costs", () => {
  const report = buildReport({ messages: [], usage: [] }, options, catalog, now);
  for (const [value, expected] of [
    [0.00003, "$0.00003"],
    [0.0000001, "&lt;$0.000001"],
    [0, "$0.00"],
    [null, "Unavailable"],
  ]) {
    report.cost.estimatedCost = value;
    assert.ok(renderCard(report).includes(expected));
  }
});
test("HTML and share cards escape content and omit transcripts and local paths", () => {
  const config = {
    ...DEFAULT_CONFIG,
    words: [{ word: "</script>", language: "en", kind: "insult" }],
  };
  const report = buildReport(
    { messages: [{ ...message, text: "super-secret-token-123 </script>" }], usage: [] },
    { ...options, config },
    catalog,
    now,
  );
  report.diagnostics = [
    {
      agent: "codex",
      path: "/private/secret/path",
      status: "skipped",
      detail: "/private/secret/error",
    },
  ];
  const html = renderHtml(report);
  assert.ok(!html.includes("super-secret-token-123"));
  assert.ok(!html.includes("/private/secret"));
  assert.ok(html.includes("\\u003c/script\\u003e"));
  assert.equal((html.match(/<\/script>/gu) ?? []).length, 2);
  const card = renderCard(report);
  assert.ok(card.includes("RAGE REPORT"));
  assert.ok(!card.includes("/private/secret"));
});
