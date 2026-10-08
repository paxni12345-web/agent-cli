import crypto from 'crypto';

/**
 * Verifies Firebase Auth ID tokens without the Firebase Admin SDK.
 *
 * A Firebase ID token is an RS256 JWT signed by Google. We check the signature
 * against Google's published signing certificates and then the standard claims
 * (audience = our project id, issuer, expiry, subject). Only Node's built-in
 * crypto is used, so there is nothing extra to install.
 * https://firebase.google.com/docs/auth/admin/verify-id-tokens
 */

export class FirebaseAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FirebaseAuthError';
  }
}

export interface FirebaseUser {
  uid: string;
  email?: string;
  emailVerified: boolean;
  name?: string;
}

export interface CertSet {
  /** key id -> PEM certificate (or public key) */
  certs: Record<string, string>;
  maxAgeMs: number;
}
export type CertFetcher = () => Promise<CertSet>;

const CERT_URL = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
/** An unknown key id may trigger at most one refetch per minute, so garbage tokens cannot hammer Google. */
const MIN_REFETCH_MS = 60_000;
const CLOCK_SKEW_S = 300;
const MAX_TOKEN_LENGTH = 8192;

let customFetcher: CertFetcher | null = null;
let cache: { certs: Record<string, string>; expiresAt: number } | null = null;
let lastFetchAt = 0;

/** Test seam: replace how Google's signing certificates are fetched (null restores the default). */
export function setCertFetcher(fetcher: CertFetcher | null): void {
  customFetcher = fetcher;
  cache = null;
  lastFetchAt = 0;
}

async function fetchGoogleCerts(): Promise<CertSet> {
  const res = await fetch(CERT_URL, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new FirebaseAuthError(`Could not fetch signing certificates (HTTP ${res.status})`);
  const certs = (await res.json()) as Record<string, string>;
  const match = /max-age=(\d+)/.exec(res.headers.get('cache-control') || '');
  return { certs, maxAgeMs: (match ? Number(match[1]) : 3600) * 1000 };
}

async function certFor(kid: string): Promise<string> {
  const now = Date.now();
  const fresh = cache !== null && now < cache.expiresAt;
  if (!fresh || (!cache!.certs[kid] && now - lastFetchAt >= MIN_REFETCH_MS)) {
    lastFetchAt = now;
    const { certs, maxAgeMs } = await (customFetcher ?? fetchGoogleCerts)();
    cache = { certs, expiresAt: now + maxAgeMs };
  }
  const pem = cache?.certs[kid];
  if (!pem) throw new FirebaseAuthError('Unknown signing key');
  return pem;
}

function decodePart(part: string): any {
  try {
    return JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));
  } catch {
    throw new FirebaseAuthError('Malformed token');
  }
}

export interface VerifierOptions {
  projectId: string;
  /** Clock override for tests (milliseconds). */
  now?: () => number;
}

export function createFirebaseVerifier(options: VerifierOptions): (token: string) => Promise<FirebaseUser> {
  const { projectId } = options;
  return async function verify(token: string): Promise<FirebaseUser> {
    const parts = token.split('.');
    if (parts.length !== 3 || token.length > MAX_TOKEN_LENGTH) throw new FirebaseAuthError('Malformed token');
    const header = decodePart(parts[0]);
    const payload = decodePart(parts[1]);
    if (header.alg !== 'RS256' || typeof header.kid !== 'string') throw new FirebaseAuthError('Unsupported token algorithm');

    const pem = await certFor(header.kid);
    let valid = false;
    try {
      valid = crypto
        .createVerify('RSA-SHA256')
        .update(`${parts[0]}.${parts[1]}`)
        .verify(crypto.createPublicKey(pem), Buffer.from(parts[2], 'base64url'));
    } catch {
      valid = false;
    }
    if (!valid) throw new FirebaseAuthError('Invalid token signature');

    const now = Math.floor((options.now ? options.now() : Date.now()) / 1000);
    if (typeof payload.exp !== 'number' || payload.exp <= now) throw new FirebaseAuthError('Token expired');
    if (typeof payload.iat !== 'number' || payload.iat > now + CLOCK_SKEW_S) throw new FirebaseAuthError('Token issued in the future');
    if (payload.aud !== projectId) throw new FirebaseAuthError('Wrong audience');
    if (payload.iss !== `https://securetoken.google.com/${projectId}`) throw new FirebaseAuthError('Wrong issuer');
    if (typeof payload.sub !== 'string' || payload.sub.length === 0 || payload.sub.length > 128) throw new FirebaseAuthError('Missing subject');

    return {
      uid: payload.sub,
      email: typeof payload.email === 'string' ? payload.email : undefined,
      emailVerified: payload.email_verified === true,
      name: typeof payload.name === 'string' ? payload.name : undefined,
    };
  };
}

export function parseEmailList(raw: string | undefined): string[] {
  return (raw ?? '').split(',').map(entry => entry.trim().toLowerCase()).filter(Boolean);
}

/** Only verified addresses on the allowlist get in; an empty allowlist admits nobody. */
export function isEmailAllowed(user: FirebaseUser, allowed: string[]): boolean {
  return user.emailVerified && Boolean(user.email) && allowed.includes(user.email!.toLowerCase());
}
