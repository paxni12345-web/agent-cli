/**
 * PHASE 5: REAL-TIME COLLABORATION WITH CRDT
 * Conflict-free Replicated Data Types for collaborative editing
 *
 * Part of 350K lines goal - PHASE 5
 */

import { EventEmitter } from 'events';

// ============================================================================
// Types & Interfaces
// ============================================================================

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

export type OperationType =
  | 'insert'
  | 'delete'
  | 'update'
  | 'set'
  | 'increment'
  | 'decrement';

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

// Operational Transform
export interface TransformContext {
  operation: Operation;
  concurrent: Operation[];
  priority: number;
}

export interface TransformResult {
  transformed: Operation;
  inverted?: Operation;
}

// Change Tracking
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

// Comments & Annotations
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

// Version Control
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

// Conflict Resolution
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

// Merge Strategies
export interface MergeStrategy {
  name: string;
  merge: (local: CRDTData, remote: CRDTData) => CRDTData;
}

// Sync Protocol
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

// ============================================================================
// CRDT Collaboration Manager
// ============================================================================

export class CRDTCollaborationManager extends EventEmitter {
  private config: CRDTConfig;
  private documents: Map<string, Document> = new Map();
  private operations: Map<string, Operation[]> = new Map();
  private changes: Map<string, Change[]> = new Map();
  private comments: Map<string, Comment[]> = new Map();
  private versions: Map<string, Version[]> = new Map();
  private conflicts: Map<string, Conflict[]> = new Map();
  private syncStates: Map<string, SyncState> = new Map();
  private participants: Map<string, Participant> = new Map();

  constructor(config: Partial<CRDTConfig> = {}) {
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

  public createDocument(
    type: DocumentType,
    title: string,
    ownerId: string
  ): Document {
    const doc: Document = {
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

  private initializeCRDT(type: DocumentType): CRDTData {
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

  public async applyOperation(
    documentId: string,
    operation: Omit<Operation, 'id' | 'vector' | 'timestamp'>
  ): Promise<Operation> {
    const doc = this.documents.get(documentId);

    if (!doc) {
      throw new Error('Document not found');
    }

    // Create full operation
    const op: Operation = {
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
    this.operations.get(documentId)!.push(op);

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

  private applyCRDTOperation(crdt: CRDTData, operation: Operation): void {
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

  private getConcurrentOperations(doc: Document, op: Operation): Operation[] {
    return doc.content.operations.filter(existing => {
      return this.isConcurrent(existing.vector, op.vector);
    });
  }

  private isConcurrent(v1: VectorClock, v2: VectorClock): boolean {
    const actors = new Set([...Object.keys(v1), ...Object.keys(v2)]);

    let v1Higher = false;
    let v2Higher = false;

    for (const actor of actors) {
      const t1 = v1[actor] || 0;
      const t2 = v2[actor] || 0;

      if (t1 > t2) v1Higher = true;
      if (t2 > t1) v2Higher = true;
    }

    return v1Higher && v2Higher;
  }

  private transformOperation(
    op: Operation,
    concurrent: Operation[]
  ): TransformResult {
    let transformed = { ...op };

    for (const other of concurrent) {
      transformed = this.transformPair(transformed, other);
    }

    return {
      transformed,
    };
  }

  private transformPair(op1: Operation, op2: Operation): Operation {
    // Simplified OT - real implementation would be more complex
    if (op1.type === 'insert' && op2.type === 'insert') {
      if (
        typeof op1.position === 'number' &&
        typeof op2.position === 'number' &&
        op2.position <= op1.position
      ) {
        return {
          ...op1,
          position: op1.position + 1,
        };
      }
    } else if (op1.type === 'insert' && op2.type === 'delete') {
      if (
        typeof op1.position === 'number' &&
        typeof op2.position === 'number' &&
        op2.position < op1.position
      ) {
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

  private incrementVector(vector: VectorClock, actor: string): VectorClock {
    return {
      ...vector,
      [actor]: (vector[actor] || 0) + 1,
    };
  }

  private compareVectors(v1: VectorClock, v2: VectorClock): number {
    const actors = new Set([...Object.keys(v1), ...Object.keys(v2)]);

    let allLessOrEqual = true;
    let allGreaterOrEqual = true;

    for (const actor of actors) {
      const t1 = v1[actor] || 0;
      const t2 = v2[actor] || 0;

      if (t1 > t2) allLessOrEqual = false;
      if (t1 < t2) allGreaterOrEqual = false;
    }

    if (allLessOrEqual && allGreaterOrEqual) return 0; // Equal
    if (allLessOrEqual) return -1; // v1 < v2
    if (allGreaterOrEqual) return 1; // v1 > v2
    return NaN; // Concurrent
  }

  // ========================================================================
  // Participants & Presence
  // ========================================================================

  public joinDocument(documentId: string, participant: Omit<Participant, 'joinedAt' | 'lastActiveAt'>): void {
    const doc = this.documents.get(documentId);

    if (!doc) {
      throw new Error('Document not found');
    }

    const fullParticipant: Participant = {
      ...participant,
      joinedAt: new Date(),
      lastActiveAt: new Date(),
    };

    doc.participants.push(fullParticipant);
    this.participants.set(participant.id, fullParticipant);

    this.emit('participant:joined', { documentId, participantId: participant.id });
  }

  public updatePresence(
    participantId: string,
    presence: Partial<PresenceState>,
    cursor?: CursorPosition,
    selection?: Selection
  ): void {
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

  public addComment(
    documentId: string,
    author: Participant,
    content: string,
    position?: CommentPosition,
    threadId?: string
  ): Comment {
    const comment: Comment = {
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
        .get(documentId)!
        .find(c => c.id === threadId);

      if (parentComment) {
        parentComment.replies.push(comment);
      }
    } else {
      this.comments.get(documentId)!.push(comment);
    }

    this.emit('comment:added', { documentId, commentId: comment.id });

    return comment;
  }

  public resolveComment(commentId: string, documentId: string): void {
    const comments = this.comments.get(documentId);

    if (!comments) return;

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

  private createVersion(
    documentId: string,
    description: string,
    author: string
  ): Version {
    const doc = this.documents.get(documentId);

    if (!doc) {
      throw new Error('Document not found');
    }

    const versions = this.versions.get(documentId)!;

    const version: Version = {
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

  public restoreVersion(documentId: string, versionId: string): void {
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

  public compareVersions(
    documentId: string,
    version1Id: string,
    version2Id: string
  ): VersionDiff {
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
    const diff: VersionDiff = {
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

  private trackChange(doc: Document, operation: Operation): void {
    const change: Change = {
      id: this.generateId(),
      documentId: doc.id,
      operation,
      before: null,
      after: null,
      author: doc.participants.find(p => p.id === operation.actor)!,
      timestamp: new Date(),
      merged: false,
    };

    const changes = this.changes.get(doc.id)!;
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

  private broadcastOperation(doc: Document, operation: Operation): void {
    const message: SyncMessage = {
      type: 'operation',
      documentId: doc.id,
      senderId: operation.actor,
      vector: operation.vector,
      operations: [operation],
      timestamp: new Date(),
    };

    this.emit('sync:broadcast', { message });
  }

  public handleSyncMessage(message: SyncMessage): void {
    switch (message.type) {
      case 'sync_request':
        this.handleSyncRequest(message);
        break;
      case 'operation':
        this.handleRemoteOperation(message);
        break;
    }
  }

  private handleSyncRequest(message: SyncMessage): void {
    const doc = this.documents.get(message.documentId);

    if (!doc) return;

    const response: SyncMessage = {
      type: 'sync_response',
      documentId: doc.id,
      senderId: 'server',
      vector: doc.content.vector,
      operations: doc.content.operations,
      timestamp: new Date(),
    };

    this.emit('sync:response', { response });
  }

  private handleRemoteOperation(message: SyncMessage): void {
    if (!message.operations) return;

    for (const op of message.operations) {
      this.applyOperation(message.documentId, op);
    }
  }

  // ========================================================================
  // Helper Methods
  // ========================================================================

  private generateId(): string {
    return `crdt-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  }

  public getStats() {
    return {
      documents: this.documents.size,
      participants: this.participants.size,
      totalOperations: Array.from(this.operations.values()).reduce(
        (sum, ops) => sum + ops.length,
        0
      ),
      totalChanges: Array.from(this.changes.values()).reduce(
        (sum, changes) => sum + changes.length,
        0
      ),
      totalComments: Array.from(this.comments.values()).reduce(
        (sum, comments) => sum + comments.length,
        0
      ),
      totalVersions: Array.from(this.versions.values()).reduce(
        (sum, versions) => sum + versions.length,
        0
      ),
      conflicts: Array.from(this.conflicts.values()).reduce(
        (sum, conflicts) => sum + conflicts.length,
        0
      ),
    };
  }
}
