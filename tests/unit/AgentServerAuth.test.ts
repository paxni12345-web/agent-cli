import crypto from 'crypto';
import type { Server } from 'http';

/**
 * Boots the real server with Firebase sign-in configured (env is set before the
 * module loads) and checks the gate: who gets in, who is refused, and that the
 * relaxed CSP applies to the UI document only.
 */

const PROJECT = 'demo-project';
const pair = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const publicPem = pair.publicKey.export({ type: 'spki', format: 'pem' }) as string;
const now = Math.floor(Date.now() / 1000);
const b64u = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
function token(claims: Record<string, unknown> = {}): string {
  const header = b64u({ alg: 'RS256', kid: 'k1', typ: 'JWT' });
  const body = b64u({
    aud: PROJECT, iss: `https://securetoken.google.com/${PROJECT}`, sub: 'uid-owner',
    iat: now - 10, exp: now + 3600, email: 'owner@example.com', email_verified: true, name: 'Owner', ...claims,
  });
  const sig = crypto.sign('RSA-SHA256', Buffer.from(`${header}.${body}`), pair.privateKey).toString('base64url');
  return `${header}.${body}.${sig}`;
}

let server: Server;
let base: string;

beforeAll(async () => {
  process.env.FIREBASE_PROJECT_ID = PROJECT;
  process.env.FIREBASE_WEB_API_KEY = 'web-key';
  process.env.FIREBASE_APP_ID = '1:123:web:abc';
  process.env.AGENT_ALLOWED_EMAILS = 'owner@example.com';
  process.env.AGENT_SERVER_API_KEY = 'admin-secret';
  const auth = await import('../../src/auth/firebaseAuth.js');
  auth.setCertFetcher(async () => ({ certs: { k1: publicPem }, maxAgeMs: 3_600_000 }));
  const app = (await import('../../src/agent-server.js')).default;
  await new Promise<void>(resolve => {
    server = app.listen(0, '127.0.0.1', () => {
      const address = server.address();
      base = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`;
      resolve();
    });
  });
});

afterAll(async () => {
  await new Promise<void>(resolve => server.close(() => resolve()));
});

const bearer = (value: string) => ({ headers: { Authorization: `Bearer ${value}` } });

describe('firebase sign-in gate', () => {
  it('publishes the public web config without any secret', async () => {
    const res = await fetch(`${base}/api/auth/config`);
    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body).toEqual({
      mode: 'firebase',
      firebase: { apiKey: 'web-key', authDomain: `${PROJECT}.firebaseapp.com`, projectId: PROJECT, appId: '1:123:web:abc' },
    });
    expect(JSON.stringify(body)).not.toContain('admin-secret');
  });

  it('refuses requests without a credential', async () => {
    expect((await fetch(`${base}/api/agent/settings`)).status).toBe(401);
  });

  it('lets an allowlisted, verified account in and reports who it is', async () => {
    const res = await fetch(`${base}/api/agent/me`, bearer(token()));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ user: { uid: 'uid-owner', email: 'owner@example.com', name: 'Owner' } });
  });

  it('accepts the token as a query parameter (EventSource cannot send headers)', async () => {
    expect((await fetch(`${base}/api/agent/me?token=${token()}`)).status).toBe(200);
  });

  it('refuses a valid Google account that is not on the allowlist', async () => {
    const res = await fetch(`${base}/api/agent/settings`, bearer(token({ email: 'stranger@example.com' })));
    expect(res.status).toBe(403);
  });

  it('refuses an unverified email even if it is listed', async () => {
    const res = await fetch(`${base}/api/agent/settings`, bearer(token({ email_verified: false })));
    expect(res.status).toBe(403);
  });

  it('refuses expired and forged tokens', async () => {
    expect((await fetch(`${base}/api/agent/settings`, bearer(token({ exp: now - 1 })))).status).toBe(401);
    const forged = token().split('.').slice(0, 2).join('.') + '.AAAA';
    expect((await fetch(`${base}/api/agent/settings`, bearer(forged))).status).toBe(401);
  });

  it('still accepts the static admin key', async () => {
    expect((await fetch(`${base}/api/agent/settings`, bearer('admin-secret'))).status).toBe(200);
  });

  it('relaxes the CSP for the UI document only', async () => {
    const page = await fetch(`${base}/agent-ui.html`);
    const csp = page.headers.get('content-security-policy') ?? '';
    expect(csp).toContain('https://www.gstatic.com');
    expect(csp).toContain('https://identitytoolkit.googleapis.com');
    expect(csp).toContain(`frame-src https://${PROJECT}.firebaseapp.com`);
    const api = await fetch(`${base}/api/health`);
    expect(api.headers.get('content-security-policy')).toBe("default-src 'none'; frame-ancestors 'none'");
  });
});
