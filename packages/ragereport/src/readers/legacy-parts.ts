import { realpath, stat } from "node:fs/promises";
import { join } from "node:path";
import type { ReaderContext } from "../types.js";
import { isWithinDirectory } from "../utils/paths.js";
import { errorMessage } from "../utils/value.js";
import { walk } from "./files.js";

export async function* legacyPartFiles(
  storage: string,
  id: string,
  source: string,
  context: ReaderContext,
): AsyncGenerator<string> {
  const warn = (detail: string) =>
    context.diagnostics.push({ agent: "opencode", path: source, status: "warning", detail });
  // Native IDs are single filename components; never interpret history IDs as paths.
  if (!/^[a-z\d_-]+$/iu.test(id)) {
    warn("Unsafe legacy message ID: message parts were skipped.");
    return;
  }
  try {
    const root = await realpath(storage);
    if (context.historyRoot && (await stat(context.historyRoot)).isDirectory()) {
      const boundary = await realpath(context.historyRoot);
      // An ancestor named "message" must not expand the original configured source scope.
      if (root !== boundary && !isWithinDirectory(boundary, root)) {
        warn(
          "Legacy message storage points outside its configured history directory and was skipped.",
        );
        return;
      }
    }
    const parts = await realpath(join(root, "part"));
    // Resolve both links before checking containment so a valid ID cannot escape via a symlink.
    if (!isWithinDirectory(root, parts)) {
      warn("Legacy message parts point outside their history directory and were skipped.");
      return;
    }
    const candidate = await realpath(join(parts, id));
    if (!isWithinDirectory(parts, candidate)) {
      warn("Legacy message parts point outside their history directory and were skipped.");
      return;
    }
    yield* walk(candidate, [".json"], context, "opencode");
  } catch (error) {
    warn(`Could not read legacy message parts: ${errorMessage(error)}`);
  }
}
