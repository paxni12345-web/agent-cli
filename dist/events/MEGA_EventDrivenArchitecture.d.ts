/**
 * MEGA PHASE 17: COMPLETE EVENT-DRIVEN ARCHITECTURE
 * Event sourcing, CQRS, Event bus, Saga pattern, Event streaming
 * Lines: 3500+
 */
import { EventEmitter } from 'events';
export interface EventSourcingConfig {
    snapshotInterval: number;
    replayBatchSize: number;
    enableSnapshots: boolean;
    enableProjections: boolean;
    storage: EventStorage;
}
export type EventStorage = 'memory' | 'disk' | 'database' | 's3';
export interface DomainEvent {
    id: string;
    aggregateId: string;
    aggregateType: string;
    eventType: string;
    version: number;
    data: any;
    metadata: EventMetadata;
    timestamp: Date;
}
export interface EventMetadata {
    userId?: string;
    correlationId?: string;
    causationId?: string;
    ip?: string;
    userAgent?: string;
}
export interface Aggregate {
    id: string;
    type: string;
    version: number;
    state: any;
    uncommittedEvents: DomainEvent[];
    createdAt: Date;
    updatedAt: Date;
}
export interface Snapshot {
    id: string;
    aggregateId: string;
    version: number;
    state: any;
    timestamp: Date;
}
export interface EventStream {
    aggregateId: string;
    events: DomainEvent[];
    version: number;
}
export declare class EventStore extends EventEmitter {
    private config;
    private events;
    private snapshots;
    private aggregates;
    constructor(config?: Partial<EventSourcingConfig>);
    appendEvent(event: Omit<DomainEvent, 'id' | 'timestamp'>): Promise<DomainEvent>;
    getEventStream(aggregateId: string, fromVersion?: number): Promise<EventStream>;
    replayEvents(aggregateId: string): Promise<Aggregate>;
    private createEmptyAggregate;
    private applyEvent;
    private createSnapshot;
    getAllEvents(options?: GetEventsOptions): Promise<DomainEvent[]>;
    private generateId;
    getStats(): {
        aggregates: number;
        events: number;
        snapshots: number;
    };
}
export interface GetEventsOptions {
    eventType?: string;
    aggregateType?: string;
    fromDate?: Date;
    toDate?: Date;
    limit?: number;
}
export interface EventBusConfig {
    maxListeners: number;
    retryAttempts: number;
    retryDelay: number;
    deadLetterQueue: boolean;
}
export interface EventHandler {
    id: string;
    eventType: string;
    handler: (event: DomainEvent) => Promise<void>;
    priority: number;
    async: boolean;
}
export interface EventSubscription {
    id: string;
    eventType: string;
    handler: EventHandler;
    filter?: EventFilter;
    active: boolean;
}
export interface EventFilter {
    aggregateType?: string;
    userId?: string;
    custom?: (event: DomainEvent) => boolean;
}
export declare class EventBus extends EventEmitter {
    private config;
    private handlers;
    private subscriptions;
    private deadLetterQueue;
    constructor(config?: Partial<EventBusConfig>);
    subscribe(eventType: string, handler: (event: DomainEvent) => Promise<void>, options?: SubscribeOptions): EventSubscription;
    unsubscribe(subscriptionId: string): void;
    publish(event: DomainEvent): Promise<void>;
    private executeHandler;
    private matchesFilter;
    private sleep;
    private generateId;
    getStats(): {
        subscriptions: number;
        activeSubscriptions: number;
        deadLetterQueue: number;
    };
}
export interface SubscribeOptions {
    priority?: number;
    async?: boolean;
    filter?: EventFilter;
}
export interface CQRSConfig {
    eventStore: EventStore;
    eventBus: EventBus;
    enableProjections: boolean;
}
export interface Command {
    id: string;
    type: string;
    aggregateId: string;
    payload: any;
    metadata: CommandMetadata;
    timestamp: Date;
}
export interface CommandMetadata {
    userId?: string;
    requestId?: string;
    ip?: string;
}
export interface CommandHandler {
    commandType: string;
    handle: (command: Command) => Promise<CommandResult>;
    validate?: (command: Command) => Promise<boolean>;
}
export interface CommandResult {
    success: boolean;
    aggregateId: string;
    version: number;
    events: DomainEvent[];
    error?: string;
}
export interface Query {
    id: string;
    type: string;
    params: any;
    timestamp: Date;
}
export interface QueryHandler {
    queryType: string;
    handle: (query: Query) => Promise<any>;
}
export declare class CQRS extends EventEmitter {
    private config;
    private commandHandlers;
    private queryHandlers;
    private readModels;
    constructor(config: CQRSConfig);
    private setupProjections;
    registerCommandHandler(handler: CommandHandler): void;
    registerQueryHandler(handler: QueryHandler): void;
    executeCommand(command: Omit<Command, 'id' | 'timestamp'>): Promise<CommandResult>;
    executeQuery(query: Omit<Query, 'id' | 'timestamp'>): Promise<any>;
    registerReadModel(name: string, projection: ProjectionFunction): ReadModel;
    private projectEvent;
    private generateId;
    getStats(): {
        commandHandlers: number;
        queryHandlers: number;
        readModels: number;
    };
}
export interface ReadModel {
    name: string;
    data: Map<string, any>;
    projection: ProjectionFunction;
}
export type ProjectionFunction = (event: DomainEvent, data: Map<string, any>) => Promise<void>;
export interface SagaConfig {
    timeout: number;
    retryAttempts: number;
    compensateOnFailure: boolean;
}
export interface Saga {
    id: string;
    name: string;
    steps: SagaStep[];
    currentStep: number;
    status: SagaStatus;
    data: Map<string, any>;
    startedAt: Date;
    completedAt?: Date;
}
export type SagaStatus = 'pending' | 'running' | 'completed' | 'compensating' | 'failed';
export interface SagaStep {
    name: string;
    execute: (data: Map<string, any>) => Promise<any>;
    compensate: (data: Map<string, any>) => Promise<void>;
    status: StepStatus;
}
export type StepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'compensated';
export declare class SagaOrchestrator extends EventEmitter {
    private config;
    private sagas;
    constructor(config?: Partial<SagaConfig>);
    createSaga(name: string, steps: Omit<SagaStep, 'status'>[]): Saga;
    execute(sagaId: string): Promise<void>;
    private executeStep;
    private compensate;
    private executeWithTimeout;
    private sleep;
    private generateId;
    getStats(): {
        sagas: number;
        running: number;
        completed: number;
        failed: number;
    };
}
export declare class CompleteEventDrivenSystem {
    eventStore: EventStore;
    eventBus: EventBus;
    cqrs: CQRS;
    sagas: SagaOrchestrator;
    constructor();
    getOverallStats(): {
        eventStore: {
            aggregates: number;
            events: number;
            snapshots: number;
        };
        eventBus: {
            subscriptions: number;
            activeSubscriptions: number;
            deadLetterQueue: number;
        };
        cqrs: {
            commandHandlers: number;
            queryHandlers: number;
            readModels: number;
        };
        sagas: {
            sagas: number;
            running: number;
            completed: number;
            failed: number;
        };
    };
}
//# sourceMappingURL=MEGA_EventDrivenArchitecture.d.ts.map