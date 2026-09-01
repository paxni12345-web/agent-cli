/**
 * WebSocket and Real-time Communication System
 * WebSocket server, rooms, presence, message broadcasting, and real-time events
 */
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
export declare enum ServerStatus {
    Starting = "starting",
    Running = "running",
    Stopping = "stopping",
    Stopped = "stopped",
    Error = "error"
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
export declare enum ConnectionStatus {
    Connecting = "connecting",
    Connected = "connected",
    Disconnecting = "disconnecting",
    Disconnected = "disconnected"
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
export declare enum MessageType {
    Text = "text",
    Binary = "binary",
    Ping = "ping",
    Pong = "pong",
    Join = "join",
    Leave = "leave",
    Broadcast = "broadcast",
    Direct = "direct",
    System = "system"
}
export interface PresenceInfo {
    userId: string;
    status: PresenceStatus;
    lastSeen: Date;
    metadata: Record<string, any>;
}
export declare enum PresenceStatus {
    Online = "online",
    Away = "away",
    Busy = "busy",
    Offline = "offline"
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
export declare enum ChannelType {
    Public = "public",
    Private = "private",
    Presence = "presence"
}
export interface ChannelConfig {
    persistent: boolean;
    historySize: number;
    requireAuth: boolean;
}
/**
 * WebSocket Server Manager
 */
export declare class WebSocketServerManager {
    private servers;
    /**
     * Create server
     */
    createServer(config: Omit<WebSocketServer, 'id' | 'status' | 'connections' | 'rooms' | 'statistics' | 'createdAt'>): WebSocketServer;
    /**
     * Start server
     */
    startServer(serverId: string): Promise<void>;
    /**
     * Stop server
     */
    stopServer(serverId: string): Promise<void>;
    /**
     * Get server
     */
    getServer(serverId: string): WebSocketServer | undefined;
    /**
     * List servers
     */
    listServers(): WebSocketServer[];
    /**
     * Accept connection
     */
    acceptConnection(serverId: string, connectionData: Omit<WebSocketConnection, 'id' | 'status' | 'rooms' | 'messageCount' | 'lastHeartbeat' | 'connectedAt'>): WebSocketConnection;
    /**
     * Close connection
     */
    closeConnection(serverId: string, connectionId: string): void;
    /**
     * Get connection
     */
    getConnection(serverId: string, connectionId: string): WebSocketConnection | undefined;
    /**
     * List connections
     */
    listConnections(serverId: string, filter?: {
        userId?: string;
        room?: string;
    }): WebSocketConnection[];
    /**
     * Create room
     */
    createRoom(serverId: string, room: Omit<Room, 'id' | 'connections' | 'createdAt'>): Room;
    /**
     * Join room
     */
    joinRoom(serverId: string, connectionId: string, roomId: string): void;
    /**
     * Leave room
     */
    leaveRoom(serverId: string, connectionId: string, roomId: string): void;
    /**
     * Get room
     */
    getRoom(serverId: string, roomId: string): Room | undefined;
    /**
     * List rooms
     */
    listRooms(serverId: string): Room[];
    private generateServerId;
    private generateConnectionId;
    private generateRoomId;
}
/**
 * Message Manager
 */
export declare class MessageManager {
    private messages;
    private serverManager;
    constructor(serverManager: WebSocketServerManager);
    /**
     * Send message
     */
    sendMessage(serverId: string, message: Omit<Message, 'id' | 'timestamp'>): Promise<Message>;
    /**
     * Broadcast message
     */
    broadcast(serverId: string, data: any, options?: BroadcastOptions): Promise<number>;
    /**
     * Send to user
     */
    sendToUser(serverId: string, userId: string, data: any): Promise<number>;
    /**
     * Send to room
     */
    sendToRoom(serverId: string, roomId: string, data: any, excludeConnection?: string): Promise<number>;
    /**
     * Get message
     */
    getMessage(messageId: string): Message | undefined;
    /**
     * List messages
     */
    listMessages(filter?: {
        from?: string;
        to?: string;
        room?: string;
        type?: MessageType;
    }): Message[];
    private generateMessageId;
}
/**
 * Presence Manager
 */
export declare class PresenceManager {
    private presence;
    private serverManager;
    constructor(serverManager: WebSocketServerManager);
    /**
     * Update presence
     */
    updatePresence(userId: string, status: PresenceStatus, metadata?: Record<string, any>): void;
    /**
     * Get presence
     */
    getPresence(userId: string): PresenceInfo | undefined;
    /**
     * List presence
     */
    listPresence(filter?: {
        status?: PresenceStatus;
    }): PresenceInfo[];
    /**
     * Get online users
     */
    getOnlineUsers(): string[];
    /**
     * Track connection presence
     */
    trackConnection(serverId: string, connectionId: string): void;
    /**
     * Untrack connection presence
     */
    untrackConnection(serverId: string, connectionId: string): void;
}
/**
 * Channel Manager
 */
export declare class ChannelManager {
    private channels;
    private messageHistory;
    /**
     * Create channel
     */
    createChannel(channel: Omit<Channel, 'id' | 'subscribers' | 'createdAt'>): Channel;
    /**
     * Subscribe to channel
     */
    subscribe(channelId: string, connectionId: string): void;
    /**
     * Unsubscribe from channel
     */
    unsubscribe(channelId: string, connectionId: string): void;
    /**
     * Publish to channel
     */
    publish(channelId: string, message: Message): void;
    /**
     * Get channel
     */
    getChannel(channelId: string): Channel | undefined;
    /**
     * List channels
     */
    listChannels(filter?: {
        type?: ChannelType;
    }): Channel[];
    /**
     * Get channel history
     */
    getHistory(channelId: string, limit?: number): Message[];
    /**
     * Delete channel
     */
    deleteChannel(channelId: string): void;
    private generateChannelId;
}
/**
 * Rate Limiter
 */
export declare class WebSocketRateLimiter {
    private limiters;
    /**
     * Check rate limit
     */
    checkLimit(connectionId: string, limit: number, window: number): boolean;
    /**
     * Reset limiter
     */
    reset(connectionId: string): void;
    /**
     * Get limiter
     */
    getLimiter(connectionId: string): RateLimiter | undefined;
}
/**
 * Singleton instances
 */
export declare const webSocketServerManager: WebSocketServerManager;
export declare const messageManager: MessageManager;
export declare const presenceManager: PresenceManager;
export declare const channelManager: ChannelManager;
export declare const webSocketRateLimiter: WebSocketRateLimiter;
//# sourceMappingURL=WebSocketSystem.d.ts.map