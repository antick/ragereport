export const AGENTS = [
  "claude",
  "codex",
  "cursor",
  "opencode",
  "amp",
  "cline",
  "pi",
  "t3code",
  "zed",
] as const;
export type AgentName = (typeof AGENTS)[number];
export type Role = "user" | "assistant";
export type Language = "en" | "hi";
export type Severity = "mild" | "moderate" | "strong";
export type WordKind = "swear" | "insult" | "polite";
export type Command = "scan" | "cost" | "slop" | "report" | "doctor";
export type OutputFormat = "terminal" | "json" | "markdown" | "html" | "svg";

export interface WordEntry {
  word: string;
  group?: string;
  language: Language;
  kind: WordKind;
  severity?: Severity;
  ambiguous?: boolean;
}
export interface TextMatch {
  word: string;
  text: string;
  index: number;
  end: number;
  group: string;
  kind: WordKind;
  language: Language;
  severity?: Severity;
}
export interface Message {
  agent: AgentName;
  role: Role;
  text: string;
  session: string;
  id?: string;
  timestamp?: string;
  project?: string;
  originAgent?: AgentName;
  originSession?: string;
  computed?: { signature: string; matches: TextMatch[] };
}
export interface Tokens {
  input: number;
  output: number;
  reasoning: number;
  cacheRead: number;
  cacheWrite: number;
}
export interface UsageRecord extends Tokens {
  /** False when the history did not supply complete input and output counters. */
  tokensAvailable?: boolean;
  agent: AgentName;
  session: string;
  id?: string;
  timestamp?: string;
  model?: string;
  provider?: string;
  billedCost?: number;
  originAgent?: AgentName;
  originSession?: string;
}
export interface Diagnostic {
  agent: AgentName;
  path?: string;
  status: "missing" | "found" | "read" | "skipped" | "warning";
  detail: string;
}
export interface ReaderContext {
  home: string;
  env: Record<string, string | undefined>;
  platform: NodeJS.Platform;
  paths?: Partial<Record<AgentName, string[]>>;
  /** Original discovered source, retained when a reader processes an individual cached file. */
  historyRoot?: string;
  diagnostics: Diagnostic[];
  usage: boolean;
  roles?: Role[];
  onProgress?: (event: ProgressEvent) => void;
}
export type ProgressEvent =
  | { type: "source" | "file"; agent: AgentName }
  | { type: "cached-file"; agent: AgentName }
  | { type: "bytes"; agent: AgentName; bytes: number }
  | { type: "records"; messages: number; usage: number }
  | { type: "stage"; stage: "discovering" | "analysis" | "pricing" | "cached" };
export interface ReaderResult {
  messages: Message[];
  usage: UsageRecord[];
}
export interface Reader {
  name: AgentName;
  paths(context: ReaderContext): string[];
  read(path: string, context: ReaderContext): AsyncGenerator<Message | UsageRecord>;
}
export interface RageConfig {
  languages: Language[];
  looseMatching: boolean;
  includeCode: boolean;
  words: WordEntry[];
  ignoreWords: string[];
  paths: Partial<Record<AgentName, string[]>>;
}
export interface AnalysisOptions {
  agent?: AgentName;
  since?: string;
  until?: string;
  config: RageConfig;
  home?: string;
  offline: boolean;
  refreshPrices: boolean;
  noRoast: boolean;
  command: Command;
  cache?: boolean;
  onProgress?: (event: ProgressEvent) => void;
}
export interface Tier {
  name: string;
  label: string;
  ratio: number | null;
  status: "finite" | "no-politeness" | "no-signals";
}
export interface WordCount {
  group: string;
  count: number;
  variants: Record<string, number>;
}
export interface LanguageSummary {
  messages: number;
  swears: number;
  insults: number;
  polite: number;
  swearingMessages: number;
  swearsPer100Messages: number;
  severity: Record<Severity, number>;
  swearWords: WordCount[];
  insultWords: WordCount[];
  politeWords: WordCount[];
  tier: Tier;
}
export interface SlopMatch {
  tell: string;
  category: string;
  index: number;
  end: number;
}
export interface SlopSummary {
  messages: number;
  hits: number;
  affectedMessages: number;
  tells: WordCount[];
}
export type PriceSource = "catalog" | "stale-cache" | "fallback" | "unknown";
export interface PriceCatalog {
  source: Exclude<PriceSource, "unknown">;
  fetchedAt?: string;
  models: Record<string, ModelRates>;
  warning?: string;
}
export interface ModelRates {
  input: number;
  output: number;
  cacheRead?: number;
  cacheWrite?: number;
  tiers?: { above: number; rates: Omit<ModelRates, "tiers"> }[];
}
export interface CostRow extends Tokens {
  agent: AgentName;
  model: string;
  provider: string;
  day: string | null;
  requests: number;
  estimatedCost: number | null;
  billedCost: number | null;
  priceSource: PriceSource;
}
export interface CostSummary extends Tokens {
  requests: number;
  estimatedCost: number | null;
  billedCost: number | null;
  unpricedRequests: number;
  rows: CostRow[];
  pricing: { source: PriceCatalog["source"]; fetchedAt?: string; warning?: string };
}
export interface AgentSummary {
  agent: AgentName;
  language: LanguageSummary;
  slop: SlopSummary;
  cost: CostSummary;
  days: DailySummary[];
}
export interface DailySummary {
  day: string;
  language: LanguageSummary;
  slop: SlopSummary;
  cost: CostSummary;
}
export interface Comparison {
  current: LanguageSummary;
  previous: LanguageSummary;
  changePer100Messages: number | null;
  currentSince: string;
  previousSince: string;
  until: string;
}
export interface Report {
  schemaVersion: number;
  generatedAt: string;
  command: Command;
  scope: {
    agent?: AgentName;
    since?: string;
    until?: string;
    languages: Language[];
    timezone: string;
  };
  language: LanguageSummary;
  slop: SlopSummary;
  cost: CostSummary;
  agents: AgentSummary[];
  projects: { name: string; language: LanguageSummary; slop: SlopSummary }[];
  days: DailySummary[];
  comparison: Comparison;
  diagnostics: Diagnostic[];
  duplicatesRemoved: { messages: number; usage: number };
  undated: { messages: number; usage: number; excluded: number };
}
