import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { readFile, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fixtureHome, writeJson } from "./fixtures.mjs";
const execute = promisify(execFile);
const cli = resolve("dist/cli.js");
let home;
before(async () => {
  home = await fixtureHome();
});
after(async () => {
  await rm(home, { recursive: true, force: true });
});
async function run(...args) {
  return execute(process.execPath, [cli, "--home", home, "--offline", ...args], { cwd: home });
}
test("default command scans both languages and emits clean machine-readable JSON", async () => {
  const result = await run("--format", "json");
  const report = JSON.parse(result.stdout);
  assert.equal(report.command, "scan");
  assert.equal(report.language.messages, 9);
  assert.equal(report.language.swears, 8);
  assert.equal(report.language.polite, 10);
  assert.equal(result.stderr, "");
});
test("cost and combined reports include available usage, while unsupported usage is unavailable", async () => {
  const costs = JSON.parse((await run("cost", "--format", "json")).stdout);
  assert.equal(costs.cost.requests, 7);
  assert.equal(costs.cost.unpricedRequests, 1);
  assert.equal(costs.agents.find((a) => a.agent === "t3code").cost.unpricedRequests, 1);
  assert.equal(costs.agents.find((a) => a.agent === "cline").cost.estimatedCost, null);
  assert.equal(costs.agents.find((a) => a.agent === "pi").cost.unpricedRequests, 0);
  const combined = JSON.parse((await run("report", "--format", "json")).stdout);
  assert.equal(combined.slop.messages, 9);
  assert.ok(combined.slop.hits > 0);
});
test("HTML, Markdown, JSON files, and SVG cards can be exported", async () => {
  await run("report");
  assert.match(await readFile(join(home, "ragereport.html"), "utf8"), /RageReport/);
  await run("cost");
  assert.match(await readFile(join(home, "ragereport-cost.html"), "utf8"), /Token costs/);
  await run("report", "--format", "svg");
  assert.match(await readFile(join(home, "ragereport-card.svg"), "utf8"), /<svg/);
  await run("scan", "--format", "markdown", "--output", join(home, "summary.md"));
  assert.match(await readFile(join(home, "summary.md"), "utf8"), /# RageReport/);
  await run("scan", "--format", "json", "--output", join(home, "summary.json"));
  assert.equal(JSON.parse(await readFile(join(home, "summary.json"), "utf8")).language.swears, 8);
});
test("filters, dates, and config overrides affect real CLI results", async () => {
  const hindi = JSON.parse(
    (await run("scan", "--agent", "codex", "--language", "hi", "--format", "json")).stdout,
  );
  assert.equal(hindi.language.swears, 1);
  assert.equal(hindi.language.polite, 1);
  const future = JSON.parse(
    (await run("scan", "--since", "2026-10-05", "--format", "json")).stdout,
  );
  assert.equal(future.language.messages, 0);
  const config = join(home, "settings.json");
  await writeJson(config, { languages: ["en"], ignoreWords: ["fuck"] });
  const configured = JSON.parse((await run("scan", "--config", config, "--format", "json")).stdout);
  assert.equal(configured.language.swears, 2);
});
test("doctor identifies files read and missing locations", async () => {
  const report = JSON.parse((await run("doctor", "--format", "json")).stdout);
  assert.ok(report.diagnostics.some((d) => d.agent === "cursor" && d.status === "read"));
  assert.ok(report.diagnostics.some((d) => d.status === "missing"));
});
test("unknown commands, missing values, and conflicting ranges fail clearly", async () => {
  for (const args of [
    ["oops"],
    ["--agent", "wrong"],
    ["--agent"],
    ["--since", "2026-02-30"],
    ["--days", "0"],
    ["--week", "--month"],
    ["--bogus"],
    ["--since", "2026-10-05", "--until", "2026-10-01"],
  ]) {
    await assert.rejects(
      run(...args),
      (error) => error.code === 1 && /RageReport:/.test(error.stderr),
    );
  }
  const bad = join(home, "bad-config.json");
  await writeJson(bad, { unknownKey: true });
  await assert.rejects(run("--config", bad));
});
test("version is read from the package and help requires no history", async () => {
  const version = JSON.parse(await readFile(resolve("package.json"), "utf8")).version;
  assert.equal((await run("--version")).stdout.trim(), version);
  assert.match((await run("--help")).stdout, /phonetic Hindi/);
});
test("terminal color flags work while JSON and written reports stay free of ANSI", async () => {
  const escape = String.fromCharCode(27);
  const colored = await run("scan", "--color", "--no-progress");
  assert.ok(colored.stdout.includes(`${escape}[`));
  assert.match(colored.stdout, /RAGE REPORT/u);
  assert.match(colored.stdout, /Completed in/u);
  const plain = await run("scan", "--no-color", "--no-progress");
  assert.ok(!plain.stdout.includes(escape));
  assert.equal(plain.stderr, "");
  const json = await run("scan", "--color", "--format", "json");
  assert.equal(JSON.parse(json.stdout).language.swears, 8);
  assert.ok(!json.stdout.includes(escape));
  const output = join(home, "plain.txt");
  await run("scan", "--color", "--output", output, "--no-progress");
  assert.ok(!(await readFile(output, "utf8")).includes(escape));
  await assert.rejects(run("--color", "--no-color"));
});
test("terminal reports are colored by default even when embedded-terminal detection suppresses colors", async () => {
  const result = await execute(process.execPath, [cli, "scan", "--home", home, "--no-progress"], {
    cwd: home,
    env: {
      ...process.env,
      TERM: "dumb",
      NO_COLOR: "1",
      NODE_DISABLE_COLORS: "1",
      FORCE_COLOR: "0",
    },
  });
  assert.ok(result.stdout.includes(`${String.fromCharCode(27)}[`));
  assert.match(result.stdout, /RAGE REPORT/u);
});
test(
  "watch refreshes the report and exits cleanly on SIGTERM",
  {
    skip:
      process.platform === "win32" ? "Windows cannot send Unix SIGTERM to a child process" : false,
  },
  async () => {
    const child = spawn(
      process.execPath,
      [
        cli,
        "report",
        "--home",
        home,
        "--offline",
        "--watch",
        "--watch-interval",
        "1",
        "--output",
        join(home, "watch.html"),
      ],
      { cwd: home, stdio: ["ignore", "pipe", "pipe"] },
    );
    await new Promise((resolveDone, reject) => {
      const timer = setTimeout(() => {
        child.kill();
        reject(new Error("Watch did not refresh"));
      }, 10_000);
      let output = "";
      child.stderr.on("data", (bytes) => {
        output += bytes.toString();
        if ((output.match(/RageReport saved:/g) ?? []).length >= 2) child.kill("SIGTERM");
      });
      child.on("error", reject);
      child.on("exit", (code, signal) => {
        clearTimeout(timer);
        if (code === 0 && !signal) resolveDone();
        else reject(new Error(`Watch stopped unexpectedly: ${code}/${signal}: ${output}`));
      });
    });
    assert.match(await readFile(join(home, "watch.html"), "utf8"), /RageReport/);
  },
);
