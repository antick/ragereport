import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runInNewContext } from "node:vm";
import { build } from "esbuild";

// Inject filesystem failures into the real helper without changing its public interface.
const compiled = await build({
  stdin: {
    contents:
      'export { writePrivateFile } from "./src/utils/files.ts"; export { FILE_ACCESS } from "./src/config/constants.ts";',
    resolveDir: process.cwd(),
  },
  bundle: true,
  platform: "node",
  format: "cjs",
  write: false,
});
const nodeRequire = createRequire(import.meta.url);

function writer(platform, replace) {
  const module = { exports: {} };
  const waits = [];
  runInNewContext(compiled.outputFiles[0].text, {
    module,
    exports: module.exports,
    process: { platform },
    Error,
    require(name) {
      const original = nodeRequire(name);
      if (name === "node:fs/promises") return { ...original, rename: replace };
      if (name === "node:timers/promises")
        return { ...original, setTimeout: async (delay) => waits.push(delay) };
      return original;
    },
  });
  return { ...module.exports, waits };
}

async function directory(t) {
  const root = await mkdtemp(join(tmpdir(), "rage-rename-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

test("Windows replacement recovers from temporary locks without partial files or leftover artifacts", async (t) => {
  const root = await directory(t);
  const output = join(root, "report.json");
  await writeFile(output, "previous report");
  let attempts = 0;
  const helper = writer("win32", async (source, destination) => {
    if (++attempts <= 2) throw Object.assign(new Error("File locked"), { code: "EPERM" });
    await rename(source, destination);
  });
  await helper.writePrivateFile(output, "complete new report");
  assert.equal(attempts, 3);
  assert.deepEqual(helper.waits, [
    helper.FILE_ACCESS.renameRetryMs,
    helper.FILE_ACCESS.renameRetryMs * 2,
  ]);
  assert.equal(await readFile(output, "utf8"), "complete new report");
  assert.deepEqual(await readdir(root), ["report.json"]);
});

test("permanent locks stop retrying, other errors fail immediately, and previous reports survive", async (t) => {
  const root = await directory(t);
  const output = join(root, "report.json");
  await writeFile(output, "previous report");
  for (const [platform, code] of [
    ["win32", "EPERM"],
    ["win32", "EIO"],
    ["linux", "EPERM"],
  ]) {
    let attempts = 0;
    const helper = writer(platform, async () => {
      attempts++;
      throw Object.assign(new Error("Replacement failed"), { code });
    });
    await assert.rejects(helper.writePrivateFile(output, "new report"), { code });
    const expected =
      platform === "win32" && code === "EPERM" ? helper.FILE_ACCESS.renameAttempts : 1;
    assert.equal(attempts, expected);
    assert.equal(helper.waits.length, expected - 1);
    assert.equal(await readFile(output, "utf8"), "previous report");
    assert.deepEqual(await readdir(root), ["report.json"]);
  }
});
