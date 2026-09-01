/**
 * Advanced Notification System
 * Multi-channel delivery (email, SMS, push, webhook, Slack)
 * Template management, scheduling, delivery tracking, retry logic
 */
import { EventEmitter } from 'events';
export interface NotificationManagerConfig {
    enableEmail: boolean;
    enableSMS: boolean;
    enablePush: boolean;
    enableWebhook: boolean;
    enableSlack: boolean;
    defaultRetryAttempts: number;
    retryDelay: number;
    batchSize: number;
    rateLimit: number;
}
export interface Notification {
    id: string;
    type: NotificationType;
    channel: NotificationChannel;
    recipient: Recipient;
    subject?: string;
    content: NotificationContent;
    template?: string;
    templateData?: Record<string, any>;
    priority: NotificationPriority;
    status: NotificationStatus;
    scheduledFor?: number;
    expiresAt?: number;
    metadata: NotificationMetadata;
    delivery?: DeliveryInfo;
}
export type NotificationType = 'alert' | 'info' | 'warning' | 'error' | 'success' | 'promotional' | 'transactional';
export type NotificationChannel = 'email' | 'sms' | 'push' | 'webhook' | 'slack' | 'in_app';
export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';
export type NotificationStatus = 'pending' | 'scheduled' | 'queued' | 'sending' | 'sent' | 'delivered' | 'failed' | 'cancelled' | 'expired';
export interface Recipient {
    id: string;
    email?: string;
    phone?: string;
    deviceToken?: string;
    webhookUrl?: string;
    slackChannel?: string;
    preferences?: RecipientPreferences;
}
export interface RecipientPreferences {
    channels: Set<NotificationChannel>;
    types: Set<NotificationType>;
    quietHours?: QuietHours;
    frequency?: FrequencyLimit;
}
export interface QuietHours {
    enabled: boolean;
    startHour: number;
    endHour: number;
    timezone: string;
}
export interface FrequencyLimit {
    maxPerHour?: number;
    maxPerDay?: number;
    maxPerWeek?: number;
}
export interface NotificationContent {
    text: string;
    html?: string;
    markdown?: string;
    attachments?: Attachment[];
    actions?: NotificationAction[];
}
export interface Attachment {
    filename: string;
    contentType: string;
    data: Buffer | string;
    size: number;
}
export interface NotificationAction {
    id: string;
    label: string;
    url?: string;
    action?: string;
    style?: 'primary' | 'secondary' | 'danger';
}
export interface NotificationMetadata {
    createdAt: number;
    updatedAt: number;
    createdBy: string;
    tags: string[];
    correlationId?: string;
    source?: string;
}
export interface DeliveryInfo {
    attempts: DeliveryAttempt[];
    deliveredAt?: number;
    failedAt?: number;
    lastAttemptAt?: number;
    nextRetryAt?: number;
    error?: string;
}
export interface DeliveryAttempt {
    id: string;
    timestamp: number;
    status: 'success' | 'failed';
    response?: any;
    error?: string;
    duration: number;
}
export interface NotificationTemplate {
    id: string;
    name: string;
    channel: NotificationChannel;
    subject?: string;
    content: string;
    variables: Set<string>;
    metadata: TemplateMetadata;
}
export interface TemplateMetadata {
    description?: string;
    createdAt: number;
    updatedAt: number;
    version: string;
    tags: string[];
}
export interface NotificationBatch {
    id: string;
    notifications: string[];
    status: BatchStatus;
    createdAt: number;
    completedAt?: number;
    stats: BatchStats;
}
export type BatchStatus = 'pending' | 'processing' | 'completed' | 'failed';
export interface BatchStats {
    total: number;
    sent: number;
    failed: number;
    pending: number;
}
export interface EmailConfig {
    from: string;
    replyTo?: string;
    smtp?: SMTPConfig;
}
export interface SMTPConfig {
    host: string;
    port: number;
    secure: boolean;
    auth?: {
        user: string;
        pass: string;
    };
}
export interface SMSConfig {
    provider: SMSProvider;
    apiKey: string;
    from: string;
}
export type SMSProvider = 'twilio' | 'nexmo' | 'aws_sns';
export interface PushConfig {
    provider: PushProvider;
    credentials: Record<string, string>;
}
export type PushProvider = 'fcm' | 'apns' | 'web_push';
export interface SlackConfig {
    webhookUrl?: string;
    botToken?: string;
}
export interface NotificationRule {
    id: string;
    name: string;
    condition: RuleCondition;
    channels: NotificationChannel[];
    template?: string;
    enabled: boolean;
    metadata: RuleMetadata;
}
export interface RuleCondition {
    type: ConditionType;
    operator: ConditionOperator;
    value: any;
    field?: string;
}
export type ConditionType = 'field' | 'time' | 'frequency' | 'custom';
export type ConditionOperator = 'equals' | 'contains' | 'greater_than' | 'less_than' | 'matches';
export interface RuleMetadata {
    description?: string;
    createdAt: number;
    updatedAt: number;
    triggerCount: number;
}
export declare class NotificationManager extends EventEmitter {
    private config;
    private notifications;
    private templates;
    private batches;
    private rules;
    private queue;
    private recipients;
    private emailConfig?;
    private smsConfig?;
    private pushConfig?;
    private slackConfig?;
    constructor(config?: Partial<NotificationManagerConfig>);
    configureEmail(config: EmailConfig): void;
    configureSMS(config: SMSConfig): void;
    configurePush(config: PushConfig): void;
    configureSlack(config: SlackConfig): void;
    send(recipient: Recipient, channel: NotificationChannel, content: NotificationContent, options?: SendOptions): Promise<Notification>;
    sendBatch(notifications: Array<{
        recipient: Recipient;
        channel: NotificationChannel;
        content: NotificationContent;
        options?: SendOptions;
    }>): Promise<NotificationBatch>;
    createTemplate(name: string, channel: NotificationChannel, content: string, options?: TemplateOptions): NotificationTemplate;
    getTemplate(id: string): NotificationTemplate | undefined;
    getTemplateByName(name: string): NotificationTemplate | undefined;
    private applyTemplate;
    private extractVariables;
    private startQueueProcessor;
    private processQueue;
    private deliver;
    private handleDeliveryFailure;
    private deliverEmail;
    private deliverSMS;
    private deliverPush;
    private deliverWebhook;
    private deliverSlack;
    registerRecipient(recipient: Recipient): void;
    updateRecipientPreferences(recipientId: string, preferences: RecipientPreferences): void;
    private canSendToRecipient;
    private isInQuietHours;
    private checkFrequencyLimit;
    createRule(rule: Omit<NotificationRule, 'id'>): NotificationRule;
    evaluateRules(context: Record<string, any>): NotificationRule[];
    private evaluateCondition;
    private scheduleNotification;
    cancelNotification(id: string): void;
    getStats(): NotificationStats;
    getNotification(id: string): Notification | undefined;
    getBatch(id: string): NotificationBatch | undefined;
    private generateId;
}
interface SendOptions {
    type?: NotificationType;
    subject?: string;
    template?: string;
    templateData?: Record<string, any>;
    priority?: NotificationPriority;
    scheduledFor?: number;
    expiresAt?: number;
    createdBy?: string;
    tags?: string[];
    correlationId?: string;
    source?: string;
}
interface TemplateOptions {
    subject?: string;
    description?: string;
    tags?: string[];
}
interface NotificationStats {
    total: number;
    byStatus: Record<NotificationStatus, number>;
    byChannel: Record<NotificationChannel, number>;
    templates: number;
    batches: number;
    rules: number;
    queueLength: number;
}
export default NotificationManager;
//# sourceMappingURL=NotificationManager.d.ts.map