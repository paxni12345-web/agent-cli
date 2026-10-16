import { BaseAIProvider, AIProvider } from './AIProvider.js';
import { ChatRequest, ChatResponse, ChatChunk, ProviderError } from '../types/index.js';

export interface ParallelOptions {
  /** Per-member time limit; a slow member is skipped, not waited for. */
  memberTimeoutMs?: number;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<T>((_, reject) => { timer = setTimeout(() => reject(new Error('timed out')), ms); });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

const SYNTHESIS_PROMPT =
  'Several assistants answered the conversation above. Candidate answers follow. ' +
  'Write ONE final answer for the user: keep what is correct and useful, fix mistakes, resolve disagreements, ' +
  'reply in the language the user wrote in, and do not mention the candidates or that several answers existed.';

/**
 * One "virtual" model backed by several real ones (Manus-style).
 * - Plain questions: every member answers at the same time, then the judge merges the answers into one reply.
 * - Requests with tools (agent mode): one coherent model has to drive the tool loop, so members are tried in
 *   order and the first one that works answers (fallback, not fan-out).
 * Members that fail or time out are skipped; the request only fails when every member fails.
 */
export class ParallelProvider extends BaseAIProvider {
  name = 'parallel';

  constructor(
    private readonly members: AIProvider[],
    private readonly judge: AIProvider,
    private readonly options: ParallelOptions = {},
  ) {
    super();
    if (members.length === 0) throw new Error('ParallelProvider needs at least one member');
  }

  private get timeoutMs(): number { return this.options.memberTimeoutMs ?? 90_000; }

  private async firstThatWorks(request: ChatRequest): Promise<ChatResponse> {
    let last: unknown;
    for (const member of this.members) {
      try { return await withTimeout(member.chat(request), this.timeoutMs); } catch (error) { last = error; }
    }
    throw new ProviderError(`All parallel members failed: ${last instanceof Error ? last.message : String(last)}`, { originalError: last });
  }

  private async candidates(request: ChatRequest): Promise<string[]> {
    const plain: ChatRequest = { ...request, tools: undefined, toolChoice: undefined };
    const results = await Promise.allSettled(this.members.map(member => withTimeout(member.chat(plain), this.timeoutMs)));
    const answers: string[] = [];
    let last: unknown;
    for (const r of results) {
      if (r.status === 'fulfilled') { const text = r.value.content.trim(); if (text) answers.push(text); } else last = r.reason;
    }
    if (answers.length === 0) {
      throw new ProviderError(`All parallel members failed: ${last instanceof Error ? last.message : String(last ?? 'empty answers')}`, { originalError: last });
    }
    return answers;
  }

  private synthesisRequest(request: ChatRequest, answers: string[]): ChatRequest {
    const list = answers.map((a, i) => `### Candidate ${i + 1}\n${a}`).join('\n\n');
    return { ...request, tools: undefined, toolChoice: undefined, messages: [...request.messages, { role: 'user', content: `${SYNTHESIS_PROMPT}\n\n${list}` }] };
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    if (request.tools && request.tools.length > 0) return this.firstThatWorks(request);
    const answers = await this.candidates(request);
    const [first] = answers;
    if (answers.length === 1) return { content: first ?? '', finishReason: 'stop' };
    try {
      return await this.judge.chat(this.synthesisRequest(request, answers));
    } catch {
      return { content: first ?? '', finishReason: 'stop' };
    }
  }

  async *stream(request: ChatRequest): AsyncIterable<ChatChunk> {
    if (request.tools && request.tools.length > 0) {
      yield { delta: (await this.firstThatWorks(request)).content };
      return;
    }
    const answers = await this.candidates(request);
    const [first] = answers;
    if (answers.length === 1) { yield { delta: first ?? '' }; return; }
    let sent = false;
    try {
      for await (const chunk of this.judge.stream(this.synthesisRequest(request, answers))) {
        if (chunk.delta) sent = true;
        yield chunk;
      }
    } catch (error) {
      if (sent) throw error;
      yield { delta: first ?? '' };
    }
  }
}
