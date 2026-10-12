import crypto from 'node:crypto';
import express, { Router, type Request, type Response } from 'express';
import type { BudgetService } from './budget.js';
import { parseSse } from './opencodeAdapter.js';

/**
 * LLM proxy for sandboxes. Agents inside a sandbox never see the real provider key: they get a short-lived token
 * for ONE user, call this proxy, and the gateway forwards to the provider with the real key, refuses once the
 * user's budget is spent, and books the usage the provider reports (or an estimate when it reports none).
 * Speaks the OpenAI-compatible subset that OpenCode, Hermes and OpenClaw use: chat completions (+ SSE) and /models.
 */

/** Short-lived per-user tokens. Only a hash of each token is kept in memory. */
export class LlmTokenStore {
  private readonly tokens = new Map<string, { userId: string; expiresAt: number }>();
  constructor(private readonly now: () => number = Date.now, private readonly maxTokens = 5000) {}

  private static hash(token: string): string { return crypto.createHash('sha256').update(token).digest('hex'); }

  mint(userId: string, ttlMs: number): string {
    const t = this.now();
    for (const [k, v] of this.tokens) if (v.expiresAt <= t) this.tokens.delete(k);
    if (this.tokens.size >= this.maxTokens) throw new Error('too many active LLM tokens');
    const token = `gwt_${crypto.randomBytes(24).toString('hex')}`;
    this.tokens.set(LlmTokenStore.hash(token), { userId, expiresAt: t + ttlMs });
    return token;
  }

  verify(token: string): { userId: string } | null {
    const v = this.tokens.get(LlmTokenStore.hash(token));
    if (!v) return null;
    if (v.expiresAt <= this.now()) { this.tokens.delete(LlmTokenStore.hash(token)); return null; }
    return { userId: v.userId };
  }

  revokeUser(userId: string): void {
    for (const [k, v] of this.tokens) if (v.userId === userId) this.tokens.delete(k);
  }
}

export interface LlmProxyDeps {
  tokens: LlmTokenStore;
  budget: BudgetService;
  /** OpenAI-compatible provider, e.g. https://api.example.com/v1 */
  upstream: { baseUrl: string; apiKey: string };
  /** Models a sandbox may request; anything else is refused. */
  allowedModels: string[];
  /** Output token ceiling applied when a request asks for more. */
  maxOutputTokens?: number;
  maxConcurrentPerUser?: number;
  ratePerMinute?: number;
  fetchImpl?: typeof fetch;
  now?: () => number;
  timeoutMs?: number;
}

const oaiError = (res: Response, status: number, message: string, type: string, code = type): void => {
  res.status(status).json({ error: { message, type, code } });
};

function secondsUntilUtcMidnight(now: number): number {
  const d = new Date(now);
  return Math.max(1, Math.ceil((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1) - now) / 1000));
}

export function createLlmProxyRouter(d: LlmProxyDeps): Router {
  const router = Router();
  const f = d.fetchImpl ?? fetch;
  const now = d.now ?? Date.now;
  const maxConc = d.maxConcurrentPerUser ?? 4;
  const rate = d.ratePerMinute ?? 240;
  const maxOut = d.maxOutputTokens ?? 8192;
  const inflight = new Map<string, number>();
  const buckets = new Map<string, { count: number; resetAt: number }>();
  const upstreamUrl = `${d.upstream.baseUrl.replace(/\/+$/, '')}/chat/completions`;

  router.use(express.json({ limit: '4mb' }));

  const auth = (req: Request, res: Response): { userId: string } | null => {
    const m = /^Bearer (.+)$/.exec(req.headers.authorization ?? '');
    const who = m ? d.tokens.verify(m[1]) : null;
    if (!who) { oaiError(res, 401, 'Invalid or expired token', 'invalid_api_key'); return null; }
    return who;
  };

  router.get('/v1/models', (req, res) => {
    if (!auth(req, res)) return;
    res.json({ object: 'list', data: d.allowedModels.map((id) => ({ id, object: 'model', owned_by: 'gateway' })) });
  });

  router.post('/v1/chat/completions', async (req: Request, res: Response) => {
    const who = auth(req, res);
    if (!who) return;
    const { userId } = who;

    const t = now();
    const b = buckets.get(userId);
    if (!b || t >= b.resetAt) buckets.set(userId, { count: 1, resetAt: t + 60_000 });
    else if (++b.count > rate) { res.setHeader('Retry-After', Math.ceil((b.resetAt - t) / 1000)); oaiError(res, 429, 'Too many requests', 'rate_limit_exceeded'); return; }

    const body = req.body as Record<string, any> | undefined;
    if (!body || typeof body !== 'object' || !Array.isArray(body.messages)) { oaiError(res, 400, 'messages is required', 'invalid_request_error'); return; }
    if (typeof body.model !== 'string' || !d.allowedModels.includes(body.model)) {
      oaiError(res, 400, `model must be one of: ${d.allowedModels.join(', ')}`, 'invalid_request_error', 'model_not_allowed'); return;
    }
    if (d.budget.check(userId).exceeded) {
      res.setHeader('Retry-After', secondsUntilUtcMidnight(t));
      oaiError(res, 429, 'Daily budget reached', 'budget_exceeded'); return;
    }
    if ((inflight.get(userId) ?? 0) >= maxConc) { oaiError(res, 429, 'Too many requests in flight', 'rate_limit_exceeded'); return; }

    const stream = body.stream === true;
    const out: Record<string, any> = { ...body };
    for (const k of ['max_tokens', 'max_completion_tokens']) if (typeof out[k] === 'number' && out[k] > maxOut) out[k] = maxOut;
    if (stream) out.stream_options = { ...(out.stream_options ?? {}), include_usage: true };

    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), d.timeoutMs ?? 300_000);
    res.on('close', () => { if (!res.writableEnded) ctl.abort(); });
    inflight.set(userId, (inflight.get(userId) ?? 0) + 1);

    let usage: { prompt?: number; completion?: number } | undefined;
    let outChars = 0;
    const inChars = JSON.stringify(body.messages).length;
    const book = () => {
      const input = usage?.prompt ?? Math.ceil(inChars / 4);
      const output = usage?.completion ?? Math.ceil(outChars / 4); // rough estimate when the provider reports nothing
      d.budget.record(userId, 'llm-proxy', { inputTokens: input, outputTokens: output, totalTokens: input + output }, false);
    };

    try {
      const up = await f(upstreamUrl, {
        method: 'POST', signal: ctl.signal,
        headers: { 'content-type': 'application/json', authorization: `Bearer ${d.upstream.apiKey}` },
        body: JSON.stringify(out),
      });
      if (!up.ok || !up.body) {
        // Never forward provider error bodies: they can echo request details or account information.
        console.error(`[llm-proxy] upstream ${up.status}`);
        oaiError(res, up.status === 429 ? 429 : 502, 'The model provider returned an error', 'upstream_error');
        return;
      }
      if (!stream) {
        const j = (await up.json()) as { usage?: { prompt_tokens?: number; completion_tokens?: number }; choices?: Array<{ message?: { content?: string } }> };
        if (j.usage) usage = { prompt: j.usage.prompt_tokens, completion: j.usage.completion_tokens };
        else outChars = (j.choices ?? []).reduce((n, c) => n + (c.message?.content?.length ?? 0), 0);
        book();
        res.status(200).json(j);
        return;
      }
      res.status(200);
      res.setHeader('content-type', 'text/event-stream');
      res.setHeader('cache-control', 'no-cache');
      res.setHeader('x-accel-buffering', 'no');
      res.flushHeaders?.();
      const decoder = new TextDecoder();
      const buf = { text: '' };
      try {
        for await (const chunk of up.body as unknown as AsyncIterable<Uint8Array>) {
          res.write(chunk);
          for (const raw of parseSse(buf, decoder.decode(chunk, { stream: true }))) {
            const j = raw as { choices?: Array<{ delta?: { content?: string } }>; usage?: { prompt_tokens?: number; completion_tokens?: number } };
            if (j.usage) usage = { prompt: j.usage.prompt_tokens, completion: j.usage.completion_tokens };
            outChars += j.choices?.[0]?.delta?.content?.length ?? 0;
          }
        }
      } finally {
        book(); // also when the client hung up half-way: tokens already generated are paid for
      }
      res.end();
    } catch (err) {
      if (!res.headersSent) oaiError(res, 502, 'The model provider could not be reached', 'upstream_error');
      else res.end();
      if (!ctl.signal.aborted) console.error('[llm-proxy] error:', err instanceof Error ? err.message : err);
    } finally {
      clearTimeout(timer);
      inflight.set(userId, Math.max(0, (inflight.get(userId) ?? 1) - 1));
    }
  });

  router.use((_req, res) => oaiError(res, 404, 'Not supported by this proxy', 'not_found'));
  return router;
}
