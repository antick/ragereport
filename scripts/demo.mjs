import { mkdir, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { populateHome } from "../test/fixtures.mjs";
import { analyze, DEFAULT_CONFIG, renderHtml, renderCard } from "../dist/index.js";
import { writeFile } from "node:fs/promises";

const directory = resolve(".demo");
const home = join(directory, "sample-home");
await mkdir(directory, { recursive: true });
await rm(home, { recursive: true, force: true });
await populateHome(home);
const options = {
  command: "report",
  config: structuredClone(DEFAULT_CONFIG),
  home,
  offline: true,
  refreshPrices: false,
  noRoast: false,
};
const report = await analyze(options);
await writeFile(join(directory, "ragereport.html"), renderHtml(report));
await writeFile(join(directory, "ragereport-card.svg"), renderCard(report));
console.log(`Sample report: ${join(directory, "ragereport.html")}`);
console.log(`Sample card: ${join(directory, "ragereport-card.svg")}`);
