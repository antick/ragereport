import { basename, dirname } from "node:path";
import type { AgentName, Message, ReaderContext, UsageRecord } from "../types.js";
import { contentText, object, string } from "../utils/value.js";
import { timestamp } from "../utils/format.js";
import { jsonLines, walk } from "./files.js";
import { emptyTokens, hasTokens, parseTokens, tokenDelta, usageFrom } from "./tokens.js";
import { jsonlCandidate } from "./jsonl-filter.js";

export async function* readJsonl(
  agent: "claude" | "codex" | "pi",
  path: string,
  context: ReaderContext,
): AsyncGenerator<Message | UsageRecord> {
  for await (const file of walk(path, [".jsonl"], context, agent)) {
    let session = basename(file, ".jsonl");
    let project = basename(dirname(file));
    let model: string | undefined;
    let previous = emptyTokens();
    let signature: string | undefined;
    let replayBefore: string | undefined;
    let rowIndex = 0;
    for await (const value of jsonLines(file, context, agent, (line, complete) =>
      jsonlCandidate(agent, line, context, complete),
    )) {
      rowIndex++;
      const row = object(value);
      const payload = object(row.payload);
      if (row.type === "session_meta" || row.type === "session") {
        session = string(payload.id) ?? string(row.id) ?? session;
        project = string(payload.cwd) ?? string(row.cwd) ?? project;
        if (payload.thread_source === "subagent")
          replayBefore = timestamp(row.timestamp ?? payload.timestamp);
        continue;
      }
      if (agent === "codex" && row.type === "turn_context") {
        model = string(payload.model) ?? model;
        continue;
      }
      const date = timestamp(row.timestamp ?? row.createdAt);
      // Subagent logs can replay parent history before their own task starts.
      if (replayBefore && date && date < replayBefore) continue;
      if (
        agent === "codex" &&
        row.type === "event_msg" &&
        payload.type === "token_count" &&
        context.usage
      ) {
        const info = object(payload.info);
        const total = parseTokens(info.total_token_usage, true);
        const last = info.last_token_usage;
        const tokens = last !== undefined ? parseTokens(last, true) : tokenDelta(total, previous);
        const next = JSON.stringify([last, info.total_token_usage]);
        const duplicate = signature === next;
        signature = next;
        previous = total;
        if (!duplicate && hasTokens(tokens))
          yield {
            agent,
            session,
            model,
            provider: "openai",
            timestamp: date,
            id: `${session}:usage:${JSON.stringify(info.total_token_usage ?? rowIndex)}`,
            ...tokens,
          };
        continue;
      }
      let message = object(row.message);
      if (agent === "codex") {
        if (row.type !== "response_item" || payload.type !== "message") continue;
        message = payload;
      }
      if (agent === "pi" && row.type !== "message") continue;
      if (!Object.keys(message).length) message = row;
      const rawRole = message.role ?? row.role ?? row.type;
      const role = rawRole === "human" ? "user" : rawRole;
      if (role !== "user" && role !== "assistant") continue;
      const wanted = !context.roles || context.roles.includes(role);
      if (!wanted && !(role === "assistant" && context.usage)) continue;
      const text = wanted ? contentText(message.content) : "";
      const messageDate = date ?? timestamp(message.timestamp);
      const id = string(message.id) ?? string(row.uuid) ?? string(row.id);
      const injected =
        role === "user" &&
        /^(?:<environment_context>|<permissions instructions>|# AGENTS\.md instructions|<INSTRUCTIONS>|<system-reminder>)/u.test(
          text.trimStart(),
        );
      if (text.trim() && !injected)
        yield {
          agent,
          role,
          text,
          session: string(row.sessionId) ?? session,
          project: string(row.cwd) ?? project,
          timestamp: messageDate,
          id,
        };
      if (role !== "assistant" || !context.usage || !message.usage) continue;
      const responseModel = string(message.responseModel);
      const usage = usageFrom(agent as AgentName, string(row.sessionId) ?? session, message.usage, {
        id: string(row.requestId) ?? id ?? `${session}:row:${rowIndex}`,
        timestamp: messageDate,
        model: responseModel ?? string(message.model) ?? model,
        provider:
          agent === "claude"
            ? "anthropic"
            : responseModel?.includes("/")
              ? undefined
              : string(message.provider),
      });
      if (usage) yield usage;
    }
  }
}
