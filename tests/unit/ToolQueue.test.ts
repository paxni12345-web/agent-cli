import { ToolQueue } from '../../src/agent/ToolQueue.js';

describe('ToolQueue', () => {
  it('runs tasks in priority order when queued before draining', async () => {
    const queue = new ToolQueue(1);
    const order: string[] = [];
    const first = queue.enqueue({ priority: 0, run: async () => { await new Promise(resolve => setTimeout(resolve, 5)); order.push('first'); return 'first'; } });
    const second = queue.enqueue({ priority: 10, run: async () => { order.push('second'); return 'second'; } });
    await Promise.all([first, second]);
    expect(order).toEqual(['first', 'second']);
  });

  it('limits concurrent tasks', async () => {
    const queue = new ToolQueue(2);
    let running = 0; let maximum = 0;
    const task = () => queue.enqueue({ run: async () => { running++; maximum = Math.max(maximum, running); await new Promise(resolve => setTimeout(resolve, 5)); running--; } });
    await Promise.all([task(), task(), task(), task()]);
    expect(maximum).toBe(2);
  });

  it('cancels tasks that are still waiting in the queue', async () => {
    const queue = new ToolQueue(1);
    let release!: () => void;
    const blocker = queue.enqueue({ run: () => new Promise<void>(resolve => { release = resolve; }) });
    const controller = new AbortController();
    const cancelled = queue.enqueue({ signal: controller.signal, run: async () => 'should not run' });
    controller.abort(new Error('cancelled'));
    await expect(cancelled).rejects.toThrow('cancelled');
    release();
    await blocker;
    expect(queue.size).toBe(0);
  });
});
