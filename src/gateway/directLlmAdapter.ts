import { randomUUID } from 'node:crypto';
import { parseSse } from './opencodeAdapter.js';
import type { AgentAdapter, ApprovalRequest, PublishedEvent, SandboxEndpoint, SendInput, SessionRef } from './types.js';

export interface DirectLlmOptions {
  /** OpenAI-compatible base URL, e.g. https://api.example.com/v1 (the adapter appends /chat/completions). */
  baseUrl: string;
  apiKey: string;
  model: string;
  systemPrompt?: string;
  /** Oldest turns are dropped past this many characters of history. Default 60 000. */
  maxHistoryChars?: number;
  fetchImpl?: typeof fetch;
}

/** Endpoint handed to adapters for modes that need no sandbox. */
export const NO_SANDBOX: SandboxEndpoint = { baseUrl: '', secret: '', sandboxId: 'direct' };

interface Msg { role: 'system' | 'user' | 'assistant'; content: string }

/** Tiny single-consumer async queue; `end()` lets the reader finish. */
class Channel<T> {
  private items: T[] = [];
  private waiter?: () => void;
  private ended = false;
  push(v: T): void { this.items.push(v); this.waiter?.(); }
  end(): void { this.ended = true; this.waiter?.(); }
  async *drain(signal: AbortSignal): AsyncGenerator<T> {
    const onAbort = () => this.waiter?.();
    signal.addEventListener('abort', onAbort, { once: true });
    try {
      for (;;) {
        while (this.items.length) yield this.items.shift() as T;
        if (this.ended || signal.aborted) return;
        await new Promise<void>((resolve) => { this.waiter = resolve; });
        this.waiter = undefined;
      }
    } finally {
      signal.removeEventListener('abort', onAbort);
    }
  }
}

interface State { history: Msg[]; out: Channel<PublishedEvent>; turn?: AbortController; running: boolean }

/**
 * Chat mode: the gateway talks to an OpenAI-compatible endpoint itself (no sandbox, no tools, so no approvals).
 * The conversation lives in this process's memory only.
 */
export class DirectLlmAdapter implements AgentAdapter {
  readonly backend = 'direct-llm' as const;
  private readonly f: typeof fetch;
  private readonly states = new Map<string, State>();

  constructor(private readonly o: DirectLlmOptions) {
    this.f = o.fetchImpl ?? fetch;
  }

  private state(ref: SessionRef): State {
    let s = this.states.get(ref.id);
    if (!s) {
      s = { history: [], out: new Channel(), running: false };
      if (this.o.systemPrompt) s.history.push({ role: 'system', content: this.o.systemPrompt });
      this.states.set(ref.id, s);
    }
    return s;
  }

  async createSession(_ep: SandboxEndpoint, ref: SessionRef): Promise<{ upstreamId: string }> {
    this.state(ref);
    return { upstreamId: ref.id };
  }

  async send(_ep: SandboxEndpoint, ref: SessionRef, input: SendInput): Promise<void> {
    const s = this.state(ref);
    if (s.running) throw new Error('A reply is already being generated for this session');
    s.running = true;
    s.history.push({ role: 'user', content: input.text });
    this.trim(s);
    s.turn = new AbortController();
    void this.runTurn(s, input.model ?? this.o.model, s.turn);
  }

  async *events(_ep: SandboxEndpoint, ref: SessionRef, signal: AbortSignal): AsyncGenerator<PublishedEvent> {
    const s = this.state(ref);
    try {
      yield* s.out.drain(signal);
    } finally {
      s.turn?.abort();
      this.states.delete(ref.id);
    }
  }

  async approve(_ep: SandboxEndpoint, _ref: SessionRef, _a: ApprovalRequest): Promise<void> { /* chat has no tools */ }

  async stop(_ep: SandboxEndpoint, ref: SessionRef): Promise<void> {
    this.states.get(ref.id)?.turn?.abort();
  }

  async health(): Promise<boolean> { return true; }

  private trim(s: State): void {
    const max = this.o.maxHistoryChars ?? 60_000;
    const size = () => s.history.reduce((n, m) => n + m.content.length, 0);
    // Keep a leading system prompt and the newest message; drop the oldest turns first.
    const first = s.history[0]?.role === 'system' ? 1 : 0;
    while (size() > max && s.history.length > first + 1) s.history.splice(first, 1);
  }

  private async runTurn(s: State, model: string, turn: AbortController): Promise<void> {
    const messageId = randomUUID();
    let text = '';
    let usage: { prompt?: number; completion?: number } | undefined;
    s.out.push({ type: 'status', status: 'running' });
    try {
      const res = await this.f(`${this.o.baseUrl.replace(/\/+$/, '')}/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${this.o.apiKey}` },
        body: JSON.stringify({ model, messages: s.history, stream: true, stream_options: { include_usage: true } }),
        signal: turn.signal,
      });
      if (!res.ok || !res.body) throw new Error(`LLM request failed: ${res.status}`);
      const decoder = new TextDecoder();
      const buf = { text: '' };
      for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
        for (const raw of parseSse(buf, decoder.decode(chunk, { stream: true }))) {
          const j = raw as { choices?: Array<{ delta?: { content?: string } }>; usage?: { prompt_tokens?: number; completion_tokens?: number } };
          const delta = j.choices?.[0]?.delta?.content;
          if (delta) { text += delta; s.out.push({ type: 'message.delta', messageId, text: delta }); }
          if (j.usage) usage = { prompt: j.usage.prompt_tokens, completion: j.usage.completion_tokens };
        }
      }
      s.history.push({ role: 'assistant', content: text });
      s.out.push({ type: 'message.done', messageId, text });
      // Providers that ignore include_usage get a rough estimate (~4 chars per token) so the budget still moves.
      const input = usage?.prompt ?? Math.ceil(s.history.slice(0, -1).reduce((n, m) => n + m.content.length, 0) / 4);
      const output = usage?.completion ?? Math.ceil(text.length / 4);
      s.out.push({ type: 'usage', cumulative: false, usage: { inputTokens: input, outputTokens: output, totalTokens: input + output } });
      s.out.push({ type: 'status', status: 'completed' });
    } catch (err) {
      if (turn.signal.aborted) {
        // The user stopped it: keep what was already streamed as part of the conversation.
        if (text) { s.history.push({ role: 'assistant', content: text }); s.out.push({ type: 'message.done', messageId, text }); }
        s.out.push({ type: 'status', status: 'failed' });
      } else {
        s.history.pop(); // the user turn got no answer; let them resend it
        s.out.push({ type: 'error', code: 'llm_failed', message: (err as Error).message, retryable: true });
        s.out.push({ type: 'status', status: 'failed' });
      }
    } finally {
      s.running = false;
    }
  }
}
