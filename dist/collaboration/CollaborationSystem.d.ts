/**
 * Real-time Collaboration System
 * Multi-user editing, presence awareness, conflict resolution, and live cursors
 */
export interface CollaborationSession {
    id: string;
    name: string;
    hostUserId: string;
    participants: Participant[];
    documents: CollaborativeDocument[];
    createdAt: Date;
    status: 'active' | 'paused' | 'ended';
}
export interface Participant {
    userId: string;
    username: string;
    color: string;
    role: 'host' | 'editor' | 'viewer';
    status: 'active' | 'idle' | 'disconnected';
    cursor?: CursorPosition;
    lastActivity: Date;
    joinedAt: Date;
}
export interface CursorPosition {
    documentId: string;
    line: number;
    column: number;
    selection?: {
        startLine: number;
        startColumn: number;
        endLine: number;
        endColumn: number;
    };
}
export interface CollaborativeDocument {
    id: string;
    path: string;
    content: string;
    version: number;
    operations: Operation[];
    locks: Lock[];
}
export interface Operation {
    id: string;
    type: 'insert' | 'delete' | 'replace';
    userId: string;
    timestamp: Date;
    version: number;
    position: Position;
    content?: string;
    length?: number;
    acknowledged: boolean;
}
export interface Position {
    line: number;
    column: number;
    offset?: number;
}
export interface Lock {
    userId: string;
    range: {
        startLine: number;
        startColumn: number;
        endLine: number;
        endColumn: number;
    };
    expiresAt: Date;
}
export interface CollaborationMessage {
    type: MessageType;
    senderId: string;
    timestamp: Date;
    data: any;
}
export declare enum MessageType {
    Join = "join",
    Leave = "leave",
    CursorMove = "cursor_move",
    TextChange = "text_change",
    Selection = "selection",
    Chat = "chat",
    Ping = "ping",
    Sync = "sync"
}
export interface ChatMessage {
    id: string;
    userId: string;
    username: string;
    content: string;
    timestamp: Date;
    mentions?: string[];
}
export interface ConflictResolution {
    operationId: string;
    strategy: 'last_write_wins' | 'operational_transform' | 'manual';
    resolvedOperation: Operation;
    conflictedWith: Operation[];
}
/**
 * Collaboration Manager
 */
export declare class CollaborationManager {
    private sessions;
    private userSessions;
    private messageHandlers;
    /**
     * Create collaboration session
     */
    createSession(name: string, hostUserId: string, hostUsername: string): CollaborationSession;
    /**
     * Join session
     */
    joinSession(sessionId: string, userId: string, username: string): Participant;
    /**
     * Leave session
     */
    leaveSession(sessionId: string, userId: string): void;
    /**
     * Add document to session
     */
    addDocument(sessionId: string, path: string, content: string): CollaborativeDocument;
    /**
     * Update cursor position
     */
    updateCursor(sessionId: string, userId: string, cursor: CursorPosition): void;
    /**
     * Apply text operation
     */
    applyOperation(sessionId: string, documentId: string, operation: Omit<Operation, 'id' | 'timestamp' | 'acknowledged'>): Promise<Operation>;
    /**
     * Acquire lock on document range
     */
    acquireLock(sessionId: string, documentId: string, userId: string, range: Lock['range'], duration?: number): Lock;
    /**
     * Release lock
     */
    releaseLock(sessionId: string, documentId: string, userId: string, range: Lock['range']): void;
    /**
     * Send chat message
     */
    sendChatMessage(sessionId: string, userId: string, content: string): ChatMessage;
    /**
     * Get session
     */
    getSession(sessionId: string): CollaborationSession | undefined;
    /**
     * List active sessions
     */
    listSessions(): CollaborationSession[];
    /**
     * Register message handler
     */
    onMessage(type: MessageType, handler: MessageHandler): void;
    /**
     * Broadcast message to session
     */
    private broadcastMessage;
    /**
     * Detect operation conflicts
     */
    private detectConflicts;
    /**
     * Check if operations conflict
     */
    private operationsConflict;
    /**
     * Resolve conflict
     */
    private resolveConflict;
    /**
     * Transform operation based on concurrent operation
     */
    private transformOperation;
    /**
     * Apply operation to document
     */
    private applyOperationToDocument;
    private rangesOverlap;
    private rangesEqual;
    private extractMentions;
    private generateSessionId;
    private generateDocumentId;
    private generateOperationId;
    private generateMessageId;
    private generateUserColor;
}
export type MessageHandler = (userId: string, message: CollaborationMessage) => void;
/**
 * Presence Manager
 */
export declare class PresenceManager {
    private presenceData;
    private activityTimeout;
    /**
     * Update user presence
     */
    updatePresence(userId: string, presence: Partial<UserPresence>): void;
    /**
     * Get user presence
     */
    getPresence(userId: string): UserPresence | undefined;
    /**
     * Get all online users
     */
    getOnlineUsers(): UserPresence[];
    /**
     * Mark user as idle
     */
    markIdle(userId: string): void;
    /**
     * Mark user as offline
     */
    markOffline(userId: string): void;
}
export interface UserPresence {
    userId: string;
    status: 'online' | 'idle' | 'offline';
    lastSeen: Date;
    currentDocument?: string;
    activity?: string;
}
/**
 * Sync Engine
 */
export declare class SyncEngine {
    private syncQueue;
    private isSyncing;
    /**
     * Queue sync operation
     */
    queueSync(sessionId: string, operation: SyncOperation): void;
    /**
     * Process sync queue
     */
    private processSyncQueue;
    /**
     * Execute sync operation
     */
    private executeSyncOperation;
}
export interface SyncOperation {
    type: 'push' | 'pull' | 'merge';
    documentId: string;
    version: number;
    data: any;
}
/**
 * Singleton instances
 */
export declare const collaborationManager: CollaborationManager;
export declare const presenceManager: PresenceManager;
export declare const syncEngine: SyncEngine;
//# sourceMappingURL=CollaborationSystem.d.ts.map