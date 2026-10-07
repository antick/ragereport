import test from "node:test";
import assert from "node:assert/strict";
import { stripVTControlCharacters } from "node:util";
import {
  buildReport,
  calendarData,
  DEFAULT_CONFIG,
  formatDate,
  renderCard,
  renderTerminal,
} from "../dist/index.js";

const options = {
  command: "scan",
  config: DEFAULT_CONFIG,
  offline: true,
  refreshPrices: false,
  noRoast: true,
};
const catalog = { source: "fallback", models: {} };
const now = "2026-10-05T12:00:00.000Z";
const message = (day, text, project) => ({
  agent: "codex",
  role: "user",
  session: "calendar",
  timestamp: day + "T12:00:00.000Z",
  text,
  project,
});
const weekly = buildReport(
  {
    messages: [
      message("2026-09-28", "fuck fuck fuck fuck"),
      message("2026-09-29", "please"),
      message("2026-09-30", "fuck"),
      message("2026-10-01", "fuck fuck fuck"),
      message("2026-10-03", "fuck fuck"),
      message("2026-10-04", "fuck fuck fuck fuck"),
    ],
    usage: [],
  },
  { ...options, since: "2026-09-28T00:00:00Z", until: "2026-10-05T00:00:00Z" },
  catalog,
  now,
);

test("calendar data distinguishes missing messages from no swears and respects exclusive UTC dates", () => {
  const result = calendarData(weekly.days, weekly.scope.until, {
    since: weekly.scope.since,
    exclusiveEnd: true,
  });
  assert.equal(result.offset, 1);
  assert.equal(result.maximum, 4);
  assert.deepEqual(
    result.cells.map((cell) => cell.day),
    [
      "2026-09-28",
      "2026-09-29",
      "2026-09-30",
      "2026-10-01",
      "2026-10-02",
      "2026-10-03",
      "2026-10-04",
    ],
  );
  assert.deepEqual(
    result.cells.map((cell) => cell.swears),
    [4, 0, 1, 3, null, 2, 4],
  );
  assert.deepEqual(
    result.cells.map((cell) => cell.level),
    [4, 0, 1, 3, 0, 2, 4],
  );
  const partial = calendarData([], "2026-10-05T12:00:00Z", {
    since: "2026-10-05",
    exclusiveEnd: true,
  });
  assert.equal(partial.cells[0].day, "2026-10-05");
});

test("calendar range handles leap days and includes exactly 91 days by default", () => {
  const leap = calendarData([], "2024-03-01T12:00:00Z", { since: "2024-02-28" });
  assert.deepEqual(
    leap.cells.map((cell) => cell.day),
    ["2024-02-28", "2024-02-29", "2024-03-01"],
  );
  assert.equal(calendarData([], now).cells.length, 91);
  assert.equal(calendarData([], now).maximum, 0);
});

test("terminal heatmap uses week columns with the correct weekdays, levels, legend, and full dates", () => {
  const colored = renderTerminal(weekly, { color: true, width: 42 });
  const plain = stripVTControlCharacters(colored);
  assert.match(plain, /THE KEYBOARD CALENDAR/u);
  assert.ok(plain.includes(`${formatDate("2026-09-28")} to ${formatDate("2026-10-04")}`));
  assert.match(plain, /^  Mon █/mu);
  assert.match(plain, /^  Sun   █/mu);
  assert.match(plain, /^  Tue □/mu);
  assert.match(plain, /^  Fri ·/mu);
  assert.match(plain, /No messages/u);
  assert.match(plain, /No swears/u);
  assert.match(plain, /Days with messages: 6/u);
  assert.match(plain, /Swears: 14/u);
  assert.match(plain, /Peak 4\/day/u);
  assert.ok(colored.includes("\u001b[38;5;40m"));
  assert.equal(renderTerminal(weekly, { color: false, width: 42 }), plain);
  const calendar = plain.split("THE KEYBOARD CALENDAR")[1].split("PROJECT COMPARISON")[0];
  assert.ok(calendar.split("\n").every((line) => line.length <= 42));
});

test("project comparisons rank normalized rates and show full labels without transcripts or local paths", () => {
  const privateMarker = "PRIVATE_TRANSCRIPT_MARKER";
  const name = "a_very_long_project_label_that_must_be_shown_in_full";
  const data = {
    messages: [
      ...Array.from({ length: 100 }, (_, index) => ({
        ...message("2026-10-04", index < 4 ? "fuck" : "hello", "/private/machine/busy"),
        id: `busy-${index}`,
      })),
      message("2026-10-04", "fuck fuck " + privateMarker, "/private/machine/" + name),
    ],
    usage: [],
  };
  const report = buildReport(data, options, catalog, now);
  const terminal = renderTerminal(report, { color: false, width: 42 });
  const projects = terminal.split("PROJECT COMPARISON")[1];
  assert.ok(projects.replace(/\s+/gu, "").includes(name));
  assert.ok(projects.indexOf("a_very_long") < projects.indexOf("busy"));
  assert.match(projects, /200 \/ 100 messages/u);
  assert.match(projects, /4 \/ 100 messages/u);
  for (const shared of [terminal, renderCard(report)]) {
    assert.ok(!shared.includes(privateMarker));
    assert.ok(!shared.includes("/private/machine"));
  }
});

test("empty terminal calendar and project comparison have readable empty states", () => {
  const report = buildReport({ messages: [], usage: [] }, options, catalog, now);
  const terminal = renderTerminal(report, { color: false });
  assert.match(terminal, /Days with messages: 0 · Swears: 0 · Peak 0\/day/u);
  assert.match(terminal, /No project metadata/u);
  assert.ok(!terminal.includes("NaN"));
});
