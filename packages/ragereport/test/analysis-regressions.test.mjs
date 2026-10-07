import test from "node:test";
import assert from "node:assert/strict";
import { buildReport, DEFAULT_CONFIG, deduplicate, detect, detectSlop } from "../dist/index.js";
const message = {
  agent: "codex",
  session: "native",
  id: "a",
  role: "user",
  text: "fuck",
  timestamp: "2026-10-04T12:00:00.000Z",
};
const mirror = {
  ...message,
  agent: "t3code",
  session: "mirror",
  id: "b",
  originAgent: "codex",
  originSession: "native",
};

test("final streamed content is indexed before removing mirrors, without modifying inputs", () => {
  const inputs = [message, { ...message, text: "fuck please" }, { ...mirror, text: "fuck please" }];
  const before = structuredClone(inputs);
  const result = deduplicate(inputs);
  assert.equal(result.records.length, 1);
  assert.equal(result.records[0].agent, "codex");
  assert.equal(result.records[0].text, "fuck please");
  assert.deepEqual(inputs, before);
  const fragments = [Object.freeze({ ...message }), Object.freeze({ ...message, text: "please" })];
  assert.equal(deduplicate(fragments).records[0].text, "fuck\nplease");
  assert.equal(deduplicate([...fragments, { ...mirror, text: "fuck\nplease" }]).records.length, 1);
});

test("mirror removal requires both origin agent and session, including across time buckets", () => {
  assert.equal(deduplicate([message, { ...mirror, originSession: undefined }]).records.length, 2);
  assert.equal(deduplicate([message, { ...mirror, originAgent: undefined }]).records.length, 2);
  assert.equal(deduplicate([message, { ...mirror, originSession: "other" }]).records.length, 2);
  assert.equal(
    deduplicate([message, { ...mirror, timestamp: "2026-10-04T12:00:02.000Z" }]).records.length,
    1,
  );
  assert.equal(
    deduplicate([message, { ...mirror, timestamp: "2026-10-04T12:00:02.001Z" }]).records.length,
    2,
  );
  assert.equal(deduplicate([message, { ...message, id: "distinct" }]).records.length, 2);
  assert.equal(deduplicate([message, { ...message, id: undefined }]).records.length, 1);
});

test("large repeated native messages and assistant matches preserve every distinct record", () => {
  const records = Array.from({ length: 40000 }, (_, index) => ({
    ...message,
    id: String(index),
    timestamp: new Date(Date.parse(message.timestamp) + index * 3000).toISOString(),
  }));
  assert.equal(deduplicate(records).records.length, records.length);
  assert.equal(detectSlop("— ".repeat(40000)).length, 40000);
});

test("long fences, mixed fence markers, and inline code keep positions and code out of counts", () => {
  for (const block of [
    "````\nconst text = ```;\nfuck\n````",
    "~~~\n```\nfuck\n~~~",
    "````\nfuck\n```\nshit",
    "``fuck``",
  ]) {
    assert.equal(detect(block).length, 0);
    assert.equal(detectSlop(block.replaceAll("fuck", "key insight")).length, 0);
  }
  const prose = "````\nfuck\n```` wtf";
  assert.equal(detect(prose)[0].index, prose.indexOf("wtf"));
});

test("custom dictionary variants cannot collide with inherited object properties", () => {
  const words = ["constructor", "__proto__", "toString"].map((word) => ({
    word,
    kind: "insult",
    language: "en",
  }));
  const report = buildReport(
    { messages: [{ ...message, text: "constructor constructor __proto__ tostring" }], usage: [] },
    {
      command: "scan",
      config: { ...DEFAULT_CONFIG, words },
      offline: true,
      refreshPrices: false,
      noRoast: true,
    },
    { source: "fallback", models: {} },
  );
  const variants = Object.assign({}, ...report.language.insultWords.map((word) => word.variants));
  assert.equal(variants.constructor, 2);
  assert.equal(
    report.language.insultWords.find((word) => word.group === "__proto__").variants.__proto__,
    1,
  );
  assert.equal(variants.tostring, 1);
});
