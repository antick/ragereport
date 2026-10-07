# RageReport security review

Reviewed on **05 Oct 2026** against the current local working tree, before the first public release.

## Result

The original review confirmed **three medium-severity issues** and **one low-severity, viewer-dependent issue**. All four have now been fixed in the local working tree, with regression tests that failed against the original implementation and pass after remediation. No reviewed finding remains open. This is a scoped result, not a guarantee that all possible vulnerabilities are absent.

The dependency audit returned **zero known vulnerabilities**. Dependency versions were unchanged during remediation, and no critical or high-severity issue was confirmed in the application code.

| ID      | Original severity | Status | Regression verification                                                                          |
| ------- | ----------------- | ------ | ------------------------------------------------------------------------------------------------ |
| SEC-001 | Medium            | Fixed  | Traversal and outside links blocked; valid parts and inline messages preserved                   |
| SEC-002 | Medium            | Fixed  | Planted links harmless; private permissions, concurrent writes, and failed-write cleanup checked |
| SEC-003 | Medium            | Fixed  | Injected controls removed from terminal reports and CLI diagnostics; colors retained             |
| SEC-004 | Low               | Fixed  | HTML and Markdown constructs escaped; original JSON fields preserved                             |

These findings require local or imported input, or a writable export directory. RageReport has no HTTP server, login system, or remote command interface. This review did not identify a remotely reachable service vulnerability.

## Remediation

- **SEC-001:** `src/readers/legacy-parts.ts` validates native IDs as single filename components and checks resolved directory containment before reading parts. `src/utils/paths.ts` provides the shared containment check. The reader identifies the closest legacy message directory, preserving storage paths with an ancestor also named `message`, and checks it against the original source scope retained through per-file caching. Invalid part references produce warnings without dropping inline message text. Regression tests are in `test/security-readers.test.mjs`.
- **SEC-002:** `src/utils/files.ts` now creates a fresh private temporary directory and opens its file exclusively with owner-only creation permissions before replacing the output. It cleans up its own temporary file and directory on success or failure. Both scan and pricing caches use this helper. It replaces an existing destination link rather than writing through that link. `.gitignore` excludes abandoned private temporary directories. Regression tests are in `test/security-files.test.mjs`.
- **SEC-003:** `src/utils/terminal.ts` and the browser-compatible `src/utils/text.ts` provide shared sanitizers for escape sequences, control characters, line-spoofing whitespace, and bidirectional formatting controls. Coloring, fitting, wrapping, model/provider display, saved-path announcements, progress text, and CLI error output use them. Application-generated colors and watch redraw sequences are preserved. Regression tests are in `test/security-output.test.mjs`.
- **SEC-004:** `src/reports/escape.ts` provides context-specific Markdown escaping. The Markdown exporter escapes dynamic labels and cells before adding its own formatting. Shared vocabulary formatting escapes group/variant text while retaining complete variants and their counts. JSON output retains literal metadata. Regression tests are in `test/security-output.test.mjs`.

The original evidence below describes the pre-fix snapshot. Its source line numbers, vulnerable snippets, and temporary mitigations are historical and do not describe the current implementation. The remediation references above identify the current code.

## Original medium findings

### SEC-001: Keep legacy message IDs inside the part directory

- **Rule:** CWE-22, improper restriction of a pathname to a directory.
- **Location:** `src/readers/opencode.ts:91–96`, `readLegacy`; `src/readers/files.ts:16`, `walk`.
- **Evidence:** The history-supplied ID becomes part of a filesystem path: ``walk(`${root}/part/${id}`, ...)``. The ID is only checked to be a non-empty string. The walker accepts its starting path using `stat`, which also follows a starting-path symlink.
- **Impact:** Someone who supplies or changes a legacy message JSON file can make the reader inspect JSON files outside the configured history storage, within the permissions of the person running RageReport. Recognized text parts can become returned library messages and contribute to exported language counts. This does not itself upload files or allow writing them.
- **Reproduction:** A synthetic storage tree contained `message/message.json` with `id: "../../outside"`, plus an existing `part/` directory. A sibling `outside/private-part.json` held a synthetic text part with one swear and one polite expression. Scanning only the storage tree still read the sibling file and counted both expressions.
- **Fix:** Validate native IDs as single path components, rejecting separators, traversal segments, and invalid native ID forms. Resolve the part directory and candidate paths and enforce containment, including resolved symlink targets. Invalid IDs should produce a warning and must not initiate an outside read.
- **Mitigation:** Until fixed, use trusted native legacy histories and avoid importing untrusted legacy history trees.
- **Limit:** Ordinary valid IDs are unaffected. The demonstrated issue concerns the legacy JSON reader, not parameterized SQLite queries. The proof used synthetic files; no personal files were accessed.

### SEC-002: Create temporary files exclusively

- **Rule:** CWE-377/CWE-59, insecure temporary file creation and link following.
- **Location:** `src/utils/files.ts:4–8`, `writePrivateFile`; callers include report exports and scan caches.
- **Evidence:** The helper constructs `${path}.${process.pid}.tmp` and calls `writeFile(temporary, value, { mode: 0o600 })` without exclusive creation. An existing symbolic link is followed before the subsequent rename.
- **Impact:** If another actor can write to the output directory, they can plant a predictable temporary-path link to another file writable by the CLI user. Generating a report then truncates and overwrites that other file. A pre-existing regular temporary file can also retain its previous, broader permissions because the mode option applies when creating a file.
- **Reproduction:** In a disposable directory, a link at the predicted temporary name pointed to a synthetic victim text file. Calling the actual source helper changed the victim's content and left the output path as a symbolic link.
- **Fix:** Create a fresh temporary file with an unpredictable name and exclusive creation (`wx`), using owner-only permissions. Write through the opened handle, close it, then rename it into place. Clean up only the temporary file successfully created by that operation. Keep cache directories private and handle existing links or unsafe directory ownership deliberately.
- **Mitigation:** Keep export and cache directories under the current user's control. Default private cache directories reduce exposure, but the reusable helper also writes to ordinary project/export directories.
- **Limit:** The attack requires access to the destination directory and cannot exceed the operating-system permissions of the process. The proof overwrote only a temporary synthetic victim.

Node documents the behavior of write flags and creation permissions in its [filesystem API](https://nodejs.org/api/fs.html#file-system-flags).

### SEC-003: Sanitize every history string before terminal output

- **Rule:** CWE-150, improper neutralization of escape and control sequences.
- **Location:** `src/reports/terminal.ts:115–119`, model breakdown; `src/readers/jsonl.ts:99–109`, history-derived model/provider fields.
- **Evidence:** The model row interpolates `${entry.provider}/${entry.model}` directly. Those strings bypass the existing `paint` helper's terminal-control filtering.
- **Impact:** A crafted imported or modified history can place terminal control sequences into `cost` or combined terminal reports. These can erase or spoof output; other actions depend on the terminal's supported escape sequences. The issue remains with `--no-color` because disabling intentional colors does not sanitize the interpolated model string.
- **Reproduction:** A synthetic Claude assistant usage record had a model name containing the screen-clear sequence `ESC [ 2 J`. Running the actual CLI with `cost --offline --no-progress --no-color --format terminal` retained those exact bytes in captured stdout. The bytes were captured as data, not sent to an interactive terminal.
- **Fix:** Introduce or reuse one terminal text sanitizer and apply it to every untrusted string, including model/provider names, dictionary group labels, paths, and diagnostic/error messages. Apply intentional colors after sanitizing text. Keep the application's explicit watch redraw controls separate from input text.
- **Mitigation:** Use JSON or the escaped HTML report for untrusted imported histories until terminal output is fixed.
- **Limit:** The screen-clear payload was confirmed. Clipboard changes, terminal-specific behavior, and command execution were not tested or claimed.

## Original low finding

### SEC-004: Escape Markdown data for its output context

- **Rule:** CWE-116; potential CWE-79 when a downstream viewer allows active raw HTML.
- **Location:** `src/reports/text.ts:9–10`, `cell`, and `src/reports/text.ts:54–56`, model table. Custom word labels also pass through `cell`.
- **Evidence:** The Markdown helper escapes pipes and newlines but leaves HTML tags and Markdown link syntax intact. Model/provider fields originate in histories.
- **Impact:** A crafted model name can introduce raw HTML or misleading links into the Markdown export. Active behavior depends on the Markdown viewer's sanitization rules. This is not a confirmed script-execution issue in RageReport's generated HTML dashboard, which uses separate escaping.
- **Reproduction:** A synthetic model name containing an image tag with an event-handler attribute appeared unchanged in `renderMarkdown` output. No event handler was executed during the test.
- **Fix:** Escape raw HTML and Markdown syntax in every data cell and data-derived label. Preserve the exporter-generated headings and tables. Add regression cases for HTML tags, links, brackets, backticks, pipes, and newlines.
- **Mitigation:** Use a Markdown viewer that sanitizes raw HTML, or use the escaped HTML/SVG export.
- **Limit:** Raw output was confirmed; unsafe rendering in a particular Markdown application was not tested. Viewers that sanitize or disable raw HTML reduce this risk.

## Controls checked

- `npm audit --json` queried the live public registry successfully and returned zero findings across the locked dependency tree, including development dependencies. There are no runtime package dependencies. All lockfile package entries had versions, integrity hashes, and HTTPS public-registry URLs.
- Public source/configuration files were checked for common token, private-key, and personal-home-path patterns. No matches were found. No private history databases, JSONL files, environment files, or generated reports were staged. This was a pattern scan, not proof that every possible secret format is absent.
- SQLite opens use `readOnly: true` and `allowExtension: false`. Dynamic SQL identifiers are quoted, and input values use parameters where applicable.
- HTML's embedded JSON escapes script-closing delimiters. Browser table labels and text fields use HTML escaping or `textContent`. SVG text is escaped. Existing tests check that transcripts and full history paths stay out of shared HTML/SVG reports.
- Runtime code has no shell execution, `eval`, dynamic code creation, remote script imports, or transcript-upload path. The build script uses `execFileSync` with a fixed executable and argument array.
- The pricing request uses a fixed HTTPS endpoint and a timeout, with offline/cache fallback. It sends no transcript payload.
- GitHub Actions use pinned commit hashes, read-only repository permissions, and `npm ci --ignore-scripts`. The workflow does not publish packages or run a privileged pull-request-target job.

The [npm audit documentation](https://docs.npmjs.com/cli/v11/commands/npm-audit/) explains the known-advisory check; it does not replace reviewing first-party code.

## Further hardening

These are improvements, not additional confirmed vulnerabilities in this review:

- Add a restrictive, hash-based content security policy to standalone HTML reports. Current HTML escaping resisted the inspected injection paths, but there is no browser policy to limit the effect of a future escaping mistake. Keep the single-file, offline report functional.
- Bound individual JSONL records and remote pricing-response size. Whole JSON files already have a size limit, but accepted JSONL records and price JSON are not similarly bounded. Large personal histories are an intended input, so enforce record limits without imposing a small total-history limit.
- Keep using a current supported Node patch release. Dependency audit does not assess the installed Node executable or operating system.

## Verification and limits

The reproductions and new regression tests use disposable synthetic fixtures. Temporary victim/history files were removed after the checks. Remediation changed the runtime source, tests, README, ignore rules, and this report. Dependency versions, the Git index, and publication state were left unchanged. No dependency upgrade was selected or excluded under the two-day release-age rule.

The full `npm run check` verification passed: type checking, linting, formatting, build, and **79 tests** on macOS with Node 24. The additional 13 tests cover the findings and normal behavior alongside the existing 66 tests. Windows-specific skips are limited to file symlinks/control-character filenames and existing Unix-signal watch tests; Windows and Linux CI must still run after the changes are pushed.

The live npm dependency audit was repeated after remediation and again returned zero known vulnerabilities. A fresh npm archive was tested through offline `npx` outside the checkout: normal synthetic totals, default colors, plain output, calendar/project panels, cached and uncached source containment, terminal/Markdown injection defenses, and HTML export all passed. The 66-entry archive contained no private histories, generated reports, test fixtures, or private temporary directories.

This review covers the local code, lockfile, workflow configuration, and visible file/package exclusions. It does not prove the absence of all vulnerabilities or assess GitHub/npm account security, unpublished remote settings, every supported operating system, every terminal/viewer, or unknown dependency vulnerabilities. No npm release or repository push was performed.
