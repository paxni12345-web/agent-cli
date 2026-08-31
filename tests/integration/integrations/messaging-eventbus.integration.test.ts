/**
 * Integration Tests: Message Queue and Event Bus Integration
 * Tests asynchronous messaging, event propagation, and pub/sub patterns
 * Tests integration between event bus, message queues, and multiple consumers
 */

import { EventEmitter } from 'events';

// Mock Message Queue
class MockMessageQueue extends EventEmitter {
  private queues: Map<string, any[]> = new Map();
  private consumers: Map<string, Function[]> = new Map();
  private dlq: Map<string, any[]> = new Map(); // Dead Letter Queue

  async publish(queueName: string, message: any, options?: any): Promise<string> {
    const messageId = `msg-${Date.now()}-${Math.random()}`;
    const envelope = {
      id: messageId,
      queueName,
      message,
      timestamp: new Date(),
      attempts: 0,
      options: options || {}
    };

    if (!this.queues.has(queueName)) {
      this.queues.set(queueName, []);
    }

    this.queues.get(queueName)!.push(envelope);
    this.emit('message:published', { queueName, messageId });

    // Notify consumers
    await this.processQueue(queueName);

    return messageId;
  }

  async subscribe(queueName: string, handler: Function): Promise<string> {
    const subscriptionId = `sub-${Date.now()}-${Math.random()}`;

    if (!this.consumers.has(queueName)) {
      this.consumers.set(queueName, []);
    }

    this.consumers.get(queueName)!.push(handler);
    this.emit('consumer:subscribed', { queueName, subscriptionId });

    return subscriptionId;
  }

  private async processQueue(queueName: string): Promise<void> {
    const queue = this.queues.get(queueName);
    const consumers = this.consumers.get(queueName);

    if (!queue || !consumers || consumers.length === 0) {
      return;
    }

    while (queue.length > 0) {
      const envelope = queue.shift()!;

      for (const consumer of consumers) {
        try {
          await consumer(envelope.message, envelope);
          this.emit('message:processed', {
            queueName,
            messageId: envelope.id
          });
        } catch (error) {
          envelope.attempts++;

          if (envelope.attempts >= 3) {
            // Move to dead letter queue
            if (!this.dlq.has(queueName)) {
              this.dlq.set(queueName, []);
            }
            this.dlq.get(queueName)!.push({ ...envelope, error });
            this.emit('message:failed', {
              queueName,
              messageId: envelope.id,
              error
            });
          } else {
            // Re-queue
            queue.push(envelope);
            this.emit('message:retrying', {
              queueName,
              messageId: envelope.id,
              attempt: envelope.attempts
            });
          }
        }
      }
    }
  }

  getQueueSize(queueName: string): number {
    return this.queues.get(queueName)?.length || 0;
  }

  getDLQSize(queueName: string): number {
    return this.dlq.get(queueName)?.length || 0;
  }

  clear(): void {
    this.queues.clear();
    this.consumers.clear();
    this.dlq.clear();
  }
}

// Mock Event Bus
class MockEventBus extends EventEmitter {
  private eventLog: any[] = [];
  private handlers: Map<string, Set<Function>> = new Map();

  publish(eventType: string, data: any): void {
    const event = {
      id: `evt-${Date.now()}-${Math.random()}`,
      type: eventType,
      data,
      timestamp: new Date()
    };

    this.eventLog.push(event);
    this.emit(eventType, event);
    this.emit('*', event); // Wildcard

    // Call registered handlers
    const handlers = this.handlers.get(eventType);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(event);
        } catch (error) {
          this.emit('error', { event, error });
        }
      });
    }
  }

  subscribe(eventType: string, handler: Function): () => void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }

    this.handlers.get(eventType)!.add(handler);

    // Return unsubscribe function
    return () => {
      this.handlers.get(eventType)?.delete(handler);
    };
  }

  getEventLog(): any[] {
    return [...this.eventLog];
  }

  clearLog(): void {
    this.eventLog = [];
  }
}

// Mock Worker
class MockWorker extends EventEmitter {
  private processing = false;
  private processedCount = 0;

  async process(task: any): Promise<any> {
    this.processing = true;
    this.emit('task:started', { task });

    try {
      // Simulate processing
      await new Promise(resolve => setTimeout(resolve, 10));

      this.processedCount++;
      this.processing = false;

      const result = {
        taskId: task.id,
        result: `Processed: ${task.data}`,
        timestamp: new Date()
      };

      this.emit('task:completed', { task, result });
      return result;
    } catch (error) {
      this.processing = false;
      this.emit('task:failed', { task, error });
      throw error;
    }
  }

  isProcessing(): boolean {
    return this.processing;
  }

  getProcessedCount(): number {
    return this.processedCount;
  }

  reset(): void {
    this.processing = false;
    this.processedCount = 0;
  }
}

describe('Message Queue Integration', () => {
  let queue: MockMessageQueue;

  beforeEach(() => {
    queue = new MockMessageQueue();
  });

  afterEach(() => {
    queue.clear();
  });

  describe('Basic Queue Operations', () => {
    test('should publish and consume messages', async () => {
      const receivedMessages: any[] = [];

      await queue.subscribe('test-queue', async (message: any) => {
        receivedMessages.push(message);
      });

      await queue.publish('test-queue', { text: 'Hello, World!' });

      expect(receivedMessages).toHaveLength(1);
      expect(receivedMessages[0].text).toBe('Hello, World!');
    });

    test('should handle multiple consumers', async () => {
      const consumer1Messages: any[] = [];
      const consumer2Messages: any[] = [];

      await queue.subscribe('multi-consumer', async (message: any) => {
        consumer1Messages.push(message);
      });

      await queue.subscribe('multi-consumer', async (message: any) => {
        consumer2Messages.push(message);
      });

      await queue.publish('multi-consumer', { id: 1 });
      await queue.publish('multi-consumer', { id: 2 });

      expect(consumer1Messages).toHaveLength(2);
      expect(consumer2Messages).toHaveLength(2);
    });

    test('should maintain message order', async () => {
      const receivedOrder: number[] = [];

      await queue.subscribe('ordered-queue', async (message: any) => {
        receivedOrder.push(message.order);
      });

      for (let i = 1; i <= 5; i++) {
        await queue.publish('ordered-queue', { order: i });
      }

      expect(receivedOrder).toEqual([1, 2, 3, 4, 5]);
    });
  });

  describe('Error Handling and Retries', () => {
    test('should retry failed messages', async () => {
      let attemptCount = 0;
      const events: string[] = [];

      queue.on('message:retrying', () => events.push('retry'));
      queue.on('message:processed', () => events.push('processed'));

      await queue.subscribe('retry-queue', async (message: any) => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error('Temporary failure');
        }
        // Success on third attempt
      });

      await queue.publish('retry-queue', { test: 'retry' });

      expect(attemptCount).toBe(3);
      expect(events.filter(e => e === 'retry')).toHaveLength(2);
      expect(events).toContain('processed');
    });

    test('should move to DLQ after max retries', async () => {
      const events: string[] = [];

      queue.on('message:failed', () => events.push('failed'));

      await queue.subscribe('dlq-test', async (message: any) => {
        throw new Error('Always fails');
      });

      await queue.publish('dlq-test', { test: 'dlq' });

      expect(events).toContain('failed');
      expect(queue.getDLQSize('dlq-test')).toBe(1);
    });
  });

  describe('Queue Integration with Workers', () => {
    test('should distribute work to multiple workers', async () => {
      const worker1 = new MockWorker();
      const worker2 = new MockWorker();
      const worker3 = new MockWorker();

      const workers = [worker1, worker2, worker3];
      let workerIndex = 0;

      await queue.subscribe('work-queue', async (message: any) => {
        const worker = workers[workerIndex % workers.length];
        workerIndex++;
        await worker.process(message);
      });

      // Publish 9 tasks
      for (let i = 0; i < 9; i++) {
        await queue.publish('work-queue', { id: i, data: `Task ${i}` });
      }

      const totalProcessed = workers.reduce(
        (sum, w) => sum + w.getProcessedCount(),
        0
      );

      expect(totalProcessed).toBe(9);
      expect(worker1.getProcessedCount()).toBe(3);
      expect(worker2.getProcessedCount()).toBe(3);
      expect(worker3.getProcessedCount()).toBe(3);
    });
  });
});

describe('Event Bus Integration', () => {
  let eventBus: MockEventBus;

  beforeEach(() => {
    eventBus = new MockEventBus();
  });

  describe('Event Publishing and Subscription', () => {
    test('should publish and receive events', () => {
      const receivedEvents: any[] = [];

      eventBus.subscribe('user:created', (event: any) => {
        receivedEvents.push(event);
      });

      eventBus.publish('user:created', { userId: '123', username: 'testuser' });

      expect(receivedEvents).toHaveLength(1);
      expect(receivedEvents[0].data.userId).toBe('123');
    });

    test('should support multiple subscribers', () => {
      const subscriber1Events: any[] = [];
      const subscriber2Events: any[] = [];

      eventBus.subscribe('order:placed', (event: any) => {
        subscriber1Events.push(event);
      });

      eventBus.subscribe('order:placed', (event: any) => {
        subscriber2Events.push(event);
      });

      eventBus.publish('order:placed', { orderId: '456' });

      expect(subscriber1Events).toHaveLength(1);
      expect(subscriber2Events).toHaveLength(1);
    });

    test('should unsubscribe handlers', () => {
      const events: any[] = [];

      const unsubscribe = eventBus.subscribe('test:event', (event: any) => {
        events.push(event);
      });

      eventBus.publish('test:event', { count: 1 });
      unsubscribe();
      eventBus.publish('test:event', { count: 2 });

      expect(events).toHaveLength(1);
    });

    test('should maintain event log', () => {
      eventBus.publish('event1', { data: 1 });
      eventBus.publish('event2', { data: 2 });
      eventBus.publish('event3', { data: 3 });

      const log = eventBus.getEventLog();

      expect(log).toHaveLength(3);
      expect(log[0].type).toBe('event1');
      expect(log[1].type).toBe('event2');
      expect(log[2].type).toBe('event3');
    });
  });

  describe('Event Propagation Patterns', () => {
    test('should cascade events through multiple handlers', () => {
      const executionOrder: string[] = [];

      eventBus.subscribe('user:registered', (event: any) => {
        executionOrder.push('send-welcome-email');
        eventBus.publish('email:sent', {
          userId: event.data.userId,
          type: 'welcome'
        });
      });

      eventBus.subscribe('user:registered', (event: any) => {
        executionOrder.push('create-profile');
        eventBus.publish('profile:created', { userId: event.data.userId });
      });

      eventBus.subscribe('email:sent', () => {
        executionOrder.push('log-email');
      });

      eventBus.subscribe('profile:created', () => {
        executionOrder.push('log-profile');
      });

      eventBus.publish('user:registered', { userId: '123' });

      expect(executionOrder).toContain('send-welcome-email');
      expect(executionOrder).toContain('create-profile');
      expect(executionOrder).toContain('log-email');
      expect(executionOrder).toContain('log-profile');
    });

    test('should handle error in one subscriber without affecting others', () => {
      const results: string[] = [];

      eventBus.subscribe('test:event', () => {
        throw new Error('Subscriber 1 failed');
      });

      eventBus.subscribe('test:event', () => {
        results.push('subscriber-2-ok');
      });

      eventBus.subscribe('test:event', () => {
        results.push('subscriber-3-ok');
      });

      eventBus.publish('test:event', {});

      expect(results).toContain('subscriber-2-ok');
      expect(results).toContain('subscriber-3-ok');
    });
  });
});

describe('Message Queue and Event Bus Integration', () => {
  let queue: MockMessageQueue;
  let eventBus: MockEventBus;

  beforeEach(() => {
    queue = new MockMessageQueue();
    eventBus = new MockEventBus();
  });

  test('should bridge events to message queue', async () => {
    const queuedMessages: any[] = [];

    // Subscribe queue to event bus
    eventBus.subscribe('order:created', async (event: any) => {
      await queue.publish('order-processing', event.data);
    });

    // Subscribe to queue
    await queue.subscribe('order-processing', async (message: any) => {
      queuedMessages.push(message);
    });

    // Publish event
    eventBus.publish('order:created', { orderId: '789', amount: 100 });

    expect(queuedMessages).toHaveLength(1);
    expect(queuedMessages[0].orderId).toBe('789');
  });

  test('should publish queue results back to event bus', async () => {
    const busEvents: any[] = [];

    eventBus.subscribe('task:completed', (event: any) => {
      busEvents.push(event);
    });

    await queue.subscribe('task-queue', async (message: any) => {
      // Process task
      const result = { taskId: message.id, status: 'completed' };

      // Publish result to event bus
      eventBus.publish('task:completed', result);
    });

    await queue.publish('task-queue', { id: 'task-1', action: 'process' });

    expect(busEvents).toHaveLength(1);
    expect(busEvents[0].data.taskId).toBe('task-1');
  });

  test('should handle complex workflow through both systems', async () => {
    const workflow: string[] = [];

    // Step 1: Event triggers queue message
    eventBus.subscribe('workflow:start', async (event: any) => {
      workflow.push('event-received');
      await queue.publish('step1-queue', event.data);
    });

    // Step 2: Queue processes and publishes event
    await queue.subscribe('step1-queue', async (message: any) => {
      workflow.push('step1-processed');
      eventBus.publish('workflow:step1-complete', message);
    });

    // Step 3: Event triggers another queue
    eventBus.subscribe('workflow:step1-complete', async (event: any) => {
      workflow.push('step1-complete-event');
      await queue.publish('step2-queue', event.data);
    });

    // Step 4: Final processing
    await queue.subscribe('step2-queue', async (message: any) => {
      workflow.push('step2-processed');
      eventBus.publish('workflow:complete', message);
    });

    // Final event
    eventBus.subscribe('workflow:complete', () => {
      workflow.push('workflow-complete');
    });

    // Start workflow
    eventBus.publish('workflow:start', { workflowId: 'wf-1' });

    expect(workflow).toEqual([
      'event-received',
      'step1-processed',
      'step1-complete-event',
      'step2-processed',
      'workflow-complete'
    ]);
  });
});

describe('Worker Pool with Queue Integration', () => {
  let queue: MockMessageQueue;
  let workers: MockWorker[];

  beforeEach(() => {
    queue = new MockMessageQueue();
    workers = Array.from({ length: 3 }, () => new MockWorker());
  });

  test('should distribute tasks across worker pool', async () => {
    let workerIndex = 0;

    await queue.subscribe('worker-pool', async (message: any) => {
      const worker = workers[workerIndex % workers.length];
      workerIndex++;
      await worker.process(message);
    });

    // Submit 10 tasks
    for (let i = 0; i < 10; i++) {
      await queue.publish('worker-pool', { id: `task-${i}`, data: `Data ${i}` });
    }

    const totalProcessed = workers.reduce(
      (sum, w) => sum + w.getProcessedCount(),
      0
    );

    expect(totalProcessed).toBe(10);
  });

  test('should handle concurrent processing', async () => {
    const processing: Set<string> = new Set();
    const completed: string[] = [];

    await queue.subscribe('concurrent-queue', async (message: any) => {
      processing.add(message.id);

      // Find available worker
      const worker = workers.find(w => !w.isProcessing());
      if (worker) {
        const result = await worker.process(message);
        processing.delete(message.id);
        completed.push(result.taskId);
      }
    });

    // Submit multiple tasks
    const tasks = Array.from({ length: 6 }, (_, i) =>
      queue.publish('concurrent-queue', { id: `task-${i}`, data: `Data ${i}` })
    );

    await Promise.all(tasks);

    expect(completed.length).toBeGreaterThan(0);
  });
});

describe('Event-Driven Microservices Pattern', () => {
  let eventBus: MockEventBus;
  let serviceQueues: Map<string, MockMessageQueue>;

  beforeEach(() => {
    eventBus = new MockEventBus();
    serviceQueues = new Map([
      ['user-service', new MockMessageQueue()],
      ['email-service', new MockMessageQueue()],
      ['notification-service', new MockMessageQueue()]
    ]);
  });

  test('should coordinate multiple services via events', async () => {
    const serviceResults: Map<string, any[]> = new Map();

    // User service
    eventBus.subscribe('user:register', async (event: any) => {
      const userQueue = serviceQueues.get('user-service')!;
      await userQueue.publish('create-user', event.data);
    });

    await serviceQueues.get('user-service')!.subscribe('create-user', async (msg: any) => {
      if (!serviceResults.has('user-service')) {
        serviceResults.set('user-service', []);
      }
      serviceResults.get('user-service')!.push(msg);
      eventBus.publish('user:created', msg);
    });

    // Email service
    eventBus.subscribe('user:created', async (event: any) => {
      const emailQueue = serviceQueues.get('email-service')!;
      await emailQueue.publish('send-email', event.data);
    });

    await serviceQueues.get('email-service')!.subscribe('send-email', async (msg: any) => {
      if (!serviceResults.has('email-service')) {
        serviceResults.set('email-service', []);
      }
      serviceResults.get('email-service')!.push(msg);
      eventBus.publish('email:sent', msg);
    });

    // Notification service
    eventBus.subscribe('user:created', async (event: any) => {
      const notifQueue = serviceQueues.get('notification-service')!;
      await notifQueue.publish('send-notification', event.data);
    });

    await serviceQueues.get('notification-service')!.subscribe('send-notification', async (msg: any) => {
      if (!serviceResults.has('notification-service')) {
        serviceResults.set('notification-service', []);
      }
      serviceResults.get('notification-service')!.push(msg);
    });

    // Trigger registration
    eventBus.publish('user:register', { email: 'test@example.com' });

    expect(serviceResults.get('user-service')).toHaveLength(1);
    expect(serviceResults.get('email-service')).toHaveLength(1);
    expect(serviceResults.get('notification-service')).toHaveLength(1);
  });
});
