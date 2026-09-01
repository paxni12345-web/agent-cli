"use strict";
/**
 * Real-time Collaboration & WebSocket System
 * Collaborative editing, presence tracking, cursor sharing
 * Real-time synchronization, conflict resolution, operational transformation
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CollaborationManager = void 0;
const events_1 = require("events");
// ============================================================================
// Collaboration Manager
// ============================================================================
class CollaborationManager extends events_1.EventEmitter {
    config;
    sessions = new Map();
    connections = new Map();
    chatMessages = new Map();
    awarenessStates = new Map();
    heartbeatInterval = null;
    cleanupInterval = null;
    constructor(config = {}) {
        super();
        this.config = {
            maxConnections: 1000,
            heartbeatInterval: 30000,
            sessionTimeout: 300000,
            enablePresence: true,
            enableCursors: true,
            enableOperationalTransform: true,
            conflictResolution: 'operational_transform',
            ...config,
        };
        this.startHeartbeat();
        this.startSessionCleanup();
    }
    // ========================================================================
    // Session Management
    // ========================================================================
    createSession(documentId, owner) {
        const session = {
            id: this.generateId(),
            documentId,
            participants: [],
            document: {
                id: documentId,
                type: 'text',
                content: '',
                version: 0,
                checksum: this.calculateChecksum(''),
                metadata: {
                    title: 'Untitled',
                    owner,
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                    tags: [],
                },
            },
            operations: [],
            snapshots: [],
            state: 'active',
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };
        this.sessions.set(session.id, session);
        this.chatMessages.set(session.id, []);
        this.awarenessStates.set(session.id, new Map());
        this.emit('session:created', { session });
        return session;
    }
    getSession(sessionId) {
        return this.sessions.get(sessionId);
    }
    closeSession(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session)
            return;
        session.state = 'closed';
        // Disconnect all participants
        for (const participant of session.participants) {
            this.removeParticipant(sessionId, participant.id);
        }
        this.emit('session:closed', { session });
    }
    // ========================================================================
    // Participant Management
    // ========================================================================
    async joinSession(sessionId, userId, userName, permissions) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            throw new Error(`Session not found: ${sessionId}`);
        }
        // Check if already joined
        const existing = session.participants.find(p => p.userId === userId);
        if (existing) {
            existing.presence.status = 'online';
            existing.lastSeen = Date.now();
            return existing;
        }
        const participant = {
            id: this.generateId(),
            userId,
            userName,
            color: this.generateColor(),
            presence: {
                status: 'online',
                lastActivity: Date.now(),
            },
            lastSeen: Date.now(),
            joinedAt: Date.now(),
            permissions: {
                canEdit: true,
                canComment: true,
                canShare: false,
                isAdmin: false,
                ...permissions,
            },
        };
        session.participants.push(participant);
        session.updatedAt = Date.now();
        this.emit('participant:joined', { session, participant });
        // Broadcast to other participants
        this.broadcastToSession(sessionId, {
            id: this.generateId(),
            type: 'join',
            sessionId,
            userId,
            data: { participant },
            timestamp: Date.now(),
        });
        return participant;
    }
    removeParticipant(sessionId, participantId) {
        const session = this.sessions.get(sessionId);
        if (!session)
            return;
        const index = session.participants.findIndex(p => p.id === participantId);
        if (index !== -1) {
            const participant = session.participants[index];
            session.participants.splice(index, 1);
            this.emit('participant:left', { session, participant });
            // Broadcast to remaining participants
            this.broadcastToSession(sessionId, {
                id: this.generateId(),
                type: 'leave',
                sessionId,
                userId: participant.userId,
                data: { participantId },
                timestamp: Date.now(),
            });
        }
    }
    // ========================================================================
    // Document Operations
    // ========================================================================
    async applyOperation(sessionId, userId, operation) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            throw new Error(`Session not found: ${sessionId}`);
        }
        const participant = session.participants.find(p => p.userId === userId);
        if (!participant || !participant.permissions.canEdit) {
            throw new Error('Permission denied');
        }
        const fullOperation = {
            ...operation,
            id: this.generateId(),
            timestamp: Date.now(),
            transformed: false,
        };
        // Check for concurrent operations
        const concurrentOps = session.operations.filter(op => op.version === operation.version && op.userId !== userId);
        if (concurrentOps.length > 0 && this.config.enableOperationalTransform) {
            // Transform operation
            const transformed = await this.transformOperation(fullOperation, concurrentOps);
            fullOperation.transformed = true;
            Object.assign(fullOperation, transformed);
        }
        // Apply operation to document
        this.applyOperationToDocument(session.document, fullOperation);
        // Increment version
        session.document.version++;
        fullOperation.version = session.document.version;
        // Store operation
        session.operations.push(fullOperation);
        session.updatedAt = Date.now();
        // Create snapshot periodically
        if (session.operations.length % 100 === 0) {
            await this.createSnapshot(session);
        }
        this.emit('operation:applied', { session, operation: fullOperation });
        // Broadcast to other participants
        this.broadcastToSession(sessionId, {
            id: this.generateId(),
            type: 'operation',
            sessionId,
            userId,
            data: { operation: fullOperation },
            timestamp: Date.now(),
        }, userId);
        return fullOperation;
    }
    applyOperationToDocument(document, operation) {
        let content = document.content;
        switch (operation.type) {
            case 'insert':
                content = content.slice(0, operation.position) +
                    operation.content +
                    content.slice(operation.position);
                break;
            case 'delete':
                content = content.slice(0, operation.position) +
                    content.slice(operation.position + (operation.length || 0));
                break;
            case 'replace':
                content = content.slice(0, operation.position) +
                    operation.content +
                    content.slice(operation.position + (operation.length || 0));
                break;
        }
        document.content = content;
        document.checksum = this.calculateChecksum(content);
        document.metadata.updatedAt = Date.now();
        document.metadata.lastEditor = operation.userId;
    }
    // ========================================================================
    // Operational Transformation
    // ========================================================================
    async transformOperation(operation, concurrentOps) {
        let transformed = { ...operation };
        for (const concurrentOp of concurrentOps) {
            transformed = this.transformPair(transformed, concurrentOp);
        }
        return transformed;
    }
    transformPair(op1, op2) {
        // Simplified OT for insert/delete operations
        if (op1.type === 'insert' && op2.type === 'insert') {
            if (op1.position < op2.position) {
                return op1;
            }
            else if (op1.position > op2.position) {
                return {
                    ...op1,
                    position: op1.position + (op2.content?.length || 0),
                };
            }
            else {
                // Same position, user ID breaks tie
                return op1.userId < op2.userId ? op1 : {
                    ...op1,
                    position: op1.position + (op2.content?.length || 0),
                };
            }
        }
        if (op1.type === 'insert' && op2.type === 'delete') {
            if (op1.position <= op2.position) {
                return op1;
            }
            else if (op1.position > op2.position + (op2.length || 0)) {
                return {
                    ...op1,
                    position: op1.position - (op2.length || 0),
                };
            }
            else {
                return {
                    ...op1,
                    position: op2.position,
                };
            }
        }
        if (op1.type === 'delete' && op2.type === 'insert') {
            if (op1.position < op2.position) {
                return op1;
            }
            else {
                return {
                    ...op1,
                    position: op1.position + (op2.content?.length || 0),
                };
            }
        }
        if (op1.type === 'delete' && op2.type === 'delete') {
            if (op1.position < op2.position) {
                return op1;
            }
            else if (op1.position >= op2.position + (op2.length || 0)) {
                return {
                    ...op1,
                    position: op1.position - (op2.length || 0),
                };
            }
            else {
                // Overlapping deletes
                return {
                    ...op1,
                    position: op2.position,
                    length: Math.max(0, (op1.length || 0) - (op2.length || 0)),
                };
            }
        }
        return op1;
    }
    // ========================================================================
    // Awareness & Presence
    // ========================================================================
    updateAwareness(sessionId, userId, update) {
        if (!this.config.enablePresence && !this.config.enableCursors)
            return;
        const session = this.sessions.get(sessionId);
        if (!session)
            return;
        const participant = session.participants.find(p => p.userId === userId);
        if (!participant)
            return;
        // Update participant state
        if (update.cursor && this.config.enableCursors) {
            participant.cursor = update.cursor;
        }
        if (update.selection && this.config.enableCursors) {
            participant.selection = update.selection;
        }
        if (update.presence && this.config.enablePresence) {
            Object.assign(participant.presence, update.presence);
            participant.lastSeen = Date.now();
        }
        // Store awareness state
        const awarenessMap = this.awarenessStates.get(sessionId);
        if (awarenessMap) {
            awarenessMap.set(userId, {
                userId,
                ...update,
                timestamp: Date.now(),
            });
        }
        this.emit('awareness:updated', { session, userId, update });
        // Broadcast to other participants
        this.broadcastToSession(sessionId, {
            id: this.generateId(),
            type: update.cursor || update.selection ? 'cursor' : 'presence',
            sessionId,
            userId,
            data: update,
            timestamp: Date.now(),
        }, userId);
    }
    // ========================================================================
    // Chat
    // ========================================================================
    sendChatMessage(sessionId, userId, userName, content, mentions = []) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            throw new Error(`Session not found: ${sessionId}`);
        }
        const message = {
            id: this.generateId(),
            sessionId,
            userId,
            userName,
            content,
            mentions,
            timestamp: Date.now(),
        };
        const messages = this.chatMessages.get(sessionId) || [];
        messages.push(message);
        this.chatMessages.set(sessionId, messages);
        this.emit('chat:message', { session, message });
        // Broadcast to all participants
        this.broadcastToSession(sessionId, {
            id: this.generateId(),
            type: 'chat',
            sessionId,
            userId,
            data: { message },
            timestamp: Date.now(),
        });
        return message;
    }
    getChatMessages(sessionId, limit = 50) {
        const messages = this.chatMessages.get(sessionId) || [];
        return messages.slice(-limit);
    }
    // ========================================================================
    // Snapshots
    // ========================================================================
    async createSnapshot(session) {
        const snapshot = {
            id: this.generateId(),
            documentId: session.documentId,
            version: session.document.version,
            content: JSON.parse(JSON.stringify(session.document.content)),
            checksum: session.document.checksum,
            timestamp: Date.now(),
            createdBy: session.document.metadata.lastEditor || session.document.metadata.owner,
        };
        session.snapshots.push(snapshot);
        // Keep only last 10 snapshots
        if (session.snapshots.length > 10) {
            session.snapshots = session.snapshots.slice(-10);
        }
        this.emit('snapshot:created', { session, snapshot });
        return snapshot;
    }
    // ========================================================================
    // Synchronization
    // ========================================================================
    async syncSession(request) {
        const session = this.sessions.get(request.sessionId);
        if (!session) {
            throw new Error(`Session not found: ${request.sessionId}`);
        }
        const requiresFullSync = request.checksum !== session.document.checksum;
        if (requiresFullSync) {
            // Full sync required
            return {
                operations: [],
                snapshots: [session.snapshots[session.snapshots.length - 1]],
                currentVersion: session.document.version,
                requiresFullSync: true,
            };
        }
        // Incremental sync
        const operations = session.operations.filter(op => op.version > request.currentVersion);
        return {
            operations,
            snapshots: [],
            currentVersion: session.document.version,
            requiresFullSync: false,
        };
    }
    // ========================================================================
    // WebSocket Management
    // ========================================================================
    registerConnection(userId, sessionId, socket) {
        const connection = {
            id: this.generateId(),
            userId,
            sessionId,
            socket,
            state: 'connected',
            lastPing: Date.now(),
            lastPong: Date.now(),
            reconnectCount: 0,
        };
        this.connections.set(connection.id, connection);
        this.emit('connection:registered', { connection });
        return connection;
    }
    unregisterConnection(connectionId) {
        const connection = this.connections.get(connectionId);
        if (connection) {
            connection.state = 'disconnected';
            this.connections.delete(connectionId);
            this.emit('connection:unregistered', { connection });
        }
    }
    broadcastToSession(sessionId, message, excludeUserId) {
        const session = this.sessions.get(sessionId);
        if (!session)
            return;
        for (const participant of session.participants) {
            if (excludeUserId && participant.userId === excludeUserId)
                continue;
            // Find participant's connection
            const connection = Array.from(this.connections.values()).find(c => c.userId === participant.userId && c.sessionId === sessionId);
            if (connection && connection.state === 'connected') {
                // In production, send via actual WebSocket
                this.emit('message:broadcast', { connection, message });
            }
        }
    }
    // ========================================================================
    // Heartbeat & Cleanup
    // ========================================================================
    startHeartbeat() {
        this.heartbeatInterval = setInterval(() => {
            this.sendHeartbeats();
        }, this.config.heartbeatInterval);
    }
    sendHeartbeats() {
        const now = Date.now();
        for (const connection of this.connections.values()) {
            if (connection.state === 'connected') {
                // Check if connection is still alive
                if (now - connection.lastPong > this.config.heartbeatInterval * 2) {
                    connection.state = 'disconnected';
                    this.unregisterConnection(connection.id);
                }
                else {
                    connection.lastPing = now;
                    // In production, send actual ping
                    this.emit('connection:ping', { connection });
                }
            }
        }
    }
    startSessionCleanup() {
        this.cleanupInterval = setInterval(() => {
            this.cleanupInactiveSessions();
        }, 60000);
    }
    cleanupInactiveSessions() {
        const now = Date.now();
        for (const session of this.sessions.values()) {
            // Check if session has been inactive
            if (now - session.updatedAt > this.config.sessionTimeout) {
                // Check if any participants are still connected
                const hasActiveParticipants = session.participants.some(p => now - p.lastSeen < this.config.sessionTimeout);
                if (!hasActiveParticipants) {
                    this.closeSession(session.id);
                }
            }
        }
    }
    // ========================================================================
    // Utilities
    // ========================================================================
    generateId() {
        return `collab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    generateColor() {
        const colors = [
            '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A',
            '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2',
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    }
    calculateChecksum(content) {
        // Simple checksum - in production use a proper hash function
        let hash = 0;
        for (let i = 0; i < content.length; i++) {
            hash = ((hash << 5) - hash) + content.charCodeAt(i);
            hash = hash & hash;
        }
        return hash.toString(36);
    }
    getStats() {
        return {
            sessions: this.sessions.size,
            activeSessions: Array.from(this.sessions.values()).filter(s => s.state === 'active').length,
            connections: this.connections.size,
            totalParticipants: Array.from(this.sessions.values()).reduce((sum, s) => sum + s.participants.length, 0),
            totalOperations: Array.from(this.sessions.values()).reduce((sum, s) => sum + s.operations.length, 0),
            totalMessages: Array.from(this.chatMessages.values()).reduce((sum, msgs) => sum + msgs.length, 0),
        };
    }
    close() {
        // Clear intervals to prevent memory leak
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
        // Close all sessions
        for (const session of this.sessions.values()) {
            this.closeSession(session.id);
        }
        // Clear all data structures
        this.sessions.clear();
        this.connections.clear();
        this.chatMessages.clear();
        this.awarenessStates.clear();
        this.emit('manager:closed');
    }
}
exports.CollaborationManager = CollaborationManager;
// ============================================================================
// Export
// ============================================================================
exports.default = CollaborationManager;
