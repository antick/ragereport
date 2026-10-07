# Working on RageReport

RageReport is a pnpm/Turborepo workspace: `packages/ragereport` contains the local CLI and library; `apps/landing` contains the Astro landing page. Preserve read-only history access, offline language scans, and the zero-runtime-dependency design. Report messages, headings, and tier names use English; Hindi dictionary entries use Latin phonetic spellings.

## Before changing code

- Read the relevant source and existing tests. Keep unrelated work and staged changes intact.
- For CLI behavior or exports, read the matching README section. Update it when commands, defaults, formats, or privacy behavior change.
- For readers, dictionary matching, or pricing, read the corresponding guidance in [CLI CONTRIBUTING.md](packages/ragereport/CONTRIBUTING.md#reader-and-dictionary-changes). For dictionary entries, update [the complete inventory](packages/ragereport/docs/dictionary-coverage.md) alongside the source.
- Check Node requirements and dependency versions in `package.json`; use the repository's pinned development version when available.

## Implementation rules

- Choose the simplest clear solution that meets the requirement. Avoid speculative abstractions, unnecessary dependencies, and unrelated rewrites.
- Follow the surrounding naming, formatting, and module patterns. Keep code readable; explain non-obvious decisions instead of adding clever shortcuts.
- Follow DRY: reuse existing helpers and components, and extract genuinely repeated behavior into a shared module. Do not create an abstraction for a single trivial operation.
- Keep code files under 500 lines. Split larger work into reusable modules and reuse existing components, helpers, and reader patterns.
- Put shared thresholds, display settings, palettes, and word definitions in each package’s `src/config`; put reusable formatting and calendar logic in `src/utils`.
- Use the common date formatter for `05 Oct 2026` dates in UTC. Calendar axes may use the shared month formatter. Format elapsed time with the shared duration helper.
- Preserve complete readable text: wrap terminal word variants and project labels rather than truncating them. Terminal colors are enabled by default; `--no-color` supplies readable plain text.
- Test whole-word boundaries, code masking, hostname exclusions, stretched spelling positions, and non-overlapping phrase counts when changing matching. Keep ambiguous spellings behind loose matching and mild insults separate from swear totals.
- Keep missing usage/prices distinct from zero. Preserve the difference between estimated API costs and recorded charges.
- Keep transcripts, message excerpts, secrets, and full local paths out of shared HTML/SVG reports. Use synthetic history fixtures for tests and examples. CLI JSON and doctor diagnostics may contain local paths; document this clearly.
- Use exact dependency versions and update the lockfile with dependency changes. Verify the newest compatible release is at least two days old. Report any newer release excluded by that rule in the final summary.
- The project currently has no HTTP API. The landing page is a static site. If adding or changing an HTTP endpoint, create or update `openapi.json` in the same change.
- Preserve the LF line endings defined by `.gitattributes` so formatting stays consistent across operating systems.
- Keep this `AGENTS.md` current when the user adds project instructions or a change introduces a lasting convention. Preserve these basic rules when reorganizing it.

- Use pnpm with the committed workspace lockfile. Keep the root private and preserve the CLI’s zero runtime dependencies. Share code only when there is an actual second use.
- Keep the landing page static; hydrate only interactive controls. Use Tailwind and the existing shadcn components consistently. Keep its content and links in `apps/landing/src/config`.

## Communication

- Use simple, natural language. Explain necessary technical terms and report concrete results, remaining gaps, and verification honestly.

## Verify and hand off

1. Run root `pnpm check` after code changes; it rebuilds and runs the available tests as well as type, lint, and formatting checks. Add meaningful regression tests for changed behavior.
2. For terminal reports, inspect colored and plain output at a narrow width. For HTML layout changes, regenerate the synthetic demo and inspect the rendered report. Test watch refresh and shutdown when changing watch behavior.
3. For package/CLI changes, check root `pnpm pack:cli` and the built command. Keep private histories and generated exports excluded by `.gitignore` and the package file allowlist.
4. Commit each verified logical change during implementation unless the user asks to leave changes uncommitted. Use a Conventional Commit message (`fix:`, `feat:`, `refactor:`, `docs:`, or another appropriate type), stage only the files belonging to that change, and preserve unrelated work. Never push, publish, or deploy unless explicitly requested. Use the landing app’s Vercel configuration and deployment guide when deployment is requested.
5. Summarize what changed, the commits made, and what verification passed. Always suggest a Conventional Commit message after file changes, including when reporting changes already committed.

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->
