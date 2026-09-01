/**
 * MEGA PHASE 18: MESSAGE QUEUE & STREAMING SYSTEM
 * RabbitMQ, Kafka, SQS, Redis Streams, Message routing
 * Lines: 3500+
 */
import { EventEmitter } from 'events';
export interface MessageQueueConfig {
    type: QueueType;
    host: string;
    port: number;
    username?: string;
    password?: string;
    vhost?: string;
    prefetch: number;
    autoAck: boolean;
    durable: boolean;
    retryPolicy: RetryPolicy;
}
export type QueueType = 'rabbitmq' | 'kafka' | 'sqs' | 'redis' | 'activemq';
export interface RetryPolicy {
    enabled: boolean;
    maxAttempts: number;
    initialDelay: number;
    maxDelay: number;
    backoffMultiplier: number;
}
export interface Queue {
    name: string;
    durable: boolean;
    exclusive: boolean;
    autoDelete: boolean;
    arguments: Map<string, any>;
    messageCount: number;
    consumerCount: number;
    createdAt: Date;
}
export interface Exchange {
    name: string;
    type: ExchangeType;
    durable: boolean;
    autoDelete: boolean;
    internal: boolean;
    arguments: Map<string, any>;
    bindings: Binding[];
}
export type ExchangeType = 'direct' | 'topic' | 'fanout' | 'headers';
export interface Binding {
    queue: string;
    exchange: string;
    routingKey: string;
    arguments: Map<string, any>;
}
export interface Message {
    id: string;
    body: any;
    properties: MessageProperties;
    headers: Map<string, any>;
    timestamp: Date;
    deliveryInfo?: DeliveryInfo;
}
export interface MessageProperties {
    contentType: string;
    contentEncoding?: string;
    priority?: number;
    correlationId?: string;
    replyTo?: string;
    expiration?: number;
    messageId: string;
    timestamp: Date;
    type?: string;
    userId?: string;
    appId?: string;
}
export interface DeliveryInfo {
    deliveryTag: string;
    redelivered: boolean;
    exchange: string;
    routingKey: string;
    consumerTag?: string;
}
export declare class MessageQueue extends EventEmitter {
    private config;
    private connection?;
    private channels;
    private queues;
    private exchanges;
    private consumers;
    constructor(config?: Partial<MessageQueueConfig>);
    connect(): Promise<Connection>;
    createChannel(): Promise<Channel>;
    assertQueue(channelId: string, name: string, options?: QueueOptions): Promise<Queue>;
    assertExchange(channelId: string, name: string, type: ExchangeType, options?: ExchangeOptions): Promise<Exchange>;
    bindQueue(queue: string, exchange: string, routingKey?: string): Promise<void>;
    publish(channelId: string, exchange: string, routingKey: string, content: any, options?: PublishOptions): Promise<boolean>;
    private findMatchingBindings;
    private matchTopicPattern;
    private enqueueMessage;
    private deliverMessage;
    private retryMessage;
    private sendToDeadLetter;
    consume(channelId: string, queue: string, handler: MessageHandler, options?: ConsumeOptions): Promise<Consumer>;
    ack(channelId: string, deliveryTag: string): Promise<void>;
    nack(channelId: string, deliveryTag: string, requeue?: boolean): Promise<void>;
    cancel(consumerId: string): Promise<void>;
    disconnect(): Promise<void>;
    private sleep;
    private generateId;
    getStats(): {
        connected: boolean;
        channels: number;
        queues: number;
        exchanges: number;
        consumers: number;
        totalMessages: number;
    };
}
export interface Connection {
    id: string;
    status: ConnectionStatus;
    channels: Channel[];
    heartbeat: number;
    maxChannels: number;
    createdAt: Date;
}
export type ConnectionStatus = 'connecting' | 'connected' | 'closing' | 'closed';
export interface Channel {
    id: string;
    number: number;
    prefetch: number;
    status: ChannelStatus;
    consumers: Consumer[];
    createdAt: Date;
}
export type ChannelStatus = 'opening' | 'open' | 'closing' | 'closed';
export interface Consumer {
    id: string;
    tag: string;
    channel: string;
    queue: string;
    handler: MessageHandler;
    active: boolean;
    noAck: boolean;
    exclusive: boolean;
    createdAt: Date;
}
export type MessageHandler = (message: Message) => Promise<void>;
export interface QueueOptions {
    durable?: boolean;
    exclusive?: boolean;
    autoDelete?: boolean;
    arguments?: Record<string, any>;
}
export interface ExchangeOptions {
    durable?: boolean;
    autoDelete?: boolean;
    internal?: boolean;
    arguments?: Record<string, any>;
}
export interface PublishOptions {
    contentType?: string;
    contentEncoding?: string;
    priority?: number;
    correlationId?: string;
    replyTo?: string;
    expiration?: number;
    type?: string;
    userId?: string;
    appId?: string;
    headers?: Record<string, any>;
}
export interface ConsumeOptions {
    consumerTag?: string;
    noAck?: boolean;
    exclusive?: boolean;
    arguments?: Record<string, any>;
}
export interface KafkaConfig {
    brokers: string[];
    clientId: string;
    groupId?: string;
    retry: KafkaRetryConfig;
    connectionTimeout: number;
    requestTimeout: number;
}
export interface KafkaRetryConfig {
    maxRetries: number;
    initialRetryTime: number;
    factor: number;
    multiplier: number;
    maxRetryTime: number;
}
export interface Topic {
    name: string;
    partitions: number;
    replicationFactor: number;
    config: Map<string, string>;
    createdAt: Date;
}
export interface Partition {
    topic: string;
    partition: number;
    leader: number;
    replicas: number[];
    isr: number[];
    offset: number;
}
export interface KafkaMessage {
    key?: string | Buffer;
    value: string | Buffer;
    partition?: number;
    timestamp?: string;
    headers?: Record<string, string>;
    offset?: string;
}
export interface ProducerRecord {
    topic: string;
    messages: KafkaMessage[];
    acks?: number;
    timeout?: number;
    compression?: CompressionType;
}
export type CompressionType = 'none' | 'gzip' | 'snappy' | 'lz4' | 'zstd';
export interface ConsumerGroup {
    groupId: string;
    members: ConsumerMember[];
    protocol: string;
    state: GroupState;
}
export type GroupState = 'preparing' | 'stable' | 'completing' | 'dead';
export interface ConsumerMember {
    memberId: string;
    clientId: string;
    host: string;
    assignments: TopicPartition[];
}
export interface TopicPartition {
    topic: string;
    partition: number;
    offset: string;
}
export declare class KafkaClient extends EventEmitter {
    private config;
    private producer?;
    private consumer?;
    private topics;
    private connected;
    constructor(config?: Partial<KafkaConfig>);
    connect(): Promise<void>;
    createTopic(name: string, partitions?: number, replicationFactor?: number): Promise<Topic>;
    producer(): KafkaProducer;
    consumer(groupId: string): KafkaConsumer;
    private sleep;
    getStats(): {
        connected: boolean;
        topics: number;
    };
}
export declare class KafkaProducer extends EventEmitter {
    private client;
    private transactionId?;
    private inTransaction;
    constructor(client: KafkaClient);
    send(record: ProducerRecord): Promise<RecordMetadata[]>;
    sendBatch(batch: ProducerBatch): Promise<RecordMetadata[]>;
    private generateOffset;
}
export interface RecordMetadata {
    topic: string;
    partition: number;
    offset: string;
    timestamp: string;
}
export interface ProducerBatch {
    topicMessages: ProducerRecord[];
    timeout?: number;
}
export declare class KafkaConsumer extends EventEmitter {
    private client;
    private groupId;
    private subscriptions;
    private running;
    constructor(client: KafkaClient, groupId: string);
    subscribe(topics: SubscribeTopics): Promise<void>;
    run(config: ConsumerRunConfig): Promise<void>;
    stop(): Promise<void>;
    private sleep;
}
export type SubscribeTopics = string[] | {
    topics: string[];
    fromBeginning?: boolean;
};
export interface ConsumerRunConfig {
    eachMessage: (payload: EachMessagePayload) => Promise<void>;
    eachBatch?: (payload: EachBatchPayload) => Promise<void>;
}
export interface EachMessagePayload {
    topic: string;
    partition: number;
    message: KafkaMessage;
}
export interface EachBatchPayload {
    batch: {
        topic: string;
        partition: number;
        messages: KafkaMessage[];
    };
}
export declare class CompleteMessageQueueSystem {
    rabbitmq: MessageQueue;
    kafka: KafkaClient;
    constructor();
    getOverallStats(): {
        rabbitmq: {
            connected: boolean;
            channels: number;
            queues: number;
            exchanges: number;
            consumers: number;
            totalMessages: number;
        };
        kafka: {
            connected: boolean;
            topics: number;
        };
    };
}
//# sourceMappingURL=MEGA_MessageQueueSystem.d.ts.map