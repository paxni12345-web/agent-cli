/**
 * Message Queue System
 * Advanced message queuing, pub/sub, dead letter handling, and message routing
 */

import { eventBus } from '../core/EventBus';

export interface MessageQueue {
  id: string;
  name: string;
  type: QueueType;
  config: QueueConfig;
  status: QueueStatus;
  metrics: QueueMetrics;
  createdAt: Date;
}

export enum QueueType {
  FIFO = 'fifo',
  Priority = 'priority',
  Delay = 'delay',
  Standard = 'standard',
}

export interface QueueConfig {
  maxSize: number;
  maxMessageSize: number;
  messageRetention: number; // milliseconds
  visibilityTimeout: number; // milliseconds
  deadLetterQueue?: string;
  maxReceiveCount: number;
  deliveryDelay?: number; // milliseconds
}

export enum QueueStatus {
  Active = 'active',
  Paused = 'paused',
  Draining = 'draining',
  Stopped = 'stopped',
}

export interface QueueMetrics {
  totalMessages: number;
  visibleMessages: number;
  inFlightMessages: number;
  delayedMessages: number;
  oldestMessageAge: number;
  approximateSize: number;
}

export interface Message {
  id: string;
  queueId: string;
  body: any;
  attributes: MessageAttributes;
  systemAttributes: SystemAttributes;
  status: MessageStatus;
  createdAt: Date;
  sentAt?: Date;
  receivedAt?: Date;
  deletedAt?: Date;
}

export interface MessageAttributes {
  priority?: number;
  delaySeconds?: number;
  deduplicationId?: string;
  groupId?: string;
  contentType?: string;
  correlationId?: string;
  replyTo?: string;
  custom: Record<string, any>;
}

export interface SystemAttributes {
  senderId: string;
  messageId: string;
  sequenceNumber?: number;
  approximateReceiveCount: number;
  approximateFirstReceiveTimestamp?: Date;
  sentTimestamp: Date;
}

export enum MessageStatus {
  Pending = 'pending',
  InFlight = 'in_flight',
  Processed = 'processed',
  Failed = 'failed',
  DeadLetter = 'dead_letter',
}

export interface Consumer {
  id: string;
  name: string;
  queueId: string;
  handler: MessageHandler;
  config: ConsumerConfig;
  status: ConsumerStatus;
  metrics: ConsumerMetrics;
  createdAt: Date;
}

export interface MessageHandler {
  process(message: Message): Promise<void>;
}

export interface ConsumerConfig {
  concurrency: number;
  prefetch: number;
  batchSize: number;
  autoAck: boolean;
  retryPolicy: RetryPolicy;
  timeout: number; // milliseconds
}

export interface RetryPolicy {
  maxAttempts: number;
  backoffType: BackoffType;
  initialDelay: number; // milliseconds
  maxDelay: number; // milliseconds
  multiplier: number;
}

export enum BackoffType {
  Fixed = 'fixed',
  Linear = 'linear',
  Exponential = 'exponential',
}

export enum ConsumerStatus {
  Running = 'running',
  Paused = 'paused',
  Stopped = 'stopped',
  Error = 'error',
}

export interface ConsumerMetrics {
  messagesProcessed: number;
  messagesSucceeded: number;
  messagesFailed: number;
  averageProcessingTime: number;
  lastProcessedAt?: Date;
}

export interface Topic {
  id: string;
  name: string;
  config: TopicConfig;
  subscriptions: Subscription[];
  metrics: TopicMetrics;
  createdAt: Date;
}

export interface TopicConfig {
  messageRetention: number; // milliseconds
  maxMessageSize: number;
  partitions: number;
  replicationFactor: number;
  compressionType?: CompressionType;
}

export enum CompressionType {
  None = 'none',
  Gzip = 'gzip',
  Snappy = 'snappy',
  LZ4 = 'lz4',
  Zstd = 'zstd',
}

export interface TopicMetrics {
  totalMessages: number;
  messagesPerSecond: number;
  bytesPerSecond: number;
  subscriptionCount: number;
}

export interface Subscription {
  id: string;
  topicId: string;
  name: string;
  filter?: MessageFilter;
  config: SubscriptionConfig;
  status: SubscriptionStatus;
  createdAt: Date;
}

export interface MessageFilter {
  attributes?: Record<string, any>;
  contentType?: string;
  expression?: string;
}

export interface SubscriptionConfig {
  ackDeadline: number; // milliseconds
  retainAckedMessages: boolean;
  messageRetention: number; // milliseconds
  enableOrdering: boolean;
}

export enum SubscriptionStatus {
  Active = 'active',
  Paused = 'paused',
  Deleted = 'deleted',
}

export interface Exchange {
  id: string;
  name: string;
  type: ExchangeType;
  bindings: Binding[];
  config: ExchangeConfig;
  createdAt: Date;
}

export enum ExchangeType {
  Direct = 'direct',
  Topic = 'topic',
  Fanout = 'fanout',
  Headers = 'headers',
}

export interface ExchangeConfig {
  durable: boolean;
  autoDelete: boolean;
  internal: boolean;
}

export interface Binding {
  id: string;
  exchangeId: string;
  queueId: string;
  routingKey: string;
  arguments?: Record<string, any>;
}

export interface MessageBatch {
  id: string;
  messages: Message[];
  status: BatchStatus;
  createdAt: Date;
  processedAt?: Date;
}

export enum BatchStatus {
  Pending = 'pending',
  Processing = 'processing',
  Completed = 'completed',
  Failed = 'failed',
}

export interface DeadLetterQueue {
  id: string;
  name: string;
  sourceQueueId: string;
  messages: Message[];
  retention: number; // milliseconds
  createdAt: Date;
}

export interface MessageTransaction {
  id: string;
  operations: TransactionOperation[];
  status: TransactionStatus;
  startedAt: Date;
  completedAt?: Date;
}

export interface TransactionOperation {
  type: OperationType;
  queueId: string;
  messageId?: string;
  status: OperationStatus;
}

export enum OperationType {
  Send = 'send',
  Receive = 'receive',
  Delete = 'delete',
  ChangeVisibility = 'change_visibility',
}

export enum OperationStatus {
  Pending = 'pending',
  Committed = 'committed',
  RolledBack = 'rolled_back',
}

export enum TransactionStatus {
  Active = 'active',
  Committed = 'committed',
  RolledBack = 'rolled_back',
}

/**
 * Queue Manager
 */
export class QueueManager {
  private queues: Map<string, MessageQueue> = new Map();
  private messages: Map<string, Message[]> = new Map();

  /**
   * Create queue
   */
  createQueue(config: Omit<MessageQueue, 'id' | 'status' | 'metrics' | 'createdAt'>): MessageQueue {
    const queue: MessageQueue = {
      ...config,
      id: this.generateQueueId(),
      status: QueueStatus.Active,
      metrics: {
        totalMessages: 0,
        visibleMessages: 0,
        inFlightMessages: 0,
        delayedMessages: 0,
        oldestMessageAge: 0,
        approximateSize: 0,
      },
      createdAt: new Date(),
    };

    this.queues.set(queue.id, queue);
    this.messages.set(queue.id, []);

    eventBus.emitSync('mq.queue_created', queue, 'QueueManager');

    return queue;
  }

  /**
   * Send message
   */
  async sendMessage(queueId: string, body: any, attributes?: Partial<MessageAttributes>): Promise<Message> {
    const queue = this.queues.get(queueId);

    if (!queue) {
      throw new Error(`Queue not found: ${queueId}`);
    }

    if (queue.status !== QueueStatus.Active) {
      throw new Error(`Queue is not active: ${queueId}`);
    }

    const message: Message = {
      id: this.generateMessageId(),
      queueId,
      body,
      attributes: {
        custom: {},
        ...attributes,
      },
      systemAttributes: {
        senderId: 'system',
        messageId: this.generateMessageId(),
        approximateReceiveCount: 0,
        sentTimestamp: new Date(),
      },
      status: MessageStatus.Pending,
      createdAt: new Date(),
      sentAt: new Date(),
    };

    const queueMessages = this.messages.get(queueId)!;
    queueMessages.push(message);

    // Update metrics
    queue.metrics.totalMessages++;
    queue.metrics.visibleMessages++;
    queue.metrics.approximateSize += JSON.stringify(body).length;

    eventBus.emitSync('mq.message_sent', message, 'QueueManager');

    return message;
  }

  /**
   * Receive messages
   */
  async receiveMessages(queueId: string, maxMessages: number = 1): Promise<Message[]> {
    const queue = this.queues.get(queueId);

    if (!queue) {
      throw new Error(`Queue not found: ${queueId}`);
    }

    const queueMessages = this.messages.get(queueId)!;
    const available = queueMessages.filter(m => m.status === MessageStatus.Pending);

    const messages = available.slice(0, maxMessages);

    for (const message of messages) {
      message.status = MessageStatus.InFlight;
      message.receivedAt = new Date();
      message.systemAttributes.approximateReceiveCount++;

      if (!message.systemAttributes.approximateFirstReceiveTimestamp) {
        message.systemAttributes.approximateFirstReceiveTimestamp = new Date();
      }
    }

    // Update metrics
    queue.metrics.visibleMessages -= messages.length;
    queue.metrics.inFlightMessages += messages.length;

    eventBus.emitSync('mq.messages_received', { queueId, count: messages.length }, 'QueueManager');

    return messages;
  }

  /**
   * Delete message
   */
  async deleteMessage(queueId: string, messageId: string): Promise<void> {
    const queue = this.queues.get(queueId);

    if (!queue) {
      throw new Error(`Queue not found: ${queueId}`);
    }

    const queueMessages = this.messages.get(queueId)!;
    const index = queueMessages.findIndex(m => m.id === messageId);

    if (index !== -1) {
      const message = queueMessages[index];
      message.status = MessageStatus.Processed;
      message.deletedAt = new Date();

      queueMessages.splice(index, 1);

      // Update metrics
      queue.metrics.inFlightMessages--;

      eventBus.emitSync('mq.message_deleted', { queueId, messageId }, 'QueueManager');
    }
  }

  /**
   * Get queue
   */
  getQueue(queueId: string): MessageQueue | undefined {
    return this.queues.get(queueId);
  }

  /**
   * List queues
   */
  listQueues(filter?: { type?: QueueType; status?: QueueStatus }): MessageQueue[] {
    let queues = Array.from(this.queues.values());

    if (filter?.type) {
      queues = queues.filter(q => q.type === filter.type);
    }

    if (filter?.status) {
      queues = queues.filter(q => q.status === filter.status);
    }

    return queues;
  }

  /**
   * Purge queue
   */
  async purgeQueue(queueId: string): Promise<number> {
    const queue = this.queues.get(queueId);

    if (!queue) {
      throw new Error(`Queue not found: ${queueId}`);
    }

    const queueMessages = this.messages.get(queueId)!;
    const count = queueMessages.length;

    this.messages.set(queueId, []);

    // Reset metrics
    queue.metrics.totalMessages = 0;
    queue.metrics.visibleMessages = 0;
    queue.metrics.inFlightMessages = 0;
    queue.metrics.approximateSize = 0;

    eventBus.emitSync('mq.queue_purged', { queueId, count }, 'QueueManager');

    return count;
  }

  private generateQueueId(): string {
    return `queue_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }
}

/**
 * Consumer Manager
 */
export class ConsumerManager {
  private consumers: Map<string, Consumer> = new Map();
  private queueManager: QueueManager;
  private intervals: Map<string, NodeJS.Timeout> = new Map();

  constructor(queueManager: QueueManager) {
    this.queueManager = queueManager;
  }

  /**
   * Create consumer
   */
  createConsumer(config: Omit<Consumer, 'id' | 'status' | 'metrics' | 'createdAt'>): Consumer {
    const consumer: Consumer = {
      ...config,
      id: this.generateConsumerId(),
      status: ConsumerStatus.Stopped,
      metrics: {
        messagesProcessed: 0,
        messagesSucceeded: 0,
        messagesFailed: 0,
        averageProcessingTime: 0,
      },
      createdAt: new Date(),
    };

    this.consumers.set(consumer.id, consumer);

    eventBus.emitSync('mq.consumer_created', consumer, 'ConsumerManager');

    return consumer;
  }

  /**
   * Start consumer
   */
  async startConsumer(consumerId: string): Promise<void> {
    const consumer = this.consumers.get(consumerId);

    if (!consumer) {
      throw new Error(`Consumer not found: ${consumerId}`);
    }

    if (consumer.status === ConsumerStatus.Running) {
      return;
    }

    consumer.status = ConsumerStatus.Running;

    // Start polling
    const interval = setInterval(() => {
      this.pollMessages(consumer);
    }, 1000);

    this.intervals.set(consumerId, interval);

    eventBus.emitSync('mq.consumer_started', consumer, 'ConsumerManager');
  }

  /**
   * Stop consumer
   */
  async stopConsumer(consumerId: string): Promise<void> {
    const consumer = this.consumers.get(consumerId);

    if (!consumer) {
      throw new Error(`Consumer not found: ${consumerId}`);
    }

    consumer.status = ConsumerStatus.Stopped;

    const interval = this.intervals.get(consumerId);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(consumerId);
    }

    eventBus.emitSync('mq.consumer_stopped', consumer, 'ConsumerManager');
  }

  /**
   * Get consumer
   */
  getConsumer(consumerId: string): Consumer | undefined {
    return this.consumers.get(consumerId);
  }

  /**
   * List consumers
   */
  listConsumers(queueId?: string): Consumer[] {
    let consumers = Array.from(this.consumers.values());

    if (queueId) {
      consumers = consumers.filter(c => c.queueId === queueId);
    }

    return consumers;
  }

  private async pollMessages(consumer: Consumer): Promise<void> {
    if (consumer.status !== ConsumerStatus.Running) {
      return;
    }

    try {
      const messages = await this.queueManager.receiveMessages(
        consumer.queueId,
        consumer.config.batchSize
      );

      for (const message of messages) {
        await this.processMessage(consumer, message);
      }
    } catch (error) {
      consumer.status = ConsumerStatus.Error;
      eventBus.emitSync('mq.consumer_error', { consumer, error }, 'ConsumerManager');
    }
  }

  private async processMessage(consumer: Consumer, message: Message): Promise<void> {
    const startTime = Date.now();

    try {
      await consumer.handler.process(message);

      consumer.metrics.messagesProcessed++;
      consumer.metrics.messagesSucceeded++;
      consumer.metrics.lastProcessedAt = new Date();

      const duration = Date.now() - startTime;
      consumer.metrics.averageProcessingTime =
        (consumer.metrics.averageProcessingTime * (consumer.metrics.messagesProcessed - 1) + duration) /
        consumer.metrics.messagesProcessed;

      if (consumer.config.autoAck) {
        await this.queueManager.deleteMessage(message.queueId, message.id);
      }

    } catch (error) {
      consumer.metrics.messagesProcessed++;
      consumer.metrics.messagesFailed++;

      // Check retry policy
      if (message.systemAttributes.approximateReceiveCount < consumer.config.retryPolicy.maxAttempts) {
        // Return to queue for retry
        message.status = MessageStatus.Pending;
      } else {
        // Move to dead letter queue
        message.status = MessageStatus.DeadLetter;
      }
    }
  }

  private generateConsumerId(): string {
    return `consumer_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }
}

/**
 * Topic Manager
 */
export class TopicManager {
  private topics: Map<string, Topic> = new Map();

  /**
   * Create topic
   */
  createTopic(config: Omit<Topic, 'id' | 'subscriptions' | 'metrics' | 'createdAt'>): Topic {
    const topic: Topic = {
      ...config,
      id: this.generateTopicId(),
      subscriptions: [],
      metrics: {
        totalMessages: 0,
        messagesPerSecond: 0,
        bytesPerSecond: 0,
        subscriptionCount: 0,
      },
      createdAt: new Date(),
    };

    this.topics.set(topic.id, topic);

    eventBus.emitSync('mq.topic_created', topic, 'TopicManager');

    return topic;
  }

  /**
   * Publish message
   */
  async publish(topicId: string, message: any, attributes?: Record<string, any>): Promise<void> {
    const topic = this.topics.get(topicId);

    if (!topic) {
      throw new Error(`Topic not found: ${topicId}`);
    }

    topic.metrics.totalMessages++;

    // Publish to all matching subscriptions
    for (const subscription of topic.subscriptions) {
      if (this.matchesFilter(message, attributes, subscription.filter)) {
        eventBus.emitSync('mq.message_published', { topicId, subscriptionId: subscription.id, message }, 'TopicManager');
      }
    }
  }

  /**
   * Subscribe
   */
  subscribe(topicId: string, config: Omit<Subscription, 'id' | 'topicId' | 'status' | 'createdAt'>): Subscription {
    const topic = this.topics.get(topicId);

    if (!topic) {
      throw new Error(`Topic not found: ${topicId}`);
    }

    const subscription: Subscription = {
      ...config,
      id: this.generateSubscriptionId(),
      topicId,
      status: SubscriptionStatus.Active,
      createdAt: new Date(),
    };

    topic.subscriptions.push(subscription);
    topic.metrics.subscriptionCount++;

    eventBus.emitSync('mq.subscription_created', subscription, 'TopicManager');

    return subscription;
  }

  /**
   * Get topic
   */
  getTopic(topicId: string): Topic | undefined {
    return this.topics.get(topicId);
  }

  /**
   * List topics
   */
  listTopics(): Topic[] {
    return Array.from(this.topics.values());
  }

  private matchesFilter(message: any, attributes: Record<string, any> | undefined, filter?: MessageFilter): boolean {
    if (!filter) {
      return true;
    }

    if (filter.attributes && attributes) {
      for (const [key, value] of Object.entries(filter.attributes)) {
        if (attributes[key] !== value) {
          return false;
        }
      }
    }

    if (filter.contentType && attributes?.contentType !== filter.contentType) {
      return false;
    }

    return true;
  }

  private generateTopicId(): string {
    return `topic_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  private generateSubscriptionId(): string {
    return `sub_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }
}

/**
 * Exchange Manager
 */
export class ExchangeManager {
  private exchanges: Map<string, Exchange> = new Map();
  private queueManager: QueueManager;

  constructor(queueManager: QueueManager) {
    this.queueManager = queueManager;
  }

  /**
   * Create exchange
   */
  createExchange(config: Omit<Exchange, 'id' | 'bindings' | 'createdAt'>): Exchange {
    const exchange: Exchange = {
      ...config,
      id: this.generateExchangeId(),
      bindings: [],
      createdAt: new Date(),
    };

    this.exchanges.set(exchange.id, exchange);

    eventBus.emitSync('mq.exchange_created', exchange, 'ExchangeManager');

    return exchange;
  }

  /**
   * Bind queue
   */
  bindQueue(exchangeId: string, queueId: string, routingKey: string, args?: Record<string, any>): Binding {
    const exchange = this.exchanges.get(exchangeId);

    if (!exchange) {
      throw new Error(`Exchange not found: ${exchangeId}`);
    }

    const binding: Binding = {
      id: this.generateBindingId(),
      exchangeId,
      queueId,
      routingKey,
      arguments: args,
    };

    exchange.bindings.push(binding);

    eventBus.emitSync('mq.queue_bound', binding, 'ExchangeManager');

    return binding;
  }

  /**
   * Publish to exchange
   */
  async publish(exchangeId: string, routingKey: string, message: any, attributes?: Partial<MessageAttributes>): Promise<void> {
    const exchange = this.exchanges.get(exchangeId);

    if (!exchange) {
      throw new Error(`Exchange not found: ${exchangeId}`);
    }

    const matchingBindings = this.getMatchingBindings(exchange, routingKey);

    for (const binding of matchingBindings) {
      await this.queueManager.sendMessage(binding.queueId, message, attributes);
    }
  }

  /**
   * Get exchange
   */
  getExchange(exchangeId: string): Exchange | undefined {
    return this.exchanges.get(exchangeId);
  }

  /**
   * List exchanges
   */
  listExchanges(type?: ExchangeType): Exchange[] {
    let exchanges = Array.from(this.exchanges.values());

    if (type) {
      exchanges = exchanges.filter(e => e.type === type);
    }

    return exchanges;
  }

  private getMatchingBindings(exchange: Exchange, routingKey: string): Binding[] {
    switch (exchange.type) {
      case ExchangeType.Direct:
        return exchange.bindings.filter(b => b.routingKey === routingKey);

      case ExchangeType.Fanout:
        return exchange.bindings;

      case ExchangeType.Topic:
        return exchange.bindings.filter(b => this.matchTopicPattern(routingKey, b.routingKey));

      default:
        return [];
    }
  }

  private matchTopicPattern(routingKey: string, pattern: string): boolean {
    const routingParts = routingKey.split('.');
    const patternParts = pattern.split('.');

    if (patternParts.length !== routingParts.length) {
      return false;
    }

    for (let i = 0; i < patternParts.length; i++) {
      if (patternParts[i] !== '*' && patternParts[i] !== routingParts[i]) {
        return false;
      }
    }

    return true;
  }

  private generateExchangeId(): string {
    return `exchange_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  private generateBindingId(): string {
    return `binding_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }
}

/**
 * Singleton instances
 */
export const queueManager = new QueueManager();
export const consumerManager = new ConsumerManager(queueManager);
export const topicManager = new TopicManager();
export const exchangeManager = new ExchangeManager(queueManager);
