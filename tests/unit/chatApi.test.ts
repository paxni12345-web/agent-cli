import express from 'express';
import type { Server } from 'http';
import { createChatRouter, ChatDeps } from '../../src/chat/chatRouter.js';
import { MemoryChatStore, SupabaseChatStore } from '../../src/chat/store.js';
import { quotaFromEnv, QuotaPolicy } from '../../src/chat/quota.js';
import type { AIProvider } from '../../src/providers/AIProvider.js';

function fakeProvider(script: () => AsyncIterable<{ delta: string }>): AIProvider {
  return { name: 'fake', chat: async () => { throw new Error('unused'); }, stream: () => script() } as unknown as AIProvider;
}
async function* words(...parts: string[]) { for (const p of parts) yield { delta: p }; }

let server: Server;
let base: string;
let store: MemoryChatStore;
let quota: QuotaPolicy;
let provider: AIProvider;
let storeAvailable = true;
const tokens: Record<string, { uid: string } | null> = { a: { uid: 'user-a' }, b: { uid: 'user-b' }, none: null };

beforeEach(async () => {
  store = new MemoryChatStore();
  storeAvailable = true;
  quota = { ...quotaFromEnv({} as NodeJS.ProcessEnv), perUserDailyTokens: 1000, globalDailyTokens: 5000, maxInputChars: 100, ratePerMinute: 1000 };
  provider = fakeProvider(() => words('Hello', ' there'));
  const deps: ChatDeps = {
    authenticate: async (req, res) => {
      const who = tokens[req.header('authorization')?.replace('Bearer ', '') ?? 'none'];
      if (!who) { res.status(401).json({ error: 'Unauthorized' }); return null; }
      return who;
    },
    get store() { return storeAvailable ? store : null; },
    getModel: () => ({ provider, name: 'fake-model' }),
    get quota() { return quota; },
  };
  const app = express();
  app.use(express.json());
  app.use('/api/chat', createChatRouter(deps));
  await new Promise<void>(resolve => { server = app.listen(0, '127.0.0.1', () => resolve()); });
  const address = server.address();
  base = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}/api/chat`;
});
afterEach(async () => { await new Promise<void>(resolve => server.close(() => resolve())); });

const call = (who: string, path: string, init: RequestInit = {}) =>
  fetch(base + path, { ...init, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${who}`, ...(init.headers ?? {}) } });
const newChat = async (who = 'a') => (await (await call(who, '/chats', { method: 'POST' })).json()) as { id: string };
async function send(who: string, id: string, content: string) {
  const res = await call(who, `/chats/${id}/messages`, { method: 'POST', body: JSON.stringify({ content }) });
  const text = await res.text();
  const events = text.split('\n\n').filter(Boolean).map(chunk => JSON.parse(chunk.replace(/^data: /, '')));
  return { res, events };
}

describe('chat API', () => {
  it('refuses requests that are not signed in', async () => {
    expect((await call('none', '/chats')).status).toBe(401);
  });

  it('creates, lists, reads and deletes a chat', async () => {
    const chat = await newChat();
    expect(((await (await call('a', '/chats')).json()) as { chats: unknown[] }).chats).toHaveLength(1);
    expect((await call('a', `/chats/${chat.id}`)).status).toBe(200);
    expect((await call('a', `/chats/${chat.id}`, { method: 'DELETE' })).status).toBe(200);
    expect((await call('a', `/chats/${chat.id}`)).status).toBe(404);
  });

  it('streams the reply, stores both messages and titles the chat', async () => {
    const chat = await newChat();
    const { res, events } = await send('a', chat.id, 'สวัสดี how are you');
    expect(res.headers.get('content-type')).toContain('text/event-stream');
    expect(events.filter(e => e.delta).map(e => e.delta).join('')).toBe('Hello there');
    expect(events[events.length - 1].done).toBe(true);
    const saved = (await (await call('a', `/chats/${chat.id}`)).json()) as { title: string; messages: { role: string; content: string }[] };
    expect(saved.messages.map(m => m.role)).toEqual(['user', 'assistant']);
    expect(saved.messages[1].content).toBe('Hello there');
    expect(saved.title).toBe('สวัสดี how are you');
  });

  it("keeps users apart: nobody can read, delete or write into another user's chat", async () => {
    const chat = await newChat('a');
    expect((await call('b', `/chats/${chat.id}`)).status).toBe(404);
    expect((await call('b', `/chats/${chat.id}`, { method: 'DELETE' })).status).toBe(404);
    expect((await send('b', chat.id, 'hi')).res.status).toBe(404);
    expect(((await (await call('b', '/chats')).json()) as { chats: unknown[] }).chats).toHaveLength(0);
    expect((await call('a', `/chats/${chat.id}`)).status).toBe(200);
  });

  it('rejects malformed chat ids and oversize or empty messages', async () => {
    expect((await call('a', '/chats/not-a-uuid')).status).toBe(404);
    const chat = await newChat();
    expect((await send('a', chat.id, 'x'.repeat(101))).res.status).toBe(413);
    expect((await send('a', chat.id, '   ')).res.status).toBe(400);
  });

  it('stops a user whose daily quota is used up, and everyone when the global cap is reached', async () => {
    const chat = await newChat();
    await store.addUsage('user-a', new Date().toISOString().slice(0, 10), 1000);
    expect((await send('a', chat.id, 'hi')).res.status).toBe(429);
    const other = await newChat('b');
    expect((await send('b', other.id, 'hi')).res.status).toBe(200);
    quota = { ...quota, globalDailyTokens: 1 };
    expect((await send('b', other.id, 'again')).res.status).toBe(503);
  });

  it('charges estimated tokens for a finished reply', async () => {
    const chat = await newChat();
    const { events } = await send('a', chat.id, 'hello');
    const done = events[events.length - 1];
    expect(done.usage.used).toBeGreaterThan(0);
    expect(done.usage.remaining).toBe(done.usage.limit - done.usage.used);
  });

  it('allows one reply at a time per user', async () => {
    let release: () => void = () => undefined;
    provider = fakeProvider(async function* () { await new Promise<void>(r => { release = r; }); yield { delta: 'late' }; });
    const chat = await newChat();
    const first = send('a', chat.id, 'one');
    await new Promise(r => setTimeout(r, 50));
    expect((await send('a', chat.id, 'two')).res.status).toBe(409);
    release();
    expect((await first).res.status).toBe(200);
  });

  it('reports a model failure without charging or storing an answer', async () => {
    provider = fakeProvider(async function* () { throw new Error('upstream secret detail'); });
    const chat = await newChat();
    const { events } = await send('a', chat.id, 'hi');
    expect(events.some(e => e.error)).toBe(true);
    expect(JSON.stringify(events)).not.toContain('upstream secret detail');
    const saved = (await (await call('a', `/chats/${chat.id}`)).json()) as { messages: unknown[] };
    expect(saved.messages).toHaveLength(1);
    expect(await store.getUsage('user-a', new Date().toISOString().slice(0, 10))).toBe(0);
  });

  it('answers 503 when no storage is configured', async () => {
    storeAvailable = false;
    expect((await call('a', '/chats')).status).toBe(503);
  });
});

describe('Supabase store', () => {
  const uuid = '123e4567-e89b-12d3-a456-426614174000';
  function recorder(reply: unknown = []) {
    const urls: string[] = [];
    const fetchImpl = (async (url: string) => { urls.push(url); return { ok: true, text: async () => JSON.stringify(reply) }; }) as unknown as typeof fetch;
    return { urls, store: new SupabaseChatStore('https://x.supabase.co', 'service-key', fetchImpl) };
  }
  it('scopes every query to the owner', async () => {
    const { urls, store: s } = recorder([{ id: uuid, title: 't', created_at: 'c', updated_at: 'u' }]);
    await s.listChats('uid 1&x', 10);
    await s.getChat('uid-2', uuid);
    expect(urls[0]).toContain('user_id=eq.uid%201%26x');
    expect(urls.slice(1).every(u => u.includes('user_id=eq.uid-2'))).toBe(true);
  });
  it('never sends a non-uuid chat id to the database', async () => {
    const { urls, store: s } = recorder();
    expect(await s.getChat('u', "x' or '1'='1")).toBeNull();
    expect(await s.deleteChat('u', '../etc')).toBe(false);
    expect(urls).toHaveLength(0);
  });
});
