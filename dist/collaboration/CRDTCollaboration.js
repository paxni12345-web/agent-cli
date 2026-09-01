"use strict";
/**
 * PHASE 5: REAL-TIME COLLABORATION WITH CRDT
 * Conflict-free Replicated Data Types for collaborative editing
 *
 * Part of 350K lines goal - PHASE 5
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CRDTCollaborationManager = void 0;
const events_1 = require("events");
// ============================================================================
// CRDT Collaboration Manager
// ============================================================================
class CRDTCollaborationManager extends events_1.EventEmitter {
    config;
    documents = new Map();
    operations = new Map();
    changes = new Map();
    comments = new Map();
    versions = new Map();
    conflicts = new Map();
    syncStates = new Map();
    participants = new Map();
    constructor(config = {}) {
        super();
        this.config = {
            enableConflictResolution: true,
            enableVersioning: true,
            maxHistorySize: 1000,
            syncInterval: 1000,
            ...config,
        };
    }
    // ========================================================================
    // Document Management
    // ========================================================================
    createDocument(type, title, ownerId) {
        const doc = {
            id: this.generateId(),
            type,
            title,
            content: this.initializeCRDT(type),
            version: 1,
            participants: [],
            permissions: {
                public: false,
                allowComments: true,
                allowDownload: true,
                allowCopy: true,
                viewers: [],
                editors: [ownerId],
                commenters: [],
            },
            metadata: {
                owner: ownerId,
                tags: [],
                size: 0,
                checksum: '',
            },
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        this.documents.set(doc.id, doc);
        this.operations.set(doc.id, []);
        this.changes.set(doc.id, []);
        this.versions.set(doc.id, []);
        // Create initial version
        this.createVersion(doc.id, 'Initial version', ownerId);
        this.emit('document:created', { documentId: doc.id });
        return doc;
    }
    initializeCRDT(type) {
        return {
            type: 'rga', // Replicated Growable Array
            state: [],
            operations: [],
            vector: {},
        };
    }
    // ========================================================================
    // CRDT Operations
    // ========================================================================
    async applyOperation(documentId, operation) {
        const doc = this.documents.get(documentId);
        if (!doc) {
            throw new Error('Document not found');
        }
        // Create full operation
        const op = {
            id: this.generateId(),
            vector: this.incrementVector(doc.content.vector, operation.actor),
            timestamp: new Date(),
            ...operation,
        };
        // Check for conflicts
        const concurrent = this.getConcurrentOperations(doc, op);
        if (concurrent.length > 0 && this.config.enableConflictResolution) {
            const transformed = this.transformOperation(op, concurrent);
            op.position = transformed.transformed.position;
            op.value = transformed.transformed.value;
        }
        // Apply to CRDT
        this.applyCRDTOperation(doc.content, op);
        // Store operation
        doc.content.operations.push(op);
        this.operations.get(documentId).push(op);
        // Track change
        this.trackChange(doc, op);
        // Update document
        doc.updatedAt = new Date();
        doc.version++;
        // Broadcast to participants
        this.broadcastOperation(doc, op);
        this.emit('operation:applied', { documentId, operationId: op.id });
        return op;
    }
    applyCRDTOperation(crdt, operation) {
        switch (operation.type) {
            case 'insert':
                if (typeof operation.position === 'number') {
                    crdt.state.splice(operation.position, 0, operation.value);
                }
                break;
            case 'delete':
                if (typeof operation.position === 'number') {
                    crdt.state.splice(operation.position, 1);
                }
                break;
            case 'update':
                if (typeof operation.position === 'number') {
                    crdt.state[operation.position] = operation.value;
                }
                break;
            case 'set':
                crdt.state = operation.value;
                break;
        }
        // Update vector clock
        crdt.vector = operation.vector;
    }
    // ========================================================================
    // Operational Transform
    // ========================================================================
    getConcurrentOperations(doc, op) {
        return doc.content.operations.filter(existing => {
            return this.isConcurrent(existing.vector, op.vector);
        });
    }
    isConcurrent(v1, v2) {
        const actors = new Set([...Object.keys(v1), ...Object.keys(v2)]);
        let v1Higher = false;
        let v2Higher = false;
        for (const actor of actors) {
            const t1 = v1[actor] || 0;
            const t2 = v2[actor] || 0;
            if (t1 > t2)
                v1Higher = true;
            if (t2 > t1)
                v2Higher = true;
        }
        return v1Higher && v2Higher;
    }
    transformOperation(op, concurrent) {
        let transformed = { ...op };
        for (const other of concurrent) {
            transformed = this.transformPair(transformed, other);
        }
        return {
            transformed,
        };
    }
    transformPair(op1, op2) {
        // Simplified OT - real implementation would be more complex
        if (op1.type === 'insert' && op2.type === 'insert') {
            if (typeof op1.position === 'number' &&
                typeof op2.position === 'number' &&
                op2.position <= op1.position) {
                return {
                    ...op1,
                    position: op1.position + 1,
                };
            }
        }
        else if (op1.type === 'insert' && op2.type === 'delete') {
            if (typeof op1.position === 'number' &&
                typeof op2.position === 'number' &&
                op2.position < op1.position) {
                return {
                    ...op1,
                    position: op1.position - 1,
                };
            }
        }
        return op1;
    }
    // ========================================================================
    // Vector Clocks
    // ========================================================================
    incrementVector(vector, actor) {
        return {
            ...vector,
            [actor]: (vector[actor] || 0) + 1,
        };
    }
    compareVectors(v1, v2) {
        const actors = new Set([...Object.keys(v1), ...Object.keys(v2)]);
        let allLessOrEqual = true;
        let allGreaterOrEqual = true;
        for (const actor of actors) {
            const t1 = v1[actor] || 0;
            const t2 = v2[actor] || 0;
            if (t1 > t2)
                allLessOrEqual = false;
            if (t1 < t2)
                allGreaterOrEqual = false;
        }
        if (allLessOrEqual && allGreaterOrEqual)
            return 0; // Equal
        if (allLessOrEqual)
            return -1; // v1 < v2
        if (allGreaterOrEqual)
            return 1; // v1 > v2
        return NaN; // Concurrent
    }
    // ========================================================================
    // Participants & Presence
    // ========================================================================
    joinDocument(documentId, participant) {
        const doc = this.documents.get(documentId);
        if (!doc) {
            throw new Error('Document not found');
        }
        const fullParticipant = {
            ...participant,
            joinedAt: new Date(),
            lastActiveAt: new Date(),
        };
        doc.participants.push(fullParticipant);
        this.participants.set(participant.id, fullParticipant);
        this.emit('participant:joined', { documentId, participantId: participant.id });
    }
    updatePresence(participantId, presence, cursor, selection) {
        const participant = this.participants.get(participantId);
        if (!participant) {
            throw new Error('Participant not found');
        }
        if (presence) {
            participant.presence = {
                ...participant.presence,
                ...presence,
                lastUpdate: new Date(),
            };
        }
        if (cursor) {
            participant.cursor = cursor;
        }
        if (selection) {
            participant.selection = selection;
        }
        participant.lastActiveAt = new Date();
        this.emit('presence:updated', { participantId });
    }
    // ========================================================================
    // Comments & Annotations
    // ========================================================================
    addComment(documentId, author, content, position, threadId) {
        const comment = {
            id: this.generateId(),
            documentId,
            thread: threadId,
            author,
            content,
            position,
            resolved: false,
            replies: [],
            reactions: [],
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        if (!this.comments.has(documentId)) {
            this.comments.set(documentId, []);
        }
        if (threadId) {
            // Add as reply
            const parentComment = this.comments
                .get(documentId)
                .find(c => c.id === threadId);
            if (parentComment) {
                parentComment.replies.push(comment);
            }
        }
        else {
            this.comments.get(documentId).push(comment);
        }
        this.emit('comment:added', { documentId, commentId: comment.id });
        return comment;
    }
    resolveComment(commentId, documentId) {
        const comments = this.comments.get(documentId);
        if (!comments)
            return;
        const comment = comments.find(c => c.id === commentId);
        if (comment) {
            comment.resolved = true;
            comment.updatedAt = new Date();
            this.emit('comment:resolved', { commentId });
        }
    }
    // ========================================================================
    // Version Control
    // ========================================================================
    createVersion(documentId, description, author) {
        const doc = this.documents.get(documentId);
        if (!doc) {
            throw new Error('Document not found');
        }
        const versions = this.versions.get(documentId);
        const version = {
            id: this.generateId(),
            documentId,
            number: versions.length + 1,
            description,
            snapshot: JSON.parse(JSON.stringify(doc.content)),
            changes: this.changes.get(documentId)?.slice(-100) || [],
            author,
            createdAt: new Date(),
        };
        versions.push(version);
        this.emit('version:created', { versionId: version.id });
        return version;
    }
    restoreVersion(documentId, versionId) {
        const doc = this.documents.get(documentId);
        const versions = this.versions.get(documentId);
        if (!doc || !versions) {
            throw new Error('Document or versions not found');
        }
        const version = versions.find(v => v.id === versionId);
        if (!version) {
            throw new Error('Version not found');
        }
        doc.content = JSON.parse(JSON.stringify(version.snapshot));
        doc.version++;
        doc.updatedAt = new Date();
        this.emit('version:restored', { documentId, versionId });
    }
    compareVersions(documentId, version1Id, version2Id) {
        const versions = this.versions.get(documentId);
        if (!versions) {
            throw new Error('Versions not found');
        }
        const v1 = versions.find(v => v.id === version1Id);
        const v2 = versions.find(v => v.id === version2Id);
        if (!v1 || !v2) {
            throw new Error('One or both versions not found');
        }
        // Simplified diff
        const diff = {
            additions: [],
            deletions: [],
            modifications: [],
        };
        // Compare operations
        const ops1 = new Set(v1.snapshot.operations.map(o => o.id));
        const ops2 = new Set(v2.snapshot.operations.map(o => o.id));
        for (const op of v2.snapshot.operations) {
            if (!ops1.has(op.id)) {
                diff.additions.push(op);
            }
        }
        for (const op of v1.snapshot.operations) {
            if (!ops2.has(op.id)) {
                diff.deletions.push(op);
            }
        }
        return diff;
    }
    // ========================================================================
    // Change Tracking
    // ========================================================================
    trackChange(doc, operation) {
        const change = {
            id: this.generateId(),
            documentId: doc.id,
            operation,
            before: null,
            after: null,
            author: doc.participants.find(p => p.id === operation.actor),
            timestamp: new Date(),
            merged: false,
        };
        const changes = this.changes.get(doc.id);
        changes.push(change);
        // Limit history size
        if (changes.length > this.config.maxHistorySize) {
            changes.shift();
        }
        this.emit('change:tracked', { changeId: change.id });
    }
    // ========================================================================
    // Sync Protocol
    // ========================================================================
    broadcastOperation(doc, operation) {
        const message = {
            type: 'operation',
            documentId: doc.id,
            senderId: operation.actor,
            vector: operation.vector,
            operations: [operation],
            timestamp: new Date(),
        };
        this.emit('sync:broadcast', { message });
    }
    handleSyncMessage(message) {
        switch (message.type) {
            case 'sync_request':
                this.handleSyncRequest(message);
                break;
            case 'operation':
                this.handleRemoteOperation(message);
                break;
        }
    }
    handleSyncRequest(message) {
        const doc = this.documents.get(message.documentId);
        if (!doc)
            return;
        const response = {
            type: 'sync_response',
            documentId: doc.id,
            senderId: 'server',
            vector: doc.content.vector,
            operations: doc.content.operations,
            timestamp: new Date(),
        };
        this.emit('sync:response', { response });
    }
    handleRemoteOperation(message) {
        if (!message.operations)
            return;
        for (const op of message.operations) {
            this.applyOperation(message.documentId, op);
        }
    }
    // ========================================================================
    // Helper Methods
    // ========================================================================
    generateId() {
        return `crdt-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    }
    getStats() {
        return {
            documents: this.documents.size,
            participants: this.participants.size,
            totalOperations: Array.from(this.operations.values()).reduce((sum, ops) => sum + ops.length, 0),
            totalChanges: Array.from(this.changes.values()).reduce((sum, changes) => sum + changes.length, 0),
            totalComments: Array.from(this.comments.values()).reduce((sum, comments) => sum + comments.length, 0),
            totalVersions: Array.from(this.versions.values()).reduce((sum, versions) => sum + versions.length, 0),
            conflicts: Array.from(this.conflicts.values()).reduce((sum, conflicts) => sum + conflicts.length, 0),
        };
    }
}
exports.CRDTCollaborationManager = CRDTCollaborationManager;
