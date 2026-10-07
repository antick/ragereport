import { createReadStream } from "node:fs";
import { LIMITS } from "../config/constants.js";
import type { AgentName, ReaderContext } from "../types.js";

export type LineCandidate = (line: string, complete: boolean) => boolean;

export async function* lineBuffers(
  path: string,
  context: ReaderContext,
  agent: AgentName,
  candidate?: LineCandidate,
): AsyncGenerator<Buffer> {
  const stream = createReadStream(path, { highWaterMark: LIMITS.streamBytes });
  let parts: Buffer[] = [];
  let length = 0;
  let checked = false;
  let skipping = false;
  try {
    for await (const chunk of stream) {
      const buffer = chunk as Buffer;
      context.onProgress?.({ type: "bytes", agent, bytes: buffer.length });
      let start = 0;
      while (start < buffer.length) {
        const newline = buffer.indexOf(10, start);
        const end = newline < 0 ? buffer.length : newline;
        if (!skipping) {
          const part = buffer.subarray(start, end);
          parts.push(part);
          length += part.length;
          if (!checked && (length >= LIMITS.jsonHeaderBytes || newline >= 0)) {
            const head =
              parts.length === 1
                ? parts[0]!
                : Buffer.concat(parts, Math.min(length, LIMITS.jsonHeaderBytes));
            skipping = candidate
              ? !candidate(
                  head.subarray(0, LIMITS.jsonHeaderBytes).toString("utf8"),
                  newline >= 0 && length <= LIMITS.jsonHeaderBytes,
                )
              : false;
            checked = true;
            if (skipping) parts = [];
          }
        }
        if (newline >= 0) {
          if (!skipping) yield parts.length === 1 ? parts[0]! : Buffer.concat(parts, length);
          parts = [];
          length = 0;
          checked = skipping = false;
        }
        start = end + (newline >= 0 ? 1 : 0);
      }
    }
    if (!skipping && length) yield parts.length === 1 ? parts[0]! : Buffer.concat(parts, length);
  } finally {
    stream.destroy();
  }
}
