# RageReport

Your keyboard has stories. RageReport reads local coding-agent histories and reports your swears, polite expressions, token costs, and common assistant writing patterns.

It works entirely on your computer. No account, API key, or transcript upload is needed. Hindi is matched through English phonetic spellings such as `chutiya`, `bhosdike`, and `shukriya`.

## Run locally

Requires Node.js **24.14 or newer** to run the published CLI. Workspace development requires **24.16 or newer** and pnpm **12.9.1**. Development uses Node **24.21.0 LTS**.

Clone the repository, install the development tools, and build the CLI:

```sh
git clone https://github.com/antick/ragereport.git
cd ragereport
pnpm install --frozen-lockfile
pnpm build
```

If you already have the repository, start in its `ragereport` folder and skip the clone step. If you use nvm, run `nvm install` and `nvm use` in that folder before installing dependencies; `.nvmrc` selects the development version.

Run a terminal scan or generate the browser report:

```sh
pnpm cli scan
pnpm cli report --offline
```

`report` writes `ragereport.html` in the current folder. Open it in your browser. The file includes everything it needs, so there is no web server to start. `--offline` uses cached or bundled model prices. Leave it out to allow a public price-catalog refresh.

| System             | Open the generated report         |
| ------------------ | --------------------------------- |
| macOS              | `open ragereport.html`            |
| Linux desktop      | `xdg-open ragereport.html`        |
| Windows PowerShell | `Start-Process .\ragereport.html` |

You can also double-click the file or run the built CLI directly:

```sh
node packages/ragereport/dist/cli.js scan
node packages/ragereport/dist/cli.js report --offline
```

For other commands, use the same `pnpm cli` prefix:

```sh
pnpm cli scan --agent codex --week
pnpm cli cost --month --offline
pnpm cli slop --week
pnpm cli doctor
pnpm cli --help
```

Terminal reports use colored headings, count cards, vocabulary bars, and agent summaries. **Colors are on by default:** just run `pnpm cli scan`. Use `--no-color` for plain text. Word variants and their counts wrap onto additional lines without ellipses or a hidden variant limit for each displayed family. The CLI does not rely on terminal detection or color environment variables, which can suppress colors in embedded terminals. `--color` remains accepted for compatibility but is unnecessary. File exports and non-terminal formats contain no terminal color codes. For plain text in a pipe, pass `--no-color` or choose `--format markdown`.

`cost` prints a terminal summary and also writes `ragereport-cost.html` unless an explicit output format was selected. The default scan reads all supported histories in your home folder, even when you run the command inside a particular project. Use `--agent`, date filters, or configured history paths to narrow it.

For a demo using only synthetic histories:

```sh
pnpm demo
```

Open `packages/ragereport/.demo/ragereport.html` in your browser. This command requires the build above and also creates `packages/ragereport/.demo/ragereport-card.svg`.

## Run with npx

Run directly from npm:

```sh
npx ragereport
npx ragereport report --week
npx ragereport cost --month
```

There is no global installation to maintain. Use `npx ragereport@latest --help` when you explicitly want the newest published release, or `npx ragereport@0.1.0 --help` to select a particular release.

To test your local checkout after building:

```sh
npx --yes --offline --package=./packages/ragereport ragereport scan
npx --yes --offline --package=./packages/ragereport ragereport report --offline
```

The first `--offline` belongs to npm and disables registry requests. The last one belongs to RageReport and disables price-catalog requests. Initial `pnpm install` still needs access to the development dependencies unless they are already cached.

To test the actual npm archive:

```sh
pnpm --filter ragereport exec npm pack --pack-destination ../..
npx --yes --offline --package=./ragereport-0.1.0.tgz ragereport --help
```

The archive name follows the version in `package.json`. During development, prefer `pnpm cli ...` to run your current build directly.

## What you get

- **Colorful terminal reports:** clear sections, colored totals, vocabulary bars, and agent breakdowns, with plain-text output when needed.
- **Faster repeat scans:** reuse unchanged history files and aggregate counts instead of parsing every transcript again.
- **Your language:** swear counts, mild insults counted separately, polite expressions, severity, word families, spelling variants, and swears per 100 messages.
- **Rage ratio:** swears divided by polite expressions, with six temperature tiers and English roast labels. `--no-roast` hides the labels. Report headings, tier names, and messages stay in English regardless of which dictionaries are enabled.
- **Cost reports:** agent, model, and daily breakdowns; separate input, output, reasoning, cache-read, and cache-write tokens; estimated API-equivalent spending and recorded charges.
- **Assistant patterns:** stock phrases, excessive agreement, rhetorical templates, em dashes, and checkmark walls. Code blocks are excluded. These counts are a writing-style heuristic, not a quality judgment.
- **Combined HTML reports:** overview, language, costs, and assistant tabs; agent/period/model filters; daily charts and a 91-day calendar; JSON downloads and SVG summary cards.
- **Terminal calendar:** a GitHub-style grid of up to 91 days, with week columns, weekday rows, month labels, green intensity levels, and a readable plain-text legend.
- **Weekly comparisons:** swears per 100 messages in the seven days before the report's end, compared with the preceding seven days. The comparison can read earlier history than the main `--since` filter.
- **Project comparisons:** terminal rankings by swears per 100 messages, with counts and readable project names; HTML also includes assistant-pattern totals where project metadata exists. HTML keeps the original scan scope for this panel.
- **Watch mode:** redraw the interactive terminal or overwrite an HTML report as history changes. Redirected terminal output appends successive reports.
- **Shareable summary cards:** export an SVG containing aggregate totals, the temperature tier, and the report date, without transcript excerpts or history paths.
- **Diagnostics:** discover missing histories, unsupported database schemas, unreadable files, and malformed records.
- **Reusable library:** import the readers, detectors, analysis, pricing, and renderers into another TypeScript or JavaScript tool.

## Commands and filters

These examples use the command after npm publication. In a local checkout, replace `npx ragereport` with `pnpm cli`.

For scripts that parse JSON, use `node packages/ragereport/dist/cli.js scan --format json` directly. This keeps npm's script banner out of the output.

```sh
npx ragereport scan --agent codex --week
npx ragereport scan --language hi
npx ragereport scan --since 2026-10-01 --until 2026-10-05
npx ragereport scan --days 14 --format json
npx ragereport slop --agent claude --month
npx ragereport cost --refresh-prices
npx ragereport report --format markdown --output summary.md
npx ragereport report --format svg --output card.svg
npx ragereport report --watch --watch-interval 5 --offline
npx ragereport doctor
npx ragereport --help
```

Use `--agent claude`, `codex`, `cursor`, `opencode`, `amp`, `cline`, `pi`, `t3code`, or `zed`. The default is all agents.

Date input is `YYYY-MM-DD` or an ISO timestamp. The start is inclusive and the end is exclusive. Displayed dates consistently use **05 Oct 2026** formatting in UTC. `--day` and `--days` accept an optional positive number; `--week` means seven days and `--month` means thirty days. Choose one start/range filter. Histories without timestamps are included in all-history scans but excluded when a date filter is applied, with an excluded-record count.

HTML period filters select exactly seven or thirty UTC calendar dates, ending on the last included date (the preceding day for an exclusive midnight end). They use the stored day buckets and can only narrow the history included when the report was generated. The model filter changes costs only. Watch mode supports terminal and HTML output; stop it with Ctrl+C. Relative CLI ranges advance on each refresh.

## Terminal calendar, projects, and sharing

```sh
pnpm cli scan
pnpm cli scan --watch
pnpm cli scan --no-color
pnpm cli report --offline --format svg --output reports/ragereport-card.svg
```

The terminal language scan includes a calendar of up to 91 days, ending on the report date or the selected end date. Week columns run Sunday to Saturday. A CLI start filter narrows the calendar; an exclusive midnight `--until` ends it on the preceding day. Dates are displayed in UTC. Green shades and `░ ▒ ▓ █` show increasing swear counts relative to the busiest day in that calendar. `·` means no recorded user messages; `□` means recorded user messages with zero swears. Undated messages remain in eligible report totals but cannot appear on the calendar.

Project comparisons use histories that include project metadata and show the ten highest rates, together with swear counts, message counts, and polite expressions. Project names wrap in full and use short labels instead of full local paths. Export JSON if you need every project's totals. The calendar and project comparison also appear with `report --format terminal`.

Watch mode refreshes at the configured interval and redraws interactive terminal output. Stop it with Ctrl+C. It uses the normal scan cache, so unchanged histories can be reused. HTML watch mode updates the same output file; reload its browser tab after a refresh.

Summary cards are SVG files you can open or share. They contain aggregate totals rather than message excerpts, project locations, or transcript text. Custom exports belong in `reports/` or `exports/` so Git excludes them. Local private history imports, databases, generated demos, and private configuration are also excluded by the repository's `.gitignore`.

## Scan speed and progress

The default scan reads all supported history in your home folder, not just the current project. A first scan of many gigabytes can take tens of seconds. The terminal now shows the agent being read, files read or reused, JSONL bytes read, collected messages, and the analysis stage. SQLite data is not included in the JSONL byte counter. The finished report shows elapsed time in seconds for shorter runs and minutes plus seconds from one minute onward: for example, `Completed in 2m 2s` instead of `Completed in 121.79s`.

Language scans skip decoding known tool-output and assistant-only JSONL records. The first scan still needs to read the file bytes. Subsequent all-history `scan` commands reuse a local cache; changing one file does not require rereading every other file. Cache entries are checked against file size, modification time, change time, permissions, and SQLite journal/WAL files. Dictionary, configuration, or build changes invalidate the relevant cache. Weekly comparison counts also expire when a message crosses a date boundary.

```sh
pnpm cli scan
pnpm cli scan --no-cache
pnpm cli scan --no-progress
```

`--no-cache` reads histories afresh without deleting existing cache files. Active coding apps can change their histories during a scan; those files are read again on the next run. Cache failures fall back to normal reading. Date-filtered scans, `cost`, `slop`, and `report` currently read their inputs afresh. Library callers can opt in with `cache: true`; caching is off by default for the library.

Progress goes to stderr, keeping JSON stdout clean. Use `--no-progress` to hide it. Use `--agent codex` or another agent to limit which histories are read. Stop any scan with Ctrl+C.

The scan cache stores matched word variants, hashed message text signatures, message identifiers, timestamps, project labels, paths, diagnostics, and aggregate counts. It does not store full transcript text. Cache files live under the operating system's cache folder in `ragereport/scans`: `~/Library/Caches` on macOS, `~/.cache` on Linux, or `%LOCALAPPDATA%` on Windows. `XDG_CACHE_HOME` can override the base folder. On Unix, newly created cache directories use mode `0700` and files use `0600`. Keep this local metadata private; deleting the `scans` folder simply makes the next scan rebuild it.

## Agent histories

| Agent            | Supported local storage                                                                  | Token usage                                                                      |
| ---------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Claude Code      | Project and subagent JSONL; common legacy user-message shapes                            | Recorded assistant usage; repeated response snapshots merged                     |
| Codex            | Sessions and archived JSONL                                                              | Last-response usage or cumulative deltas, with cache/reasoning subsets separated |
| Cursor           | Global and workspace SQLite key/value stores; known composer, bubble, and prompt records | Assistant bubble token counts where present                                      |
| OpenCode         | SQLite messages/text parts and legacy JSON message/part storage                          | Assistant tokens, model/provider, recorded cost                                  |
| Amp              | JSON threads and usage ledgers                                                           | Ledger usage and recorded charges where present                                  |
| Cline / Roo Code | VS Code-compatible extension histories and standalone Cline tasks                        | Optional assistant usage when present; otherwise unavailable                     |
| Pi               | Agent-session JSONL                                                                      | Assistant usage and recorded response models                                     |
| T3 Code          | Userdata/dev SQLite message projections and usage events                                 | Request snapshots/deltas and historical model selections when recorded           |
| Zed              | Conversation JSON, native JSON/zstd thread blobs, and compatible message tables          | Optional usage in JSON when present; otherwise unavailable                       |

Readers use read-only access and never modify agent histories. Source formats can change; an unknown or unreadable format is reported rather than guessed. All nine readers have fixture coverage. Actual compatibility with a particular installed agent version still depends on that version's stored schema. Native Zed thread messages have no individual timestamps, so they remain undated rather than inheriting the thread save date. T3 requests keep their historical model when it can be reconstructed from events; otherwise the model stays unknown. Active context-size snapshots without complete billing counters are not priced as complete requests.

Native message/request identifiers remove repeated history and streamed snapshots. T3 mirrors are matched to native records using both a known origin agent and session, with matching content/token details and nearby timestamps. Ambiguous mirrors without enough identifying information can remain; unrelated user turns are not merged merely because their text is the same.

Standard home, XDG, macOS Application Support, and Windows AppData locations are supported. Discovery honors `CODEX_HOME`, `CLAUDE_CONFIG_DIR`, `PI_CODING_AGENT_DIR`, `T3CODE_HOME`, and `T3CODE_STATE_DIR` where applicable. `--home /path/to/home` uses a separate home and ignores environment discovery overrides, which is useful for exported histories and tests.

## Phonetic Hindi and dictionaries

The dictionary tracks **290 English and phonetic Hindi spellings across 68 families**. **276 spellings are enabled by default; 14 ambiguous spellings need loose matching.** See [the complete dictionary, tracking modes, and sources](docs/dictionary-coverage.md). This is curated coverage, not a claim to cover every swear or regional spelling. Additional languages can be added later; dictionary support does not change the report's English interface.

English and phonetic Hindi are enabled by default. Common spelling variations and stretched letters are grouped together. Mild/contextual words such as `bewakoof`, `bakwaas`, `saala`, `kamina`, `gadha`, and `fattu` are tracked as insults, separately from swear counts and the rage ratio. Multiword expressions such as `behen chod` and `randi rona` count once, without also counting the words inside them.

Hindi families include `chutiya`/`chutiyapa`, `gandu`/`gaand`, `behenchod`/`bhencho`/`pencho`, `madarchod`/`machod`, `bhosdike`/`bhosda`/`bhoshda`/`bhosad`, `lauda`/`loda`/`lavda`/`lund`/`lun`/`lulli`/`lulla`, `bhadwa`/`bhadwe`/`bhadwi`/`bhadve`/`bhadva`/`bhadvi`, `fudda`/`fuddi`, `kutte`, `suar`/`suwar`, `tatte`/`aand`, and `bhasad`. English coverage includes regional terms such as `bollocks`, `wanker`, `twat`, and `arsehole`, along with compounds, suffixes, and abbreviations. Politeness includes `shukriya`, `dhanyavaad`, `kripya`, and `meherbani` with spelling variants.

`--loose-matching` additionally enables `af`, `pussy`, `balls`, `sala`, `sale`, `sali`, `gand`, `bc`, `mc`, `laura`, `lora`, `chud`, `rand`, and `mut`. These include ordinary names, technical words, and short abbreviations. Dotted forms such as `b.c.` work by default. Short words such as `lun` are enabled by default and match only as whole words; use `ignoreWords` to exclude a spelling or family when needed.

Word matches inside domain/URL/email hostnames are ignored. Words in URL paths, queries, fragments, or ordinary sentences still count. Code blocks and inline code are ignored unless `--include-code` is passed. Counts indicate matching expressions; a swear in a quoted sentence is not proof that you were angry at an agent.

Start with [ragereport.example.json](ragereport.example.json):

```json
{
  "languages": ["en", "hi"],
  "looseMatching": false,
  "includeCode": false,
  "ignoreWords": ["lmao"],
  "words": [
    { "word": "ullu", "language": "hi", "kind": "insult", "severity": "mild" },
    { "word": "cheers", "language": "en", "kind": "polite" }
  ],
  "paths": {
    "codex": ["./exported-sessions"]
  }
}
```

```sh
npx ragereport scan --config ./ragereport.json
```

Paths are relative to the configuration file. An agent's configured paths replace its discovery defaults. Custom words can override a built-in word's kind/severity and use an optional `group` for family totals. `ignoreWords` excludes a spelling or an entire group. The tool does not create a configuration file or copy transcripts automatically.

## Pricing and privacy

Only `cost` and `report` need a public price-catalog fetch, and only when local usage exists. No transcript, model usage record, prompt, API key, or identifier is sent. `--offline` disables all price-network requests. Ordinary scans and assistant-pattern scans are offline.

Prices come from [Models.dev](https://models.dev), are cached locally for seven days, and can be refreshed with `--refresh-prices`. If a fetch fails, the tool uses an older cache or its dated bundled snapshot. The report labels which source was used. The bundled snapshot covers selected OpenAI, Anthropic, and Google models, including context-size tiers; the online catalog covers additional models.

Missing token counters and unknown model prices remain **unavailable**, and the estimated total includes only priced usage. Missing usage is not zero spending. Known zero-cost records remain zero. Recorded charges are displayed separately and never substituted for an API estimate. Estimates use the selected catalog's rates, not historical rates at the time a request ran, and may differ from subscriptions, discounts, fast-mode rates, and invoices.

Generated HTML and SVG contain aggregate counts, word variants, and model names, without transcripts or local history paths. CLI JSON diagnostics and `doctor` can include local file locations and read-error details; review those before sharing. Creating a share card downloads a file and does not publish or upload it.

Legacy message IDs cannot redirect part reads outside their history directories, including through directory links. Unsafe IDs or outside links produce a warning while valid inline message content remains available. Terminal text removes injected controls without disabling report colors. Markdown data is escaped so model names and custom word labels remain text rather than HTML or links; JSON preserves the original values.

Report exports and caches are written through fresh private temporary directories and exclusive file creation, then replaced atomically. Failed writes clean up their temporary files, and simultaneous writes do not share a temporary filename. On Windows, a briefly locked destination is retried for up to 750 milliseconds; persistent failures leave the previous file intact. New files use owner-only permissions where the operating system supports Unix modes; Windows access follows its filesystem permissions. Use output and cache folders you control. Interrupted writes may leave a private `.ragereport-*` directory, which Git ignores.

## Use as a library

```ts
import { analyze, DEFAULT_CONFIG, detect, renderHtml } from "ragereport";

const matches = detect("chutiya bug, shukriya for helping");
const report = await analyze({
  command: "report",
  config: structuredClone(DEFAULT_CONFIG),
  offline: true,
  refreshPrices: false,
  noRoast: false,
});
const html = renderHtml(report);
```

`buildReport` accepts already-normalized messages/usage and a pricing catalog, useful for imports and controlled tests. `createReader`, `readerContext`, and `readHistories` expose the source readers. Public types and declarations are included in the npm package.

## Development and verification

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm demo
pnpm dev:cli
pnpm pack:cli
```

`check` runs TypeScript checking, lint, formatting, and all available tests. Tests cover native fixture formats, read-only SQLite, duplicates, domain matching, phonetic Hindi, pricing/cache fallbacks, exports, CLI failures, watch shutdown, history path traversal, outside directory links, private atomic writes, terminal controls, and Markdown injection. The workflow runs Node 24/26 across Linux, macOS, and Windows. Unix-signal watch tests and Unix-specific file-link/control-character filename tests are explicitly skipped on Windows; portable write and directory-link tests still run there.

`demo` writes `packages/ragereport/.demo/ragereport.html` and `packages/ragereport/.demo/ragereport-card.svg` using synthetic histories. It does not scan personal conversations. `dev` builds once and then rebuilds the CLI, library declarations, and embedded browser script after source changes. Keep it running in one terminal and run `pnpm cli ...` in another. Without watch mode, run `pnpm build` after changing source files. After generating a new HTML report, reload its browser tab to see the update; there is no automatic browser reload.

Runtime dependencies: **none**. Development dependencies use exact versions with a lockfile. The selected releases were verified to be more than two days old. GitHub Actions use exact commit pins. Reports are static files; the package exposes no HTTP API.

The source is TypeScript. Node handles the CLI, local files, and its built-in read-only SQLite access. Reports use HTML, CSS, and bundled JavaScript. esbuild bundles the CLI, library, and browser script; TypeScript checks the code and generates public declarations. oxlint and oxfmt handle linting and formatting. See [package.json](package.json) for the exact CLI tool versions. Run workspace commands from the repository root.

Repository instructions for coding agents live in [AGENTS.md](https://github.com/antick/ragereport/blob/main/AGENTS.md). Contribution guidelines live in [CONTRIBUTING.md](CONTRIBUTING.md).

## Troubleshooting

| Problem                                          | What to check                                                                                                                                                                                        |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Installation reports an unsupported Node version | Run `node --version` and switch to Node 24.14 or newer. With nvm, use the repository's `.nvmrc`.                                                                                                     |
| `dist/cli.js` is missing                         | Run `pnpm build` after installing dependencies.                                                                                                                                                      |
| The first full scan is slow                      | Check the progress display: large histories still need an initial read. Repeat all-history scans reuse cached files. Use `--agent` to limit the scan, or Ctrl+C to stop.                             |
| Terminal colors are missing                      | Run `pnpm build`, then `pnpm cli scan`. Colors are enabled by default; check that `--no-color` is not being passed. File exports intentionally use plain text.                                       |
| No messages are found                            | Run `pnpm cli doctor`. Check the selected agent, date range, and configured paths. A new agent installation may not have history yet.                                                                |
| History warnings appear                          | `doctor` lists the affected files and read errors. Share a minimal synthetic example when reporting a schema change.                                                                                 |
| A cost is unavailable                            | The history may have no token usage or model identifier, or the catalog may have no price for that model. Try `cost --refresh-prices` when online. Unavailable usage is never treated as free usage. |
| A price fetch fails                              | Use `report --offline` or `cost --offline`; cached or bundled prices are used and labeled. Models outside the snapshot may remain unpriced.                                                          |
| Recent code changes are missing                  | Rebuild, regenerate the report, and reload the HTML file. For source changes, use `pnpm dev:cli` in a separate terminal.                                                                             |

## Contributing

Bug reports, history-reader improvements, phonetic spelling variants, and report improvements are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, checks, and pull-request guidance.

Report reproducible bugs through [GitHub issues](https://github.com/antick/ragereport/issues). Include the operating system, Node version, RageReport version, agent version, command, and expected behavior. Use synthetic examples instead of personal conversations or unedited diagnostic output.

## Publishing to npm

These steps are for maintainers preparing a release. They describe the manual release process; ordinary builds and the checks workflow do not publish anything.

1. Confirm the intended version in `packages/ragereport/package.json`, update the README's release status when preparing the first release, and finish review of the code and documentation. Verify the public repository and MIT license are ready to share.
2. Run `pnpm install --frozen-lockfile`, `pnpm check`, and `pnpm pack:cli`. Inspect the package file list: compiled CLI/library, declarations, documentation, license, and example configuration should be included. Local reports, fixtures, and personal histories should be absent.
3. Run `pnpm --filter ragereport exec npm pack --pack-destination ../..` and test that archive with the `npx --package=./ragereport-0.1.0.tgz` command above. Use the archive filename for the version being released. `prepack` rebuilds the compiled files automatically; keep development dependencies installed for this step.
4. Log in to the public npm registry and check the package name immediately before the first release:

   ```sh
   npm login --registry=https://registry.npmjs.org
   npm whoami --registry=https://registry.npmjs.org
   npm view ragereport name version --registry=https://registry.npmjs.org
   ```

   A registry `E404` for the package means no package is registered under that name at the time of the check; it does not reserve the name. Authentication or network errors do not establish availability. If the name exists, verify you have permission to publish it before continuing.

5. Publish the tested archive when the release is approved:

   ```sh
   npm publish ./ragereport-0.1.0.tgz --access public --registry=https://registry.npmjs.org
   ```

   Follow npm's login and verification prompts. Each published name/version combination is unique; use a new version for later releases.

6. Check the registry and run the public command from a folder outside this checkout:

   ```sh
   npm view ragereport@0.1.0 version bin engines --registry=https://registry.npmjs.org
   npx --yes ragereport@0.1.0 --version
   npx --yes ragereport --help
   ```

See npm's official [publish command](https://docs.npmjs.com/cli/v11/commands/npm-publish/) and [login command](https://docs.npmjs.com/cli/v11/commands/npm-login/) documentation. Future automated releases can use [npm trusted publishing](https://docs.npmjs.com/trusted-publishers); the current workflow only runs checks.

## License

MIT licensed. See [LICENSE](LICENSE).
