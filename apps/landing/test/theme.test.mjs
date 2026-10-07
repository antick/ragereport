import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { runInNewContext } from "node:vm";

const html = await readFile(new URL("../dist/index.html", import.meta.url), "utf8");
const script = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)]
  .map((match) => match[1])
  .find((source) => source.includes("ragereport.theme"));
assert.ok(script, "The theme must initialize in the published HTML before the body paints");

function visit({ hour = 12, saved = null, blockedStorage = false } = {}) {
  const clock = { hour };
  const events = new Map();
  const storage = new Map(saved ? [["ragereport.theme", saved]] : []);
  const root = { dataset: {}, classList: { toggle() {} } };
  const controls = {
    hidden: true,
    addEventListener: (name, listener) => events.set(name, listener),
  };
  const buttons = ["light", "dark", "auto"].map((mode) => ({
    dataset: { themeMode: mode },
    setAttribute(name, value) {
      this[name] = value;
    },
  }));
  runInNewContext(script, {
    Date: class {
      getHours() {
        return clock.hour;
      }
    },
    document: {
      documentElement: root,
      querySelectorAll: (selector) => {
        assert.equal(
          selector,
          "button[data-theme-mode]",
          "Only theme buttons receive pressed state",
        );
        return buttons;
      },
      querySelector: (selector) => (selector === "[data-theme-controls]" ? controls : null),
      addEventListener: (name, listener) => events.set(name, listener),
    },
    getComputedStyle: () => ({ getPropertyValue: () => "" }),
    localStorage: {
      getItem(key) {
        if (blockedStorage) throw new Error("Storage blocked");
        return storage.get(key);
      },
      setItem(key, value) {
        if (blockedStorage) throw new Error("Storage blocked");
        storage.set(key, value);
      },
    },
    window: {
      addEventListener: (name, listener) => events.set(name, listener),
      setInterval: (listener) => events.set("tick", listener),
    },
  });
  events.get("DOMContentLoaded")();
  const select = (mode) =>
    events.get("click")({
      target: { closest: () => buttons.find((button) => button.dataset.themeMode === mode) },
    });
  return { root, clock, events, controls, buttons, storage, select };
}

test("Auto changes at 18:00 and 06:00 using local hours, including while the page stays open", () => {
  for (const [hour, theme] of [
    [0, "dark"],
    [5, "dark"],
    [6, "light"],
    [17, "light"],
    [18, "dark"],
    [23, "dark"],
  ]) {
    const page = visit({ hour });
    assert.equal(page.root.dataset.theme, theme);
    assert.equal(page.root.dataset.themeMode, "auto");
  }
  const page = visit({ hour: 17 });
  page.clock.hour = 18;
  page.events.get("tick")();
  assert.equal(page.root.dataset.theme, "dark");
  page.clock.hour = 6;
  page.events.get("visibilitychange")();
  assert.equal(page.root.dataset.theme, "light");
});

test("manual choice persists across visits and stays selected until Auto is chosen", () => {
  const page = visit();
  page.select("dark");
  assert.equal(page.storage.get("ragereport.theme"), "dark");
  assert.equal(
    page.buttons.find((button) => button.dataset.themeMode === "dark")["aria-pressed"],
    "true",
  );
  assert.equal(visit({ hour: 12, saved: "dark" }).root.dataset.theme, "dark");
  page.clock.hour = 6;
  page.events.get("tick")();
  assert.equal(page.root.dataset.theme, "dark");
  page.select("auto");
  assert.equal(page.root.dataset.theme, "light");
});

test("blocked storage and invalid preferences still allow automatic and manual themes", () => {
  assert.equal(visit({ saved: "invalid", hour: 18 }).root.dataset.theme, "dark");
  const page = visit({ blockedStorage: true });
  assert.equal(page.controls.hidden, false);
  page.select("dark");
  assert.equal(page.root.dataset.theme, "dark");
  page.select("auto");
  assert.equal(page.root.dataset.theme, "light");
  page.events.get("storage")({ key: "ragereport.theme", newValue: "light" });
  assert.equal(page.root.dataset.themeMode, "light");
});
