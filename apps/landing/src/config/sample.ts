// An illustration of the synthetic history produced by scripts/prepare-demo.mjs.
export const SAMPLE = {
  messages: 9,
  stats: [
    { label: "Swears", value: "08" },
    { label: "Polite expressions", value: "10" },
  ],
  ratio: "0.80",
  words: [
    { text: "please", count: "04", swear: false },
    { text: "fuuuuck", count: "01", swear: true },
    { text: "shukriya", count: "01", swear: false },
  ],
  tokens: [
    { label: "INPUT", value: "700" },
    { label: "OUTPUT", value: "130" },
    { label: "CACHE READ", value: "155" },
  ],
  phrases: [
    { before: "Let’s ", highlighted: "delve", after: " into…" },
    { before: "", highlighted: "Absolutely!", after: "" },
    { before: "It’s worth noting…", highlighted: "", after: "" },
  ],
};
