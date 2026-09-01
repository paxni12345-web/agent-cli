/**
 * Advanced Message Queue & Event Bus System
 * Publish-subscribe, point-to-point, request-reply patterns
 * Dead letter queues, message routing, priority queues
 */
import { EventEmitter } from 'events';
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
export declare class MessageQueueManager extends EventEmitter {
    private config;
    private queues;
    private topics;
    private exchanges;
    private scheduledMessages;
    private processingMessages;
    constructor(config?: Partial<MessageQueueConfig>);
    createQueue(name: string, type?: QueueType, config?: Partial<QueueConfig>): Queue;
    getQueue(name: string): Queue | undefined;
    deleteQueue(name: string): void;
    pauseQueue(name: string): void;
    resumeQueue(name: string): void;
    publish(queueName: string, body: any, options?: PublishOptions): Promise<Message>;
    private insertByPriority;
    publishBatch(queueName: string, messages: any[], options?: PublishOptions): Promise<Message[]>;
    consume(queueName: string, handler: MessageHandler, options?: ConsumeOptions): Promise<Consumer>;
    cancelConsumer(consumerId: string): void;
    private processQueue;
    private getNextMessage;
    private processMessage;
    private handleFailedMessage;
    private handleExpiredMessage;
    createTopic(name: string): Topic;
    subscribe(topicName: string, handler: MessageHandler, filter?: MessageFilter): Subscriber;
    unsubscribe(subscriberId: string): void;
    publishToTopic(topicName: string, body: any, options?: PublishOptions): Promise<void>;
    private deliverToSubscribers;
    private matchesFilter;
    createExchange(name: string, type: ExchangeType, durable?: boolean): Exchange;
    bindQueue(exchangeName: string, queueName: string, routingKey?: string, arguments?: Record<string, any>): Binding;
    publishToExchange(exchangeName: string, body: any, options?: PublishOptions): Promise<void>;
    private findMatchingBindings;
    private matchesTopicPattern;
    private matchesHeaders;
    scheduleMessage(queueName: string, body: any, executeAt: number, options?: PublishOptions): ScheduledMessage;
    cancelScheduledMessage(scheduledId: string): void;
    private startScheduledMessageProcessor;
    private processScheduledMessages;
    private startMessageProcessor;
    private processAllQueues;
    private executeWithTimeout;
    private generateId;
    getStats(): MessageQueueStats;
}
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
export default MessageQueueManager;
//# sourceMappingURL=MessageQueueManager.d.ts.map