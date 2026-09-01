"use strict";
/**
 * Notification and Messaging System
 * Push notifications, email, SMS, in-app messaging, and message queuing
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.batchNotificationManager = exports.messageQueueManager = exports.pushNotificationService = exports.smsService = exports.emailService = exports.notificationManager = exports.BatchNotificationManager = exports.MessageQueueManager = exports.PushNotificationService = exports.SMSService = exports.EmailService = exports.NotificationManager = exports.BatchStatus = exports.MessageStatus = exports.NotificationPriority = exports.NotificationChannel = exports.NotificationStatus = exports.NotificationType = void 0;
const EventBus_1 = require("../core/EventBus");
var NotificationType;
(function (NotificationType) {
    NotificationType["Info"] = "info";
    NotificationType["Success"] = "success";
    NotificationType["Warning"] = "warning";
    NotificationType["Error"] = "error";
    NotificationType["Alert"] = "alert";
})(NotificationType || (exports.NotificationType = NotificationType = {}));
var NotificationStatus;
(function (NotificationStatus) {
    NotificationStatus["Pending"] = "pending";
    NotificationStatus["Scheduled"] = "scheduled";
    NotificationStatus["Sending"] = "sending";
    NotificationStatus["Sent"] = "sent";
    NotificationStatus["Delivered"] = "delivered";
    NotificationStatus["Failed"] = "failed";
    NotificationStatus["Read"] = "read";
})(NotificationStatus || (exports.NotificationStatus = NotificationStatus = {}));
var NotificationChannel;
(function (NotificationChannel) {
    NotificationChannel["Push"] = "push";
    NotificationChannel["Email"] = "email";
    NotificationChannel["SMS"] = "sms";
    NotificationChannel["InApp"] = "in_app";
    NotificationChannel["Webhook"] = "webhook";
})(NotificationChannel || (exports.NotificationChannel = NotificationChannel = {}));
var NotificationPriority;
(function (NotificationPriority) {
    NotificationPriority["Low"] = "low";
    NotificationPriority["Normal"] = "normal";
    NotificationPriority["High"] = "high";
    NotificationPriority["Urgent"] = "urgent";
})(NotificationPriority || (exports.NotificationPriority = NotificationPriority = {}));
var MessageStatus;
(function (MessageStatus) {
    MessageStatus["Queued"] = "queued";
    MessageStatus["Processing"] = "processing";
    MessageStatus["Completed"] = "completed";
    MessageStatus["Failed"] = "failed";
    MessageStatus["DeadLetter"] = "dead_letter";
})(MessageStatus || (exports.MessageStatus = MessageStatus = {}));
var BatchStatus;
(function (BatchStatus) {
    BatchStatus["Pending"] = "pending";
    BatchStatus["Processing"] = "processing";
    BatchStatus["Completed"] = "completed";
    BatchStatus["Failed"] = "failed";
})(BatchStatus || (exports.BatchStatus = BatchStatus = {}));
/**
 * Notification Manager
 */
class NotificationManager {
    notifications = new Map();
    templates = new Map();
    preferences = new Map();
    /**
     * Send notification
     */
    async sendNotification(notification) {
        const fullNotification = {
            ...notification,
            id: this.generateNotificationId(),
            status: notification.scheduledFor ? NotificationStatus.Scheduled : NotificationStatus.Pending,
            createdAt: new Date(),
        };
        this.notifications.set(fullNotification.id, fullNotification);
        // Check user preferences
        const prefs = this.preferences.get(fullNotification.recipient);
        if (prefs) {
            fullNotification.channels = fullNotification.channels.filter(channel => prefs.channels[channel]?.enabled);
            // Check quiet hours
            if (this.isQuietHours(prefs)) {
                fullNotification.scheduledFor = this.getNextActiveTime(prefs);
                fullNotification.status = NotificationStatus.Scheduled;
            }
        }
        EventBus_1.eventBus.emitSync('notification.created', fullNotification, 'NotificationManager');
        // Send immediately if not scheduled
        if (!fullNotification.scheduledFor) {
            await this.sendNotificationChannels(fullNotification);
        }
        return fullNotification;
    }
    /**
     * Send from template
     */
    async sendFromTemplate(templateId, recipient, variables) {
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
    markAsRead(notificationId) {
        const notification = this.notifications.get(notificationId);
        if (notification) {
            notification.status = NotificationStatus.Read;
            notification.readAt = new Date();
            EventBus_1.eventBus.emitSync('notification.read', notification, 'NotificationManager');
        }
    }
    /**
     * Get notification
     */
    getNotification(notificationId) {
        return this.notifications.get(notificationId);
    }
    /**
     * List notifications
     */
    listNotifications(filter) {
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
    registerTemplate(template) {
        const fullTemplate = {
            ...template,
            id: this.generateTemplateId(),
            createdAt: new Date(),
        };
        this.templates.set(fullTemplate.id, fullTemplate);
        EventBus_1.eventBus.emitSync('notification.template_registered', fullTemplate, 'NotificationManager');
        return fullTemplate;
    }
    /**
     * Get template
     */
    getTemplate(templateId) {
        return this.templates.get(templateId);
    }
    /**
     * Update preferences
     */
    updatePreferences(preferences) {
        preferences.updatedAt = new Date();
        this.preferences.set(preferences.userId, preferences);
        EventBus_1.eventBus.emitSync('notification.preferences_updated', preferences, 'NotificationManager');
    }
    /**
     * Get preferences
     */
    getPreferences(userId) {
        return this.preferences.get(userId);
    }
    async sendNotificationChannels(notification) {
        notification.status = NotificationStatus.Sending;
        try {
            for (const channel of notification.channels) {
                await this.sendChannel(notification, channel);
            }
            notification.status = NotificationStatus.Sent;
            notification.sentAt = new Date();
            EventBus_1.eventBus.emitSync('notification.sent', notification, 'NotificationManager');
        }
        catch (error) {
            notification.status = NotificationStatus.Failed;
            EventBus_1.eventBus.emitSync('notification.failed', notification, 'NotificationManager');
        }
    }
    async sendChannel(notification, channel) {
        // Mock channel sending
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    interpolateTemplate(template, variables) {
        let result = template;
        for (const [key, value] of Object.entries(variables)) {
            result = result.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
        }
        return result;
    }
    isQuietHours(prefs) {
        if (!prefs.quietHours?.enabled) {
            return false;
        }
        const now = new Date();
        const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        return currentTime >= prefs.quietHours.start && currentTime <= prefs.quietHours.end;
    }
    getNextActiveTime(prefs) {
        if (!prefs.quietHours) {
            return new Date();
        }
        const [hours, minutes] = prefs.quietHours.end.split(':').map(Number);
        const next = new Date();
        next.setHours(hours, minutes, 0, 0);
        return next;
    }
    generateNotificationId() {
        return `notif_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
    generateTemplateId() {
        return `template_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
}
exports.NotificationManager = NotificationManager;
/**
 * Email Service
 */
class EmailService {
    /**
     * Send email
     */
    async sendEmail(message) {
        // Mock email sending
        await new Promise(resolve => setTimeout(resolve, 200));
        const result = {
            messageId: this.generateMessageId(),
            accepted: message.to,
            rejected: [],
            status: 'sent',
        };
        EventBus_1.eventBus.emitSync('email.sent', result, 'EmailService');
        return result;
    }
    /**
     * Send bulk email
     */
    async sendBulkEmail(messages) {
        const results = [];
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
    generateMessageId() {
        return `msg_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
}
exports.EmailService = EmailService;
/**
 * SMS Service
 */
class SMSService {
    /**
     * Send SMS
     */
    async sendSMS(message) {
        // Mock SMS sending
        await new Promise(resolve => setTimeout(resolve, 150));
        const result = {
            messageId: this.generateMessageId(),
            to: message.to,
            status: 'sent',
            cost: 0.01,
        };
        EventBus_1.eventBus.emitSync('sms.sent', result, 'SMSService');
        return result;
    }
    generateMessageId() {
        return `sms_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
}
exports.SMSService = SMSService;
/**
 * Push Notification Service
 */
class PushNotificationService {
    /**
     * Send push notification
     */
    async sendPush(notification) {
        // Mock push sending
        await new Promise(resolve => setTimeout(resolve, 100));
        const result = {
            messageId: this.generateMessageId(),
            token: notification.token,
            status: 'sent',
        };
        EventBus_1.eventBus.emitSync('push.sent', result, 'PushNotificationService');
        return result;
    }
    /**
     * Send to multiple devices
     */
    async sendMulticast(tokens, notification) {
        const results = [];
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
    generateMessageId() {
        return `push_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
}
exports.PushNotificationService = PushNotificationService;
/**
 * Message Queue Manager
 */
class MessageQueueManager {
    queues = new Map();
    /**
     * Create queue
     */
    createQueue(name, config = {}) {
        const queue = {
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
        EventBus_1.eventBus.emitSync('queue.created', queue, 'MessageQueueManager');
        return queue;
    }
    /**
     * Enqueue message
     */
    enqueue(queueId, payload, priority = 0) {
        const queue = this.queues.get(queueId);
        if (!queue) {
            throw new Error(`Queue not found: ${queueId}`);
        }
        if (queue.messages.length >= queue.config.maxSize) {
            throw new Error(`Queue is full: ${queueId}`);
        }
        const message = {
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
        EventBus_1.eventBus.emitSync('queue.message_enqueued', message, 'MessageQueueManager');
        return message;
    }
    /**
     * Dequeue message
     */
    dequeue(queueId) {
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
        EventBus_1.eventBus.emitSync('queue.message_dequeued', message, 'MessageQueueManager');
        return message;
    }
    /**
     * Complete message
     */
    completeMessage(queueId, messageId) {
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
            EventBus_1.eventBus.emitSync('queue.message_completed', message, 'MessageQueueManager');
        }
    }
    /**
     * Fail message
     */
    failMessage(queueId, messageId, error) {
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
            }
            else {
                message.status = MessageStatus.Queued;
                queue.statistics.processingMessages--;
                queue.statistics.queuedMessages++;
            }
            EventBus_1.eventBus.emitSync('queue.message_failed', message, 'MessageQueueManager');
        }
    }
    /**
     * Get queue
     */
    getQueue(queueId) {
        return this.queues.get(queueId);
    }
    /**
     * List queues
     */
    listQueues() {
        return Array.from(this.queues.values());
    }
    /**
     * Purge queue
     */
    purgeQueue(queueId) {
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
            EventBus_1.eventBus.emitSync('queue.purged', { queueId }, 'MessageQueueManager');
        }
    }
    generateQueueId() {
        return `queue_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
    generateMessageId() {
        return `qmsg_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
}
exports.MessageQueueManager = MessageQueueManager;
/**
 * Batch Notification Manager
 */
class BatchNotificationManager {
    batches = new Map();
    notificationManager;
    constructor(notificationManager) {
        this.notificationManager = notificationManager;
    }
    /**
     * Create batch
     */
    createBatch(batch) {
        const fullBatch = {
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
        EventBus_1.eventBus.emitSync('batch.created', fullBatch, 'BatchNotificationManager');
        return fullBatch;
    }
    /**
     * Process batch
     */
    async processBatch(batchId) {
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
            }
            catch (error) {
                batch.progress.failed++;
            }
            batch.progress.percentage = Math.floor(((batch.progress.sent + batch.progress.failed) / batch.progress.total) * 100);
        }
        batch.status = BatchStatus.Completed;
        batch.completedAt = new Date();
        EventBus_1.eventBus.emitSync('batch.completed', batch, 'BatchNotificationManager');
    }
    /**
     * Get batch
     */
    getBatch(batchId) {
        return this.batches.get(batchId);
    }
    generateBatchId() {
        return `batch_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
}
exports.BatchNotificationManager = BatchNotificationManager;
/**
 * Singleton instances
 */
exports.notificationManager = new NotificationManager();
exports.emailService = new EmailService();
exports.smsService = new SMSService();
exports.pushNotificationService = new PushNotificationService();
exports.messageQueueManager = new MessageQueueManager();
exports.batchNotificationManager = new BatchNotificationManager(exports.notificationManager);
