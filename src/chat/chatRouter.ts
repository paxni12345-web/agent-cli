import { Router, Request, Response } from 'express';
import type { AIProvider } from '../providers/AIProvider.js';
import type { ChatMessage } from '../types/index.js';
import { ChatStore, UUID_RE } from './store.js';
import { QuotaPolicy, estimateTokens, utcDay } from './quota.js';

/**
 * Plain chat for signed-in users: stored history per user, streamed replies,
 * daily quota. The model is called WITHOUT tools, so nothing here can touch the
 * server's files or shell. The agent (with tools) stays on /api/agent.
 */

export interface ChatIdentity { uid: string; email?: string; name?: string }

export interface ChatDeps {
  /** Answers the request itself (401/403/503) and returns null when the caller may not continue. */
  authenticate(req: Request, res: Response): Promise<ChatIdentity | null>;
  store: ChatStore | null;
  getModel(): { provider: AIProvider; name: string } | null;
  quota: QuotaPolicy;
  systemPrompt?: string;
  now?: () => Date;
}

const DEFAULT_TITLE = 'New chat';

export function createChatRouter(deps: ChatDeps): Router {
  const router = Router();
  const now = deps.now ?? (() => new Date());
  const inFlight = new Set<string>();
  const buckets = new Map<string, { count: number; resetAt: number }>();

  const rateLimited = (uid: string): number => {
    const t = now().getTime();
    const b = buckets.get(uid);
    if (!b || t >= b.resetAt) { buckets.set(uid, { count: 1, resetAt: t + 60_000 }); return 0; }
    b.count++;
    return b.count > deps.quota.ratePerMinute ? Math.ceil((b.resetAt - t) / 1000) : 0;
  };

  /** Common gate for every chat route. */
  async function gate(req: Request, res: Response): Promise<{ user: ChatIdentity; store: ChatStore } | null> {
    const user = await deps.authenticate(req, res);
    if (!user) return null;
    const wait = rateLimited(user.uid);
    if (wait) { res.setHeader('Retry-After', wait); res.status(429).json({ error: 'Too many requests' }); return null; }
    if (!deps.store) { res.status(503).json({ error: 'Chat storage is not configured' }); return null; }
    return { user, store: deps.store };
  }
  const wrap = (fn: (req: Request, res: Response) => Promise<void>) => (req: Request, res: Response) => {
    fn(req, res).catch(error => {
      console.error('[chat] error:', error instanceof Error ? error.message : error);
      if (!res.headersSent) res.status(500).json({ error: 'Internal server error' });
      else res.end();
    });
  };
  const validId = (req: Request, res: Response): string | null => {
    const id = String(req.params.id ?? '');
    if (!UUID_RE.test(id)) { res.status(404).json({ error: 'Chat not found' }); return null; }
    return id;
  };

  async function usageSummary(store: ChatStore, uid: string) {
    const day = utcDay(now());
    const used = await store.getUsage(uid, day);
    return { day, used, limit: deps.quota.perUserDailyTokens, remaining: Math.max(0, deps.quota.perUserDailyTokens - used) };
  }

  router.get('/me', wrap(async (req, res) => {
    const g = await gate(req, res); if (!g) return;
    res.json({ uid: g.user.uid, email: g.user.email ?? null, name: g.user.name ?? null, usage: await usageSummary(g.store, g.user.uid), modelReady: Boolean(deps.getModel()) });
  }));

  router.get('/chats', wrap(async (req, res) => {
    const g = await gate(req, res); if (!g) return;
    res.json({ chats: await g.store.listChats(g.user.uid, 100) });
  }));

  router.post('/chats', wrap(async (req, res) => {
    const g = await gate(req, res); if (!g) return;
    if (await g.store.countChats(g.user.uid) >= deps.quota.maxChatsPerUser) { res.status(429).json({ error: 'Chat limit reached; delete an old chat first' }); return; }
    res.status(201).json(await g.store.createChat(g.user.uid, DEFAULT_TITLE));
  }));

  router.get('/chats/:id', wrap(async (req, res) => {
    const g = await gate(req, res); if (!g) return;
    const id = validId(req, res); if (!id) return;
    const chat = await g.store.getChat(g.user.uid, id);
    if (!chat) { res.status(404).json({ error: 'Chat not found' }); return; }
    res.json(chat);
  }));

  router.delete('/chats/:id', wrap(async (req, res) => {
    const g = await gate(req, res); if (!g) return;
    const id = validId(req, res); if (!id) return;
    if (!(await g.store.deleteChat(g.user.uid, id))) { res.status(404).json({ error: 'Chat not found' }); return; }
    res.json({ ok: true });
  }));

  router.post('/chats/:id/messages', wrap(async (req, res) => {
    const g = await gate(req, res); if (!g) return;
    const { user, store } = g;
    const id = validId(req, res); if (!id) return;
    const content = typeof req.body?.content === 'string' ? req.body.content.trim() : '';
    if (!content) { res.status(400).json({ error: 'content is required' }); return; }
    if (content.length > deps.quota.maxInputChars) { res.status(413).json({ error: `Message is too long (${deps.quota.maxInputChars} characters maximum)` }); return; }
    const model = deps.getModel();
    if (!model) { res.status(503).json({ error: 'The model is not configured on the server' }); return; }
    const chat = await store.getChat(user.uid, id);
    if (!chat) { res.status(404).json({ error: 'Chat not found' }); return; }
    if (chat.messages.length >= deps.quota.maxMessagesPerChat) { res.status(429).json({ error: 'This chat is full; start a new one' }); return; }

    const day = utcDay(now());
    const [used, globalUsed] = await Promise.all([store.getUsage(user.uid, day), store.getGlobalUsage(day)]);
    if (globalUsed >= deps.quota.globalDailyTokens) { res.status(503).json({ error: 'The service has reached its daily limit; try again tomorrow' }); return; }
    if (used >= deps.quota.perUserDailyTokens) { res.status(429).json({ error: 'Daily quota used up; it resets at 00:00 UTC', usage: await usageSummary(store, user.uid) }); return; }
    if (inFlight.has(user.uid)) { res.status(409).json({ error: 'A reply is already being written' }); return; }

    inFlight.add(user.uid);
    let closed = false;
    res.on('close', () => { closed = true; });
    let answer = '';
    try {
      await store.appendMessage(user.uid, id, { role: 'user', content });
      if (chat.title === DEFAULT_TITLE) await store.setTitle(user.uid, id, content.replace(/\s+/g, ' ').slice(0, 40));

      const history: ChatMessage[] = [...chat.messages.map(m => ({ role: m.role, content: m.content })), { role: 'user' as const, content }]
        .slice(-deps.quota.historyMessages);
      const promptChars = history.reduce((n, m) => n + String(m.content).length, 0);

      res.status(200);
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('X-Accel-Buffering', 'no');
      res.flushHeaders();
      const send = (payload: unknown) => { if (!closed) res.write(`data: ${JSON.stringify(payload)}\n\n`); };

      let failed = false;
      try {
        for await (const chunk of model.provider.stream({
          messages: history,
          systemPrompt: deps.systemPrompt,
          maxTokens: deps.quota.maxOutputTokens,
        })) {
          if (closed) break;
          if (chunk.delta) { answer += chunk.delta; send({ delta: chunk.delta }); }
        }
      } catch (error) {
        failed = true;
        console.error('[chat] model error:', error instanceof Error ? error.message : error);
        send({ error: 'The model could not answer right now' });
      }

      const tokens = Math.ceil(promptChars / 2) + estimateTokens(answer);
      if (answer) await store.appendMessage(user.uid, id, { role: 'assistant', content: answer });
      if (tokens > 0 && (answer || !failed)) await store.addUsage(user.uid, day, tokens);
      send({ done: true, usage: await usageSummary(store, user.uid) });
      res.end();
    } finally {
      inFlight.delete(user.uid);
    }
  }));

  return router;
}
