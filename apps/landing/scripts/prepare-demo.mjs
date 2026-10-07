import { copyFile, mkdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const packageRoot = fileURLToPath(new URL("../../../packages/ragereport/", import.meta.url));
execFileSync(process.execPath, ["scripts/demo.mjs"], { cwd: packageRoot, stdio: "inherit" });
await mkdir(new URL("../public/", import.meta.url), { recursive: true });
await copyFile(
  new URL("../../../packages/ragereport/.demo/ragereport.html", import.meta.url),
  new URL("../public/demo.html", import.meta.url),
);
