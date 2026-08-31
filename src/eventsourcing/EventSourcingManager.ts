/**
 * Advanced Event Sourcing & CQRS System
 * Event store, event replay, snapshots, projections
 * Command handling, query optimization, eventual consistency
 */

import { EventEmitter } from 'events';

// ============================================================================
// Types & Interfaces
// ============================================================================

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

// ============================================================================
// Event Sourcing Manager
// ============================================================================

export class EventSourcingManager extends EventEmitter {
  private config: EventSourcingConfig;
  private eventStore: InMemoryEventStore;
  private snapshotStore: InMemorySnapshotStore;
  private commandHandlers: Map<string, CommandHandler> = new Map();
  private eventHandlers: Map<string, EventHandler[]> = new Map();
  private projections: Map<string, Projection> = new Map();
  private subscriptions: Map<string, EventSubscription> = new Map();
  private aggregates: Map<string, Aggregate> = new Map();
  private readModels: Map<string, ReadModel> = new Map();

  constructor(config: Partial<EventSourcingConfig> = {}) {
    super();
    this.config = {
      snapshotInterval: 100,
      maxEventBatchSize: 1000,
      enableProjections: true,
      enableSnapshots: true,
      storageBackend: 'memory',
      retentionDays: 90,
      ...config,
    };

    this.eventStore = new InMemoryEventStore();
    this.snapshotStore = new InMemorySnapshotStore();

    this.startEventProcessor();
  }

  // ========================================================================
  // Command Handling
  // ========================================================================

  public registerCommandHandler(commandType: string, handler: CommandHandler): void {
    this.commandHandlers.set(commandType, handler);
    this.emit('command_handler:registered', { commandType });
  }

  public async executeCommand(command: Command): Promise<CommandResult> {
    this.emit('command:execute:start', { command });

    try {
      const handler = this.commandHandlers.get(command.type);
      if (!handler) {
        throw new Error(`No handler registered for command: ${command.type}`);
      }

      // Load or create aggregate
      const aggregate = await this.loadAggregate(
        command.aggregateId,
        this.getAggregateType(command.type)
      );

      // Check version if specified
      if (command.metadata.expectedVersion !== undefined) {
        if (aggregate.version !== command.metadata.expectedVersion) {
          throw new Error(
            `Version mismatch: expected ${command.metadata.expectedVersion}, got ${aggregate.version}`
          );
        }
      }

      // Handle command
      const events = await handler.handle(command, aggregate);

      // Apply events to aggregate
      for (const event of events) {
        aggregate.version++;
        event.version = aggregate.version;
        aggregate.uncommittedEvents.push(event);
        this.applyEventToAggregate(aggregate, event);
      }

      // Persist events
      await this.eventStore.append(events);

      // Mark events as committed
      aggregate.uncommittedEvents = [];

      // Update aggregate cache
      this.aggregates.set(aggregate.id, aggregate);

      // Create snapshot if needed
      if (
        this.config.enableSnapshots &&
        aggregate.version % this.config.snapshotInterval === 0
      ) {
        await this.createSnapshot(aggregate);
      }

      // Publish events
      for (const event of events) {
        await this.publishEvent(event);
      }

      this.emit('command:executed', { command, events });

      return {
        success: true,
        aggregateId: aggregate.id,
        version: aggregate.version,
        events,
      };
    } catch (error) {
      this.emit('command:error', { command, error });

      return {
        success: false,
        aggregateId: command.aggregateId,
        version: -1,
        events: [],
        error: error as Error,
      };
    }
  }

  private getAggregateType(commandType: string): string {
    // Extract aggregate type from command type
    // e.g., "CreateUser" -> "User"
    return commandType.replace(/^(Create|Update|Delete)/, '');
  }

  // ========================================================================
  // Aggregate Management
  // ========================================================================

  private async loadAggregate(aggregateId: string, aggregateType: string): Promise<Aggregate> {
    // Check cache
    const cached = this.aggregates.get(aggregateId);
    if (cached) {
      return cached;
    }

    let aggregate: Aggregate = {
      id: aggregateId,
      type: aggregateType,
      version: 0,
      state: {},
      uncommittedEvents: [],
    };

    // Try to load from snapshot
    if (this.config.enableSnapshots) {
      const snapshot = await this.snapshotStore.get(aggregateId);
      if (snapshot) {
        aggregate.version = snapshot.version;
        aggregate.state = snapshot.state;
      }
    }

    // Load events after snapshot
    const events = await this.eventStore.getEvents(aggregateId, aggregate.version + 1);

    // Replay events
    for (const event of events) {
      this.applyEventToAggregate(aggregate, event);
      aggregate.version = event.version;
    }

    return aggregate;
  }

  private applyEventToAggregate(aggregate: Aggregate, event: Event): void {
    // Apply event to aggregate state
    switch (event.eventType) {
      case 'Created':
        aggregate.state = { ...event.data, id: aggregate.id };
        break;

      case 'Updated':
        aggregate.state = { ...aggregate.state, ...event.data };
        break;

      case 'Deleted':
        aggregate.state = { ...aggregate.state, deleted: true };
        break;

      default:
        // Custom event handling
        if (aggregate.state) {
          aggregate.state.lastEvent = event.eventType;
        }
    }

    this.emit('event:applied', { aggregate, event });
  }

  // ========================================================================
  // Event Handling
  // ========================================================================

  public registerEventHandler(eventType: string, handler: EventHandler): void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, []);
    }

    this.eventHandlers.get(eventType)!.push(handler);
    this.emit('event_handler:registered', { eventType });
  }

  private async publishEvent(event: Event): Promise<void> {
    this.emit('event:published', { event });

    // Notify event handlers
    const handlers = this.eventHandlers.get(event.eventType) || [];
    for (const handler of handlers) {
      try {
        await handler.handle(event);
      } catch (error) {
        this.emit('event_handler:error', { event, handler, error });
      }
    }

    // Update projections
    if (this.config.enableProjections) {
      await this.updateProjections(event);
    }

    // Notify subscriptions
    await this.notifySubscriptions(event);
  }

  // ========================================================================
  // Snapshot Management
  // ========================================================================

  private async createSnapshot(aggregate: Aggregate): Promise<void> {
    const snapshot: Snapshot = {
      id: this.generateId(),
      aggregateId: aggregate.id,
      aggregateType: aggregate.type,
      version: aggregate.version,
      state: JSON.parse(JSON.stringify(aggregate.state)),
      timestamp: Date.now(),
    };

    await this.snapshotStore.save(snapshot);
    this.emit('snapshot:created', { snapshot });
  }

  public async getSnapshot(aggregateId: string): Promise<Snapshot | null> {
    return await this.snapshotStore.get(aggregateId);
  }

  // ========================================================================
  // Projection Management
  // ========================================================================

  public registerProjection(definition: ProjectionDefinition): Projection {
    const projection: Projection = {
      id: this.generateId(),
      name: definition.name,
      type: definition.type,
      query: definition.query,
      state: definition.initialState,
      enabled: true,
    };

    this.projections.set(projection.id, projection);
    this.emit('projection:registered', { projection });

    // Build projection from existing events
    this.rebuildProjection(projection.id);

    return projection;
  }

  private async updateProjections(event: Event): Promise<void> {
    for (const projection of this.projections.values()) {
      if (!projection.enabled) continue;

      // Check if projection handles this event type
      const projectionDef = this.getProjectionDefinition(projection.id);
      if (!projectionDef || !projectionDef.eventTypes.includes(event.eventType)) {
        continue;
      }

      try {
        // Update projection state
        projection.state = projectionDef.reducer(projection.state, event);
        projection.lastEventId = event.id;
        projection.lastEventTimestamp = event.timestamp;

        this.emit('projection:updated', { projection, event });
      } catch (error) {
        this.emit('projection:error', { projection, event, error });
      }
    }
  }

  public async rebuildProjection(projectionId: string): Promise<void> {
    const projection = this.projections.get(projectionId);
    if (!projection) {
      throw new Error(`Projection not found: ${projectionId}`);
    }

    const definition = this.getProjectionDefinition(projectionId);
    if (!definition) {
      throw new Error(`Projection definition not found: ${projectionId}`);
    }

    this.emit('projection:rebuild:start', { projection });

    // Reset state
    projection.state = definition.initialState;
    projection.lastEventId = undefined;
    projection.lastEventTimestamp = undefined;

    // Replay all relevant events
    const events = await this.eventStore.getAllEvents();

    for (const event of events) {
      if (definition.eventTypes.includes(event.eventType)) {
        projection.state = definition.reducer(projection.state, event);
        projection.lastEventId = event.id;
        projection.lastEventTimestamp = event.timestamp;
      }
    }

    this.emit('projection:rebuild:complete', { projection });
  }

  private getProjectionDefinition(projectionId: string): ProjectionDefinition | null {
    // In production, this would retrieve the actual definition
    return null;
  }

  public async queryProjection<T>(projectionId: string, params: any = {}): Promise<QueryResult<T>> {
    const projection = this.projections.get(projectionId);
    if (!projection) {
      throw new Error(`Projection not found: ${projectionId}`);
    }

    const definition = this.getProjectionDefinition(projectionId);
    if (!definition || !definition.query) {
      return {
        data: projection.state as T,
        timestamp: Date.now(),
      };
    }

    const data = definition.query(projection.state, params);

    return {
      data,
      timestamp: Date.now(),
    };
  }

  // ========================================================================
  // Event Subscriptions
  // ========================================================================

  public subscribe(
    eventTypes: string[],
    handler: (event: Event) => Promise<void>
  ): EventSubscription {
    const subscription: EventSubscription = {
      id: this.generateId(),
      eventTypes,
      handler,
      position: 0,
      active: true,
    };

    this.subscriptions.set(subscription.id, subscription);
    this.emit('subscription:created', { subscription });

    return subscription;
  }

  public unsubscribe(subscriptionId: string): void {
    const subscription = this.subscriptions.get(subscriptionId);
    if (subscription) {
      subscription.active = false;
      this.subscriptions.delete(subscriptionId);
      this.emit('subscription:removed', { subscription });
    }
  }

  private async notifySubscriptions(event: Event): Promise<void> {
    for (const subscription of this.subscriptions.values()) {
      if (!subscription.active) continue;

      if (subscription.eventTypes.includes(event.eventType)) {
        try {
          await subscription.handler(event);
          subscription.position++;
        } catch (error) {
          this.emit('subscription:error', { subscription, event, error });
        }
      }
    }
  }

  // ========================================================================
  // Event Replay
  // ========================================================================

  public async replayEvents(options: EventReplayOptions = {}): Promise<void> {
    this.emit('replay:start', { options });

    const events = await this.getEventsForReplay(options);
    const batchSize = options.batchSize || this.config.maxEventBatchSize;

    for (let i = 0; i < events.length; i += batchSize) {
      const batch = events.slice(i, i + batchSize);

      for (const event of batch) {
        await this.publishEvent(event);
      }

      this.emit('replay:progress', {
        processed: Math.min(i + batchSize, events.length),
        total: events.length,
      });
    }

    this.emit('replay:complete', { eventsProcessed: events.length });
  }

  private async getEventsForReplay(options: EventReplayOptions): Promise<Event[]> {
    let events: Event[] = [];

    if (options.aggregateId) {
      events = await this.eventStore.getEvents(options.aggregateId);
    } else {
      events = await this.eventStore.getAllEvents(options.fromTimestamp);
    }

    // Filter by timestamp
    if (options.fromTimestamp) {
      events = events.filter(e => e.timestamp >= options.fromTimestamp!);
    }

    if (options.toTimestamp) {
      events = events.filter(e => e.timestamp <= options.toTimestamp!);
    }

    // Filter by event types
    if (options.eventTypes && options.eventTypes.length > 0) {
      events = events.filter(e => options.eventTypes!.includes(e.eventType));
    }

    return events;
  }

  // ========================================================================
  // Read Models
  // ========================================================================

  public async getReadModel<T>(type: string, id: string): Promise<T | null> {
    const key = `${type}:${id}`;
    const readModel = this.readModels.get(key);

    if (!readModel) {
      return null;
    }

    return readModel.data as T;
  }

  public async updateReadModel(type: string, id: string, data: any): Promise<void> {
    const key = `${type}:${id}`;

    const readModel: ReadModel = {
      id,
      type,
      data,
      version: this.readModels.get(key)?.version ?? 0 + 1,
      updatedAt: Date.now(),
    };

    this.readModels.set(key, readModel);
    this.emit('read_model:updated', { readModel });
  }

  public async deleteReadModel(type: string, id: string): Promise<void> {
    const key = `${type}:${id}`;
    this.readModels.delete(key);
    this.emit('read_model:deleted', { type, id });
  }

  public async queryReadModels<T>(
    type: string,
    filter: (data: any) => boolean
  ): Promise<T[]> {
    const results: T[] = [];

    for (const [key, readModel] of this.readModels.entries()) {
      if (readModel.type === type && filter(readModel.data)) {
        results.push(readModel.data as T);
      }
    }

    return results;
  }

  // ========================================================================
  // Event Processing
  // ========================================================================

  private startEventProcessor(): void {
    // Process events in background
    setInterval(() => {
      this.processEvents();
    }, 1000);
  }

  private async processEvents(): Promise<void> {
    // Clean up old events
    const cutoffTime = Date.now() - this.config.retentionDays * 24 * 60 * 60 * 1000;
    const allEvents = await this.eventStore.getAllEvents();

    const oldEvents = allEvents.filter(e => e.timestamp < cutoffTime);

    if (oldEvents.length > 0) {
      this.emit('events:cleanup', { count: oldEvents.length });
    }
  }

  // ========================================================================
  // Event Stream
  // ========================================================================

  public async getEventStream(aggregateId: string): Promise<EventStream> {
    const events = await this.eventStore.getEvents(aggregateId);

    return {
      aggregateId,
      events,
      version: events.length > 0 ? events[events.length - 1].version : 0,
    };
  }

  public async getAllEventStreams(): Promise<EventStream[]> {
    const allEvents = await this.eventStore.getAllEvents();
    const streamMap = new Map<string, Event[]>();

    for (const event of allEvents) {
      if (!streamMap.has(event.aggregateId)) {
        streamMap.set(event.aggregateId, []);
      }
      streamMap.get(event.aggregateId)!.push(event);
    }

    return Array.from(streamMap.entries()).map(([aggregateId, events]) => ({
      aggregateId,
      events,
      version: events.length > 0 ? events[events.length - 1].version : 0,
    }));
  }

  // ========================================================================
  // Statistics
  // ========================================================================

  public async getStats(): Promise<EventSourcingStats> {
    const allEvents = await this.eventStore.getAllEvents();

    const eventsByType = new Map<string, number>();
    for (const event of allEvents) {
      eventsByType.set(event.eventType, (eventsByType.get(event.eventType) || 0) + 1);
    }

    return {
      totalEvents: allEvents.length,
      totalAggregates: this.aggregates.size,
      totalSnapshots: (await this.snapshotStore['snapshots'].size) || 0,
      totalProjections: this.projections.size,
      activeProjections: Array.from(this.projections.values()).filter(p => p.enabled).length,
      totalSubscriptions: this.subscriptions.size,
      activeSubscriptions: Array.from(this.subscriptions.values()).filter(s => s.active).length,
      eventsByType: Object.fromEntries(eventsByType),
      totalReadModels: this.readModels.size,
    };
  }

  // ========================================================================
  // Utilities
  // ========================================================================

  private generateId(): string {
    return `evt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  public createEvent(
    aggregateId: string,
    aggregateType: string,
    eventType: string,
    data: any,
    metadata: Partial<EventMetadata> = {}
  ): Event {
    return {
      id: this.generateId(),
      aggregateId,
      aggregateType,
      eventType,
      data,
      metadata: {
        source: 'system',
        ...metadata,
      },
      version: 1,
      timestamp: Date.now(),
    };
  }

  public createCommand(
    type: string,
    aggregateId: string,
    data: any,
    metadata: CommandMetadata
  ): Command {
    return {
      id: this.generateId(),
      type,
      aggregateId,
      data,
      metadata,
      timestamp: Date.now(),
    };
  }
}

// ============================================================================
// In-Memory Event Store
// ============================================================================

class InMemoryEventStore implements EventStore {
  private events: Event[] = [];
  private eventsByAggregate: Map<string, Event[]> = new Map();
  private eventsByType: Map<string, Event[]> = new Map();

  async append(events: Event[]): Promise<void> {
    for (const event of events) {
      this.events.push(event);

      // Index by aggregate
      if (!this.eventsByAggregate.has(event.aggregateId)) {
        this.eventsByAggregate.set(event.aggregateId, []);
      }
      this.eventsByAggregate.get(event.aggregateId)!.push(event);

      // Index by type
      if (!this.eventsByType.has(event.eventType)) {
        this.eventsByType.set(event.eventType, []);
      }
      this.eventsByType.get(event.eventType)!.push(event);
    }
  }

  async getEvents(aggregateId: string, fromVersion: number = 0): Promise<Event[]> {
    const events = this.eventsByAggregate.get(aggregateId) || [];
    return events.filter(e => e.version >= fromVersion);
  }

  async getEventsByType(eventType: string, fromTimestamp: number = 0): Promise<Event[]> {
    const events = this.eventsByType.get(eventType) || [];
    return events.filter(e => e.timestamp >= fromTimestamp);
  }

  async getAllEvents(fromTimestamp: number = 0, limit?: number): Promise<Event[]> {
    let events = this.events.filter(e => e.timestamp >= fromTimestamp);

    if (limit) {
      events = events.slice(0, limit);
    }

    return events;
  }

  async deleteEvents(aggregateId: string): Promise<void> {
    const eventsToDelete = this.eventsByAggregate.get(aggregateId) || [];

    // Remove from main array
    this.events = this.events.filter(e => e.aggregateId !== aggregateId);

    // Remove from indexes
    this.eventsByAggregate.delete(aggregateId);

    for (const event of eventsToDelete) {
      const typeEvents = this.eventsByType.get(event.eventType) || [];
      this.eventsByType.set(
        event.eventType,
        typeEvents.filter(e => e.id !== event.id)
      );
    }
  }
}

// ============================================================================
// In-Memory Snapshot Store
// ============================================================================

class InMemorySnapshotStore implements SnapshotStore {
  private snapshots: Map<string, Snapshot> = new Map();

  async save(snapshot: Snapshot): Promise<void> {
    this.snapshots.set(snapshot.aggregateId, snapshot);
  }

  async get(aggregateId: string): Promise<Snapshot | null> {
    return this.snapshots.get(aggregateId) || null;
  }

  async delete(aggregateId: string): Promise<void> {
    this.snapshots.delete(aggregateId);
  }
}

// ============================================================================
// Supporting Types
// ============================================================================

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

// ============================================================================
// Export
// ============================================================================

export default EventSourcingManager;
