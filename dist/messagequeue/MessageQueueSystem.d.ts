/**
 * Message Queue System
 * Advanced message queuing, pub/sub, dead letter handling, and message routing
 */
export interface MessageQueue {
    id: string;
    name: string;
    type: QueueType;
    config: QueueConfig;
    status: QueueStatus;
    metrics: QueueMetrics;
    createdAt: Date;
}
export declare enum QueueType {
    FIFO = "fifo",
    Priority = "priority",
    Delay = "delay",
    Standard = "standard"
}
export interface QueueConfig {
    maxSize: number;
    maxMessageSize: number;
    messageRetention: number;
    visibilityTimeout: number;
    deadLetterQueue?: string;
    maxReceiveCount: number;
    deliveryDelay?: number;
}
export declare enum QueueStatus {
    Active = "active",
    Paused = "paused",
    Draining = "draining",
    Stopped = "stopped"
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
export declare enum MessageStatus {
    Pending = "pending",
    InFlight = "in_flight",
    Processed = "processed",
    Failed = "failed",
    DeadLetter = "dead_letter"
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
    timeout: number;
}
export interface RetryPolicy {
    maxAttempts: number;
    backoffType: BackoffType;
    initialDelay: number;
    maxDelay: number;
    multiplier: number;
}
export declare enum BackoffType {
    Fixed = "fixed",
    Linear = "linear",
    Exponential = "exponential"
}
export declare enum ConsumerStatus {
    Running = "running",
    Paused = "paused",
    Stopped = "stopped",
    Error = "error"
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
    messageRetention: number;
    maxMessageSize: number;
    partitions: number;
    replicationFactor: number;
    compressionType?: CompressionType;
}
export declare enum CompressionType {
    None = "none",
    Gzip = "gzip",
    Snappy = "snappy",
    LZ4 = "lz4",
    Zstd = "zstd"
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
    ackDeadline: number;
    retainAckedMessages: boolean;
    messageRetention: number;
    enableOrdering: boolean;
}
export declare enum SubscriptionStatus {
    Active = "active",
    Paused = "paused",
    Deleted = "deleted"
}
export interface Exchange {
    id: string;
    name: string;
    type: ExchangeType;
    bindings: Binding[];
    config: ExchangeConfig;
    createdAt: Date;
}
export declare enum ExchangeType {
    Direct = "direct",
    Topic = "topic",
    Fanout = "fanout",
    Headers = "headers"
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
export declare enum BatchStatus {
    Pending = "pending",
    Processing = "processing",
    Completed = "completed",
    Failed = "failed"
}
export interface DeadLetterQueue {
    id: string;
    name: string;
    sourceQueueId: string;
    messages: Message[];
    retention: number;
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
export declare enum OperationType {
    Send = "send",
    Receive = "receive",
    Delete = "delete",
    ChangeVisibility = "change_visibility"
}
export declare enum OperationStatus {
    Pending = "pending",
    Committed = "committed",
    RolledBack = "rolled_back"
}
export declare enum TransactionStatus {
    Active = "active",
    Committed = "committed",
    RolledBack = "rolled_back"
}
/**
 * Queue Manager
 */
export declare class QueueManager {
    private queues;
    private messages;
    /**
     * Create queue
     */
    createQueue(config: Omit<MessageQueue, 'id' | 'status' | 'metrics' | 'createdAt'>): MessageQueue;
    /**
     * Send message
     */
    sendMessage(queueId: string, body: any, attributes?: Partial<MessageAttributes>): Promise<Message>;
    /**
     * Receive messages
     */
    receiveMessages(queueId: string, maxMessages?: number): Promise<Message[]>;
    /**
     * Delete message
     */
    deleteMessage(queueId: string, messageId: string): Promise<void>;
    /**
     * Get queue
     */
    getQueue(queueId: string): MessageQueue | undefined;
    /**
     * List queues
     */
    listQueues(filter?: {
        type?: QueueType;
        status?: QueueStatus;
    }): MessageQueue[];
    /**
     * Purge queue
     */
    purgeQueue(queueId: string): Promise<number>;
    private generateQueueId;
    private generateMessageId;
}
/**
 * Consumer Manager
 */
export declare class ConsumerManager {
    private consumers;
    private queueManager;
    private intervals;
    constructor(queueManager: QueueManager);
    /**
     * Create consumer
     */
    createConsumer(config: Omit<Consumer, 'id' | 'status' | 'metrics' | 'createdAt'>): Consumer;
    /**
     * Start consumer
     */
    startConsumer(consumerId: string): Promise<void>;
    /**
     * Stop consumer
     */
    stopConsumer(consumerId: string): Promise<void>;
    /**
     * Get consumer
     */
    getConsumer(consumerId: string): Consumer | undefined;
    /**
     * List consumers
     */
    listConsumers(queueId?: string): Consumer[];
    private pollMessages;
    private processMessage;
    private generateConsumerId;
}
/**
 * Topic Manager
 */
export declare class TopicManager {
    private topics;
    /**
     * Create topic
     */
    createTopic(config: Omit<Topic, 'id' | 'subscriptions' | 'metrics' | 'createdAt'>): Topic;
    /**
     * Publish message
     */
    publish(topicId: string, message: any, attributes?: Record<string, any>): Promise<void>;
    /**
     * Subscribe
     */
    subscribe(topicId: string, config: Omit<Subscription, 'id' | 'topicId' | 'status' | 'createdAt'>): Subscription;
    /**
     * Get topic
     */
    getTopic(topicId: string): Topic | undefined;
    /**
     * List topics
     */
    listTopics(): Topic[];
    private matchesFilter;
    private generateTopicId;
    private generateSubscriptionId;
}
/**
 * Exchange Manager
 */
export declare class ExchangeManager {
    private exchanges;
    private queueManager;
    constructor(queueManager: QueueManager);
    /**
     * Create exchange
     */
    createExchange(config: Omit<Exchange, 'id' | 'bindings' | 'createdAt'>): Exchange;
    /**
     * Bind queue
     */
    bindQueue(exchangeId: string, queueId: string, routingKey: string, args?: Record<string, any>): Binding;
    /**
     * Publish to exchange
     */
    publish(exchangeId: string, routingKey: string, message: any, attributes?: Partial<MessageAttributes>): Promise<void>;
    /**
     * Get exchange
     */
    getExchange(exchangeId: string): Exchange | undefined;
    /**
     * List exchanges
     */
    listExchanges(type?: ExchangeType): Exchange[];
    private getMatchingBindings;
    private matchTopicPattern;
    private generateExchangeId;
    private generateBindingId;
}
/**
 * Singleton instances
 */
export declare const queueManager: QueueManager;
export declare const consumerManager: ConsumerManager;
export declare const topicManager: TopicManager;
export declare const exchangeManager: ExchangeManager;
//# sourceMappingURL=MessageQueueSystem.d.ts.map