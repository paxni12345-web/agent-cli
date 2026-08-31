/**
 * Event Sourcing Manager with Comprehensive Cleanup
 * Implements event store, projections, and snapshots with proper resource management
 */

type EventHandler<T = any> = (event: StoredEvent<T>) => void | Promise<void>;
type Unsubscribe = () => void;

interface StoredEvent<T = any> {
  id: string;
  aggregateId: string;
  aggregateType: string;
  eventType: string;
  data: T;
  metadata: EventMetadata;
  version: number;
  timestamp: number;
}

interface EventMetadata {
  userId?: string;
  correlationId?: string;
  causationId?: string;
  [key: string]: any;
}

interface Snapshot {
  aggregateId: string;
  aggregateType: string;
  version: number;
  state: any;
  timestamp: number;
}

interface EventSubscription {
  id: string;
  aggregateType?: string;
  eventType?: string;
  handler: EventHandler;
}

interface Projection {
  name: string;
  handler: EventHandler;
  lastProcessedVersion: number;
  isActive: boolean;
}

interface MessageQueueConfig {
  maxRetries: number;
  retryDelay: number;
  deadLetterQueue: StoredEvent[];
}

/**
 * Event Store with cleanup capabilities
 */
export class EventStore {
  private events: Map<string, StoredEvent[]> = new Map();
  private snapshots: Map<string, Snapshot> = new Map();
  private subscriptions: Map<string, EventSubscription> = new Map();
  private subscriptionCounter: number = 0;
  private projections: Map<string, Projection> = new Map();
  private projectionTimers: Map<string, NodeJS.Timeout> = new Map();
  private messageQueues: Map<string, StoredEvent[]> = new Map();
  private messageQueueConfigs: Map<string, MessageQueueConfig> = new Map();
  private processingTimers: Map<string, NodeJS.Timeout> = new Map();
  private isShuttingDown: boolean = false;
  private snapshotInterval: number = 10; // Take snapshot every N events
  private maxEventsInMemory: number = 10000;

  /**
   * Append event to the store
   */
  public async appendEvent<T = any>(
    aggregateId: string,
    aggregateType: string,
    eventType: string,
    data: T,
    metadata: EventMetadata = {}
  ): Promise<StoredEvent<T>> {
    if (this.isShuttingDown) {
      throw new Error('EventStore is shutting down, cannot append events');
    }

    const key = `${aggregateType}:${aggregateId}`;
    const events = this.events.get(key) || [];

    const version = events.length + 1;

    const event: StoredEvent<T> = {
      id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      aggregateId,
      aggregateType,
      eventType,
      data,
      metadata,
      version,
      timestamp: Date.now(),
    };

    events.push(event);
    this.events.set(key, events);

    // Check if we need to take a snapshot
    if (version % this.snapshotInterval === 0) {
      await this.maybeCreateSnapshot(aggregateId, aggregateType, events);
    }

    // Notify subscribers
    await this.notifySubscribers(event);

    // Process projections
    await this.processProjections(event);

    // Check memory limit
    this.enforceMemoryLimit();

    return event;
  }

  /**
   * Get events for an aggregate
   */
  public getEvents(aggregateId: string, aggregateType: string, fromVersion: number = 0): StoredEvent[] {
    const key = `${aggregateType}:${aggregateId}`;
    const events = this.events.get(key) || [];

    return events.filter(event => event.version > fromVersion);
  }

  /**
   * Get all events of a specific type
   */
  public getEventsByType(eventType: string): StoredEvent[] {
    const allEvents: StoredEvent[] = [];

    for (const events of this.events.values()) {
      allEvents.push(...events.filter(event => event.eventType === eventType));
    }

    return allEvents.sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Subscribe to events
   */
  public subscribe(
    handler: EventHandler,
    aggregateType?: string,
    eventType?: string
  ): Unsubscribe {
    if (this.isShuttingDown) {
      throw new Error('EventStore is shutting down, cannot add subscriptions');
    }

    const subscription: EventSubscription = {
      id: `sub_${++this.subscriptionCounter}`,
      aggregateType,
      eventType,
      handler,
    };

    this.subscriptions.set(subscription.id, subscription);

    return () => this.unsubscribe(subscription.id);
  }

  /**
   * Unsubscribe from events
   */
  private unsubscribe(subscriptionId: string): void {
    this.subscriptions.delete(subscriptionId);
  }

  /**
   * Notify subscribers of an event
   */
  private async notifySubscribers(event: StoredEvent): Promise<void> {
    const promises: Promise<void>[] = [];

    for (const subscription of this.subscriptions.values()) {
      // Check if subscription matches
      if (subscription.aggregateType && subscription.aggregateType !== event.aggregateType) {
        continue;
      }

      if (subscription.eventType && subscription.eventType !== event.eventType) {
        continue;
      }

      promises.push(
        (async () => {
          try {
            await subscription.handler(event);
          } catch (error) {
            console.error(`Error in event subscription handler:`, error);
          }
        })()
      );
    }

    await Promise.all(promises);
  }

  /**
   * Create snapshot
   */
  public async createSnapshot(aggregateId: string, aggregateType: string, state: any): Promise<void> {
    const key = `${aggregateType}:${aggregateId}`;
    const events = this.events.get(key) || [];

    const snapshot: Snapshot = {
      aggregateId,
      aggregateType,
      version: events.length,
      state,
      timestamp: Date.now(),
    };

    this.snapshots.set(key, snapshot);
  }

  /**
   * Get snapshot
   */
  public getSnapshot(aggregateId: string, aggregateType: string): Snapshot | null {
    const key = `${aggregateType}:${aggregateId}`;
    return this.snapshots.get(key) || null;
  }

  /**
   * Maybe create snapshot based on event count
   */
  private async maybeCreateSnapshot(
    aggregateId: string,
    aggregateType: string,
    events: StoredEvent[]
  ): Promise<void> {
    // In a real implementation, you would rebuild the aggregate state here
    // For this example, we'll just store a simple snapshot
    const state = {
      aggregateId,
      aggregateType,
      eventCount: events.length,
      lastEvent: events[events.length - 1],
    };

    await this.createSnapshot(aggregateId, aggregateType, state);
  }

  /**
   * Register a projection
   */
  public registerProjection(
    name: string,
    handler: EventHandler,
    pollInterval: number = 1000
  ): void {
    if (this.isShuttingDown) {
      throw new Error('EventStore is shutting down, cannot register projections');
    }

    if (this.projections.has(name)) {
      throw new Error(`Projection "${name}" is already registered`);
    }

    const projection: Projection = {
      name,
      handler,
      lastProcessedVersion: 0,
      isActive: true,
    };

    this.projections.set(name, projection);

    // Start polling for new events
    const timer = setInterval(async () => {
      await this.pollProjection(name);
    }, pollInterval);

    this.projectionTimers.set(name, timer);
  }

  /**
   * Unregister a projection
   */
  public unregisterProjection(name: string): void {
    const timer = this.projectionTimers.get(name);
    if (timer) {
      clearInterval(timer);
      this.projectionTimers.delete(name);
    }

    this.projections.delete(name);
  }

  /**
   * Poll projection for new events
   */
  private async pollProjection(name: string): Promise<void> {
    const projection = this.projections.get(name);
    if (!projection || !projection.isActive || this.isShuttingDown) {
      return;
    }

    // Get all events since last processed version
    const allEvents: StoredEvent[] = [];
    for (const events of this.events.values()) {
      allEvents.push(...events.filter(e => e.version > projection.lastProcessedVersion));
    }

    // Sort by timestamp
    allEvents.sort((a, b) => a.timestamp - b.timestamp);

    // Process events
    for (const event of allEvents) {
      try {
        await projection.handler(event);
        projection.lastProcessedVersion = Math.max(projection.lastProcessedVersion, event.version);
      } catch (error) {
        console.error(`Error in projection "${name}":`, error);
      }
    }
  }

  /**
   * Process projections immediately for a new event
   */
  private async processProjections(event: StoredEvent): Promise<void> {
    const promises: Promise<void>[] = [];

    for (const projection of this.projections.values()) {
      if (!projection.isActive) {
        continue;
      }

      promises.push(
        (async () => {
          try {
            await projection.handler(event);
            projection.lastProcessedVersion = Math.max(projection.lastProcessedVersion, event.version);
          } catch (error) {
            console.error(`Error in projection "${projection.name}":`, error);
          }
        })()
      );
    }

    await Promise.all(promises);
  }

  /**
   * Pause a projection
   */
  public pauseProjection(name: string): void {
    const projection = this.projections.get(name);
    if (projection) {
      projection.isActive = false;
    }
  }

  /**
   * Resume a projection
   */
  public resumeProjection(name: string): void {
    const projection = this.projections.get(name);
    if (projection) {
      projection.isActive = true;
    }
  }

  /**
   * Create message queue
   */
  public createMessageQueue(
    queueName: string,
    maxRetries: number = 3,
    retryDelay: number = 1000
  ): void {
    if (!this.messageQueues.has(queueName)) {
      this.messageQueues.set(queueName, []);
      this.messageQueueConfigs.set(queueName, {
        maxRetries,
        retryDelay,
        deadLetterQueue: [],
      });
    }
  }

  /**
   * Enqueue event to message queue
   */
  public enqueueEvent(queueName: string, event: StoredEvent): void {
    if (this.isShuttingDown) {
      console.warn(`EventStore is shutting down, event will not be enqueued to "${queueName}"`);
      return;
    }

    const queue = this.messageQueues.get(queueName);
    if (!queue) {
      throw new Error(`Message queue "${queueName}" does not exist`);
    }

    queue.push(event);
  }

  /**
   * Process message queue
   */
  public async processMessageQueue(
    queueName: string,
    processor: (event: StoredEvent) => Promise<void>
  ): Promise<number> {
    const queue = this.messageQueues.get(queueName);
    const config = this.messageQueueConfigs.get(queueName);

    if (!queue || !config) {
      throw new Error(`Message queue "${queueName}" does not exist`);
    }

    let processed = 0;
    const failed: Array<{ event: StoredEvent; retries: number }> = [];

    while (queue.length > 0 && !this.isShuttingDown) {
      const event = queue.shift();
      if (!event) continue;

      let retries = 0;
      let success = false;

      while (retries < config.maxRetries && !success) {
        try {
          await processor(event);
          success = true;
          processed++;
        } catch (error) {
          retries++;
          console.error(`Error processing event in queue "${queueName}" (attempt ${retries}):`, error);

          if (retries < config.maxRetries) {
            await new Promise(resolve => setTimeout(resolve, config.retryDelay));
          }
        }
      }

      if (!success) {
        failed.push({ event, retries });
        config.deadLetterQueue.push(event);
      }
    }

    if (failed.length > 0) {
      console.warn(`${failed.length} events failed processing in queue "${queueName}" and moved to dead letter queue`);
    }

    return processed;
  }

  /**
   * Start auto-processing a message queue
   */
  public startMessageQueueProcessing(
    queueName: string,
    processor: (event: StoredEvent) => Promise<void>,
    interval: number = 100
  ): void {
    if (this.processingTimers.has(queueName)) {
      console.warn(`Message queue "${queueName}" is already being processed`);
      return;
    }

    const timer = setInterval(async () => {
      if (this.isShuttingDown) {
        return;
      }

      const queue = this.messageQueues.get(queueName);
      if (queue && queue.length > 0) {
        await this.processMessageQueue(queueName, processor);
      }
    }, interval);

    this.processingTimers.set(queueName, timer);
  }

  /**
   * Stop auto-processing a message queue
   */
  public stopMessageQueueProcessing(queueName: string): void {
    const timer = this.processingTimers.get(queueName);
    if (timer) {
      clearInterval(timer);
      this.processingTimers.delete(queueName);
    }
  }

  /**
   * Get dead letter queue
   */
  public getDeadLetterQueue(queueName: string): StoredEvent[] {
    const config = this.messageQueueConfigs.get(queueName);
    return config ? [...config.deadLetterQueue] : [];
  }

  /**
   * Clear dead letter queue
   */
  public clearDeadLetterQueue(queueName: string): void {
    const config = this.messageQueueConfigs.get(queueName);
    if (config) {
      config.deadLetterQueue = [];
    }
  }

  /**
   * Clear message queue
   */
  public clearMessageQueue(queueName: string): void {
    const queue = this.messageQueues.get(queueName);
    if (queue) {
      queue.length = 0;
    }
  }

  /**
   * Delete message queue
   */
  public deleteMessageQueue(queueName: string): void {
    this.stopMessageQueueProcessing(queueName);
    this.messageQueues.delete(queueName);
    this.messageQueueConfigs.delete(queueName);
  }

  /**
   * Enforce memory limit by removing old events
   */
  private enforceMemoryLimit(): void {
    let totalEvents = 0;
    for (const events of this.events.values()) {
      totalEvents += events.length;
    }

    if (totalEvents <= this.maxEventsInMemory) {
      return;
    }

    // Find the oldest aggregate and remove events before its snapshot
    let oldestKey: string | null = null;
    let oldestTimestamp = Infinity;

    for (const [key, events] of this.events.entries()) {
      if (events.length > 0 && events[0].timestamp < oldestTimestamp) {
        oldestTimestamp = events[0].timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      const snapshot = this.snapshots.get(oldestKey);
      if (snapshot) {
        // Remove events before snapshot
        const events = this.events.get(oldestKey)!;
        const eventsToKeep = events.filter(e => e.version > snapshot.version);
        this.events.set(oldestKey, eventsToKeep);
      }
    }
  }

  /**
   * Clear all events for an aggregate
   */
  public clearAggregate(aggregateId: string, aggregateType: string): void {
    const key = `${aggregateType}:${aggregateId}`;
    this.events.delete(key);
    this.snapshots.delete(key);
  }

  /**
   * Clear all events
   */
  public clearAllEvents(): void {
    this.events.clear();
  }

  /**
   * Clear all snapshots
   */
  public clearAllSnapshots(): void {
    this.snapshots.clear();
  }

  /**
   * Get statistics
   */
  public getStats(): {
    totalEvents: number;
    totalAggregates: number;
    totalSnapshots: number;
    totalSubscriptions: number;
    totalProjections: number;
    activeProjections: number;
    totalMessageQueues: number;
  } {
    let totalEvents = 0;
    for (const events of this.events.values()) {
      totalEvents += events.length;
    }

    let activeProjections = 0;
    for (const projection of this.projections.values()) {
      if (projection.isActive) {
        activeProjections++;
      }
    }

    return {
      totalEvents,
      totalAggregates: this.events.size,
      totalSnapshots: this.snapshots.size,
      totalSubscriptions: this.subscriptions.size,
      totalProjections: this.projections.size,
      activeProjections,
      totalMessageQueues: this.messageQueues.size,
    };
  }

  /**
   * Comprehensive cleanup
   */
  public async dispose(): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    this.isShuttingDown = true;

    console.log('Starting EventStore cleanup...');

    // 1. Stop all projection timers
    console.log('Stopping projection timers...');
    for (const [name, timer] of this.projectionTimers.entries()) {
      clearInterval(timer);
      console.log(`  Stopped projection timer: ${name}`);
    }
    this.projectionTimers.clear();

    // 2. Pause all projections
    console.log('Pausing all projections...');
    for (const name of this.projections.keys()) {
      this.pauseProjection(name);
    }

    // 3. Stop all message queue processing
    console.log('Stopping message queue processing...');
    for (const queueName of this.processingTimers.keys()) {
      this.stopMessageQueueProcessing(queueName);
    }

    // 4. Process remaining messages in all queues
    console.log('Draining message queues...');
    for (const [queueName, queue] of this.messageQueues.entries()) {
      if (queue.length > 0) {
        console.log(`  Draining queue "${queueName}" with ${queue.length} messages...`);
        // In production, you would have a proper processor here
        // For now, we'll just clear them
        queue.length = 0;
      }
    }

    // 5. Clear all message queue processing timers
    console.log('Clearing processing timers...');
    for (const timer of this.processingTimers.values()) {
      clearInterval(timer);
    }
    this.processingTimers.clear();

    // 6. Remove all subscriptions
    console.log('Removing all subscriptions...');
    this.subscriptions.clear();

    // 7. Remove all projections
    console.log('Removing all projections...');
    this.projections.clear();

    // 8. Clear message queues
    console.log('Clearing message queues...');
    this.messageQueues.clear();
    this.messageQueueConfigs.clear();

    // Note: We keep events and snapshots as they represent the persistent state
    // In a real implementation with a persistent store, you would close connections here

    console.log('EventStore disposed successfully');
  }
}

/**
 * Event Sourcing Manager - High-level orchestration
 */
export class EventSourcingManager {
  private eventStore: EventStore;
  private aggregates: Map<string, any> = new Map();
  private cleanupCallbacks: Array<() => void | Promise<void>> = [];

  constructor(eventStore?: EventStore) {
    this.eventStore = eventStore || new EventStore();
  }

  /**
   * Get the event store
   */
  public getEventStore(): EventStore {
    return this.eventStore;
  }

  /**
   * Load aggregate from events
   */
  public async loadAggregate<T>(
    aggregateId: string,
    aggregateType: string,
    aggregateClass: new () => T
  ): Promise<T> {
    const key = `${aggregateType}:${aggregateId}`;

    // Check cache
    if (this.aggregates.has(key)) {
      return this.aggregates.get(key) as T;
    }

    // Create new instance
    const aggregate = new aggregateClass();

    // Load snapshot if available
    const snapshot = this.eventStore.getSnapshot(aggregateId, aggregateType);
    let fromVersion = 0;

    if (snapshot) {
      // Restore from snapshot
      Object.assign(aggregate, snapshot.state);
      fromVersion = snapshot.version;
    }

    // Load events after snapshot
    const events = this.eventStore.getEvents(aggregateId, aggregateType, fromVersion);

    // Apply events
    for (const event of events) {
      if (typeof (aggregate as any).apply === 'function') {
        (aggregate as any).apply(event);
      }
    }

    // Cache aggregate
    this.aggregates.set(key, aggregate);

    return aggregate;
  }

  /**
   * Save aggregate events
   */
  public async saveAggregate(
    aggregateId: string,
    aggregateType: string,
    events: Array<{ eventType: string; data: any; metadata?: EventMetadata }>
  ): Promise<void> {
    for (const event of events) {
      await this.eventStore.appendEvent(
        aggregateId,
        aggregateType,
        event.eventType,
        event.data,
        event.metadata
      );
    }
  }

  /**
   * Register cleanup callback
   */
  public onCleanup(callback: () => void | Promise<void>): void {
    this.cleanupCallbacks.push(callback);
  }

  /**
   * Clear aggregate cache
   */
  public clearAggregateCache(aggregateId?: string, aggregateType?: string): void {
    if (aggregateId && aggregateType) {
      const key = `${aggregateType}:${aggregateId}`;
      this.aggregates.delete(key);
    } else {
      this.aggregates.clear();
    }
  }

  /**
   * Comprehensive cleanup
   */
  public async dispose(): Promise<void> {
    console.log('Starting EventSourcingManager cleanup...');

    // 1. Run custom cleanup callbacks
    console.log('Running custom cleanup callbacks...');
    for (const callback of this.cleanupCallbacks) {
      try {
        await callback();
      } catch (error) {
        console.error('Error in cleanup callback:', error);
      }
    }
    this.cleanupCallbacks = [];

    // 2. Clear aggregate cache
    console.log('Clearing aggregate cache...');
    this.aggregates.clear();

    // 3. Dispose event store
    console.log('Disposing event store...');
    await this.eventStore.dispose();

    console.log('EventSourcingManager disposed successfully');
  }
}

/**
 * Singleton instance
 */
let globalEventSourcingManager: EventSourcingManager | null = null;

export function getGlobalEventSourcingManager(): EventSourcingManager {
  if (!globalEventSourcingManager) {
    globalEventSourcingManager = new EventSourcingManager();
  }
  return globalEventSourcingManager;
}

export async function disposeGlobalEventSourcingManager(): Promise<void> {
  if (globalEventSourcingManager) {
    await globalEventSourcingManager.dispose();
    globalEventSourcingManager = null;
  }
}
