export const ENVIRONMENT = { node: "24.14+" };

export const SITE = {
  name: "RageReport",
  url: "https://ragereport.potion.sh",
  description:
    "Your coding-agent history has receipts. Get local reports on swears, polite expressions, token costs, and AI writing patterns. No transcript uploads.",
  repository: "https://github.com/antick/ragereport",
  docs: "https://github.com/antick/ragereport/blob/main/packages/ragereport/README.md",
  npm: "https://www.npmjs.com/package/ragereport",
  author: "https://sanam.id",
  potion: "https://potion.sh",
};

export const AGENTS = [
  "Claude Code",
  "Codex",
  "Cursor",
  "OpenCode",
  "Amp",
  "Cline",
  "Pi",
  "T3 Code",
  "Zed",
];

export const INSTALL_COMMAND = "npx ragereport";

export const COMMANDS = [
  {
    id: "language",
    label: "Your language",
    command: "npx ragereport scan --week",
    description:
      "Swears, please-and-thank-yous, spelling variants, and your rage ratio. English and phonetic Hindi included.",
  },
  {
    id: "cost",
    label: "Token costs",
    command: "npx ragereport cost --month --offline",
    description:
      "See where your tokens went, by agent and model. API cost estimates and recorded charges stay separate.",
  },
  {
    id: "slop",
    label: "AI clichés",
    command: "npx ragereport slop --week",
    description:
      "Count your assistant’s stock phrases, excessive agreement, em dashes, and checkmark walls. Code is excluded.",
  },
  {
    id: "report",
    label: "Full report",
    command: "npx ragereport report --offline",
    description:
      "One self-contained HTML file. Filters, daily charts, project comparisons, and an exportable summary card.",
  },
];

export const FEATURES = [
  {
    number: "01",
    label: "THE LANGUAGE",
    title: "How did you ask?",
    description:
      "From “please fix this” to the third stretched-out fuuuuck. Count swears and polite expressions, find your favorite words, and compare your projects.",
    detail: "English + phonetic Hindi",
    commandId: "language",
    outputs: ["Swears and mild insults", "Polite expressions", "Daily and project comparisons"],
  },
  {
    number: "02",
    label: "THE TOKENS",
    title: "What did it cost?",
    description:
      "Follow input, output, reasoning, and cache tokens across agents and models. Missing usage stays missing. An estimate stays an estimate.",
    detail: "Token usage + cost breakdowns",
    commandId: "cost",
    outputs: [
      "Input, output, and cache tokens",
      "Model and agent breakdowns",
      "Estimated costs and recorded charges",
    ],
  },
  {
    number: "03",
    label: "THE ASSISTANT",
    title: "Did it “delve” again?",
    description:
      "Your AI has habits too. Spot stock phrases, reflexive agreement, and formatting tics. A writing-style heuristic, with a sense of humor.",
    detail: "Patterns, not a quality score",
    commandId: "slop",
    outputs: [
      "Common stock phrases",
      "Agreement and formatting patterns",
      "Code excluded from matching",
    ],
  },
];

export const FAQS = [
  {
    question: "Does it upload my conversations?",
    answer:
      "No. RageReport reads local history files without changing them. There is no account, API key, or transcript upload. Language scans work offline. Cost reports can refresh a public price catalog; use --offline to keep those offline too.",
  },
  {
    question: "Which coding agents does it support?",
    answer:
      "Claude Code, Codex, Cursor, OpenCode, Amp, Cline, Pi, T3 Code, and Zed. Available messages and usage depend on each agent’s local history format. The doctor command helps you find missing or unsupported histories.",
  },
  {
    question: "Does it understand Hindi?",
    answer:
      "It matches Latin phonetic spellings such as chutiya, bhosdike, and shukriya, alongside English. It groups spelling variants and stretched words, skips code and hostnames, and keeps mild insults separate from swear counts.",
  },
  {
    question: "Are the token costs my actual bill?",
    answer:
      "Usually they are API-equivalent estimates based on available usage and model prices. Recorded charges are shown separately where an agent provides them. Subscription charges, missing usage, and unknown prices cannot be reconstructed from a local history.",
  },
  {
    question: "Can I share the report?",
    answer:
      "HTML reports and SVG summary cards contain aggregate counts and word variants, without transcripts, message excerpts, or full local paths. Review them before sharing. CLI JSON and doctor diagnostics may include local paths.",
  },
  {
    question: "How do I run it?",
    answer:
      "Run npx ragereport with Node.js 24.14 or newer. No global install or pnpm is needed to use the published CLI. Start with npx ragereport --help for all commands and options.",
  },
];
