/**
 * Notification System
 * Multi-channel notifications: email, Slack, Discord, webhooks, push notifications
 */

import { eventBus } from '../core/EventBus';

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
export class NotificationManager {
  private notifications: Map<string, Notification> = new Map();
  private rules: Map<string, NotificationRule> = new Map();
  private config?: NotificationConfig;
  private providers: Map<NotificationChannel, NotificationProvider> = new Map();

  /**
   * Configure notification system
   */
  configure(config: NotificationConfig): void {
    this.config = config;

    // Initialize providers
    if (config.email) {
      this.providers.set('email', new EmailProvider(config.email));
    }
    if (config.slack) {
      this.providers.set('slack', new SlackProvider(config.slack));
    }
    if (config.discord) {
      this.providers.set('discord', new DiscordProvider(config.discord));
    }
    if (config.webhook) {
      this.providers.set('webhook', new WebhookProvider(config.webhook));
    }
    if (config.push) {
      this.providers.set('push', new PushProvider(config.push));
    }
    if (config.sms) {
      this.providers.set('sms', new SMSProvider(config.sms));
    }
  }

  /**
   * Send notification
   */
  async send(notification: Omit<Notification, 'id' | 'timestamp'>): Promise<Notification> {
    const fullNotification: Notification = {
      ...notification,
      id: this.generateNotificationId(),
      timestamp: new Date(),
    };

    this.notifications.set(fullNotification.id, fullNotification);

    // Send through all specified channels
    const results = await Promise.allSettled(
      notification.channels.map(async (channel) => {
        const provider = this.providers.get(channel);
        if (provider) {
          await provider.send(fullNotification);
        }
      })
    );

    // Log failures
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.error(`Failed to send notification via ${notification.channels[index]}:`, result.reason);
      }
    });

    eventBus.emitSync('notification.sent', fullNotification, 'NotificationManager');

    return fullNotification;
  }

  /**
   * Add notification rule
   */
  addRule(rule: NotificationRule): void {
    this.rules.set(rule.id, rule);

    // Subscribe to event
    eventBus.on(rule.eventType, async (event) => {
      if (!rule.enabled) return;

      // Check condition
      if (rule.condition && !rule.condition(event)) {
        return;
      }

      // Generate notification
      const message = rule.template
        ? this.applyTemplate(rule.template, event)
        : JSON.stringify(event.data);

      await this.send({
        type: this.getPriorityType(rule.priority),
        title: `Event: ${rule.eventType}`,
        message,
        channels: rule.channels,
        metadata: {
          rule: rule.id,
          event: event.type,
        },
      });
    });

    eventBus.emitSync('notification.rule_added', rule, 'NotificationManager');
  }

  /**
   * Remove notification rule
   */
  removeRule(ruleId: string): void {
    this.rules.delete(ruleId);
    eventBus.emitSync('notification.rule_removed', { ruleId }, 'NotificationManager');
  }

  /**
   * Enable/disable rule
   */
  toggleRule(ruleId: string, enabled: boolean): void {
    const rule = this.rules.get(ruleId);
    if (rule) {
      rule.enabled = enabled;
    }
  }

  /**
   * Get notification by ID
   */
  getNotification(id: string): Notification | undefined {
    return this.notifications.get(id);
  }

  /**
   * List notifications
   */
  listNotifications(filter?: {
    type?: Notification['type'];
    unreadOnly?: boolean;
    limit?: number;
  }): Notification[] {
    let notifications = Array.from(this.notifications.values());

    if (filter?.type) {
      notifications = notifications.filter(n => n.type === filter.type);
    }

    if (filter?.unreadOnly) {
      notifications = notifications.filter(n => !n.read);
    }

    notifications.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    if (filter?.limit) {
      notifications = notifications.slice(0, filter.limit);
    }

    return notifications;
  }

  /**
   * Mark notification as read
   */
  markAsRead(id: string): void {
    const notification = this.notifications.get(id);
    if (notification) {
      notification.read = true;
      eventBus.emitSync('notification.read', { id }, 'NotificationManager');
    }
  }

  /**
   * Mark all as read
   */
  markAllAsRead(): void {
    for (const notification of this.notifications.values()) {
      notification.read = true;
    }
  }

  /**
   * Clear old notifications
   */
  clearOld(olderThanDays: number): number {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - olderThanDays);

    let cleared = 0;
    for (const [id, notification] of this.notifications) {
      if (notification.timestamp < cutoff) {
        this.notifications.delete(id);
        cleared++;
      }
    }

    return cleared;
  }

  /**
   * Get notification stats
   */
  getStats(): {
    total: number;
    unread: number;
    byType: Record<string, number>;
    byChannel: Record<string, number>;
  } {
    const notifications = Array.from(this.notifications.values());

    const byType: Record<string, number> = {};
    const byChannel: Record<string, number> = {};

    for (const notification of notifications) {
      byType[notification.type] = (byType[notification.type] || 0) + 1;

      for (const channel of notification.channels) {
        byChannel[channel] = (byChannel[channel] || 0) + 1;
      }
    }

    return {
      total: notifications.length,
      unread: notifications.filter(n => !n.read).length,
      byType,
      byChannel,
    };
  }

  private generateNotificationId(): string {
    return `notif_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  private applyTemplate(template: string, event: any): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
      return event.data?.[key] || event[key] || '';
    });
  }

  private getPriorityType(priority: NotificationRule['priority']): Notification['type'] {
    switch (priority) {
      case 'low': return 'info';
      case 'medium': return 'info';
      case 'high': return 'warning';
      case 'urgent': return 'error';
    }
  }
}

/**
 * Notification Provider Interface
 */
interface NotificationProvider {
  send(notification: Notification): Promise<void>;
}

/**
 * Email Provider
 */
class EmailProvider implements NotificationProvider {
  constructor(private config: EmailConfig) {}

  async send(notification: Notification): Promise<void> {
    // Mock implementation
    console.log('Sending email:', {
      to: this.config.to,
      subject: notification.title,
      body: notification.message,
    });

    // In production: use nodemailer
    /*
    const transporter = nodemailer.createTransport(this.config.smtp);
    await transporter.sendMail({
      from: this.config.from,
      to: this.config.to,
      subject: notification.title,
      text: notification.message,
      html: this.formatAsHTML(notification),
    });
    */
  }

  private formatAsHTML(notification: Notification): string {
    const color = this.getColorForType(notification.type);
    return `
      <div style="font-family: Arial, sans-serif;">
        <h2 style="color: ${color};">${notification.title}</h2>
        <p>${notification.message}</p>
        <hr>
        <small>Sent at ${notification.timestamp.toISOString()}</small>
      </div>
    `;
  }

  private getColorForType(type: Notification['type']): string {
    switch (type) {
      case 'info': return '#0066cc';
      case 'success': return '#00cc66';
      case 'warning': return '#ff9900';
      case 'error': return '#cc0000';
    }
  }
}

/**
 * Slack Provider
 */
class SlackProvider implements NotificationProvider {
  constructor(private config: SlackConfig) {}

  async send(notification: Notification): Promise<void> {
    const payload = {
      channel: this.config.channel,
      username: this.config.username || 'Agent CLI',
      icon_emoji: this.config.iconEmoji || ':robot_face:',
      attachments: [{
        color: this.getColorForType(notification.type),
        title: notification.title,
        text: notification.message,
        ts: Math.floor(notification.timestamp.getTime() / 1000),
      }],
    };

    // Mock implementation
    console.log('Sending Slack message:', payload);

    // In production: use fetch or axios
    /*
    await fetch(this.config.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    */
  }

  private getColorForType(type: Notification['type']): string {
    switch (type) {
      case 'info': return '#0066cc';
      case 'success': return 'good';
      case 'warning': return 'warning';
      case 'error': return 'danger';
    }
  }
}

/**
 * Discord Provider
 */
class DiscordProvider implements NotificationProvider {
  constructor(private config: DiscordConfig) {}

  async send(notification: Notification): Promise<void> {
    const payload = {
      username: this.config.username || 'Agent CLI',
      avatar_url: this.config.avatarUrl,
      embeds: [{
        title: notification.title,
        description: notification.message,
        color: this.getColorForType(notification.type),
        timestamp: notification.timestamp.toISOString(),
      }],
    };

    // Mock implementation
    console.log('Sending Discord message:', payload);

    // In production: use fetch or axios
    /*
    await fetch(this.config.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    */
  }

  private getColorForType(type: Notification['type']): number {
    switch (type) {
      case 'info': return 0x0066cc;
      case 'success': return 0x00cc66;
      case 'warning': return 0xff9900;
      case 'error': return 0xcc0000;
    }
  }
}

/**
 * Webhook Provider
 */
class WebhookProvider implements NotificationProvider {
  constructor(private config: WebhookConfig) {}

  async send(notification: Notification): Promise<void> {
    const retries = this.config.retries || 3;

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        // Mock implementation
        console.log('Sending webhook:', {
          url: this.config.url,
          method: this.config.method,
          notification,
        });

        // In production: use fetch or axios
        /*
        await fetch(this.config.url, {
          method: this.config.method,
          headers: {
            'Content-Type': 'application/json',
            ...this.config.headers,
          },
          body: JSON.stringify(notification),
        });
        */

        return; // Success
      } catch (error) {
        if (attempt === retries - 1) throw error;
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
      }
    }
  }
}

/**
 * Push Notification Provider
 */
class PushProvider implements NotificationProvider {
  constructor(private config: PushConfig) {}

  async send(notification: Notification): Promise<void> {
    // Mock implementation
    console.log('Sending push notification:', {
      tokens: this.config.deviceTokens,
      title: notification.title,
      body: notification.message,
    });

    // In production: use Firebase Cloud Messaging or similar
    /*
    const message = {
      notification: {
        title: notification.title,
        body: notification.message,
      },
      tokens: this.config.deviceTokens,
    };

    await admin.messaging().sendMulticast(message);
    */
  }
}

/**
 * SMS Provider
 */
class SMSProvider implements NotificationProvider {
  constructor(private config: SMSConfig) {}

  async send(notification: Notification): Promise<void> {
    const message = `${notification.title}\n\n${notification.message}`;

    // Mock implementation
    console.log('Sending SMS:', {
      provider: this.config.provider,
      from: this.config.from,
      to: this.config.to,
      message,
    });

    // In production: use Twilio or AWS SNS
    /*
    if (this.config.provider === 'twilio') {
      const client = require('twilio')(this.config.accountSid, this.config.authToken);

      for (const to of this.config.to) {
        await client.messages.create({
          body: message,
          from: this.config.from,
          to,
        });
      }
    }
    */
  }
}

/**
 * Notification Templates
 */
export class NotificationTemplates {
  private templates: Map<string, string> = new Map();

  /**
   * Register template
   */
  register(name: string, template: string): void {
    this.templates.set(name, template);
  }

  /**
   * Render template
   */
  render(name: string, data: Record<string, any>): string {
    const template = this.templates.get(name);
    if (!template) {
      throw new Error(`Template not found: ${name}`);
    }

    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
      return data[key] || '';
    });
  }

  /**
   * Get default templates
   */
  static getDefaults(): Map<string, string> {
    const templates = new Map<string, string>();

    templates.set('task_completed',
      'Task "{{taskName}}" completed successfully in {{duration}}ms'
    );

    templates.set('error_occurred',
      'Error in {{component}}: {{errorMessage}}'
    );

    templates.set('backup_completed',
      'Backup completed: {{fileCount}} files, {{size}} total'
    );

    templates.set('deployment_success',
      'Deployment to {{environment}} succeeded (version {{version}})'
    );

    return templates;
  }
}

/**
 * Singleton instances
 */
export const notificationManager = new NotificationManager();
export const notificationTemplates = new NotificationTemplates();

// Load default templates
for (const [name, template] of NotificationTemplates.getDefaults()) {
  notificationTemplates.register(name, template);
}
