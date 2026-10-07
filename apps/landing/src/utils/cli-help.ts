import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const CLI_PATH = "../../packages/ragereport/dist/cli.js";

export function getCliHelp() {
  // The workspace build runs the CLI first. Help reads no personal history.
  return execFileSync(process.execPath, [resolve(CLI_PATH), "--help"], {
    encoding: "utf8",
  }).trim();
}
