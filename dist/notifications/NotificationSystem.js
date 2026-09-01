"use strict";
/**
 * Notification System
 * Multi-channel notifications: email, Slack, Discord, webhooks, push notifications
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationTemplates = exports.notificationManager = exports.NotificationTemplates = exports.NotificationManager = void 0;
const EventBus_1 = require("../core/EventBus");
/**
 * Notification Manager
 */
class NotificationManager {
    notifications = new Map();
    rules = new Map();
    config;
    providers = new Map();
    /**
     * Configure notification system
     */
    configure(config) {
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
    async send(notification) {
        const fullNotification = {
            ...notification,
            id: this.generateNotificationId(),
            timestamp: new Date(),
        };
        this.notifications.set(fullNotification.id, fullNotification);
        // Send through all specified channels
        const results = await Promise.allSettled(notification.channels.map(async (channel) => {
            const provider = this.providers.get(channel);
            if (provider) {
                await provider.send(fullNotification);
            }
        }));
        // Log failures
        results.forEach((result, index) => {
            if (result.status === 'rejected') {
                console.error(`Failed to send notification via ${notification.channels[index]}:`, result.reason);
            }
        });
        EventBus_1.eventBus.emitSync('notification.sent', fullNotification, 'NotificationManager');
        return fullNotification;
    }
    /**
     * Add notification rule
     */
    addRule(rule) {
        this.rules.set(rule.id, rule);
        // Subscribe to event
        EventBus_1.eventBus.on(rule.eventType, async (event) => {
            if (!rule.enabled)
                return;
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
        EventBus_1.eventBus.emitSync('notification.rule_added', rule, 'NotificationManager');
    }
    /**
     * Remove notification rule
     */
    removeRule(ruleId) {
        this.rules.delete(ruleId);
        EventBus_1.eventBus.emitSync('notification.rule_removed', { ruleId }, 'NotificationManager');
    }
    /**
     * Enable/disable rule
     */
    toggleRule(ruleId, enabled) {
        const rule = this.rules.get(ruleId);
        if (rule) {
            rule.enabled = enabled;
        }
    }
    /**
     * Get notification by ID
     */
    getNotification(id) {
        return this.notifications.get(id);
    }
    /**
     * List notifications
     */
    listNotifications(filter) {
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
    markAsRead(id) {
        const notification = this.notifications.get(id);
        if (notification) {
            notification.read = true;
            EventBus_1.eventBus.emitSync('notification.read', { id }, 'NotificationManager');
        }
    }
    /**
     * Mark all as read
     */
    markAllAsRead() {
        for (const notification of this.notifications.values()) {
            notification.read = true;
        }
    }
    /**
     * Clear old notifications
     */
    clearOld(olderThanDays) {
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
    getStats() {
        const notifications = Array.from(this.notifications.values());
        const byType = {};
        const byChannel = {};
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
    generateNotificationId() {
        return `notif_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
    applyTemplate(template, event) {
        return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
            return event.data?.[key] || event[key] || '';
        });
    }
    getPriorityType(priority) {
        switch (priority) {
            case 'low': return 'info';
            case 'medium': return 'info';
            case 'high': return 'warning';
            case 'urgent': return 'error';
        }
    }
}
exports.NotificationManager = NotificationManager;
/**
 * Email Provider
 */
class EmailProvider {
    config;
    constructor(config) {
        this.config = config;
    }
    async send(notification) {
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
    formatAsHTML(notification) {
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
    getColorForType(type) {
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
class SlackProvider {
    config;
    constructor(config) {
        this.config = config;
    }
    async send(notification) {
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
    getColorForType(type) {
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
class DiscordProvider {
    config;
    constructor(config) {
        this.config = config;
    }
    async send(notification) {
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
    getColorForType(type) {
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
class WebhookProvider {
    config;
    constructor(config) {
        this.config = config;
    }
    async send(notification) {
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
            }
            catch (error) {
                if (attempt === retries - 1)
                    throw error;
                await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
            }
        }
    }
}
/**
 * Push Notification Provider
 */
class PushProvider {
    config;
    constructor(config) {
        this.config = config;
    }
    async send(notification) {
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
class SMSProvider {
    config;
    constructor(config) {
        this.config = config;
    }
    async send(notification) {
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
class NotificationTemplates {
    templates = new Map();
    /**
     * Register template
     */
    register(name, template) {
        this.templates.set(name, template);
    }
    /**
     * Render template
     */
    render(name, data) {
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
    static getDefaults() {
        const templates = new Map();
        templates.set('task_completed', 'Task "{{taskName}}" completed successfully in {{duration}}ms');
        templates.set('error_occurred', 'Error in {{component}}: {{errorMessage}}');
        templates.set('backup_completed', 'Backup completed: {{fileCount}} files, {{size}} total');
        templates.set('deployment_success', 'Deployment to {{environment}} succeeded (version {{version}})');
        return templates;
    }
}
exports.NotificationTemplates = NotificationTemplates;
/**
 * Singleton instances
 */
exports.notificationManager = new NotificationManager();
exports.notificationTemplates = new NotificationTemplates();
// Load default templates
for (const [name, template] of NotificationTemplates.getDefaults()) {
    exports.notificationTemplates.register(name, template);
}
