import { resolve } from "node:path";
import type { CliOptions } from "./options.js";
import { analyze } from "../analysis/report.js";
import { OUTPUT } from "../config/constants.js";
import { renderTerminal, renderMarkdown } from "../reports/text.js";
import { renderHtml } from "../reports/html.js";
import { renderCard } from "../reports/card.js";
import { projectLabel } from "../reports/escape.js";
import { daysBefore, formatDuration } from "../utils/format.js";
import { writePrivateFile as save } from "../utils/files.js";
import { paint } from "../reports/terminal-style.js";
import { createProgress } from "./progress.js";
import { TERMINAL } from "../config/terminal.js";
import { terminalText } from "../utils/terminal.js";

export async function runOnce(options: CliOptions): Promise<void> {
  const started = performance.now();
  const color = !options.output && options.color;
  const progress = createProgress(
    options.progress && (options.format === "terminal" || !!process.stderr.isTTY),
    options.color,
  );
  let report;
  try {
    report = await analyze({
      ...options.analysis,
      onProgress: progress.update,
      ...(options.relativeDays
        ? {
            since: daysBefore(
              options.analysis.until ?? new Date().toISOString(),
              options.relativeDays,
            ),
          }
        : {}),
    });
  } finally {
    progress.stop();
  }
  const shared = {
    ...report,
    projects: report.projects.map((p) => ({ ...p, name: projectLabel(p.name) })),
  };
  const text =
    options.format === "json"
      ? `${JSON.stringify(shared, null, 2)}\n`
      : options.format === "markdown"
        ? renderMarkdown(shared)
        : options.format === "html"
          ? renderHtml(shared)
          : options.format === "svg"
            ? renderCard(shared)
            : renderTerminal(shared, { color, width: process.stdout.columns });
  const path =
    options.output ??
    (options.format === "html"
      ? resolve(OUTPUT.html)
      : options.format === "svg"
        ? resolve(OUTPUT.svg)
        : undefined);
  if (path) {
    await save(path, text);
    process.stderr.write(`RageReport saved: ${terminalText(path)}\n`);
  } else {
    if (options.watch && options.format === "terminal" && process.stdout.isTTY)
      process.stdout.write(TERMINAL.controls.clearScreen);
    process.stdout.write(text);
    if (options.format === "terminal")
      process.stdout.write(
        `  ${paint(color, "gray", `Completed in ${formatDuration(performance.now() - started)}${progress.cacheLabel ? ` · ${progress.cacheLabel}` : ""}`)}\n\n`,
      );
  }
  if (options.analysis.command === "cost" && !options.explicitFormat && !options.output) {
    const costPath = resolve(OUTPUT.costHtml);
    await save(costPath, renderHtml(shared));
    process.stderr.write(`Interactive cost report: ${terminalText(costPath)}\n`);
  }
}
export async function runCli(options: CliOptions): Promise<void> {
  await runOnce(options);
  if (!options.watch) return;
  process.stderr.write(
    `Watching local histories every ${options.watchMs / 1_000}s. Press Ctrl+C to stop.\n`,
  );
  await new Promise<void>((resolveDone) => {
    let running = false;
    let stopped = false;
    const timer = setInterval(async () => {
      if (running || stopped) return;
      running = true;
      try {
        await runOnce(options);
      } catch (error) {
        process.stderr.write(
          `RageReport: ${terminalText(error instanceof Error ? error.message : error)}\n`,
        );
      } finally {
        running = false;
        if (stopped) resolveDone();
      }
    }, options.watchMs);
    const stop = () => {
      stopped = true;
      clearInterval(timer);
      process.removeListener("SIGINT", stop);
      process.removeListener("SIGTERM", stop);
      if (!running) resolveDone();
    };
    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
  });
}
