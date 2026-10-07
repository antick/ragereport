export const APP = { name: "RageReport", executable: "ragereport", schemaVersion: 1 } as const;
export const TIME = {
  secondMs: 1_000,
  minuteSeconds: 60,
  dayMs: 86_400_000,
  weekDays: 7,
  monthDays: 30,
  defaultDays: 1,
} as const;
export const LIMITS = {
  wordsShown: 10,
  slopShown: 15,
  jsonBytes: 64 * 1024 * 1024,
  depth: 32,
  progressMs: 200,
  progressLogMs: 2_000,
  recordBatch: 512,
  streamBytes: 1024 * 1024,
  jsonHeaderBytes: 2048,
} as const;
export const SCAN_CACHE = { directory: "scans", version: 1 } as const;
export const DEDUPE = { mirrorMs: 2_000 } as const;
export const FILE_ACCESS = {
  directoryMode: 0o700,
  fileMode: 0o600,
  temporaryPrefix: ".ragereport-",
  temporaryName: "output",
} as const;
export const PRICING = {
  url: "https://models.dev/api.json",
  ttlMs: 7 * TIME.dayMs,
  timeoutMs: 4_000,
  perTokens: 1_000_000,
  filename: "pricing.json",
} as const;
export const SQLITE = { timeoutMs: 2_000 } as const;
export const TIER_DEFINITIONS = [
  {
    below: 0.15,
    name: "Calm Waters",
    labels: ["Smooth sailing, steady typing.", "Your keyboard is enjoying a peaceful shift."],
  },
  {
    below: 0.25,
    name: "Mostly Chill",
    labels: ["Your manners are holding up nicely.", "A please a day keeps the rage away."],
  },
  {
    below: 0.35,
    name: "Warming Up",
    labels: ["A few bugs have turned up the heat.", "Your patience has started buffering."],
  },
  {
    below: 0.5,
    name: "Pressure Cooker",
    labels: ["One more bug might blow the lid off.", "Your keyboard would like a tea break."],
  },
  {
    below: 0.67,
    name: "Rage Storm",
    labels: ["The forecast calls for scattered swearing.", "Your terminal has heard things."],
  },
  {
    below: Infinity,
    name: "Keyboard on Fire",
    labels: ["Your keyboard could use a cooling fan.", "The bugs survived. Your patience did not."],
  },
] as const;
export const UI = {
  overviewWords: 6,
  chartDays: 31,
  heatmapDays: 91,
  heatmapLevels: 4,
  watchMs: 5_000,
  minimumWatchMs: 1_000,
} as const;
export const OUTPUT = {
  html: "ragereport.html",
  svg: "ragereport-card.svg",
  costHtml: "ragereport-cost.html",
} as const;
