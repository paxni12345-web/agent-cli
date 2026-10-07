import crypto from 'crypto';
import {
  createFirebaseVerifier, setCertFetcher, parseEmailList, isEmailAllowed, FirebaseAuthError,
} from '../../src/auth/firebaseAuth.js';

const PROJECT = 'demo-project';
const pair = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const otherPair = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const publicPem = pair.publicKey.export({ type: 'spki', format: 'pem' }) as string;
const now = Math.floor(Date.now() / 1000);
const good = {
  aud: PROJECT, iss: `https://securetoken.google.com/${PROJECT}`, sub: 'uid-1',
  iat: now - 10, exp: now + 3600, email: 'Me@Example.com', email_verified: true, name: 'Me',
};

const b64u = (value: unknown) => Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)).toString('base64url');
function sign(payload: object, opts: { key?: crypto.KeyObject; kid?: string; alg?: string } = {}): string {
  const header = b64u({ alg: opts.alg ?? 'RS256', kid: opts.kid ?? 'k1', typ: 'JWT' });
  const body = b64u(payload);
  const sig = crypto.sign('RSA-SHA256', Buffer.from(`${header}.${body}`), opts.key ?? pair.privateKey).toString('base64url');
  return `${header}.${body}.${sig}`;
}

let fetchCount = 0;
beforeEach(() => {
  fetchCount = 0;
  setCertFetcher(async () => { fetchCount++; return { certs: { k1: publicPem }, maxAgeMs: 3_600_000 }; });
});
afterAll(() => setCertFetcher(null));

const verify = createFirebaseVerifier({ projectId: PROJECT });

describe('firebase ID token verification', () => {
  it('accepts a valid token and maps the claims', async () => {
    const user = await verify(sign(good));
    expect(user).toEqual({ uid: 'uid-1', email: 'Me@Example.com', emailVerified: true, name: 'Me' });
  });

  it.each([
    ['a signature from another key', () => sign(good, { key: otherPair.privateKey })],
    ['an expired token', () => sign({ ...good, exp: now - 5 })],
    ['a token issued in the future', () => sign({ ...good, iat: now + 4000 })],
    ['the wrong audience', () => sign({ ...good, aud: 'other-project' })],
    ['the wrong issuer', () => sign({ ...good, iss: 'https://securetoken.google.com/other' })],
    ['a missing subject', () => sign({ ...good, sub: '' })],
    ['an unknown key id', () => sign(good, { kid: 'nope' })],
    ['the none algorithm', () => `${b64u({ alg: 'none', kid: 'k1' })}.${b64u(good)}.`],
    ['an HS256 token', () => sign(good, { alg: 'HS256' })],
    ['a malformed token', () => 'not-a-jwt'],
  ])('rejects %s', async (_name, make) => {
    await expect(verify(make())).rejects.toBeInstanceOf(FirebaseAuthError);
  });

  it('does not refetch certificates for every unknown key id', async () => {
    await expect(verify(sign(good, { kid: 'a' }))).rejects.toThrow();
    await expect(verify(sign(good, { kid: 'b' }))).rejects.toThrow();
    expect(fetchCount).toBe(1);
  });
});

describe('email allowlist', () => {
  const user = { uid: 'u', email: 'Me@Example.com', emailVerified: true };
  it('parses a comma separated list case-insensitively', () => {
    expect(parseEmailList(' A@x.com, b@Y.com ,,')).toEqual(['a@x.com', 'b@y.com']);
    expect(parseEmailList(undefined)).toEqual([]);
  });
  it('admits only verified, listed addresses', () => {
    expect(isEmailAllowed(user, ['me@example.com'])).toBe(true);
    expect(isEmailAllowed({ ...user, emailVerified: false }, ['me@example.com'])).toBe(false);
    expect(isEmailAllowed(user, ['someone@else.com'])).toBe(false);
    expect(isEmailAllowed(user, [])).toBe(false);
    expect(isEmailAllowed({ uid: 'u', emailVerified: true }, ['me@example.com'])).toBe(false);
  });
});
