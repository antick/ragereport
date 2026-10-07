import astro from "eslint-plugin-astro";
import tsParser from "@typescript-eslint/parser";

export default [
  ...astro.configs.recommended,
  ...astro.configs["jsx-a11y-recommended"],
  {
    files: ["**/*.astro"],
    languageOptions: { parserOptions: { parser: tsParser } },
    rules: { "astro/no-set-html-directive": "error" },
  },
];
