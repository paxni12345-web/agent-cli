import express from 'express';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { InMemoryApprovalStore } from '../../src/gateway/approvalStore.js';
import { InMemoryBudgetService } from '../../src/gateway/budget.js';
import { InMemoryEventBus } from '../../src/gateway/eventBus.js';
import { createLlmProxyRouter, LlmTokenStore } from '../../src/gateway/llmProxy.js';
import { SessionService } from '../../src/gateway/sessionService.js';
import type { AgentAdapter } from '../../src/gateway/types.js';

const REAL = 'sk-real-provider-key';
const sse = (chunks: unknown[]) => chunks.map((c) => `data: ${JSON.stringify(c)}\n\n`).join('') + 'data: [DONE]\n\n';
const newBudget = (limit = 1000) => new InMemoryBudgetService({ dailyTokenLimit: limit, dailyCostLimitMicroUsd: null, priceInPerMTokMicroUsd: 0, priceOutPerMTokMicroUsd: 0 });

interface Rig { url: string; upstreamCalls: Array<{ auth?: string; body: any }>; tokens: LlmTokenStore; budget: InMemoryBudgetService; mint(u?: string): string; close(): Promise<void> }

async function rig(upstream: (body: any, res: http.ServerResponse) => void, opts: { limit?: number; maxConcurrentPerUser?: number; now?: () => number } = {}): Promise<Rig> {
  const upstreamCalls: Rig['upstreamCalls'] = [];
  const up = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => { const body = JSON.parse(raw); upstreamCalls.push({ auth: req.headers.authorization, body }); upstream(body, res); });
  });
  await new Promise<void>((r) => up.listen(0, '127.0.0.1', r));
  const tokens = new LlmTokenStore(opts.now);
  const budget = newBudget(opts.limit);
  const app = express();
  app.use('/llm', createLlmProxyRouter({
    tokens, budget, allowedModels: ['m'], maxOutputTokens: 100, maxConcurrentPerUser: opts.maxConcurrentPerUser,
    upstream: { baseUrl: `http://127.0.0.1:${(up.address() as AddressInfo).port}/v1`, apiKey: REAL },
  }));
  const gw = http.createServer(app);
  await new Promise<void>((r) => gw.listen(0, '127.0.0.1', r));
  return {
    url: `http://127.0.0.1:${(gw.address() as AddressInfo).port}/llm/v1`, upstreamCalls, tokens, budget,
    mint: (u = 'u1') => tokens.mint(u, 60_000),
    close: async () => { up.closeAllConnections(); gw.closeAllConnections(); up.close(); gw.close(); },
  };
}

const post = (r: Rig, token: string | null, body: unknown) => fetch(`${r.url}/chat/completions`, {
  method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body),
});
const msg = { model: 'm', messages: [{ role: 'user', content: 'hello world' }] };

describe('LlmTokenStore', () => {
  it('verifies, expires and revokes', () => {
    let t = 1000;
    const s = new LlmTokenStore(() => t);
    const a = s.mint('u', 100); const b = s.mint('u', 100);
    expect(a).not.toBe(b);
    expect(s.verify(a)).toEqual({ userId: 'u' });
    expect(s.verify('gwt_nope')).toBeNull();
    s.revokeUser('u');
    expect(s.verify(b)).toBeNull();
    const c = s.mint('v', 100); t += 101;
    expect(s.verify(c)).toBeNull();
  });
});

describe('LLM proxy', () => {
  let r: Rig;
  afterEach(async () => { await r?.close(); });

  it('rejects missing or unknown tokens and never calls upstream', async () => {
    r = await rig((_b, res) => { res.writeHead(200); res.end('{}'); });
    expect((await post(r, null, msg)).status).toBe(401);
    expect((await post(r, 'gwt_bad', msg)).status).toBe(401);
    expect(r.upstreamCalls).toHaveLength(0);
  });

  it('forwards with the real key (not the sandbox token), books reported usage, returns the answer', async () => {
    r = await rig((_b, res) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ choices: [{ message: { content: 'hi' } }], usage: { prompt_tokens: 12, completion_tokens: 8 } })); });
    const token = r.mint();
    const res = await post(r, token, msg);
    expect(res.status).toBe(200);
    expect((await res.json() as any).choices[0].message.content).toBe('hi');
    expect(r.upstreamCalls[0].auth).toBe(`Bearer ${REAL}`);
    expect(JSON.stringify(r.upstreamCalls[0])).not.toContain(token);
    expect(r.budget.summary('u1').tokensUsed).toBe(20);
  });

  it('streams through, asks for usage, and books the usage chunk', async () => {
    r = await rig((_b, res) => {
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      res.end(sse([{ choices: [{ delta: { content: 'Hel' } }] }, { choices: [{ delta: { content: 'lo' } }] }, { choices: [], usage: { prompt_tokens: 7, completion_tokens: 3 } }]));
    });
    const res = await post(r, r.mint(), { ...msg, stream: true });
    const text = await res.text();
    expect(text).toContain('"Hel"'); expect(text).toContain('[DONE]');
    expect(r.upstreamCalls[0].body.stream_options.include_usage).toBe(true);
    expect(r.budget.summary('u1').tokensUsed).toBe(10);
  });

  it('estimates usage when the provider reports none', async () => {
    r = await rig((_b, res) => { res.writeHead(200); res.end(JSON.stringify({ choices: [{ message: { content: 'abcdefgh' } }] })); });
    await post(r, r.mint(), msg);
    expect(r.budget.summary('u1').tokensUsed).toBeGreaterThan(0);
  });

  it('refuses with 429 once the budget is spent, without calling upstream', async () => {
    r = await rig((_b, res) => { res.writeHead(200); res.end(JSON.stringify({ choices: [], usage: { prompt_tokens: 60, completion_tokens: 60 } })); }, { limit: 100 });
    const token = r.mint();
    expect((await post(r, token, msg)).status).toBe(200);
    const blocked = await post(r, token, msg);
    expect(blocked.status).toBe(429);
    expect(((await blocked.json()) as any).error.type).toBe('budget_exceeded');
    expect(blocked.headers.get('retry-after')).toBeTruthy();
    expect(r.upstreamCalls).toHaveLength(1);
    // another user is unaffected
    expect((await post(r, r.mint('u2'), msg)).status).toBe(200);
  });

  it('only allows configured models and clamps output tokens', async () => {
    r = await rig((_b, res) => { res.writeHead(200); res.end(JSON.stringify({ choices: [], usage: { prompt_tokens: 1, completion_tokens: 1 } })); });
    const token = r.mint();
    expect((await post(r, token, { ...msg, model: 'expensive-model' })).status).toBe(400);
    expect((await post(r, token, { messages: [] })).status).toBe(400);
    await post(r, token, { ...msg, max_tokens: 99999 });
    expect(r.upstreamCalls).toHaveLength(1);
    expect(r.upstreamCalls[0].body.max_tokens).toBe(100);
  });

  it('hides provider error bodies', async () => {
    r = await rig((_b, res) => { res.writeHead(500); res.end('secret account detail sk-123'); });
    const res = await post(r, r.mint(), msg);
    expect(res.status).toBe(502);
    expect(await res.text()).not.toContain('secret');
  });

  it('limits concurrent requests per user', async () => {
    const pending: http.ServerResponse[] = [];
    r = await rig((_b, res) => { pending.push(res); }, { maxConcurrentPerUser: 1 });
    const token = r.mint();
    const first = post(r, token, msg);
    await new Promise((x) => setTimeout(x, 100));
    expect((await post(r, token, msg)).status).toBe(429);
    pending[0].writeHead(200); pending[0].end(JSON.stringify({ choices: [], usage: { prompt_tokens: 1, completion_tokens: 1 } }));
    expect((await first).status).toBe(200);
  });

  it('lists only the allowed models', async () => {
    r = await rig((_b, res) => { res.writeHead(200); res.end('{}'); });
    const res = await fetch(`${r.url}/models`, { headers: { authorization: `Bearer ${r.mint()}` } });
    expect(((await res.json()) as any).data.map((m: any) => m.id)).toEqual(['m']);
  });
});

describe('SessionService with proxied backends', () => {
  it('does not book adapter usage twice, but still stops a run once the budget is spent', async () => {
    const budget = newBudget(50);
    const stops: string[] = [];
    const adapter: AgentAdapter = {
      backend: 'opencode',
      createSession: async () => ({ upstreamId: 'x' }), send: async () => undefined, approve: async () => undefined, health: async () => true,
      stop: async () => { stops.push('stop'); },
      async *events() { yield { type: 'usage', cumulative: false, usage: { inputTokens: 30, outputTokens: 30, totalTokens: 60 } }; await new Promise((r) => setTimeout(r, 500)); },
    };
    const bus = new InMemoryEventBus();
    const svc = new SessionService({
      adapters: { opencode: adapter }, bus, approvals: new InMemoryApprovalStore(), budget, proxiedBackends: ['opencode'],
      sandboxes: { acquire: async () => ({ kind: 'ready', endpoint: { baseUrl: 'http://x', secret: 's', sandboxId: 'sb' } }) },
    });
    const r = await svc.create('u', 'code');
    expect(r.kind).toBe('created');
    await new Promise((x) => setTimeout(x, 100));
    expect(budget.summary('u').tokensUsed).toBe(0); // the proxy books it, not the adapter event
    expect(stops).toHaveLength(0); // budget not exceeded yet

    budget.record('u', 'llm-proxy', { inputTokens: 30, outputTokens: 30, totalTokens: 60 }, false); // what the proxy would have booked
    const r2 = await svc.create('u', 'code');
    expect(r2.kind).toBe('budget');
  });
});
