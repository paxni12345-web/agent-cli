/**
 * Real-time Collaboration & WebSocket System
 * Collaborative editing, presence tracking, cursor sharing
 * Real-time synchronization, conflict resolution, operational transformation
 */

import { EventEmitter } from 'events';

// ============================================================================
// Types & Interfaces
// ============================================================================

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

export type MessageType =
  | 'join'
  | 'leave'
  | 'operation'
  | 'cursor'
  | 'selection'
  | 'presence'
  | 'chat'
  | 'sync'
  | 'snapshot';

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

// ============================================================================
// Collaboration Manager
// ============================================================================

export class CollaborationManager extends EventEmitter {
  private config: CollaborationConfig;
  private sessions: Map<string, CollaborationSession> = new Map();
  private connections: Map<string, WebSocketConnection> = new Map();
  private chatMessages: Map<string, ChatMessage[]> = new Map();
  private awarenessStates: Map<string, Map<string, AwarenessUpdate>> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(config: Partial<CollaborationConfig> = {}) {
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

  public createSession(documentId: string, owner: string): CollaborationSession {
    const session: CollaborationSession = {
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

  public getSession(sessionId: string): CollaborationSession | undefined {
    return this.sessions.get(sessionId);
  }

  public closeSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

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

  public async joinSession(
    sessionId: string,
    userId: string,
    userName: string,
    permissions?: Partial<ParticipantPermissions>
  ): Promise<Participant> {
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

    const participant: Participant = {
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

  public removeParticipant(sessionId: string, participantId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

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

  public async applyOperation(
    sessionId: string,
    userId: string,
    operation: Omit<Operation, 'id' | 'timestamp' | 'transformed'>
  ): Promise<Operation> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const participant = session.participants.find(p => p.userId === userId);
    if (!participant || !participant.permissions.canEdit) {
      throw new Error('Permission denied');
    }

    const fullOperation: Operation = {
      ...operation,
      id: this.generateId(),
      timestamp: Date.now(),
      transformed: false,
    };

    // Check for concurrent operations
    const concurrentOps = session.operations.filter(
      op => op.version === operation.version && op.userId !== userId
    );

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

  private applyOperationToDocument(
    document: CollaborativeDocument,
    operation: Operation
  ): void {
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

  private async transformOperation(
    operation: Operation,
    concurrentOps: Operation[]
  ): Promise<Partial<Operation>> {
    let transformed = { ...operation };

    for (const concurrentOp of concurrentOps) {
      transformed = this.transformPair(transformed as Operation, concurrentOp);
    }

    return transformed;
  }

  private transformPair(op1: Operation, op2: Operation): Operation {
    // Simplified OT for insert/delete operations
    if (op1.type === 'insert' && op2.type === 'insert') {
      if (op1.position < op2.position) {
        return op1;
      } else if (op1.position > op2.position) {
        return {
          ...op1,
          position: op1.position + (op2.content?.length || 0),
        };
      } else {
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
      } else if (op1.position > op2.position + (op2.length || 0)) {
        return {
          ...op1,
          position: op1.position - (op2.length || 0),
        };
      } else {
        return {
          ...op1,
          position: op2.position,
        };
      }
    }

    if (op1.type === 'delete' && op2.type === 'insert') {
      if (op1.position < op2.position) {
        return op1;
      } else {
        return {
          ...op1,
          position: op1.position + (op2.content?.length || 0),
        };
      }
    }

    if (op1.type === 'delete' && op2.type === 'delete') {
      if (op1.position < op2.position) {
        return op1;
      } else if (op1.position >= op2.position + (op2.length || 0)) {
        return {
          ...op1,
          position: op1.position - (op2.length || 0),
        };
      } else {
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

  public updateAwareness(
    sessionId: string,
    userId: string,
    update: Partial<AwarenessUpdate>
  ): void {
    if (!this.config.enablePresence && !this.config.enableCursors) return;

    const session = this.sessions.get(sessionId);
    if (!session) return;

    const participant = session.participants.find(p => p.userId === userId);
    if (!participant) return;

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

  public sendChatMessage(
    sessionId: string,
    userId: string,
    userName: string,
    content: string,
    mentions: string[] = []
  ): ChatMessage {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const message: ChatMessage = {
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

  public getChatMessages(sessionId: string, limit: number = 50): ChatMessage[] {
    const messages = this.chatMessages.get(sessionId) || [];
    return messages.slice(-limit);
  }

  // ========================================================================
  // Snapshots
  // ========================================================================

  private async createSnapshot(session: CollaborationSession): Promise<DocumentSnapshot> {
    const snapshot: DocumentSnapshot = {
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

  public async syncSession(request: SyncRequest): Promise<SyncResponse> {
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
    const operations = session.operations.filter(
      op => op.version > request.currentVersion
    );

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

  public registerConnection(
    userId: string,
    sessionId: string,
    socket: any
  ): WebSocketConnection {
    const connection: WebSocketConnection = {
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

  public unregisterConnection(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.state = 'disconnected';
      this.connections.delete(connectionId);
      this.emit('connection:unregistered', { connection });
    }
  }

  private broadcastToSession(
    sessionId: string,
    message: Message,
    excludeUserId?: string
  ): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    for (const participant of session.participants) {
      if (excludeUserId && participant.userId === excludeUserId) continue;

      // Find participant's connection
      const connection = Array.from(this.connections.values()).find(
        c => c.userId === participant.userId && c.sessionId === sessionId
      );

      if (connection && connection.state === 'connected') {
        // In production, send via actual WebSocket
        this.emit('message:broadcast', { connection, message });
      }
    }
  }

  // ========================================================================
  // Heartbeat & Cleanup
  // ========================================================================

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeats();
    }, this.config.heartbeatInterval);
  }

  private sendHeartbeats(): void {
    const now = Date.now();

    for (const connection of this.connections.values()) {
      if (connection.state === 'connected') {
        // Check if connection is still alive
        if (now - connection.lastPong > this.config.heartbeatInterval * 2) {
          connection.state = 'disconnected';
          this.unregisterConnection(connection.id);
        } else {
          connection.lastPing = now;
          // In production, send actual ping
          this.emit('connection:ping', { connection });
        }
      }
    }
  }

  private startSessionCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupInactiveSessions();
    }, 60000);
  }

  private cleanupInactiveSessions(): void {
    const now = Date.now();

    for (const session of this.sessions.values()) {
      // Check if session has been inactive
      if (now - session.updatedAt > this.config.sessionTimeout) {
        // Check if any participants are still connected
        const hasActiveParticipants = session.participants.some(
          p => now - p.lastSeen < this.config.sessionTimeout
        );

        if (!hasActiveParticipants) {
          this.closeSession(session.id);
        }
      }
    }
  }

  // ========================================================================
  // Utilities
  // ========================================================================

  private generateId(): string {
    return `collab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateColor(): string {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A',
      '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2',
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  private calculateChecksum(content: string): string {
    // Simple checksum - in production use a proper hash function
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      hash = ((hash << 5) - hash) + content.charCodeAt(i);
      hash = hash & hash;
    }
    return hash.toString(36);
  }

  public getStats(): CollaborationStats {
    return {
      sessions: this.sessions.size,
      activeSessions: Array.from(this.sessions.values()).filter(
        s => s.state === 'active'
      ).length,
      connections: this.connections.size,
      totalParticipants: Array.from(this.sessions.values()).reduce(
        (sum, s) => sum + s.participants.length,
        0
      ),
      totalOperations: Array.from(this.sessions.values()).reduce(
        (sum, s) => sum + s.operations.length,
        0
      ),
      totalMessages: Array.from(this.chatMessages.values()).reduce(
        (sum, msgs) => sum + msgs.length,
        0
      ),
    };
  }

  public close(): void {
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

// ============================================================================
// Supporting Types
// ============================================================================

interface CollaborationStats {
  sessions: number;
  activeSessions: number;
  connections: number;
  totalParticipants: number;
  totalOperations: number;
  totalMessages: number;
}

// ============================================================================
// Export
// ============================================================================

export default CollaborationManager;
