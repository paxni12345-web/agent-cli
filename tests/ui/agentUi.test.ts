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
interface ChatStub {
  chats?: { id: string; title: string; createdAt: string; updatedAt: string }[];
  messages?: Record<string, { role: string; content: string; createdAt: string }[]>;
  answer?: string[];          // deltas streamed back for a message
  sendStatus?: number;        // refuse the message with this status instead of streaming
  sendError?: unknown;
  meStatus?: number;          // refuse /api/chat/me (e.g. 403 when public sign-up is off)
}
interface BootOptions { stored?: Record<string, string>; reply?: string; runStatus?: number; authConfig?: unknown; sdk?: unknown; chat?: ChatStub }

const NEW_CHAT_ID = '11111111-2222-4333-8444-555555555555';
const USAGE = { day: '2026-10-08', used: 1000, limit: 50000, remaining: 49000 };

function boot(opts: BootOptions = {}) {
  const calls: Call[] = [];
  const navs: string[] = [];
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
      win.TextDecoder = TextDecoder;
      win.Element.prototype.getAnimations = () => [];   // jsdom lacks Web Animations; the page's chat-switch loader calls it
      win.__navigate = (target: string) => { navs.push(target); };
      if (opts.sdk) win.__firebaseLoader = async () => opts.sdk;
      win.fetch = async (url: string, init: any = {}) => {
        const method = (init.method ?? 'GET').toUpperCase();
        const body = init.body ? JSON.parse(init.body) : undefined;
        calls.push({ url, method, body, headers: init.headers ?? {} });
        const send = (status: number, data: unknown) => ({ ok: status >= 200 && status < 300, status, json: async () => data });
        if (url === '/api/auth/config') return opts.authConfig ? send(200, opts.authConfig) : send(404, { error: 'not found' });
        if (opts.chat) {
          const c = opts.chat;
          const iso = '2026-10-08T01:00:00Z';
          if (url.startsWith('/api/agent/')) return send(403, { error: 'This account is not allowed' });
          if (url === '/api/chat/me') {
            return c.meStatus ? send(c.meStatus, { error: 'This account is not allowed' })
              : send(200, { uid: 'u1', email: 'pub@example.com', name: null, usage: USAGE, modelReady: true });
          }
          if (url === '/api/chat/chats' && method === 'GET') return send(200, { chats: c.chats ?? [] });
          if (url === '/api/chat/chats' && method === 'POST') return send(201, { id: NEW_CHAT_ID, title: 'New chat', createdAt: iso, updatedAt: iso });
          const msgs = /^\/api\/chat\/chats\/([^/]+)\/messages$/.exec(url);
          if (msgs && method === 'POST') {
            if (c.sendStatus) return send(c.sendStatus, c.sendError);
            const frames = [...(c.answer ?? ['ok']).map((delta) => ({ delta })), { done: true, usage: { ...USAGE, used: 1500, remaining: 48500 } }]
              .map((e) => new TextEncoder().encode(`data: ${JSON.stringify(e)}\n\n`));
            let i = 0;
            return { ok: true, status: 200, json: async () => ({}), body: { getReader: () => ({
              read: async () => (i < frames.length ? { done: false, value: frames[i++] } : { done: true, value: undefined }),
              cancel: async () => {},
            }) } };
          }
          const one = /^\/api\/chat\/chats\/([^/]+)$/.exec(url);
          if (one && method === 'GET') {
            const chat = (c.chats ?? []).find((x) => x.id === one[1]);
            return chat ? send(200, { ...chat, messages: c.messages?.[one[1]] ?? [] }) : send(404, { error: 'Chat not found' });
          }
          if (one && method === 'DELETE') return send(200, { ok: true });
          return send(404, { error: 'not found' });
        }
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
  return { dom, win: dom.window as any, doc: dom.window.document, calls, navs };
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

describe('public/agent-ui.html with Firebase sign-in', () => {
  const config = { mode: 'firebase', firebase: { apiKey: 'k', authDomain: 'd', projectId: 'p', appId: 'a' } };
  const owner = { email: 'owner@example.com', getIdToken: async () => 'ID-TOKEN' };
  function fakeSdk(user: unknown, signedOut: string[]) {
    const auth: any = { currentUser: user };
    return {
      initializeApp: () => ({}),
      getAuth: () => auth,
      // like the real SDK this may call back immediately or later; the page must cope with both
      onAuthStateChanged: (_auth: unknown, cb: (u: unknown) => void) => { cb(auth.currentUser); return () => {}; },
      signOut: async () => { signedOut.push('out'); auth.currentUser = null; },
    };
  }

  it('sends the Firebase ID token and shows who is signed in', async () => {
    const ui = boot({ authConfig: config, sdk: fakeSdk(owner, []) });
    await until(() => ui.doc.querySelector('#modelName')?.textContent === 'test-model');
    const settings = ui.calls.find((c) => c.url === '/api/agent/settings')!;
    expect(settings.headers['Authorization']).toBe('Bearer ID-TOKEN');
    const menu = ui.doc.querySelector('#modelMenu')!.textContent ?? '';
    expect(menu).toContain('owner@example.com');
    expect(menu).toContain('ออกจากระบบ');
    await done(ui);
  });

  it('sends signed-out visitors to the login page without calling the API', async () => {
    const ui = boot({ authConfig: config, sdk: fakeSdk(null, []) });
    await until(() => ui.navs.length > 0);
    expect(ui.navs[0]).toMatch(/^\/login\.html\?next=/);
    expect(ui.calls.filter((c) => c.url.startsWith('/api/agent/')).length).toBe(0);
    ui.win.close();
  });

  it('signs out and returns to the login page when the server refuses the account', async () => {
    const signedOut: string[] = [];
    const ui = boot({ authConfig: config, sdk: fakeSdk(owner, signedOut), runStatus: 403 });
    await until(() => ui.doc.querySelector('#modelName')?.textContent === 'test-model');
    await send(ui, 'hello');
    await until(() => ui.navs.some((n) => n.includes('reason=forbidden')));
    expect(signedOut.length).toBe(1);
    await new Promise((r) => setTimeout(r, 50));
    ui.win.close();
  });
});

describe('public/agent-ui.html in public chat mode', () => {
  const config = { mode: 'firebase', firebase: { apiKey: 'k', authDomain: 'd', projectId: 'p', appId: 'a' } };
  const CHAT_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
  const stored = { id: CHAT_ID, title: 'Trip ideas', createdAt: '2026-10-07T01:00:00Z', updatedAt: '2026-10-07T02:00:00Z' };
  const history = { [CHAT_ID]: [
    { role: 'user', content: 'where should I go?', createdAt: '2026-10-07T01:00:00Z' },
    { role: 'assistant', content: 'Try Chiang Mai in November', createdAt: '2026-10-07T01:00:05Z' },
  ] };
  function sdkFor(signedOut: string[]) {
    const auth: any = { currentUser: { email: 'pub@example.com', getIdToken: async () => 'ID-TOKEN' } };
    return {
      initializeApp: () => ({}),
      getAuth: () => auth,
      onAuthStateChanged: (_a: unknown, cb: (u: unknown) => void) => { cb(auth.currentUser); return () => {}; },
      signOut: async () => { signedOut.push('out'); auth.currentUser = null; },
    };
  }
  const publicUi = (chat: ChatStub = {}, extra: Partial<BootOptions> = {}) => {
    const signedOut: string[] = [];
    return { signedOut, ui: boot({ authConfig: config, sdk: sdkFor(signedOut), chat, ...extra }) };
  };
  const ready = (ui: ReturnType<typeof boot>) => until(() => ui.doc.body.classList.contains('pub-mode') && ui.calls.some((c) => c.url === '/api/chat/chats'));
  const settle = async (ui: ReturnType<typeof boot>) => { await new Promise((r) => setTimeout(r, 30)); ui.win.close(); };

  it('uses the plain chat when the agent refuses the account, without signing out', async () => {
    const { ui, signedOut } = publicUi();
    await ready(ui);
    expect(signedOut.length).toBe(0);
    expect(ui.navs.length).toBe(0);
    expect(ui.doc.querySelector('#modelName')?.textContent).toBe('แชท AI');
    const menu = ui.doc.querySelector('#modelMenu')!.textContent ?? '';
    expect(menu).toContain('pub@example.com');
    expect(menu).toContain('49,000');
    expect(ui.calls.some((c) => c.url === '/api/agent/profiles')).toBe(false);
    await settle(ui);
  });

  it('still signs out when the plain chat refuses the account too', async () => {
    const { ui, signedOut } = publicUi({ meStatus: 403 });
    await until(() => ui.navs.some((n) => n.includes('reason=forbidden')));
    expect(signedOut.length).toBe(1);
    expect(ui.doc.body.classList.contains('pub-mode')).toBe(false);
    await settle(ui);
  });

  it('lists the stored chats and opens one from the server', async () => {
    const { ui } = publicUi({ chats: [stored], messages: history });
    await ready(ui);
    await until(() => (ui.doc.querySelector('#chatList')?.textContent ?? '').includes('Trip ideas'));
    (ui.doc.querySelector('#chatList .chat-item') as any).click();
    await until(() => (ui.doc.querySelector('#chatContainer')?.textContent ?? '').includes('Try Chiang Mai in November'));
    expect(ui.calls.some((c) => c.url === `/api/chat/chats/${CHAT_ID}` && c.method === 'GET')).toBe(true);
    expect(ui.doc.querySelector('#chatContainer')!.textContent).toContain('where should I go?');
    await settle(ui);
  });

  it('creates the chat with the first message and streams the answer', async () => {
    const { ui } = publicUi({ answer: ['Hello ', 'there'] });
    await ready(ui);
    await send(ui, 'hi');
    await until(() => (ui.doc.querySelector('#chatContainer')?.textContent ?? '').includes('Hello there'));
    const created = ui.calls.findIndex((c) => c.url === '/api/chat/chats' && c.method === 'POST');
    const sent = ui.calls.findIndex((c) => c.url === `/api/chat/chats/${NEW_CHAT_ID}/messages`);
    expect(created).toBeGreaterThan(-1);
    expect(sent).toBeGreaterThan(created);
    expect(ui.calls[sent].body).toEqual({ content: 'hi' });
    expect(ui.calls[sent].headers['Authorization']).toBe('Bearer ID-TOKEN');
    expect(ui.calls.some((c) => c.url === '/api/agent/run')).toBe(false);
    await until(() => (ui.doc.querySelector('#modelMenu')?.textContent ?? '').includes('48,500'));
    expect(ui.win.localStorage.getItem('ai-chats') ?? '').not.toContain('Hello there');
    await settle(ui);
  });

  it('explains an used-up daily quota', async () => {
    const { ui } = publicUi({ sendStatus: 429, sendError: { error: 'Daily quota used up; it resets at 00:00 UTC', usage: { ...USAGE, used: 50000, remaining: 0 } } });
    await ready(ui);
    await send(ui, 'hi');
    await until(() => ui.doc.querySelector('.error-box') !== null);
    expect(ui.doc.querySelector('.error-box')!.textContent).toContain('โควตาวันนี้หมดแล้ว');
    await settle(ui);
  });

  it('keeps chats a previous agent session left in this browser out of a public account', async () => {
    const local = [{ id: 'local1', title: 'owner private chat', pinned: false, createdAt: 1, updatedAt: 2, messages: [] }];
    const { ui } = publicUi({}, { stored: { 'ai-chats': JSON.stringify(local) } });
    await ready(ui);
    await until(() => !(ui.doc.querySelector('#chatList')?.textContent ?? '').includes('owner private chat'));
    expect(ui.win.localStorage.getItem('ai-chats')).toContain('owner private chat');
    await settle(ui);
  });

  it('deletes a stored chat on the server', async () => {
    const { ui } = publicUi({ chats: [stored], messages: history });
    await ready(ui);
    await until(() => ui.doc.querySelector('#chatList .chat-item .more-btn') !== null);
    (ui.doc.querySelector('#chatList .chat-item .more-btn') as any).click();
    (ui.doc.querySelector('.context-menu [data-act="delete"]') as any).click();
    (ui.doc.querySelector('#cfOk') as any).click();
    await until(() => ui.calls.some((c) => c.url === `/api/chat/chats/${CHAT_ID}` && c.method === 'DELETE'));
    await until(() => !(ui.doc.querySelector('#chatList')?.textContent ?? '').includes('Trip ideas'));
    await settle(ui);
  });
});
