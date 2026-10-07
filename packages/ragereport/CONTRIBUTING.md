# Contributing to RageReport

Thanks for helping improve RageReport. Reader fixes, phonetic Hindi spelling variants, useful report improvements, and clear bug reports are welcome.

## Local setup

Use Node.js 24.16 or newer and pnpm 12.9.1. Run workspace commands from the repository root. The repository's `.nvmrc` selects the development version.

```sh
git clone https://github.com/antick/ragereport.git
cd ragereport
pnpm install --frozen-lockfile
pnpm build
pnpm cli --help
pnpm demo
```

Open `packages/ragereport/.demo/ragereport.html` to explore a report made from synthetic histories. To make changes, run `pnpm dev:cli` in one terminal and use `pnpm cli ...` in another. Regenerate and reload reports after rebuilding.

## Before opening a pull request

```sh
pnpm format:write
pnpm check
pnpm pack:cli
```

Explain what changed, why, and how you verified it. Use a short title starting with a change type, such as `fix: handle streamed usage snapshots` or `feat: add phonetic spelling variants`.

- Keep source files under 500 lines and split larger modules into reusable pieces.
- Put shared settings, thresholds, and word definitions in the common configuration modules.
- Reuse the date helpers in `src/utils/format.ts`; reports display dates in UTC as `05 Oct 2026`.
- Use exact dependency versions and commit lockfile changes with any dependency update. Choose the newest compatible release that is at least two days old.
- Keep the README and example configuration consistent with behavior changes.
- Add meaningful regression coverage for reader, detector, pricing, and command behavior changes. Verify report changes in a browser at desktop and phone widths.
- Keep local history access read-only and reports usable without a server. Network requests should remain limited to the public pricing catalog.

## Reader and dictionary changes

Readers live in `src/readers`, normalized public types in `src/types.ts`, and synthetic history builders in `test/fixtures.mjs`. A reader change should include a minimal fixture showing the real storage shape and assertions for the expected messages or usage. Include coverage for malformed records or missing fields when relevant. Unsupported schemas should produce helpful diagnostics.

Word definitions live in `src/config/words.ts`. Hindi entries use English phonetic spellings. Group spelling variants into families, keep mild insults separate from swear totals, and gate ambiguous short forms behind loose matching. Preserve hostname exclusions, code masking, match positions, and non-overlapping counts when changing detection.

Pricing changes should distinguish missing prices from zero-cost usage and keep recorded charges separate from estimates. Cache and reasoning tokens must not be charged twice when a source includes them in a larger token count.

## Reporting bugs

Open an issue at [github.com/antick/ragereport/issues](https://github.com/antick/ragereport/issues). Include:

- Your operating system, Node version, RageReport version, and relevant agent version.
- The command you ran and what you expected to happen.
- The error or incorrect result, with local paths and personal details removed.
- A small synthetic example that reproduces a reader or matching problem, if possible.

Do not submit real conversation logs, API keys, or personal history databases. `doctor` output and CLI JSON diagnostics can contain local paths; edit them before posting. An HTML or SVG export contains aggregates and word variants, so review those too before sharing.

## Releases and license

The [README publishing guide](README.md#publishing-to-npm) describes the maintainer's release process. Pull requests and the checks workflow do not publish packages.

RageReport uses the [MIT license](LICENSE). Contributions are distributed under the same license.
