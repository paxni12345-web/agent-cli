"use strict";
/**
 * Advanced Notification System
 * Multi-channel delivery (email, SMS, push, webhook, Slack)
 * Template management, scheduling, delivery tracking, retry logic
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationManager = void 0;
const events_1 = require("events");
// ============================================================================
// Notification Manager
// ============================================================================
class NotificationManager extends events_1.EventEmitter {
    config;
    notifications = new Map();
    templates = new Map();
    batches = new Map();
    rules = new Map();
    queue = [];
    recipients = new Map();
    emailConfig;
    smsConfig;
    pushConfig;
    slackConfig;
    constructor(config = {}) {
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
    configureEmail(config) {
        if (!this.config.enableEmail) {
            throw new Error('Email channel is not enabled');
        }
        this.emailConfig = config;
        this.emit('channel:configured', { channel: 'email' });
    }
    configureSMS(config) {
        if (!this.config.enableSMS) {
            throw new Error('SMS channel is not enabled');
        }
        this.smsConfig = config;
        this.emit('channel:configured', { channel: 'sms' });
    }
    configurePush(config) {
        if (!this.config.enablePush) {
            throw new Error('Push channel is not enabled');
        }
        this.pushConfig = config;
        this.emit('channel:configured', { channel: 'push' });
    }
    configureSlack(config) {
        if (!this.config.enableSlack) {
            throw new Error('Slack channel is not enabled');
        }
        this.slackConfig = config;
        this.emit('channel:configured', { channel: 'slack' });
    }
    // ========================================================================
    // Notification Creation & Sending
    // ========================================================================
    async send(recipient, channel, content, options = {}) {
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
        const notification = {
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
        }
        else {
            notification.status = 'queued';
            this.queue.push(notification.id);
        }
        this.emit('notification:created', { notification });
        return notification;
    }
    async sendBatch(notifications) {
        const batch = {
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
                const notification = await this.send(notif.recipient, notif.channel, notif.content, notif.options);
                batch.notifications.push(notification.id);
            }
            catch (error) {
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
    createTemplate(name, channel, content, options = {}) {
        const variables = this.extractVariables(content);
        const template = {
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
    getTemplate(id) {
        return this.templates.get(id);
    }
    getTemplateByName(name) {
        return Array.from(this.templates.values()).find(t => t.name === name);
    }
    applyTemplate(notification) {
        const template = this.templates.get(notification.template) ||
            this.getTemplateByName(notification.template);
        if (!template) {
            throw new Error(`Template not found: ${notification.template}`);
        }
        if (template.channel !== notification.channel) {
            throw new Error(`Template channel mismatch: expected ${template.channel}, got ${notification.channel}`);
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
                    notification.subject = notification.subject.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
                }
            }
        }
    }
    extractVariables(content) {
        const variables = new Set();
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
    startQueueProcessor() {
        setInterval(() => {
            this.processQueue();
        }, 1000);
    }
    async processQueue() {
        if (this.queue.length === 0)
            return;
        const batchSize = Math.min(this.queue.length, this.config.batchSize);
        const batch = this.queue.splice(0, batchSize);
        for (const notificationId of batch) {
            const notification = this.notifications.get(notificationId);
            if (!notification)
                continue;
            try {
                await this.deliver(notification);
            }
            catch (error) {
                this.emit('notification:error', { notification, error });
            }
        }
    }
    async deliver(notification) {
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
            const attempt = {
                id: this.generateId(),
                timestamp: Date.now(),
                status: success ? 'success' : 'failed',
                duration: Date.now() - startTime,
            };
            notification.delivery.attempts.push(attempt);
            if (success) {
                notification.status = 'sent';
                notification.delivery.deliveredAt = Date.now();
                this.emit('notification:sent', { notification });
            }
            else {
                await this.handleDeliveryFailure(notification);
            }
        }
        catch (error) {
            const attempt = {
                id: this.generateId(),
                timestamp: Date.now(),
                status: 'failed',
                error: error instanceof Error ? error.message : 'Unknown error',
                duration: Date.now() - startTime,
            };
            notification.delivery.attempts.push(attempt);
            await this.handleDeliveryFailure(notification);
        }
    }
    async handleDeliveryFailure(notification) {
        const attempts = notification.delivery.attempts.length;
        if (attempts < this.config.defaultRetryAttempts) {
            // Schedule retry
            notification.status = 'queued';
            notification.delivery.nextRetryAt =
                Date.now() + this.config.retryDelay * Math.pow(2, attempts - 1);
            setTimeout(() => {
                this.queue.push(notification.id);
            }, this.config.retryDelay * Math.pow(2, attempts - 1));
            this.emit('notification:retry:scheduled', { notification });
        }
        else {
            // Max retries exceeded
            notification.status = 'failed';
            notification.delivery.failedAt = Date.now();
            this.emit('notification:failed', { notification });
        }
    }
    // ========================================================================
    // Channel Delivery Methods
    // ========================================================================
    async deliverEmail(notification) {
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
    async deliverSMS(notification) {
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
    async deliverPush(notification) {
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
    async deliverWebhook(notification) {
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
    async deliverSlack(notification) {
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
    registerRecipient(recipient) {
        this.recipients.set(recipient.id, recipient);
        this.emit('recipient:registered', { recipient });
    }
    updateRecipientPreferences(recipientId, preferences) {
        const recipient = this.recipients.get(recipientId);
        if (!recipient) {
            throw new Error(`Recipient not found: ${recipientId}`);
        }
        recipient.preferences = preferences;
        this.emit('recipient:preferences:updated', { recipient });
    }
    canSendToRecipient(recipient, channel, type) {
        if (!recipient.preferences)
            return true;
        const { channels, types } = recipient.preferences;
        if (channels && channels.size > 0 && !channels.has(channel)) {
            return false;
        }
        if (types && types.size > 0 && !types.has(type)) {
            return false;
        }
        return true;
    }
    isInQuietHours(recipient) {
        if (!recipient.preferences?.quietHours?.enabled)
            return false;
        const { startHour, endHour } = recipient.preferences.quietHours;
        const now = new Date();
        const currentHour = now.getHours();
        if (startHour < endHour) {
            return currentHour >= startHour && currentHour < endHour;
        }
        else {
            return currentHour >= startHour || currentHour < endHour;
        }
    }
    checkFrequencyLimit(recipient) {
        if (!recipient.preferences?.frequency)
            return true;
        const { maxPerHour, maxPerDay, maxPerWeek } = recipient.preferences.frequency;
        const now = Date.now();
        const recentNotifications = Array.from(this.notifications.values()).filter(n => n.recipient.id === recipient.id && n.status === 'sent');
        if (maxPerHour) {
            const hourAgo = now - 3600000;
            const countHour = recentNotifications.filter(n => n.metadata.createdAt > hourAgo).length;
            if (countHour >= maxPerHour)
                return false;
        }
        if (maxPerDay) {
            const dayAgo = now - 86400000;
            const countDay = recentNotifications.filter(n => n.metadata.createdAt > dayAgo).length;
            if (countDay >= maxPerDay)
                return false;
        }
        if (maxPerWeek) {
            const weekAgo = now - 604800000;
            const countWeek = recentNotifications.filter(n => n.metadata.createdAt > weekAgo).length;
            if (countWeek >= maxPerWeek)
                return false;
        }
        return true;
    }
    // ========================================================================
    // Rules & Automation
    // ========================================================================
    createRule(rule) {
        const full = {
            ...rule,
            id: this.generateId(),
        };
        this.rules.set(full.id, full);
        this.emit('rule:created', { rule: full });
        return full;
    }
    evaluateRules(context) {
        const matchedRules = [];
        for (const rule of this.rules.values()) {
            if (!rule.enabled)
                continue;
            if (this.evaluateCondition(rule.condition, context)) {
                matchedRules.push(rule);
                rule.metadata.triggerCount++;
            }
        }
        return matchedRules;
    }
    evaluateCondition(condition, context) {
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
    scheduleNotification(notification) {
        const delay = notification.scheduledFor - Date.now();
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
    cancelNotification(id) {
        const notification = this.notifications.get(id);
        if (!notification)
            return;
        if (['pending', 'scheduled', 'queued'].includes(notification.status)) {
            notification.status = 'cancelled';
            this.queue = this.queue.filter(nid => nid !== id);
            this.emit('notification:cancelled', { notification });
        }
    }
    // ========================================================================
    // Statistics & Monitoring
    // ========================================================================
    getStats() {
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
    getNotification(id) {
        return this.notifications.get(id);
    }
    getBatch(id) {
        return this.batches.get(id);
    }
    // ========================================================================
    // Utilities
    // ========================================================================
    generateId() {
        return `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
}
exports.NotificationManager = NotificationManager;
// ============================================================================
// Export
// ============================================================================
exports.default = NotificationManager;
