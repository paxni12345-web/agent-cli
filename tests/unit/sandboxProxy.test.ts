import express from 'express';
import http, { Server } from 'http';
import { createSandboxProxy } from '../../src/sandbox/proxy.js';
import type { AcquireResult, SandboxRuntime } from '../../src/sandbox/runtime.js';

let upstream: Server;
let upstreamBase: string;
let received: { method?: string; url?: string; headers: http.IncomingHttpHeaders; body: string }[] = [];
let app: Server;
let base: string;
let acquireResult: AcquireResult;
const acquiredFor: string[] = [];
let localHits: string[] = [];

const listen = (server: Server) => new Promise<string>(resolve => {
  server.listen(0, '127.0.0.1', () => { const a = server.address(); resolve(`http://127.0.0.1:${typeof a === 'object' && a ? a.port : 0}`); });
});

beforeAll(async () => {
  upstream = http.createServer((req, res) => {
    let body = '';
    req.on('data', c => { body += c; });
    req.on('end', () => {
      received.push({ method: req.method, url: req.url, headers: req.headers, body });
      if (req.url?.startsWith('/api/agent/events')) {
        res.writeHead(200, { 'Content-Type': 'text/event-stream' });
        res.write('data: {"type":"hello"}\n\n');
        res.end();
      } else {
        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ from: 'sandbox', echo: body }));
      }
    });
  });
  upstreamBase = await listen(upstream);

  const runtime: SandboxRuntime = { acquire: async uid => { acquiredFor.push(uid); return acquireResult; }, stop: async () => undefined };
  const a = express();
  a.use(express.json());
  a.use('/api/agent', (req, res, next) => { const uid = req.header('x-test-user'); if (uid) res.locals.user = { uid }; next(); });
  a.use('/api/agent', createSandboxProxy({ runtime }));
  a.get('/api/agent/settings', (_req, res) => { localHits.push('settings'); res.json({ local: true }); });
  a.all('/api/agent/*', (req, res) => { localHits.push(req.method + ' ' + req.path); res.json({ local: true, path: req.path }); });
  app = http.createServer(a);
  base = await listen(app);
});
afterAll(async () => {
  await new Promise<void>(r => app.close(() => r()));
  await new Promise<void>(r => upstream.close(() => r()));
});
beforeEach(() => {
  received = []; localHits = []; acquiredFor.length = 0;
  acquireResult = { kind: 'ready', handle: { baseUrl: upstreamBase, headers: { Authorization: 'Bearer sandbox-token', 'e2b-traffic-access-token': 'traffic' } } };
});

const call = (path: string, init: RequestInit = {}, user: string | null = 'u1') =>
  fetch(base + '/api/agent' + path, { ...init, headers: { 'Content-Type': 'application/json', ...(user ? { 'x-test-user': user } : {}), ...(init.headers ?? {}) } });

describe('sandbox proxy', () => {
  it("sends a user's run request to their sandbox with the sandbox credentials, never to the local agent", async () => {
    const res = await call('/run', { method: 'POST', body: JSON.stringify({ message: 'hi' }) });
    expect(res.status).toBe(201);
    expect(((await res.json()) as { from: string }).from).toBe('sandbox');
    expect(acquiredFor).toEqual(['u1']);
    expect(received[0].url).toBe('/api/agent/run');
    expect(received[0].headers.authorization).toBe('Bearer sandbox-token');
    expect(received[0].headers['e2b-traffic-access-token']).toBe('traffic');
    expect(JSON.parse(received[0].body)).toEqual({ message: 'hi' });
    expect(localHits).toEqual([]);
  });

  it('relays the event stream and keeps the browser token out of the upstream URL', async () => {
    const res = await call('/events?token=firebase-id-token&since=3', { headers: { Accept: 'text/event-stream' } });
    expect(res.headers.get('content-type')).toContain('text/event-stream');
    expect(await res.text()).toContain('"hello"');
    expect(received[0].url).toBe('/api/agent/events?since=3');
  });

  it('refuses everything that could reach local settings, extensions or tools', async () => {
    for (const [method, path] of [['PUT', '/settings'], ['POST', '/extensions/install'], ['GET', '/report'], ['GET', '/export'], ['POST', '/profiles/activate'], ['DELETE', '/profiles/x']]) {
      const res = await call(path, { method, body: method === 'GET' || method === 'DELETE' ? undefined : '{}' });
      expect(res.status).toBe(403);
    }
    expect(localHits).toEqual([]);
    expect(received).toEqual([]);
  });

  it('answers the read-only settings call locally and leaves admin traffic alone', async () => {
    expect(((await (await call('/settings')).json()) as { local: boolean }).local).toBe(true);
    const admin = await call('/run', { method: 'POST', body: '{}' }, null);
    expect(((await admin.json()) as { local: boolean }).local).toBe(true);
    expect(received).toEqual([]);
  });

  it('tells the browser when the workspace is still starting, busy or failed', async () => {
    acquireResult = { kind: 'starting' };
    const starting = await call('/run', { method: 'POST', body: '{}' });
    expect(starting.status).toBe(503);
    expect(starting.headers.get('retry-after')).toBe('5');
    expect(((await starting.json()) as { error: string }).error).toBe('sandbox_starting');
    acquireResult = { kind: 'busy' };
    expect(((await (await call('/run', { method: 'POST', body: '{}' })).json()) as { error: string }).error).toBe('sandbox_busy');
    acquireResult = { kind: 'failed', message: 'no node' };
    expect((await call('/run', { method: 'POST', body: '{}' })).status).toBe(502);
    expect(localHits).toEqual([]);
  });

  it('turns an unreachable sandbox into a 502 instead of crashing', async () => {
    acquireResult = { kind: 'ready', handle: { baseUrl: 'http://127.0.0.1:1', headers: {} } };
    expect((await call('/status')).status).toBe(502);
  });
});
