import { LIMITS } from "../config/constants.js";
import type { AgentName, ReaderContext } from "../types.js";
import { headerField } from "./json-header.js";

// Only reject known native shapes. Unknown key ordering/shapes still use the full parser.
export function jsonlCandidate(
  agent: AgentName,
  line: string,
  context: ReaderContext,
  complete = true,
): boolean {
  const head = line.slice(0, LIMITS.jsonHeaderBytes);
  const type = headerField(head, "type")?.value;
  if (
    (agent === "codex" && type === "session_meta") ||
    ((agent === "claude" || agent === "pi") && (type === "session" || type === "session_meta"))
  )
    return true;
  if (agent === "codex" && type === "turn_context") return context.usage;
  if (agent === "codex" && type === "event_msg" && !context.usage) return false;
  const body = headerField(head, agent === "codex" ? "payload" : "message")?.objectStart;
  const payload =
    agent === "codex" && body !== undefined ? headerField(head, "type", body)?.value : undefined;
  if (agent === "codex" && type === "response_item" && payload && payload !== "message")
    return false;
  const role =
    (body === undefined ? undefined : headerField(head, "role", body)?.value) ??
    headerField(head, "role")?.value;
  const wanted =
    !context.roles ||
    context.roles.includes(role === "human" ? "user" : (role as "user" | "assistant"));
  if (agent === "codex") {
    if (type === "event_msg")
      return (
        context.usage && (body === undefined || payload === undefined || payload === "token_count")
      );
    if (type === "response_item") {
      if (role && !wanted) return false;
    }
  }
  if (agent === "claude" || agent === "pi") {
    if (role && !wanted && !(role === "assistant" && context.usage)) return false;
    // Tool-result arrays contain no authored prose; do not deserialize their large outputs.
    if (
      agent === "claude" &&
      complete &&
      role === "user" &&
      /"content"\s*:\s*\[/u.test(head) &&
      !line.includes('"text"')
    )
      return false;
  }
  return true;
}
