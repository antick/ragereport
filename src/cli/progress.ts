import type { ProgressEvent } from "../types.js";
import { LIMITS } from "../config/constants.js";
import { TERMINAL } from "../config/terminal.js";
import { count } from "../utils/format.js";
import { paint } from "../reports/terminal-style.js";
import { terminalText } from "../utils/terminal.js";

export function createProgress(enabled: boolean, color: boolean) {
  let stage = "Locating histories";
  let agent = "";
  let files = 0;
  let bytes = 0;
  let messages = 0;
  let usage = 0;
  let frame = 0;
  let lastLog = 0;
  let cached = false;
  let reused = 0;
  const describe = () =>
    `${stage}${agent ? ` · ${agent}` : ""}${files ? ` · ${count(files)} files read` : ""}${reused ? ` · ${count(reused)} files cached` : ""}${bytes ? ` · ${(bytes / 1024 ** 3).toFixed(2)} GB JSONL read` : ""}${messages ? ` · ${count(messages)} messages` : ""}${usage ? ` · ${count(usage)} usage records` : ""}`;
  const draw = () => {
    if (!enabled) return;
    const now = Date.now();
    if (process.stderr.isTTY) {
      const columns = process.stderr.columns || TERMINAL.width;
      const label = `${TERMINAL.frames[frame++ % TERMINAL.frames.length]} ${describe()}`;
      process.stderr.write(`\r\u001b[2K${paint(color, "cyan", label.slice(0, columns - 1))}`);
    } else if (now - lastLog >= LIMITS.progressLogMs) {
      process.stderr.write(`RageReport: ${terminalText(describe())}\n`);
      lastLog = now;
    }
  };
  draw();
  const timer = enabled ? setInterval(draw, LIMITS.progressMs) : undefined;
  return {
    update(event: ProgressEvent) {
      if (event.type === "source") {
        stage = "Reading";
        agent = event.agent;
        draw();
      } else if (event.type === "file") files++;
      else if (event.type === "cached-file") reused++;
      else if (event.type === "bytes") bytes += event.bytes;
      else if (event.type === "records") {
        messages += event.messages;
        usage += event.usage;
      } else if (event.type === "stage") {
        const names = {
          discovering: "Locating histories",
          analysis: "Counting language",
          pricing: "Checking prices",
          cached: "Using unchanged-history cache",
        };
        stage = names[event.stage];
        agent = "";
        if (event.stage === "cached") cached = true;
        draw();
      }
    },
    get cacheLabel() {
      return cached
        ? "unchanged-history cache"
        : reused
          ? `${count(reused)} cached history files`
          : "";
    },
    stop() {
      if (timer) clearInterval(timer);
      if (enabled && process.stderr.isTTY) process.stderr.write("\r\u001b[2K");
    },
  };
}
