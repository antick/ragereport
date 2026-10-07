import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, symlink } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { analyze, DEFAULT_CONFIG, readHistories, readerContext } from "../dist/index.js";
import { writeJson } from "./fixtures.mjs";

async function fixture(t) {
  const home = await mkdtemp(join(tmpdir(), "rage-parts-"));
  t.after(() => rm(home, { recursive: true, force: true }));
  const storage = join(home, "storage");
  await mkdir(join(storage, "part"), { recursive: true });
  const outside = join(home, "outside");
  await writeJson(join(outside, "private.json"), { type: "text", text: "private outside text" });
  return { storage, outside };
}

async function read(storage) {
  const context = readerContext({ paths: { opencode: [storage] }, env: {} });
  return { data: await readHistories(context, "opencode"), context };
}

test("legacy IDs cannot traverse outside storage and inline messages still work", async (t) => {
  const { storage, outside } = await fixture(t);
  const ids = ["../../outside", "..\\..\\outside", outside, "C:\\outside", ".", ".."];
  for (const [index, id] of ids.entries())
    await writeJson(join(storage, "message", `bad-${index}.json`), {
      id,
      sessionID: `s-${index}`,
      role: "user",
      content: `inline message ${index}`,
    });
  const { data, context } = await read(storage);
  assert.equal(data.messages.length, ids.length);
  assert.ok(data.messages.every((m) => m.text.startsWith("inline message ")));
  assert.ok(!context.diagnostics.some((d) => d.status === "read" && d.path.startsWith(outside)));
  assert.equal(
    context.diagnostics.filter((d) => /Unsafe legacy message ID/u.test(d.detail)).length,
    ids.length,
  );
});

test("legacy part-directory and part-root symlinks cannot escape storage", async (t) => {
  for (const target of ["message-parts", "part-root"]) {
    const { storage, outside } = await fixture(t);
    await writeJson(join(storage, "message", "safe-id.json"), {
      id: "safe-id",
      sessionID: "s",
      role: "user",
      content: "inline message",
    });
    if (target === "part-root") await rm(join(storage, "part"), { recursive: true });
    await symlink(
      outside,
      join(storage, "part", ...(target === "message-parts" ? ["safe-id"] : [])),
      "junction",
    );
    const { data, context } = await read(storage);
    assert.equal(data.messages[0].text, "inline message");
    assert.ok(!context.diagnostics.some((d) => d.status === "read" && d.path.startsWith(outside)));
    assert.ok(context.diagnostics.some((d) => /outside/u.test(d.detail)));
  }
});

test("valid legacy IDs and a storage ancestor named message remain supported", async (t) => {
  const { storage } = await fixture(t);
  const root = join(storage, "message", "nested", "storage");
  const id = "msg_01ABC-def";
  await writeJson(join(root, "message", "s", "m.json"), { id, role: "user", sessionID: "s" });
  await writeJson(join(root, "part", id, "p1.json"), { type: "text", text: "please" });
  await writeJson(join(root, "part", id, "p2.json"), { type: "text", text: "thanks" });
  const { data } = await read(root);
  assert.equal(data.messages.length, 1);
  assert.equal(data.messages[0].text, "please\nthanks");
});

test("an ancestor named message cannot expand configured storage scope, with or without cache", async (t) => {
  const { storage } = await fixture(t);
  const root = join(storage, "message", "imported-storage");
  await writeJson(join(root, "other.json"), { id: "safe-id", role: "user", content: "please" });
  await writeJson(join(storage, "part", "safe-id", "private.json"), {
    type: "text",
    text: "private fuck",
  });
  for (const cache of [false, true]) {
    const report = await analyze({
      command: "scan",
      config: { ...DEFAULT_CONFIG, paths: { opencode: [root] } },
      home: storage,
      offline: true,
      cache,
    });
    assert.equal(report.language.swears, 0);
    assert.equal(report.language.polite, 1);
    assert.ok(report.diagnostics.some((d) => /outside/u.test(d.detail)));
  }
});
