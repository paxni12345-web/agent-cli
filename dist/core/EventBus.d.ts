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
export declare class EventBus {
    private handlers;
    private wildcardHandlers;
    private eventHistory;
    private maxHistorySize;
    private subscriptionCounter;
    /**
     * Subscribe to specific event types
     */
    on<T = any>(eventType: string, handler: EventHandler<T>): EventSubscription;
    /**
     * Unsubscribe handler from event type
     */
    off(eventType: string, handler: EventHandler): void;
    /**
     * Emit an event to all subscribers
     */
    emit<T = any>(type: string, data: T, source: string, metadata?: Record<string, any>): Promise<void>;
    /**
     * Emit event synchronously (fire-and-forget)
     */
    emitSync<T = any>(type: string, data: T, source: string, metadata?: Record<string, any>): void;
    /**
     * Get event history with optional filtering
     */
    getHistory(filter?: EventFilter): Event[];
    /**
     * Replay events to a specific handler
     */
    replay(handler: EventHandler, filter?: EventFilter): Promise<void>;
    /**
     * Clear event history
     */
    clearHistory(): void;
    /**
     * Get current subscriber count
     */
    getSubscriberCount(eventType?: string): number;
    /**
     * Get all registered event types
     */
    getEventTypes(): string[];
    /**
     * Clear all subscriptions
     */
    clear(): void;
    private notifyHandlers;
}
/**
 * Singleton instance
 */
export declare const eventBus: EventBus;
/**
 * Standard event types used throughout the application
 */
export declare const EventTypes: {
    readonly AGENT_STARTED: "agent.started";
    readonly AGENT_STOPPED: "agent.stopped";
    readonly AGENT_ERROR: "agent.error";
    readonly AGENT_ITERATION: "agent.iteration";
    readonly TOOL_EXECUTED: "tool.executed";
    readonly TOOL_ERROR: "tool.error";
    readonly FILE_READ: "file.read";
    readonly FILE_WRITTEN: "file.written";
    readonly FILE_DELETED: "file.deleted";
    readonly PERMISSION_REQUESTED: "security.permission_requested";
    readonly PERMISSION_GRANTED: "security.permission_granted";
    readonly PERMISSION_DENIED: "security.permission_denied";
    readonly SECRET_DETECTED: "security.secret_detected";
    readonly COST_UPDATED: "cost.updated";
    readonly QUOTA_WARNING: "cost.quota_warning";
    readonly QUOTA_EXCEEDED: "cost.quota_exceeded";
    readonly ERROR_OCCURRED: "error.occurred";
    readonly ERROR_RECOVERED: "error.recovered";
    readonly CONFIG_LOADED: "config.loaded";
    readonly CONFIG_UPDATED: "config.updated";
};
//# sourceMappingURL=EventBus.d.ts.map