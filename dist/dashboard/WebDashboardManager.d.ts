/**
 * Web Dashboard - React Application
 * Real-time updates, collaborative editing, project explorer
 * Chat interface, analytics, settings
 */
import { EventEmitter } from 'events';
export interface DashboardConfig {
    port: number;
    host: string;
    enableWebSocket: boolean;
    enableAuth: boolean;
    theme: 'light' | 'dark' | 'auto';
    maxConnections: number;
}
export interface User {
    id: string;
    username: string;
    email: string;
    role: 'admin' | 'developer' | 'viewer';
    avatar?: string;
    preferences: UserPreferences;
    lastActive: number;
}
export interface UserPreferences {
    theme: 'light' | 'dark' | 'auto';
    language: string;
    notifications: boolean;
    fontSize: number;
    keymap: 'default' | 'vim' | 'emacs';
}
export interface Session {
    id: string;
    userId: string;
    token: string;
    createdAt: number;
    expiresAt: number;
    ipAddress: string;
    userAgent: string;
}
export interface Project {
    id: string;
    name: string;
    path: string;
    language: string;
    framework?: string;
    lastOpened: number;
    starred: boolean;
    color: string;
    stats: ProjectStats;
}
export interface ProjectStats {
    totalFiles: number;
    totalLines: number;
    languages: Record<string, number>;
    lastModified: number;
    commitCount: number;
}
export interface FileNode {
    id: string;
    name: string;
    path: string;
    type: 'file' | 'directory';
    size?: number;
    modified?: number;
    children?: FileNode[];
    expanded?: boolean;
}
export interface EditorState {
    fileId: string;
    content: string;
    language: string;
    cursor: CursorPosition;
    selection?: TextRange;
    dirty: boolean;
    version: number;
}
export interface CursorPosition {
    line: number;
    column: number;
}
export interface TextRange {
    start: CursorPosition;
    end: CursorPosition;
}
export interface ChatMessage {
    id: string;
    userId: string;
    username: string;
    content: string;
    timestamp: number;
    type: 'user' | 'assistant' | 'system';
    attachments?: Attachment[];
}
export interface Attachment {
    id: string;
    name: string;
    type: string;
    size: number;
    url: string;
}
export interface WebSocketMessage {
    type: string;
    payload: any;
    timestamp: number;
    userId?: string;
}
export interface Presence {
    userId: string;
    username: string;
    status: 'online' | 'away' | 'busy' | 'offline';
    currentFile?: string;
    cursor?: CursorPosition;
}
export interface Notification {
    id: string;
    userId: string;
    type: 'info' | 'success' | 'warning' | 'error';
    title: string;
    message: string;
    timestamp: number;
    read: boolean;
    actionUrl?: string;
}
export interface AnalyticsDashboard {
    timeRange: TimeRange;
    metrics: DashboardMetrics;
    charts: Chart[];
    tables: DataTable[];
}
export interface TimeRange {
    start: number;
    end: number;
    label: string;
}
export interface DashboardMetrics {
    totalRequests: number;
    successRate: number;
    averageResponseTime: number;
    activeUsers: number;
    errorRate: number;
}
export interface Chart {
    id: string;
    type: 'line' | 'bar' | 'pie' | 'area' | 'scatter';
    title: string;
    data: ChartData;
    options: ChartOptions;
}
export interface ChartData {
    labels: string[];
    datasets: Dataset[];
}
export interface Dataset {
    label: string;
    data: number[];
    backgroundColor?: string | string[];
    borderColor?: string;
    borderWidth?: number;
}
export interface ChartOptions {
    responsive: boolean;
    maintainAspectRatio: boolean;
    scales?: any;
    plugins?: any;
}
export interface DataTable {
    id: string;
    title: string;
    columns: TableColumn[];
    rows: TableRow[];
    pagination: TablePagination;
}
export interface TableColumn {
    id: string;
    label: string;
    field: string;
    sortable: boolean;
    width?: string;
}
export interface TableRow {
    id: string;
    data: Record<string, any>;
}
export interface TablePagination {
    page: number;
    pageSize: number;
    total: number;
}
export declare class WebDashboardManager extends EventEmitter {
    private config;
    private users;
    private sessions;
    private projects;
    private connections;
    private presence;
    private notifications;
    private server;
    private wss;
    constructor(config?: Partial<DashboardConfig>);
    start(): Promise<void>;
    stop(): Promise<void>;
    private initializeServer;
    private closeServer;
    private initializeWebSocket;
    private closeWebSocket;
    private loadData;
    createUser(data: Partial<User>): Promise<User>;
    updateUser(userId: string, updates: Partial<User>): Promise<User>;
    deleteUser(userId: string): Promise<void>;
    getUser(userId: string): User | undefined;
    listUsers(): User[];
    private getDefaultPreferences;
    authenticate(username: string, password: string): Promise<Session | null>;
    validateSession(token: string): Promise<Session | null>;
    logout(sessionId: string): Promise<void>;
    private generateToken;
    createProject(data: Partial<Project>): Promise<Project>;
    updateProject(projectId: string, updates: Partial<Project>): Promise<Project>;
    deleteProject(projectId: string): Promise<void>;
    getProject(projectId: string): Project | undefined;
    listProjects(userId?: string): Project[];
    private getEmptyStats;
    private generateColor;
    getFileTree(projectId: string): Promise<FileNode>;
    readFile(projectId: string, filePath: string): Promise<string>;
    writeFile(projectId: string, filePath: string, content: string): Promise<void>;
    deleteFile(projectId: string, filePath: string): Promise<void>;
    broadcastMessage(message: WebSocketMessage): Promise<void>;
    sendToUser(userId: string, message: WebSocketMessage): Promise<void>;
    updatePresence(userId: string, presence: Partial<Presence>): Promise<void>;
    getPresence(userId: string): Presence | undefined;
    listPresence(): Presence[];
    sendChatMessage(userId: string, content: string, attachments?: Attachment[]): Promise<ChatMessage>;
    sendAssistantMessage(content: string, attachments?: Attachment[]): Promise<ChatMessage>;
    createNotification(userId: string, notification: Omit<Notification, 'id' | 'timestamp' | 'read'>): Promise<Notification>;
    markNotificationRead(userId: string, notificationId: string): Promise<void>;
    getNotifications(userId: string, unreadOnly?: boolean): Notification[];
    getAnalytics(timeRange: TimeRange): Promise<AnalyticsDashboard>;
    private computeMetrics;
    private generateCharts;
    private generateTables;
    updateSettings(userId: string, settings: Partial<UserPreferences>): Promise<UserPreferences>;
    getSettings(userId: string): UserPreferences | undefined;
    handleWebSocketConnection(userId: string, ws: any): Promise<WebSocketConnection>;
    private handleWebSocketMessage;
    private handleFileEdit;
    private generateId;
    getStats(): DashboardStats;
}
declare class WebSocketConnection extends EventEmitter {
    id: string;
    userId: string;
    private ws;
    private connected;
    constructor(userId: string, ws: any);
    private setupHandlers;
    send(message: WebSocketMessage): void;
    close(): void;
    isConnected(): boolean;
}
interface DashboardStats {
    totalUsers: number;
    activeSessions: number;
    totalProjects: number;
    activeConnections: number;
    onlineUsers: number;
}
export default WebDashboardManager;
//# sourceMappingURL=WebDashboardManager.d.ts.map