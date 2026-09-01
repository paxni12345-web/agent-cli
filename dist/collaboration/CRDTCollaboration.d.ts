/**
 * PHASE 5: REAL-TIME COLLABORATION WITH CRDT
 * Conflict-free Replicated Data Types for collaborative editing
 *
 * Part of 350K lines goal - PHASE 5
 */
import { EventEmitter } from 'events';
export interface CRDTConfig {
    enableConflictResolution: boolean;
    enableVersioning: boolean;
    maxHistorySize: number;
    syncInterval: number;
}
export interface Document {
    id: string;
    type: DocumentType;
    title: string;
    content: CRDTData;
    version: number;
    participants: Participant[];
    permissions: DocumentPermissions;
    metadata: DocumentMetadata;
    createdAt: Date;
    updatedAt: Date;
}
export type DocumentType = 'text' | 'spreadsheet' | 'drawing' | 'code' | 'json';
export interface CRDTData {
    type: CRDTType;
    state: any;
    operations: Operation[];
    vector: VectorClock;
}
export type CRDTType = 'lww_map' | 'g_set' | 'or_set' | 'pn_counter' | 'rga' | 'yjs';
export interface Operation {
    id: string;
    type: OperationType;
    position?: number;
    value?: any;
    actor: string;
    timestamp: Date;
    vector: VectorClock;
    dependencies?: string[];
}
export type OperationType = 'insert' | 'delete' | 'update' | 'set' | 'increment' | 'decrement';
export interface VectorClock {
    [actorId: string]: number;
}
export interface Participant {
    id: string;
    name: string;
    email: string;
    role: ParticipantRole;
    cursor?: CursorPosition;
    selection?: Selection;
    presence: PresenceState;
    joinedAt: Date;
    lastActiveAt: Date;
}
export type ParticipantRole = 'owner' | 'editor' | 'commenter' | 'viewer';
export interface CursorPosition {
    line: number;
    column: number;
    offset: number;
}
export interface Selection {
    start: CursorPosition;
    end: CursorPosition;
    direction: SelectionDirection;
}
export type SelectionDirection = 'forward' | 'backward' | 'none';
export interface PresenceState {
    status: PresenceStatus;
    color: string;
    lastUpdate: Date;
}
export type PresenceStatus = 'online' | 'away' | 'offline';
export interface DocumentPermissions {
    public: boolean;
    allowComments: boolean;
    allowDownload: boolean;
    allowCopy: boolean;
    viewers: string[];
    editors: string[];
    commenters: string[];
}
export interface DocumentMetadata {
    owner: string;
    folder?: string;
    tags: string[];
    size: number;
    checksum: string;
}
export interface TransformContext {
    operation: Operation;
    concurrent: Operation[];
    priority: number;
}
export interface TransformResult {
    transformed: Operation;
    inverted?: Operation;
}
export interface Change {
    id: string;
    documentId: string;
    operation: Operation;
    before?: any;
    after?: any;
    author: Participant;
    timestamp: Date;
    merged: boolean;
}
export interface ChangeSet {
    id: string;
    changes: Change[];
    summary: string;
    timestamp: Date;
}
export interface Comment {
    id: string;
    documentId: string;
    thread?: string;
    author: Participant;
    content: string;
    position?: CommentPosition;
    resolved: boolean;
    replies: Comment[];
    reactions: Reaction[];
    createdAt: Date;
    updatedAt: Date;
}
export interface CommentPosition {
    start: number;
    end: number;
    context?: string;
}
export interface Reaction {
    emoji: string;
    userId: string;
    timestamp: Date;
}
export interface Version {
    id: string;
    documentId: string;
    number: number;
    name?: string;
    description?: string;
    snapshot: CRDTData;
    changes: Change[];
    author: string;
    createdAt: Date;
}
export interface VersionDiff {
    additions: Operation[];
    deletions: Operation[];
    modifications: Operation[];
}
export interface Conflict {
    id: string;
    type: ConflictType;
    operations: Operation[];
    resolution?: ConflictResolution;
    resolvedBy?: string;
    resolvedAt?: Date;
}
export type ConflictType = 'concurrent_edit' | 'deletion' | 'permission' | 'version';
export interface ConflictResolution {
    strategy: ResolutionStrategy;
    winner?: Operation;
    merged?: Operation;
}
export type ResolutionStrategy = 'last_write_wins' | 'first_write_wins' | 'merge' | 'manual';
export interface MergeStrategy {
    name: string;
    merge: (local: CRDTData, remote: CRDTData) => CRDTData;
}
export interface SyncMessage {
    type: SyncMessageType;
    documentId: string;
    senderId: string;
    vector: VectorClock;
    operations?: Operation[];
    timestamp: Date;
}
export type SyncMessageType = 'sync_request' | 'sync_response' | 'operation' | 'ack';
export interface SyncState {
    documentId: string;
    localVector: VectorClock;
    remoteVectors: Map<string, VectorClock>;
    pendingOperations: Operation[];
    lastSyncAt: Date;
}
export declare class CRDTCollaborationManager extends EventEmitter {
    private config;
    private documents;
    private operations;
    private changes;
    private comments;
    private versions;
    private conflicts;
    private syncStates;
    private participants;
    constructor(config?: Partial<CRDTConfig>);
    createDocument(type: DocumentType, title: string, ownerId: string): Document;
    private initializeCRDT;
    applyOperation(documentId: string, operation: Omit<Operation, 'id' | 'vector' | 'timestamp'>): Promise<Operation>;
    private applyCRDTOperation;
    private getConcurrentOperations;
    private isConcurrent;
    private transformOperation;
    private transformPair;
    private incrementVector;
    private compareVectors;
    joinDocument(documentId: string, participant: Omit<Participant, 'joinedAt' | 'lastActiveAt'>): void;
    updatePresence(participantId: string, presence: Partial<PresenceState>, cursor?: CursorPosition, selection?: Selection): void;
    addComment(documentId: string, author: Participant, content: string, position?: CommentPosition, threadId?: string): Comment;
    resolveComment(commentId: string, documentId: string): void;
    private createVersion;
    restoreVersion(documentId: string, versionId: string): void;
    compareVersions(documentId: string, version1Id: string, version2Id: string): VersionDiff;
    private trackChange;
    private broadcastOperation;
    handleSyncMessage(message: SyncMessage): void;
    private handleSyncRequest;
    private handleRemoteOperation;
    private generateId;
    getStats(): {
        documents: number;
        participants: number;
        totalOperations: number;
        totalChanges: number;
        totalComments: number;
        totalVersions: number;
        conflicts: number;
    };
}
//# sourceMappingURL=CRDTCollaboration.d.ts.map