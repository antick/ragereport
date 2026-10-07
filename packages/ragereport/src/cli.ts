import { readFile } from "node:fs/promises";
import { parseOptions } from "./cli/options.js";
import { HELP } from "./cli/help.js";
import { runCli } from "./cli/run.js";
import { terminalText } from "./utils/terminal.js";

try {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) process.stdout.write(HELP);
  else if (args.includes("--version")) {
    const version = JSON.parse(
      await readFile(new URL("./version.json", import.meta.url), "utf8"),
    ) as { version: string };
    process.stdout.write(`${version.version}\n`);
  } else await runCli(await parseOptions(args));
} catch (error) {
  process.stderr.write(
    `RageReport: ${terminalText(error instanceof Error ? error.message : error)}\n`,
  );
  process.exitCode = 1;
}
