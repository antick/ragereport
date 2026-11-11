# RageReport

Your keyboard has stories. RageReport reads local coding-agent histories and reports your swears, polite expressions, token costs, and common assistant writing patterns. It runs on your computer without an account, API key, or transcript upload.

## Quick start

Install [Node.js](https://nodejs.org/) **24.14 or newer**, then run:

```sh
npx ragereport
```

This scans supported coding-agent histories in your home folder and prints a terminal report. You do not need to clone this repository, install pnpm, or install RageReport globally.

```sh
npx ragereport scan --agent codex --week  # Scan one agent's last seven days
npx ragereport report --offline         # Generate a combined HTML report
npx ragereport cost --month --offline   # Show token costs for the last thirty days
npx ragereport slop --week              # Find common assistant writing patterns
npx ragereport doctor                   # Check history locations and read errors
npx ragereport --help                   # List every command and option
```

`report` saves `ragereport.html` in the folder where you run the command. Double-click it to open it in your browser; no web server is needed. `cost` also saves `ragereport-cost.html` by default. `--offline` uses cached or bundled model prices; leave it out to allow a public price-catalog refresh. npm may still need internet access to download the CLI.

Read the [CLI documentation](packages/ragereport/README.md) for all commands, supported agents, filters, privacy, pricing, and configuration.

## Develop from source

This pnpm/Turborepo workspace keeps the CLI and its website together:

| Folder                                                 | Purpose                                                     |
| ------------------------------------------------------ | ----------------------------------------------------------- |
| [`packages/ragereport`](packages/ragereport/README.md) | Publishable CLI and library, with zero runtime dependencies |
| [`apps/landing`](apps/landing/README.md)               | Astro landing page for `ragereport.potion.sh`               |

Use Node **24.21.0** (`.nvmrc`) and pnpm **12.9.1**. Install pnpm with `npm install --global pnpm@12.9.1` if needed.

### mise

With [mise](https://mise.jdx.dev/) installed, run `mise install` once, then use the tasks below instead of remembering pnpm script names.

| Task          | Command                  |
| ------------- | ------------------------ |
| install       | `mise run install`       |
| dev           | `mise run dev`           |
| dev:cli       | `mise run dev:cli`       |
| build         | `mise run build`         |
| build:cli     | `mise run build:cli`     |
| build:landing | `mise run build:landing` |
| test          | `mise run test`          |
| lint          | `mise run lint`          |
| format        | `mise run format`        |
| typecheck     | `mise run typecheck`     |
| check         | `mise run check`         |
| preview       | `mise run preview`       |

```sh
pnpm install --frozen-lockfile
pnpm build:cli
pnpm cli scan
pnpm cli report --offline
```

`report` writes a standalone `ragereport.html` in the CLI package folder. Open that file directly in your browser.

```sh
pnpm check          # Formatting, types, lint, builds, and tests
pnpm dev            # Astro landing page
pnpm build:landing  # Build the website and its CLI dependency
pnpm preview        # Serve the production website build locally
pnpm dev:cli        # Rebuild the CLI when its source changes
pnpm demo           # Synthetic report in packages/ragereport/.demo
pnpm pack:cli       # Inspect the publishable package without publishing
```

See [CONTRIBUTING.md](CONTRIBUTING.md) and [AGENTS.md](AGENTS.md) before changing the workspace.

The [landing-page guide](apps/landing/README.md#deploying-to-vercel) has the Vercel settings for `ragereport.potion.sh`. Deployment and domain setup are separate from local builds.
