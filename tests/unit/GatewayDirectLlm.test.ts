import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { DirectLlmAdapter, NO_SANDBOX } from '../../src/gateway/directLlmAdapter.js';
import type { PublishedEvent, SessionRef } from '../../src/gateway/types.js';

const ref: SessionRef = { id: 's1', userId: 'u', mode: 'chat', backend: 'direct-llm', createdAt: 0 };

function sse(chunks: unknown[]): string { return chunks.map((c) => `data: ${JSON.stringify(c)}\n\n`).join('') + 'data: [DONE]\n\n'; }

async function withServer(handler: (body: any, res: http.ServerResponse) => void, run: (url: string) => Promise<void>): Promise<void> {
  const bodies: any[] = [];
  const server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => { const b = JSON.parse(raw); bodies.push({ auth: req.headers.authorization, ...b }); handler(b, res); });
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  try { await run(`http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`); (withServer as any).bodies = bodies; } finally { server.closeAllConnections(); server.close(); }
}

async function collect(a: DirectLlmAdapter, until: (e: PublishedEvent) => boolean): Promise<PublishedEvent[]> {
  const ac = new AbortController();
  const out: PublishedEvent[] = [];
  for await (const e of a.events(NO_SANDBOX, ref, ac.signal)) { out.push(e); if (until(e)) ac.abort(); }
  return out;
}

describe('DirectLlmAdapter', () => {
  it('streams deltas, then done, usage and completed; keeps history for the next turn', async () => {
    let n = 0;
    await withServer((_b, res) => {
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      n++;
      res.end(sse([{ choices: [{ delta: { content: n === 1 ? 'Hel' : 'Yes' } }] }, { choices: [{ delta: { content: n === 1 ? 'lo' : '!' } }] }, { choices: [], usage: { prompt_tokens: 5, completion_tokens: 2 } }]));
    }, async (url) => {
      const a = new DirectLlmAdapter({ baseUrl: url, apiKey: 'k', model: 'm', systemPrompt: 'sys' });
      await a.createSession(NO_SANDBOX, ref);
      const p = collect(a, (e) => e.type === 'status' && e.status === 'completed');
      await a.send(NO_SANDBOX, ref, { text: 'hi' });
      const ev = await p;
      expect(ev.map((e) => e.type)).toEqual(['status', 'message.delta', 'message.delta', 'message.done', 'usage', 'status']);
      expect(ev.find((e) => e.type === 'message.done')).toMatchObject({ text: 'Hello' });
      expect(ev.find((e) => e.type === 'usage')).toMatchObject({ usage: { inputTokens: 5, outputTokens: 2, totalTokens: 7 } });
    });
  });

  it('sends the whole conversation on the second turn, with the bearer key', async () => {
    const seen: any[] = [];
    await withServer((b, res) => {
      seen.push(b); res.writeHead(200); res.end(sse([{ choices: [{ delta: { content: 'ok' } }] }]));
    }, async (url) => {
      const a = new DirectLlmAdapter({ baseUrl: url, apiKey: 'secret', model: 'm' });
      await a.createSession(NO_SANDBOX, ref);
      const gen = a.events(NO_SANDBOX, ref, new AbortController().signal)[Symbol.asyncIterator]();
      for (const text of ['one', 'two']) {
        await a.send(NO_SANDBOX, ref, { text });
        for (;;) { const r = await gen.next(); if (r.value?.type === 'status' && r.value.status === 'completed') break; }
      }
      expect(seen[1].messages.map((m: any) => m.content)).toEqual(['one', 'ok', 'two']);
      await gen.return?.(undefined);
    });
  });

  it('estimates usage when the provider reports none', async () => {
    await withServer((_b, res) => { res.writeHead(200); res.end(sse([{ choices: [{ delta: { content: 'abcdefgh' } }] }])); }, async (url) => {
      const a = new DirectLlmAdapter({ baseUrl: url, apiKey: 'k', model: 'm' });
      await a.createSession(NO_SANDBOX, ref);
      const p = collect(a, (e) => e.type === 'status' && e.status === 'completed');
      await a.send(NO_SANDBOX, ref, { text: 'abcd' });
      const u = (await p).find((e) => e.type === 'usage') as any;
      expect(u.usage).toMatchObject({ inputTokens: 1, outputTokens: 2 });
    });
  });

  it('reports an upstream failure as a retryable error and lets the user resend', async () => {
    await withServer((_b, res) => { res.writeHead(500); res.end('boom'); }, async (url) => {
      const a = new DirectLlmAdapter({ baseUrl: url, apiKey: 'k', model: 'm' });
      await a.createSession(NO_SANDBOX, ref);
      const p = collect(a, (e) => e.type === 'status' && e.status === 'failed');
      await a.send(NO_SANDBOX, ref, { text: 'hi' });
      const ev = await p;
      expect(ev.find((e) => e.type === 'error')).toMatchObject({ code: 'llm_failed', retryable: true });
      await expect(a.send(NO_SANDBOX, ref, { text: 'again' })).resolves.toBeUndefined();
      await a.stop(NO_SANDBOX, ref);
    });
  });

  it('refuses a second send while a reply is streaming, and stop aborts it', async () => {
    await withServer((_b, res) => { res.writeHead(200); res.write(sse([{ choices: [{ delta: { content: 'x' } }] }]).replace('data: [DONE]\n\n', '')); }, async (url) => {
      const a = new DirectLlmAdapter({ baseUrl: url, apiKey: 'k', model: 'm' });
      await a.createSession(NO_SANDBOX, ref);
      const p = collect(a, (e) => e.type === 'status' && e.status === 'failed');
      await a.send(NO_SANDBOX, ref, { text: 'hi' });
      await expect(a.send(NO_SANDBOX, ref, { text: 'again' })).rejects.toThrow(/already/);
      await new Promise((r) => setTimeout(r, 100));
      await a.stop(NO_SANDBOX, ref);
      const ev = await p;
      expect(ev.some((e) => e.type === 'message.done')).toBe(true);
    });
  });
});

describe('chat mode in SessionService', () => {
  it('creates a chat session without touching the sandbox provider', async () => {
    const { SessionService } = await import('../../src/gateway/sessionService.js');
    const { InMemoryEventBus } = await import('../../src/gateway/eventBus.js');
    const { InMemoryApprovalStore } = await import('../../src/gateway/approvalStore.js');
    const { InMemoryBudgetService } = await import('../../src/gateway/budget.js');
    const svc = new SessionService({
      adapters: { 'direct-llm': new DirectLlmAdapter({ baseUrl: 'http://127.0.0.1:1', apiKey: 'k', model: 'm' }) },
      sandboxes: { acquire: async () => { throw new Error('sandbox must not be used for chat'); } },
      bus: new InMemoryEventBus(), approvals: new InMemoryApprovalStore(),
      budget: new InMemoryBudgetService({ dailyTokenLimit: 1000, dailyCostLimitMicroUsd: null, priceInPerMTokMicroUsd: 0, priceOutPerMTokMicroUsd: 0 }),
    });
    const r = await svc.create('u', 'chat');
    expect(r.kind).toBe('created');
    if (r.kind === 'created') await svc.close(svc.get('u', r.ref.id)!);
  });
});
