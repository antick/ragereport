# Contributing

Use Node 24.21.0 and pnpm 12.9.1. Run these commands from the repository root:

```sh
pnpm install --frozen-lockfile
pnpm format:write
pnpm check
pnpm pack:cli
```

Keep changes focused, readable, and consistent with the surrounding code. Reuse existing helpers and components; split code files before they exceed 500 lines. Use exact dependency versions and choose the newest compatible release that is at least two days old.

The [CLI contribution guide](packages/ragereport/CONTRIBUTING.md) covers readers, dictionaries, pricing, synthetic fixtures, and privacy. Keep the CLI free of runtime dependencies. Website dependencies belong in `apps/landing`.

For landing-page changes, inspect desktop and phone widths, keyboard navigation, and interactive controls. Keep examples synthetic and the npm release status honest. Never include real histories in website assets.

Explain what changed and how you verified it. Use a Conventional Commit title, such as `fix: handle streamed usage snapshots`. CI checks changes; it does not publish the CLI or deploy the site.
