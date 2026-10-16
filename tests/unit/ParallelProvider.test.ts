import { jest } from '@jest/globals';
import { ParallelProvider } from '../../src/providers/ParallelProvider.js';
import type { AIProvider } from '../../src/providers/AIProvider.js';
import type { ChatRequest } from '../../src/types/index.js';

const fake = (name: string, answer: string | Error, delta = answer instanceof Error ? '' : answer): AIProvider => ({
  name,
  chat: jest.fn(async () => { if (answer instanceof Error) throw answer; return { content: answer, finishReason: 'stop' as const }; }),
  stream: async function* () { if (answer instanceof Error) throw answer; yield { delta }; },
});
const req: ChatRequest = { messages: [{ role: 'user', content: 'hi' }] };

describe('ParallelProvider', () => {
  it('asks every member and returns the judge merge', async () => {
    const a = fake('a', 'A'), b = fake('b', 'B'), judge = fake('j', 'MERGED');
    const out = await new ParallelProvider([a, b], judge).chat(req);
    expect(out.content).toBe('MERGED');
    expect(a.chat).toHaveBeenCalledTimes(1);
    expect(b.chat).toHaveBeenCalledTimes(1);
    const sent = (judge.chat as jest.Mock).mock.calls[0]![0] as ChatRequest;
    expect(String(sent.messages.at(-1)!.content)).toContain('Candidate 2');
  });

  it('skips failed members and returns the lone answer without calling the judge', async () => {
    const judge = fake('j', 'MERGED');
    const out = await new ParallelProvider([fake('a', new Error('x')), fake('b', 'B')], judge).chat(req);
    expect(out.content).toBe('B');
    expect(judge.chat).not.toHaveBeenCalled();
  });

  it('fails only when every member fails', async () => {
    await expect(new ParallelProvider([fake('a', new Error('x')), fake('b', new Error('y'))], fake('j', 'M')).chat(req)).rejects.toThrow('All parallel members failed');
  });

  it('falls back to a member answer when the judge fails', async () => {
    const out = await new ParallelProvider([fake('a', 'A'), fake('b', 'B')], fake('j', new Error('down'))).chat(req);
    expect(out.content).toBe('A');
  });

  it('uses ordered fallback (no fan-out) when tools are present', async () => {
    const a = fake('a', new Error('x')), b = fake('b', 'B'), c = fake('c', 'C');
    const out = await new ParallelProvider([a, b, c], fake('j', 'M')).chat({ ...req, tools: [{ name: 't', description: 'd', input_schema: { type: 'object', properties: {} } }] });
    expect(out.content).toBe('B');
    expect(c.chat).not.toHaveBeenCalled();
  });

  it('streams the judge merge', async () => {
    const chunks: string[] = [];
    for await (const c of new ParallelProvider([fake('a', 'A'), fake('b', 'B')], fake('j', 'M', 'MERGED')).stream(req)) chunks.push(c.delta);
    expect(chunks.join('')).toBe('MERGED');
  });
});
