export interface ToolQueueTask<T> {
  run: () => Promise<T>;
  priority?: number;
  signal?: AbortSignal;
}

interface PendingTask<T> extends ToolQueueTask<T> {
  order: number;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
  abortListener?: () => void;
}

/** Bounded FIFO/priority queue for tool execution. Defaults to serial execution. */
export class ToolQueue {
  private readonly concurrency: number;
  private active = 0;
  private order = 0;
  private pending: PendingTask<unknown>[] = [];

  constructor(concurrency = 1) {
    this.concurrency = Math.max(1, Math.floor(concurrency));
  }

  enqueue<T>(task: ToolQueueTask<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      if (task.signal?.aborted) {
        reject(task.signal.reason ?? new Error('Tool task was cancelled'));
        return;
      }
      const pending: PendingTask<T> = { ...task, order: this.order++, resolve, reject };
      if (task.signal) {
        pending.abortListener = () => {
          const index = this.pending.indexOf(pending as PendingTask<unknown>);
          if (index >= 0) {
            this.pending.splice(index, 1);
            reject(task.signal?.reason ?? new Error('Tool task was cancelled'));
          }
        };
        task.signal.addEventListener('abort', pending.abortListener, { once: true });
      }
      this.pending.push(pending as PendingTask<unknown>);
      this.pending.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0) || a.order - b.order);
      this.drain();
    });
  }

  get size(): number { return this.pending.length; }
  get running(): number { return this.active; }

  private drain(): void {
    while (this.active < this.concurrency && this.pending.length > 0) {
      const task = this.pending.shift()!;
      if (task.signal && task.abortListener) task.signal.removeEventListener('abort', task.abortListener);
      this.active++;
      task.run().then(task.resolve, task.reject).finally(() => {
        this.active--;
        this.drain();
      });
    }
  }
}
