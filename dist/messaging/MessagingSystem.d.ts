/**
 * Notification and Messaging System
 * Push notifications, email, SMS, in-app messaging, and message queuing
 */
export interface Notification {
    id: string;
    type: NotificationType;
    recipient: string;
    subject?: string;
    body: string;
    data?: Record<string, any>;
    status: NotificationStatus;
    channels: NotificationChannel[];
    priority: NotificationPriority;
    scheduledFor?: Date;
    sentAt?: Date;
    readAt?: Date;
    createdAt: Date;
}
export declare enum NotificationType {
    Info = "info",
    Success = "success",
    Warning = "warning",
    Error = "error",
    Alert = "alert"
}
export declare enum NotificationStatus {
    Pending = "pending",
    Scheduled = "scheduled",
    Sending = "sending",
    Sent = "sent",
    Delivered = "delivered",
    Failed = "failed",
    Read = "read"
}
export declare enum NotificationChannel {
    Push = "push",
    Email = "email",
    SMS = "sms",
    InApp = "in_app",
    Webhook = "webhook"
}
export declare enum NotificationPriority {
    Low = "low",
    Normal = "normal",
    High = "high",
    Urgent = "urgent"
}
export interface NotificationTemplate {
    id: string;
    name: string;
    type: NotificationType;
    channels: NotificationChannel[];
    subject?: string;
    body: string;
    variables: string[];
    createdAt: Date;
}
export interface EmailMessage {
    to: string[];
    cc?: string[];
    bcc?: string[];
    from: string;
    subject: string;
    body: string;
    html?: string;
    attachments?: EmailAttachment[];
    headers?: Record<string, string>;
}
export interface EmailAttachment {
    filename: string;
    content: Buffer | string;
    contentType: string;
}
export interface SMSMessage {
    to: string;
    from: string;
    body: string;
    mediaUrls?: string[];
}
export interface PushNotification {
    token: string;
    title: string;
    body: string;
    data?: Record<string, any>;
    badge?: number;
    sound?: string;
    imageUrl?: string;
}
export interface MessageQueue {
    id: string;
    name: string;
    messages: QueuedMessage[];
    config: QueueConfig;
    statistics: QueueStatistics;
}
export interface QueuedMessage {
    id: string;
    queueId: string;
    payload: any;
    priority: number;
    attempts: number;
    maxAttempts: number;
    status: MessageStatus;
    scheduledFor?: Date;
    processedAt?: Date;
    error?: string;
    createdAt: Date;
}
export declare enum MessageStatus {
    Queued = "queued",
    Processing = "processing",
    Completed = "completed",
    Failed = "failed",
    DeadLetter = "dead_letter"
}
export interface QueueConfig {
    maxSize: number;
    retryDelay: number;
    retryBackoff: 'linear' | 'exponential';
    deadLetterQueue?: string;
    visibilityTimeout: number;
}
export interface QueueStatistics {
    totalMessages: number;
    queuedMessages: number;
    processingMessages: number;
    completedMessages: number;
    failedMessages: number;
}
export interface NotificationPreferences {
    userId: string;
    channels: Record<NotificationChannel, ChannelPreference>;
    categories: Record<string, boolean>;
    quietHours?: QuietHours;
    updatedAt: Date;
}
export interface ChannelPreference {
    enabled: boolean;
    verified: boolean;
    address?: string;
}
export interface QuietHours {
    enabled: boolean;
    start: string;
    end: string;
    timezone: string;
}
export interface MessageBatch {
    id: string;
    name: string;
    type: NotificationType;
    recipients: string[];
    template: string;
    variables: Record<string, any>[];
    status: BatchStatus;
    progress: BatchProgress;
    createdAt: Date;
    completedAt?: Date;
}
export declare enum BatchStatus {
    Pending = "pending",
    Processing = "processing",
    Completed = "completed",
    Failed = "failed"
}
export interface BatchProgress {
    total: number;
    sent: number;
    failed: number;
    percentage: number;
}
/**
 * Notification Manager
 */
export declare class NotificationManager {
    private notifications;
    private templates;
    private preferences;
    /**
     * Send notification
     */
    sendNotification(notification: Omit<Notification, 'id' | 'status' | 'createdAt'>): Promise<Notification>;
    /**
     * Send from template
     */
    sendFromTemplate(templateId: string, recipient: string, variables: Record<string, any>): Promise<Notification>;
    /**
     * Mark as read
     */
    markAsRead(notificationId: string): void;
    /**
     * Get notification
     */
    getNotification(notificationId: string): Notification | undefined;
    /**
     * List notifications
     */
    listNotifications(filter?: {
        recipient?: string;
        status?: NotificationStatus;
        type?: NotificationType;
    }): Notification[];
    /**
     * Register template
     */
    registerTemplate(template: Omit<NotificationTemplate, 'id' | 'createdAt'>): NotificationTemplate;
    /**
     * Get template
     */
    getTemplate(templateId: string): NotificationTemplate | undefined;
    /**
     * Update preferences
     */
    updatePreferences(preferences: NotificationPreferences): void;
    /**
     * Get preferences
     */
    getPreferences(userId: string): NotificationPreferences | undefined;
    private sendNotificationChannels;
    private sendChannel;
    private interpolateTemplate;
    private isQuietHours;
    private getNextActiveTime;
    private generateNotificationId;
    private generateTemplateId;
}
/**
 * Email Service
 */
export declare class EmailService {
    /**
     * Send email
     */
    sendEmail(message: EmailMessage): Promise<EmailResult>;
    /**
     * Send bulk email
     */
    sendBulkEmail(messages: EmailMessage[]): Promise<BulkEmailResult>;
    private generateMessageId;
}
export interface EmailResult {
    messageId: string;
    accepted: string[];
    rejected: string[];
    status: 'sent' | 'failed';
}
export interface BulkEmailResult {
    total: number;
    sent: number;
    failed: number;
    results: EmailResult[];
}
/**
 * SMS Service
 */
export declare class SMSService {
    /**
     * Send SMS
     */
    sendSMS(message: SMSMessage): Promise<SMSResult>;
    private generateMessageId;
}
export interface SMSResult {
    messageId: string;
    to: string;
    status: 'sent' | 'failed';
    cost: number;
}
/**
 * Push Notification Service
 */
export declare class PushNotificationService {
    /**
     * Send push notification
     */
    sendPush(notification: PushNotification): Promise<PushResult>;
    /**
     * Send to multiple devices
     */
    sendMulticast(tokens: string[], notification: Omit<PushNotification, 'token'>): Promise<MulticastResult>;
    private generateMessageId;
}
export interface PushResult {
    messageId: string;
    token: string;
    status: 'sent' | 'failed';
}
export interface MulticastResult {
    total: number;
    success: number;
    failure: number;
    results: PushResult[];
}
/**
 * Message Queue Manager
 */
export declare class MessageQueueManager {
    private queues;
    /**
     * Create queue
     */
    createQueue(name: string, config?: Partial<QueueConfig>): MessageQueue;
    /**
     * Enqueue message
     */
    enqueue(queueId: string, payload: any, priority?: number): QueuedMessage;
    /**
     * Dequeue message
     */
    dequeue(queueId: string): QueuedMessage | null;
    /**
     * Complete message
     */
    completeMessage(queueId: string, messageId: string): void;
    /**
     * Fail message
     */
    failMessage(queueId: string, messageId: string, error: string): void;
    /**
     * Get queue
     */
    getQueue(queueId: string): MessageQueue | undefined;
    /**
     * List queues
     */
    listQueues(): MessageQueue[];
    /**
     * Purge queue
     */
    purgeQueue(queueId: string): void;
    private generateQueueId;
    private generateMessageId;
}
/**
 * Batch Notification Manager
 */
export declare class BatchNotificationManager {
    private batches;
    private notificationManager;
    constructor(notificationManager: NotificationManager);
    /**
     * Create batch
     */
    createBatch(batch: Omit<MessageBatch, 'id' | 'status' | 'progress' | 'createdAt'>): MessageBatch;
    /**
     * Process batch
     */
    processBatch(batchId: string): Promise<void>;
    /**
     * Get batch
     */
    getBatch(batchId: string): MessageBatch | undefined;
    private generateBatchId;
}
/**
 * Singleton instances
 */
export declare const notificationManager: NotificationManager;
export declare const emailService: EmailService;
export declare const smsService: SMSService;
export declare const pushNotificationService: PushNotificationService;
export declare const messageQueueManager: MessageQueueManager;
export declare const batchNotificationManager: BatchNotificationManager;
//# sourceMappingURL=MessagingSystem.d.ts.map