import { basename, dirname } from "node:path";
import type { AgentName, Message, ReaderContext, UsageRecord } from "../types.js";
import { LIMITS } from "../config/constants.js";
import { contentText, first, object, string } from "../utils/value.js";
import { timestamp } from "../utils/format.js";
import { readJson, walk } from "./files.js";
import { usageFrom } from "./tokens.js";

export async function* readJsonHistory(
  agent: AgentName,
  path: string,
  context: ReaderContext,
): AsyncGenerator<Message | UsageRecord> {
  for await (const file of walk(path, [".json"], context, agent)) {
    if (agent === "cline" && basename(file) !== "api_conversation_history.json") continue;
    const value = await readJson(file, context, agent);
    const root = object(value);
    const session =
      string(root.id) ??
      string(root.sessionId) ??
      (agent === "cline" ? basename(dirname(file)) : basename(file, ".json"));
    const messages = Array.isArray(value) ? value : root.messages;
    if (!Array.isArray(messages)) {
      context.diagnostics.push({
        agent,
        path: file,
        status: "warning",
        detail: "No recognized messages array",
      });
      continue;
    }
    for (const [index, item] of messages.entries()) {
      const message = object(item);
      const role = message.role;
      if (role !== "user" && role !== "assistant") continue;
      const text = contentText(message.content ?? message.text);
      const date = timestamp(first(message, ["timestamp", "createdAt", "ts", "time"]));
      if (text.trim())
        yield {
          agent,
          session,
          role,
          text,
          id: string(message.id) ?? `${session}:${index}`,
          timestamp: date,
          project: string(root.cwd),
        };
      if (context.usage && role === "assistant" && message.usage && !root.usageLedger) {
        const usage = usageFrom(agent, session, message.usage, {
          id: string(message.id) ?? `${session}:${index}`,
          timestamp: date,
          model: string(message.model),
          provider: string(message.provider),
        });
        if (usage) yield usage;
      }
    }
    if (agent === "amp" && context.usage && root.usageLedger)
      yield* readLedger(root.usageLedger, session);
  }
}
function* readLedger(
  value: unknown,
  session: string,
  inherited: Partial<UsageRecord> = {},
  depth = 0,
  index = "ledger",
): Generator<UsageRecord> {
  if (depth > LIMITS.depth) return;
  if (Array.isArray(value)) {
    for (const [i, item] of value.entries())
      yield* readLedger(item, session, inherited, depth + 1, `${index}:${i}`);
    return;
  }
  const r = object(value);
  const extra = {
    ...inherited,
    model: string(first(r, ["model", "modelID", "modelId"])) ?? inherited.model,
    provider: string(first(r, ["provider", "providerID", "providerId"])) ?? inherited.provider,
    timestamp:
      timestamp(first(r, ["timestamp", "createdAt", "time", "date"])) ?? inherited.timestamp,
  };
  const source = r.usage ?? r.tokens ?? r.tokenUsage ?? r;
  const usage = usageFrom(
    "amp",
    session,
    source,
    {
      ...extra,
      id: string(r.id) ?? string(r.requestId) ?? `${session}:${index}`,
      billedCost: typeof r.cost === "number" ? r.cost : undefined,
    },
    object(source).cachedInputTokens !== undefined ||
      object(source).cached_input_tokens !== undefined,
  );
  if (usage) {
    yield usage;
    return;
  }
  for (const [key, child] of Object.entries(r))
    if (child && typeof child === "object")
      yield* readLedger(child, session, extra, depth + 1, `${index}:${key}`);
}
