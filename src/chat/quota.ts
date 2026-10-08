/** Per-user daily token quota plus a global daily cost cap. Tokens are estimated, not metered by the provider. */

export interface QuotaPolicy {
  perUserDailyTokens: number;
  /** Hard stop for all users together (derived from the budget when a price is set). */
  globalDailyTokens: number;
  maxChatsPerUser: number;
  maxMessagesPerChat: number;
  maxInputChars: number;
  maxOutputTokens: number;
  historyMessages: number;
  ratePerMinute: number;
}

const int = (value: string | undefined, fallback: number): number => {
  const n = Number.parseInt(value ?? '', 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

export function quotaFromEnv(env: NodeJS.ProcessEnv = process.env): QuotaPolicy {
  let globalDailyTokens = int(env.CHAT_GLOBAL_DAILY_TOKENS, 2_000_000);
  // Optional dollar budget: CHAT_DAILY_BUDGET_USD / CHAT_PRICE_PER_MTOKENS_USD (blended price per million tokens).
  const budget = Number.parseFloat(env.CHAT_DAILY_BUDGET_USD ?? '');
  const price = Number.parseFloat(env.CHAT_PRICE_PER_MTOKENS_USD ?? '');
  if (budget > 0 && price > 0) globalDailyTokens = Math.min(globalDailyTokens, Math.floor((budget / price) * 1_000_000));
  return {
    perUserDailyTokens: int(env.CHAT_DAILY_TOKENS, 50_000),
    globalDailyTokens,
    maxChatsPerUser: int(env.CHAT_MAX_CHATS, 200),
    maxMessagesPerChat: int(env.CHAT_MAX_MESSAGES, 400),
    maxInputChars: int(env.CHAT_MAX_INPUT_CHARS, 8000),
    maxOutputTokens: int(env.CHAT_MAX_OUTPUT_TOKENS, 1500),
    historyMessages: int(env.CHAT_HISTORY_MESSAGES, 30),
    ratePerMinute: int(env.CHAT_RATE_PER_MINUTE, 20),
  };
}

/** Deliberately pessimistic (Thai and code tokenise worse than English), so the cap errs on the safe side. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 2);
}

export const utcDay = (date: Date): string => date.toISOString().slice(0, 10);
