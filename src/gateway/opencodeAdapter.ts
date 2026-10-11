import type {
  AgentAdapter, ApprovalChoice, ApprovalRequest, FileEntry, PublishedEvent,
  SandboxEndpoint, SendInput, SessionRef,
} from './types.js';
import { choiceToReply, mapOpenCodeEvent, newMapperState, toApproval, type OpenCodeRawEvent } from './opencodeMapper.js';

export interface OpenCodeAdapterOptions {
  /** Default model as `providerID/modelID`, used when SendInput.model is absent. */
  defaultModel?: string;
  fetchImpl?: typeof fetch;
  /** Delay before reconnecting a dropped SSE stream. Default 1000 ms. */
  reconnectMs?: number;
  now?: () => number;
}

function headers(ep: SandboxEndpoint, json = false): Record<string, string> {
  const h: Record<string, string> = { ...ep.headers, authorization: `Basic ${Buffer.from(`opencode:${ep.secret}`).toString('base64')}` };
  if (json) h['content-type'] = 'application/json';
  return h;
}

function parseModel(m: string | undefined): { providerID: string; modelID: string } | undefined {
  if (!m) return undefined;
  const i = m.indexOf('/');
  if (i <= 0 || i === m.length - 1) throw new Error(`model must look like "provider/model", got "${m}"`);
  return { providerID: m.slice(0, i), modelID: m.slice(i + 1) };
}

/** Incremental SSE parser: feed text chunks, get the JSON of each completed `data:` event. */
export function* parseSse(buffer: { text: string }, chunk: string): Generator<unknown> {
  buffer.text += chunk.replace(/\r\n/g, '\n');
  let idx: number;
  while ((idx = buffer.text.indexOf('\n\n')) >= 0) {
    const block = buffer.text.slice(0, idx);
    buffer.text = buffer.text.slice(idx + 2);
    const data = block.split('\n').filter((l) => l.startsWith('data:')).map((l) => l.slice(5).trimStart()).join('\n');
    if (!data) continue;
    try { yield JSON.parse(data); } catch { /* ignore malformed block */ }
  }
}

export class OpenCodeAdapter implements AgentAdapter {
  readonly backend = 'opencode' as const;
  private readonly f: typeof fetch;
  private readonly reconnectMs: number;
  private readonly now: () => number;

  constructor(private readonly opts: OpenCodeAdapterOptions = {}) {
    this.f = opts.fetchImpl ?? fetch;
    this.reconnectMs = opts.reconnectMs ?? 1000;
    this.now = opts.now ?? Date.now;
  }

  private async call(ep: SandboxEndpoint, method: string, path: string, body?: unknown, okStatuses: number[] = []): Promise<Response> {
    const res = await this.f(`${ep.baseUrl}${path}`, {
      method, headers: headers(ep, body !== undefined), body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok && !okStatuses.includes(res.status)) {
      throw new Error(`OpenCode ${method} ${path} failed: ${res.status}`);
    }
    return res;
  }

  async createSession(ep: SandboxEndpoint): Promise<{ upstreamId: string }> {
    const res = await this.call(ep, 'POST', '/session', {});
    const j = (await res.json()) as { id?: string };
    if (!j.id) throw new Error('OpenCode createSession: no id in response');
    return { upstreamId: j.id };
  }

  async send(ep: SandboxEndpoint, ref: SessionRef, input: SendInput): Promise<void> {
    if (!ref.upstreamId) throw new Error('session has no upstreamId');
    const model = parseModel(input.model ?? this.opts.defaultModel);
    await this.call(ep, 'POST', `/session/${encodeURIComponent(ref.upstreamId)}/prompt_async`, {
      parts: [{ type: 'text', text: input.text }],
      ...(model ? { model } : {}),
    });
  }

  async *events(ep: SandboxEndpoint, ref: SessionRef, signal: AbortSignal): AsyncGenerator<PublishedEvent> {
    if (!ref.upstreamId) throw new Error('session has no upstreamId');
    const state = newMapperState();
    const seenApprovals = new Set<string>();
    while (!signal.aborted) {
      try {
        const res = await this.f(`${ep.baseUrl}/event`, { headers: headers(ep), signal });
        if (!res.ok || !res.body) throw new Error(`OpenCode /event failed: ${res.status}`);
        // After a (re)connect, pick up approvals that were raised while we were not listening.
        for (const a of await this.pendingApprovals(ep, ref.upstreamId)) {
          if (seenApprovals.has(a.id)) continue;
          seenApprovals.add(a.id);
          yield { type: 'approval.requested', approval: a };
        }
        const decoder = new TextDecoder();
        const buf = { text: '' };
        for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
          for (const raw of parseSse(buf, decoder.decode(chunk, { stream: true }))) {
            const ev = raw as OpenCodeRawEvent;
            if (ev.type === 'permission.asked') {
              const id = ev.properties?.id as string;
              if (seenApprovals.has(id)) continue;
              seenApprovals.add(id);
            }
            for (const out of mapOpenCodeEvent(ev, ref.upstreamId, state, this.now)) yield out;
          }
        }
      } catch (err) {
        if (signal.aborted) return;
        yield { type: 'error', code: 'upstream_stream_lost', message: (err as Error).message, retryable: true };
      }
      if (signal.aborted) return;
      await new Promise<void>((resolve) => {
        const t = setTimeout(resolve, this.reconnectMs);
        signal.addEventListener('abort', () => { clearTimeout(t); resolve(); }, { once: true });
      });
    }
  }

  private async pendingApprovals(ep: SandboxEndpoint, upstreamId: string): Promise<ApprovalRequest[]> {
    const res = await this.call(ep, 'GET', '/permission');
    const list = (await res.json()) as Array<Record<string, any>>;
    return list.filter((p) => p.sessionID === upstreamId).map((p) => toApproval(p, this.now()));
  }

  async approve(ep: SandboxEndpoint, _ref: SessionRef, a: ApprovalRequest, choice: ApprovalChoice): Promise<void> {
    const reply = choiceToReply(choice);
    // 404/409: already answered (another device, or OpenCode timed it out) => idempotent success.
    await this.call(ep, 'POST', `/permission/${encodeURIComponent(a.upstreamId)}/reply`, { reply }, [404, 409]);
  }

  async stop(ep: SandboxEndpoint, ref: SessionRef): Promise<void> {
    if (!ref.upstreamId) return;
    await this.call(ep, 'POST', `/session/${encodeURIComponent(ref.upstreamId)}/abort`, undefined, [404]);
  }

  async listFiles(ep: SandboxEndpoint, _ref: SessionRef, path: string): Promise<FileEntry[]> {
    const res = await this.call(ep, 'GET', `/file?path=${encodeURIComponent(path)}`);
    const nodes = (await res.json()) as Array<{ path: string; type: 'file' | 'directory'; ignored?: boolean }>;
    return nodes.filter((n) => !n.ignored).map((n) => ({ path: n.path, type: n.type === 'directory' ? 'dir' : 'file' }));
  }

  async readFile(ep: SandboxEndpoint, _ref: SessionRef, path: string): Promise<{ content: string; truncated: boolean }> {
    const res = await this.call(ep, 'GET', `/file/content?path=${encodeURIComponent(path)}`);
    const j = (await res.json()) as { type: 'text' | 'binary'; content: string };
    if (j.type === 'binary') return { content: '', truncated: true };
    const MAX = 512 * 1024;
    return j.content.length > MAX ? { content: j.content.slice(0, MAX), truncated: true } : { content: j.content, truncated: false };
  }

  async health(ep: SandboxEndpoint): Promise<boolean> {
    try {
      const res = await this.f(`${ep.baseUrl}/global/health`, { headers: headers(ep) });
      return res.ok;
    } catch {
      return false;
    }
  }
}
