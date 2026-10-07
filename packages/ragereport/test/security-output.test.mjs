import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { promisify, stripVTControlCharacters } from "node:util";
import { buildReport, DEFAULT_CONFIG, renderMarkdown, renderTerminal } from "../dist/index.js";
import { writeJson, writeLines } from "./fixtures.mjs";

const execute = promisify(execFile);
const cli = resolve("dist/cli.js");
const controls = "\x1b[2J\x1b]52;c;dGVzdA==\x07\x9b2J\x00\x08\x7f\x85\u202e";
// eslint-disable-next-line no-control-regex -- Assert that hostile control bytes never reach output.
const forbidden = /[\u0000-\u0009\u000b-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u;
const markup =
  '<img src=x onerror="evil()"> & &#x3c;svg&#x3e; [run](javascript:evil) ![image](https://example.test) `code` |';

function reportWith(model, group = "safe group") {
  return buildReport(
    {
      messages: [
        {
          agent: "claude",
          role: "user",
          session: "s",
          text: "marker",
          project: `project${controls}`,
        },
      ],
      usage: [
        {
          agent: "claude",
          session: "s",
          model,
          provider: `anthropic${controls}`,
          input: 1,
          output: 1,
          reasoning: 0,
          cacheRead: 0,
          cacheWrite: 0,
        },
      ],
    },
    {
      command: "report",
      config: {
        ...DEFAULT_CONFIG,
        words: [{ word: "marker", kind: "swear", language: "en", group }],
      },
      offline: true,
      noRoast: true,
    },
    { source: "fallback", models: {} },
    "2026-10-05T12:00:00Z",
  );
}

test("terminal data cannot inject escapes or controls and application colors still work", () => {
  const report = reportWith(`model${controls}\r\nspoofed-row`, "g\x07\x9f");
  report.diagnostics = [
    { agent: "claude", status: "skipped", path: `path${controls}`, detail: `detail${controls}` },
  ];
  for (const command of ["report", "doctor"]) {
    const data = { ...report, command };
    const plain = renderTerminal(data, { color: false, width: 42 });
    const colored = renderTerminal(data, { color: true, width: 42 });
    assert.ok(!forbidden.test(plain));
    assert.ok(!colored.includes("\x1b[2J"));
    assert.ok(!colored.includes("\x1b]52"));
    assert.ok(colored.includes("\x1b["));
    assert.equal(stripVTControlCharacters(colored), plain);
    if (command === "report") assert.ok(plain.includes("model spoofed-row"));
  }
});

test("Markdown fields cannot introduce raw HTML, images, links, or fences", () => {
  const report = reportWith(markup, markup);
  const markdown = renderMarkdown(report);
  assert.ok(!markdown.includes('<img src=x onerror="evil()">'));
  assert.ok(!markdown.includes("[run](javascript:evil)"));
  assert.ok(!markdown.includes("![image](https://example.test)"));
  assert.ok(!markdown.includes("`code`"));
  assert.ok(markdown.includes("&lt;img"));
  assert.ok(markdown.includes("&amp;"));
  assert.match(markdown, /^# RageReport\n/u);
  assert.ok(markdown.includes("| Agent | Model | Day | Records | Estimate |"));
  assert.ok(markdown.includes("marker (1)"));
});

async function history(t, model) {
  const home = await mkdtemp(join(tmpdir(), "rage-output-"));
  t.after(() => rm(home, { recursive: true, force: true }));
  const path = join(home, "history.jsonl");
  await writeLines(path, [
    {
      type: "assistant",
      message: {
        role: "assistant",
        content: "safe",
        model,
        usage: { input_tokens: 1, output_tokens: 1 },
      },
    },
  ]);
  const config = join(home, "config.json");
  await writeJson(config, { paths: { claude: [path] } });
  return { home, config };
}

test("actual CLI neutralizes history controls in cost stdout and argument errors", async (t) => {
  const { home, config } = await history(t, `claude-safe${controls}`);
  const result = await execute(process.execPath, [
    cli,
    "cost",
    "--config",
    config,
    "--home",
    home,
    "--offline",
    "--no-progress",
    "--no-color",
    "--format",
    "terminal",
  ]);
  assert.ok(!forbidden.test(result.stdout));
  assert.match(result.stdout, /claude-safe/u);
  await assert.rejects(
    execute(process.execPath, [cli, "--agent", `bad${controls.replaceAll("\x00", "")}`]),
    (error) => {
      assert.ok(!forbidden.test(error.stderr));
      assert.match(error.stderr, /Unknown agent/u);
      return error.code === 1;
    },
  );
});

test("actual Markdown exports escape model markup while JSON preserves literal data", async (t) => {
  const { home, config } = await history(t, `claude-${markup}`);
  const args = [
    cli,
    "cost",
    "--config",
    config,
    "--home",
    home,
    "--offline",
    "--no-progress",
    "--format",
  ];
  const markdown = (await execute(process.execPath, [...args, "markdown"])).stdout;
  assert.ok(!markdown.includes('<img src=x onerror="evil()">'));
  assert.ok(!markdown.includes("[run](javascript:evil)"));
  const json = JSON.parse((await execute(process.execPath, [...args, "json"])).stdout);
  assert.equal(json.cost.rows[0].model, `claude-${markup}`);
});

test(
  "saved-path announcements cannot inject terminal controls",
  { skip: process.platform === "win32" },
  async (t) => {
    const { home, config } = await history(t, "claude-safe");
    const output = join(home, "out\x1b[2J.md");
    const result = await execute(process.execPath, [
      cli,
      "cost",
      "--config",
      config,
      "--home",
      home,
      "--offline",
      "--no-progress",
      "--format",
      "markdown",
      "--output",
      output,
    ]);
    assert.ok(!forbidden.test(result.stderr));
    assert.match(result.stderr, /RageReport saved:/u);
  },
);
