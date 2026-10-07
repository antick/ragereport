# Working on RageReport

RageReport is a local CLI and library. Preserve read-only history access, offline language scans, and the zero-runtime-dependency design. Report messages, headings, and tier names use English; Hindi dictionary entries use Latin phonetic spellings.

## Before changing code

- Read the relevant source and existing tests. Keep unrelated work and staged changes intact.
- For CLI behavior or exports, read the matching README section. Update it when commands, defaults, formats, or privacy behavior change.
- For readers, dictionary matching, or pricing, read the corresponding guidance in [CONTRIBUTING.md](CONTRIBUTING.md#reader-and-dictionary-changes). For dictionary entries, update [the complete inventory](docs/dictionary-coverage.md) alongside the source.
- Check Node requirements and dependency versions in `package.json`; use the repository's pinned development version when available.

## Implementation rules

- Keep code files under 500 lines. Split larger work into reusable modules and reuse existing components, helpers, and reader patterns.
- Put shared thresholds, display settings, palettes, and word definitions in `src/config`; put reusable formatting and calendar logic in `src/utils`.
- Use the common date formatter for `05 Oct 2026` dates in UTC. Calendar axes may use the shared month formatter. Format elapsed time with the shared duration helper.
- Preserve complete readable text: wrap terminal word variants and project labels rather than truncating them. Terminal colors are enabled by default; `--no-color` supplies readable plain text.
- Test whole-word boundaries, code masking, hostname exclusions, stretched spelling positions, and non-overlapping phrase counts when changing matching. Keep ambiguous spellings behind loose matching and mild insults separate from swear totals.
- Keep missing usage/prices distinct from zero. Preserve the difference between estimated API costs and recorded charges.
- Keep transcripts, message excerpts, secrets, and full local paths out of shared HTML/SVG reports. Use synthetic history fixtures for tests and examples. CLI JSON and doctor diagnostics may contain local paths; document this clearly.
- Use exact dependency versions and update the lockfile with dependency changes. Verify the newest compatible release is at least two days old. Report any newer release excluded by that rule in the final summary.
- The project currently has no HTTP API. If adding or changing an HTTP endpoint, create or update `openapi.json` in the same change.

## Verify and hand off

1. Run `npm run check` after code changes; it rebuilds and runs the available tests as well as type, lint, and formatting checks. Add meaningful regression tests for changed behavior.
2. For terminal reports, inspect colored and plain output at a narrow width. For HTML layout changes, regenerate the synthetic demo and inspect the rendered report. Test watch refresh and shutdown when changing watch behavior.
3. For package/CLI changes, check `npm pack --dry-run` and the built command. Keep private histories and generated exports excluded by `.gitignore` and the package file allowlist.
4. Summarize what changed and what verification passed. Always suggest a Conventional Commit message after file changes. Commit, push, publish, or deploy only when the user explicitly requests that action; otherwise leave the work uncommitted.
