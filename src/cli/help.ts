export const HELP = `RageReport — your keyboard has stories

Usage: ragereport [scan|cost|slop|report|doctor] [options]

Commands:
  scan       Count your swears, mild insults, and polite expressions (default)
  cost       Estimate token costs and write an interactive HTML cost report
  slop       Count common writing patterns in assistant responses
  report     Write a combined standalone HTML report
  doctor     Check history locations, formats, and read errors

Options:
  --agent, -a <name>        Select one agent
  --since, -s <YYYY-MM-DD>  Include records from this date (UTC)
  --until <YYYY-MM-DD>     Exclude records on/after this date (UTC)
  --day, --days [n]        Last n days (default 1)
  --week / --month         Last 7 / 30 days
  --language <en,hi>       English and/or phonetic Hindi (default both)
  --format <format>        terminal, json, markdown, html, svg
  --output, -o <file>      Write output to a file
  --config <file>          Custom dictionary, exclusions, and history paths
  --home <directory>       Read a different home; ignore discovery env overrides
  --offline               Use cached/bundled prices without networking
  --refresh-prices        Refresh the public price catalog
  --loose-matching        Include ambiguous words such as bc and mc
  --include-code          Also count language inside code blocks
  --no-roast              Hide playful tier labels
  --no-cache              Re-read histories instead of reusing cached scan counts
  --color / --no-color    Colors are on by default; --no-color disables them
  --no-progress           Hide reading progress on stderr
  --watch                 Refresh terminal/HTML until Ctrl+C
  --watch-interval <secs>  Refresh interval (default 5, minimum 1)
  --help, -h / --version   Show help / package version

Agents: claude, codex, cursor, opencode, amp, cline, pi, t3code, zed

Examples:
  npx ragereport
  npx ragereport scan --week --language en,hi
  npx ragereport scan --watch
  npx ragereport cost --month --offline
  npx ragereport report --week
  npx ragereport report --offline --format svg --output reports/ragereport-card.svg
  npx ragereport scan --format json
  npx ragereport report --watch

No agent login or API key required. Histories are read locally and read-only.
Terminal scans include a calendar heatmap and project comparisons.
SVG share cards contain aggregate counts, without transcript excerpts.
Date filters exclude undated records. Cost estimates are API equivalents, not
subscription bills. Assistant writing-pattern matches are a heuristic.
`;
