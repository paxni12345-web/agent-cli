/**
 * Advanced Event Sourcing & CQRS System
 * Event store, event replay, snapshots, projections
 * Command handling, query optimization, eventual consistency
 */
import { EventEmitter } from 'events';
export interface EventSourcingConfig {
    snapshotInterval: number;
    maxEventBatchSize: number;
    enableProjections: boolean;
    enableSnapshots: boolean;
    storageBackend: 'memory' | 'file' | 'database';
    retentionDays: number;
}
export interface Event {
    id: string;
    aggregateId: string;
    aggregateType: string;
    eventType: string;
    data: any;
    metadata: EventMetadata;
    version: number;
    timestamp: number;
}
export interface EventMetadata {
    userId?: string;
    correlationId?: string;
    causationId?: string;
    source: string;
    traceId?: string;
    clientInfo?: Record<string, any>;
}
export interface Command {
    id: string;
    type: string;
    aggregateId: string;
    data: any;
    metadata: CommandMetadata;
    timestamp: number;
}
export interface CommandMetadata {
    userId: string;
    correlationId?: string;
    causationId?: string;
    expectedVersion?: number;
}
export interface Aggregate {
    id: string;
    type: string;
    version: number;
    state: any;
    uncommittedEvents: Event[];
}
export interface Snapshot {
    id: string;
    aggregateId: string;
    aggregateType: string;
    version: number;
    state: any;
    timestamp: number;
}
export interface Projection {
    id: string;
    name: string;
    type: ProjectionType;
    query: any;
    state: any;
    lastEventId?: string;
    lastEventTimestamp?: number;
    enabled: boolean;
}
export type ProjectionType = 'real_time' | 'eventual' | 'batch';
export interface EventStore {
    append(events: Event[]): Promise<void>;
    getEvents(aggregateId: string, fromVersion?: number): Promise<Event[]>;
    getEventsByType(eventType: string, fromTimestamp?: number): Promise<Event[]>;
    getAllEvents(fromTimestamp?: number, limit?: number): Promise<Event[]>;
    deleteEvents(aggregateId: string): Promise<void>;
}
export interface SnapshotStore {
    save(snapshot: Snapshot): Promise<void>;
    get(aggregateId: string): Promise<Snapshot | null>;
    delete(aggregateId: string): Promise<void>;
}
export interface CommandHandler {
    canHandle(command: Command): boolean;
    handle(command: Command, aggregate: Aggregate): Promise<Event[]>;
}
export interface EventHandler {
    canHandle(event: Event): boolean;
    handle(event: Event): Promise<void>;
}
export interface AggregateRoot {
    id: string;
    type: string;
    version: number;
    applyEvent(event: Event): void;
    getUncommittedEvents(): Event[];
    markEventsAsCommitted(): void;
}
export interface ReadModel {
    id: string;
    type: string;
    data: any;
    version: number;
    updatedAt: number;
}
export interface EventStream {
    aggregateId: string;
    events: Event[];
    version: number;
}
export interface EventSubscription {
    id: string;
    eventTypes: string[];
    handler: (event: Event) => Promise<void>;
    position: number;
    active: boolean;
}
export interface EventReplayOptions {
    aggregateId?: string;
    fromTimestamp?: number;
    toTimestamp?: number;
    eventTypes?: string[];
    batchSize?: number;
}
export interface ProjectionDefinition {
    name: string;
    type: ProjectionType;
    eventTypes: string[];
    initialState: any;
    reducer: (state: any, event: Event) => any;
    query?: (state: any, params: any) => any;
}
export interface CommandResult {
    success: boolean;
    aggregateId: string;
    version: number;
    events: Event[];
    error?: Error;
}
export interface QueryResult<T> {
    data: T;
    timestamp: number;
    fromCache?: boolean;
}
export declare class EventSourcingManager extends EventEmitter {
    private config;
    private eventStore;
    private snapshotStore;
    private commandHandlers;
    private eventHandlers;
    private projections;
    private subscriptions;
    private aggregates;
    private readModels;
    constructor(config?: Partial<EventSourcingConfig>);
    registerCommandHandler(commandType: string, handler: CommandHandler): void;
    executeCommand(command: Command): Promise<CommandResult>;
    private getAggregateType;
    private loadAggregate;
    private applyEventToAggregate;
    registerEventHandler(eventType: string, handler: EventHandler): void;
    private publishEvent;
    private createSnapshot;
    getSnapshot(aggregateId: string): Promise<Snapshot | null>;
    registerProjection(definition: ProjectionDefinition): Projection;
    private updateProjections;
    rebuildProjection(projectionId: string): Promise<void>;
    private getProjectionDefinition;
    queryProjection<T>(projectionId: string, params?: any): Promise<QueryResult<T>>;
    subscribe(eventTypes: string[], handler: (event: Event) => Promise<void>): EventSubscription;
    unsubscribe(subscriptionId: string): void;
    private notifySubscriptions;
    replayEvents(options?: EventReplayOptions): Promise<void>;
    private getEventsForReplay;
    getReadModel<T>(type: string, id: string): Promise<T | null>;
    updateReadModel(type: string, id: string, data: any): Promise<void>;
    deleteReadModel(type: string, id: string): Promise<void>;
    queryReadModels<T>(type: string, filter: (data: any) => boolean): Promise<T[]>;
    private startEventProcessor;
    private processEvents;
    getEventStream(aggregateId: string): Promise<EventStream>;
    getAllEventStreams(): Promise<EventStream[]>;
    getStats(): Promise<EventSourcingStats>;
    private generateId;
    createEvent(aggregateId: string, aggregateType: string, eventType: string, data: any, metadata?: Partial<EventMetadata>): Event;
    createCommand(type: string, aggregateId: string, data: any, metadata: CommandMetadata): Command;
}
interface EventSourcingStats {
    totalEvents: number;
    totalAggregates: number;
    totalSnapshots: number;
    totalProjections: number;
    activeProjections: number;
    totalSubscriptions: number;
    activeSubscriptions: number;
    eventsByType: Record<string, number>;
    totalReadModels: number;
}
export default EventSourcingManager;
//# sourceMappingURL=EventSourcingManager.d.ts.map