import { build } from "esbuild";
import { chmod, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { watch } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const WATCH_DEBOUNCE_MS = 150;
process.chdir(root);
const watching = process.argv.includes("--watch");
async function buildAll(clean = false) {
  if (clean) await rm("dist", { recursive: true, force: true });
  await mkdir("dist", { recursive: true });
  const browser = await build({
    entryPoints: ["src/browser/report.ts"],
    bundle: true,
    write: false,
    platform: "browser",
    target: "es2022",
    format: "iife",
    minify: true,
  });
  const common = {
    bundle: true,
    platform: "node",
    target: "node24",
    format: "esm",
    sourcemap: true,
    loader: { ".css": "text" },
    define: { __REPORT_SCRIPT__: JSON.stringify(browser.outputFiles[0].text) },
  };
  await Promise.all([
    build({
      ...common,
      entryPoints: ["src/cli.ts"],
      outfile: "dist/cli.js",
      banner: { js: "#!/usr/bin/env node" },
    }),
    build({ ...common, entryPoints: ["src/index.ts"], outfile: "dist/index.js" }),
  ]);
  execFileSync(process.execPath, ["node_modules/typescript/bin/tsc", "-p", "tsconfig.build.json"], {
    stdio: "inherit",
  });
  await chmod("dist/cli.js", 0o755);
  const manifest = JSON.parse(await readFile("package.json", "utf8"));
  await writeFile("dist/version.json", JSON.stringify({ version: manifest.version }));
  console.log("Built RageReport CLI, library, and standalone reports");
}
await buildAll(!watching);
if (watching) {
  let pending;
  let building = false;
  let changed = false;
  const rebuild = async () => {
    if (building) {
      changed = true;
      return;
    }
    building = true;
    do {
      changed = false;
      try {
        await buildAll();
      } catch (error) {
        console.error(error);
      }
    } while (changed);
    building = false;
  };
  const watcher = watch("src", { recursive: true }, () => {
    clearTimeout(pending);
    pending = setTimeout(rebuild, WATCH_DEBOUNCE_MS);
  });
  const stop = () => {
    clearTimeout(pending);
    watcher.close();
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  console.log("Watching RageReport source");
}
