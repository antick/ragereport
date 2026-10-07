import { join } from "node:path";
import type { AgentName, ReaderContext } from "../types.js";

export function sourcePaths(agent: AgentName, context: ReaderContext): string[] {
  if (context.paths?.[agent]) return context.paths[agent];
  const { home: h, env: e } = context;
  const data = e.XDG_DATA_HOME ?? join(h, ".local", "share");
  const config = e.XDG_CONFIG_HOME ?? join(h, ".config");
  const appdata = e.APPDATA ?? join(h, "AppData", "Roaming");
  const mac = join(h, "Library", "Application Support");
  const codex = e.CODEX_HOME ?? join(h, ".codex");
  const claude = e.CLAUDE_CONFIG_DIR ?? join(h, ".claude");
  const cursor = [
    join(mac, "Cursor", "User"),
    join(config, "Cursor", "User"),
    join(appdata, "Cursor", "User"),
  ];
  const clineEditors =
    context.platform === "darwin"
      ? ["Code", "Code - Insiders", "Cursor"].map((editor) =>
          join(mac, editor, "User", "globalStorage"),
        )
      : ["Code", "Code - Insiders", "Cursor"].map((editor) =>
          join(context.platform === "win32" ? appdata : config, editor, "User", "globalStorage"),
        );
  const t3 = e.T3CODE_HOME ?? join(h, ".t3");
  const paths: Record<AgentName, string[]> = {
    claude: [join(claude, "projects")],
    codex: [join(codex, "sessions"), join(codex, "archived_sessions")],
    cursor: cursor.flatMap((base) => [
      join(base, "globalStorage", "state.vscdb"),
      join(base, "workspaceStorage"),
    ]),
    opencode: [
      join(data, "opencode", "opencode.db"),
      join(mac, "opencode", "opencode.db"),
      join(data, "opencode", "storage"),
    ],
    amp: [join(data, "amp", "threads")],
    cline: [
      join(h, ".cline", "data", "tasks"),
      ...clineEditors.flatMap((base) =>
        ["saoudrizwan.claude-dev", "rooveterinaryinc.roo-cline"].map((extension) =>
          join(base, extension, "tasks"),
        ),
      ),
    ],
    pi: [join(e.PI_CODING_AGENT_DIR ?? join(h, ".pi", "agent"), "sessions")],
    t3code: [
      join(t3, "userdata", "state.sqlite"),
      join(t3, "dev", "state.sqlite"),
      ...(e.T3CODE_STATE_DIR ? [join(e.T3CODE_STATE_DIR, "state.sqlite")] : []),
    ],
    zed: [
      join(mac, "Zed", "conversations"),
      join(mac, "Zed", "db"),
      join(data, "zed", "conversations"),
      join(data, "zed", "db"),
    ],
  };
  return [...new Set(paths[agent])];
}
