/**
 * Webhook Management System
 * Webhook registration, delivery, retry logic, and signature verification
 */
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
    retryDelays: number[];
    timeout: number;
    signatureHeader: string;
}
/**
 * Webhook Manager
 */
export declare class WebhookManager {
    private webhooks;
    private deliveries;
    private config;
    constructor();
    /**
     * Register webhook
     */
    register(url: string, events: string[], metadata?: Record<string, any>): Webhook;
    /**
     * Unregister webhook
     */
    unregister(webhookId: string): void;
    /**
     * Update webhook
     */
    update(webhookId: string, updates: Partial<Pick<Webhook, 'url' | 'events' | 'active' | 'metadata'>>): Webhook;
    /**
     * Get webhook
     */
    getWebhook(webhookId: string): Webhook | undefined;
    /**
     * List webhooks
     */
    listWebhooks(filter?: {
        active?: boolean;
        event?: string;
    }): Webhook[];
    /**
     * Deliver event to webhooks
     */
    private deliverEvent;
    /**
     * Create delivery
     */
    private createDelivery;
    /**
     * Attempt delivery
     */
    private attemptDelivery;
    /**
     * Retry failed delivery
     */
    retryDelivery(deliveryId: string): Promise<void>;
    /**
     * Get delivery
     */
    getDelivery(deliveryId: string): WebhookDelivery | undefined;
    /**
     * List deliveries
     */
    listDeliveries(filter?: {
        webhookId?: string;
        status?: WebhookDelivery['status'];
        limit?: number;
    }): WebhookDelivery[];
    /**
     * Get webhook statistics
     */
    getStats(webhookId?: string): {
        totalDeliveries: number;
        successful: number;
        failed: number;
        pending: number;
        successRate: number;
    };
    /**
     * Verify webhook signature
     */
    verifySignature(payload: any, signature: string, secret: string): boolean;
    /**
     * Generate signature
     */
    private generateSignature;
    /**
     * Mock HTTP request
     */
    private sendRequest;
    private generateWebhookId;
    private generateDeliveryId;
    private generateSecret;
    /**
     * Configure webhook system
     */
    configure(config: Partial<WebhookConfig>): void;
}
/**
 * Webhook Event Emitter
 */
export declare class WebhookEventEmitter {
    private webhookManager;
    constructor(webhookManager: WebhookManager);
    /**
     * Emit custom webhook event
     */
    emit(event: string, payload: any): Promise<void>;
}
/**
 * Webhook Receiver - for receiving webhooks from external services
 */
export declare class WebhookReceiver {
    private handlers;
    /**
     * Register webhook handler
     */
    on(event: string, handler: WebhookHandler): void;
    /**
     * Handle incoming webhook
     */
    handle(event: string, payload: any, signature?: string, secret?: string): Promise<WebhookHandlerResult>;
    /**
     * Verify signature
     */
    private verifySignature;
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
export declare class WebhookTestUtils {
    /**
     * Create test webhook
     */
    static createTestWebhook(manager: WebhookManager): Webhook;
    /**
     * Trigger test delivery
     */
    static triggerTestDelivery(manager: WebhookManager, webhookId: string): Promise<void>;
    /**
     * Get delivery logs for webhook
     */
    static getDeliveryLogs(manager: WebhookManager, webhookId: string): WebhookDelivery[];
}
/**
 * Webhook Templates
 */
export declare class WebhookTemplates {
    /**
     * Get common webhook configurations
     */
    static getTemplates(): Record<string, {
        events: string[];
        description: string;
    }>;
    /**
     * Create webhook from template
     */
    static createFromTemplate(manager: WebhookManager, template: string, url: string): Webhook;
}
/**
 * Singleton instances
 */
export declare const webhookManager: WebhookManager;
export declare const webhookEventEmitter: WebhookEventEmitter;
export declare const webhookReceiver: WebhookReceiver;
export {};
//# sourceMappingURL=WebhookSystem.d.ts.map