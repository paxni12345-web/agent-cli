"use strict";
/**
 * Message Queue System
 * Advanced message queuing, pub/sub, dead letter handling, and message routing
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.exchangeManager = exports.topicManager = exports.consumerManager = exports.queueManager = exports.ExchangeManager = exports.TopicManager = exports.ConsumerManager = exports.QueueManager = exports.TransactionStatus = exports.OperationStatus = exports.OperationType = exports.BatchStatus = exports.ExchangeType = exports.SubscriptionStatus = exports.CompressionType = exports.ConsumerStatus = exports.BackoffType = exports.MessageStatus = exports.QueueStatus = exports.QueueType = void 0;
const EventBus_1 = require("../core/EventBus");
var QueueType;
(function (QueueType) {
    QueueType["FIFO"] = "fifo";
    QueueType["Priority"] = "priority";
    QueueType["Delay"] = "delay";
    QueueType["Standard"] = "standard";
})(QueueType || (exports.QueueType = QueueType = {}));
var QueueStatus;
(function (QueueStatus) {
    QueueStatus["Active"] = "active";
    QueueStatus["Paused"] = "paused";
    QueueStatus["Draining"] = "draining";
    QueueStatus["Stopped"] = "stopped";
})(QueueStatus || (exports.QueueStatus = QueueStatus = {}));
var MessageStatus;
(function (MessageStatus) {
    MessageStatus["Pending"] = "pending";
    MessageStatus["InFlight"] = "in_flight";
    MessageStatus["Processed"] = "processed";
    MessageStatus["Failed"] = "failed";
    MessageStatus["DeadLetter"] = "dead_letter";
})(MessageStatus || (exports.MessageStatus = MessageStatus = {}));
var BackoffType;
(function (BackoffType) {
    BackoffType["Fixed"] = "fixed";
    BackoffType["Linear"] = "linear";
    BackoffType["Exponential"] = "exponential";
})(BackoffType || (exports.BackoffType = BackoffType = {}));
var ConsumerStatus;
(function (ConsumerStatus) {
    ConsumerStatus["Running"] = "running";
    ConsumerStatus["Paused"] = "paused";
    ConsumerStatus["Stopped"] = "stopped";
    ConsumerStatus["Error"] = "error";
})(ConsumerStatus || (exports.ConsumerStatus = ConsumerStatus = {}));
var CompressionType;
(function (CompressionType) {
    CompressionType["None"] = "none";
    CompressionType["Gzip"] = "gzip";
    CompressionType["Snappy"] = "snappy";
    CompressionType["LZ4"] = "lz4";
    CompressionType["Zstd"] = "zstd";
})(CompressionType || (exports.CompressionType = CompressionType = {}));
var SubscriptionStatus;
(function (SubscriptionStatus) {
    SubscriptionStatus["Active"] = "active";
    SubscriptionStatus["Paused"] = "paused";
    SubscriptionStatus["Deleted"] = "deleted";
})(SubscriptionStatus || (exports.SubscriptionStatus = SubscriptionStatus = {}));
var ExchangeType;
(function (ExchangeType) {
    ExchangeType["Direct"] = "direct";
    ExchangeType["Topic"] = "topic";
    ExchangeType["Fanout"] = "fanout";
    ExchangeType["Headers"] = "headers";
})(ExchangeType || (exports.ExchangeType = ExchangeType = {}));
var BatchStatus;
(function (BatchStatus) {
    BatchStatus["Pending"] = "pending";
    BatchStatus["Processing"] = "processing";
    BatchStatus["Completed"] = "completed";
    BatchStatus["Failed"] = "failed";
})(BatchStatus || (exports.BatchStatus = BatchStatus = {}));
var OperationType;
(function (OperationType) {
    OperationType["Send"] = "send";
    OperationType["Receive"] = "receive";
    OperationType["Delete"] = "delete";
    OperationType["ChangeVisibility"] = "change_visibility";
})(OperationType || (exports.OperationType = OperationType = {}));
var OperationStatus;
(function (OperationStatus) {
    OperationStatus["Pending"] = "pending";
    OperationStatus["Committed"] = "committed";
    OperationStatus["RolledBack"] = "rolled_back";
})(OperationStatus || (exports.OperationStatus = OperationStatus = {}));
var TransactionStatus;
(function (TransactionStatus) {
    TransactionStatus["Active"] = "active";
    TransactionStatus["Committed"] = "committed";
    TransactionStatus["RolledBack"] = "rolled_back";
})(TransactionStatus || (exports.TransactionStatus = TransactionStatus = {}));
/**
 * Queue Manager
 */
class QueueManager {
    queues = new Map();
    messages = new Map();
    /**
     * Create queue
     */
    createQueue(config) {
        const queue = {
            ...config,
            id: this.generateQueueId(),
            status: QueueStatus.Active,
            metrics: {
                totalMessages: 0,
                visibleMessages: 0,
                inFlightMessages: 0,
                delayedMessages: 0,
                oldestMessageAge: 0,
                approximateSize: 0,
            },
            createdAt: new Date(),
        };
        this.queues.set(queue.id, queue);
        this.messages.set(queue.id, []);
        EventBus_1.eventBus.emitSync('mq.queue_created', queue, 'QueueManager');
        return queue;
    }
    /**
     * Send message
     */
    async sendMessage(queueId, body, attributes) {
        const queue = this.queues.get(queueId);
        if (!queue) {
            throw new Error(`Queue not found: ${queueId}`);
        }
        if (queue.status !== QueueStatus.Active) {
            throw new Error(`Queue is not active: ${queueId}`);
        }
        const message = {
            id: this.generateMessageId(),
            queueId,
            body,
            attributes: {
                custom: {},
                ...attributes,
            },
            systemAttributes: {
                senderId: 'system',
                messageId: this.generateMessageId(),
                approximateReceiveCount: 0,
                sentTimestamp: new Date(),
            },
            status: MessageStatus.Pending,
            createdAt: new Date(),
            sentAt: new Date(),
        };
        const queueMessages = this.messages.get(queueId);
        queueMessages.push(message);
        // Update metrics
        queue.metrics.totalMessages++;
        queue.metrics.visibleMessages++;
        queue.metrics.approximateSize += JSON.stringify(body).length;
        EventBus_1.eventBus.emitSync('mq.message_sent', message, 'QueueManager');
        return message;
    }
    /**
     * Receive messages
     */
    async receiveMessages(queueId, maxMessages = 1) {
        const queue = this.queues.get(queueId);
        if (!queue) {
            throw new Error(`Queue not found: ${queueId}`);
        }
        const queueMessages = this.messages.get(queueId);
        const available = queueMessages.filter(m => m.status === MessageStatus.Pending);
        const messages = available.slice(0, maxMessages);
        for (const message of messages) {
            message.status = MessageStatus.InFlight;
            message.receivedAt = new Date();
            message.systemAttributes.approximateReceiveCount++;
            if (!message.systemAttributes.approximateFirstReceiveTimestamp) {
                message.systemAttributes.approximateFirstReceiveTimestamp = new Date();
            }
        }
        // Update metrics
        queue.metrics.visibleMessages -= messages.length;
        queue.metrics.inFlightMessages += messages.length;
        EventBus_1.eventBus.emitSync('mq.messages_received', { queueId, count: messages.length }, 'QueueManager');
        return messages;
    }
    /**
     * Delete message
     */
    async deleteMessage(queueId, messageId) {
        const queue = this.queues.get(queueId);
        if (!queue) {
            throw new Error(`Queue not found: ${queueId}`);
        }
        const queueMessages = this.messages.get(queueId);
        const index = queueMessages.findIndex(m => m.id === messageId);
        if (index !== -1) {
            const message = queueMessages[index];
            message.status = MessageStatus.Processed;
            message.deletedAt = new Date();
            queueMessages.splice(index, 1);
            // Update metrics
            queue.metrics.inFlightMessages--;
            EventBus_1.eventBus.emitSync('mq.message_deleted', { queueId, messageId }, 'QueueManager');
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
    listQueues(filter) {
        let queues = Array.from(this.queues.values());
        if (filter?.type) {
            queues = queues.filter(q => q.type === filter.type);
        }
        if (filter?.status) {
            queues = queues.filter(q => q.status === filter.status);
        }
        return queues;
    }
    /**
     * Purge queue
     */
    async purgeQueue(queueId) {
        const queue = this.queues.get(queueId);
        if (!queue) {
            throw new Error(`Queue not found: ${queueId}`);
        }
        const queueMessages = this.messages.get(queueId);
        const count = queueMessages.length;
        this.messages.set(queueId, []);
        // Reset metrics
        queue.metrics.totalMessages = 0;
        queue.metrics.visibleMessages = 0;
        queue.metrics.inFlightMessages = 0;
        queue.metrics.approximateSize = 0;
        EventBus_1.eventBus.emitSync('mq.queue_purged', { queueId, count }, 'QueueManager');
        return count;
    }
    generateQueueId() {
        return `queue_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
    generateMessageId() {
        return `msg_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
}
exports.QueueManager = QueueManager;
/**
 * Consumer Manager
 */
class ConsumerManager {
    consumers = new Map();
    queueManager;
    intervals = new Map();
    constructor(queueManager) {
        this.queueManager = queueManager;
    }
    /**
     * Create consumer
     */
    createConsumer(config) {
        const consumer = {
            ...config,
            id: this.generateConsumerId(),
            status: ConsumerStatus.Stopped,
            metrics: {
                messagesProcessed: 0,
                messagesSucceeded: 0,
                messagesFailed: 0,
                averageProcessingTime: 0,
            },
            createdAt: new Date(),
        };
        this.consumers.set(consumer.id, consumer);
        EventBus_1.eventBus.emitSync('mq.consumer_created', consumer, 'ConsumerManager');
        return consumer;
    }
    /**
     * Start consumer
     */
    async startConsumer(consumerId) {
        const consumer = this.consumers.get(consumerId);
        if (!consumer) {
            throw new Error(`Consumer not found: ${consumerId}`);
        }
        if (consumer.status === ConsumerStatus.Running) {
            return;
        }
        consumer.status = ConsumerStatus.Running;
        // Start polling
        const interval = setInterval(() => {
            this.pollMessages(consumer);
        }, 1000);
        this.intervals.set(consumerId, interval);
        EventBus_1.eventBus.emitSync('mq.consumer_started', consumer, 'ConsumerManager');
    }
    /**
     * Stop consumer
     */
    async stopConsumer(consumerId) {
        const consumer = this.consumers.get(consumerId);
        if (!consumer) {
            throw new Error(`Consumer not found: ${consumerId}`);
        }
        consumer.status = ConsumerStatus.Stopped;
        const interval = this.intervals.get(consumerId);
        if (interval) {
            clearInterval(interval);
            this.intervals.delete(consumerId);
        }
        EventBus_1.eventBus.emitSync('mq.consumer_stopped', consumer, 'ConsumerManager');
    }
    /**
     * Get consumer
     */
    getConsumer(consumerId) {
        return this.consumers.get(consumerId);
    }
    /**
     * List consumers
     */
    listConsumers(queueId) {
        let consumers = Array.from(this.consumers.values());
        if (queueId) {
            consumers = consumers.filter(c => c.queueId === queueId);
        }
        return consumers;
    }
    async pollMessages(consumer) {
        if (consumer.status !== ConsumerStatus.Running) {
            return;
        }
        try {
            const messages = await this.queueManager.receiveMessages(consumer.queueId, consumer.config.batchSize);
            for (const message of messages) {
                await this.processMessage(consumer, message);
            }
        }
        catch (error) {
            consumer.status = ConsumerStatus.Error;
            EventBus_1.eventBus.emitSync('mq.consumer_error', { consumer, error }, 'ConsumerManager');
        }
    }
    async processMessage(consumer, message) {
        const startTime = Date.now();
        try {
            await consumer.handler.process(message);
            consumer.metrics.messagesProcessed++;
            consumer.metrics.messagesSucceeded++;
            consumer.metrics.lastProcessedAt = new Date();
            const duration = Date.now() - startTime;
            consumer.metrics.averageProcessingTime =
                (consumer.metrics.averageProcessingTime * (consumer.metrics.messagesProcessed - 1) + duration) /
                    consumer.metrics.messagesProcessed;
            if (consumer.config.autoAck) {
                await this.queueManager.deleteMessage(message.queueId, message.id);
            }
        }
        catch (error) {
            consumer.metrics.messagesProcessed++;
            consumer.metrics.messagesFailed++;
            // Check retry policy
            if (message.systemAttributes.approximateReceiveCount < consumer.config.retryPolicy.maxAttempts) {
                // Return to queue for retry
                message.status = MessageStatus.Pending;
            }
            else {
                // Move to dead letter queue
                message.status = MessageStatus.DeadLetter;
            }
        }
    }
    generateConsumerId() {
        return `consumer_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
}
exports.ConsumerManager = ConsumerManager;
/**
 * Topic Manager
 */
class TopicManager {
    topics = new Map();
    /**
     * Create topic
     */
    createTopic(config) {
        const topic = {
            ...config,
            id: this.generateTopicId(),
            subscriptions: [],
            metrics: {
                totalMessages: 0,
                messagesPerSecond: 0,
                bytesPerSecond: 0,
                subscriptionCount: 0,
            },
            createdAt: new Date(),
        };
        this.topics.set(topic.id, topic);
        EventBus_1.eventBus.emitSync('mq.topic_created', topic, 'TopicManager');
        return topic;
    }
    /**
     * Publish message
     */
    async publish(topicId, message, attributes) {
        const topic = this.topics.get(topicId);
        if (!topic) {
            throw new Error(`Topic not found: ${topicId}`);
        }
        topic.metrics.totalMessages++;
        // Publish to all matching subscriptions
        for (const subscription of topic.subscriptions) {
            if (this.matchesFilter(message, attributes, subscription.filter)) {
                EventBus_1.eventBus.emitSync('mq.message_published', { topicId, subscriptionId: subscription.id, message }, 'TopicManager');
            }
        }
    }
    /**
     * Subscribe
     */
    subscribe(topicId, config) {
        const topic = this.topics.get(topicId);
        if (!topic) {
            throw new Error(`Topic not found: ${topicId}`);
        }
        const subscription = {
            ...config,
            id: this.generateSubscriptionId(),
            topicId,
            status: SubscriptionStatus.Active,
            createdAt: new Date(),
        };
        topic.subscriptions.push(subscription);
        topic.metrics.subscriptionCount++;
        EventBus_1.eventBus.emitSync('mq.subscription_created', subscription, 'TopicManager');
        return subscription;
    }
    /**
     * Get topic
     */
    getTopic(topicId) {
        return this.topics.get(topicId);
    }
    /**
     * List topics
     */
    listTopics() {
        return Array.from(this.topics.values());
    }
    matchesFilter(message, attributes, filter) {
        if (!filter) {
            return true;
        }
        if (filter.attributes && attributes) {
            for (const [key, value] of Object.entries(filter.attributes)) {
                if (attributes[key] !== value) {
                    return false;
                }
            }
        }
        if (filter.contentType && attributes?.contentType !== filter.contentType) {
            return false;
        }
        return true;
    }
    generateTopicId() {
        return `topic_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
    generateSubscriptionId() {
        return `sub_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
}
exports.TopicManager = TopicManager;
/**
 * Exchange Manager
 */
class ExchangeManager {
    exchanges = new Map();
    queueManager;
    constructor(queueManager) {
        this.queueManager = queueManager;
    }
    /**
     * Create exchange
     */
    createExchange(config) {
        const exchange = {
            ...config,
            id: this.generateExchangeId(),
            bindings: [],
            createdAt: new Date(),
        };
        this.exchanges.set(exchange.id, exchange);
        EventBus_1.eventBus.emitSync('mq.exchange_created', exchange, 'ExchangeManager');
        return exchange;
    }
    /**
     * Bind queue
     */
    bindQueue(exchangeId, queueId, routingKey, args) {
        const exchange = this.exchanges.get(exchangeId);
        if (!exchange) {
            throw new Error(`Exchange not found: ${exchangeId}`);
        }
        const binding = {
            id: this.generateBindingId(),
            exchangeId,
            queueId,
            routingKey,
            arguments: args,
        };
        exchange.bindings.push(binding);
        EventBus_1.eventBus.emitSync('mq.queue_bound', binding, 'ExchangeManager');
        return binding;
    }
    /**
     * Publish to exchange
     */
    async publish(exchangeId, routingKey, message, attributes) {
        const exchange = this.exchanges.get(exchangeId);
        if (!exchange) {
            throw new Error(`Exchange not found: ${exchangeId}`);
        }
        const matchingBindings = this.getMatchingBindings(exchange, routingKey);
        for (const binding of matchingBindings) {
            await this.queueManager.sendMessage(binding.queueId, message, attributes);
        }
    }
    /**
     * Get exchange
     */
    getExchange(exchangeId) {
        return this.exchanges.get(exchangeId);
    }
    /**
     * List exchanges
     */
    listExchanges(type) {
        let exchanges = Array.from(this.exchanges.values());
        if (type) {
            exchanges = exchanges.filter(e => e.type === type);
        }
        return exchanges;
    }
    getMatchingBindings(exchange, routingKey) {
        switch (exchange.type) {
            case ExchangeType.Direct:
                return exchange.bindings.filter(b => b.routingKey === routingKey);
            case ExchangeType.Fanout:
                return exchange.bindings;
            case ExchangeType.Topic:
                return exchange.bindings.filter(b => this.matchTopicPattern(routingKey, b.routingKey));
            default:
                return [];
        }
    }
    matchTopicPattern(routingKey, pattern) {
        const routingParts = routingKey.split('.');
        const patternParts = pattern.split('.');
        if (patternParts.length !== routingParts.length) {
            return false;
        }
        for (let i = 0; i < patternParts.length; i++) {
            if (patternParts[i] !== '*' && patternParts[i] !== routingParts[i]) {
                return false;
            }
        }
        return true;
    }
    generateExchangeId() {
        return `exchange_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
    generateBindingId() {
        return `binding_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
}
exports.ExchangeManager = ExchangeManager;
/**
 * Singleton instances
 */
exports.queueManager = new QueueManager();
exports.consumerManager = new ConsumerManager(exports.queueManager);
exports.topicManager = new TopicManager();
exports.exchangeManager = new ExchangeManager(exports.queueManager);
