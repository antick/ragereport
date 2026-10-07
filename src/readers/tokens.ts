import type { Tokens, UsageRecord, AgentName } from "../types.js";
import { first, number, object, string } from "../utils/value.js";
export const TOKEN_KEYS = ["input", "output", "reasoning", "cacheRead", "cacheWrite"] as const;
export function emptyTokens(): Tokens {
  return { input: 0, output: 0, reasoning: 0, cacheRead: 0, cacheWrite: 0 };
}
export function parseTokens(value: unknown, inclusive = false): Tokens {
  const r = object(value);
  const cache = object(r.cache);
  const creation = object(r.cache_creation);
  const outputDetails = object(r.output_tokens_details);
  const inputDetails = object(r.input_tokens_details);
  const tokens = {
    input: number(first(r, ["input_tokens", "inputTokens", "input"])),
    output: number(first(r, ["output_tokens", "outputTokens", "output"])),
    reasoning: number(
      first(r, [
        "reasoning_output_tokens",
        "reasoningOutputTokens",
        "reasoning_tokens",
        "reasoningTokens",
        "reasoning",
      ]) ?? outputDetails.reasoning_tokens,
    ),
    cacheRead: number(
      first(r, [
        "cached_input_tokens",
        "cachedInputTokens",
        "cache_read_input_tokens",
        "cacheReadTokens",
        "cacheRead",
      ]) ??
        cache.read ??
        inputDetails.cached_tokens,
    ),
    cacheWrite: number(
      first(r, ["cache_creation_input_tokens", "cacheWriteTokens", "cacheWrite"]) ??
        cache.write ??
        number(creation.ephemeral_1h_input_tokens) + number(creation.ephemeral_5m_input_tokens),
    ),
  };
  if (inclusive) {
    tokens.cacheRead = Math.min(tokens.input, tokens.cacheRead);
    tokens.input -= tokens.cacheRead;
    tokens.reasoning = Math.min(tokens.output, tokens.reasoning);
    tokens.output -= tokens.reasoning;
  }
  return tokens;
}
export function hasTokens(tokens: Tokens): boolean {
  return TOKEN_KEYS.some((key) => tokens[key] > 0);
}
export function addTokens(target: Tokens, tokens: Tokens): void {
  for (const key of TOKEN_KEYS) target[key] += tokens[key];
}
export function tokenDelta(current: Tokens, previous: Tokens): Tokens {
  const reset = TOKEN_KEYS.some((key) => current[key] < previous[key]);
  return Object.fromEntries(
    TOKEN_KEYS.map((key) => [key, reset ? current[key] : current[key] - previous[key]]),
  ) as unknown as Tokens;
}
export function usageFrom(
  agent: AgentName,
  session: string,
  value: unknown,
  extra: Partial<UsageRecord> = {},
  inclusive = false,
): UsageRecord | undefined {
  const r = object(value);
  const tokens = parseTokens(r, inclusive);
  const cost = first(r, ["billedCost", "costUSD", "cost", "totalCost"]);
  const billedCost =
    typeof cost === "number" && Number.isFinite(cost) && cost >= 0 ? cost : undefined;
  if (!hasTokens(tokens) && billedCost === undefined && extra.billedCost === undefined)
    return undefined;
  return {
    agent,
    session,
    ...tokens,
    billedCost,
    provider: string(r.provider),
    model: string(r.model),
    ...extra,
  };
}
