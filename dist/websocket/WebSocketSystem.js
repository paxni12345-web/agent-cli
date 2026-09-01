"use strict";
/**
 * WebSocket and Real-time Communication System
 * WebSocket server, rooms, presence, message broadcasting, and real-time events
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.webSocketRateLimiter = exports.channelManager = exports.presenceManager = exports.messageManager = exports.webSocketServerManager = exports.WebSocketRateLimiter = exports.ChannelManager = exports.PresenceManager = exports.MessageManager = exports.WebSocketServerManager = exports.ChannelType = exports.PresenceStatus = exports.MessageType = exports.ConnectionStatus = exports.ServerStatus = void 0;
const EventBus_1 = require("../core/EventBus");
var ServerStatus;
(function (ServerStatus) {
    ServerStatus["Starting"] = "starting";
    ServerStatus["Running"] = "running";
    ServerStatus["Stopping"] = "stopping";
    ServerStatus["Stopped"] = "stopped";
    ServerStatus["Error"] = "error";
})(ServerStatus || (exports.ServerStatus = ServerStatus = {}));
var ConnectionStatus;
(function (ConnectionStatus) {
    ConnectionStatus["Connecting"] = "connecting";
    ConnectionStatus["Connected"] = "connected";
    ConnectionStatus["Disconnecting"] = "disconnecting";
    ConnectionStatus["Disconnected"] = "disconnected";
})(ConnectionStatus || (exports.ConnectionStatus = ConnectionStatus = {}));
var MessageType;
(function (MessageType) {
    MessageType["Text"] = "text";
    MessageType["Binary"] = "binary";
    MessageType["Ping"] = "ping";
    MessageType["Pong"] = "pong";
    MessageType["Join"] = "join";
    MessageType["Leave"] = "leave";
    MessageType["Broadcast"] = "broadcast";
    MessageType["Direct"] = "direct";
    MessageType["System"] = "system";
})(MessageType || (exports.MessageType = MessageType = {}));
var PresenceStatus;
(function (PresenceStatus) {
    PresenceStatus["Online"] = "online";
    PresenceStatus["Away"] = "away";
    PresenceStatus["Busy"] = "busy";
    PresenceStatus["Offline"] = "offline";
})(PresenceStatus || (exports.PresenceStatus = PresenceStatus = {}));
var ChannelType;
(function (ChannelType) {
    ChannelType["Public"] = "public";
    ChannelType["Private"] = "private";
    ChannelType["Presence"] = "presence";
})(ChannelType || (exports.ChannelType = ChannelType = {}));
/**
 * WebSocket Server Manager
 */
class WebSocketServerManager {
    servers = new Map();
    /**
     * Create server
     */
    createServer(config) {
        const server = {
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
        EventBus_1.eventBus.emitSync('websocket.server_created', server, 'WebSocketServerManager');
        return server;
    }
    /**
     * Start server
     */
    async startServer(serverId) {
        const server = this.servers.get(serverId);
        if (!server) {
            throw new Error(`Server not found: ${serverId}`);
        }
        server.status = ServerStatus.Running;
        EventBus_1.eventBus.emitSync('websocket.server_started', server, 'WebSocketServerManager');
    }
    /**
     * Stop server
     */
    async stopServer(serverId) {
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
        EventBus_1.eventBus.emitSync('websocket.server_stopped', server, 'WebSocketServerManager');
    }
    /**
     * Get server
     */
    getServer(serverId) {
        return this.servers.get(serverId);
    }
    /**
     * List servers
     */
    listServers() {
        return Array.from(this.servers.values());
    }
    /**
     * Accept connection
     */
    acceptConnection(serverId, connectionData) {
        const server = this.servers.get(serverId);
        if (!server) {
            throw new Error(`Server not found: ${serverId}`);
        }
        if (server.connections.size >= server.config.maxConnections) {
            throw new Error('Server connection limit reached');
        }
        const connection = {
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
        EventBus_1.eventBus.emitSync('websocket.connection_accepted', connection, 'WebSocketServerManager');
        return connection;
    }
    /**
     * Close connection
     */
    closeConnection(serverId, connectionId) {
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
            EventBus_1.eventBus.emitSync('websocket.connection_closed', { serverId, connectionId }, 'WebSocketServerManager');
        }
    }
    /**
     * Get connection
     */
    getConnection(serverId, connectionId) {
        const server = this.servers.get(serverId);
        return server?.connections.get(connectionId);
    }
    /**
     * List connections
     */
    listConnections(serverId, filter) {
        const server = this.servers.get(serverId);
        if (!server) {
            return [];
        }
        let connections = Array.from(server.connections.values());
        if (filter?.userId) {
            connections = connections.filter(c => c.userId === filter.userId);
        }
        if (filter?.room) {
            connections = connections.filter(c => c.rooms.has(filter.room));
        }
        return connections;
    }
    /**
     * Create room
     */
    createRoom(serverId, room) {
        const server = this.servers.get(serverId);
        if (!server) {
            throw new Error(`Server not found: ${serverId}`);
        }
        const fullRoom = {
            ...room,
            id: this.generateRoomId(),
            connections: new Set(),
            createdAt: new Date(),
        };
        server.rooms.set(fullRoom.id, fullRoom);
        server.statistics.totalRooms++;
        EventBus_1.eventBus.emitSync('websocket.room_created', fullRoom, 'WebSocketServerManager');
        return fullRoom;
    }
    /**
     * Join room
     */
    joinRoom(serverId, connectionId, roomId) {
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
        EventBus_1.eventBus.emitSync('websocket.room_joined', { serverId, connectionId, roomId }, 'WebSocketServerManager');
    }
    /**
     * Leave room
     */
    leaveRoom(serverId, connectionId, roomId) {
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
            EventBus_1.eventBus.emitSync('websocket.room_left', { serverId, connectionId, roomId }, 'WebSocketServerManager');
        }
    }
    /**
     * Get room
     */
    getRoom(serverId, roomId) {
        const server = this.servers.get(serverId);
        return server?.rooms.get(roomId);
    }
    /**
     * List rooms
     */
    listRooms(serverId) {
        const server = this.servers.get(serverId);
        return server ? Array.from(server.rooms.values()) : [];
    }
    generateServerId() {
        return `ws_server_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
    generateConnectionId() {
        return `ws_conn_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
    generateRoomId() {
        return `ws_room_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
}
exports.WebSocketServerManager = WebSocketServerManager;
/**
 * Message Manager
 */
class MessageManager {
    messages = new Map();
    serverManager;
    constructor(serverManager) {
        this.serverManager = serverManager;
    }
    /**
     * Send message
     */
    async sendMessage(serverId, message) {
        const fullMessage = {
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
        EventBus_1.eventBus.emitSync('websocket.message_sent', fullMessage, 'MessageManager');
        return fullMessage;
    }
    /**
     * Broadcast message
     */
    async broadcast(serverId, data, options = {}) {
        const server = this.serverManager.getServer(serverId);
        if (!server) {
            throw new Error(`Server not found: ${serverId}`);
        }
        let connections = [];
        if (options.room) {
            connections = this.serverManager.listConnections(serverId, { room: options.room });
        }
        else {
            connections = this.serverManager.listConnections(serverId);
        }
        if (options.exclude) {
            connections = connections.filter(c => !options.exclude.includes(c.id));
        }
        if (options.includeOnly) {
            connections = connections.filter(c => options.includeOnly.includes(c.id));
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
    async sendToUser(serverId, userId, data) {
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
    async sendToRoom(serverId, roomId, data, excludeConnection) {
        return this.broadcast(serverId, data, {
            room: roomId,
            exclude: excludeConnection ? [excludeConnection] : undefined,
        });
    }
    /**
     * Get message
     */
    getMessage(messageId) {
        return this.messages.get(messageId);
    }
    /**
     * List messages
     */
    listMessages(filter) {
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
    generateMessageId() {
        return `msg_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
}
exports.MessageManager = MessageManager;
/**
 * Presence Manager
 */
class PresenceManager {
    presence = new Map();
    serverManager;
    constructor(serverManager) {
        this.serverManager = serverManager;
    }
    /**
     * Update presence
     */
    updatePresence(userId, status, metadata = {}) {
        const presenceInfo = {
            userId,
            status,
            lastSeen: new Date(),
            metadata,
        };
        this.presence.set(userId, presenceInfo);
        EventBus_1.eventBus.emitSync('websocket.presence_updated', presenceInfo, 'PresenceManager');
    }
    /**
     * Get presence
     */
    getPresence(userId) {
        return this.presence.get(userId);
    }
    /**
     * List presence
     */
    listPresence(filter) {
        let presence = Array.from(this.presence.values());
        if (filter?.status) {
            presence = presence.filter(p => p.status === filter.status);
        }
        return presence;
    }
    /**
     * Get online users
     */
    getOnlineUsers() {
        return Array.from(this.presence.values())
            .filter(p => p.status === PresenceStatus.Online)
            .map(p => p.userId);
    }
    /**
     * Track connection presence
     */
    trackConnection(serverId, connectionId) {
        const connection = this.serverManager.getConnection(serverId, connectionId);
        if (connection && connection.userId) {
            this.updatePresence(connection.userId, PresenceStatus.Online, connection.metadata);
        }
    }
    /**
     * Untrack connection presence
     */
    untrackConnection(serverId, connectionId) {
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
exports.PresenceManager = PresenceManager;
/**
 * Channel Manager
 */
class ChannelManager {
    channels = new Map();
    messageHistory = new Map();
    /**
     * Create channel
     */
    createChannel(channel) {
        const fullChannel = {
            ...channel,
            id: this.generateChannelId(),
            subscribers: new Set(),
            createdAt: new Date(),
        };
        this.channels.set(fullChannel.id, fullChannel);
        this.messageHistory.set(fullChannel.id, []);
        EventBus_1.eventBus.emitSync('websocket.channel_created', fullChannel, 'ChannelManager');
        return fullChannel;
    }
    /**
     * Subscribe to channel
     */
    subscribe(channelId, connectionId) {
        const channel = this.channels.get(channelId);
        if (!channel) {
            throw new Error(`Channel not found: ${channelId}`);
        }
        channel.subscribers.add(connectionId);
        EventBus_1.eventBus.emitSync('websocket.channel_subscribed', { channelId, connectionId }, 'ChannelManager');
    }
    /**
     * Unsubscribe from channel
     */
    unsubscribe(channelId, connectionId) {
        const channel = this.channels.get(channelId);
        if (channel) {
            channel.subscribers.delete(connectionId);
            EventBus_1.eventBus.emitSync('websocket.channel_unsubscribed', { channelId, connectionId }, 'ChannelManager');
        }
    }
    /**
     * Publish to channel
     */
    publish(channelId, message) {
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
        EventBus_1.eventBus.emitSync('websocket.channel_published', { channelId, message }, 'ChannelManager');
    }
    /**
     * Get channel
     */
    getChannel(channelId) {
        return this.channels.get(channelId);
    }
    /**
     * List channels
     */
    listChannels(filter) {
        let channels = Array.from(this.channels.values());
        if (filter?.type) {
            channels = channels.filter(c => c.type === filter.type);
        }
        return channels;
    }
    /**
     * Get channel history
     */
    getHistory(channelId, limit) {
        const history = this.messageHistory.get(channelId) || [];
        return limit ? history.slice(-limit) : history;
    }
    /**
     * Delete channel
     */
    deleteChannel(channelId) {
        this.channels.delete(channelId);
        this.messageHistory.delete(channelId);
        EventBus_1.eventBus.emitSync('websocket.channel_deleted', { channelId }, 'ChannelManager');
    }
    generateChannelId() {
        return `channel_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
}
exports.ChannelManager = ChannelManager;
/**
 * Rate Limiter
 */
class WebSocketRateLimiter {
    limiters = new Map();
    /**
     * Check rate limit
     */
    checkLimit(connectionId, limit, window) {
        const now = Date.now();
        if (!this.limiters.has(connectionId)) {
            this.limiters.set(connectionId, {
                connectionId,
                messages: [],
                limit,
                window,
            });
        }
        const limiter = this.limiters.get(connectionId);
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
    reset(connectionId) {
        this.limiters.delete(connectionId);
    }
    /**
     * Get limiter
     */
    getLimiter(connectionId) {
        return this.limiters.get(connectionId);
    }
}
exports.WebSocketRateLimiter = WebSocketRateLimiter;
/**
 * Singleton instances
 */
exports.webSocketServerManager = new WebSocketServerManager();
exports.messageManager = new MessageManager(exports.webSocketServerManager);
exports.presenceManager = new PresenceManager(exports.webSocketServerManager);
exports.channelManager = new ChannelManager();
exports.webSocketRateLimiter = new WebSocketRateLimiter();
