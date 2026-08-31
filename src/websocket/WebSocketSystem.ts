/**
 * WebSocket and Real-time Communication System
 * WebSocket server, rooms, presence, message broadcasting, and real-time events
 */

import { eventBus } from '../core/EventBus';

export interface WebSocketServer {
  id: string;
  name: string;
  port: number;
  host: string;
  status: ServerStatus;
  connections: Map<string, WebSocketConnection>;
  rooms: Map<string, Room>;
  config: ServerConfig;
  statistics: ServerStatistics;
  createdAt: Date;
}

export enum ServerStatus {
  Starting = 'starting',
  Running = 'running',
  Stopping = 'stopping',
  Stopped = 'stopped',
  Error = 'error',
}

export interface ServerConfig {
  maxConnections: number;
  heartbeatInterval: number;
  connectionTimeout: number;
  messageRateLimit: number;
  compression: boolean;
  cors: CorsConfig;
}

export interface CorsConfig {
  enabled: boolean;
  origins: string[];
  credentials: boolean;
}

export interface WebSocketConnection {
  id: string;
  serverId: string;
  userId?: string;
  status: ConnectionStatus;
  protocol?: string;
  rooms: Set<string>;
  metadata: Record<string, any>;
  lastHeartbeat: Date;
  messageCount: number;
  connectedAt: Date;
}

export enum ConnectionStatus {
  Connecting = 'connecting',
  Connected = 'connected',
  Disconnecting = 'disconnecting',
  Disconnected = 'disconnected',
}

export interface Room {
  id: string;
  name: string;
  connections: Set<string>;
  metadata: Record<string, any>;
  config: RoomConfig;
  createdAt: Date;
}

export interface RoomConfig {
  maxMembers: number;
  persistent: boolean;
  password?: string;
  allowAnonymous: boolean;
}

export interface Message {
  id: string;
  type: MessageType;
  from: string;
  to?: string;
  room?: string;
  data: any;
  timestamp: Date;
  acknowledged?: boolean;
}

export enum MessageType {
  Text = 'text',
  Binary = 'binary',
  Ping = 'ping',
  Pong = 'pong',
  Join = 'join',
  Leave = 'leave',
  Broadcast = 'broadcast',
  Direct = 'direct',
  System = 'system',
}

export interface PresenceInfo {
  userId: string;
  status: PresenceStatus;
  lastSeen: Date;
  metadata: Record<string, any>;
}

export enum PresenceStatus {
  Online = 'online',
  Away = 'away',
  Busy = 'busy',
  Offline = 'offline',
}

export interface ServerStatistics {
  totalConnections: number;
  activeConnections: number;
  totalRooms: number;
  totalMessages: number;
  bytesReceived: number;
  bytesSent: number;
  uptime: number;
}

export interface BroadcastOptions {
  room?: string;
  exclude?: string[];
  includeOnly?: string[];
  requireAck?: boolean;
}

export interface Subscription {
  id: string;
  connectionId: string;
  event: string;
  filter?: (data: any) => boolean;
  callback: (data: any) => void;
}

export interface RateLimiter {
  connectionId: string;
  messages: number[];
  limit: number;
  window: number;
}

export interface ReconnectionPolicy {
  enabled: boolean;
  maxAttempts: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

export interface Channel {
  id: string;
  name: string;
  type: ChannelType;
  subscribers: Set<string>;
  config: ChannelConfig;
  lastMessage?: Message;
  createdAt: Date;
}

export enum ChannelType {
  Public = 'public',
  Private = 'private',
  Presence = 'presence',
}

export interface ChannelConfig {
  persistent: boolean;
  historySize: number;
  requireAuth: boolean;
}

/**
 * WebSocket Server Manager
 */
export class WebSocketServerManager {
  private servers: Map<string, WebSocketServer> = new Map();

  /**
   * Create server
   */
  createServer(config: Omit<WebSocketServer, 'id' | 'status' | 'connections' | 'rooms' | 'statistics' | 'createdAt'>): WebSocketServer {
    const server: WebSocketServer = {
      ...config,
      id: this.generateServerId(),
      status: ServerStatus.Starting,
      connections: new Map(),
      rooms: new Map(),
      statistics: {
        totalConnections: 0,
        activeConnections: 0,
        totalRooms: 0,
        totalMessages: 0,
        bytesReceived: 0,
        bytesSent: 0,
        uptime: 0,
      },
      createdAt: new Date(),
    };

    this.servers.set(server.id, server);

    eventBus.emitSync('websocket.server_created', server, 'WebSocketServerManager');

    return server;
  }

  /**
   * Start server
   */
  async startServer(serverId: string): Promise<void> {
    const server = this.servers.get(serverId);

    if (!server) {
      throw new Error(`Server not found: ${serverId}`);
    }

    server.status = ServerStatus.Running;

    eventBus.emitSync('websocket.server_started', server, 'WebSocketServerManager');
  }

  /**
   * Stop server
   */
  async stopServer(serverId: string): Promise<void> {
    const server = this.servers.get(serverId);

    if (!server) {
      throw new Error(`Server not found: ${serverId}`);
    }

    server.status = ServerStatus.Stopping;

    // Close all connections
    for (const connection of server.connections.values()) {
      this.closeConnection(serverId, connection.id);
    }

    server.status = ServerStatus.Stopped;

    eventBus.emitSync('websocket.server_stopped', server, 'WebSocketServerManager');
  }

  /**
   * Get server
   */
  getServer(serverId: string): WebSocketServer | undefined {
    return this.servers.get(serverId);
  }

  /**
   * List servers
   */
  listServers(): WebSocketServer[] {
    return Array.from(this.servers.values());
  }

  /**
   * Accept connection
   */
  acceptConnection(serverId: string, connectionData: Omit<WebSocketConnection, 'id' | 'status' | 'rooms' | 'messageCount' | 'lastHeartbeat' | 'connectedAt'>): WebSocketConnection {
    const server = this.servers.get(serverId);

    if (!server) {
      throw new Error(`Server not found: ${serverId}`);
    }

    if (server.connections.size >= server.config.maxConnections) {
      throw new Error('Server connection limit reached');
    }

    const connection: WebSocketConnection = {
      ...connectionData,
      id: this.generateConnectionId(),
      status: ConnectionStatus.Connected,
      rooms: new Set(),
      messageCount: 0,
      lastHeartbeat: new Date(),
      connectedAt: new Date(),
    };

    server.connections.set(connection.id, connection);
    server.statistics.totalConnections++;
    server.statistics.activeConnections++;

    eventBus.emitSync('websocket.connection_accepted', connection, 'WebSocketServerManager');

    return connection;
  }

  /**
   * Close connection
   */
  closeConnection(serverId: string, connectionId: string): void {
    const server = this.servers.get(serverId);

    if (!server) {
      throw new Error(`Server not found: ${serverId}`);
    }

    const connection = server.connections.get(connectionId);

    if (connection) {
      connection.status = ConnectionStatus.Disconnected;

      // Leave all rooms
      for (const roomId of connection.rooms) {
        this.leaveRoom(serverId, connectionId, roomId);
      }

      server.connections.delete(connectionId);
      server.statistics.activeConnections--;

      eventBus.emitSync('websocket.connection_closed', { serverId, connectionId }, 'WebSocketServerManager');
    }
  }

  /**
   * Get connection
   */
  getConnection(serverId: string, connectionId: string): WebSocketConnection | undefined {
    const server = this.servers.get(serverId);
    return server?.connections.get(connectionId);
  }

  /**
   * List connections
   */
  listConnections(serverId: string, filter?: { userId?: string; room?: string }): WebSocketConnection[] {
    const server = this.servers.get(serverId);

    if (!server) {
      return [];
    }

    let connections = Array.from(server.connections.values());

    if (filter?.userId) {
      connections = connections.filter(c => c.userId === filter.userId);
    }

    if (filter?.room) {
      connections = connections.filter(c => c.rooms.has(filter.room!));
    }

    return connections;
  }

  /**
   * Create room
   */
  createRoom(serverId: string, room: Omit<Room, 'id' | 'connections' | 'createdAt'>): Room {
    const server = this.servers.get(serverId);

    if (!server) {
      throw new Error(`Server not found: ${serverId}`);
    }

    const fullRoom: Room = {
      ...room,
      id: this.generateRoomId(),
      connections: new Set(),
      createdAt: new Date(),
    };

    server.rooms.set(fullRoom.id, fullRoom);
    server.statistics.totalRooms++;

    eventBus.emitSync('websocket.room_created', fullRoom, 'WebSocketServerManager');

    return fullRoom;
  }

  /**
   * Join room
   */
  joinRoom(serverId: string, connectionId: string, roomId: string): void {
    const server = this.servers.get(serverId);

    if (!server) {
      throw new Error(`Server not found: ${serverId}`);
    }

    const connection = server.connections.get(connectionId);
    const room = server.rooms.get(roomId);

    if (!connection || !room) {
      throw new Error('Connection or room not found');
    }

    if (room.connections.size >= room.config.maxMembers) {
      throw new Error('Room is full');
    }

    connection.rooms.add(roomId);
    room.connections.add(connectionId);

    eventBus.emitSync('websocket.room_joined', { serverId, connectionId, roomId }, 'WebSocketServerManager');
  }

  /**
   * Leave room
   */
  leaveRoom(serverId: string, connectionId: string, roomId: string): void {
    const server = this.servers.get(serverId);

    if (!server) {
      throw new Error(`Server not found: ${serverId}`);
    }

    const connection = server.connections.get(connectionId);
    const room = server.rooms.get(roomId);

    if (connection && room) {
      connection.rooms.delete(roomId);
      room.connections.delete(connectionId);

      // Remove room if empty and not persistent
      if (room.connections.size === 0 && !room.config.persistent) {
        server.rooms.delete(roomId);
        server.statistics.totalRooms--;
      }

      eventBus.emitSync('websocket.room_left', { serverId, connectionId, roomId }, 'WebSocketServerManager');
    }
  }

  /**
   * Get room
   */
  getRoom(serverId: string, roomId: string): Room | undefined {
    const server = this.servers.get(serverId);
    return server?.rooms.get(roomId);
  }

  /**
   * List rooms
   */
  listRooms(serverId: string): Room[] {
    const server = this.servers.get(serverId);
    return server ? Array.from(server.rooms.values()) : [];
  }

  private generateServerId(): string {
    return `ws_server_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  private generateConnectionId(): string {
    return `ws_conn_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  private generateRoomId(): string {
    return `ws_room_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }
}

/**
 * Message Manager
 */
export class MessageManager {
  private messages: Map<string, Message> = new Map();
  private serverManager: WebSocketServerManager;

  constructor(serverManager: WebSocketServerManager) {
    this.serverManager = serverManager;
  }

  /**
   * Send message
   */
  async sendMessage(serverId: string, message: Omit<Message, 'id' | 'timestamp'>): Promise<Message> {
    const fullMessage: Message = {
      ...message,
      id: this.generateMessageId(),
      timestamp: new Date(),
    };

    this.messages.set(fullMessage.id, fullMessage);

    const server = this.serverManager.getServer(serverId);

    if (server) {
      server.statistics.totalMessages++;
      server.statistics.bytesSent += JSON.stringify(fullMessage.data).length;
    }

    eventBus.emitSync('websocket.message_sent', fullMessage, 'MessageManager');

    return fullMessage;
  }

  /**
   * Broadcast message
   */
  async broadcast(serverId: string, data: any, options: BroadcastOptions = {}): Promise<number> {
    const server = this.serverManager.getServer(serverId);

    if (!server) {
      throw new Error(`Server not found: ${serverId}`);
    }

    let connections: WebSocketConnection[] = [];

    if (options.room) {
      connections = this.serverManager.listConnections(serverId, { room: options.room });
    } else {
      connections = this.serverManager.listConnections(serverId);
    }

    if (options.exclude) {
      connections = connections.filter(c => !options.exclude!.includes(c.id));
    }

    if (options.includeOnly) {
      connections = connections.filter(c => options.includeOnly!.includes(c.id));
    }

    for (const connection of connections) {
      await this.sendMessage(serverId, {
        type: MessageType.Broadcast,
        from: 'system',
        to: connection.id,
        data,
      });
    }

    return connections.length;
  }

  /**
   * Send to user
   */
  async sendToUser(serverId: string, userId: string, data: any): Promise<number> {
    const connections = this.serverManager.listConnections(serverId, { userId });

    for (const connection of connections) {
      await this.sendMessage(serverId, {
        type: MessageType.Direct,
        from: 'system',
        to: connection.id,
        data,
      });
    }

    return connections.length;
  }

  /**
   * Send to room
   */
  async sendToRoom(serverId: string, roomId: string, data: any, excludeConnection?: string): Promise<number> {
    return this.broadcast(serverId, data, {
      room: roomId,
      exclude: excludeConnection ? [excludeConnection] : undefined,
    });
  }

  /**
   * Get message
   */
  getMessage(messageId: string): Message | undefined {
    return this.messages.get(messageId);
  }

  /**
   * List messages
   */
  listMessages(filter?: { from?: string; to?: string; room?: string; type?: MessageType }): Message[] {
    let messages = Array.from(this.messages.values());

    if (filter?.from) {
      messages = messages.filter(m => m.from === filter.from);
    }

    if (filter?.to) {
      messages = messages.filter(m => m.to === filter.to);
    }

    if (filter?.room) {
      messages = messages.filter(m => m.room === filter.room);
    }

    if (filter?.type) {
      messages = messages.filter(m => m.type === filter.type);
    }

    return messages.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }
}

/**
 * Presence Manager
 */
export class PresenceManager {
  private presence: Map<string, PresenceInfo> = new Map();
  private serverManager: WebSocketServerManager;

  constructor(serverManager: WebSocketServerManager) {
    this.serverManager = serverManager;
  }

  /**
   * Update presence
   */
  updatePresence(userId: string, status: PresenceStatus, metadata: Record<string, any> = {}): void {
    const presenceInfo: PresenceInfo = {
      userId,
      status,
      lastSeen: new Date(),
      metadata,
    };

    this.presence.set(userId, presenceInfo);

    eventBus.emitSync('websocket.presence_updated', presenceInfo, 'PresenceManager');
  }

  /**
   * Get presence
   */
  getPresence(userId: string): PresenceInfo | undefined {
    return this.presence.get(userId);
  }

  /**
   * List presence
   */
  listPresence(filter?: { status?: PresenceStatus }): PresenceInfo[] {
    let presence = Array.from(this.presence.values());

    if (filter?.status) {
      presence = presence.filter(p => p.status === filter.status);
    }

    return presence;
  }

  /**
   * Get online users
   */
  getOnlineUsers(): string[] {
    return Array.from(this.presence.values())
      .filter(p => p.status === PresenceStatus.Online)
      .map(p => p.userId);
  }

  /**
   * Track connection presence
   */
  trackConnection(serverId: string, connectionId: string): void {
    const connection = this.serverManager.getConnection(serverId, connectionId);

    if (connection && connection.userId) {
      this.updatePresence(connection.userId, PresenceStatus.Online, connection.metadata);
    }
  }

  /**
   * Untrack connection presence
   */
  untrackConnection(serverId: string, connectionId: string): void {
    const connection = this.serverManager.getConnection(serverId, connectionId);

    if (connection && connection.userId) {
      const userConnections = this.serverManager.listConnections(serverId, { userId: connection.userId });

      // Only mark offline if no other connections
      if (userConnections.length <= 1) {
        this.updatePresence(connection.userId, PresenceStatus.Offline);
      }
    }
  }
}

/**
 * Channel Manager
 */
export class ChannelManager {
  private channels: Map<string, Channel> = new Map();
  private messageHistory: Map<string, Message[]> = new Map();

  /**
   * Create channel
   */
  createChannel(channel: Omit<Channel, 'id' | 'subscribers' | 'createdAt'>): Channel {
    const fullChannel: Channel = {
      ...channel,
      id: this.generateChannelId(),
      subscribers: new Set(),
      createdAt: new Date(),
    };

    this.channels.set(fullChannel.id, fullChannel);
    this.messageHistory.set(fullChannel.id, []);

    eventBus.emitSync('websocket.channel_created', fullChannel, 'ChannelManager');

    return fullChannel;
  }

  /**
   * Subscribe to channel
   */
  subscribe(channelId: string, connectionId: string): void {
    const channel = this.channels.get(channelId);

    if (!channel) {
      throw new Error(`Channel not found: ${channelId}`);
    }

    channel.subscribers.add(connectionId);

    eventBus.emitSync('websocket.channel_subscribed', { channelId, connectionId }, 'ChannelManager');
  }

  /**
   * Unsubscribe from channel
   */
  unsubscribe(channelId: string, connectionId: string): void {
    const channel = this.channels.get(channelId);

    if (channel) {
      channel.subscribers.delete(connectionId);

      eventBus.emitSync('websocket.channel_unsubscribed', { channelId, connectionId }, 'ChannelManager');
    }
  }

  /**
   * Publish to channel
   */
  publish(channelId: string, message: Message): void {
    const channel = this.channels.get(channelId);

    if (!channel) {
      throw new Error(`Channel not found: ${channelId}`);
    }

    channel.lastMessage = message;

    // Add to history
    const history = this.messageHistory.get(channelId) || [];
    history.push(message);

    // Trim history to configured size
    if (history.length > channel.config.historySize) {
      history.shift();
    }

    this.messageHistory.set(channelId, history);

    eventBus.emitSync('websocket.channel_published', { channelId, message }, 'ChannelManager');
  }

  /**
   * Get channel
   */
  getChannel(channelId: string): Channel | undefined {
    return this.channels.get(channelId);
  }

  /**
   * List channels
   */
  listChannels(filter?: { type?: ChannelType }): Channel[] {
    let channels = Array.from(this.channels.values());

    if (filter?.type) {
      channels = channels.filter(c => c.type === filter.type);
    }

    return channels;
  }

  /**
   * Get channel history
   */
  getHistory(channelId: string, limit?: number): Message[] {
    const history = this.messageHistory.get(channelId) || [];
    return limit ? history.slice(-limit) : history;
  }

  /**
   * Delete channel
   */
  deleteChannel(channelId: string): void {
    this.channels.delete(channelId);
    this.messageHistory.delete(channelId);

    eventBus.emitSync('websocket.channel_deleted', { channelId }, 'ChannelManager');
  }

  private generateChannelId(): string {
    return `channel_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }
}

/**
 * Rate Limiter
 */
export class WebSocketRateLimiter {
  private limiters: Map<string, RateLimiter> = new Map();

  /**
   * Check rate limit
   */
  checkLimit(connectionId: string, limit: number, window: number): boolean {
    const now = Date.now();

    if (!this.limiters.has(connectionId)) {
      this.limiters.set(connectionId, {
        connectionId,
        messages: [],
        limit,
        window,
      });
    }

    const limiter = this.limiters.get(connectionId)!;

    // Remove old messages outside window
    limiter.messages = limiter.messages.filter(timestamp => now - timestamp < window);

    if (limiter.messages.length >= limit) {
      return false;
    }

    limiter.messages.push(now);
    return true;
  }

  /**
   * Reset limiter
   */
  reset(connectionId: string): void {
    this.limiters.delete(connectionId);
  }

  /**
   * Get limiter
   */
  getLimiter(connectionId: string): RateLimiter | undefined {
    return this.limiters.get(connectionId);
  }
}

/**
 * Singleton instances
 */
export const webSocketServerManager = new WebSocketServerManager();
export const messageManager = new MessageManager(webSocketServerManager);
export const presenceManager = new PresenceManager(webSocketServerManager);
export const channelManager = new ChannelManager();
export const webSocketRateLimiter = new WebSocketRateLimiter();
