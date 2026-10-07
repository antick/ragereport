import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { analyze, DEFAULT_CONFIG, pricingCachePath } from "../dist/index.js";
import { fixtureHome, writeLines, DATE } from "./fixtures.mjs";

test("scan cache reuses aggregates and invalidates on history, config, and expiry changes", async () => {
  const home = await fixtureHome();
  const events = [];
  const options = {
    command: "scan",
    config: structuredClone(DEFAULT_CONFIG),
    home,
    offline: true,
    refreshPrices: false,
    noRoast: true,
    cache: true,
    onProgress: (event) => events.push(event),
  };
  try {
    const first = await analyze(options);
    assert.equal(first.language.swears, 8);
    assert.ok(events.some((event) => event.type === "file"));
    const directory = join(dirname(pricingCachePath(home, {})), "scans");
    const filename = (await readdir(directory)).find((name) => name.endsWith(".json"));
    assert.ok(filename);
    const path = join(directory, filename);
    assert.equal(
      (await stat(path)).mode & 0o777,
      process.platform === "win32" ? (await stat(path)).mode & 0o777 : 0o600,
    );
    const stored = await readFile(path, "utf8");
    assert.ok(!stored.includes("chutiya bug shukriya"));
    assert.ok(!stored.includes('"text":'));
    events.length = 0;
    const second = await analyze(options);
    assert.deepEqual(second.language, first.language);
    assert.ok(events.some((event) => event.stage === "cached"));
    assert.ok(!events.some((event) => event.type === "file" || event.type === "bytes"));
    events.length = 0;
    await analyze({ ...options, cache: false });
    assert.ok(events.some((event) => event.type === "file"));
    assert.ok(!events.some((event) => event.stage === "cached"));
    const expired = JSON.parse(stored);
    expired.expiresAt = 0;
    await writeFile(path, JSON.stringify(expired));
    events.length = 0;
    await analyze(options);
    assert.ok(events.some((event) => event.type === "file"));
    await writeFile(path, "not json");
    events.length = 0;
    await analyze(options);
    assert.ok(events.some((event) => event.type === "file"));
    const changed = await analyze({
      ...options,
      config: { ...options.config, ignoreWords: ["fuck"] },
    });
    assert.equal(changed.language.swears, 6);
    await writeLines(join(home, ".codex/sessions/extra.jsonl"), [
      {
        type: "response_item",
        timestamp: DATE,
        payload: { type: "message", role: "user", content: [{ type: "input_text", text: "wtf" }] },
      },
    ]);
    events.length = 0;
    const updated = await analyze(options);
    assert.equal(updated.language.swears, 9);
    assert.ok(events.some((event) => event.type === "file"));
    assert.ok(
      events.filter((event) => event.type === "file").length < 5,
      "Unchanged large histories were re-read after adding one file",
    );
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("cached file aggregates preserve streamed snapshots and disjoint text with the same native ID", async () => {
  const home = await mkdtemp(join(tmpdir(), "ragereport-cache-snapshots-"));
  const events = [];
  const options = {
    command: "scan",
    agent: "codex",
    config: structuredClone(DEFAULT_CONFIG),
    home,
    offline: true,
    refreshPrices: false,
    noRoast: true,
    cache: true,
    onProgress: (event) => events.push(event),
  };
  const message = (id, text) => ({
    type: "response_item",
    timestamp: DATE,
    payload: { type: "message", role: "user", id, content: [{ type: "input_text", text }] },
  });
  const metadata = { type: "session_meta", payload: { id: "shared-session" } };
  try {
    await writeLines(join(home, ".codex/sessions/first.jsonl"), [
      metadata,
      message("streamed", "fuck"),
      message("disjoint", "wtf"),
    ]);
    await writeLines(join(home, ".codex/sessions/second.jsonl"), [
      metadata,
      message("streamed", "fuck shit"),
      message("disjoint", "chutiya"),
    ]);
    const fresh = await analyze({ ...options, cache: false });
    assert.equal(fresh.language.swears, 4);
    assert.equal(fresh.language.messages, 2);
    const first = await analyze(options);
    assert.deepEqual(first.language, fresh.language);
    const directory = join(dirname(pricingCachePath(home, {})), "scans");
    for (const name of await readdir(directory))
      if (name.endsWith(".json")) await rm(join(directory, name));
    events.length = 0;
    const cached = await analyze(options);
    assert.deepEqual(cached.language, fresh.language);
    assert.equal(events.filter((event) => event.type === "cached-file").length, 2);
    assert.equal(events.filter((event) => event.type === "file").length, 2);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});
