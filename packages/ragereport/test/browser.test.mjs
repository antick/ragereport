import test from "node:test";
import assert from "node:assert/strict";
import { buildReport, DEFAULT_CONFIG, calendarData } from "../dist/index.js";
import { browser } from "./browser-fixture.mjs";

const catalog = { source: "fallback", models: { "openai/test": { input: 2, output: 10 } } };
const options = { command: "report", config: DEFAULT_CONFIG, offline: true, noRoast: true };
const now = "2026-10-07T12:00:00.000Z";
const messages = Array.from({ length: 12 }, (_, index) => ({
  agent: index % 2 ? "claude" : "codex",
  session: `session-${index}`,
  id: `user-${index}`,
  role: "user",
  text: "fuck please",
  timestamp: new Date(Date.parse(now) - index * 86400000).toISOString(),
}));
const usage = messages.map(({ agent, session, id, timestamp }) => ({
  agent,
  session,
  id,
  timestamp,
  provider: "openai",
  model: "test",
  input: 100,
  output: 10,
  reasoning: 0,
  cacheRead: 0,
  cacheWrite: 0,
}));
function report(until) {
  return buildReport(
    { messages: [...messages, { ...messages[0], id: "undated", timestamp: undefined }], usage },
    { ...options, until },
    catalog,
    now,
  );
}
const all = { agent: "all", range: "all", model: "all" };

test("library date boundaries compare instants across ISO precision and offsets", () => {
  const data = {
    messages: [
      { ...messages[0], id: "start", timestamp: "2026-10-01T00:00:00.000Z" },
      { ...messages[0], id: "offset", timestamp: "2026-10-01T01:00:00+01:00" },
      { ...messages[0], id: "before", timestamp: "2026-09-30T23:59:59.999Z" },
      { ...messages[0], id: "end", timestamp: "2026-10-02T00:00:00.000Z" },
    ],
    usage: [],
  };
  const result = buildReport(
    data,
    { ...options, since: "2026-10-01T00:00:00Z", until: "2026-10-02T00:00:00Z" },
    catalog,
    now,
  );
  assert.equal(result.language.messages, 2);
  assert.equal(result.scope.since, "2026-10-01T00:00:00.000Z");
  assert.equal(result.scope.until, "2026-10-02T00:00:00.000Z");
});

test("HTML periods include exactly seven UTC dates and honor exclusive midnight ends", () => {
  for (const until of [undefined, "2026-10-07T00:00:00Z"]) {
    const source = report(until);
    const view = browser.filterReport(source, { ...all, range: "7" });
    assert.equal(view.days.length, 7);
    assert.equal(view.language.messages, 7);
    assert.equal(view.cost.requests, 7);
    assert.equal(view.days.at(-1).day, until ? "2026-10-06" : "2026-10-07");
    const calendar = calendarData(
      view.days,
      source.scope.until ?? source.generatedAt,
      view.calendar,
    );
    assert.equal(calendar.cells.length, 7);
    const html = browser.heatmap(
      view.days,
      source.scope.until ?? source.generatedAt,
      view.calendar,
    );
    assert.equal((html.match(/class="heat-cell"/gu) ?? []).length, 7);
    assert.equal((html.match(/heat-padding/gu) ?? []).length, calendar.offset);
    assert.ok(!html.includes("Last 91 days"));
  }
});

test("combined HTML filters preserve unfiltered totals, undated records, and model-only language counts", () => {
  const source = report();
  const original = JSON.stringify(source);
  const full = browser.filterReport(source, all);
  assert.equal(full.language.messages, 13);
  const agent = browser.filterReport(source, { ...all, agent: "codex", range: "7" });
  assert.equal(agent.agents.length, 1);
  assert.equal(agent.language.messages, 4);
  assert.equal(agent.cost.requests, 4);
  assert.equal(agent.agents[0].days.length, 4);
  const model = browser.filterReport(source, { ...all, model: "missing" });
  assert.equal(model.cost.requests, 0);
  assert.deepEqual(model.language, source.language);
  assert.deepEqual(browser.filterReport(source, all).language, full.language);
  assert.equal(JSON.stringify(source), original);
});

test("HTML word aggregation handles inherited property names and retains numeric counts", () => {
  const config = {
    ...DEFAULT_CONFIG,
    words: ["constructor", "__proto__"].map((word) => ({ word, language: "en", kind: "swear" })),
  };
  const source = buildReport(
    {
      messages: messages
        .slice(0, 2)
        .map((message) => ({ ...message, text: "constructor __proto__" })),
      usage: [],
    },
    { ...options, config },
    catalog,
    now,
  );
  const view = browser.filterReport(source, { ...all, range: "7" });
  assert.equal(view.language.swears, 4);
  for (const word of view.language.swearWords) assert.equal(word.variants[word.group], 2);
});
