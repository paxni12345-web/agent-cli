import { Request, Response, NextFunction, RequestHandler } from 'express';
import { Readable } from 'stream';
import type { SandboxRuntime } from './runtime.js';

/**
 * Sends a signed-in user's agent calls to their own sandbox instead of running
 * tools on the main server. Anything not listed here is refused (403) so a
 * signed-in user can never reach the local agent, its settings or its tools.
 */

const FORWARD: Array<{ method: string; test: (path: string) => boolean }> = [
  { method: 'POST', test: p => p === '/run' },
  { method: 'POST', test: p => p === '/stop' },
  { method: 'POST', test: p => p === '/clear' },
  { method: 'GET', test: p => p === '/events' },
  { method: 'GET', test: p => p === '/status' },
  { method: 'POST', test: p => p === '/files' },
  { method: 'GET', test: p => p === '/files' || /^\/files\/[\w.-]+$/.test(p) },
  { method: 'DELETE', test: p => /^\/files\/[\w.-]+$/.test(p) },
];
/** Read-only answers the main server may give itself (no secrets, no tools). */
const LOCAL_READ = new Set(['/me', '/settings', '/profiles']);

export interface SandboxProxyOptions {
  runtime: SandboxRuntime;
  fetchImpl?: typeof fetch;
}

export function createSandboxProxy(options: SandboxProxyOptions): RequestHandler {
  const doFetch = options.fetchImpl ?? fetch;
  return (req: Request, res: Response, next: NextFunction): void => {
    handle(req, res, next).catch(error => {
      console.error('[sandbox] proxy error:', error instanceof Error ? error.message : error);
      if (!res.headersSent) res.status(502).json({ error: 'The sandbox is not reachable' });
      else res.end();
    });
  };

  async function handle(req: Request, res: Response, next: NextFunction): Promise<void> {
    const user = res.locals.user as { uid?: string } | undefined;
    if (!user?.uid) { next(); return; } // admin key keeps the local agent
    const path = req.path.replace(/\/+$/, '') || '/';
    if (req.method === 'GET' && LOCAL_READ.has(path)) { next(); return; }
    if (!FORWARD.some(rule => rule.method === req.method && rule.test(path))) {
      res.status(403).json({ error: 'Not available in sandbox mode' });
      return;
    }

    const result = await options.runtime.acquire(user.uid);
    if (result.kind === 'starting') { res.status(503).setHeader('Retry-After', '5'); res.json({ error: 'sandbox_starting', message: 'Preparing your workspace; try again in a moment' }); return; }
    if (result.kind === 'busy') { res.status(503).setHeader('Retry-After', '30'); res.json({ error: 'sandbox_busy', message: 'All workspaces are in use right now; try again later' }); return; }
    if (result.kind === 'failed') { res.status(502).json({ error: 'sandbox_failed', message: result.message }); return; }

    const query = new URLSearchParams(req.query as Record<string, string>);
    query.delete('token');
    const qs = query.toString();
    const url = `${result.handle.baseUrl}/api/agent${path}${qs ? `?${qs}` : ''}`;
    const hasBody = req.method !== 'GET' && req.method !== 'DELETE';
    const controller = new AbortController();
    res.on('close', () => controller.abort());

    const upstream = await doFetch(url, {
      method: req.method,
      headers: { ...result.handle.headers, ...(hasBody ? { 'Content-Type': 'application/json' } : {}), Accept: String(req.header('accept') ?? '*/*') },
      body: hasBody ? JSON.stringify(req.body ?? {}) : undefined,
      signal: controller.signal,
    });

    res.status(upstream.status);
    const type = upstream.headers.get('content-type');
    if (type) res.setHeader('Content-Type', type);
    if (path === '/events' && upstream.body) {
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('X-Accel-Buffering', 'no');
      res.flushHeaders();
      Readable.fromWeb(upstream.body as never).on('error', () => res.end()).pipe(res);
      return;
    }
    res.send(Buffer.from(await upstream.arrayBuffer()));
  }
}
