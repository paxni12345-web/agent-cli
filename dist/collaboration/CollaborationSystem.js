"use strict";
/**
 * Real-time Collaboration System
 * Multi-user editing, presence awareness, conflict resolution, and live cursors
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncEngine = exports.presenceManager = exports.collaborationManager = exports.SyncEngine = exports.PresenceManager = exports.CollaborationManager = exports.MessageType = void 0;
const EventBus_1 = require("../core/EventBus");
var MessageType;
(function (MessageType) {
    MessageType["Join"] = "join";
    MessageType["Leave"] = "leave";
    MessageType["CursorMove"] = "cursor_move";
    MessageType["TextChange"] = "text_change";
    MessageType["Selection"] = "selection";
    MessageType["Chat"] = "chat";
    MessageType["Ping"] = "ping";
    MessageType["Sync"] = "sync";
})(MessageType || (exports.MessageType = MessageType = {}));
/**
 * Collaboration Manager
 */
class CollaborationManager {
    sessions = new Map();
    userSessions = new Map(); // userId -> sessionId
    messageHandlers = new Map();
    /**
     * Create collaboration session
     */
    createSession(name, hostUserId, hostUsername) {
        const session = {
            id: this.generateSessionId(),
            name,
            hostUserId,
            participants: [
                {
                    userId: hostUserId,
                    username: hostUsername,
                    color: this.generateUserColor(),
                    role: 'host',
                    status: 'active',
                    lastActivity: new Date(),
                    joinedAt: new Date(),
                },
            ],
            documents: [],
            createdAt: new Date(),
            status: 'active',
        };
        this.sessions.set(session.id, session);
        this.userSessions.set(hostUserId, session.id);
        EventBus_1.eventBus.emitSync('collaboration.session_created', session, 'CollaborationManager');
        return session;
    }
    /**
     * Join session
     */
    joinSession(sessionId, userId, username) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            throw new Error(`Session not found: ${sessionId}`);
        }
        if (session.status !== 'active') {
            throw new Error(`Session is not active: ${session.status}`);
        }
        // Check if already joined
        const existing = session.participants.find(p => p.userId === userId);
        if (existing) {
            existing.status = 'active';
            existing.lastActivity = new Date();
            return existing;
        }
        const participant = {
            userId,
            username,
            color: this.generateUserColor(),
            role: 'editor',
            status: 'active',
            lastActivity: new Date(),
            joinedAt: new Date(),
        };
        session.participants.push(participant);
        this.userSessions.set(userId, sessionId);
        this.broadcastMessage(sessionId, {
            type: MessageType.Join,
            senderId: userId,
            timestamp: new Date(),
            data: { participant },
        });
        EventBus_1.eventBus.emitSync('collaboration.user_joined', { sessionId, participant }, 'CollaborationManager');
        return participant;
    }
    /**
     * Leave session
     */
    leaveSession(sessionId, userId) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            return;
        }
        const participant = session.participants.find(p => p.userId === userId);
        if (participant) {
            participant.status = 'disconnected';
            this.broadcastMessage(sessionId, {
                type: MessageType.Leave,
                senderId: userId,
                timestamp: new Date(),
                data: { userId },
            });
            this.userSessions.delete(userId);
            EventBus_1.eventBus.emitSync('collaboration.user_left', { sessionId, userId }, 'CollaborationManager');
        }
    }
    /**
     * Add document to session
     */
    addDocument(sessionId, path, content) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            throw new Error(`Session not found: ${sessionId}`);
        }
        const document = {
            id: this.generateDocumentId(),
            path,
            content,
            version: 1,
            operations: [],
            locks: [],
        };
        session.documents.push(document);
        EventBus_1.eventBus.emitSync('collaboration.document_added', { sessionId, document }, 'CollaborationManager');
        return document;
    }
    /**
     * Update cursor position
     */
    updateCursor(sessionId, userId, cursor) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            return;
        }
        const participant = session.participants.find(p => p.userId === userId);
        if (participant) {
            participant.cursor = cursor;
            participant.lastActivity = new Date();
            this.broadcastMessage(sessionId, {
                type: MessageType.CursorMove,
                senderId: userId,
                timestamp: new Date(),
                data: { cursor },
            }, userId);
        }
    }
    /**
     * Apply text operation
     */
    async applyOperation(sessionId, documentId, operation) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            throw new Error(`Session not found: ${sessionId}`);
        }
        const document = session.documents.find(d => d.id === documentId);
        if (!document) {
            throw new Error(`Document not found: ${documentId}`);
        }
        const fullOperation = {
            ...operation,
            id: this.generateOperationId(),
            timestamp: new Date(),
            acknowledged: false,
        };
        // Check for conflicts
        const conflicts = this.detectConflicts(document, fullOperation);
        if (conflicts.length > 0) {
            const resolution = await this.resolveConflict(fullOperation, conflicts);
            fullOperation.position = resolution.resolvedOperation.position;
        }
        // Apply operation
        this.applyOperationToDocument(document, fullOperation);
        document.operations.push(fullOperation);
        document.version++;
        // Broadcast to other participants
        this.broadcastMessage(sessionId, {
            type: MessageType.TextChange,
            senderId: operation.userId,
            timestamp: new Date(),
            data: { documentId, operation: fullOperation },
        }, operation.userId);
        EventBus_1.eventBus.emitSync('collaboration.operation_applied', {
            sessionId,
            documentId,
            operation: fullOperation,
        }, 'CollaborationManager');
        return fullOperation;
    }
    /**
     * Acquire lock on document range
     */
    acquireLock(sessionId, documentId, userId, range, duration = 30000) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            throw new Error(`Session not found: ${sessionId}`);
        }
        const document = session.documents.find(d => d.id === documentId);
        if (!document) {
            throw new Error(`Document not found: ${documentId}`);
        }
        // Check if range is already locked
        const existingLock = document.locks.find(lock => this.rangesOverlap(lock.range, range) && lock.expiresAt > new Date());
        if (existingLock) {
            throw new Error(`Range is already locked by user: ${existingLock.userId}`);
        }
        const lock = {
            userId,
            range,
            expiresAt: new Date(Date.now() + duration),
        };
        document.locks.push(lock);
        // Auto-release lock
        setTimeout(() => {
            this.releaseLock(sessionId, documentId, userId, range);
        }, duration);
        return lock;
    }
    /**
     * Release lock
     */
    releaseLock(sessionId, documentId, userId, range) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            return;
        }
        const document = session.documents.find(d => d.id === documentId);
        if (!document) {
            return;
        }
        document.locks = document.locks.filter(lock => !(lock.userId === userId && this.rangesEqual(lock.range, range)));
    }
    /**
     * Send chat message
     */
    sendChatMessage(sessionId, userId, content) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            throw new Error(`Session not found: ${sessionId}`);
        }
        const participant = session.participants.find(p => p.userId === userId);
        if (!participant) {
            throw new Error(`User not in session: ${userId}`);
        }
        const message = {
            id: this.generateMessageId(),
            userId,
            username: participant.username,
            content,
            timestamp: new Date(),
            mentions: this.extractMentions(content),
        };
        this.broadcastMessage(sessionId, {
            type: MessageType.Chat,
            senderId: userId,
            timestamp: new Date(),
            data: { message },
        });
        return message;
    }
    /**
     * Get session
     */
    getSession(sessionId) {
        return this.sessions.get(sessionId);
    }
    /**
     * List active sessions
     */
    listSessions() {
        return Array.from(this.sessions.values()).filter(s => s.status === 'active');
    }
    /**
     * Register message handler
     */
    onMessage(type, handler) {
        if (!this.messageHandlers.has(type)) {
            this.messageHandlers.set(type, []);
        }
        this.messageHandlers.get(type).push(handler);
    }
    /**
     * Broadcast message to session
     */
    broadcastMessage(sessionId, message, excludeUserId) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            return;
        }
        const handlers = this.messageHandlers.get(message.type) || [];
        for (const participant of session.participants) {
            if (participant.status === 'active' && participant.userId !== excludeUserId) {
                for (const handler of handlers) {
                    handler(participant.userId, message);
                }
            }
        }
    }
    /**
     * Detect operation conflicts
     */
    detectConflicts(document, operation) {
        const conflicts = [];
        // Check recent unacknowledged operations
        for (const op of document.operations) {
            if (!op.acknowledged && op.userId !== operation.userId) {
                if (this.operationsConflict(op, operation)) {
                    conflicts.push(op);
                }
            }
        }
        return conflicts;
    }
    /**
     * Check if operations conflict
     */
    operationsConflict(op1, op2) {
        // Simple conflict detection based on position proximity
        const position1 = op1.position.offset || 0;
        const position2 = op2.position.offset || 0;
        return Math.abs(position1 - position2) < 10;
    }
    /**
     * Resolve conflict
     */
    async resolveConflict(operation, conflicts) {
        // Operational Transformation
        let transformedOperation = { ...operation };
        for (const conflict of conflicts) {
            transformedOperation = this.transformOperation(transformedOperation, conflict);
        }
        return {
            operationId: operation.id,
            strategy: 'operational_transform',
            resolvedOperation: transformedOperation,
            conflictedWith: conflicts,
        };
    }
    /**
     * Transform operation based on concurrent operation
     */
    transformOperation(operation, against) {
        const transformed = { ...operation };
        if (against.type === 'insert') {
            if (against.position.offset !== undefined &&
                operation.position.offset !== undefined &&
                against.position.offset <= operation.position.offset) {
                transformed.position.offset = operation.position.offset + (against.content?.length || 0);
            }
        }
        else if (against.type === 'delete') {
            if (against.position.offset !== undefined &&
                operation.position.offset !== undefined &&
                against.position.offset < operation.position.offset) {
                transformed.position.offset = operation.position.offset - (against.length || 0);
            }
        }
        return transformed;
    }
    /**
     * Apply operation to document
     */
    applyOperationToDocument(document, operation) {
        switch (operation.type) {
            case 'insert':
                if (operation.position.offset !== undefined && operation.content) {
                    document.content =
                        document.content.slice(0, operation.position.offset) +
                            operation.content +
                            document.content.slice(operation.position.offset);
                }
                break;
            case 'delete':
                if (operation.position.offset !== undefined && operation.length) {
                    document.content =
                        document.content.slice(0, operation.position.offset) +
                            document.content.slice(operation.position.offset + operation.length);
                }
                break;
            case 'replace':
                if (operation.position.offset !== undefined && operation.length && operation.content) {
                    document.content =
                        document.content.slice(0, operation.position.offset) +
                            operation.content +
                            document.content.slice(operation.position.offset + operation.length);
                }
                break;
        }
    }
    rangesOverlap(range1, range2) {
        return !(range1.endLine < range2.startLine ||
            range2.endLine < range1.startLine ||
            (range1.endLine === range2.startLine && range1.endColumn < range2.startColumn) ||
            (range2.endLine === range1.startLine && range2.endColumn < range1.startColumn));
    }
    rangesEqual(range1, range2) {
        return (range1.startLine === range2.startLine &&
            range1.startColumn === range2.startColumn &&
            range1.endLine === range2.endLine &&
            range1.endColumn === range2.endColumn);
    }
    extractMentions(content) {
        const matches = content.match(/@(\w+)/g) || [];
        return matches.map(m => m.substring(1));
    }
    generateSessionId() {
        return `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
    generateDocumentId() {
        return `doc_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
    generateOperationId() {
        return `op_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
    generateMessageId() {
        return `msg_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
    generateUserColor() {
        const colors = [
            '#FF6B6B',
            '#4ECDC4',
            '#45B7D1',
            '#FFA07A',
            '#98D8C8',
            '#F7DC6F',
            '#BB8FCE',
            '#85C1E2',
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    }
}
exports.CollaborationManager = CollaborationManager;
/**
 * Presence Manager
 */
class PresenceManager {
    presenceData = new Map();
    activityTimeout = 300000; // 5 minutes
    /**
     * Update user presence
     */
    updatePresence(userId, presence) {
        const existing = this.presenceData.get(userId) || {
            userId,
            status: 'offline',
            lastSeen: new Date(),
        };
        const updated = {
            ...existing,
            ...presence,
            lastSeen: new Date(),
        };
        this.presenceData.set(userId, updated);
        EventBus_1.eventBus.emitSync('presence.updated', updated, 'PresenceManager');
    }
    /**
     * Get user presence
     */
    getPresence(userId) {
        return this.presenceData.get(userId);
    }
    /**
     * Get all online users
     */
    getOnlineUsers() {
        const now = Date.now();
        return Array.from(this.presenceData.values()).filter(p => p.status === 'online' && now - p.lastSeen.getTime() < this.activityTimeout);
    }
    /**
     * Mark user as idle
     */
    markIdle(userId) {
        this.updatePresence(userId, { status: 'idle' });
    }
    /**
     * Mark user as offline
     */
    markOffline(userId) {
        this.updatePresence(userId, { status: 'offline' });
    }
}
exports.PresenceManager = PresenceManager;
/**
 * Sync Engine
 */
class SyncEngine {
    syncQueue = new Map();
    isSyncing = new Map();
    /**
     * Queue sync operation
     */
    queueSync(sessionId, operation) {
        if (!this.syncQueue.has(sessionId)) {
            this.syncQueue.set(sessionId, []);
        }
        this.syncQueue.get(sessionId).push(operation);
        this.processSyncQueue(sessionId);
    }
    /**
     * Process sync queue
     */
    async processSyncQueue(sessionId) {
        if (this.isSyncing.get(sessionId)) {
            return;
        }
        this.isSyncing.set(sessionId, true);
        const queue = this.syncQueue.get(sessionId) || [];
        while (queue.length > 0) {
            const operation = queue.shift();
            try {
                await this.executeSyncOperation(operation);
            }
            catch (error) {
                console.error('Sync operation failed:', error);
            }
        }
        this.isSyncing.set(sessionId, false);
    }
    /**
     * Execute sync operation
     */
    async executeSyncOperation(operation) {
        // Mock implementation
        await new Promise(resolve => setTimeout(resolve, 10));
    }
}
exports.SyncEngine = SyncEngine;
/**
 * Singleton instances
 */
exports.collaborationManager = new CollaborationManager();
exports.presenceManager = new PresenceManager();
exports.syncEngine = new SyncEngine();
