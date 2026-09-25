/**
 * TaskPriorityEngine — three-tier work queue for agent tasks.
 *
 *   CRITICAL   blocks everything else; worked immediately
 *   NORMAL     the default tier for regular task work
 *   BACKGROUND nice-to-haves (doc polish, refactors, note tidy-ups) that
 *              must never starve critical work
 *
 * Tasks can be classified automatically from their text (deterministic
 * keyword scoring, no model calls) or pushed with an explicit tier.
 * Consumers always take from the highest tier first; within a tier it is
 * FIFO. Background work is capped per run so it never floods the budget.
 */

export type TaskTier = 'critical' | 'normal' | 'background';

export interface QueuedTask {
  id: string;
  tier: TaskTier;
  description: string;
  /** Executed when the task reaches the front of the queue. */
  run: () => Promise<string>;
  createdAt: Date;
}

export interface DequeuedTask extends QueuedTask {
  waitedMs: number;
}

const AUTO_RULES: Array<{ tier: TaskTier; pattern: RegExp }> = [
  { tier: 'critical', pattern: /\b(urgent|asap|critical|production|outage|security|breach|hotfix|broken|failing|regression|data.?loss)\b/i },
  { tier: 'critical', pattern: /(ควรแก้ด่วน|ด่วน|เสียหาย|วิกฤต|ฉุกเฉิน)/ },
  { tier: 'background', pattern: /\b(refactor|cleanup|rename|docs?|readme|comment|polish|tidy|format)\b/i },
  { tier: 'background', pattern: /(ทำความสะอาด|เก็บงาน|จัดระเบียบ|ปรับปรุงเล็กน้อย)/ },
];

export class TaskPriorityEngine {
  private queues: Record<TaskTier, QueuedTask[]> = { critical: [], normal: [], background: [] };
  private seq = 0;
  private processed = 0;
  private backgroundProcessedThisRun = 0;
  private readonly maxBackgroundPerRun: number;

  constructor(options: { maxBackgroundPerRun?: number } = {}) {
    this.maxBackgroundPerRun = Math.max(0, options.maxBackgroundPerRun ?? 3);
  }

  /** Deterministic tier guess from the task text. */
  classify(description: string): TaskTier {
    for (const rule of AUTO_RULES) {
      if (rule.pattern.test(description)) return rule.tier;
    }
    return 'normal';
  }

  /** Adds a task; tier defaults to the auto-classification. */
  add(description: string, run: () => Promise<string>, tier?: TaskTier): QueuedTask {
    const task: QueuedTask = {
      id: `task-${++this.seq}`,
      tier: tier ?? this.classify(description),
      description,
      run,
      createdAt: new Date(),
    };
    this.queues[task.tier].push(task);
    return task;
  }

  /** True when at least one task is waiting in any tier. */
  hasWork(): boolean {
    return this.queues.critical.length + this.queues.normal.length + this.queues.background.length > 0;
  }

  /**
   * Pops the next task by tier order. Background tasks are skipped once the
   * per-run cap is hit (they stay queued for the next run).
   */
  next(): DequeuedTask | null {
    const tierOrder: TaskTier[] = ['critical', 'normal', 'background'];
    for (const tier of tierOrder) {
      if (tier === 'background' && this.backgroundProcessedThisRun >= this.maxBackgroundPerRun) continue;
      const task = this.queues[tier].shift();
      if (task) {
        if (tier === 'background') this.backgroundProcessedThisRun++;
        this.processed++;
        return { ...task, waitedMs: Date.now() - task.createdAt.getTime() };
      }
    }
    return null;
  }

  /** Queue snapshot for reporting/UI. */
  snapshot(): Record<TaskTier, number> {
    return {
      critical: this.queues.critical.length,
      normal: this.queues.normal.length,
      background: this.queues.background.length,
    };
  }

  /** Promotes every background task to normal (e.g. when the user insists). */
  promoteBackground(): number {
    const count = this.queues.background.length;
    for (const task of this.queues.background) task.tier = 'normal';
    this.queues.normal.push(...this.queues.background);
    this.queues.background = [];
    return count;
  }

  /** Resets per-run state; optionally clears queued work entirely. */
  startRun(clearQueue = false): void {
    this.backgroundProcessedThisRun = 0;
    if (clearQueue) {
      this.queues = { critical: [], normal: [], background: [] };
    }
  }

  get stats(): { processed: number; snapshot: Record<TaskTier, number> } {
    return { processed: this.processed, snapshot: this.snapshot() };
  }
}
