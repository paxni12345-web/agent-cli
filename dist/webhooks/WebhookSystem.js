"use strict";
/**
 * Webhook Management System
 * Webhook registration, delivery, retry logic, and signature verification
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.webhookReceiver = exports.webhookEventEmitter = exports.webhookManager = exports.WebhookTemplates = exports.WebhookTestUtils = exports.WebhookReceiver = exports.WebhookEventEmitter = exports.WebhookManager = void 0;
const crypto = __importStar(require("crypto"));
const EventBus_1 = require("../core/EventBus");
/**
 * Webhook Manager
 */
class WebhookManager {
    webhooks = new Map();
    deliveries = new Map();
    config = {
        maxAttempts: 5,
        retryDelays: [1000, 5000, 15000, 60000, 300000], // 1s, 5s, 15s, 1m, 5m
        timeout: 10000,
        signatureHeader: 'X-Webhook-Signature',
    };
    constructor() {
        // Subscribe to all events for webhook delivery
        EventBus_1.eventBus.on('*', async (event) => {
            await this.deliverEvent(event.type, event.data);
        });
    }
    /**
     * Register webhook
     */
    register(url, events, metadata) {
        const webhook = {
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
        EventBus_1.eventBus.emitSync('webhook.registered', webhook, 'WebhookManager');
        return webhook;
    }
    /**
     * Unregister webhook
     */
    unregister(webhookId) {
        this.webhooks.delete(webhookId);
        EventBus_1.eventBus.emitSync('webhook.unregistered', { webhookId }, 'WebhookManager');
    }
    /**
     * Update webhook
     */
    update(webhookId, updates) {
        const webhook = this.webhooks.get(webhookId);
        if (!webhook) {
            throw new Error(`Webhook not found: ${webhookId}`);
        }
        Object.assign(webhook, updates, { updatedAt: new Date() });
        EventBus_1.eventBus.emitSync('webhook.updated', webhook, 'WebhookManager');
        return webhook;
    }
    /**
     * Get webhook
     */
    getWebhook(webhookId) {
        return this.webhooks.get(webhookId);
    }
    /**
     * List webhooks
     */
    listWebhooks(filter) {
        let webhooks = Array.from(this.webhooks.values());
        if (filter?.active !== undefined) {
            webhooks = webhooks.filter(w => w.active === filter.active);
        }
        if (filter?.event) {
            webhooks = webhooks.filter(w => w.events.includes(filter.event));
        }
        return webhooks;
    }
    /**
     * Deliver event to webhooks
     */
    async deliverEvent(eventType, payload) {
        const webhooks = this.listWebhooks({ active: true, event: eventType });
        for (const webhook of webhooks) {
            const delivery = this.createDelivery(webhook, eventType, payload);
            await this.attemptDelivery(delivery);
        }
    }
    /**
     * Create delivery
     */
    createDelivery(webhook, event, payload) {
        const delivery = {
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
    async attemptDelivery(delivery) {
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
                EventBus_1.eventBus.emitSync('webhook.delivered', delivery, 'WebhookManager');
            }
            else {
                throw new Error(`HTTP ${response.status}: ${response.body}`);
            }
        }
        catch (error) {
            delivery.error = error instanceof Error ? error.message : String(error);
            if (delivery.attempts < delivery.maxAttempts) {
                // Schedule retry
                const retryDelay = this.config.retryDelays[delivery.attempts - 1] ||
                    this.config.retryDelays[this.config.retryDelays.length - 1];
                delivery.nextRetryAt = new Date(Date.now() + retryDelay);
                setTimeout(() => {
                    this.attemptDelivery(delivery);
                }, retryDelay);
            }
            else {
                delivery.status = 'failed';
                EventBus_1.eventBus.emitSync('webhook.failed', delivery, 'WebhookManager');
            }
        }
    }
    /**
     * Retry failed delivery
     */
    async retryDelivery(deliveryId) {
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
    getDelivery(deliveryId) {
        return this.deliveries.get(deliveryId);
    }
    /**
     * List deliveries
     */
    listDeliveries(filter) {
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
    getStats(webhookId) {
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
    verifySignature(payload, signature, secret) {
        const expectedSignature = this.generateSignature(payload, secret);
        return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
    }
    /**
     * Generate signature
     */
    generateSignature(payload, secret) {
        const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload);
        return crypto
            .createHmac('sha256', secret)
            .update(payloadString)
            .digest('hex');
    }
    /**
     * Mock HTTP request
     */
    async sendRequest(url, options) {
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
        }
        else {
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
    generateWebhookId() {
        return `webhook_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
    generateDeliveryId() {
        return `delivery_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
    generateSecret() {
        return crypto.randomBytes(32).toString('hex');
    }
    /**
     * Configure webhook system
     */
    configure(config) {
        this.config = { ...this.config, ...config };
    }
}
exports.WebhookManager = WebhookManager;
/**
 * Webhook Event Emitter
 */
class WebhookEventEmitter {
    webhookManager;
    constructor(webhookManager) {
        this.webhookManager = webhookManager;
    }
    /**
     * Emit custom webhook event
     */
    async emit(event, payload) {
        await this.webhookManager['deliverEvent'](event, payload);
    }
}
exports.WebhookEventEmitter = WebhookEventEmitter;
/**
 * Webhook Receiver - for receiving webhooks from external services
 */
class WebhookReceiver {
    handlers = new Map();
    /**
     * Register webhook handler
     */
    on(event, handler) {
        if (!this.handlers.has(event)) {
            this.handlers.set(event, []);
        }
        this.handlers.get(event).push(handler);
    }
    /**
     * Handle incoming webhook
     */
    async handle(event, payload, signature, secret) {
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
        const results = await Promise.allSettled(handlers.map(handler => handler(payload)));
        const failures = results.filter(r => r.status === 'rejected');
        if (failures.length > 0) {
            return {
                success: false,
                error: `${failures.length} handler(s) failed`,
                details: failures.map(f => f.reason),
            };
        }
        return {
            success: true,
            results: results.map(r => r.value),
        };
    }
    /**
     * Verify signature
     */
    verifySignature(payload, signature, secret) {
        const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload);
        const expectedSignature = crypto
            .createHmac('sha256', secret)
            .update(payloadString)
            .digest('hex');
        return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
    }
}
exports.WebhookReceiver = WebhookReceiver;
/**
 * Webhook Testing Utilities
 */
class WebhookTestUtils {
    /**
     * Create test webhook
     */
    static createTestWebhook(manager) {
        return manager.register('https://example.com/webhook', ['test.event'], { test: true });
    }
    /**
     * Trigger test delivery
     */
    static async triggerTestDelivery(manager, webhookId) {
        EventBus_1.eventBus.emitSync('test.event', { message: 'Test webhook delivery' }, 'WebhookTestUtils');
    }
    /**
     * Get delivery logs for webhook
     */
    static getDeliveryLogs(manager, webhookId) {
        return manager.listDeliveries({ webhookId });
    }
}
exports.WebhookTestUtils = WebhookTestUtils;
/**
 * Webhook Templates
 */
class WebhookTemplates {
    /**
     * Get common webhook configurations
     */
    static getTemplates() {
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
    static createFromTemplate(manager, template, url) {
        const templates = this.getTemplates();
        const config = templates[template];
        if (!config) {
            throw new Error(`Template not found: ${template}`);
        }
        return manager.register(url, config.events, { template });
    }
}
exports.WebhookTemplates = WebhookTemplates;
/**
 * Singleton instances
 */
exports.webhookManager = new WebhookManager();
exports.webhookEventEmitter = new WebhookEventEmitter(exports.webhookManager);
exports.webhookReceiver = new WebhookReceiver();
