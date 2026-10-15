import { Router, Request, Response } from 'express';
import type { ApprovalChoice, ApprovalStore, EventBus, Mode } from './types.js';
import type { BudgetService } from './budget.js';
import { SessionService } from './sessionService.js';

/**
 * /api/v2 — the only API clients use for chat/code/work/agent sessions. Everything upstream
 * (OpenCode, Hermes, ...) stays behind adapters; sandboxes are never exposed.
 */

export interface V2Identity { uid: string }

export interface V2Deps {
  /** Answers the request itself (401/403/503) and returns null when the caller may not continue. */
  authenticate(req: Request, res: Response): Promise<V2Identity | null>;
  service: SessionService;
  bus: EventBus;
  approvals: ApprovalStore;
  budget: BudgetService;
  ratePerMinute?: number;
  /** Models clients may pick per message. When set, any other `model` is refused (the server's key pays for them). */
  models?: { default: string; allowed: string[] };
  maxInputChars?: number;
  heartbeatMs?: number;
  now?: () => number;
}

const MODES: Mode[] = ['chat', 'code', 'work', 'agent'];
const CHOICES: ApprovalChoice[] = ['once', 'session', 'always', 'deny'];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const APPROVAL_STATUS = { already_resolved: 409, not_found: 404, forbidden: 404, invalid_choice: 400, expired: 410 } as const;

const safePath = (p: unknown): string | null =>
  typeof p === 'string' && p.length > 0 && p.length < 1024 && !p.includes('\0') && !p.split(/[\\/]/).includes('..') && !p.startsWith('/') ? p : null;

export function createV2Router(deps: V2Deps): Router {
  const router = Router();
  const now = deps.now ?? Date.now;
  const rate = deps.ratePerMinute ?? 120;
  const maxChars = deps.maxInputChars ?? 8000;
  const buckets = new Map<string, { count: number; resetAt: number }>();

  const limited = (uid: string): number => {
    const t = now();
    const b = buckets.get(uid);
    if (!b || t >= b.resetAt) { buckets.set(uid, { count: 1, resetAt: t + 60_000 }); return 0; }
    b.count++;
    return b.count > rate ? Math.ceil((b.resetAt - t) / 1000) : 0;
  };

  async function gate(req: Request, res: Response): Promise<V2Identity | null> {
    const user = await deps.authenticate(req, res);
    if (!user) return null;
    const wait = limited(user.uid);
    if (wait) { res.setHeader('Retry-After', wait); res.status(429).json({ error: 'Too many requests' }); return null; }
    return user;
  }
  const wrap = (fn: (req: Request, res: Response) => Promise<void>) => (req: Request, res: Response) => {
    fn(req, res).catch((error) => {
      console.error('[v2] error:', error instanceof Error ? error.message : error);
      if (!res.headersSent) res.status(502).json({ error: 'Upstream error' });
      else res.end();
    });
  };
  const session = (req: Request, res: Response, uid: string) => {
    const id = String(req.params.id ?? '');
    const l = UUID_RE.test(id) ? deps.service.get(uid, id) : null;
    if (!l) { res.status(404).json({ error: 'Session not found' }); return null; }
    return l;
  };

  router.post('/sessions', wrap(async (req, res) => {
    const user = await gate(req, res); if (!user) return;
    const mode = req.body?.mode as Mode;
    if (!MODES.includes(mode)) { res.status(400).json({ error: `mode must be one of ${MODES.join(', ')}` }); return; }
    const r = await deps.service.create(user.uid, mode);
    switch (r.kind) {
      case 'created': res.status(201).json({ id: r.ref.id, mode: r.ref.mode, backend: r.ref.backend, createdAt: r.ref.createdAt }); return;
      case 'starting': res.status(202).json({ status: 'starting', retryAfterSeconds: 3 }); return;
      case 'busy': res.setHeader('Retry-After', 10); res.status(429).json({ error: 'No sandbox capacity right now; try again shortly' }); return;
      case 'budget': res.status(429).json({ error: 'Daily budget used up', budget: deps.budget.summary(user.uid) }); return;
      case 'unavailable': res.status(501).json({ error: r.message }); return;
      default: res.status(502).json({ error: 'Could not start the session' });
    }
  }));

  router.get('/models', wrap(async (req, res) => {
    const user = await gate(req, res); if (!user) return;
    res.json({ default: deps.models?.default ?? null, models: deps.models?.allowed ?? [] });
  }));

  router.post('/sessions/:id/messages', wrap(async (req, res) => {
    const user = await gate(req, res); if (!user) return;
    const l = session(req, res, user.uid); if (!l) return;
    const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
    if (!text) { res.status(400).json({ error: 'text is required' }); return; }
    if (text.length > maxChars) { res.status(413).json({ error: `Message is too long (${maxChars} characters maximum)` }); return; }
    const model = typeof req.body?.model === 'string' && req.body.model ? req.body.model : undefined;
    if (model && deps.models && !deps.models.allowed.includes(model)) {
      res.status(400).json({ error: 'Model not available', models: deps.models.allowed }); return;
    }
    const r = await deps.service.send(l, text, model);
    if (r === 'blocked') { res.status(400).json({ error: 'That command is not allowed' }); return; }
    if (r === 'budget') { res.status(429).json({ error: 'Daily budget used up', budget: deps.budget.summary(user.uid) }); return; }
    res.status(202).json({ accepted: true });
  }));

  router.get('/sessions/:id/events', wrap(async (req, res) => {
    const user = await gate(req, res); if (!user) return;
    const l = session(req, res, user.uid); if (!l) return;
    const header = req.header('last-event-id');
    const after = Math.max(0, Number.parseInt(String(header ?? req.query.after ?? '0'), 10) || 0);
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache, no-transform', connection: 'keep-alive', 'x-accel-buffering': 'no' });
    res.write(': open\n\n');
    const ac = new AbortController();
    res.on('close', () => ac.abort());
    const hb = setInterval(() => res.write(': keepalive\n\n'), deps.heartbeatMs ?? 15_000);
    try {
      for await (const e of deps.bus.subscribe(l.ref.id, after, ac.signal)) {
        res.write(`id: ${e.seq}\nevent: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`);
      }
    } finally {
      clearInterval(hb);
      res.end();
    }
  }));

  router.post('/sessions/:id/approvals/:approvalId', wrap(async (req, res) => {
    const user = await gate(req, res); if (!user) return;
    const l = session(req, res, user.uid); if (!l) return;
    const choice = String(req.body?.choice ?? '') as ApprovalChoice;
    if (!CHOICES.includes(choice)) { res.status(400).json({ error: `choice must be one of ${CHOICES.join(', ')}` }); return; }
    const outcome = await deps.service.approve(l, String(req.params.approvalId), choice);
    if (outcome === 'resolved') { res.json({ ok: true }); return; }
    res.status(APPROVAL_STATUS[outcome]).json({ error: outcome });
  }));

  router.get('/approvals/pending', wrap(async (req, res) => {
    const user = await gate(req, res); if (!user) return;
    res.json({ approvals: deps.approvals.pending(user.uid) });
  }));

  router.post('/sessions/:id/stop', wrap(async (req, res) => {
    const user = await gate(req, res); if (!user) return;
    const l = session(req, res, user.uid); if (!l) return;
    await deps.service.stop(l);
    res.json({ ok: true });
  }));

  router.delete('/sessions/:id', wrap(async (req, res) => {
    const user = await gate(req, res); if (!user) return;
    const l = session(req, res, user.uid); if (!l) return;
    await deps.service.close(l);
    res.json({ ok: true });
  }));

  router.get('/usage', wrap(async (req, res) => {
    const user = await gate(req, res); if (!user) return;
    res.json(deps.budget.summary(user.uid));
  }));

  router.get('/sessions/:id/files', wrap(async (req, res) => {
    const user = await gate(req, res); if (!user) return;
    const l = session(req, res, user.uid); if (!l) return;
    const a = deps.service.adapterFor(l);
    const p = safePath(req.query.path ?? '.') ;
    if (!p && req.query.path !== undefined) { res.status(400).json({ error: 'invalid path' }); return; }
    if (!a.listFiles) { res.status(501).json({ error: 'files are not available in this mode' }); return; }
    res.json({ files: await a.listFiles(l.ep, l.ref, p ?? '.') });
  }));

  router.get('/sessions/:id/file', wrap(async (req, res) => {
    const user = await gate(req, res); if (!user) return;
    const l = session(req, res, user.uid); if (!l) return;
    const a = deps.service.adapterFor(l);
    const p = safePath(req.query.path);
    if (!p) { res.status(400).json({ error: 'invalid path' }); return; }
    if (!a.readFile) { res.status(501).json({ error: 'files are not available in this mode' }); return; }
    res.json(await a.readFile(l.ep, l.ref, p));
  }));

  return router;
}
