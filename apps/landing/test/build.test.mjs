import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
import { test } from "node:test";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const dist = new URL("../dist/", import.meta.url);

test("landing contains real CLI help, npm commands, and complete links without dummy reports", async () => {
  const html = await readFile(new URL("index.html", dist), "utf8");
  assert.match(html, /<html lang="en"/);
  assert.match(html, /rel="canonical" href="https:\/\/ragereport\.potion\.sh"/);
  assert.match(html, /Available on npm/);
  assert.match(html, /npx ragereport/);
  assert.doesNotMatch(
    html,
    /SYNTHETIC DATA|Open sample report|Npm release coming soon|pnpm cli|\/demo\.html/,
  );
  const help = execFileSync(
    process.execPath,
    [fileURLToPath(new URL("../../../packages/ragereport/dist/cli.js", import.meta.url)), "--help"],
    { encoding: "utf8" },
  );
  assert.ok(html.includes(help.trim().split("\n\n").slice(0, 3).join("\n\n")));
  const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
  const targets = new Set([...html.matchAll(/\b(?:href|src)="([^"]+)"/g)].map((m) => m[1]));
  for (const target of targets) {
    if (target.startsWith("#")) assert.ok(ids.has(target.slice(1)), `Missing anchor: ${target}`);
    else if (target.startsWith("/") && target !== "/") await access(new URL(target.slice(1), dist));
  }
  assert.doesNotMatch(html, /sample-home|\/Users\/|\/home\/|[A-Z]:\\Users\\/);
  await assert.rejects(access(new URL("demo.html", dist)), { code: "ENOENT" });
});
