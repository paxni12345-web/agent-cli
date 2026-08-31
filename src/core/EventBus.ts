/**
 * Event Bus - Pub/Sub system for decoupled component communication
 * Supports event sourcing, replay, and filtering
 */

export interface Event<T = any> {
  id: string;
  type: string;
  timestamp: Date;
  data: T;
  source: string;
  metadata?: Record<string, any>;
}

export type EventHandler<T = any> = (event: Event<T>) => void | Promise<void>;

export interface EventSubscription {
  id: string;
  unsubscribe: () => void;
}

export interface EventFilter {
  types?: string[];
  sources?: string[];
  since?: Date;
  until?: Date;
}

/**
 * Central event bus for application-wide event distribution
 */
export class EventBus {
  private handlers: Map<string, Set<EventHandler>> = new Map();
  private wildcardHandlers: Set<EventHandler> = new Set();
  private eventHistory: Event[] = [];
  private maxHistorySize: number = 1000;
  private subscriptionCounter: number = 0;

  /**
   * Subscribe to specific event types
   */
  on<T = any>(eventType: string, handler: EventHandler<T>): EventSubscription {
    const id = `sub_${++this.subscriptionCounter}`;

    if (eventType === '*') {
      this.wildcardHandlers.add(handler);
    } else {
      if (!this.handlers.has(eventType)) {
        this.handlers.set(eventType, new Set());
      }
      this.handlers.get(eventType)!.add(handler);
    }

    return {
      id,
      unsubscribe: () => this.off(eventType, handler),
    };
  }

  /**
   * Unsubscribe handler from event type
   */
  off(eventType: string, handler: EventHandler): void {
    if (eventType === '*') {
      this.wildcardHandlers.delete(handler);
    } else {
      const handlers = this.handlers.get(eventType);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          this.handlers.delete(eventType);
        }
      }
    }
  }

  /**
   * Emit an event to all subscribers
   */
  async emit<T = any>(
    type: string,
    data: T,
    source: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    const event: Event<T> = {
      id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      timestamp: new Date(),
      data,
      source,
      metadata,
    };

    // Store in history
    this.eventHistory.push(event);
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift();
    }

    // Notify type-specific handlers
    const handlers = this.handlers.get(type);
    if (handlers) {
      await this.notifyHandlers(handlers, event);
    }

    // Notify wildcard handlers
    if (this.wildcardHandlers.size > 0) {
      await this.notifyHandlers(this.wildcardHandlers, event);
    }
  }

  /**
   * Emit event synchronously (fire-and-forget)
   */
  emitSync<T = any>(
    type: string,
    data: T,
    source: string,
    metadata?: Record<string, any>
  ): void {
    this.emit(type, data, source, metadata).catch((error) => {
      console.error(`Error in event handler for ${type}:`, error);
    });
  }

  /**
   * Get event history with optional filtering
   */
  getHistory(filter?: EventFilter): Event[] {
    let events = [...this.eventHistory];

    if (filter) {
      if (filter.types && filter.types.length > 0) {
        events = events.filter((e) => filter.types!.includes(e.type));
      }

      if (filter.sources && filter.sources.length > 0) {
        events = events.filter((e) => filter.sources!.includes(e.source));
      }

      if (filter.since) {
        events = events.filter((e) => e.timestamp >= filter.since!);
      }

      if (filter.until) {
        events = events.filter((e) => e.timestamp <= filter.until!);
      }
    }

    return events;
  }

  /**
   * Replay events to a specific handler
   */
  async replay(handler: EventHandler, filter?: EventFilter): Promise<void> {
    const events = this.getHistory(filter);
    for (const event of events) {
      await handler(event);
    }
  }

  /**
   * Clear event history
   */
  clearHistory(): void {
    this.eventHistory = [];
  }

  /**
   * Get current subscriber count
   */
  getSubscriberCount(eventType?: string): number {
    if (!eventType) {
      let total = this.wildcardHandlers.size;
      for (const handlers of this.handlers.values()) {
        total += handlers.size;
      }
      return total;
    }

    if (eventType === '*') {
      return this.wildcardHandlers.size;
    }

    return this.handlers.get(eventType)?.size || 0;
  }

  /**
   * Get all registered event types
   */
  getEventTypes(): string[] {
    return Array.from(this.handlers.keys());
  }

  /**
   * Clear all subscriptions
   */
  clear(): void {
    this.handlers.clear();
    this.wildcardHandlers.clear();
  }

  private async notifyHandlers(
    handlers: Set<EventHandler>,
    event: Event
  ): Promise<void> {
    const promises: Promise<void>[] = [];

    for (const handler of handlers) {
      promises.push(
        (async () => {
          try {
            await handler(event);
          } catch (error) {
            console.error(
              `Error in event handler for ${event.type}:`,
              error
            );
          }
        })()
      );
    }

    await Promise.all(promises);
  }
}

/**
 * Singleton instance
 */
export const eventBus = new EventBus();

/**
 * Standard event types used throughout the application
 */
export const EventTypes = {
  // Agent events
  AGENT_STARTED: 'agent.started',
  AGENT_STOPPED: 'agent.stopped',
  AGENT_ERROR: 'agent.error',
  AGENT_ITERATION: 'agent.iteration',

  // Tool events
  TOOL_EXECUTED: 'tool.executed',
  TOOL_ERROR: 'tool.error',

  // File events
  FILE_READ: 'file.read',
  FILE_WRITTEN: 'file.written',
  FILE_DELETED: 'file.deleted',

  // Security events
  PERMISSION_REQUESTED: 'security.permission_requested',
  PERMISSION_GRANTED: 'security.permission_granted',
  PERMISSION_DENIED: 'security.permission_denied',
  SECRET_DETECTED: 'security.secret_detected',

  // Cost events
  COST_UPDATED: 'cost.updated',
  QUOTA_WARNING: 'cost.quota_warning',
  QUOTA_EXCEEDED: 'cost.quota_exceeded',

  // Error events
  ERROR_OCCURRED: 'error.occurred',
  ERROR_RECOVERED: 'error.recovered',

  // Configuration events
  CONFIG_LOADED: 'config.loaded',
  CONFIG_UPDATED: 'config.updated',
} as const;
