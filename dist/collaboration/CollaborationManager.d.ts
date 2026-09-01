/**
 * Real-time Collaboration & WebSocket System
 * Collaborative editing, presence tracking, cursor sharing
 * Real-time synchronization, conflict resolution, operational transformation
 */
import { EventEmitter } from 'events';
export interface CollaborationConfig {
    maxConnections: number;
    heartbeatInterval: number;
    sessionTimeout: number;
    enablePresence: boolean;
    enableCursors: boolean;
    enableOperationalTransform: boolean;
    conflictResolution: ConflictResolutionStrategy;
}
export type ConflictResolutionStrategy = 'last_write_wins' | 'operational_transform' | 'manual';
export interface CollaborationSession {
    id: string;
    documentId: string;
    participants: Participant[];
    document: CollaborativeDocument;
    operations: Operation[];
    snapshots: DocumentSnapshot[];
    state: SessionState;
    createdAt: number;
    updatedAt: number;
}
export type SessionState = 'active' | 'paused' | 'closed';
export interface Participant {
    id: string;
    userId: string;
    userName: string;
    color: string;
    avatar?: string;
    presence: PresenceState;
    cursor?: CursorPosition;
    selection?: Selection;
    lastSeen: number;
    joinedAt: number;
    permissions: ParticipantPermissions;
}
export interface PresenceState {
    status: 'online' | 'idle' | 'offline';
    lastActivity: number;
    currentView?: string;
    isTyping?: boolean;
}
export interface CursorPosition {
    line: number;
    column: number;
    timestamp: number;
}
export interface Selection {
    start: CursorPosition;
    end: CursorPosition;
    timestamp: number;
}
export interface ParticipantPermissions {
    canEdit: boolean;
    canComment: boolean;
    canShare: boolean;
    isAdmin: boolean;
}
export interface CollaborativeDocument {
    id: string;
    type: DocumentType;
    content: any;
    version: number;
    checksum: string;
    metadata: DocumentMetadata;
}
export type DocumentType = 'text' | 'code' | 'spreadsheet' | 'drawing' | 'json';
export interface DocumentMetadata {
    title: string;
    owner: string;
    createdAt: number;
    updatedAt: number;
    lastEditor?: string;
    tags: string[];
}
export interface Operation {
    id: string;
    sessionId: string;
    userId: string;
    type: OperationType;
    position: number;
    content?: any;
    length?: number;
    version: number;
    timestamp: number;
    transformed: boolean;
}
export type OperationType = 'insert' | 'delete' | 'replace' | 'move' | 'format';
export interface DocumentSnapshot {
    id: string;
    documentId: string;
    version: number;
    content: any;
    checksum: string;
    timestamp: number;
    createdBy: string;
}
export interface WebSocketConnection {
    id: string;
    userId: string;
    sessionId: string;
    socket: any;
    state: ConnectionState;
    lastPing: number;
    lastPong: number;
    reconnectCount: number;
}
export type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'reconnecting';
export interface Message {
    id: string;
    type: MessageType;
    sessionId: string;
    userId: string;
    data: any;
    timestamp: number;
}
export type MessageType = 'join' | 'leave' | 'operation' | 'cursor' | 'selection' | 'presence' | 'chat' | 'sync' | 'snapshot';
export interface ChatMessage {
    id: string;
    sessionId: string;
    userId: string;
    userName: string;
    content: string;
    mentions: string[];
    timestamp: number;
    edited?: number;
    deleted?: boolean;
}
export interface AwarenessUpdate {
    userId: string;
    cursor?: CursorPosition;
    selection?: Selection;
    presence?: PresenceState;
    timestamp: number;
}
export interface SyncRequest {
    sessionId: string;
    currentVersion: number;
    checksum: string;
}
export interface SyncResponse {
    operations: Operation[];
    snapshots: DocumentSnapshot[];
    currentVersion: number;
    requiresFullSync: boolean;
}
export interface ConflictResolution {
    id: string;
    operations: Operation[];
    resolution: Operation[];
    strategy: ConflictResolutionStrategy;
    timestamp: number;
}
export declare class CollaborationManager extends EventEmitter {
    private config;
    private sessions;
    private connections;
    private chatMessages;
    private awarenessStates;
    private heartbeatInterval;
    private cleanupInterval;
    constructor(config?: Partial<CollaborationConfig>);
    createSession(documentId: string, owner: string): CollaborationSession;
    getSession(sessionId: string): CollaborationSession | undefined;
    closeSession(sessionId: string): void;
    joinSession(sessionId: string, userId: string, userName: string, permissions?: Partial<ParticipantPermissions>): Promise<Participant>;
    removeParticipant(sessionId: string, participantId: string): void;
    applyOperation(sessionId: string, userId: string, operation: Omit<Operation, 'id' | 'timestamp' | 'transformed'>): Promise<Operation>;
    private applyOperationToDocument;
    private transformOperation;
    private transformPair;
    updateAwareness(sessionId: string, userId: string, update: Partial<AwarenessUpdate>): void;
    sendChatMessage(sessionId: string, userId: string, userName: string, content: string, mentions?: string[]): ChatMessage;
    getChatMessages(sessionId: string, limit?: number): ChatMessage[];
    private createSnapshot;
    syncSession(request: SyncRequest): Promise<SyncResponse>;
    registerConnection(userId: string, sessionId: string, socket: any): WebSocketConnection;
    unregisterConnection(connectionId: string): void;
    private broadcastToSession;
    private startHeartbeat;
    private sendHeartbeats;
    private startSessionCleanup;
    private cleanupInactiveSessions;
    private generateId;
    private generateColor;
    private calculateChecksum;
    getStats(): CollaborationStats;
    close(): void;
}
interface CollaborationStats {
    sessions: number;
    activeSessions: number;
    connections: number;
    totalParticipants: number;
    totalOperations: number;
    totalMessages: number;
}
export default CollaborationManager;
//# sourceMappingURL=CollaborationManager.d.ts.map