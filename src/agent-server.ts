import express, { NextFunction, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { Agent } from './agent/Agent.js';
import { createProvider } from './createAgent.js';
import { createChatRouter, ChatIdentity } from './chat/chatRouter.js';
import { createChatStoreFromEnv } from './chat/store.js';
import { quotaFromEnv } from './chat/quota.js';
import { createSandboxProxy } from './sandbox/proxy.js';
import { E2BSandboxRuntime } from './sandbox/e2bRuntime.js';
import { createDefaultToolRegistry } from './tools/index.js';
import { Action, PermissionManager, PermissionResult, Config, ContentBlock } from './types/index.js';
import { ExtensionManager, ExtensionKind, isExtensionError } from './extensions/index.js';
import { createFirebaseVerifier, isEmailAllowed, parseEmailList, FirebaseUser } from './auth/firebaseAuth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = Number.parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.AGENT_SERVER_HOST || '127.0.0.1';
const API_KEY = process.env.AGENT_SERVER_API_KEY;
// Optional Google sign-in through Firebase Auth. When FIREBASE_PROJECT_ID is set the
// API accepts a Firebase ID token from an allowlisted, verified email (the static
// API key keeps working as an admin credential). The web config values are public
// by design and are only served so the pages need no hard-coded project.
const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID?.trim() || '';
const FIREBASE_WEB_API_KEY = process.env.FIREBASE_WEB_API_KEY?.trim() || '';
const FIREBASE_APP_ID = process.env.FIREBASE_APP_ID?.trim() || '';
const FIREBASE_AUTH_DOMAIN = process.env.FIREBASE_AUTH_DOMAIN?.trim() || (FIREBASE_PROJECT_ID ? `${FIREBASE_PROJECT_ID}.firebaseapp.com` : '');
const ALLOWED_EMAILS = parseEmailList(process.env.AGENT_ALLOWED_EMAILS);
// Public mode: any Firebase user with a verified email may use the plain chat (/api/chat).
// The agent with tools (/api/agent) stays limited to AGENT_ALLOWED_EMAILS.
const PUBLIC_SIGNUP = process.env.AGENT_PUBLIC_SIGNUP === 'true';
const BLOCKED_EMAILS = parseEmailList(process.env.AGENT_BLOCKED_EMAILS);
const verifyFirebaseToken = FIREBASE_PROJECT_ID ? createFirebaseVerifier({ projectId: FIREBASE_PROJECT_ID }) : null;
const RATE_LIMIT_WINDOW_MS = Number.parseInt(process.env.AGENT_SERVER_RATE_WINDOW_MS || '60000', 10);
const RATE_LIMIT_MAX = Number.parseInt(process.env.AGENT_SERVER_RATE_MAX || '30', 10);
const rateBuckets = new Map<string, { count: number; resetAt: number }>();
const ALLOWED_ORIGINS = process.env.AGENT_SERVER_ORIGIN?.split(',').map(origin => origin.trim()).filter(Boolean);

app.use(cors(ALLOWED_ORIGINS ? { origin: ALLOWED_ORIGINS } : { origin: false }));
// Attachments travel in the request body as base64, so the JSON limit has to sit
// comfortably above the per-request attachment budget (see MAX_ATTACHMENT_BYTES).
app.use(express.json({ limit: '12mb' }));

// Baseline security headers, registered before the static handler so documents
// (not just API responses) actually receive them. The API keeps a locked-down
// policy; the web UI is a single document (inline style/script) served from
// this origin, so it needs a policy that lets those assets run.
const STRICT_CSP = "default-src 'none'; frame-ancestors 'none'";
// The UI pulls a few pinned libraries (marked, DOMPurify, highlight.js, KaTeX)
// from cdnjs — every tag carries a Subresource Integrity hash — and its fonts
// from Google Fonts. Those hosts are allowed for the UI document only; the API
// keeps STRICT_CSP.
const UI_CSP = [
  "default-src 'none'",
  "style-src 'unsafe-inline' https://cdnjs.cloudflare.com https://fonts.googleapis.com",
  // Google sign-in needs the Firebase SDK (gstatic) and Google's helper script; only allowed when it is configured.
  `script-src 'unsafe-inline' https://cdnjs.cloudflare.com${FIREBASE_PROJECT_ID ? ' https://www.gstatic.com https://apis.google.com' : ''}`,
  "font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com",
  "img-src 'self' data:",
  `connect-src 'self'${FIREBASE_PROJECT_ID ? ' https://identitytoolkit.googleapis.com https://securetoken.googleapis.com' : ''}`,
  ...(FIREBASE_PROJECT_ID ? [`frame-src https://${FIREBASE_AUTH_DOMAIN} https://accounts.google.com https://content.googleapis.com`] : []),
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');
app.use((req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  const isHtml = req.path === '/' || req.path.endsWith('.html');
  res.setHeader('Content-Security-Policy', isHtml ? UI_CSP : STRICT_CSP);
  next();
});

// Serve the web UI from <repo root>/public. Compiled output lives in dist/ and
// the sources in src/, so exactly one level up is the project root in both cases.
app.use(express.static(path.join(__dirname, '..', 'public')));
// Bare root opens the UI instead of 404.
app.get('/', (_req: Request, res: Response) => { res.redirect('/agent-ui.html'); });

// Request log with IP + timestamp (security-relevant endpoints).
app.use('/api', (req: Request, res: Response, next: NextFunction) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  console.log(`[agent-server] ${new Date().toISOString()} ${ip} ${req.method} ${req.path}`);
  res.setHeader('Cache-Control', 'no-store');
  next();
});

function isLoopback(host: string): boolean {
  return host === '127.0.0.1' || host === 'localhost' || host === '::1';
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

/** Returns true when the request may continue; otherwise it has already been answered. */
async function authenticate(req: Request, res: Response): Promise<boolean> {
  const supplied = req.header('authorization')?.replace(/^Bearer\s+/i, '') || req.header('x-api-key') || (typeof req.query.token === 'string' ? req.query.token : undefined);
  if (!API_KEY && !verifyFirebaseToken && !isLoopback(HOST)) {
    res.status(503).json({ error: 'Server authentication is not configured' });
    return false;
  }
  if (!API_KEY && !verifyFirebaseToken) return true; // loopback development
  if (API_KEY && supplied && safeEqual(supplied, API_KEY)) return true;
  if (verifyFirebaseToken && supplied) {
    let user: FirebaseUser;
    try {
      user = await verifyFirebaseToken(supplied);
    } catch (error) {
      console.log(`[agent-server] rejected token: ${error instanceof Error ? error.message : 'invalid'}`);
      res.status(401).json({ error: 'Unauthorized' });
      return false;
    }
    if (!isEmailAllowed(user, ALLOWED_EMAILS)) {
      console.log(`[agent-server] account not allowed: ${user.email ?? user.uid}`);
      res.status(403).json({ error: 'This account is not allowed' });
      return false;
    }
    res.locals.user = user;
    return true;
  }
  res.status(401).json({ error: 'Unauthorized' });
  return false;
}

async function securityMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!(await authenticate(req, res))) return;
  const now = Date.now();
  const key = (res.locals.user as FirebaseUser | undefined)?.uid || req.ip || req.socket.remoteAddress || 'unknown';
  const bucket = rateBuckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    rateBuckets.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    next();
    return;
  }
  bucket.count++;
  if (bucket.count > RATE_LIMIT_MAX) {
    res.setHeader('Retry-After', Math.ceil((bucket.resetAt - now) / 1000));
    res.status(429).json({ error: 'Too many requests' });
    return;
  }
  next();
}

app.use('/api/agent', (req: Request, res: Response, next: NextFunction) => { securityMiddleware(req, res, next).catch(next); });

// Sandbox mode (AGENT_SANDBOX=e2b): signed-in users run the agent inside their own E2B sandbox.
// Fail closed: asking for sandboxes without an E2B key stops the server instead of running tools locally.
if (process.env.AGENT_SANDBOX === 'e2b') {
  const runtime = new E2BSandboxRuntime({
    apiKey: process.env.E2B_API_KEY ?? '',
    template: process.env.E2B_TEMPLATE || undefined,
    repoUrl: process.env.AGENT_SANDBOX_REPO || 'https://github.com/paxni12345-web/agent-cli.git',
    ref: process.env.AGENT_SANDBOX_REF || 'main',
    idleMs: Number.parseInt(process.env.AGENT_SANDBOX_IDLE_MINUTES ?? '', 10) * 60_000 || 30 * 60_000,
    bootTimeoutMs: 10 * 60_000,
    maxSandboxes: Number.parseInt(process.env.AGENT_SANDBOX_MAX ?? '', 10) || 3,
    model: () => (settings.apiKey && settings.model
      ? { provider: settings.provider, model: settings.model, apiKey: settings.apiKey, baseUrl: settings.baseUrl || undefined, thinkingLevel: settings.thinkingLevel }
      : null),
  });
  app.use('/api/agent', createSandboxProxy({ runtime }));
  console.log('[agent-server] sandbox mode: signed-in users run the agent in their own E2B sandbox');
}

class ServerPermissionManager implements PermissionManager {
  constructor(private readonly allowMutations: boolean) {}
  check(action: Action): PermissionResult {
    if (!this.allowMutations) {
      if (action.risk === 'safe' || (action.type === 'read_file' && action.risk === 'medium')) return { allowed: true };
      return { allowed: false, reason: 'Server is read-only; set AGENT_SERVER_ALLOW_MUTATIONS=true to enable writes' };
    }
    if (action.risk === 'critical') return { allowed: false, reason: 'Critical risk actions are never allowed by the server' };
    return { allowed: true };
  }
  async requestApproval(_action: Action): Promise<boolean> { return false; }
}

let agent: Agent | null = null;
let config: Config;
let requestInProgress = false;

/**
 * Skills, MCP servers and plugins all live under the workspace's `.agent`
 * directory, so the manager is created once from the process working directory
 * and reused across agent rebuilds.
 */
const extensions = new ExtensionManager(process.cwd());

export type ProviderName = 'anthropic' | 'openai';
export type ThinkingLevel = 'off' | 'low' | 'medium' | 'high';

const SETTINGS_DIR = path.join(process.cwd(), '.agent');
const SETTINGS_FILE = path.join(SETTINGS_DIR, 'ui-settings.json');

/**
 * Runtime provider settings. The environment seeds them at boot and the settings
 * endpoint can override them for the lifetime of the process. Non-secret fields
 * (provider / model / base URL / thinking level) are remembered in
 * `.agent/ui-settings.json` so the UI comes back the way it was left; the
 * credential itself is never written to disk and never echoed to a client —
 * only whether one is present is reported.
 */
interface ProviderSettings { provider: ProviderName; model: string; baseUrl: string; apiKey: string; thinkingLevel: ThinkingLevel; activeProfile: string }

/**
 * A named provider profile. Everything here is non-secret and safe to persist;
 * the API key for a profile only ever lives in the in-memory `profileApiKeys`
 * map for the lifetime of the process.
 */
interface ProviderProfile { name: string; apiStyle: ProviderName; baseUrl: string; model: string }

const MAX_PROFILES = 64;

/** API keys held per profile, in memory only — never written to disk. */
const profileApiKeys = new Map<string, string>();

function readPersistedSettings(): Partial<ProviderSettings> & { profiles?: ProviderProfile[] } {
  try {
    const raw = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8')) as Record<string, unknown>;
    const out: Partial<ProviderSettings> & { profiles?: ProviderProfile[] } = {};
    if (raw.provider === 'anthropic' || raw.provider === 'openai') out.provider = raw.provider;
    if (typeof raw.model === 'string') out.model = raw.model;
    if (typeof raw.baseUrl === 'string') out.baseUrl = raw.baseUrl;
    if (raw.thinkingLevel === 'off' || raw.thinkingLevel === 'low' || raw.thinkingLevel === 'medium' || raw.thinkingLevel === 'high') out.thinkingLevel = raw.thinkingLevel;
    if (typeof raw.activeProfile === 'string') out.activeProfile = raw.activeProfile;
    // Older files have no `profiles` array — migrate gracefully by treating that
    // as an empty list. Anything that does not look like a profile is skipped.
    if (Array.isArray(raw.profiles)) {
      const profiles: ProviderProfile[] = [];
      for (const entry of raw.profiles.slice(0, MAX_PROFILES)) {
        if (typeof entry !== 'object' || entry === null) continue;
        const p = entry as Record<string, unknown>;
        if (typeof p.name !== 'string' || !p.name.trim()) continue;
        if (p.apiStyle !== 'anthropic' && p.apiStyle !== 'openai') continue;
        if (typeof p.model !== 'string' || typeof p.baseUrl !== 'string') continue;
        profiles.push({ name: p.name.trim().slice(0, 100), apiStyle: p.apiStyle, baseUrl: p.baseUrl, model: p.model.slice(0, 200) });
      }
      out.profiles = profiles;
    }
    return out;
  } catch { return {}; }
}

/** Writes the non-secret subset back so a restart resumes the same channel. */
function persistSettings(settings: ProviderSettings, profiles: ProviderProfile[]): void {
  try {
    fs.mkdirSync(SETTINGS_DIR, { recursive: true });
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify({
      provider: settings.provider, model: settings.model, baseUrl: settings.baseUrl, thinkingLevel: settings.thinkingLevel,
      activeProfile: settings.activeProfile, profiles,
    }, null, 2) + '\n', 'utf8');
  } catch (error) {
    console.error('Could not persist UI settings:', error);
  }
}

const persisted = readPersistedSettings();
const settings: ProviderSettings = {
  provider: persisted.provider ?? (process.env.AGENT_PROVIDER === 'openai' ? 'openai' : 'anthropic'),
  model: persisted.model || process.env.ANTHROPIC_MODEL || process.env.OPENAI_MODEL || '',
  baseUrl: persisted.baseUrl || process.env.ANTHROPIC_BASE_URL || process.env.OPENAI_BASE_URL || '',
  apiKey: process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY || '',
  thinkingLevel: persisted.thinkingLevel ?? 'off',
  activeProfile: persisted.activeProfile ?? '',
};
const profiles: ProviderProfile[] = persisted.profiles ?? [];

function envKeyFor(provider: ProviderName): string {
  return provider === 'openai' ? process.env.OPENAI_API_KEY || '' : process.env.ANTHROPIC_API_KEY || '';
}

function publicSettings(): { provider: ProviderName; model: string; baseUrl: string; hasApiKey: boolean; thinkingLevel: ThinkingLevel; activeProfile: string } {
  return { provider: settings.provider, model: settings.model, baseUrl: settings.baseUrl, hasApiKey: Boolean(settings.apiKey), thinkingLevel: settings.thinkingLevel, activeProfile: settings.activeProfile };
}

function publicProfileList(): Array<{ name: string; apiStyle: ProviderName; baseUrl: string; model: string; hasApiKey: boolean }> {
  return profiles.map(p => ({ name: p.name, apiStyle: p.apiStyle, baseUrl: p.baseUrl, model: p.model, hasApiKey: Boolean(profileApiKeys.get(p.name)) }));
}

/** Shared validation for profile payloads; returns the profile or null (response sent). */
function readProfilePayload(body: Record<string, unknown>, res: Response): ProviderProfile | null {
  const invalid = (message: string): null => { res.status(400).json({ error: message }); return null; };
  if (typeof body.name !== 'string' || !body.name.trim()) return invalid('name must be a non-empty string');
  const name = body.name.trim();
  if (name.length > 100) return invalid('name is too long (max 100 characters)');
  if (body.apiStyle !== 'anthropic' && body.apiStyle !== 'openai') return invalid('apiStyle must be "anthropic" or "openai"');
  if (body.model !== undefined && typeof body.model !== 'string') return invalid('model must be a string');
  if (body.baseUrl !== undefined && typeof body.baseUrl !== 'string') return invalid('baseUrl must be a string');
  const model = (typeof body.model === 'string' ? body.model : '').trim();
  const baseUrl = (typeof body.baseUrl === 'string' ? body.baseUrl : '').trim();
  if (model.length > 200) return invalid('model is too long (max 200 characters)');
  if (/[\r\n]/.test(name) || /[\r\n]/.test(model) || /[\r\n]/.test(baseUrl)) return invalid('fields must not contain line breaks');
  if (baseUrl) {
    let parsed: URL;
    try { parsed = new URL(baseUrl); } catch { return invalid('baseUrl must be a valid absolute URL'); }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return invalid('baseUrl must use http or https');
  }
  return { name, apiStyle: body.apiStyle, baseUrl, model };
}

/** Key resolution when a profile is activated: held key wins, then env key. */
function keyForProfile(profile: ProviderProfile): string {
  return profileApiKeys.get(profile.name) || envKeyFor(profile.apiStyle);
}

/* ---------------- live activity feed (Server-Sent Events) ---------------- */

const MAX_BUFFERED_EVENTS = 50;
const eventBuffer: Array<Record<string, unknown>> = [];
const subscribers = new Set<Response>();

/**
 * How many times the model itself has been called (one per agent iteration that
 * reached the provider), plus the total tokens it reported. The agent counts
 * tokens but not calls, and "how many calls did that cost me" is the first thing
 * anyone asks of a metrics panel, so it is counted here where every provider
 * response passes through.
 */
let modelCalls = 0;

/** Fans one agent event out to every open SSE stream (and into the replay buffer). */
function broadcast(event: Record<string, unknown>): void {
  const payload = { at: Date.now(), ...event };
  eventBuffer.push(payload);
  if (eventBuffer.length > MAX_BUFFERED_EVENTS) eventBuffer.shift();
  const frame = `data: ${JSON.stringify(payload)}\n\n`;
  for (const res of subscribers) {
    try { res.write(frame); } catch { subscribers.delete(res); }
  }
}

/** Mirrors the agent's own emitter into the feed (sanitised, no secrets). */
function attachAgentListeners(instance: Agent): void {
  instance.on('iteration', (n: number, max: number) => broadcast({ type: 'iteration', iteration: n, maxIterations: max }));
  instance.on('status', (status: string) => broadcast({ type: 'status', status }));
  instance.on('toolStart', (call: { id: string; name: string; input: unknown }) => broadcast({ type: 'toolStart', id: call.id, tool: call.name, input: call.input }));
  instance.on('toolEnd', (execution: { tool: string; duration?: number; retryCount?: number; result?: { success?: boolean; cached?: boolean; error?: string } }) => broadcast({
    type: 'toolEnd', tool: execution.tool, duration: execution.duration ?? null,
    retryCount: execution.retryCount ?? 0, success: execution.result?.success !== false,
    cached: execution.result?.cached === true, error: execution.result?.error ?? null,
  }));
  instance.on('tokenUsage', (usage: { inputTokens: number; outputTokens: number; totalTokens: number }) => {
    modelCalls += 1;
    broadcast({ type: 'tokenUsage', ...usage, session: instance.getUsage() });
  });
  instance.on('providerRetry', (info: { attempt: number; maxRetries: number; waitMs: number; error: string }) => broadcast({ type: 'providerRetry', ...info }));
  instance.on('contextCompressed', (stats: unknown) => broadcast({ type: 'contextCompressed', stats }));
  instance.on('specialtyRouted', (info: { entered?: unknown[]; exited?: unknown[]; active?: unknown[] }) => broadcast({ type: 'specialty', entered: info.entered ?? [], exited: info.exited ?? [], active: info.active ?? [] }));
  instance.on('securityAlert', (info: unknown) => broadcast({ type: 'securityAlert', info }));
}

function initializeAgent(): Agent | null {
  if (!settings.apiKey) {
    console.log('No API key configured yet — the web UI is available at http://localhost:' + PORT + '. Set a key via the UI settings to start chatting.');
    return null;
  }
  const apiKey = settings.apiKey;
  const model = settings.model;
  const baseUrl = settings.baseUrl || undefined;
  const allowMutations = process.env.AGENT_SERVER_ALLOW_MUTATIONS === 'true';
  // When a profile is active, its apiStyle decides the wire protocol; the
  // `provider` field is kept in sync by activate but the profile is authoritative.
  const activeProfile = settings.activeProfile ? profiles.find(p => p.name === settings.activeProfile) : undefined;
  const provider = activeProfile ? activeProfile.apiStyle : settings.provider;
  config = {
    provider, model, apiKey, baseUrl,
    thinkingLevel: settings.thinkingLevel,
    permissionMode: allowMutations ? 'auto' : 'safe', maxIterations: 20, temperature: 0.7,
    workspaceRoot: process.cwd(), debug: false, enableToolRetry: true, maxToolRetries: 3,
    enableToolCache: true, toolTimeout: 30000, validateToolInputs: true, autoRecovery: true,
    strictToolCalling: true, toolRouterMaxTools: 12, toolQueueConcurrency: 1, serverApiKey: API_KEY,
  };
  agent = new Agent(createProvider(config, apiKey), createDefaultToolRegistry(), new ServerPermissionManager(allowMutations), config);
  attachAgentListeners(agent);
  // A fresh agent starts with empty usage totals, so the call counter restarts too.
  modelCalls = 0;
  // MCP servers are child processes: connect them in the background so a slow or
  // unreachable server cannot delay the HTTP listener coming up.
  void extensions.activate(agent.getToolRegistry()).catch((error) => {
    console.error('Extension activation failed:', error);
  });
  return agent;
}
function getAgent(): Agent | null { return agent || initializeAgent(); }
function publicError(error: unknown): string { return process.env.NODE_ENV === 'development' && error instanceof Error ? error.message : 'Agent request failed'; }

/* ---------------- attachments ---------------- */

const MAX_ATTACHMENTS = 8;
const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;
const TEXT_ATTACHMENT_LIMIT = 200 * 1024;
const IMAGE_MIME = /^image\/(png|jpeg|jpg|gif|webp)$/i;

type RawAttachment = { name?: unknown; mimeType?: unknown; data?: unknown };

/**
 * Turns client-supplied attachments into provider content blocks. Images stay
 * base64 (both providers accept inline images); anything else is inlined as text
 * when it decodes as UTF-8 text, and otherwise summarised by name and size so the
 * model at least knows the file exists.
 */
function toContentBlocks(raw: RawAttachment[]): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  for (const item of raw.slice(0, MAX_ATTACHMENTS)) {
    const name = typeof item.name === 'string' ? path.basename(item.name).slice(0, 200) : 'attachment';
    const mimeType = typeof item.mimeType === 'string' ? item.mimeType : 'application/octet-stream';
    if (typeof item.data !== 'string' || !item.data) continue;
    const buffer = Buffer.from(item.data, 'base64');
    if (!buffer.length || buffer.length > MAX_ATTACHMENT_BYTES) continue;
    if (IMAGE_MIME.test(mimeType)) {
      const media = mimeType.toLowerCase() === 'image/jpg' ? 'image/jpeg' : mimeType.toLowerCase();
      blocks.push({ type: 'image', fileName: name, mimeType: media, source: { type: 'base64', media_type: media, data: buffer.toString('base64') } });
      continue;
    }
    const isText = !buffer.includes(0) && buffer.length <= TEXT_ATTACHMENT_LIMIT;
    const body = isText ? buffer.toString('utf8') : `[binary file, ${buffer.length} bytes — read it with the file tools if needed]`;
    blocks.push({ type: 'file', fileName: name, mimeType, content: body });
  }
  return blocks;
}

/* ---------------- uploaded file store (view sent files in the UI) ---------------- */

/**
 * Uploaded files live here for the lifetime of the process, keyed by an id the
 * server hands back. The UI needs them so a transcript rendered after a reload
 * can still show what was sent; buffers are capped so memory stays bounded.
 */
interface StoredFile { id: string; name: string; mimeType: string; size: number; data: Buffer; uploadedAt: number }

const MAX_STORED_FILES = 200;
const storedFiles = new Map<string, StoredFile>();

/* Attachments persist to .agent/uploads so sent files survive a restart.
   The index is one JSON line per file; buffers sit next to it by id. */
const UPLOAD_DIR = path.join(process.cwd(), '.agent', 'uploads');
const UPLOAD_INDEX = path.join(UPLOAD_DIR, 'index.jsonl');

function loadStoredFiles(): void {
  try {
    const lines = fs.readFileSync(UPLOAD_INDEX, 'utf8').split('\n');
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const meta = JSON.parse(line) as { id: string; name: string; mimeType: string; size: number; uploadedAt: number };
        const data = fs.readFileSync(path.join(UPLOAD_DIR, meta.id));
        storedFiles.set(meta.id, { ...meta, data });
      } catch { /* missing buffer or bad line — skip */ }
    }
  } catch { /* no index yet — first run */ }
}

function persistStoredFile(file: StoredFile): void {
  try {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    fs.writeFileSync(path.join(UPLOAD_DIR, file.id), file.data);
    fs.appendFileSync(UPLOAD_INDEX, JSON.stringify({ id: file.id, name: file.name, mimeType: file.mimeType, size: file.size, uploadedAt: file.uploadedAt }) + '\n');
  } catch (error) {
    console.error('[agent-server] failed to persist upload:', error);
  }
}

function deleteStoredFileFromDisk(file: StoredFile): void {
  try {
    fs.rmSync(path.join(UPLOAD_DIR, file.id), { force: true });
    if (fs.existsSync(UPLOAD_INDEX)) {
      const kept = fs.readFileSync(UPLOAD_INDEX, 'utf8').split('\n')
        .filter(line => { try { return JSON.parse(line).id !== file.id; } catch { return Boolean(line.trim()); } });
      fs.writeFileSync(UPLOAD_INDEX, kept.join('\n'));
    }
  } catch (error) {
    console.error('[agent-server] failed to remove upload from disk:', error);
  }
}

function storeUploadedFile(raw: RawAttachment): StoredFile | null {
  const name = typeof raw.name === 'string' && raw.name.trim() ? path.basename(raw.name.trim()).slice(0, 200) : 'attachment';
  const mimeType = typeof raw.mimeType === 'string' && raw.mimeType ? raw.mimeType : 'application/octet-stream';
  if (typeof raw.data !== 'string' || !raw.data) return null;
  const data = Buffer.from(raw.data, 'base64');
  if (!data.length || data.length > MAX_ATTACHMENT_BYTES) return null;
  const id = `f${Date.now().toString(36)}${crypto.randomBytes(8).toString('hex')}`;
  const file: StoredFile = { id, name, mimeType, size: data.length, data, uploadedAt: Date.now() };
  storedFiles.set(id, file);
  persistStoredFile(file);
  // Bounded store: drop the oldest uploads first.
  while (storedFiles.size > MAX_STORED_FILES) {
    const oldest = [...storedFiles.values()].sort((a, b) => a.uploadedAt - b.uploadedAt)[0];
    if (!oldest) break;
    storedFiles.delete(oldest.id);
    deleteStoredFileFromDisk(oldest);
  }
  return file;
}

function publicStoredFile(file: StoredFile): { id: string; name: string; mimeType: string; size: number; uploadedAt: number; url: string } {
  return { id: file.id, name: file.name, mimeType: file.mimeType, size: file.size, uploadedAt: file.uploadedAt, url: `/api/agent/files/${file.id}` };
}

/**
 * Store attachments that arrive with a run so the transcript can still show and
 * re-open them later. Returns per-attachment download metadata in the response.
 */
app.post('/api/agent/files', (req, res) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  if (!Array.isArray(body.files)) { res.status(400).json({ error: 'files must be an array' }); return; }
  const stored: ReturnType<typeof publicStoredFile>[] = [];
  for (const item of (body.files as RawAttachment[]).slice(0, MAX_ATTACHMENTS)) {
    if (typeof item !== 'object' || item === null) continue;
    const file = storeUploadedFile(item);
    if (file) stored.push(publicStoredFile(file));
  }
  if (!stored.length) { res.status(400).json({ error: 'No valid files to store (each needs base64 data within 8mb)' }); return; }
  res.json({ files: stored });
});

app.get('/api/agent/files/:id', (req, res) => {
  const file = storedFiles.get(req.params.id);
  if (!file) { res.status(404).json({ error: 'File not found' }); return; }
  res.setHeader('Content-Type', file.mimeType);
  res.setHeader('Content-Length', String(file.data.length));
  res.setHeader('Content-Disposition', `inline; filename="${file.name.replace(/["\\\r\n]/g, '_')}"`);
  res.send(file.data);
});

app.get('/api/agent/files', (_req, res) => {
  const list = [...storedFiles.values()].sort((a, b) => b.uploadedAt - a.uploadedAt).map(publicStoredFile);
  res.json({ files: list });
});

app.delete('/api/agent/files/:id', (req, res) => {
  const file = storedFiles.get(req.params.id);
  if (!file) { res.status(404).json({ error: 'File not found' }); return; }
  storedFiles.delete(req.params.id);
  deleteStoredFileFromDisk(file);
  res.json({ success: true });
});

app.post('/api/agent/run', async (req, res) => {
  try {
    const { message, config: clientConfig, attachments } = req.body ?? {};
    if (typeof message !== 'string' || !message.trim()) { res.status(400).json({ error: 'Message must be a non-empty string' }); return; }
    if (message.length > 100_000) { res.status(413).json({ error: 'Message is too large (maximum 100000 characters)' }); return; }
    if (clientConfig !== undefined && (typeof clientConfig !== 'object' || clientConfig === null || Array.isArray(clientConfig))) { res.status(400).json({ error: 'config must be an object' }); return; }
    if (attachments !== undefined && !Array.isArray(attachments)) { res.status(400).json({ error: 'attachments must be an array' }); return; }
    const contentBlocks = Array.isArray(attachments) ? toContentBlocks(attachments as RawAttachment[]) : [];
    // Keep a copy of each valid attachment so the transcript can re-view them
    // later via /api/agent/files/:id even after a page reload.
    const storedAttachments = Array.isArray(attachments)
      ? (attachments as RawAttachment[]).slice(0, MAX_ATTACHMENTS)
          .map(item => (typeof item === 'object' && item !== null ? storeUploadedFile(item) : null))
          .filter((f): f is StoredFile => f !== null)
      : [];
    if (requestInProgress) { res.status(409).json({ error: 'Another agent request is already in progress' }); return; }
    requestInProgress = true;
    const currentAgent = getAgent();
    if (!currentAgent) { requestInProgress = false; res.status(503).json({ error: 'No API key configured. Open the settings gear in the web UI to add one.' }); return; }
    if (clientConfig) currentAgent.updateConfig({
      enableToolRetry: clientConfig.retry ?? true, enableToolCache: clientConfig.cache ?? true,
      validateToolInputs: clientConfig.validation ?? true, autoRecovery: clientConfig.recovery ?? true,
      debug: clientConfig.debug ?? false,
    });
    const startTime = Date.now();
    const response = await currentAgent.run(message, contentBlocks);
    const state = currentAgent.getState();
    const report = currentAgent.getPerformanceMonitor().generateReport();
    const toolUsage: Record<string, number> = {};
    state.history.forEach(exec => { toolUsage[exec.tool] = (toolUsage[exec.tool] || 0) + 1; });
    const retries = state.history.reduce((sum, exec) => sum + (exec.retryCount ?? 0), 0);
    const cacheHits = state.history.filter(exec => exec.result?.cached).length;
    res.json({
      response, duration: Date.now() - startTime, toolExecutions: state.history.slice(-10),
      stats: {
        totalCalls: report.overview.totalExecutions, successCalls: report.overview.totalSuccess,
        avgDuration: report.overview.avgExecutionTime, iterations: state.iterationCount,
        retries, cacheHits, modelCalls,
      },
      usage: currentAgent.getUsage(),
      toolUsage,
      files: storedAttachments.map(publicStoredFile),
    });
  } catch (error) {
    console.error('Agent error:', error);
    if (agent && agent.killed) { res.status(499).json({ error: 'Run stopped', stopped: true }); return; }
    res.status(500).json({ error: publicError(error), ...(process.env.NODE_ENV === 'development' && error instanceof Error ? { stack: error.stack } : {}) });
  } finally { requestInProgress = false; }
});

/**
 * Stops the in-flight run. The agent's kill switch aborts the provider loop at
 * the next iteration boundary; the run endpoint then answers with a `stopped`
 * response so the UI can show "stopped" instead of a generic error. The kill
 * switch clears itself at the start of the next run.
 */
app.post('/api/agent/stop', (_req, res) => {
  if (!requestInProgress || !agent) { res.status(409).json({ error: 'No agent run in progress' }); return; }
  agent.kill('stopped from the web UI');
  broadcast({ type: 'status', status: 'cancelled' });
  res.json({ success: true });
});

// Who is signed in (null for the static API key or loopback development).
app.get('/api/agent/me', (_req, res) => {
  const user = res.locals.user as FirebaseUser | undefined;
  res.json({ user: user ? { uid: user.uid, email: user.email ?? null, name: user.name ?? null } : null });
});

app.get('/api/agent/status', (_req, res) => {
  const provider = { model: settings.model, provider: settings.provider, thinkingLevel: settings.thinkingLevel };
  if (!agent) { res.json({ status: 'not_initialized', tools: [], ...provider, modelCalls: 0, usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 } }); return; }
  const state = agent.getState();
  res.json({
    status: state.status, ...provider,
    tools: agent.getToolRegistry().list().map(t => ({ name: t.name, description: t.description })),
    iterations: state.iterationCount, historyLength: state.history.length, usage: agent.getUsage(),
    modelCalls,
  });
});

/**
 * Live activity feed (Server-Sent Events). The browser subscribes with
 * EventSource, which cannot send headers, so a configured API key travels as a
 * query parameter here; everything else about the endpoint matches the rest of
 * the authenticated /api/agent surface.
 */
app.get('/api/agent/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();
  subscribers.add(res);
  res.write(`data: ${JSON.stringify({ type: 'hello', at: Date.now(), replay: eventBuffer.slice(-10), status: agent ? agent.getState().status : 'idle' })}\n\n`);
  const keepAlive = setInterval(() => { try { res.write(': keep-alive\n\n'); } catch { /* stream closed */ } }, 20000);
  // Never hold the event loop open on account of an idle subscriber.
  keepAlive.unref?.();
  req.on('close', () => { clearInterval(keepAlive); subscribers.delete(res); });
});

/** Provider settings (base URL / model / API key) as configured for this process. */
app.get('/api/agent/settings', (_req, res) => { res.json(publicSettings()); });

app.put('/api/agent/settings', (req, res) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const invalid = (message: string): null => { res.status(400).json({ error: message }); return null; };
  // Returns the trimmed string, or null for "absent" — a validation failure has
  // already sent its response by then, so the caller only checks `null`.
  const readField = (field: keyof ProviderSettings, max: number): string | null => {
    const value = body[field];
    if (value === undefined) return null;
    if (typeof value !== 'string') return invalid(`${field} must be a string`);
    const trimmed = value.trim();
    if (trimmed.length > max) return invalid(`${field} is too long (max ${max} characters)`);
    if (/[\r\n]/.test(trimmed)) return invalid(`${field} must not contain line breaks`);
    return trimmed;
  };

  const model = readField('model', 200);
  if (res.headersSent) return;
  const baseUrl = readField('baseUrl', 500);
  if (res.headersSent) return;
  const apiKey = readField('apiKey', 500);
  if (res.headersSent) return;
  if (body.clearApiKey !== undefined && typeof body.clearApiKey !== 'boolean') { invalid('clearApiKey must be a boolean'); return; }
  if (body.provider !== undefined && body.provider !== 'anthropic' && body.provider !== 'openai') { invalid('provider must be "anthropic" or "openai"'); return; }
  if (body.thinkingLevel !== undefined && typeof body.thinkingLevel !== 'string') { invalid('thinkingLevel must be a string'); return; }
  if (typeof body.thinkingLevel === 'string' && !['off', 'low', 'medium', 'high'].includes(body.thinkingLevel)) { invalid('thinkingLevel must be "off", "low", "medium" or "high"'); return; }
  if (baseUrl) {
    let parsed: URL;
    try { parsed = new URL(baseUrl); } catch { invalid('baseUrl must be a valid absolute URL'); return; }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') { invalid('baseUrl must use http or https'); return; }
  }

  if (body.provider === 'anthropic' || body.provider === 'openai') {
    // Switching channels drops a key that belonged to the other one, unless the
    // environment already carries a key for the new provider.
    if (body.provider !== settings.provider) settings.apiKey = envKeyFor(body.provider);
    settings.provider = body.provider;
  }
  if (model !== null) settings.model = model;
  if (baseUrl !== null) settings.baseUrl = baseUrl;
  if (apiKey) settings.apiKey = apiKey;
  if (typeof body.thinkingLevel === 'string') settings.thinkingLevel = body.thinkingLevel as ThinkingLevel;
  if (body.clearApiKey === true) settings.apiKey = '';

  // Optional `profile` field: also save these one-off settings as a named profile.
  if (body.profile !== undefined) {
    if (typeof body.profile !== 'object' || body.profile === null || Array.isArray(body.profile)) {
      res.status(400).json({ error: 'profile must be an object' });
      return;
    }
    const profileBody = body.profile as Record<string, unknown>;
    // Missing fields fall back to the one-off settings being saved, so
    // `profile: { name }` alone snapshots the current provider/model/baseUrl.
    if (profileBody.apiStyle === undefined && body.provider !== undefined) profileBody.apiStyle = body.provider;
    if (profileBody.model === undefined && model !== null) profileBody.model = model;
    if (profileBody.baseUrl === undefined && baseUrl !== null) profileBody.baseUrl = baseUrl;
    const newProfile = readProfilePayload(profileBody, res);
    if (!newProfile) return;
    const existing = profiles.findIndex(p => p.name === newProfile.name);
    if (existing >= 0) profiles[existing] = newProfile;
    else if (profiles.length >= MAX_PROFILES) { res.status(400).json({ error: `Too many profiles (maximum ${MAX_PROFILES})` }); return; }
    else profiles.push(newProfile);
    if (typeof profileBody.apiKey === 'string') profileApiKeys.set(newProfile.name, profileBody.apiKey);
  }

  // A one-off settings PUT overrides whatever profile was active.
  settings.activeProfile = '';

  // Rebuild lazily so the next request uses the new endpoint/model/credentials.
  // The rebuilt agent gets a fresh registry, so MCP servers and plugins have to
  // be detached from the old one first or their child processes would leak.
  if (agent) extensions.deactivate(agent.getToolRegistry());
  agent = null;
  persistSettings(settings, profiles);
  res.json(publicSettings());
});

/* ---------------- named provider profiles ---------------- */

app.get('/api/agent/profiles', (_req, res) => { res.json(publicProfileList()); });

app.put('/api/agent/profiles', (req, res) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const profile = readProfilePayload(body, res);
  if (!profile) return;
  const existing = profiles.findIndex(p => p.name === profile.name);
  if (existing < 0 && profiles.length >= MAX_PROFILES) { res.status(400).json({ error: `Too many profiles (maximum ${MAX_PROFILES})` }); return; }
  if (typeof body.apiKey !== 'undefined' && typeof body.apiKey !== 'string') { res.status(400).json({ error: 'apiKey must be a string' }); return; }
  if (typeof body.apiKey === 'string' && body.apiKey.length > 500) { res.status(400).json({ error: 'apiKey is too long (max 500 characters)' }); return; }
  if (existing >= 0) profiles[existing] = profile;
  else profiles.push(profile);
  // The key lives in memory only; an empty string clears the held key.
  if (typeof body.apiKey === 'string') {
    if (body.apiKey) profileApiKeys.set(profile.name, body.apiKey);
    else profileApiKeys.delete(profile.name);
  }
  persistSettings(settings, profiles);
  res.json(publicProfileList());
});

app.delete('/api/agent/profiles/:name', (req, res) => {
  const index = profiles.findIndex(p => p.name === req.params.name);
  if (index < 0) { res.status(404).json({ error: 'Profile not found' }); return; }
  profiles.splice(index, 1);
  profileApiKeys.delete(req.params.name);
  if (settings.activeProfile === req.params.name) {
    // Fall back to plain env-based settings; no profile is active anymore.
    settings.activeProfile = '';
    settings.provider = process.env.AGENT_PROVIDER === 'openai' ? 'openai' : 'anthropic';
    settings.model = process.env.ANTHROPIC_MODEL || process.env.OPENAI_MODEL || '';
    settings.baseUrl = process.env.ANTHROPIC_BASE_URL || process.env.OPENAI_BASE_URL || '';
    settings.apiKey = envKeyFor(settings.provider);
  }
  if (agent) extensions.deactivate(agent.getToolRegistry());
  agent = null;
  persistSettings(settings, profiles);
  res.json(publicProfileList());
});

app.post('/api/agent/profiles/activate', (req, res) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  if (typeof body.name !== 'string' || !body.name.trim()) { res.status(400).json({ error: 'name must be a non-empty string' }); return; }
  const profileName = body.name.trim();
  const profile = profiles.find(p => p.name === profileName);
  if (!profile) { res.status(404).json({ error: 'Profile not found' }); return; }
  settings.activeProfile = profile.name;
  settings.provider = profile.apiStyle;
  settings.model = profile.model;
  settings.baseUrl = profile.baseUrl;
  settings.apiKey = keyForProfile(profile);
  if (agent) extensions.deactivate(agent.getToolRegistry());
  agent = null;
  persistSettings(settings, profiles);
  res.json(publicSettings());
});

app.get('/api/agent/report', (_req, res) => { if (!agent) { res.json({ error: 'Agent not initialized' }); return; } const report = agent.getPerformanceMonitor().generateReport(); res.json({ overview: report.overview, slowestTools: report.slowestTools, mostUnreliable: report.mostUnreliable, recommendations: report.recommendations, usage: agent.getUsage(), modelCalls }); });
app.get('/api/agent/metrics/:toolName', (req, res) => { if (!agent) { res.json({ error: 'Agent not initialized' }); return; } const metrics = agent.getPerformanceMonitor().getToolMetrics(req.params.toolName); if (!metrics) { res.status(404).json({ error: 'Tool not found' }); return; } res.json({ ...metrics, errorTypes: Array.from(metrics.errorTypes.entries()) }); });
app.get('/api/agent/export', (_req, res) => { if (!agent) { res.json({ error: 'Agent not initialized' }); return; } res.setHeader('Content-Type', 'application/json'); res.setHeader('Content-Disposition', `attachment; filename=agent-metrics-${Date.now()}.json`); res.send(agent.exportPerformanceData()); });
app.post('/api/agent/clear', (_req, res) => { if (!agent) { res.status(404).json({ error: 'Agent not initialized' }); return; } agent.reset(); modelCalls = 0; broadcast({ type: 'reset' }); res.json({ success: true }); });
/* ---------------- plain chat for signed-in users (no tools) ---------------- */

async function authenticateChat(req: Request, res: Response): Promise<ChatIdentity | null> {
  const supplied = req.header('authorization')?.replace(/^Bearer\s+/i, '') || req.header('x-api-key') || undefined;
  if (!API_KEY && !verifyFirebaseToken) {
    if (isLoopback(HOST)) return { uid: 'local' }; // development only
    res.status(503).json({ error: 'Server authentication is not configured' });
    return null;
  }
  if (API_KEY && supplied && safeEqual(supplied, API_KEY)) return { uid: 'admin' };
  if (verifyFirebaseToken && supplied) {
    let user: FirebaseUser;
    try {
      user = await verifyFirebaseToken(supplied);
    } catch (error) {
      console.log(`[chat] rejected token: ${error instanceof Error ? error.message : 'invalid'}`);
      res.status(401).json({ error: 'Unauthorized' });
      return null;
    }
    const email = user.email?.toLowerCase();
    const admitted = PUBLIC_SIGNUP ? user.emailVerified : isEmailAllowed(user, ALLOWED_EMAILS);
    if (!admitted || (email && BLOCKED_EMAILS.includes(email))) {
      res.status(403).json({ error: 'This account is not allowed' });
      return null;
    }
    return { uid: user.uid, email: user.email, name: user.name };
  }
  res.status(401).json({ error: 'Unauthorized' });
  return null;
}

function chatModel(): { provider: ReturnType<typeof createProvider>; name: string } | null {
  if (!settings.apiKey || !settings.model) return null;
  const activeProfile = settings.activeProfile ? profiles.find(p => p.name === settings.activeProfile) : undefined;
  const provider = activeProfile ? activeProfile.apiStyle : settings.provider;
  const cfg = { provider, model: settings.model, apiKey: settings.apiKey, baseUrl: settings.baseUrl || undefined, thinkingLevel: 'off' } as Config;
  return { provider: createProvider(cfg, settings.apiKey), name: settings.model };
}

app.use('/api/chat', createChatRouter({
  authenticate: authenticateChat,
  store: createChatStoreFromEnv(),
  getModel: chatModel,
  quota: quotaFromEnv(),
  systemPrompt: process.env.CHAT_SYSTEM_PROMPT || 'You are a helpful assistant. Answer in the same language the user writes in.',
}));

app.get('/api/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// Public: tells the pages which sign-in mode is active. Firebase web config is not secret.
app.get('/api/auth/config', (_req, res) => {
  const firebaseReady = Boolean(verifyFirebaseToken && FIREBASE_WEB_API_KEY && FIREBASE_APP_ID);
  res.json({
    mode: firebaseReady ? 'firebase' : API_KEY ? 'token' : 'none',
    firebase: firebaseReady
      ? { apiKey: FIREBASE_WEB_API_KEY, authDomain: FIREBASE_AUTH_DOMAIN, projectId: FIREBASE_PROJECT_ID, appId: FIREBASE_APP_ID }
      : null,
  });
});

/* ---------------- extensions: skills, MCP servers, plugins ---------------- */

const EXTENSION_KINDS: ExtensionKind[] = ['skill', 'mcp', 'plugin'];

/** Everything the Extensions panel renders, in one round trip. */
app.get('/api/agent/extensions', (_req, res) => {
  res.json(extensions.snapshot(agent?.getToolRegistry()));
});

/** Raw SKILL.md, for the viewer. */
app.get('/api/agent/extensions/skills/:name', (req, res) => {
  try {
    res.json({ name: req.params.name, content: extensions.readSkill(req.params.name), files: extensions.skills.files(req.params.name) });
  } catch (error) {
    res.status(404).json({ error: (error as Error).message });
  }
});

/**
 * Install from GitHub. The body decides what gets installed: an explicit `kind`,
 * or whatever the downloaded files look like (SKILL.md / plugin.json / mcp.json).
 */
app.post('/api/agent/extensions/install', async (req, res) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  if (typeof body.url !== 'string' || !body.url.trim()) { res.status(400).json({ error: 'url is required' }); return; }
  if (body.kind !== undefined && !EXTENSION_KINDS.includes(body.kind as ExtensionKind)) {
    res.status(400).json({ error: 'kind must be "skill", "mcp" or "plugin"' }); return;
  }
  if (body.name !== undefined && typeof body.name !== 'string') { res.status(400).json({ error: 'name must be a string' }); return; }
  const registry = getAgent()?.getToolRegistry();
  if (!registry) { res.status(503).json({ error: 'No API key configured. Open the settings gear in the web UI to add one.' }); return; }
  try {
    const result = await extensions.installFromGitHub(body.url.trim(), {
      kind: body.kind as ExtensionKind | undefined,
      name: typeof body.name === 'string' && body.name.trim() ? body.name.trim() : undefined,
      overwrite: body.overwrite === true,
      registry,
    });
    res.json({ ...result, snapshot: extensions.snapshot(agent?.getToolRegistry()) });
  } catch (error) {
    res.status(isExtensionError(error) ? 400 : 502).json({ error: (error as Error).message });
  }
});

/** Add one MCP server by hand, then connect it. */
app.post('/api/agent/extensions/mcp', async (req, res) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  if (typeof body.name !== 'string' || !body.name.trim()) { res.status(400).json({ error: 'name is required' }); return; }
  if (typeof body.command !== 'string' || !body.command.trim()) { res.status(400).json({ error: 'command is required' }); return; }
  if (body.args !== undefined && !Array.isArray(body.args)) { res.status(400).json({ error: 'args must be an array of strings' }); return; }
  if (body.env !== undefined && (typeof body.env !== 'object' || body.env === null || Array.isArray(body.env))) {
    res.status(400).json({ error: 'env must be an object of strings' }); return;
  }
  try {
    await extensions.addMcpServer({
      name: body.name.trim(),
      command: body.command.trim(),
      args: Array.isArray(body.args) ? body.args.map(String) : [],
      env: body.env as Record<string, string> | undefined,
      enabled: body.enabled !== false,
    }, getAgent()?.getToolRegistry());
    broadcast({ type: 'extensions', action: 'mcp-added', name: body.name });
    res.json({ snapshot: extensions.snapshot(agent?.getToolRegistry()) });
  } catch (error) {
    res.status(isExtensionError(error) ? 400 : 500).json({ error: (error as Error).message });
  }
});

/** Reconnect one server (or all of them) after editing its config by hand. */
app.post('/api/agent/extensions/mcp/reload', async (req, res) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  if (body.name !== undefined && typeof body.name !== 'string') { res.status(400).json({ error: 'name must be a string' }); return; }
  try {
    await extensions.mcp.reload(body.name as string | undefined, getAgent()?.getToolRegistry());
    res.json({ snapshot: extensions.snapshot(agent?.getToolRegistry()) });
  } catch (error) {
    res.status(isExtensionError(error) ? 400 : 500).json({ error: (error as Error).message });
  }
});

app.delete('/api/agent/extensions/:kind/:name', async (req, res) => {
  const kind = req.params.kind as ExtensionKind;
  if (!EXTENSION_KINDS.includes(kind)) { res.status(400).json({ error: 'kind must be "skill", "mcp" or "plugin"' }); return; }
  try {
    await extensions.remove(kind, req.params.name, getAgent()?.getToolRegistry());
    broadcast({ type: 'extensions', action: 'removed', kind, name: req.params.name });
    res.json({ snapshot: extensions.snapshot(agent?.getToolRegistry()) });
  } catch (error) {
    res.status(isExtensionError(error) ? 400 : 500).json({ error: (error as Error).message });
  }
});

/** Load a plugin that is installed but not yet imported (or retry a failed one). */
app.post('/api/agent/extensions/plugins/:name/load', async (req, res) => {
  const registry = getAgent()?.getToolRegistry();
  if (!registry) { res.status(503).json({ error: 'No API key configured. Open the settings gear in the web UI to add one.' }); return; }
  try {
    const plugin = await extensions.plugins.load(req.params.name, registry);
    res.json({ plugin, snapshot: extensions.snapshot(agent?.getToolRegistry()) });
  } catch (error) {
    res.status(isExtensionError(error) ? 400 : 500).json({ error: (error as Error).message });
  }
});

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Server error:', err);
  const tooLarge = typeof err === 'object' && err !== null && (err as { type?: string }).type === 'entity.too.large';
  res.status(tooLarge ? 413 : 500).json({ error: tooLarge ? 'Request body is too large (12mb maximum)' : 'Internal server error' });
});

if (process.env.NODE_ENV !== 'test') { loadStoredFiles(); app.listen(PORT, HOST, () => { console.log(`Agent CLI Web Server running at http://localhost:${PORT}`); try { initializeAgent(); } catch (error) { console.error('Failed to initialize agent:', error); } }); }
export default app;
