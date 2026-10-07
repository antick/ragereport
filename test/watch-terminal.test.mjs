import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fixtureHome, writeLines, DATE } from "./fixtures.mjs";

test(
  "terminal watch refreshes counts after history changes and stops cleanly",
  {
    skip:
      process.platform === "win32" ? "Windows cannot send Unix SIGTERM to a child process" : false,
  },
  async () => {
    const home = await fixtureHome();
    const child = spawn(
      process.execPath,
      [
        resolve("dist/cli.js"),
        "scan",
        "--home",
        home,
        "--watch",
        "--watch-interval",
        "1",
        "--no-color",
        "--no-progress",
      ],
      { cwd: home, stdio: ["ignore", "pipe", "pipe"] },
    );
    let output = "";
    let errors = "";
    let changed = false;
    try {
      await new Promise((resolveDone, reject) => {
        const timeout = setTimeout(() => {
          child.kill("SIGTERM");
          reject(new Error("Terminal watch did not refresh"));
        }, 10000);
        child.stdout.on("data", (chunk) => {
          output += chunk.toString();
          if (!changed && output.includes("Completed in")) {
            changed = true;
            writeLines(join(home, ".codex/sessions/watch-extra.jsonl"), [
              {
                type: "response_item",
                timestamp: DATE,
                payload: {
                  type: "message",
                  role: "user",
                  id: "watch-extra",
                  content: [{ type: "input_text", text: "bhadwa" }],
                },
              },
            ]).catch(reject);
          }
          if (
            (output.match(/Completed in/gu) ?? []).length >= 2 &&
            /^  Swears\s+9\s*$/mu.test(output)
          )
            child.kill("SIGTERM");
        });
        child.stderr.on("data", (chunk) => {
          errors += chunk.toString();
        });
        child.on("error", reject);
        child.on("exit", (code, signal) => {
          clearTimeout(timeout);
          if (code === 0 && !signal) resolveDone();
          else reject(new Error(`Watch stopped unexpectedly: ${code}/${signal}: ${errors}`));
        });
      });
      assert.match(output, /^  Swears\s+8\s*$/mu);
      assert.match(output, /^  Swears\s+9\s*$/mu);
      assert.match(output, /THE KEYBOARD CALENDAR/u);
      assert.match(output, /PROJECT COMPARISON/u);
    } finally {
      if (child.exitCode === null) child.kill("SIGTERM");
      await rm(home, { recursive: true, force: true });
    }
  },
);
