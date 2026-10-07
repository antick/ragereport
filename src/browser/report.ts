import type { Report } from "../types.js";
import { formatDate } from "../utils/format.js";
import { filterReport } from "./data.js";
import { assistant, costs, language, overview } from "./views.js";
import { renderCard } from "../reports/card.js";
const report = JSON.parse(document.getElementById("report-data")!.textContent ?? "{}") as Report;
const agent = document.getElementById("agent-filter") as HTMLSelectElement;
const range = document.getElementById("range-filter") as HTMLSelectElement;
const model = document.getElementById("model-filter") as HTMLSelectElement;
const content = document.getElementById("report-content")!;
let active =
  report.command === "cost"
    ? "costs"
    : report.command === "slop"
      ? "assistant"
      : report.command === "scan"
        ? "language"
        : "overview";
function option(select: HTMLSelectElement, value: string, label: string): void {
  const element = document.createElement("option");
  element.value = value;
  element.textContent = label;
  select.append(element);
}
for (const entry of report.agents) option(agent, entry.agent, entry.agent);
for (const name of [...new Set(report.cost.rows.map((r) => `${r.provider}/${r.model}`))].sort())
  option(model, name, name);
document.getElementById("scope")!.textContent =
  `${report.scope.agent ?? "All agents"} · ${report.scope.since ? `From ${formatDate(report.scope.since)}` : "All included local history"}${report.scope.until ? ` · Before ${formatDate(report.scope.until)}` : ""} · ${report.scope.languages.map((l) => (l === "hi" ? "phonetic Hindi" : "English")).join(" + ")}`;
document.getElementById("generated")!.textContent = formatDate(report.generatedAt);
const warnings = report.diagnostics.filter(
  (d) => d.status === "warning" || d.status === "skipped",
).length;
document.getElementById("coverage")!.textContent =
  `${report.duplicatesRemoved.messages + report.duplicatesRemoved.usage} duplicates removed · ${report.undated.excluded} undated records excluded · ${warnings} history warnings`;
function draw(): void {
  const view = filterReport(report, { agent: agent.value, range: range.value, model: model.value });
  content.innerHTML =
    active === "language"
      ? language(report, view)
      : active === "costs"
        ? costs(view)
        : active === "assistant"
          ? assistant(view)
          : overview(report, view);
  for (const button of document.querySelectorAll<HTMLButtonElement>("[data-tab]"))
    button.setAttribute("aria-selected", String(button.dataset.tab === active));
}
for (const select of [agent, range, model]) select.addEventListener("change", draw);
for (const button of document.querySelectorAll<HTMLButtonElement>("[data-tab]"))
  button.addEventListener("click", () => {
    active = button.dataset.tab ?? "overview";
    draw();
  });
document.getElementById("reset-filters")!.addEventListener("click", () => {
  agent.value = range.value = model.value = "all";
  draw();
});
function download(value: string, type: string, filename: string): void {
  const url = URL.createObjectURL(new Blob([value], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
document.getElementById("download")!.addEventListener("click", () => {
  const view = filterReport(report, { agent: agent.value, range: range.value, model: model.value });
  download(
    JSON.stringify(
      {
        schemaVersion: report.schemaVersion,
        generatedAt: report.generatedAt,
        filters: { agent: agent.value, range: range.value, model: model.value },
        language: view.language,
        cost: view.cost,
        slop: view.slop,
      },
      null,
      2,
    ),
    "application/json",
    "ragereport-summary.json",
  );
});
const cardButton = document.createElement("button");
cardButton.type = "button";
cardButton.id = "download-card";
cardButton.textContent = "Share card";
document.querySelector(".filters")!.append(cardButton);
cardButton.addEventListener("click", () => {
  const view = filterReport(report, { agent: agent.value, range: range.value, model: model.value });
  download(
    renderCard({ generatedAt: report.generatedAt, language: view.language, cost: view.cost }),
    "image/svg+xml",
    "ragereport-card.svg",
  );
});
draw();
