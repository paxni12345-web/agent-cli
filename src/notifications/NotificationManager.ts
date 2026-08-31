/**
 * Advanced Notification System
 * Multi-channel delivery (email, SMS, push, webhook, Slack)
 * Template management, scheduling, delivery tracking, retry logic
 */

import { EventEmitter } from 'events';

// ============================================================================
// Types & Interfaces
// ============================================================================

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

export type NotificationType =
  | 'alert'
  | 'info'
  | 'warning'
  | 'error'
  | 'success'
  | 'promotional'
  | 'transactional';

export type NotificationChannel = 'email' | 'sms' | 'push' | 'webhook' | 'slack' | 'in_app';

export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

export type NotificationStatus =
  | 'pending'
  | 'scheduled'
  | 'queued'
  | 'sending'
  | 'sent'
  | 'delivered'
  | 'failed'
  | 'cancelled'
  | 'expired';

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

// ============================================================================
// Notification Manager
// ============================================================================

export class NotificationManager extends EventEmitter {
  private config: NotificationManagerConfig;
  private notifications: Map<string, Notification> = new Map();
  private templates: Map<string, NotificationTemplate> = new Map();
  private batches: Map<string, NotificationBatch> = new Map();
  private rules: Map<string, NotificationRule> = new Map();
  private queue: string[] = [];
  private recipients: Map<string, Recipient> = new Map();
  private emailConfig?: EmailConfig;
  private smsConfig?: SMSConfig;
  private pushConfig?: PushConfig;
  private slackConfig?: SlackConfig;

  constructor(config: Partial<NotificationManagerConfig> = {}) {
    super();
    this.config = {
      enableEmail: true,
      enableSMS: false,
      enablePush: false,
      enableWebhook: true,
      enableSlack: false,
      defaultRetryAttempts: 3,
      retryDelay: 5000,
      batchSize: 100,
      rateLimit: 1000,
      ...config,
    };

    this.startQueueProcessor();
  }

  // ========================================================================
  // Channel Configuration
  // ========================================================================

  public configureEmail(config: EmailConfig): void {
    if (!this.config.enableEmail) {
      throw new Error('Email channel is not enabled');
    }
    this.emailConfig = config;
    this.emit('channel:configured', { channel: 'email' });
  }

  public configureSMS(config: SMSConfig): void {
    if (!this.config.enableSMS) {
      throw new Error('SMS channel is not enabled');
    }
    this.smsConfig = config;
    this.emit('channel:configured', { channel: 'sms' });
  }

  public configurePush(config: PushConfig): void {
    if (!this.config.enablePush) {
      throw new Error('Push channel is not enabled');
    }
    this.pushConfig = config;
    this.emit('channel:configured', { channel: 'push' });
  }

  public configureSlack(config: SlackConfig): void {
    if (!this.config.enableSlack) {
      throw new Error('Slack channel is not enabled');
    }
    this.slackConfig = config;
    this.emit('channel:configured', { channel: 'slack' });
  }

  // ========================================================================
  // Notification Creation & Sending
  // ========================================================================

  public async send(
    recipient: Recipient,
    channel: NotificationChannel,
    content: NotificationContent,
    options: SendOptions = {}
  ): Promise<Notification> {
    // Check recipient preferences
    if (!this.canSendToRecipient(recipient, channel, options.type || 'info')) {
      throw new Error('Recipient preferences prevent delivery');
    }

    // Check quiet hours
    if (this.isInQuietHours(recipient)) {
      throw new Error('Recipient is in quiet hours');
    }

    // Check frequency limits
    if (!this.checkFrequencyLimit(recipient)) {
      throw new Error('Frequency limit exceeded');
    }

    const notification: Notification = {
      id: this.generateId(),
      type: options.type || 'info',
      channel,
      recipient,
      subject: options.subject,
      content,
      template: options.template,
      templateData: options.templateData,
      priority: options.priority || 'normal',
      status: 'pending',
      scheduledFor: options.scheduledFor,
      expiresAt: options.expiresAt,
      metadata: {
        createdAt: Date.now(),
        updatedAt: Date.now(),
        createdBy: options.createdBy || 'system',
        tags: options.tags || [],
        correlationId: options.correlationId,
        source: options.source,
      },
      delivery: {
        attempts: [],
      },
    };

    this.notifications.set(notification.id, notification);

    // Apply template if specified
    if (notification.template) {
      this.applyTemplate(notification);
    }

    // Schedule or queue for immediate delivery
    if (notification.scheduledFor && notification.scheduledFor > Date.now()) {
      notification.status = 'scheduled';
      this.scheduleNotification(notification);
    } else {
      notification.status = 'queued';
      this.queue.push(notification.id);
    }

    this.emit('notification:created', { notification });

    return notification;
  }

  public async sendBatch(
    notifications: Array<{
      recipient: Recipient;
      channel: NotificationChannel;
      content: NotificationContent;
      options?: SendOptions;
    }>
  ): Promise<NotificationBatch> {
    const batch: NotificationBatch = {
      id: this.generateId(),
      notifications: [],
      status: 'pending',
      createdAt: Date.now(),
      stats: {
        total: notifications.length,
        sent: 0,
        failed: 0,
        pending: notifications.length,
      },
    };

    for (const notif of notifications) {
      try {
        const notification = await this.send(
          notif.recipient,
          notif.channel,
          notif.content,
          notif.options
        );
        batch.notifications.push(notification.id);
      } catch (error) {
        batch.stats.failed++;
        batch.stats.pending--;
        this.emit('batch:notification:failed', { batch, error });
      }
    }

    this.batches.set(batch.id, batch);
    batch.status = 'processing';

    this.emit('batch:created', { batch });

    return batch;
  }

  // ========================================================================
  // Template Management
  // ========================================================================

  public createTemplate(
    name: string,
    channel: NotificationChannel,
    content: string,
    options: TemplateOptions = {}
  ): NotificationTemplate {
    const variables = this.extractVariables(content);

    const template: NotificationTemplate = {
      id: this.generateId(),
      name,
      channel,
      subject: options.subject,
      content,
      variables,
      metadata: {
        description: options.description,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: '1.0.0',
        tags: options.tags || [],
      },
    };

    this.templates.set(template.id, template);
    this.emit('template:created', { template });

    return template;
  }

  public getTemplate(id: string): NotificationTemplate | undefined {
    return this.templates.get(id);
  }

  public getTemplateByName(name: string): NotificationTemplate | undefined {
    return Array.from(this.templates.values()).find(t => t.name === name);
  }

  private applyTemplate(notification: Notification): void {
    const template = this.templates.get(notification.template!) ||
      this.getTemplateByName(notification.template!);

    if (!template) {
      throw new Error(`Template not found: ${notification.template}`);
    }

    if (template.channel !== notification.channel) {
      throw new Error(
        `Template channel mismatch: expected ${template.channel}, got ${notification.channel}`
      );
    }

    // Replace variables in content
    let content = template.content;
    if (notification.templateData) {
      for (const [key, value] of Object.entries(notification.templateData)) {
        content = content.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
      }
    }

    notification.content.text = content;
    if (template.subject) {
      notification.subject = template.subject;
      if (notification.templateData) {
        for (const [key, value] of Object.entries(notification.templateData)) {
          notification.subject = notification.subject.replace(
            new RegExp(`{{${key}}}`, 'g'),
            String(value)
          );
        }
      }
    }
  }

  private extractVariables(content: string): Set<string> {
    const variables = new Set<string>();
    const regex = /{{(\w+)}}/g;
    let match;

    while ((match = regex.exec(content)) !== null) {
      variables.add(match[1]);
    }

    return variables;
  }

  // ========================================================================
  // Delivery
  // ========================================================================

  private startQueueProcessor(): void {
    setInterval(() => {
      this.processQueue();
    }, 1000);
  }

  private async processQueue(): Promise<void> {
    if (this.queue.length === 0) return;

    const batchSize = Math.min(this.queue.length, this.config.batchSize);
    const batch = this.queue.splice(0, batchSize);

    for (const notificationId of batch) {
      const notification = this.notifications.get(notificationId);
      if (!notification) continue;

      try {
        await this.deliver(notification);
      } catch (error) {
        this.emit('notification:error', { notification, error });
      }
    }
  }

  private async deliver(notification: Notification): Promise<void> {
    notification.status = 'sending';
    notification.metadata.updatedAt = Date.now();

    const startTime = Date.now();

    try {
      let success = false;

      switch (notification.channel) {
        case 'email':
          success = await this.deliverEmail(notification);
          break;
        case 'sms':
          success = await this.deliverSMS(notification);
          break;
        case 'push':
          success = await this.deliverPush(notification);
          break;
        case 'webhook':
          success = await this.deliverWebhook(notification);
          break;
        case 'slack':
          success = await this.deliverSlack(notification);
          break;
        default:
          throw new Error(`Unsupported channel: ${notification.channel}`);
      }

      const attempt: DeliveryAttempt = {
        id: this.generateId(),
        timestamp: Date.now(),
        status: success ? 'success' : 'failed',
        duration: Date.now() - startTime,
      };

      notification.delivery!.attempts.push(attempt);

      if (success) {
        notification.status = 'sent';
        notification.delivery!.deliveredAt = Date.now();
        this.emit('notification:sent', { notification });
      } else {
        await this.handleDeliveryFailure(notification);
      }
    } catch (error) {
      const attempt: DeliveryAttempt = {
        id: this.generateId(),
        timestamp: Date.now(),
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime,
      };

      notification.delivery!.attempts.push(attempt);
      await this.handleDeliveryFailure(notification);
    }
  }

  private async handleDeliveryFailure(notification: Notification): Promise<void> {
    const attempts = notification.delivery!.attempts.length;

    if (attempts < this.config.defaultRetryAttempts) {
      // Schedule retry
      notification.status = 'queued';
      notification.delivery!.nextRetryAt =
        Date.now() + this.config.retryDelay * Math.pow(2, attempts - 1);

      setTimeout(() => {
        this.queue.push(notification.id);
      }, this.config.retryDelay * Math.pow(2, attempts - 1));

      this.emit('notification:retry:scheduled', { notification });
    } else {
      // Max retries exceeded
      notification.status = 'failed';
      notification.delivery!.failedAt = Date.now();
      this.emit('notification:failed', { notification });
    }
  }

  // ========================================================================
  // Channel Delivery Methods
  // ========================================================================

  private async deliverEmail(notification: Notification): Promise<boolean> {
    if (!this.emailConfig) {
      throw new Error('Email is not configured');
    }

    const { recipient, subject, content } = notification;
    if (!recipient.email) {
      throw new Error('Recipient email is required');
    }

    // Simulate email sending - implement actual SMTP in production
    this.emit('email:send', {
      to: recipient.email,
      from: this.emailConfig.from,
      subject: subject || 'Notification',
      text: content.text,
      html: content.html,
    });

    return true;
  }

  private async deliverSMS(notification: Notification): Promise<boolean> {
    if (!this.smsConfig) {
      throw new Error('SMS is not configured');
    }

    const { recipient, content } = notification;
    if (!recipient.phone) {
      throw new Error('Recipient phone is required');
    }

    // Simulate SMS sending - implement actual SMS provider in production
    this.emit('sms:send', {
      to: recipient.phone,
      from: this.smsConfig.from,
      body: content.text,
    });

    return true;
  }

  private async deliverPush(notification: Notification): Promise<boolean> {
    if (!this.pushConfig) {
      throw new Error('Push is not configured');
    }

    const { recipient, subject, content } = notification;
    if (!recipient.deviceToken) {
      throw new Error('Recipient device token is required');
    }

    // Simulate push notification - implement actual push provider in production
    this.emit('push:send', {
      token: recipient.deviceToken,
      title: subject || 'Notification',
      body: content.text,
    });

    return true;
  }

  private async deliverWebhook(notification: Notification): Promise<boolean> {
    const { recipient, content } = notification;
    if (!recipient.webhookUrl) {
      throw new Error('Recipient webhook URL is required');
    }

    // Simulate webhook - implement actual HTTP request in production
    this.emit('webhook:send', {
      url: recipient.webhookUrl,
      payload: {
        notification: notification.id,
        type: notification.type,
        content: content.text,
      },
    });

    return true;
  }

  private async deliverSlack(notification: Notification): Promise<boolean> {
    if (!this.slackConfig) {
      throw new Error('Slack is not configured');
    }

    const { recipient, content } = notification;
    if (!recipient.slackChannel) {
      throw new Error('Recipient Slack channel is required');
    }

    // Simulate Slack message - implement actual Slack API in production
    this.emit('slack:send', {
      channel: recipient.slackChannel,
      text: content.text,
      attachments: content.attachments,
    });

    return true;
  }

  // ========================================================================
  // Recipient Management
  // ========================================================================

  public registerRecipient(recipient: Recipient): void {
    this.recipients.set(recipient.id, recipient);
    this.emit('recipient:registered', { recipient });
  }

  public updateRecipientPreferences(
    recipientId: string,
    preferences: RecipientPreferences
  ): void {
    const recipient = this.recipients.get(recipientId);
    if (!recipient) {
      throw new Error(`Recipient not found: ${recipientId}`);
    }

    recipient.preferences = preferences;
    this.emit('recipient:preferences:updated', { recipient });
  }

  private canSendToRecipient(
    recipient: Recipient,
    channel: NotificationChannel,
    type: NotificationType
  ): boolean {
    if (!recipient.preferences) return true;

    const { channels, types } = recipient.preferences;

    if (channels && channels.size > 0 && !channels.has(channel)) {
      return false;
    }

    if (types && types.size > 0 && !types.has(type)) {
      return false;
    }

    return true;
  }

  private isInQuietHours(recipient: Recipient): boolean {
    if (!recipient.preferences?.quietHours?.enabled) return false;

    const { startHour, endHour } = recipient.preferences.quietHours;
    const now = new Date();
    const currentHour = now.getHours();

    if (startHour < endHour) {
      return currentHour >= startHour && currentHour < endHour;
    } else {
      return currentHour >= startHour || currentHour < endHour;
    }
  }

  private checkFrequencyLimit(recipient: Recipient): boolean {
    if (!recipient.preferences?.frequency) return true;

    const { maxPerHour, maxPerDay, maxPerWeek } = recipient.preferences.frequency;
    const now = Date.now();

    const recentNotifications = Array.from(this.notifications.values()).filter(
      n => n.recipient.id === recipient.id && n.status === 'sent'
    );

    if (maxPerHour) {
      const hourAgo = now - 3600000;
      const countHour = recentNotifications.filter(n => n.metadata.createdAt > hourAgo).length;
      if (countHour >= maxPerHour) return false;
    }

    if (maxPerDay) {
      const dayAgo = now - 86400000;
      const countDay = recentNotifications.filter(n => n.metadata.createdAt > dayAgo).length;
      if (countDay >= maxPerDay) return false;
    }

    if (maxPerWeek) {
      const weekAgo = now - 604800000;
      const countWeek = recentNotifications.filter(n => n.metadata.createdAt > weekAgo).length;
      if (countWeek >= maxPerWeek) return false;
    }

    return true;
  }

  // ========================================================================
  // Rules & Automation
  // ========================================================================

  public createRule(rule: Omit<NotificationRule, 'id'>): NotificationRule {
    const full: NotificationRule = {
      ...rule,
      id: this.generateId(),
    };

    this.rules.set(full.id, full);
    this.emit('rule:created', { rule: full });

    return full;
  }

  public evaluateRules(context: Record<string, any>): NotificationRule[] {
    const matchedRules: NotificationRule[] = [];

    for (const rule of this.rules.values()) {
      if (!rule.enabled) continue;

      if (this.evaluateCondition(rule.condition, context)) {
        matchedRules.push(rule);
        rule.metadata.triggerCount++;
      }
    }

    return matchedRules;
  }

  private evaluateCondition(condition: RuleCondition, context: Record<string, any>): boolean {
    const value = condition.field ? context[condition.field] : null;

    switch (condition.operator) {
      case 'equals':
        return value === condition.value;
      case 'contains':
        return String(value).includes(String(condition.value));
      case 'greater_than':
        return value > condition.value;
      case 'less_than':
        return value < condition.value;
      case 'matches':
        return new RegExp(condition.value).test(String(value));
      default:
        return false;
    }
  }

  // ========================================================================
  // Scheduling
  // ========================================================================

  private scheduleNotification(notification: Notification): void {
    const delay = notification.scheduledFor! - Date.now();

    setTimeout(() => {
      if (notification.expiresAt && Date.now() > notification.expiresAt) {
        notification.status = 'expired';
        this.emit('notification:expired', { notification });
        return;
      }

      notification.status = 'queued';
      this.queue.push(notification.id);
    }, delay);
  }

  public cancelNotification(id: string): void {
    const notification = this.notifications.get(id);
    if (!notification) return;

    if (['pending', 'scheduled', 'queued'].includes(notification.status)) {
      notification.status = 'cancelled';
      this.queue = this.queue.filter(nid => nid !== id);
      this.emit('notification:cancelled', { notification });
    }
  }

  // ========================================================================
  // Statistics & Monitoring
  // ========================================================================

  public getStats(): NotificationStats {
    const notifications = Array.from(this.notifications.values());

    return {
      total: notifications.length,
      byStatus: {
        pending: notifications.filter(n => n.status === 'pending').length,
        scheduled: notifications.filter(n => n.status === 'scheduled').length,
        queued: notifications.filter(n => n.status === 'queued').length,
        sending: notifications.filter(n => n.status === 'sending').length,
        sent: notifications.filter(n => n.status === 'sent').length,
        delivered: notifications.filter(n => n.status === 'delivered').length,
        failed: notifications.filter(n => n.status === 'failed').length,
        cancelled: notifications.filter(n => n.status === 'cancelled').length,
        expired: notifications.filter(n => n.status === 'expired').length,
      },
      byChannel: {
        email: notifications.filter(n => n.channel === 'email').length,
        sms: notifications.filter(n => n.channel === 'sms').length,
        push: notifications.filter(n => n.channel === 'push').length,
        webhook: notifications.filter(n => n.channel === 'webhook').length,
        slack: notifications.filter(n => n.channel === 'slack').length,
        in_app: notifications.filter(n => n.channel === 'in_app').length,
      },
      templates: this.templates.size,
      batches: this.batches.size,
      rules: this.rules.size,
      queueLength: this.queue.length,
    };
  }

  public getNotification(id: string): Notification | undefined {
    return this.notifications.get(id);
  }

  public getBatch(id: string): NotificationBatch | undefined {
    return this.batches.get(id);
  }

  // ========================================================================
  // Utilities
  // ========================================================================

  private generateId(): string {
    return `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// ============================================================================
// Supporting Types
// ============================================================================

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

// ============================================================================
// Export
// ============================================================================

export default NotificationManager;
