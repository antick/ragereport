import test from "node:test";
import assert from "node:assert/strict";
import { createDetector, DEFAULT_CONFIG, detect, detectSlop, tier } from "../dist/index.js";

test("hostnames and email hosts do not count, but URL paths and standalone words do", () => {
  assert.equal(
    detect("luxx.wtf https://luxx.wtf/profile admin@luxx.wtf (https://luxx.wtf:8080).").length,
    0,
  );
  assert.equal(detect("https://example.com/wtf wtf. wtf is this?").length, 3);
  assert.equal(detect("//luxx.wtf/#wtf").length, 1);
  assert.equal(
    detect("https://user:password@luxx.wtf/wtf?shit=1#fuck").filter((m) => m.kind === "swear")
      .length,
    3,
  );
});
test("stretched words keep their original positions and are counted once", () => {
  const text = "luxx wtf fuuuuck shiiiit asshole";
  const matches = detect(text);
  assert.equal(matches.length, 4);
  assert.deepEqual(
    matches.map((m) => text.slice(m.index, m.end)),
    ["wtf", "fuuuuck", "shiiiit", "asshole"],
  );
  assert.equal(matches[0].index, 5);
  assert.equal(detect("as class classic shell assignment function").length, 0);
});
test("Hindi is matched through English spellings, with mild insults separate", () => {
  const matches = detect(
    "CHUTIYA chutiyaa bhosdike bsdk bhenchod madarchod gaandu lawda. shukriya dhanyawad kripya meherbani bewakoof bakwaas saala",
  );
  assert.equal(matches.filter((m) => m.kind === "swear").length, 8);
  assert.equal(matches.filter((m) => m.kind === "polite").length, 4);
  assert.equal(matches.filter((m) => m.kind === "insult").length, 3);
  assert.equal(detect("bc mc sale gand").length, 0);
  assert.equal(detect("bc mc", { ...DEFAULT_CONFIG, looseMatching: true }).length, 2);
});
test("language filters, code masking, custom words, ignores, and regex literals work", () => {
  assert.equal(detect("fuck chutiya", { ...DEFAULT_CONFIG, languages: ["hi"] }).length, 1);
  assert.equal(detect("`fuck` ```js\nshit\n``` thanks").length, 1);
  assert.equal(detect("`fuck`", { ...DEFAULT_CONFIG, includeCode: true }).length, 1);
  const detector = createDetector({
    ...DEFAULT_CONFIG,
    ignoreWords: ["fuck"],
    words: [
      { word: "a+b", kind: "insult", language: "en" },
      { word: "cheers", kind: "polite", language: "en" },
    ],
  });
  assert.deepEqual(
    detector("fuck a+b cheers").map((m) => m.word),
    ["a+b", "cheers"],
  );
});
test("longer compounds and politeness phrases do not double-count", () => {
  assert.equal(detect("motherfucking bullshit thank you").length, 3);
  assert.equal(detect("lmao lmfaao thanks appreciated").length, 4);
});
test("large code blocks and many matches preserve positions without pairwise overlap scans", () => {
  const text = `\`\`\`\n${"😀 const hello = world;\n".repeat(10000)}\`\`\` wtf ${"fuck ".repeat(20000)}`;
  const matches = detect(text);
  assert.equal(matches.length, 20001);
  assert.equal(matches[0].index, text.indexOf("wtf"));
  assert.equal(matches[0].text, "wtf");
  assert.equal(text.slice(matches.at(-1).index, matches.at(-1).end), "fuck");
});
test("indexed defaults match the general detector across variants, boundaries, URLs, and code", () => {
  const sentinel = "never_match_this_sentinel";
  const general = createDetector({
    ...DEFAULT_CONFIG,
    words: [{ word: sentinel, kind: "insult", language: "en" }],
    ignoreWords: [sentinel],
  });
  const fast = createDetector();
  const pieces = [
    "ass as class assSSS",
    "mothafucka motherfucking fuuuuck",
    "shiiiit shitty",
    "gandu gaandu gand",
    "please pls plz thaaank yooou thanks",
    "madar-chod madarchod",
    "https://luxx.wtf/wtf?shit=1",
    "`fuck 😀` shit",
    "FUCK foo_fuck fuck12 xfuck",
    "ſhit fucK",
    "chutiya shukriya baakwaas",
  ];
  for (let index = 0; index < 100; index++) {
    const text = pieces[index % pieces.length] + " | " + pieces[(index * 7 + 3) % pieces.length];
    assert.deepEqual(fast(text), general(text));
  }
});
test("tiers preserve six boundaries and distinguish no signals from no politeness", () => {
  assert.equal(tier(0, 0).status, "no-signals");
  assert.equal(tier(1, 0).status, "no-politeness");
  assert.equal(tier(14, 100).name, "Calm Waters");
  assert.equal(tier(15, 100).name, "Mostly Chill");
  assert.equal(tier(25, 100).name, "Warming Up");
  assert.equal(tier(35, 100).name, "Pressure Cooker");
  assert.equal(tier(50, 100).name, "Rage Storm");
  assert.equal(tier(67, 100).name, "Keyboard on Fire");
  assert.equal(tier(1, 1, true).label, "");
});
test("assistant patterns ignore code and select non-overlapping phrases", () => {
  assert.equal(detectSlop("You're absolutely right. The key insight is load-bearing.").length, 3);
  assert.equal(detectSlop("```\nkey insight\n``` `load-bearing`").length, 0);
  assert.ok(detectSlop("✅ One\n✅ Two\n✅ Three").some((m) => m.tell === "checkmark wall"));
});

test("tier names and both roast choices use English report copy", () => {
  const random = Math.random;
  try {
    for (const selection of [0, 0.999]) {
      Math.random = () => selection;
      for (const swears of [14, 15, 25, 35, 50, 67]) {
        const result = tier(swears, 100);
        assert.doesNotMatch(
          `${result.name} ${result.label}`,
          /\b(?:chai|bhai|thoda|kalesh|dimaag|shaant|abhi|seeti)\b/iu,
        );
      }
    }
  } finally {
    Math.random = random;
  }
});
