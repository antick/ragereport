import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
import { test } from "node:test";

const dist = new URL("../dist/", import.meta.url);

test("published landing links, canonical URL, and the synthetic demo are complete", async () => {
  const html = await readFile(new URL("index.html", dist), "utf8");
  assert.match(html, /<html lang="en"/);
  assert.match(html, /rel="canonical" href="https:\/\/ragereport\.potion\.sh"/);
  assert.match(html, /Npm release coming soon/);
  const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
  const targets = new Set([...html.matchAll(/\b(?:href|src)="([^"]+)"/g)].map((m) => m[1]));
  for (const target of targets) {
    if (target.startsWith("#")) assert.ok(ids.has(target.slice(1)), `Missing anchor: ${target}`);
    else if (target.startsWith("/") && target !== "/") await access(new URL(target.slice(1), dist));
  }
  const demo = await readFile(new URL("demo.html", dist), "utf8");
  assert.match(demo, /Keyboard on Fire/);
  assert.doesNotMatch(demo, /sample-home|\/Users\/|\/home\/|[A-Z]:\\Users\\/);
  assert.doesNotMatch(demo, /<script[^>]+src=/);
});
