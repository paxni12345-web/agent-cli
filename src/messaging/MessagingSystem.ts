/**
 * Notification and Messaging System
 * Push notifications, email, SMS, in-app messaging, and message queuing
 */

import { eventBus } from '../core/EventBus';

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

export enum NotificationType {
  Info = 'info',
  Success = 'success',
  Warning = 'warning',
  Error = 'error',
  Alert = 'alert',
}

export enum NotificationStatus {
  Pending = 'pending',
  Scheduled = 'scheduled',
  Sending = 'sending',
  Sent = 'sent',
  Delivered = 'delivered',
  Failed = 'failed',
  Read = 'read',
}

export enum NotificationChannel {
  Push = 'push',
  Email = 'email',
  SMS = 'sms',
  InApp = 'in_app',
  Webhook = 'webhook',
}

export enum NotificationPriority {
  Low = 'low',
  Normal = 'normal',
  High = 'high',
  Urgent = 'urgent',
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

export enum MessageStatus {
  Queued = 'queued',
  Processing = 'processing',
  Completed = 'completed',
  Failed = 'failed',
  DeadLetter = 'dead_letter',
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
  start: string; // HH:mm format
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

export enum BatchStatus {
  Pending = 'pending',
  Processing = 'processing',
  Completed = 'completed',
  Failed = 'failed',
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
export class NotificationManager {
  private notifications: Map<string, Notification> = new Map();
  private templates: Map<string, NotificationTemplate> = new Map();
  private preferences: Map<string, NotificationPreferences> = new Map();

  /**
   * Send notification
   */
  async sendNotification(notification: Omit<Notification, 'id' | 'status' | 'createdAt'>): Promise<Notification> {
    const fullNotification: Notification = {
      ...notification,
      id: this.generateNotificationId(),
      status: notification.scheduledFor ? NotificationStatus.Scheduled : NotificationStatus.Pending,
      createdAt: new Date(),
    };

    this.notifications.set(fullNotification.id, fullNotification);

    // Check user preferences
    const prefs = this.preferences.get(fullNotification.recipient);

    if (prefs) {
      fullNotification.channels = fullNotification.channels.filter(
        channel => prefs.channels[channel]?.enabled
      );

      // Check quiet hours
      if (this.isQuietHours(prefs)) {
        fullNotification.scheduledFor = this.getNextActiveTime(prefs);
        fullNotification.status = NotificationStatus.Scheduled;
      }
    }

    eventBus.emitSync('notification.created', fullNotification, 'NotificationManager');

    // Send immediately if not scheduled
    if (!fullNotification.scheduledFor) {
      await this.sendNotificationChannels(fullNotification);
    }

    return fullNotification;
  }

  /**
   * Send from template
   */
  async sendFromTemplate(
    templateId: string,
    recipient: string,
    variables: Record<string, any>
  ): Promise<Notification> {
    const template = this.templates.get(templateId);

    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    const body = this.interpolateTemplate(template.body, variables);
    const subject = template.subject
      ? this.interpolateTemplate(template.subject, variables)
      : undefined;

    return this.sendNotification({
      type: template.type,
      recipient,
      subject,
      body,
      channels: template.channels,
      priority: NotificationPriority.Normal,
    });
  }

  /**
   * Mark as read
   */
  markAsRead(notificationId: string): void {
    const notification = this.notifications.get(notificationId);

    if (notification) {
      notification.status = NotificationStatus.Read;
      notification.readAt = new Date();

      eventBus.emitSync('notification.read', notification, 'NotificationManager');
    }
  }

  /**
   * Get notification
   */
  getNotification(notificationId: string): Notification | undefined {
    return this.notifications.get(notificationId);
  }

  /**
   * List notifications
   */
  listNotifications(filter?: {
    recipient?: string;
    status?: NotificationStatus;
    type?: NotificationType;
  }): Notification[] {
    let notifications = Array.from(this.notifications.values());

    if (filter?.recipient) {
      notifications = notifications.filter(n => n.recipient === filter.recipient);
    }

    if (filter?.status) {
      notifications = notifications.filter(n => n.status === filter.status);
    }

    if (filter?.type) {
      notifications = notifications.filter(n => n.type === filter.type);
    }

    return notifications.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Register template
   */
  registerTemplate(template: Omit<NotificationTemplate, 'id' | 'createdAt'>): NotificationTemplate {
    const fullTemplate: NotificationTemplate = {
      ...template,
      id: this.generateTemplateId(),
      createdAt: new Date(),
    };

    this.templates.set(fullTemplate.id, fullTemplate);

    eventBus.emitSync('notification.template_registered', fullTemplate, 'NotificationManager');

    return fullTemplate;
  }

  /**
   * Get template
   */
  getTemplate(templateId: string): NotificationTemplate | undefined {
    return this.templates.get(templateId);
  }

  /**
   * Update preferences
   */
  updatePreferences(preferences: NotificationPreferences): void {
    preferences.updatedAt = new Date();
    this.preferences.set(preferences.userId, preferences);

    eventBus.emitSync('notification.preferences_updated', preferences, 'NotificationManager');
  }

  /**
   * Get preferences
   */
  getPreferences(userId: string): NotificationPreferences | undefined {
    return this.preferences.get(userId);
  }

  private async sendNotificationChannels(notification: Notification): Promise<void> {
    notification.status = NotificationStatus.Sending;

    try {
      for (const channel of notification.channels) {
        await this.sendChannel(notification, channel);
      }

      notification.status = NotificationStatus.Sent;
      notification.sentAt = new Date();

      eventBus.emitSync('notification.sent', notification, 'NotificationManager');
    } catch (error) {
      notification.status = NotificationStatus.Failed;
      eventBus.emitSync('notification.failed', notification, 'NotificationManager');
    }
  }

  private async sendChannel(notification: Notification, channel: NotificationChannel): Promise<void> {
    // Mock channel sending
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  private interpolateTemplate(template: string, variables: Record<string, any>): string {
    let result = template;

    for (const [key, value] of Object.entries(variables)) {
      result = result.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
    }

    return result;
  }

  private isQuietHours(prefs: NotificationPreferences): boolean {
    if (!prefs.quietHours?.enabled) {
      return false;
    }

    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    return currentTime >= prefs.quietHours.start && currentTime <= prefs.quietHours.end;
  }

  private getNextActiveTime(prefs: NotificationPreferences): Date {
    if (!prefs.quietHours) {
      return new Date();
    }

    const [hours, minutes] = prefs.quietHours.end.split(':').map(Number);
    const next = new Date();
    next.setHours(hours, minutes, 0, 0);

    return next;
  }

  private generateNotificationId(): string {
    return `notif_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  private generateTemplateId(): string {
    return `template_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }
}

/**
 * Email Service
 */
export class EmailService {
  /**
   * Send email
   */
  async sendEmail(message: EmailMessage): Promise<EmailResult> {
    // Mock email sending
    await new Promise(resolve => setTimeout(resolve, 200));

    const result: EmailResult = {
      messageId: this.generateMessageId(),
      accepted: message.to,
      rejected: [],
      status: 'sent',
    };

    eventBus.emitSync('email.sent', result, 'EmailService');

    return result;
  }

  /**
   * Send bulk email
   */
  async sendBulkEmail(messages: EmailMessage[]): Promise<BulkEmailResult> {
    const results: EmailResult[] = [];

    for (const message of messages) {
      const result = await this.sendEmail(message);
      results.push(result);
    }

    return {
      total: messages.length,
      sent: results.filter(r => r.status === 'sent').length,
      failed: results.filter(r => r.status === 'failed').length,
      results,
    };
  }

  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }
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
export class SMSService {
  /**
   * Send SMS
   */
  async sendSMS(message: SMSMessage): Promise<SMSResult> {
    // Mock SMS sending
    await new Promise(resolve => setTimeout(resolve, 150));

    const result: SMSResult = {
      messageId: this.generateMessageId(),
      to: message.to,
      status: 'sent',
      cost: 0.01,
    };

    eventBus.emitSync('sms.sent', result, 'SMSService');

    return result;
  }

  private generateMessageId(): string {
    return `sms_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }
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
export class PushNotificationService {
  /**
   * Send push notification
   */
  async sendPush(notification: PushNotification): Promise<PushResult> {
    // Mock push sending
    await new Promise(resolve => setTimeout(resolve, 100));

    const result: PushResult = {
      messageId: this.generateMessageId(),
      token: notification.token,
      status: 'sent',
    };

    eventBus.emitSync('push.sent', result, 'PushNotificationService');

    return result;
  }

  /**
   * Send to multiple devices
   */
  async sendMulticast(tokens: string[], notification: Omit<PushNotification, 'token'>): Promise<MulticastResult> {
    const results: PushResult[] = [];

    for (const token of tokens) {
      const result = await this.sendPush({ ...notification, token });
      results.push(result);
    }

    return {
      total: tokens.length,
      success: results.filter(r => r.status === 'sent').length,
      failure: results.filter(r => r.status === 'failed').length,
      results,
    };
  }

  private generateMessageId(): string {
    return `push_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }
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
export class MessageQueueManager {
  private queues: Map<string, MessageQueue> = new Map();

  /**
   * Create queue
   */
  createQueue(name: string, config: Partial<QueueConfig> = {}): MessageQueue {
    const queue: MessageQueue = {
      id: this.generateQueueId(),
      name,
      messages: [],
      config: {
        maxSize: 10000,
        retryDelay: 5000,
        retryBackoff: 'exponential',
        visibilityTimeout: 30000,
        ...config,
      },
      statistics: {
        totalMessages: 0,
        queuedMessages: 0,
        processingMessages: 0,
        completedMessages: 0,
        failedMessages: 0,
      },
    };

    this.queues.set(queue.id, queue);

    eventBus.emitSync('queue.created', queue, 'MessageQueueManager');

    return queue;
  }

  /**
   * Enqueue message
   */
  enqueue(queueId: string, payload: any, priority: number = 0): QueuedMessage {
    const queue = this.queues.get(queueId);

    if (!queue) {
      throw new Error(`Queue not found: ${queueId}`);
    }

    if (queue.messages.length >= queue.config.maxSize) {
      throw new Error(`Queue is full: ${queueId}`);
    }

    const message: QueuedMessage = {
      id: this.generateMessageId(),
      queueId,
      payload,
      priority,
      attempts: 0,
      maxAttempts: 3,
      status: MessageStatus.Queued,
      createdAt: new Date(),
    };

    queue.messages.push(message);
    queue.statistics.queuedMessages++;
    queue.statistics.totalMessages++;

    // Sort by priority
    queue.messages.sort((a, b) => b.priority - a.priority);

    eventBus.emitSync('queue.message_enqueued', message, 'MessageQueueManager');

    return message;
  }

  /**
   * Dequeue message
   */
  dequeue(queueId: string): QueuedMessage | null {
    const queue = this.queues.get(queueId);

    if (!queue) {
      throw new Error(`Queue not found: ${queueId}`);
    }

    const message = queue.messages.find(m => m.status === MessageStatus.Queued);

    if (!message) {
      return null;
    }

    message.status = MessageStatus.Processing;
    queue.statistics.queuedMessages--;
    queue.statistics.processingMessages++;

    eventBus.emitSync('queue.message_dequeued', message, 'MessageQueueManager');

    return message;
  }

  /**
   * Complete message
   */
  completeMessage(queueId: string, messageId: string): void {
    const queue = this.queues.get(queueId);

    if (!queue) {
      throw new Error(`Queue not found: ${queueId}`);
    }

    const message = queue.messages.find(m => m.id === messageId);

    if (message) {
      message.status = MessageStatus.Completed;
      message.processedAt = new Date();
      queue.statistics.processingMessages--;
      queue.statistics.completedMessages++;

      eventBus.emitSync('queue.message_completed', message, 'MessageQueueManager');
    }
  }

  /**
   * Fail message
   */
  failMessage(queueId: string, messageId: string, error: string): void {
    const queue = this.queues.get(queueId);

    if (!queue) {
      throw new Error(`Queue not found: ${queueId}`);
    }

    const message = queue.messages.find(m => m.id === messageId);

    if (message) {
      message.attempts++;
      message.error = error;

      if (message.attempts >= message.maxAttempts) {
        message.status = MessageStatus.Failed;
        queue.statistics.processingMessages--;
        queue.statistics.failedMessages++;

        if (queue.config.deadLetterQueue) {
          this.enqueue(queue.config.deadLetterQueue, message.payload);
        }
      } else {
        message.status = MessageStatus.Queued;
        queue.statistics.processingMessages--;
        queue.statistics.queuedMessages++;
      }

      eventBus.emitSync('queue.message_failed', message, 'MessageQueueManager');
    }
  }

  /**
   * Get queue
   */
  getQueue(queueId: string): MessageQueue | undefined {
    return this.queues.get(queueId);
  }

  /**
   * List queues
   */
  listQueues(): MessageQueue[] {
    return Array.from(this.queues.values());
  }

  /**
   * Purge queue
   */
  purgeQueue(queueId: string): void {
    const queue = this.queues.get(queueId);

    if (queue) {
      queue.messages = [];
      queue.statistics = {
        totalMessages: 0,
        queuedMessages: 0,
        processingMessages: 0,
        completedMessages: 0,
        failedMessages: 0,
      };

      eventBus.emitSync('queue.purged', { queueId }, 'MessageQueueManager');
    }
  }

  private generateQueueId(): string {
    return `queue_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  private generateMessageId(): string {
    return `qmsg_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }
}

/**
 * Batch Notification Manager
 */
export class BatchNotificationManager {
  private batches: Map<string, MessageBatch> = new Map();
  private notificationManager: NotificationManager;

  constructor(notificationManager: NotificationManager) {
    this.notificationManager = notificationManager;
  }

  /**
   * Create batch
   */
  createBatch(batch: Omit<MessageBatch, 'id' | 'status' | 'progress' | 'createdAt'>): MessageBatch {
    const fullBatch: MessageBatch = {
      ...batch,
      id: this.generateBatchId(),
      status: BatchStatus.Pending,
      progress: {
        total: batch.recipients.length,
        sent: 0,
        failed: 0,
        percentage: 0,
      },
      createdAt: new Date(),
    };

    this.batches.set(fullBatch.id, fullBatch);

    eventBus.emitSync('batch.created', fullBatch, 'BatchNotificationManager');

    return fullBatch;
  }

  /**
   * Process batch
   */
  async processBatch(batchId: string): Promise<void> {
    const batch = this.batches.get(batchId);

    if (!batch) {
      throw new Error(`Batch not found: ${batchId}`);
    }

    batch.status = BatchStatus.Processing;

    for (let i = 0; i < batch.recipients.length; i++) {
      const recipient = batch.recipients[i];
      const variables = batch.variables[i] || {};

      try {
        await this.notificationManager.sendFromTemplate(batch.template, recipient, variables);

        batch.progress.sent++;
      } catch (error) {
        batch.progress.failed++;
      }

      batch.progress.percentage = Math.floor(
        ((batch.progress.sent + batch.progress.failed) / batch.progress.total) * 100
      );
    }

    batch.status = BatchStatus.Completed;
    batch.completedAt = new Date();

    eventBus.emitSync('batch.completed', batch, 'BatchNotificationManager');
  }

  /**
   * Get batch
   */
  getBatch(batchId: string): MessageBatch | undefined {
    return this.batches.get(batchId);
  }

  private generateBatchId(): string {
    return `batch_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }
}

/**
 * Singleton instances
 */
export const notificationManager = new NotificationManager();
export const emailService = new EmailService();
export const smsService = new SMSService();
export const pushNotificationService = new PushNotificationService();
export const messageQueueManager = new MessageQueueManager();
export const batchNotificationManager = new BatchNotificationManager(notificationManager);
