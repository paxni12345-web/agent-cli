import { InMemoryEventBus } from '../../src/gateway/eventBus.js';
import type { AgentEvent } from '../../src/gateway/types.js';

const status = (s: 'running' | 'completed') => ({ type: 'status' as const, status: s });

async function take(it: AsyncIterable<AgentEvent>, n: number): Promise<AgentEvent[]> {
  const out: AgentEvent[] = [];
  if (n === 0) return out;
  for await (const e of it) { out.push(e); if (out.length >= n) break; }
  return out;
}

describe('InMemoryEventBus', () => {
  it('stamps monotonic seq per session, independent across sessions', () => {
    const bus = new InMemoryEventBus({ now: () => 42 });
    const a1 = bus.publish('a', status('running'));
    const a2 = bus.publish('a', status('completed'));
    const b1 = bus.publish('b', status('running'));
    expect([a1.seq, a2.seq, b1.seq]).toEqual([1, 2, 1]);
    expect(a1).toMatchObject({ sessionId: 'a', at: 42, type: 'status' });
  });

  it('replays buffered events after afterSeq, then continues live', async () => {
    const bus = new InMemoryEventBus();
    bus.publish('s', status('running'));
    bus.publish('s', { type: 'message.delta', messageId: 'm', text: 'hi' });
    const ac = new AbortController();
    const got = take(bus.subscribe('s', 1, ac.signal), 2);
    bus.publish('s', status('completed'));
    const events = await got;
    expect(events.map((e) => e.seq)).toEqual([2, 3]);
    ac.abort();
  });

  it('afterSeq 0 replays everything', async () => {
    const bus = new InMemoryEventBus();
    bus.publish('s', status('running'));
    bus.publish('s', status('completed'));
    const events = await take(bus.subscribe('s', 0), 2);
    expect(events.map((e) => e.seq)).toEqual([1, 2]);
  });

  it('fans out to several subscribers', async () => {
    const bus = new InMemoryEventBus();
    const a = take(bus.subscribe('s', 0), 1);
    const b = take(bus.subscribe('s', 0), 1);
    await Promise.resolve();
    bus.publish('s', status('running'));
    expect((await a)[0].seq).toBe(1);
    expect((await b)[0].seq).toBe(1);
  });

  it('abort ends the iteration and unsubscribes', async () => {
    const bus = new InMemoryEventBus();
    const ac = new AbortController();
    const seen: AgentEvent[] = [];
    const done = (async () => { for await (const e of bus.subscribe('s', 0, ac.signal)) seen.push(e); })();
    bus.publish('s', status('running'));
    await new Promise((r) => setTimeout(r, 5));
    ac.abort();
    await done;
    expect(seen).toHaveLength(1);
    bus.publish('s', status('completed')); // must not throw or deliver
    expect(seen).toHaveLength(1);
  });

  it('an already-aborted signal yields nothing', async () => {
    const bus = new InMemoryEventBus();
    bus.publish('s', status('running'));
    const ac = new AbortController();
    ac.abort();
    const seen: AgentEvent[] = [];
    for await (const e of bus.subscribe('s', 0, ac.signal)) seen.push(e);
    expect(seen).toEqual([]);
  });

  it('bounds the buffer and reports a resume_gap when the caller fell behind', async () => {
    const bus = new InMemoryEventBus({ maxBuffered: 3 });
    for (let i = 0; i < 6; i += 1) bus.publish('s', status('running')); // seq 1..6, buffer holds 4..6
    const events = await take(bus.subscribe('s', 1), 4);
    expect(events[0]).toMatchObject({ type: 'error', code: 'resume_gap', retryable: false });
    expect(events.slice(1).map((e) => e.seq)).toEqual([4, 5, 6]);
  });

  it('no gap when the caller is exactly at the buffer edge', async () => {
    const bus = new InMemoryEventBus({ maxBuffered: 3 });
    for (let i = 0; i < 6; i += 1) bus.publish('s', status('running'));
    const events = await take(bus.subscribe('s', 3), 3);
    expect(events.map((e) => e.seq)).toEqual([4, 5, 6]);
  });

  it('close() ends subscribers and frees the session', async () => {
    const bus = new InMemoryEventBus();
    const seen: AgentEvent[] = [];
    const done = (async () => { for await (const e of bus.subscribe('s', 0)) seen.push(e); })();
    bus.publish('s', status('running'));
    await new Promise((r) => setTimeout(r, 5));
    bus.close('s');
    await done;
    expect(seen).toHaveLength(1);
    expect(bus.publish('s', status('running')).seq).toBe(1); // fresh session after close
  });
});
