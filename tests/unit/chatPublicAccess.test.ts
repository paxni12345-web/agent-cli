import crypto from 'crypto';
import type { Server } from 'http';

const PROJECT = 'demo-project';
const pair = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const publicPem = pair.publicKey.export({ type: 'spki', format: 'pem' }) as string;
const now = Math.floor(Date.now() / 1000);
const b64u = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
function token(claims: Record<string, unknown>): string {
  const header = b64u({ alg: 'RS256', kid: 'k1', typ: 'JWT' });
  const body = b64u({ aud: PROJECT, iss: `https://securetoken.google.com/${PROJECT}`, sub: 'uid-x', iat: now - 10, exp: now + 3600, email: 'x@example.com', email_verified: true, ...claims });
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
  process.env.AGENT_PUBLIC_SIGNUP = 'true';
  process.env.AGENT_BLOCKED_EMAILS = 'banned@example.com';
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
afterAll(async () => { await new Promise<void>(resolve => server.close(() => resolve())); });

const get = (path: string, bearer?: string) => fetch(base + path, { headers: bearer ? { Authorization: `Bearer ${bearer}` } : {} });

describe('public sign-up mode', () => {
  it('lets any verified account use the plain chat but never the agent', async () => {
    const stranger = token({ email: 'stranger@example.com', sub: 'uid-stranger' });
    expect((await get('/api/chat/me', stranger)).status).toBe(200);
    expect((await get('/api/agent/me', stranger)).status).toBe(403);
    expect((await get('/api/agent/status', stranger)).status).toBe(403);
  });
  it('refuses unverified and blocked emails and anonymous callers', async () => {
    expect((await get('/api/chat/me', token({ email_verified: false }))).status).toBe(403);
    expect((await get('/api/chat/me', token({ email: 'banned@example.com' }))).status).toBe(403);
    expect((await get('/api/chat/me')).status).toBe(401);
  });
  it('keeps the owner and the admin key working on the agent', async () => {
    expect((await get('/api/agent/me', token({ email: 'owner@example.com' }))).status).toBe(200);
    expect((await get('/api/agent/me', 'admin-secret')).status).toBe(200);
  });
});
