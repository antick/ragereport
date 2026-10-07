# RageReport

Your keyboard has stories. RageReport reads local coding-agent histories and reports your swears, polite expressions, token costs, and common assistant writing patterns. It runs on your computer without an account, API key, or transcript upload.

This pnpm/Turborepo workspace keeps the CLI and its website together:

| Folder                                                 | Purpose                                                     |
| ------------------------------------------------------ | ----------------------------------------------------------- |
| [`packages/ragereport`](packages/ragereport/README.md) | Publishable CLI and library, with zero runtime dependencies |
| [`apps/landing`](apps/landing/README.md)               | Astro landing page for `ragereport.potion.sh`               |

Use Node **24.21.0** (`.nvmrc`) and pnpm **12.9.1**. Install pnpm with `npm install --global pnpm@12.9.1` if needed.

```sh
pnpm install --frozen-lockfile
pnpm build:cli
pnpm cli scan
pnpm cli report --offline
```

`report` writes a standalone `ragereport.html` in the CLI package folder. Open that file directly in your browser.

```sh
pnpm check          # Formatting, types, lint, builds, and tests
pnpm dev            # Astro landing page and its synthetic demo
pnpm build:landing  # Build the website and its CLI dependency
pnpm preview        # Serve the production website build locally
pnpm dev:cli        # Rebuild the CLI when its source changes
pnpm demo           # Synthetic report in packages/ragereport/.demo
pnpm pack:cli       # Inspect the publishable package without publishing
```

Read the [CLI documentation](packages/ragereport/README.md) for commands, readers, privacy, pricing, configuration, and publishing. **The npm package is prepared for publication but has not been published yet.**

See [CONTRIBUTING.md](CONTRIBUTING.md) and [AGENTS.md](AGENTS.md) before changing the workspace.

The [landing-page guide](apps/landing/README.md#deploying-to-vercel) has the Vercel settings for `ragereport.potion.sh`. Deployment and domain setup are separate from local builds.
