/**
 * Advanced Message Queue & Event Bus System
 * Publish-subscribe, point-to-point, request-reply patterns
 * Dead letter queues, message routing, priority queues
 */

import { EventEmitter } from 'events';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface MessageQueueConfig {
  maxQueueSize: number;
  maxRetries: number;
  retryDelay: number;
  messageTimeout: number;
  enableDeadLetterQueue: boolean;
  enablePriority: boolean;
  persistMessages: boolean;
  persistenceBackend: 'memory' | 'file' | 'database';
}

export interface Queue {
  id: string;
  name: string;
  type: QueueType;
  config: QueueConfig;
  messages: Message[];
  consumers: Consumer[];
  statistics: QueueStatistics;
  state: QueueState;
}

export type QueueType = 'standard' | 'fifo' | 'priority' | 'delay' | 'dead_letter';

export interface QueueConfig {
  maxSize: number;
  maxRetries: number;
  retryDelay: number;
  messageRetention: number;
  deadLetterQueue?: string;
  visibilityTimeout: number;
  enableDuplicateDetection: boolean;
}

export interface Message {
  id: string;
  queueName: string;
  body: any;
  attributes: MessageAttributes;
  headers: Record<string, string>;
  priority: number;
  timestamp: number;
  receiveCount: number;
  visibleAfter?: number;
  expiresAt?: number;
  status: MessageStatus;
}

export interface MessageAttributes {
  contentType?: string;
  correlationId?: string;
  replyTo?: string;
  userId?: string;
  messageType?: string;
  ttl?: number;
  [key: string]: any;
}

export type MessageStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'dead_letter';

export interface Consumer {
  id: string;
  queueName: string;
  handler: MessageHandler;
  concurrency: number;
  active: boolean;
  processed: number;
  failed: number;
  lastProcessed?: number;
}

export type MessageHandler = (message: Message) => Promise<void>;

export interface QueueStatistics {
  messagesEnqueued: number;
  messagesDequeued: number;
  messagesFailed: number;
  messagesInFlight: number;
  averageProcessingTime: number;
  oldestMessage?: number;
  newestMessage?: number;
}

export type QueueState = 'active' | 'paused' | 'stopped';

export interface Topic {
  id: string;
  name: string;
  subscribers: Subscriber[];
  messages: Message[];
  statistics: TopicStatistics;
}

export interface Subscriber {
  id: string;
  topicName: string;
  filter?: MessageFilter;
  handler: MessageHandler;
  active: boolean;
  received: number;
}

export interface MessageFilter {
  attributes?: Record<string, any>;
  messageType?: string;
  pattern?: string;
}

export interface TopicStatistics {
  messagesPublished: number;
  totalSubscribers: number;
  activeSubscribers: number;
  lastPublished?: number;
}

export interface Exchange {
  id: string;
  name: string;
  type: ExchangeType;
  bindings: Binding[];
  durable: boolean;
}

export type ExchangeType = 'direct' | 'fanout' | 'topic' | 'headers';

export interface Binding {
  id: string;
  exchangeName: string;
  queueName: string;
  routingKey: string;
  arguments?: Record<string, any>;
}

export interface PublishOptions {
  routingKey?: string;
  headers?: Record<string, string>;
  priority?: number;
  ttl?: number;
  persistent?: boolean;
  correlationId?: string;
  replyTo?: string;
}

export interface ConsumeOptions {
  concurrency?: number;
  prefetch?: number;
  autoAck?: boolean;
  exclusive?: boolean;
}

export interface DeadLetterMessage extends Message {
  originalQueue: string;
  failureReason: string;
  failureTimestamp: number;
  retryHistory: RetryAttempt[];
}

export interface RetryAttempt {
  attempt: number;
  timestamp: number;
  error: string;
}

export interface ScheduledMessage {
  id: string;
  message: Message;
  executeAt: number;
  executed: boolean;
  cancelled: boolean;
}

export interface MessageBatch {
  id: string;
  messages: Message[];
  size: number;
  createdAt: number;
}

// ============================================================================
// Message Queue Manager
// ============================================================================

export class MessageQueueManager extends EventEmitter {
  private config: MessageQueueConfig;
  private queues: Map<string, Queue> = new Map();
  private topics: Map<string, Topic> = new Map();
  private exchanges: Map<string, Exchange> = new Map();
  private scheduledMessages: Map<string, ScheduledMessage> = new Map();
  private processingMessages: Map<string, Message> = new Map();

  constructor(config: Partial<MessageQueueConfig> = {}) {
    super();
    this.config = {
      maxQueueSize: 10000,
      maxRetries: 3,
      retryDelay: 1000,
      messageTimeout: 30000,
      enableDeadLetterQueue: true,
      enablePriority: true,
      persistMessages: false,
      persistenceBackend: 'memory',
      ...config,
    };

    this.startMessageProcessor();
    this.startScheduledMessageProcessor();
  }

  // ========================================================================
  // Queue Management
  // ========================================================================

  public createQueue(
    name: string,
    type: QueueType = 'standard',
    config?: Partial<QueueConfig>
  ): Queue {
    const queue: Queue = {
      id: this.generateId(),
      name,
      type,
      config: {
        maxSize: this.config.maxQueueSize,
        maxRetries: this.config.maxRetries,
        retryDelay: this.config.retryDelay,
        messageRetention: 86400000, // 24 hours
        visibilityTimeout: 30000,
        enableDuplicateDetection: false,
        ...config,
      },
      messages: [],
      consumers: [],
      statistics: {
        messagesEnqueued: 0,
        messagesDequeued: 0,
        messagesFailed: 0,
        messagesInFlight: 0,
        averageProcessingTime: 0,
      },
      state: 'active',
    };

    this.queues.set(name, queue);
    this.emit('queue:created', { queue });

    // Create dead letter queue if enabled
    if (this.config.enableDeadLetterQueue && !queue.config.deadLetterQueue) {
      const dlqName = `${name}-dlq`;
      if (!this.queues.has(dlqName)) {
        this.createQueue(dlqName, 'dead_letter');
        queue.config.deadLetterQueue = dlqName;
      }
    }

    return queue;
  }

  public getQueue(name: string): Queue | undefined {
    return this.queues.get(name);
  }

  public deleteQueue(name: string): void {
    const queue = this.queues.get(name);
    if (queue) {
      // Stop all consumers
      for (const consumer of queue.consumers) {
        consumer.active = false;
      }

      this.queues.delete(name);
      this.emit('queue:deleted', { name });
    }
  }

  public pauseQueue(name: string): void {
    const queue = this.queues.get(name);
    if (queue) {
      queue.state = 'paused';
      this.emit('queue:paused', { name });
    }
  }

  public resumeQueue(name: string): void {
    const queue = this.queues.get(name);
    if (queue) {
      queue.state = 'active';
      this.emit('queue:resumed', { name });
    }
  }

  // ========================================================================
  // Message Publishing
  // ========================================================================

  public async publish(
    queueName: string,
    body: any,
    options: PublishOptions = {}
  ): Promise<Message> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue not found: ${queueName}`);
    }

    if (queue.messages.length >= queue.config.maxSize) {
      throw new Error(`Queue is full: ${queueName}`);
    }

    const message: Message = {
      id: this.generateId(),
      queueName,
      body,
      attributes: {
        contentType: 'application/json',
        correlationId: options.correlationId,
        replyTo: options.replyTo,
        ttl: options.ttl,
      },
      headers: options.headers || {},
      priority: options.priority || 0,
      timestamp: Date.now(),
      receiveCount: 0,
      status: 'pending',
    };

    if (options.ttl) {
      message.expiresAt = Date.now() + options.ttl;
    }

    // Check for duplicates if enabled
    if (queue.config.enableDuplicateDetection) {
      const duplicate = queue.messages.find(
        m => JSON.stringify(m.body) === JSON.stringify(body)
      );
      if (duplicate) {
        this.emit('message:duplicate', { message });
        return duplicate;
      }
    }

    // Insert based on queue type
    if (queue.type === 'priority' && this.config.enablePriority) {
      this.insertByPriority(queue, message);
    } else {
      queue.messages.push(message);
    }

    queue.statistics.messagesEnqueued++;
    if (!queue.statistics.newestMessage) {
      queue.statistics.oldestMessage = Date.now();
    }
    queue.statistics.newestMessage = Date.now();

    this.emit('message:published', { queueName, message });

    return message;
  }

  private insertByPriority(queue: Queue, message: Message): void {
    let inserted = false;
    for (let i = 0; i < queue.messages.length; i++) {
      if (message.priority > queue.messages[i].priority) {
        queue.messages.splice(i, 0, message);
        inserted = true;
        break;
      }
    }
    if (!inserted) {
      queue.messages.push(message);
    }
  }

  public async publishBatch(
    queueName: string,
    messages: any[],
    options: PublishOptions = {}
  ): Promise<Message[]> {
    const published: Message[] = [];

    for (const body of messages) {
      const message = await this.publish(queueName, body, options);
      published.push(message);
    }

    this.emit('messages:published:batch', { queueName, count: published.length });

    return published;
  }

  // ========================================================================
  // Message Consumption
  // ========================================================================

  public async consume(
    queueName: string,
    handler: MessageHandler,
    options: ConsumeOptions = {}
  ): Promise<Consumer> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue not found: ${queueName}`);
    }

    const consumer: Consumer = {
      id: this.generateId(),
      queueName,
      handler,
      concurrency: options.concurrency || 1,
      active: true,
      processed: 0,
      failed: 0,
    };

    queue.consumers.push(consumer);
    this.emit('consumer:registered', { consumer });

    return consumer;
  }

  public cancelConsumer(consumerId: string): void {
    for (const queue of this.queues.values()) {
      const consumer = queue.consumers.find(c => c.id === consumerId);
      if (consumer) {
        consumer.active = false;
        this.emit('consumer:cancelled', { consumer });
        break;
      }
    }
  }

  private async processQueue(queue: Queue): Promise<void> {
    if (queue.state !== 'active') return;

    const activeConsumers = queue.consumers.filter(c => c.active);
    if (activeConsumers.length === 0) return;

    // Process messages with available consumers
    for (const consumer of activeConsumers) {
      const message = this.getNextMessage(queue);
      if (!message) continue;

      await this.processMessage(queue, message, consumer);
    }
  }

  private getNextMessage(queue: Queue): Message | undefined {
    const now = Date.now();

    for (let i = 0; i < queue.messages.length; i++) {
      const message = queue.messages[i];

      // Skip if not visible yet
      if (message.visibleAfter && message.visibleAfter > now) {
        continue;
      }

      // Skip if expired
      if (message.expiresAt && message.expiresAt < now) {
        this.handleExpiredMessage(queue, message);
        queue.messages.splice(i, 1);
        i--;
        continue;
      }

      // Remove and return
      queue.messages.splice(i, 1);
      return message;
    }

    return undefined;
  }

  private async processMessage(
    queue: Queue,
    message: Message,
    consumer: Consumer
  ): Promise<void> {
    const startTime = Date.now();

    message.status = 'processing';
    message.receiveCount++;
    this.processingMessages.set(message.id, message);

    queue.statistics.messagesDequeued++;
    queue.statistics.messagesInFlight++;

    this.emit('message:processing', { message, consumer });

    try {
      await this.executeWithTimeout(
        consumer.handler(message),
        this.config.messageTimeout
      );

      message.status = 'completed';
      consumer.processed++;
      consumer.lastProcessed = Date.now();

      const processingTime = Date.now() - startTime;
      queue.statistics.averageProcessingTime =
        (queue.statistics.averageProcessingTime * consumer.processed + processingTime) /
        (consumer.processed + 1);

      this.emit('message:completed', { message, consumer, processingTime });
    } catch (error) {
      message.status = 'failed';
      consumer.failed++;
      queue.statistics.messagesFailed++;

      this.emit('message:failed', { message, consumer, error });

      await this.handleFailedMessage(queue, message, error as Error);
    } finally {
      this.processingMessages.delete(message.id);
      queue.statistics.messagesInFlight--;
    }
  }

  private async handleFailedMessage(
    queue: Queue,
    message: Message,
    error: Error
  ): Promise<void> {
    if (message.receiveCount < queue.config.maxRetries) {
      // Retry with exponential backoff
      const delay = queue.config.retryDelay * Math.pow(2, message.receiveCount - 1);
      message.visibleAfter = Date.now() + delay;
      message.status = 'pending';
      queue.messages.push(message);

      this.emit('message:retry', { message, delay });
    } else {
      // Move to dead letter queue
      if (queue.config.deadLetterQueue) {
        const dlq = this.queues.get(queue.config.deadLetterQueue);
        if (dlq) {
          const dlqMessage: DeadLetterMessage = {
            ...message,
            originalQueue: queue.name,
            failureReason: error.message,
            failureTimestamp: Date.now(),
            retryHistory: [],
          };

          dlq.messages.push(dlqMessage);
          this.emit('message:dead_letter', { message: dlqMessage });
        }
      }
    }
  }

  private handleExpiredMessage(queue: Queue, message: Message): void {
    this.emit('message:expired', { message });

    if (queue.config.deadLetterQueue) {
      const dlq = this.queues.get(queue.config.deadLetterQueue);
      if (dlq) {
        dlq.messages.push(message);
      }
    }
  }

  // ========================================================================
  // Pub/Sub Topics
  // ========================================================================

  public createTopic(name: string): Topic {
    const topic: Topic = {
      id: this.generateId(),
      name,
      subscribers: [],
      messages: [],
      statistics: {
        messagesPublished: 0,
        totalSubscribers: 0,
        activeSubscribers: 0,
      },
    };

    this.topics.set(name, topic);
    this.emit('topic:created', { topic });

    return topic;
  }

  public subscribe(
    topicName: string,
    handler: MessageHandler,
    filter?: MessageFilter
  ): Subscriber {
    const topic = this.topics.get(topicName);
    if (!topic) {
      throw new Error(`Topic not found: ${topicName}`);
    }

    const subscriber: Subscriber = {
      id: this.generateId(),
      topicName,
      filter,
      handler,
      active: true,
      received: 0,
    };

    topic.subscribers.push(subscriber);
    topic.statistics.totalSubscribers++;
    topic.statistics.activeSubscribers++;

    this.emit('subscriber:added', { subscriber });

    return subscriber;
  }

  public unsubscribe(subscriberId: string): void {
    for (const topic of this.topics.values()) {
      const index = topic.subscribers.findIndex(s => s.id === subscriberId);
      if (index !== -1) {
        const subscriber = topic.subscribers[index];
        subscriber.active = false;
        topic.statistics.activeSubscribers--;

        this.emit('subscriber:removed', { subscriber });
        break;
      }
    }
  }

  public async publishToTopic(
    topicName: string,
    body: any,
    options: PublishOptions = {}
  ): Promise<void> {
    const topic = this.topics.get(topicName);
    if (!topic) {
      throw new Error(`Topic not found: ${topicName}`);
    }

    const message: Message = {
      id: this.generateId(),
      queueName: topicName,
      body,
      attributes: options as MessageAttributes,
      headers: options.headers || {},
      priority: 0,
      timestamp: Date.now(),
      receiveCount: 0,
      status: 'pending',
    };

    topic.messages.push(message);
    topic.statistics.messagesPublished++;
    topic.statistics.lastPublished = Date.now();

    this.emit('topic:message:published', { topicName, message });

    // Deliver to subscribers
    await this.deliverToSubscribers(topic, message);
  }

  private async deliverToSubscribers(topic: Topic, message: Message): Promise<void> {
    const activeSubscribers = topic.subscribers.filter(s => s.active);

    for (const subscriber of activeSubscribers) {
      // Check filter
      if (subscriber.filter && !this.matchesFilter(message, subscriber.filter)) {
        continue;
      }

      try {
        await subscriber.handler(message);
        subscriber.received++;
        this.emit('subscriber:message:delivered', { subscriber, message });
      } catch (error) {
        this.emit('subscriber:message:failed', { subscriber, message, error });
      }
    }
  }

  private matchesFilter(message: Message, filter: MessageFilter): boolean {
    if (filter.messageType && message.attributes.messageType !== filter.messageType) {
      return false;
    }

    if (filter.attributes) {
      for (const [key, value] of Object.entries(filter.attributes)) {
        if (message.attributes[key] !== value) {
          return false;
        }
      }
    }

    return true;
  }

  // ========================================================================
  // Exchange & Routing
  // ========================================================================

  public createExchange(name: string, type: ExchangeType, durable: boolean = true): Exchange {
    const exchange: Exchange = {
      id: this.generateId(),
      name,
      type,
      bindings: [],
      durable,
    };

    this.exchanges.set(name, exchange);
    this.emit('exchange:created', { exchange });

    return exchange;
  }

  public bindQueue(
    exchangeName: string,
    queueName: string,
    routingKey: string = '',
    arguments?: Record<string, any>
  ): Binding {
    const exchange = this.exchanges.get(exchangeName);
    if (!exchange) {
      throw new Error(`Exchange not found: ${exchangeName}`);
    }

    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue not found: ${queueName}`);
    }

    const binding: Binding = {
      id: this.generateId(),
      exchangeName,
      queueName,
      routingKey,
      arguments,
    };

    exchange.bindings.push(binding);
    this.emit('queue:bound', { binding });

    return binding;
  }

  public async publishToExchange(
    exchangeName: string,
    body: any,
    options: PublishOptions = {}
  ): Promise<void> {
    const exchange = this.exchanges.get(exchangeName);
    if (!exchange) {
      throw new Error(`Exchange not found: ${exchangeName}`);
    }

    const matchedBindings = this.findMatchingBindings(
      exchange,
      options.routingKey || '',
      options.headers
    );

    for (const binding of matchedBindings) {
      await this.publish(binding.queueName, body, options);
    }

    this.emit('exchange:message:published', { exchangeName, bindingCount: matchedBindings.length });
  }

  private findMatchingBindings(
    exchange: Exchange,
    routingKey: string,
    headers?: Record<string, string>
  ): Binding[] {
    switch (exchange.type) {
      case 'fanout':
        return exchange.bindings;

      case 'direct':
        return exchange.bindings.filter(b => b.routingKey === routingKey);

      case 'topic':
        return exchange.bindings.filter(b => this.matchesTopicPattern(b.routingKey, routingKey));

      case 'headers':
        return exchange.bindings.filter(b => this.matchesHeaders(b.arguments, headers));

      default:
        return [];
    }
  }

  private matchesTopicPattern(pattern: string, routingKey: string): boolean {
    const patternParts = pattern.split('.');
    const keyParts = routingKey.split('.');

    if (patternParts.length !== keyParts.length) {
      return false;
    }

    for (let i = 0; i < patternParts.length; i++) {
      const patternPart = patternParts[i];
      const keyPart = keyParts[i];

      if (patternPart === '*') continue;
      if (patternPart === '#') return true;
      if (patternPart !== keyPart) return false;
    }

    return true;
  }

  private matchesHeaders(
    bindingHeaders?: Record<string, any>,
    messageHeaders?: Record<string, string>
  ): boolean {
    if (!bindingHeaders || !messageHeaders) return false;

    for (const [key, value] of Object.entries(bindingHeaders)) {
      if (messageHeaders[key] !== value) {
        return false;
      }
    }

    return true;
  }

  // ========================================================================
  // Scheduled Messages
  // ========================================================================

  public scheduleMessage(
    queueName: string,
    body: any,
    executeAt: number,
    options: PublishOptions = {}
  ): ScheduledMessage {
    const message: Message = {
      id: this.generateId(),
      queueName,
      body,
      attributes: options as MessageAttributes,
      headers: options.headers || {},
      priority: options.priority || 0,
      timestamp: Date.now(),
      receiveCount: 0,
      status: 'pending',
    };

    const scheduled: ScheduledMessage = {
      id: this.generateId(),
      message,
      executeAt,
      executed: false,
      cancelled: false,
    };

    this.scheduledMessages.set(scheduled.id, scheduled);
    this.emit('message:scheduled', { scheduled });

    return scheduled;
  }

  public cancelScheduledMessage(scheduledId: string): void {
    const scheduled = this.scheduledMessages.get(scheduledId);
    if (scheduled) {
      scheduled.cancelled = true;
      this.emit('message:schedule:cancelled', { scheduled });
    }
  }

  private startScheduledMessageProcessor(): void {
    setInterval(() => {
      this.processScheduledMessages();
    }, 1000);
  }

  private async processScheduledMessages(): Promise<void> {
    const now = Date.now();

    for (const scheduled of this.scheduledMessages.values()) {
      if (scheduled.executed || scheduled.cancelled) {
        continue;
      }

      if (scheduled.executeAt <= now) {
        await this.publish(
          scheduled.message.queueName,
          scheduled.message.body,
          scheduled.message.attributes
        );

        scheduled.executed = true;
        this.emit('message:schedule:executed', { scheduled });
      }
    }
  }

  // ========================================================================
  // Message Processing Loop
  // ========================================================================

  private startMessageProcessor(): void {
    setInterval(() => {
      this.processAllQueues();
    }, 100);
  }

  private async processAllQueues(): Promise<void> {
    for (const queue of this.queues.values()) {
      await this.processQueue(queue);
    }
  }

  // ========================================================================
  // Utilities
  // ========================================================================

  private async executeWithTimeout<T>(promise: Promise<T>, timeout: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error('Message processing timeout')), timeout)
      ),
    ]);
  }

  private generateId(): string {
    return `mq-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  public getStats(): MessageQueueStats {
    return {
      queues: this.queues.size,
      topics: this.topics.size,
      exchanges: this.exchanges.size,
      totalMessages: Array.from(this.queues.values()).reduce(
        (sum, q) => sum + q.messages.length,
        0
      ),
      processingMessages: this.processingMessages.size,
      scheduledMessages: this.scheduledMessages.size,
      totalConsumers: Array.from(this.queues.values()).reduce(
        (sum, q) => sum + q.consumers.length,
        0
      ),
      totalSubscribers: Array.from(this.topics.values()).reduce(
        (sum, t) => sum + t.subscribers.length,
        0
      ),
    };
  }
}

// ============================================================================
// Supporting Types
// ============================================================================

interface MessageQueueStats {
  queues: number;
  topics: number;
  exchanges: number;
  totalMessages: number;
  processingMessages: number;
  scheduledMessages: number;
  totalConsumers: number;
  totalSubscribers: number;
}

// ============================================================================
// Export
// ============================================================================

export default MessageQueueManager;
