/**
 * Real-time Collaboration System
 * Multi-user editing, presence awareness, conflict resolution, and live cursors
 */

import { eventBus } from '../core/EventBus';

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

export enum MessageType {
  Join = 'join',
  Leave = 'leave',
  CursorMove = 'cursor_move',
  TextChange = 'text_change',
  Selection = 'selection',
  Chat = 'chat',
  Ping = 'ping',
  Sync = 'sync',
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
export class CollaborationManager {
  private sessions: Map<string, CollaborationSession> = new Map();
  private userSessions: Map<string, string> = new Map(); // userId -> sessionId
  private messageHandlers: Map<MessageType, MessageHandler[]> = new Map();

  /**
   * Create collaboration session
   */
  createSession(name: string, hostUserId: string, hostUsername: string): CollaborationSession {
    const session: CollaborationSession = {
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

    eventBus.emitSync('collaboration.session_created', session, 'CollaborationManager');

    return session;
  }

  /**
   * Join session
   */
  joinSession(sessionId: string, userId: string, username: string): Participant {
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

    const participant: Participant = {
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

    eventBus.emitSync('collaboration.user_joined', { sessionId, participant }, 'CollaborationManager');

    return participant;
  }

  /**
   * Leave session
   */
  leaveSession(sessionId: string, userId: string): void {
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

      eventBus.emitSync('collaboration.user_left', { sessionId, userId }, 'CollaborationManager');
    }
  }

  /**
   * Add document to session
   */
  addDocument(sessionId: string, path: string, content: string): CollaborativeDocument {
    const session = this.sessions.get(sessionId);

    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const document: CollaborativeDocument = {
      id: this.generateDocumentId(),
      path,
      content,
      version: 1,
      operations: [],
      locks: [],
    };

    session.documents.push(document);

    eventBus.emitSync('collaboration.document_added', { sessionId, document }, 'CollaborationManager');

    return document;
  }

  /**
   * Update cursor position
   */
  updateCursor(sessionId: string, userId: string, cursor: CursorPosition): void {
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
  async applyOperation(
    sessionId: string,
    documentId: string,
    operation: Omit<Operation, 'id' | 'timestamp' | 'acknowledged'>
  ): Promise<Operation> {
    const session = this.sessions.get(sessionId);

    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const document = session.documents.find(d => d.id === documentId);

    if (!document) {
      throw new Error(`Document not found: ${documentId}`);
    }

    const fullOperation: Operation = {
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

    eventBus.emitSync('collaboration.operation_applied', {
      sessionId,
      documentId,
      operation: fullOperation,
    }, 'CollaborationManager');

    return fullOperation;
  }

  /**
   * Acquire lock on document range
   */
  acquireLock(
    sessionId: string,
    documentId: string,
    userId: string,
    range: Lock['range'],
    duration: number = 30000
  ): Lock {
    const session = this.sessions.get(sessionId);

    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const document = session.documents.find(d => d.id === documentId);

    if (!document) {
      throw new Error(`Document not found: ${documentId}`);
    }

    // Check if range is already locked
    const existingLock = document.locks.find(lock =>
      this.rangesOverlap(lock.range, range) && lock.expiresAt > new Date()
    );

    if (existingLock) {
      throw new Error(`Range is already locked by user: ${existingLock.userId}`);
    }

    const lock: Lock = {
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
  releaseLock(
    sessionId: string,
    documentId: string,
    userId: string,
    range: Lock['range']
  ): void {
    const session = this.sessions.get(sessionId);

    if (!session) {
      return;
    }

    const document = session.documents.find(d => d.id === documentId);

    if (!document) {
      return;
    }

    document.locks = document.locks.filter(
      lock => !(lock.userId === userId && this.rangesEqual(lock.range, range))
    );
  }

  /**
   * Send chat message
   */
  sendChatMessage(sessionId: string, userId: string, content: string): ChatMessage {
    const session = this.sessions.get(sessionId);

    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const participant = session.participants.find(p => p.userId === userId);

    if (!participant) {
      throw new Error(`User not in session: ${userId}`);
    }

    const message: ChatMessage = {
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
  getSession(sessionId: string): CollaborationSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * List active sessions
   */
  listSessions(): CollaborationSession[] {
    return Array.from(this.sessions.values()).filter(s => s.status === 'active');
  }

  /**
   * Register message handler
   */
  onMessage(type: MessageType, handler: MessageHandler): void {
    if (!this.messageHandlers.has(type)) {
      this.messageHandlers.set(type, []);
    }

    this.messageHandlers.get(type)!.push(handler);
  }

  /**
   * Broadcast message to session
   */
  private broadcastMessage(
    sessionId: string,
    message: CollaborationMessage,
    excludeUserId?: string
  ): void {
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
  private detectConflicts(document: CollaborativeDocument, operation: Operation): Operation[] {
    const conflicts: Operation[] = [];

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
  private operationsConflict(op1: Operation, op2: Operation): boolean {
    // Simple conflict detection based on position proximity
    const position1 = op1.position.offset || 0;
    const position2 = op2.position.offset || 0;

    return Math.abs(position1 - position2) < 10;
  }

  /**
   * Resolve conflict
   */
  private async resolveConflict(
    operation: Operation,
    conflicts: Operation[]
  ): Promise<ConflictResolution> {
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
  private transformOperation(operation: Operation, against: Operation): Operation {
    const transformed = { ...operation };

    if (against.type === 'insert') {
      if (
        against.position.offset !== undefined &&
        operation.position.offset !== undefined &&
        against.position.offset <= operation.position.offset
      ) {
        transformed.position.offset = operation.position.offset + (against.content?.length || 0);
      }
    } else if (against.type === 'delete') {
      if (
        against.position.offset !== undefined &&
        operation.position.offset !== undefined &&
        against.position.offset < operation.position.offset
      ) {
        transformed.position.offset = operation.position.offset - (against.length || 0);
      }
    }

    return transformed;
  }

  /**
   * Apply operation to document
   */
  private applyOperationToDocument(document: CollaborativeDocument, operation: Operation): void {
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

  private rangesOverlap(range1: Lock['range'], range2: Lock['range']): boolean {
    return !(
      range1.endLine < range2.startLine ||
      range2.endLine < range1.startLine ||
      (range1.endLine === range2.startLine && range1.endColumn < range2.startColumn) ||
      (range2.endLine === range1.startLine && range2.endColumn < range1.startColumn)
    );
  }

  private rangesEqual(range1: Lock['range'], range2: Lock['range']): boolean {
    return (
      range1.startLine === range2.startLine &&
      range1.startColumn === range2.startColumn &&
      range1.endLine === range2.endLine &&
      range1.endColumn === range2.endColumn
    );
  }

  private extractMentions(content: string): string[] {
    const matches = content.match(/@(\w+)/g) || [];
    return matches.map(m => m.substring(1));
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  private generateDocumentId(): string {
    return `doc_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  private generateOperationId(): string {
    return `op_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  private generateUserColor(): string {
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

export type MessageHandler = (userId: string, message: CollaborationMessage) => void;

/**
 * Presence Manager
 */
export class PresenceManager {
  private presenceData: Map<string, UserPresence> = new Map();
  private activityTimeout = 300000; // 5 minutes

  /**
   * Update user presence
   */
  updatePresence(userId: string, presence: Partial<UserPresence>): void {
    const existing = this.presenceData.get(userId) || {
      userId,
      status: 'offline',
      lastSeen: new Date(),
    };

    const updated: UserPresence = {
      ...existing,
      ...presence,
      lastSeen: new Date(),
    };

    this.presenceData.set(userId, updated);

    eventBus.emitSync('presence.updated', updated, 'PresenceManager');
  }

  /**
   * Get user presence
   */
  getPresence(userId: string): UserPresence | undefined {
    return this.presenceData.get(userId);
  }

  /**
   * Get all online users
   */
  getOnlineUsers(): UserPresence[] {
    const now = Date.now();

    return Array.from(this.presenceData.values()).filter(
      p => p.status === 'online' && now - p.lastSeen.getTime() < this.activityTimeout
    );
  }

  /**
   * Mark user as idle
   */
  markIdle(userId: string): void {
    this.updatePresence(userId, { status: 'idle' });
  }

  /**
   * Mark user as offline
   */
  markOffline(userId: string): void {
    this.updatePresence(userId, { status: 'offline' });
  }
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
export class SyncEngine {
  private syncQueue: Map<string, SyncOperation[]> = new Map();
  private isSyncing: Map<string, boolean> = new Map();

  /**
   * Queue sync operation
   */
  queueSync(sessionId: string, operation: SyncOperation): void {
    if (!this.syncQueue.has(sessionId)) {
      this.syncQueue.set(sessionId, []);
    }

    this.syncQueue.get(sessionId)!.push(operation);

    this.processSyncQueue(sessionId);
  }

  /**
   * Process sync queue
   */
  private async processSyncQueue(sessionId: string): Promise<void> {
    if (this.isSyncing.get(sessionId)) {
      return;
    }

    this.isSyncing.set(sessionId, true);

    const queue = this.syncQueue.get(sessionId) || [];

    while (queue.length > 0) {
      const operation = queue.shift()!;

      try {
        await this.executeSyncOperation(operation);
      } catch (error) {
        console.error('Sync operation failed:', error);
      }
    }

    this.isSyncing.set(sessionId, false);
  }

  /**
   * Execute sync operation
   */
  private async executeSyncOperation(operation: SyncOperation): Promise<void> {
    // Mock implementation
    await new Promise(resolve => setTimeout(resolve, 10));
  }
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
export const collaborationManager = new CollaborationManager();
export const presenceManager = new PresenceManager();
export const syncEngine = new SyncEngine();
