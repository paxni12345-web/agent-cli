import { readFileSync } from 'fs';
import { join } from 'path';
import { JSDOM, VirtualConsole } from 'jsdom';

/**
 * DOM smoke tests for public/agent-ui.html.
 *
 * The page is a hand-written single file (no build step), so nothing checks it
 * at compile time. These tests boot it in jsdom with a stubbed fetch and drive
 * the real flows against the /api/agent/* contract the server exposes.
 * CDN libraries are not loaded in jsdom, so rendering goes through the page's
 * built-in fallback markdown renderer (which must escape model output too).
 */

const html = readFileSync(join(process.cwd(), 'public', 'agent-ui.html'), 'utf8');

type Call = { url: string; method: string; body?: any; headers: Record<string, string> };
interface BootOptions { stored?: Record<string, string>; reply?: string; runStatus?: number }

function boot(opts: BootOptions = {}) {
  const calls: Call[] = [];
  const dom = new JSDOM(html, {
    url: 'http://localhost:3000/agent-ui.html',
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    virtualConsole: new VirtualConsole(),
    beforeParse(win: any) {
      for (const [k, v] of Object.entries(opts.stored ?? {})) win.localStorage.setItem(k, v);
      win.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
      win.HTMLElement.prototype.scrollTo = function () {};
      win.TextEncoder = TextEncoder;
      win.fetch = async (url: string, init: any = {}) => {
        const method = (init.method ?? 'GET').toUpperCase();
        const body = init.body ? JSON.parse(init.body) : undefined;
        calls.push({ url, method, body, headers: init.headers ?? {} });
        const send = (status: number, data: unknown) => ({ ok: status >= 200 && status < 300, status, json: async () => data });
        if (url === '/api/agent/settings' && method === 'GET') {
          return send(200, { provider: 'anthropic', model: 'test-model', baseUrl: '', hasApiKey: true, thinkingLevel: 'off', activeProfile: '' });
        }
        if (url === '/api/agent/profiles') return send(200, []);
        if (url === '/api/agent/clear') return send(200, { success: true });
        if (url === '/api/agent/run') {
          const status = opts.runStatus ?? 200;
          return status === 200
            ? send(200, { response: opts.reply ?? 'hello from agent' })
            : send(status, { error: 'No API key configured' });
        }
        return send(404, { error: 'not found' });
      };
    },
  });
  return { dom, win: dom.window as any, doc: dom.window.document, calls };
}

async function until(check: () => boolean, ms = 3000): Promise<void> {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > ms) throw new Error('timed out waiting for the UI');
    await new Promise((r) => setTimeout(r, 15));
  }
}

/** Let in-flight requests settle before tearing the window down, so late callbacks do not hit a closed document. */
async function done(ui: ReturnType<typeof boot>): Promise<void> {
  await until(() =>
    ui.doc.querySelector('#modelName')?.textContent === 'test-model' &&
    !(ui.doc.querySelector('#sendBtn') as any)?.classList.contains('stop'));
  await new Promise((r) => setTimeout(r, 30));
  ui.win.close();
}

async function send(ui: ReturnType<typeof boot>, text: string): Promise<void> {
  const input = ui.doc.querySelector('#input') as any;
  input.value = text;
  input.dispatchEvent(new ui.win.Event('input', { bubbles: true }));
  (ui.doc.querySelector('#sendBtn') as any).click();
}

describe('public/agent-ui.html', () => {
  it('pins every CDN asset with Subresource Integrity', () => {
    const tags = html.match(/<(?:script|link)\b[^>]*https:\/\/cdnjs\.cloudflare\.com[^>]*>/g) ?? [];
    expect(tags.length).toBeGreaterThan(0);
    for (const tag of tags) {
      expect(tag).toMatch(/integrity="sha384-[A-Za-z0-9+/=]+"/);
      expect(tag).toContain('crossorigin="anonymous"');
    }
  });

  it('talks to the agent server, never to a provider directly', () => {
    expect(html).toContain('/api/agent/run');
    expect(html).not.toContain('api.openai.com');
    expect(html).not.toContain('/chat/completions');
  });

  it('shows the server model in the header after loading', async () => {
    const ui = boot();
    await until(() => ui.doc.querySelector('#modelName')?.textContent === 'test-model');
    await done(ui);
  });

  it('sends a message to /api/agent/run and renders the reply', async () => {
    const ui = boot({ reply: 'the answer is 42' });
    await until(() => ui.doc.querySelector('#modelName')?.textContent === 'test-model');
    await send(ui, 'what is the answer?');
    await until(() => ui.calls.some((c) => c.url === '/api/agent/run'));
    const run = ui.calls.find((c) => c.url === '/api/agent/run')!;
    expect(run.method).toBe('POST');
    expect(run.body.message).toBe('what is the answer?');
    expect(run.headers['Authorization']).toBeUndefined();
    await until(() => (ui.doc.querySelector('#chatContainer')?.textContent ?? '').includes('the answer is 42'));
    await done(ui);
  });

  it('keeps the same agent conversation for follow-ups instead of resending history', async () => {
    const ui = boot();
    await until(() => ui.doc.querySelector('#modelName')?.textContent === 'test-model');
    await send(ui, 'first');
    await until(() => (ui.doc.querySelector('#chatContainer')?.textContent ?? '').includes('hello from agent'));
    await until(() => !(ui.doc.querySelector('#sendBtn') as any).classList.contains('stop'));
    await send(ui, 'second');
    await until(() => ui.calls.filter((c) => c.url === '/api/agent/run').length === 2);
    const runs = ui.calls.filter((c) => c.url === '/api/agent/run');
    expect(runs[1].body.message).toBe('second');
    expect(ui.calls.filter((c) => c.url === '/api/agent/clear').length).toBe(1);
    await done(ui);
  });

  it('renders model output escaped (no live HTML from the answer)', async () => {
    const ui = boot({ reply: 'hi <img src=x onerror="globalThis.__XSS=true"> there' });
    await until(() => ui.doc.querySelector('#modelName')?.textContent === 'test-model');
    await send(ui, 'xss?');
    await until(() => (ui.doc.querySelector('#chatContainer')?.textContent ?? '').includes('there'));
    expect(ui.doc.querySelector('#chatContainer img')).toBeNull();
    expect(ui.win.__XSS).toBeUndefined();
    await done(ui);
  });

  it('purges an API key that older versions kept in the browser', async () => {
    const ui = boot({ stored: { 'ai-settings': JSON.stringify({ apiKey: 'sk-secret', baseUrl: 'https://x.example', theme: 'dark' }) } });
    await until(() => ui.doc.querySelector('#modelName')?.textContent === 'test-model');
    const saved = ui.win.localStorage.getItem('ai-settings') as string;
    expect(saved).not.toContain('sk-secret');
    expect(saved).not.toContain('baseUrl');
    expect(JSON.parse(saved).theme).toBe('dark');
    await done(ui);
  });

  it('sends the server token as a bearer header when one is configured', async () => {
    const ui = boot({ stored: { 'ai-settings': JSON.stringify({ serverToken: 'tok-123' }) } });
    await until(() => ui.calls.some((c) => c.url === '/api/agent/settings'));
    expect(ui.calls.find((c) => c.url === '/api/agent/settings')!.headers['Authorization']).toBe('Bearer tok-123');
    await done(ui);
  });

  it('explains a missing server API key instead of failing silently', async () => {
    const ui = boot({ runStatus: 503 });
    await until(() => ui.doc.querySelector('#modelName')?.textContent === 'test-model');
    await send(ui, 'hello');
    await until(() => ui.doc.querySelector('.error-box') !== null);
    expect(ui.doc.querySelector('.error-box')!.textContent).toContain('No API key configured');
    await done(ui);
  });
});
