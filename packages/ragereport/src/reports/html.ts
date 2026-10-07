import { APP } from "../config/constants.js";
import type { Report } from "../types.js";
import { REPORT_CSS } from "./styles.js";
import { projectLabel } from "./escape.js";
declare const __REPORT_SCRIPT__: string;

export function renderHtml(report: Report): string {
  // Shareable HTML includes aggregate counts, never transcripts or local file paths.
  const shared = {
    ...report,
    projects: report.projects.map((p) => ({ ...p, name: projectLabel(p.name) })),
    diagnostics: report.diagnostics.map((d) => ({
      agent: d.agent,
      status: d.status,
      detail:
        d.status === "warning" || d.status === "skipped"
          ? "History could not be fully read. Run doctor locally for details."
          : "",
    })),
  };
  const data = JSON.stringify(shared)
    .replaceAll("<", "\\u003c")
    .replaceAll(">", "\\u003e")
    .replaceAll("&", "\\u0026")
    .replaceAll("\u2028", "\\u2028")
    .replaceAll("\u2029", "\\u2029");
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark"><title>${APP.name} · Local report</title>
<style>${REPORT_CSS}</style></head><body>
<main class="shell">
<header class="masthead"><a class="brand" href="#overview" aria-label="RageReport overview"><span class="brand-icon" aria-hidden="true">R</span>RAGE<span>REPORT</span></a><div class="local-badge"><span></span> LOCAL ANALYSIS</div></header>
<section class="intro"><div><div class="eyebrow">THE STATE OF YOUR KEYBOARD</div><h1>A little rage.<br>A lot of receipts.</h1><p id="scope" class="intro-copy"></p></div><div class="edition"><span>YOUR CODING AGENT RECAP</span><strong id="generated"></strong><span>Private by design. All data stays local.</span></div></section>
<section class="filters" aria-label="Report filters"><label>Agent<select id="agent-filter"><option value="all">All agents</option></select></label><label>Period<select id="range-filter"><option value="all">All included history</option><option value="7">Last 7 days</option><option value="30">Last 30 days</option></select></label><label>Cost model<select id="model-filter"><option value="all">All models</option></select></label><button id="reset-filters" type="button">Reset filters</button><button id="download" type="button">Export summary</button></section>
<p class="filter-note">The model filter applies to costs. All dates use UTC.</p>
<nav class="tabs" aria-label="Report sections"><button type="button" data-tab="overview" aria-selected="true">Overview</button><button type="button" data-tab="language" aria-selected="false">Your language</button><button type="button" data-tab="costs" aria-selected="false">Token costs</button><button type="button" data-tab="assistant" aria-selected="false">Assistant patterns</button></nav>
<div id="report-content" aria-live="polite"></div>
<footer><span>RAGE REPORT / YOUR KEYBOARD HAS STORIES</span><span id="coverage"></span></footer>
</main><noscript><p class="noscript">Enable JavaScript to explore this report, or export it as Markdown using the CLI.</p></noscript>
<script id="report-data" type="application/json">${data}</script><script>${__REPORT_SCRIPT__.replaceAll("</script", "<\\/script")}</script>
</body></html>`;
}
