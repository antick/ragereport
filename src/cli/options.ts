import { parseArgs } from "node:util";
import { resolve } from "node:path";
import { AGENTS, type AnalysisOptions, type Command, type OutputFormat } from "../types.js";
import { loadConfig } from "../config/load.js";
import { TIME, UI } from "../config/constants.js";
import { dateArgument, daysBefore } from "../utils/format.js";

export interface CliOptions {
  analysis: AnalysisOptions;
  format: OutputFormat;
  output?: string;
  explicitFormat: boolean;
  watch: boolean;
  watchMs: number;
  relativeDays?: number;
  help: boolean;
  version: boolean;
  color: boolean;
  progress: boolean;
}
const COMMANDS = ["scan", "cost", "slop", "report", "doctor"] as const;
export async function parseOptions(args: string[], now = new Date()): Promise<CliOptions> {
  const normalized: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg === "--day" || arg === "--days") {
      const next = args[i + 1];
      normalized.push("--days", next && !next.startsWith("-") ? next : String(TIME.defaultDays));
      if (next && !next.startsWith("-")) i++;
    } else normalized.push(arg);
  }
  const { values, positionals } = parseArgs({
    args: normalized,
    allowPositionals: true,
    strict: true,
    options: {
      agent: { type: "string", short: "a" },
      since: { type: "string", short: "s" },
      until: { type: "string" },
      days: { type: "string" },
      week: { type: "boolean" },
      month: { type: "boolean" },
      language: { type: "string" },
      format: { type: "string" },
      output: { type: "string", short: "o" },
      config: { type: "string" },
      home: { type: "string" },
      offline: { type: "boolean" },
      "refresh-prices": { type: "boolean" },
      "loose-matching": { type: "boolean" },
      "include-code": { type: "boolean" },
      "no-roast": { type: "boolean" },
      "no-cache": { type: "boolean" },
      "no-progress": { type: "boolean" },
      color: { type: "boolean" },
      "no-color": { type: "boolean" },
      watch: { type: "boolean" },
      "watch-interval": { type: "string" },
      help: { type: "boolean", short: "h" },
      version: { type: "boolean" },
    },
  });
  if (positionals.length > 1 || (positionals[0] && !COMMANDS.includes(positionals[0] as Command)))
    throw new Error(`Unknown command: ${positionals.join(" ")}. Use --help for commands.`);
  const command = (positionals[0] ?? "scan") as Command;
  if (values.agent && !AGENTS.includes(values.agent as (typeof AGENTS)[number]))
    throw new Error(`Unknown agent: ${values.agent}. Available: ${AGENTS.join(", ")}.`);
  const config = await loadConfig(values.config);
  if (values.language !== undefined) {
    const languages = values.language.split(",").map((s) => s.trim());
    if (!languages.length || languages.some((l) => l !== "en" && l !== "hi"))
      throw new Error("Use --language en, hi, or en,hi. Hindi uses English phonetic spelling.");
    config.languages = [...new Set(languages)] as typeof config.languages;
  }
  if (values["loose-matching"]) config.looseMatching = true;
  if (values["include-code"]) config.includeCode = true;
  const relative = [values.days !== undefined, !!values.week, !!values.month].filter(
    Boolean,
  ).length;
  if (relative > 1 || (relative && values.since))
    throw new Error("Choose one of --since, --days, --week, or --month.");
  let since = values.since ? dateArgument(values.since) : undefined;
  let relativeDays: number | undefined;
  const until = values.until ? dateArgument(values.until) : undefined;
  if (relative) {
    const days = values.week ? TIME.weekDays : values.month ? TIME.monthDays : Number(values.days);
    if (!Number.isSafeInteger(days) || days <= 0)
      throw new Error("--days must be a positive whole number.");
    since = daysBefore(until ?? now.toISOString(), days);
    relativeDays = days;
  }
  if (since && until && since >= until)
    throw new Error("--since must be earlier than --until (the end date is exclusive).");
  const format = values.format ?? (command === "report" ? "html" : "terminal");
  if (!["terminal", "json", "markdown", "html", "svg"].includes(format))
    throw new Error("Use --format terminal, json, markdown, html, or svg.");
  if (values.offline && values["refresh-prices"])
    throw new Error("--offline and --refresh-prices cannot be used together.");
  if (values.color && values["no-color"]) throw new Error("Choose --color or --no-color.");
  if (command === "doctor" && (format === "html" || format === "svg"))
    throw new Error("doctor supports terminal, JSON, and Markdown output.");
  if (values.watch && !["terminal", "html"].includes(format))
    throw new Error("Watch mode supports terminal or HTML output.");
  const watchMs =
    values["watch-interval"] === undefined ? UI.watchMs : Number(values["watch-interval"]) * 1_000;
  if (!Number.isSafeInteger(watchMs) || watchMs < UI.minimumWatchMs)
    throw new Error("--watch-interval must be at least one second.");
  return {
    analysis: {
      command,
      agent: values.agent as AnalysisOptions["agent"],
      config,
      since,
      until,
      home: values.home ? resolve(values.home) : undefined,
      offline: !!values.offline,
      refreshPrices: !!values["refresh-prices"],
      noRoast: !!values["no-roast"],
      cache: !values["no-cache"],
    },
    format: format as OutputFormat,
    explicitFormat: values.format !== undefined,
    output: values.output ? resolve(values.output) : undefined,
    watch: !!values.watch,
    watchMs,
    relativeDays,
    help: !!values.help,
    version: !!values.version,
    color: !values["no-color"],
    progress: !values["no-progress"],
  };
}
