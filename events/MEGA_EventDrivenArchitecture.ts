/**
 * MEGA Event-Driven Architecture with Comprehensive Cleanup
 * Implements proper resource management for event systems
 */

type EventHandler<T = any> = (data: T) => void | Promise<void>;
type Unsubscribe = () => void;

interface EventSubscription {
  id: string;
  eventName: string;
  handler: EventHandler;
  once: boolean;
  priority: number;
}

interface QueuedEvent {
  eventName: string;
  data: any;
  timestamp: number;
}

interface WebSocketConnection {
  ws: WebSocket | null;
  reconnectTimer?: NodeJS.Timeout;
  pingInterval?: NodeJS.Timeout;
  url: string;
}

interface TimerReference {
  id: NodeJS.Timeout;
  type: 'timeout' | 'interval';
  callback: Function;
}

/**
 * Main Event Bus with comprehensive cleanup
 */
export class EventBus {
  private listeners: Map<string, Set<EventSubscription>> = new Map();
  private subscriptionCounter: number = 0;
  private eventQueue: QueuedEvent[] = [];
  private isProcessingQueue: boolean = false;
  private queueProcessingTimer?: NodeJS.Timeout;
  private timers: Map<string, TimerReference> = new Map();
  private websockets: Map<string, WebSocketConnection> = new Map();
  private messageQueues: Map<string, QueuedEvent[]> = new Map();
  private maxQueueSize: number = 1000;
  private isShuttingDown: boolean = false;

  /**
   * Subscribe to an event
   */
  public on(eventName: string, handler: EventHandler, priority: number = 0): Unsubscribe {
    if (this.isShuttingDown) {
      throw new Error('EventBus is shutting down, cannot add new listeners');
    }

    const subscription: EventSubscription = {
      id: `sub_${++this.subscriptionCounter}`,
      eventName,
      handler,
      once: false,
      priority,
    };

    this.addSubscription(eventName, subscription);

    // Return unsubscribe function
    return () => this.removeSubscription(eventName, subscription.id);
  }

  /**
   * Subscribe to an event (one-time only)
   */
  public once(eventName: string, handler: EventHandler, priority: number = 0): Unsubscribe {
    if (this.isShuttingDown) {
      throw new Error('EventBus is shutting down, cannot add new listeners');
    }

    const subscription: EventSubscription = {
      id: `sub_${++this.subscriptionCounter}`,
      eventName,
      handler,
      once: true,
      priority,
    };

    this.addSubscription(eventName, subscription);

    return () => this.removeSubscription(eventName, subscription.id);
  }

  /**
   * Emit an event
   */
  public async emit(eventName: string, data?: any): Promise<void> {
    if (this.isShuttingDown) {
      console.warn(`EventBus is shutting down, event "${eventName}" will not be emitted`);
      return;
    }

    const listeners = this.listeners.get(eventName);
    if (!listeners || listeners.size === 0) {
      return;
    }

    // Sort by priority (higher priority first)
    const sortedListeners = Array.from(listeners).sort((a, b) => b.priority - a.priority);

    const handlersToRemove: string[] = [];

    for (const subscription of sortedListeners) {
      try {
        await subscription.handler(data);

        if (subscription.once) {
          handlersToRemove.push(subscription.id);
        }
      } catch (error) {
        console.error(`Error in event handler for "${eventName}":`, error);
      }
    }

    // Remove one-time handlers
    handlersToRemove.forEach(id => this.removeSubscription(eventName, id));
  }

  /**
   * Queue an event for deferred processing
   */
  public queueEvent(eventName: string, data?: any): void {
    if (this.isShuttingDown) {
      console.warn(`EventBus is shutting down, event "${eventName}" will not be queued`);
      return;
    }

    if (this.eventQueue.length >= this.maxQueueSize) {
      console.warn(`Event queue is full (${this.maxQueueSize}), dropping oldest event`);
      this.eventQueue.shift();
    }

    this.eventQueue.push({
      eventName,
      data,
      timestamp: Date.now(),
    });

    this.scheduleQueueProcessing();
  }

  /**
   * Process queued events
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.eventQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    while (this.eventQueue.length > 0 && !this.isShuttingDown) {
      const event = this.eventQueue.shift();
      if (event) {
        await this.emit(event.eventName, event.data);
      }
    }

    this.isProcessingQueue = false;
  }

  /**
   * Schedule queue processing
   */
  private scheduleQueueProcessing(): void {
    if (this.queueProcessingTimer) {
      return;
    }

    this.queueProcessingTimer = setTimeout(() => {
      this.queueProcessingTimer = undefined;
      this.processQueue();
    }, 0);
  }

  /**
   * Drain event queue (process all pending events)
   */
  public async drainQueue(): Promise<void> {
    if (this.queueProcessingTimer) {
      clearTimeout(this.queueProcessingTimer);
      this.queueProcessingTimer = undefined;
    }

    await this.processQueue();
  }

  /**
   * Remove all listeners for an event
   */
  public removeAllListeners(eventName?: string): void {
    if (eventName) {
      const listeners = this.listeners.get(eventName);
      if (listeners) {
        listeners.clear();
        this.listeners.delete(eventName);
      }
    } else {
      this.listeners.clear();
    }
  }

  /**
   * Get listener count for an event
   */
  public listenerCount(eventName: string): number {
    const listeners = this.listeners.get(eventName);
    return listeners ? listeners.size : 0;
  }

  /**
   * Add a subscription
   */
  private addSubscription(eventName: string, subscription: EventSubscription): void {
    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, new Set());
    }
    this.listeners.get(eventName)!.add(subscription);
  }

  /**
   * Remove a subscription
   */
  private removeSubscription(eventName: string, subscriptionId: string): void {
    const listeners = this.listeners.get(eventName);
    if (!listeners) {
      return;
    }

    for (const subscription of listeners) {
      if (subscription.id === subscriptionId) {
        listeners.delete(subscription);
        break;
      }
    }

    if (listeners.size === 0) {
      this.listeners.delete(eventName);
    }
  }

  /**
   * Register a timer for cleanup tracking
   */
  public registerTimeout(callback: Function, delay: number): NodeJS.Timeout {
    const id = setTimeout(() => {
      this.timers.delete(timerId);
      callback();
    }, delay);

    const timerId = `timer_${Date.now()}_${Math.random()}`;
    this.timers.set(timerId, { id, type: 'timeout', callback });

    return id;
  }

  /**
   * Register an interval for cleanup tracking
   */
  public registerInterval(callback: Function, interval: number): NodeJS.Timeout {
    const id = setInterval(callback, interval);

    const timerId = `interval_${Date.now()}_${Math.random()}`;
    this.timers.set(timerId, { id, type: 'interval', callback });

    return id;
  }

  /**
   * Clear a specific timer
   */
  public clearTimer(timerId: NodeJS.Timeout): void {
    for (const [key, timer] of this.timers.entries()) {
      if (timer.id === timerId) {
        if (timer.type === 'timeout') {
          clearTimeout(timer.id);
        } else {
          clearInterval(timer.id);
        }
        this.timers.delete(key);
        break;
      }
    }
  }

  /**
   * Clear all timers
   */
  private clearAllTimers(): void {
    for (const [key, timer] of this.timers.entries()) {
      if (timer.type === 'timeout') {
        clearTimeout(timer.id);
      } else {
        clearInterval(timer.id);
      }
    }
    this.timers.clear();
  }

  /**
   * Connect to WebSocket with automatic reconnection
   */
  public connectWebSocket(name: string, url: string, autoReconnect: boolean = true): void {
    if (this.websockets.has(name)) {
      this.disconnectWebSocket(name);
    }

    const connection: WebSocketConnection = {
      ws: null,
      url,
    };

    this.websockets.set(name, connection);
    this.establishWebSocketConnection(name, autoReconnect);
  }

  /**
   * Establish WebSocket connection
   */
  private establishWebSocketConnection(name: string, autoReconnect: boolean): void {
    const connection = this.websockets.get(name);
    if (!connection || this.isShuttingDown) {
      return;
    }

    try {
      connection.ws = new WebSocket(connection.url);

      connection.ws.onopen = () => {
        this.emit(`ws:${name}:open`, { name });

        // Start ping interval
        connection.pingInterval = setInterval(() => {
          if (connection.ws && connection.ws.readyState === WebSocket.OPEN) {
            connection.ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, 30000);
      };

      connection.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.emit(`ws:${name}:message`, data);
        } catch (error) {
          console.error(`Failed to parse WebSocket message for "${name}":`, error);
        }
      };

      connection.ws.onerror = (error) => {
        this.emit(`ws:${name}:error`, { name, error });
      };

      connection.ws.onclose = () => {
        if (connection.pingInterval) {
          clearInterval(connection.pingInterval);
          connection.pingInterval = undefined;
        }

        this.emit(`ws:${name}:close`, { name });

        if (autoReconnect && !this.isShuttingDown) {
          connection.reconnectTimer = setTimeout(() => {
            this.establishWebSocketConnection(name, autoReconnect);
          }, 5000);
        }
      };
    } catch (error) {
      console.error(`Failed to establish WebSocket connection for "${name}":`, error);

      if (autoReconnect && !this.isShuttingDown) {
        connection.reconnectTimer = setTimeout(() => {
          this.establishWebSocketConnection(name, autoReconnect);
        }, 5000);
      }
    }
  }

  /**
   * Disconnect WebSocket
   */
  public disconnectWebSocket(name: string): void {
    const connection = this.websockets.get(name);
    if (!connection) {
      return;
    }

    if (connection.reconnectTimer) {
      clearTimeout(connection.reconnectTimer);
      connection.reconnectTimer = undefined;
    }

    if (connection.pingInterval) {
      clearInterval(connection.pingInterval);
      connection.pingInterval = undefined;
    }

    if (connection.ws) {
      connection.ws.close();
      connection.ws = null;
    }

    this.websockets.delete(name);
  }

  /**
   * Send message through WebSocket
   */
  public sendWebSocketMessage(name: string, data: any): void {
    const connection = this.websockets.get(name);
    if (!connection || !connection.ws || connection.ws.readyState !== WebSocket.OPEN) {
      console.warn(`WebSocket "${name}" is not connected`);
      return;
    }

    connection.ws.send(JSON.stringify(data));
  }

  /**
   * Add message to a named queue
   */
  public enqueueMessage(queueName: string, eventName: string, data: any): void {
    if (!this.messageQueues.has(queueName)) {
      this.messageQueues.set(queueName, []);
    }

    const queue = this.messageQueues.get(queueName)!;

    if (queue.length >= this.maxQueueSize) {
      console.warn(`Message queue "${queueName}" is full, dropping oldest message`);
      queue.shift();
    }

    queue.push({ eventName, data, timestamp: Date.now() });
  }

  /**
   * Process messages from a named queue
   */
  public async processMessageQueue(queueName: string): Promise<number> {
    const queue = this.messageQueues.get(queueName);
    if (!queue) {
      return 0;
    }

    let processed = 0;
    while (queue.length > 0 && !this.isShuttingDown) {
      const message = queue.shift();
      if (message) {
        await this.emit(message.eventName, message.data);
        processed++;
      }
    }

    return processed;
  }

  /**
   * Clear a specific message queue
   */
  public clearMessageQueue(queueName: string): void {
    this.messageQueues.delete(queueName);
  }

  /**
   * Clear all message queues
   */
  private clearAllMessageQueues(): void {
    this.messageQueues.clear();
  }

  /**
   * Get memory usage statistics
   */
  public getMemoryStats(): {
    listeners: number;
    eventQueue: number;
    timers: number;
    websockets: number;
    messageQueues: number;
  } {
    let totalListeners = 0;
    for (const listeners of this.listeners.values()) {
      totalListeners += listeners.size;
    }

    let totalQueuedMessages = 0;
    for (const queue of this.messageQueues.values()) {
      totalQueuedMessages += queue.length;
    }

    return {
      listeners: totalListeners,
      eventQueue: this.eventQueue.length,
      timers: this.timers.size,
      websockets: this.websockets.size,
      messageQueues: totalQueuedMessages,
    };
  }

  /**
   * Comprehensive cleanup - call this before destroying the instance
   */
  public async dispose(): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    this.isShuttingDown = true;

    // 1. Drain event queue
    console.log('Draining event queue...');
    await this.drainQueue();

    // 2. Process all message queues
    console.log('Processing message queues...');
    for (const queueName of this.messageQueues.keys()) {
      await this.processMessageQueue(queueName);
    }

    // 3. Clear queue processing timer
    if (this.queueProcessingTimer) {
      clearTimeout(this.queueProcessingTimer);
      this.queueProcessingTimer = undefined;
    }

    // 4. Disconnect all WebSockets
    console.log('Disconnecting WebSockets...');
    for (const name of this.websockets.keys()) {
      this.disconnectWebSocket(name);
    }

    // 5. Clear all timers
    console.log('Clearing timers...');
    this.clearAllTimers();

    // 6. Clear all message queues
    console.log('Clearing message queues...');
    this.clearAllMessageQueues();

    // 7. Remove all listeners
    console.log('Removing all listeners...');
    this.removeAllListeners();

    // 8. Clear event queue
    this.eventQueue = [];

    console.log('EventBus disposed successfully');
  }
}

/**
 * Event Aggregator for cross-module communication
 */
export class EventAggregator {
  private eventBus: EventBus;
  private subscriptions: Map<string, Unsubscribe[]> = new Map();

  constructor(eventBus?: EventBus) {
    this.eventBus = eventBus || new EventBus();
  }

  /**
   * Subscribe with automatic cleanup tracking
   */
  public subscribe(
    moduleId: string,
    eventName: string,
    handler: EventHandler,
    priority?: number
  ): void {
    const unsubscribe = this.eventBus.on(eventName, handler, priority);

    if (!this.subscriptions.has(moduleId)) {
      this.subscriptions.set(moduleId, []);
    }

    this.subscriptions.get(moduleId)!.push(unsubscribe);
  }

  /**
   * Publish event
   */
  public async publish(eventName: string, data?: any): Promise<void> {
    await this.eventBus.emit(eventName, data);
  }

  /**
   * Unsubscribe all listeners for a module
   */
  public unsubscribeModule(moduleId: string): void {
    const unsubscribes = this.subscriptions.get(moduleId);
    if (!unsubscribes) {
      return;
    }

    unsubscribes.forEach(unsubscribe => unsubscribe());
    this.subscriptions.delete(moduleId);
  }

  /**
   * Cleanup all subscriptions
   */
  public async dispose(): Promise<void> {
    for (const moduleId of this.subscriptions.keys()) {
      this.unsubscribeModule(moduleId);
    }

    await this.eventBus.dispose();
  }
}

/**
 * Singleton instance
 */
let globalEventBus: EventBus | null = null;

export function getGlobalEventBus(): EventBus {
  if (!globalEventBus) {
    globalEventBus = new EventBus();
  }
  return globalEventBus;
}

export async function disposeGlobalEventBus(): Promise<void> {
  if (globalEventBus) {
    await globalEventBus.dispose();
    globalEventBus = null;
  }
}
