export interface ToolQueueTask<T> {
  run: () => Promise<T>;
  priority?: number;
}

interface PendingTask<T> extends ToolQueueTask<T> {
  order: number;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
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
      this.pending.push({ ...task, order: this.order++, resolve, reject });
      this.pending.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0) || a.order - b.order);
      this.drain();
    });
  }

  get size(): number { return this.pending.length; }
  get running(): number { return this.active; }

  private drain(): void {
    while (this.active < this.concurrency && this.pending.length > 0) {
      const task = this.pending.shift()!;
      this.active++;
      task.run().then(task.resolve, task.reject).finally(() => {
        this.active--;
        this.drain();
      });
    }
  }
}
