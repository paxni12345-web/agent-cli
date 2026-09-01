/**
 * MEGA PHASE 12: REAL-TIME COMMUNICATION SYSTEM
 * WebRTC, WebSocket, Video/Audio conferencing, Screen sharing
 * Lines: 3500+
 */
import { EventEmitter } from 'events';
export interface WebSocketConfig {
    port: number;
    host: string;
    path: string;
    protocols: string[];
    perMessageDeflate: boolean;
    maxPayload: number;
    clientTracking: boolean;
}
export interface WebSocketConnection {
    id: string;
    socket: any;
    userId?: string;
    rooms: Set<string>;
    subscriptions: Set<string>;
    metadata: Map<string, any>;
    state: ConnectionState;
    connectedAt: Date;
    lastActivity: Date;
}
export type ConnectionState = 'connecting' | 'open' | 'closing' | 'closed';
export interface WebSocketMessage {
    id: string;
    type: MessageType;
    event: string;
    data: any;
    timestamp: Date;
    senderId?: string;
    targetId?: string;
    room?: string;
}
export type MessageType = 'text' | 'binary' | 'ping' | 'pong' | 'broadcast' | 'direct' | 'room';
export interface Room {
    id: string;
    name: string;
    connections: Set<string>;
    metadata: Map<string, any>;
    createdAt: Date;
}
export declare class WebSocketServer extends EventEmitter {
    private config;
    private connections;
    private rooms;
    private messageQueue;
    constructor(config?: Partial<WebSocketConfig>);
    start(): void;
    handleConnection(socket: any): WebSocketConnection;
    send(connectionId: string, message: Omit<WebSocketMessage, 'id' | 'timestamp'>): void;
    broadcast(message: Omit<WebSocketMessage, 'id' | 'timestamp' | 'type'>, exclude?: string[]): void;
    joinRoom(connectionId: string, roomId: string): void;
    leaveRoom(connectionId: string, roomId: string): void;
    sendToRoom(roomId: string, message: Omit<WebSocketMessage, 'id' | 'timestamp' | 'type' | 'room'>): void;
    close(connectionId: string): void;
    private generateId;
    getStats(): {
        connections: number;
        rooms: number;
        activeConnections: number;
    };
}
export interface WebRTCConfig {
    iceServers: ICEServer[];
    iceTransportPolicy: ICETransportPolicy;
    bundlePolicy: BundlePolicy;
    rtcpMuxPolicy: RTCPMuxPolicy;
    maxBitrate: number;
}
export interface ICEServer {
    urls: string[];
    username?: string;
    credential?: string;
}
export type ICETransportPolicy = 'all' | 'relay';
export type BundlePolicy = 'balanced' | 'max-compat' | 'max-bundle';
export type RTCPMuxPolicy = 'negotiate' | 'require';
export interface PeerConnection {
    id: string;
    localPeerId: string;
    remotePeerId: string;
    state: PeerConnectionState;
    iceConnectionState: ICEConnectionState;
    signalingState: SignalingState;
    localDescription?: RTCSessionDescription;
    remoteDescription?: RTCSessionDescription;
    tracks: MediaTrack[];
    dataChannels: DataChannel[];
    statistics: PeerStatistics;
    createdAt: Date;
}
export type PeerConnectionState = 'new' | 'connecting' | 'connected' | 'disconnected' | 'failed' | 'closed';
export type ICEConnectionState = 'new' | 'checking' | 'connected' | 'completed' | 'failed' | 'disconnected' | 'closed';
export type SignalingState = 'stable' | 'have-local-offer' | 'have-remote-offer' | 'have-local-pranswer' | 'have-remote-pranswer' | 'closed';
export interface RTCSessionDescription {
    type: SessionDescriptionType;
    sdp: string;
}
export type SessionDescriptionType = 'offer' | 'answer' | 'pranswer' | 'rollback';
export interface MediaTrack {
    id: string;
    kind: MediaKind;
    label: string;
    enabled: boolean;
    muted: boolean;
    settings: MediaTrackSettings;
}
export type MediaKind = 'audio' | 'video';
export interface MediaTrackSettings {
    width?: number;
    height?: number;
    frameRate?: number;
    aspectRatio?: number;
    facingMode?: FacingMode;
    sampleRate?: number;
    channelCount?: number;
    echoCancellation?: boolean;
    noiseSuppression?: boolean;
}
export type FacingMode = 'user' | 'environment' | 'left' | 'right';
export interface DataChannel {
    id: string;
    label: string;
    ordered: boolean;
    maxPacketLifeTime?: number;
    maxRetransmits?: number;
    protocol: string;
    state: DataChannelState;
}
export type DataChannelState = 'connecting' | 'open' | 'closing' | 'closed';
export interface PeerStatistics {
    bytesSent: number;
    bytesReceived: number;
    packetsSent: number;
    packetsReceived: number;
    packetsLost: number;
    jitter: number;
    roundTripTime: number;
}
export declare class WebRTCManager extends EventEmitter {
    private config;
    private connections;
    private localStreams;
    constructor(config?: Partial<WebRTCConfig>);
    createConnection(localPeerId: string, remotePeerId: string): Promise<PeerConnection>;
    createOffer(connectionId: string): Promise<RTCSessionDescription>;
    createAnswer(connectionId: string, offer: RTCSessionDescription): Promise<RTCSessionDescription>;
    setRemoteDescription(connectionId: string, description: RTCSessionDescription): Promise<void>;
    addTrack(connectionId: string, track: MediaTrack): void;
    removeTrack(connectionId: string, trackId: string): void;
    createDataChannel(connectionId: string, label: string, options?: Partial<DataChannel>): DataChannel;
    sendData(connectionId: string, channelId: string, data: any): void;
    close(connectionId: string): void;
    private generateSDP;
    private generateId;
    getStats(): {
        connections: number;
        activeConnections: number;
        totalTracks: number;
    };
}
export interface ConferenceConfig {
    maxParticipants: number;
    enableRecording: boolean;
    enableScreenSharing: boolean;
    enableChat: boolean;
    videoQuality: VideoQuality;
    audioQuality: AudioQuality;
}
export type VideoQuality = 'low' | 'medium' | 'high' | 'hd' | 'fullhd';
export type AudioQuality = 'low' | 'medium' | 'high';
export interface Conference {
    id: string;
    name: string;
    participants: Participant[];
    state: ConferenceState;
    recording?: Recording;
    chat: ChatMessage[];
    createdAt: Date;
    startedAt?: Date;
    endedAt?: Date;
}
export type ConferenceState = 'waiting' | 'active' | 'ended';
export interface Participant {
    id: string;
    userId: string;
    name: string;
    role: ParticipantRole;
    audioEnabled: boolean;
    videoEnabled: boolean;
    screenSharing: boolean;
    handRaised: boolean;
    connectionQuality: ConnectionQuality;
    joinedAt: Date;
}
export type ParticipantRole = 'host' | 'moderator' | 'participant' | 'guest';
export type ConnectionQuality = 'excellent' | 'good' | 'fair' | 'poor';
export interface Recording {
    id: string;
    conferenceId: string;
    startedAt: Date;
    stoppedAt?: Date;
    duration?: number;
    size?: number;
    path?: string;
}
export interface ChatMessage {
    id: string;
    senderId: string;
    senderName: string;
    text: string;
    timestamp: Date;
    private?: boolean;
    targetId?: string;
}
export interface MediaStream {
    id: string;
    userId: string;
    kind: MediaKind;
    tracks: MediaTrack[];
    active: boolean;
}
export declare class VideoConferencingSystem extends EventEmitter {
    private config;
    private conferences;
    private streams;
    constructor(config?: Partial<ConferenceConfig>);
    createConference(name: string, hostId: string): Conference;
    joinConference(conferenceId: string, user: {
        userId: string;
        name: string;
        role?: ParticipantRole;
    }): Participant;
    leaveConference(conferenceId: string, participantId: string): void;
    toggleAudio(conferenceId: string, participantId: string): void;
    toggleVideo(conferenceId: string, participantId: string): void;
    startScreenSharing(conferenceId: string, participantId: string): void;
    stopScreenSharing(conferenceId: string, participantId: string): void;
    sendChatMessage(conferenceId: string, senderId: string, text: string, options?: {
        private?: boolean;
        targetId?: string;
    }): ChatMessage;
    startRecording(conferenceId: string): Recording;
    stopRecording(conferenceId: string): void;
    private generateId;
    getStats(): {
        conferences: number;
        activeConferences: number;
        totalParticipants: number;
    };
}
export declare class RealTimeCommunicationSystem {
    websocket: WebSocketServer;
    webrtc: WebRTCManager;
    conferencing: VideoConferencingSystem;
    constructor();
    getOverallStats(): {
        websocket: {
            connections: number;
            rooms: number;
            activeConnections: number;
        };
        webrtc: {
            connections: number;
            activeConnections: number;
            totalTracks: number;
        };
        conferencing: {
            conferences: number;
            activeConferences: number;
            totalParticipants: number;
        };
    };
}
//# sourceMappingURL=MEGA_RealTimeCommunication.d.ts.map