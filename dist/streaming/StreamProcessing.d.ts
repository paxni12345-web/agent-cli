/**
 * Stream Processing & Kafka Integration
 * Real-time data streaming, event processing, and message queuing
 *
 * Part of 350K lines goal
 */
import { EventEmitter } from 'events';
export interface StreamConfig {
    brokers: string[];
    clientId: string;
    groupId: string;
    enableAutoCommit: boolean;
    autoCommitInterval: number;
    sessionTimeout: number;
    heartbeatInterval: number;
    maxRetries: number;
}
export interface Topic {
    name: string;
    partitions: number;
    replicationFactor: number;
    config: TopicConfig;
}
export interface TopicConfig {
    retentionMs: number;
    segmentMs: number;
    compressionType: CompressionType;
    cleanupPolicy: CleanupPolicy;
}
export type CompressionType = 'none' | 'gzip' | 'snappy' | 'lz4' | 'zstd';
export type CleanupPolicy = 'delete' | 'compact';
export interface Message {
    key?: string;
    value: any;
    headers?: Record<string, string>;
    partition?: number;
    timestamp?: Date;
    offset?: number;
}
export interface ConsumerGroup {
    id: string;
    members: ConsumerMember[];
    state: ConsumerGroupState;
    coordinator: string;
}
export interface ConsumerMember {
    id: string;
    clientId: string;
    host: string;
    assignments: PartitionAssignment[];
}
export interface PartitionAssignment {
    topic: string;
    partition: number;
}
export type ConsumerGroupState = 'preparing' | 'stable' | 'dead';
export interface StreamProcessor {
    id: string;
    name: string;
    inputTopics: string[];
    outputTopic?: string;
    process: ProcessorFunction;
    state: ProcessorState;
}
export type ProcessorFunction = (message: Message) => Promise<Message | null>;
export type ProcessorState = 'running' | 'paused' | 'stopped' | 'error';
export interface StreamWindow {
    type: WindowType;
    duration: number;
    gracePeriod?: number;
}
export type WindowType = 'tumbling' | 'hopping' | 'sliding' | 'session';
export interface AggregationResult {
    key: string;
    value: any;
    count: number;
    window: WindowInfo;
}
export interface WindowInfo {
    start: Date;
    end: Date;
    type: WindowType;
}
export interface Transaction {
    id: string;
    producerId: string;
    state: TransactionState;
    topics: string[];
    startedAt: Date;
    committedAt?: Date;
}
export type TransactionState = 'begun' | 'preparing' | 'committed' | 'aborted';
export interface DeadLetter {
    id: string;
    originalTopic: string;
    message: Message;
    error: string;
    attempts: number;
    timestamp: Date;
}
export interface Schema {
    id: number;
    version: number;
    subject: string;
    schema: string;
    type: SchemaType;
}
export type SchemaType = 'avro' | 'json' | 'protobuf';
export interface StreamMetrics {
    messagesProduced: number;
    messagesConsumed: number;
    bytesProduced: number;
    bytesConsumed: number;
    lag: number;
    errorRate: number;
    throughput: number;
}
export declare class StreamProcessingManager extends EventEmitter {
    private config;
    private topics;
    private processors;
    private consumerGroups;
    private transactions;
    private deadLetters;
    private schemas;
    private metrics;
    constructor(config?: Partial<StreamConfig>);
    createTopic(name: string, partitions?: number, replicationFactor?: number, config?: Partial<TopicConfig>): Promise<Topic>;
    deleteTopic(name: string): Promise<void>;
    listTopics(): Promise<Topic[]>;
    produce(topic: string, messages: Message | Message[]): Promise<void>;
    private sendMessage;
    private calculatePartition;
    consume(topics: string[], handler: (message: Message) => Promise<void>, groupId?: string): Promise<string>;
    private startConsuming;
    createProcessor(name: string, inputTopics: string[], process: ProcessorFunction, outputTopic?: string): StreamProcessor;
    startProcessor(processorId: string): Promise<void>;
    stopProcessor(processorId: string): void;
    aggregateWindow(topic: string, window: StreamWindow, aggregator: (messages: Message[]) => AggregationResult): Promise<void>;
    beginTransaction(producerId: string): Promise<Transaction>;
    commitTransaction(transactionId: string): Promise<void>;
    abortTransaction(transactionId: string): Promise<void>;
    private prepareCommit;
    private handleProcessingError;
    reprocessDeadLetter(deadLetterId: string): Promise<void>;
    registerSchema(subject: string, schema: string, type?: SchemaType): Schema;
    getSchema(subject: string, version?: number): Schema | undefined;
    validateMessage(message: Message, schemaId: number): boolean;
    getMetrics(): StreamMetrics;
    resetMetrics(): void;
    getConsumerGroups(): ConsumerGroup[];
    getConsumerGroupLag(groupId: string): number;
    rebalanceConsumerGroup(groupId: string): void;
    private generateId;
    getStats(): {
        topics: number;
        processors: number;
        runningProcessors: number;
        consumerGroups: number;
        transactions: number;
        deadLetters: number;
        schemas: number;
        metrics: StreamMetrics;
    };
}
//# sourceMappingURL=StreamProcessing.d.ts.map