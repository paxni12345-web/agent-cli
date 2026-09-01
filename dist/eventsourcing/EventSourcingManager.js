"use strict";
/**
 * Advanced Event Sourcing & CQRS System
 * Event store, event replay, snapshots, projections
 * Command handling, query optimization, eventual consistency
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventSourcingManager = void 0;
const events_1 = require("events");
// ============================================================================
// Event Sourcing Manager
// ============================================================================
class EventSourcingManager extends events_1.EventEmitter {
    config;
    eventStore;
    snapshotStore;
    commandHandlers = new Map();
    eventHandlers = new Map();
    projections = new Map();
    subscriptions = new Map();
    aggregates = new Map();
    readModels = new Map();
    constructor(config = {}) {
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
    registerCommandHandler(commandType, handler) {
        this.commandHandlers.set(commandType, handler);
        this.emit('command_handler:registered', { commandType });
    }
    async executeCommand(command) {
        this.emit('command:execute:start', { command });
        try {
            const handler = this.commandHandlers.get(command.type);
            if (!handler) {
                throw new Error(`No handler registered for command: ${command.type}`);
            }
            // Load or create aggregate
            const aggregate = await this.loadAggregate(command.aggregateId, this.getAggregateType(command.type));
            // Check version if specified
            if (command.metadata.expectedVersion !== undefined) {
                if (aggregate.version !== command.metadata.expectedVersion) {
                    throw new Error(`Version mismatch: expected ${command.metadata.expectedVersion}, got ${aggregate.version}`);
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
            if (this.config.enableSnapshots &&
                aggregate.version % this.config.snapshotInterval === 0) {
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
        }
        catch (error) {
            this.emit('command:error', { command, error });
            return {
                success: false,
                aggregateId: command.aggregateId,
                version: -1,
                events: [],
                error: error,
            };
        }
    }
    getAggregateType(commandType) {
        // Extract aggregate type from command type
        // e.g., "CreateUser" -> "User"
        return commandType.replace(/^(Create|Update|Delete)/, '');
    }
    // ========================================================================
    // Aggregate Management
    // ========================================================================
    async loadAggregate(aggregateId, aggregateType) {
        // Check cache
        const cached = this.aggregates.get(aggregateId);
        if (cached) {
            return cached;
        }
        let aggregate = {
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
    applyEventToAggregate(aggregate, event) {
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
    registerEventHandler(eventType, handler) {
        if (!this.eventHandlers.has(eventType)) {
            this.eventHandlers.set(eventType, []);
        }
        this.eventHandlers.get(eventType).push(handler);
        this.emit('event_handler:registered', { eventType });
    }
    async publishEvent(event) {
        this.emit('event:published', { event });
        // Notify event handlers
        const handlers = this.eventHandlers.get(event.eventType) || [];
        for (const handler of handlers) {
            try {
                await handler.handle(event);
            }
            catch (error) {
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
    async createSnapshot(aggregate) {
        const snapshot = {
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
    async getSnapshot(aggregateId) {
        return await this.snapshotStore.get(aggregateId);
    }
    // ========================================================================
    // Projection Management
    // ========================================================================
    registerProjection(definition) {
        const projection = {
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
    async updateProjections(event) {
        for (const projection of this.projections.values()) {
            if (!projection.enabled)
                continue;
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
            }
            catch (error) {
                this.emit('projection:error', { projection, event, error });
            }
        }
    }
    async rebuildProjection(projectionId) {
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
    getProjectionDefinition(projectionId) {
        // In production, this would retrieve the actual definition
        return null;
    }
    async queryProjection(projectionId, params = {}) {
        const projection = this.projections.get(projectionId);
        if (!projection) {
            throw new Error(`Projection not found: ${projectionId}`);
        }
        const definition = this.getProjectionDefinition(projectionId);
        if (!definition || !definition.query) {
            return {
                data: projection.state,
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
    subscribe(eventTypes, handler) {
        const subscription = {
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
    unsubscribe(subscriptionId) {
        const subscription = this.subscriptions.get(subscriptionId);
        if (subscription) {
            subscription.active = false;
            this.subscriptions.delete(subscriptionId);
            this.emit('subscription:removed', { subscription });
        }
    }
    async notifySubscriptions(event) {
        for (const subscription of this.subscriptions.values()) {
            if (!subscription.active)
                continue;
            if (subscription.eventTypes.includes(event.eventType)) {
                try {
                    await subscription.handler(event);
                    subscription.position++;
                }
                catch (error) {
                    this.emit('subscription:error', { subscription, event, error });
                }
            }
        }
    }
    // ========================================================================
    // Event Replay
    // ========================================================================
    async replayEvents(options = {}) {
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
    async getEventsForReplay(options) {
        let events = [];
        if (options.aggregateId) {
            events = await this.eventStore.getEvents(options.aggregateId);
        }
        else {
            events = await this.eventStore.getAllEvents(options.fromTimestamp);
        }
        // Filter by timestamp
        if (options.fromTimestamp) {
            events = events.filter(e => e.timestamp >= options.fromTimestamp);
        }
        if (options.toTimestamp) {
            events = events.filter(e => e.timestamp <= options.toTimestamp);
        }
        // Filter by event types
        if (options.eventTypes && options.eventTypes.length > 0) {
            events = events.filter(e => options.eventTypes.includes(e.eventType));
        }
        return events;
    }
    // ========================================================================
    // Read Models
    // ========================================================================
    async getReadModel(type, id) {
        const key = `${type}:${id}`;
        const readModel = this.readModels.get(key);
        if (!readModel) {
            return null;
        }
        return readModel.data;
    }
    async updateReadModel(type, id, data) {
        const key = `${type}:${id}`;
        const readModel = {
            id,
            type,
            data,
            version: this.readModels.get(key)?.version ?? 0 + 1,
            updatedAt: Date.now(),
        };
        this.readModels.set(key, readModel);
        this.emit('read_model:updated', { readModel });
    }
    async deleteReadModel(type, id) {
        const key = `${type}:${id}`;
        this.readModels.delete(key);
        this.emit('read_model:deleted', { type, id });
    }
    async queryReadModels(type, filter) {
        const results = [];
        for (const [key, readModel] of this.readModels.entries()) {
            if (readModel.type === type && filter(readModel.data)) {
                results.push(readModel.data);
            }
        }
        return results;
    }
    // ========================================================================
    // Event Processing
    // ========================================================================
    startEventProcessor() {
        // Process events in background
        setInterval(() => {
            this.processEvents();
        }, 1000);
    }
    async processEvents() {
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
    async getEventStream(aggregateId) {
        const events = await this.eventStore.getEvents(aggregateId);
        return {
            aggregateId,
            events,
            version: events.length > 0 ? events[events.length - 1].version : 0,
        };
    }
    async getAllEventStreams() {
        const allEvents = await this.eventStore.getAllEvents();
        const streamMap = new Map();
        for (const event of allEvents) {
            if (!streamMap.has(event.aggregateId)) {
                streamMap.set(event.aggregateId, []);
            }
            streamMap.get(event.aggregateId).push(event);
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
    async getStats() {
        const allEvents = await this.eventStore.getAllEvents();
        const eventsByType = new Map();
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
    generateId() {
        return `evt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    createEvent(aggregateId, aggregateType, eventType, data, metadata = {}) {
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
    createCommand(type, aggregateId, data, metadata) {
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
exports.EventSourcingManager = EventSourcingManager;
// ============================================================================
// In-Memory Event Store
// ============================================================================
class InMemoryEventStore {
    events = [];
    eventsByAggregate = new Map();
    eventsByType = new Map();
    async append(events) {
        for (const event of events) {
            this.events.push(event);
            // Index by aggregate
            if (!this.eventsByAggregate.has(event.aggregateId)) {
                this.eventsByAggregate.set(event.aggregateId, []);
            }
            this.eventsByAggregate.get(event.aggregateId).push(event);
            // Index by type
            if (!this.eventsByType.has(event.eventType)) {
                this.eventsByType.set(event.eventType, []);
            }
            this.eventsByType.get(event.eventType).push(event);
        }
    }
    async getEvents(aggregateId, fromVersion = 0) {
        const events = this.eventsByAggregate.get(aggregateId) || [];
        return events.filter(e => e.version >= fromVersion);
    }
    async getEventsByType(eventType, fromTimestamp = 0) {
        const events = this.eventsByType.get(eventType) || [];
        return events.filter(e => e.timestamp >= fromTimestamp);
    }
    async getAllEvents(fromTimestamp = 0, limit) {
        let events = this.events.filter(e => e.timestamp >= fromTimestamp);
        if (limit) {
            events = events.slice(0, limit);
        }
        return events;
    }
    async deleteEvents(aggregateId) {
        const eventsToDelete = this.eventsByAggregate.get(aggregateId) || [];
        // Remove from main array
        this.events = this.events.filter(e => e.aggregateId !== aggregateId);
        // Remove from indexes
        this.eventsByAggregate.delete(aggregateId);
        for (const event of eventsToDelete) {
            const typeEvents = this.eventsByType.get(event.eventType) || [];
            this.eventsByType.set(event.eventType, typeEvents.filter(e => e.id !== event.id));
        }
    }
}
// ============================================================================
// In-Memory Snapshot Store
// ============================================================================
class InMemorySnapshotStore {
    snapshots = new Map();
    async save(snapshot) {
        this.snapshots.set(snapshot.aggregateId, snapshot);
    }
    async get(aggregateId) {
        return this.snapshots.get(aggregateId) || null;
    }
    async delete(aggregateId) {
        this.snapshots.delete(aggregateId);
    }
}
// ============================================================================
// Export
// ============================================================================
exports.default = EventSourcingManager;
