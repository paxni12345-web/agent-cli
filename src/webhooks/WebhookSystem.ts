/**
 * Webhook Management System
 * Webhook registration, delivery, retry logic, and signature verification
 */

import * as crypto from 'crypto';
import { eventBus } from '../core/EventBus';

export interface Webhook {
  id: string;
  url: string;
  events: string[];
  secret: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, any>;
}

export interface WebhookDelivery {
  id: string;
  webhookId: string;
  event: string;
  payload: any;
  url: string;
  status: 'pending' | 'success' | 'failed' | 'retrying';
  attempts: number;
  maxAttempts: number;
  lastAttemptAt?: Date;
  nextRetryAt?: Date;
  response?: {
    status: number;
    body: string;
    headers: Record<string, string>;
  };
  error?: string;
  createdAt: Date;
}

export interface WebhookConfig {
  maxAttempts: number;
  retryDelays: number[]; // milliseconds
  timeout: number;
  signatureHeader: string;
}

/**
 * Webhook Manager
 */
export class WebhookManager {
  private webhooks: Map<string, Webhook> = new Map();
  private deliveries: Map<string, WebhookDelivery> = new Map();
  private config: WebhookConfig = {
    maxAttempts: 5,
    retryDelays: [1000, 5000, 15000, 60000, 300000], // 1s, 5s, 15s, 1m, 5m
    timeout: 10000,
    signatureHeader: 'X-Webhook-Signature',
  };

  constructor() {
    // Subscribe to all events for webhook delivery
    eventBus.on('*', async (event) => {
      await this.deliverEvent(event.type, event.data);
    });
  }

  /**
   * Register webhook
   */
  register(url: string, events: string[], metadata?: Record<string, any>): Webhook {
    const webhook: Webhook = {
      id: this.generateWebhookId(),
      url,
      events,
      secret: this.generateSecret(),
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata,
    };

    this.webhooks.set(webhook.id, webhook);

    eventBus.emitSync('webhook.registered', webhook, 'WebhookManager');

    return webhook;
  }

  /**
   * Unregister webhook
   */
  unregister(webhookId: string): void {
    this.webhooks.delete(webhookId);
    eventBus.emitSync('webhook.unregistered', { webhookId }, 'WebhookManager');
  }

  /**
   * Update webhook
   */
  update(
    webhookId: string,
    updates: Partial<Pick<Webhook, 'url' | 'events' | 'active' | 'metadata'>>
  ): Webhook {
    const webhook = this.webhooks.get(webhookId);

    if (!webhook) {
      throw new Error(`Webhook not found: ${webhookId}`);
    }

    Object.assign(webhook, updates, { updatedAt: new Date() });

    eventBus.emitSync('webhook.updated', webhook, 'WebhookManager');

    return webhook;
  }

  /**
   * Get webhook
   */
  getWebhook(webhookId: string): Webhook | undefined {
    return this.webhooks.get(webhookId);
  }

  /**
   * List webhooks
   */
  listWebhooks(filter?: { active?: boolean; event?: string }): Webhook[] {
    let webhooks = Array.from(this.webhooks.values());

    if (filter?.active !== undefined) {
      webhooks = webhooks.filter(w => w.active === filter.active);
    }

    if (filter?.event) {
      webhooks = webhooks.filter(w => w.events.includes(filter.event!));
    }

    return webhooks;
  }

  /**
   * Deliver event to webhooks
   */
  private async deliverEvent(eventType: string, payload: any): Promise<void> {
    const webhooks = this.listWebhooks({ active: true, event: eventType });

    for (const webhook of webhooks) {
      const delivery = this.createDelivery(webhook, eventType, payload);
      await this.attemptDelivery(delivery);
    }
  }

  /**
   * Create delivery
   */
  private createDelivery(webhook: Webhook, event: string, payload: any): WebhookDelivery {
    const delivery: WebhookDelivery = {
      id: this.generateDeliveryId(),
      webhookId: webhook.id,
      event,
      payload,
      url: webhook.url,
      status: 'pending',
      attempts: 0,
      maxAttempts: this.config.maxAttempts,
      createdAt: new Date(),
    };

    this.deliveries.set(delivery.id, delivery);

    return delivery;
  }

  /**
   * Attempt delivery
   */
  private async attemptDelivery(delivery: WebhookDelivery): Promise<void> {
    delivery.attempts++;
    delivery.lastAttemptAt = new Date();
    delivery.status = 'retrying';

    try {
      const webhook = this.webhooks.get(delivery.webhookId);

      if (!webhook) {
        delivery.status = 'failed';
        delivery.error = 'Webhook not found';
        return;
      }

      // Generate signature
      const signature = this.generateSignature(delivery.payload, webhook.secret);

      // Mock HTTP request
      const response = await this.sendRequest(delivery.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          [this.config.signatureHeader]: signature,
        },
        body: JSON.stringify({
          event: delivery.event,
          payload: delivery.payload,
          delivery_id: delivery.id,
          timestamp: new Date().toISOString(),
        }),
        timeout: this.config.timeout,
      });

      delivery.response = response;

      if (response.status >= 200 && response.status < 300) {
        delivery.status = 'success';
        eventBus.emitSync('webhook.delivered', delivery, 'WebhookManager');
      } else {
        throw new Error(`HTTP ${response.status}: ${response.body}`);
      }
    } catch (error) {
      delivery.error = error instanceof Error ? error.message : String(error);

      if (delivery.attempts < delivery.maxAttempts) {
        // Schedule retry
        const retryDelay = this.config.retryDelays[delivery.attempts - 1] ||
          this.config.retryDelays[this.config.retryDelays.length - 1];

        delivery.nextRetryAt = new Date(Date.now() + retryDelay);

        setTimeout(() => {
          this.attemptDelivery(delivery);
        }, retryDelay);
      } else {
        delivery.status = 'failed';
        eventBus.emitSync('webhook.failed', delivery, 'WebhookManager');
      }
    }
  }

  /**
   * Retry failed delivery
   */
  async retryDelivery(deliveryId: string): Promise<void> {
    const delivery = this.deliveries.get(deliveryId);

    if (!delivery) {
      throw new Error(`Delivery not found: ${deliveryId}`);
    }

    if (delivery.status === 'success') {
      throw new Error('Delivery already succeeded');
    }

    // Reset attempts
    delivery.attempts = 0;
    delivery.status = 'pending';
    delivery.error = undefined;

    await this.attemptDelivery(delivery);
  }

  /**
   * Get delivery
   */
  getDelivery(deliveryId: string): WebhookDelivery | undefined {
    return this.deliveries.get(deliveryId);
  }

  /**
   * List deliveries
   */
  listDeliveries(filter?: {
    webhookId?: string;
    status?: WebhookDelivery['status'];
    limit?: number;
  }): WebhookDelivery[] {
    let deliveries = Array.from(this.deliveries.values());

    if (filter?.webhookId) {
      deliveries = deliveries.filter(d => d.webhookId === filter.webhookId);
    }

    if (filter?.status) {
      deliveries = deliveries.filter(d => d.status === filter.status);
    }

    deliveries.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    if (filter?.limit) {
      deliveries = deliveries.slice(0, filter.limit);
    }

    return deliveries;
  }

  /**
   * Get webhook statistics
   */
  getStats(webhookId?: string): {
    totalDeliveries: number;
    successful: number;
    failed: number;
    pending: number;
    successRate: number;
  } {
    let deliveries = Array.from(this.deliveries.values());

    if (webhookId) {
      deliveries = deliveries.filter(d => d.webhookId === webhookId);
    }

    const successful = deliveries.filter(d => d.status === 'success').length;
    const failed = deliveries.filter(d => d.status === 'failed').length;
    const pending = deliveries.filter(d => d.status === 'pending' || d.status === 'retrying').length;

    return {
      totalDeliveries: deliveries.length,
      successful,
      failed,
      pending,
      successRate: deliveries.length > 0 ? successful / deliveries.length : 0,
    };
  }

  /**
   * Verify webhook signature
   */
  verifySignature(payload: any, signature: string, secret: string): boolean {
    const expectedSignature = this.generateSignature(payload, secret);
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }

  /**
   * Generate signature
   */
  private generateSignature(payload: any, secret: string): string {
    const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload);
    return crypto
      .createHmac('sha256', secret)
      .update(payloadString)
      .digest('hex');
  }

  /**
   * Mock HTTP request
   */
  private async sendRequest(
    url: string,
    options: {
      method: string;
      headers: Record<string, string>;
      body: string;
      timeout: number;
    }
  ): Promise<{
    status: number;
    body: string;
    headers: Record<string, string>;
  }> {
    // Mock implementation
    console.log(`Webhook delivery to ${url}:`, options);

    // Simulate random success/failure
    const success = Math.random() > 0.2; // 80% success rate

    if (success) {
      return {
        status: 200,
        body: JSON.stringify({ success: true }),
        headers: { 'content-type': 'application/json' },
      };
    } else {
      throw new Error('Connection timeout');
    }

    // In production: use fetch or axios
    /*
    const response = await fetch(url, {
      method: options.method,
      headers: options.headers,
      body: options.body,
      signal: AbortSignal.timeout(options.timeout),
    });

    return {
      status: response.status,
      body: await response.text(),
      headers: Object.fromEntries(response.headers.entries()),
    };
    */
  }

  private generateWebhookId(): string {
    return `webhook_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  private generateDeliveryId(): string {
    return `delivery_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  private generateSecret(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Configure webhook system
   */
  configure(config: Partial<WebhookConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

/**
 * Webhook Event Emitter
 */
export class WebhookEventEmitter {
  constructor(private webhookManager: WebhookManager) {}

  /**
   * Emit custom webhook event
   */
  async emit(event: string, payload: any): Promise<void> {
    await this.webhookManager['deliverEvent'](event, payload);
  }
}

/**
 * Webhook Receiver - for receiving webhooks from external services
 */
export class WebhookReceiver {
  private handlers: Map<string, WebhookHandler[]> = new Map();

  /**
   * Register webhook handler
   */
  on(event: string, handler: WebhookHandler): void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, []);
    }

    this.handlers.get(event)!.push(handler);
  }

  /**
   * Handle incoming webhook
   */
  async handle(
    event: string,
    payload: any,
    signature?: string,
    secret?: string
  ): Promise<WebhookHandlerResult> {
    // Verify signature if provided
    if (signature && secret) {
      const valid = this.verifySignature(payload, signature, secret);
      if (!valid) {
        return {
          success: false,
          error: 'Invalid signature',
        };
      }
    }

    const handlers = this.handlers.get(event) || [];

    if (handlers.length === 0) {
      return {
        success: false,
        error: `No handlers registered for event: ${event}`,
      };
    }

    const results = await Promise.allSettled(
      handlers.map(handler => handler(payload))
    );

    const failures = results.filter(r => r.status === 'rejected');

    if (failures.length > 0) {
      return {
        success: false,
        error: `${failures.length} handler(s) failed`,
        details: failures.map(f => (f as PromiseRejectedResult).reason),
      };
    }

    return {
      success: true,
      results: results.map(r => (r as PromiseFulfilledResult<any>).value),
    };
  }

  /**
   * Verify signature
   */
  private verifySignature(payload: any, signature: string, secret: string): boolean {
    const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payloadString)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }
}

type WebhookHandler = (payload: any) => Promise<any>;

interface WebhookHandlerResult {
  success: boolean;
  error?: string;
  details?: any[];
  results?: any[];
}

/**
 * Webhook Testing Utilities
 */
export class WebhookTestUtils {
  /**
   * Create test webhook
   */
  static createTestWebhook(manager: WebhookManager): Webhook {
    return manager.register(
      'https://example.com/webhook',
      ['test.event'],
      { test: true }
    );
  }

  /**
   * Trigger test delivery
   */
  static async triggerTestDelivery(
    manager: WebhookManager,
    webhookId: string
  ): Promise<void> {
    eventBus.emitSync('test.event', { message: 'Test webhook delivery' }, 'WebhookTestUtils');
  }

  /**
   * Get delivery logs for webhook
   */
  static getDeliveryLogs(
    manager: WebhookManager,
    webhookId: string
  ): WebhookDelivery[] {
    return manager.listDeliveries({ webhookId });
  }
}

/**
 * Webhook Templates
 */
export class WebhookTemplates {
  /**
   * Get common webhook configurations
   */
  static getTemplates(): Record<string, { events: string[]; description: string }> {
    return {
      'all-events': {
        events: ['*'],
        description: 'Receive all events',
      },
      'user-events': {
        events: ['user.created', 'user.updated', 'user.deleted'],
        description: 'User lifecycle events',
      },
      'task-events': {
        events: ['task.started', 'task.completed', 'task.failed'],
        description: 'Task execution events',
      },
      'error-events': {
        events: ['error.occurred', 'error.critical'],
        description: 'Error and critical events',
      },
      'deployment-events': {
        events: ['deployment.started', 'deployment.completed', 'deployment.failed'],
        description: 'Deployment lifecycle events',
      },
    };
  }

  /**
   * Create webhook from template
   */
  static createFromTemplate(
    manager: WebhookManager,
    template: string,
    url: string
  ): Webhook {
    const templates = this.getTemplates();
    const config = templates[template];

    if (!config) {
      throw new Error(`Template not found: ${template}`);
    }

    return manager.register(url, config.events, { template });
  }
}

/**
 * Singleton instances
 */
export const webhookManager = new WebhookManager();
export const webhookEventEmitter = new WebhookEventEmitter(webhookManager);
export const webhookReceiver = new WebhookReceiver();
