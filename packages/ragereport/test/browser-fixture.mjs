import { build } from "esbuild";
import { fileURLToPath } from "node:url";

const bundle = await build({
  stdin: {
    contents: 'export * from "./src/browser/data.ts"; export * from "./src/browser/components.ts";',
    resolveDir: fileURLToPath(new URL("..", import.meta.url)),
  },
  bundle: true,
  write: false,
  platform: "node",
  format: "esm",
});
export const browser = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`
);
