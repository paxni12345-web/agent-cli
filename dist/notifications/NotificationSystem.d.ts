/**
 * Notification System
 * Multi-channel notifications: email, Slack, Discord, webhooks, push notifications
 */
export interface Notification {
    id: string;
    type: 'info' | 'success' | 'warning' | 'error';
    title: string;
    message: string;
    timestamp: Date;
    channels: NotificationChannel[];
    metadata?: Record<string, any>;
    read?: boolean;
}
export type NotificationChannel = 'email' | 'slack' | 'discord' | 'webhook' | 'push' | 'sms';
export interface NotificationConfig {
    channels: NotificationChannel[];
    email?: EmailConfig;
    slack?: SlackConfig;
    discord?: DiscordConfig;
    webhook?: WebhookConfig;
    push?: PushConfig;
    sms?: SMSConfig;
}
export interface EmailConfig {
    smtp: {
        host: string;
        port: number;
        secure: boolean;
        auth: {
            user: string;
            pass: string;
        };
    };
    from: string;
    to: string[];
}
export interface SlackConfig {
    webhookUrl: string;
    channel?: string;
    username?: string;
    iconEmoji?: string;
}
export interface DiscordConfig {
    webhookUrl: string;
    username?: string;
    avatarUrl?: string;
}
export interface WebhookConfig {
    url: string;
    method: 'GET' | 'POST';
    headers?: Record<string, string>;
    retries?: number;
}
export interface PushConfig {
    serviceKey: string;
    deviceTokens: string[];
}
export interface SMSConfig {
    provider: 'twilio' | 'aws-sns';
    accountSid?: string;
    authToken?: string;
    from: string;
    to: string[];
}
export interface NotificationRule {
    id: string;
    name: string;
    eventType: string;
    condition?: (event: any) => boolean;
    channels: NotificationChannel[];
    template?: string;
    priority: 'low' | 'medium' | 'high' | 'urgent';
    enabled: boolean;
}
/**
 * Notification Manager
 */
export declare class NotificationManager {
    private notifications;
    private rules;
    private config?;
    private providers;
    /**
     * Configure notification system
     */
    configure(config: NotificationConfig): void;
    /**
     * Send notification
     */
    send(notification: Omit<Notification, 'id' | 'timestamp'>): Promise<Notification>;
    /**
     * Add notification rule
     */
    addRule(rule: NotificationRule): void;
    /**
     * Remove notification rule
     */
    removeRule(ruleId: string): void;
    /**
     * Enable/disable rule
     */
    toggleRule(ruleId: string, enabled: boolean): void;
    /**
     * Get notification by ID
     */
    getNotification(id: string): Notification | undefined;
    /**
     * List notifications
     */
    listNotifications(filter?: {
        type?: Notification['type'];
        unreadOnly?: boolean;
        limit?: number;
    }): Notification[];
    /**
     * Mark notification as read
     */
    markAsRead(id: string): void;
    /**
     * Mark all as read
     */
    markAllAsRead(): void;
    /**
     * Clear old notifications
     */
    clearOld(olderThanDays: number): number;
    /**
     * Get notification stats
     */
    getStats(): {
        total: number;
        unread: number;
        byType: Record<string, number>;
        byChannel: Record<string, number>;
    };
    private generateNotificationId;
    private applyTemplate;
    private getPriorityType;
}
/**
 * Notification Templates
 */
export declare class NotificationTemplates {
    private templates;
    /**
     * Register template
     */
    register(name: string, template: string): void;
    /**
     * Render template
     */
    render(name: string, data: Record<string, any>): string;
    /**
     * Get default templates
     */
    static getDefaults(): Map<string, string>;
}
/**
 * Singleton instances
 */
export declare const notificationManager: NotificationManager;
export declare const notificationTemplates: NotificationTemplates;
//# sourceMappingURL=NotificationSystem.d.ts.map