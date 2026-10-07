import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, readdir, rm, stat, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { build } from "esbuild";

// Exercise the internal helper without adding filesystem internals to the public library API.
const compiled = await build({
  entryPoints: ["src/utils/files.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  write: false,
});
const { writePrivateFile } = await import(
  `data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString("base64")}`
);

async function directory(t) {
  const root = await mkdtemp(join(tmpdir(), "rage-write-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

test("private exports ignore old predictable temporary files and replace output atomically", async (t) => {
  const root = await directory(t);
  const output = join(root, "report.html");
  const predictable = `${output}.${process.pid}.tmp`;
  await writeFile(predictable, "unrelated old file", { mode: 0o644 });
  await writePrivateFile(output, "first export");
  await writePrivateFile(output, "second export");
  assert.equal(await readFile(output, "utf8"), "second export");
  assert.equal(await readFile(predictable, "utf8"), "unrelated old file");
  if (process.platform !== "win32") assert.equal((await stat(output)).mode & 0o777, 0o600);
  assert.deepEqual(
    (await readdir(root)).sort(),
    ["report.html", `report.html.${process.pid}.tmp`].sort(),
  );
});

test(
  "planted temporary and output symlinks do not overwrite their targets",
  { skip: process.platform === "win32" },
  async (t) => {
    const root = await directory(t);
    const victim = join(root, "victim.txt");
    const output = join(root, "report.html");
    await writeFile(victim, "synthetic original");
    await symlink(victim, `${output}.${process.pid}.tmp`);
    await symlink(victim, output);
    await writePrivateFile(output, "safe export");
    assert.equal(await readFile(victim, "utf8"), "synthetic original");
    assert.equal(await readFile(output, "utf8"), "safe export");
    assert.equal((await stat(output)).mode & 0o777, 0o600);
  },
);

test("concurrent private writes leave one complete file and no temporary artifacts", async (t) => {
  const root = await directory(t);
  const output = join(root, "report.json");
  const bodies = Array.from({ length: 8 }, (_, i) =>
    JSON.stringify({ i, text: String(i).repeat(50_000) }),
  );
  await Promise.all(bodies.map((body) => writePrivateFile(output, body)));
  assert.ok(bodies.includes(await readFile(output, "utf8")));
  assert.deepEqual(await readdir(root), ["report.json"]);
});

test("failed replacement cleans up its private temporary directory", async (t) => {
  const root = await directory(t);
  const output = join(root, "existing-directory");
  await mkdir(output);
  await writeFile(join(output, "keep.txt"), "keep");
  await assert.rejects(writePrivateFile(output, "cannot replace a directory"));
  assert.equal(await readFile(join(output, "keep.txt"), "utf8"), "keep");
  assert.deepEqual(await readdir(root), ["existing-directory"]);
});
