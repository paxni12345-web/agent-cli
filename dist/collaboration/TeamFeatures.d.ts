/**
 * Collaboration & Team Features - Multi-user support and real-time collaboration
 * User management, team workspaces, and shared sessions
 */
export interface User {
    id: string;
    email: string;
    name: string;
    role: 'viewer' | 'developer' | 'admin' | 'owner';
    avatar?: string;
    status: 'online' | 'offline' | 'away';
    lastSeen: Date;
    createdAt: Date;
}
export interface Team {
    id: string;
    name: string;
    ownerId: string;
    members: TeamMember[];
    settings: TeamSettings;
    createdAt: Date;
    updatedAt: Date;
}
export interface TeamMember {
    userId: string;
    role: 'member' | 'admin' | 'owner';
    joinedAt: Date;
}
export interface TeamSettings {
    allowGuestAccess: boolean;
    defaultPermissions: string[];
    maxMembers: number;
    features: string[];
}
export interface SharedSession {
    id: string;
    name: string;
    ownerId: string;
    participants: SessionParticipant[];
    state: any;
    createdAt: Date;
    expiresAt?: Date;
}
export interface SessionParticipant {
    userId: string;
    role: 'owner' | 'editor' | 'viewer';
    joinedAt: Date;
    cursor?: {
        line: number;
        column: number;
    };
    selection?: {
        start: number;
        end: number;
    };
}
export interface Comment {
    id: string;
    userId: string;
    content: string;
    context: {
        file?: string;
        line?: number;
        code?: string;
    };
    mentions: string[];
    resolved: boolean;
    createdAt: Date;
    updatedAt: Date;
}
/**
 * User Management
 */
export declare class UserManager {
    private users;
    private sessions;
    /**
     * Create a new user
     */
    createUser(email: string, name: string, role?: User['role']): User;
    /**
     * Get user by ID
     */
    getUser(userId: string): User | undefined;
    /**
     * Update user
     */
    updateUser(userId: string, updates: Partial<User>): User | undefined;
    /**
     * Set user status
     */
    setStatus(userId: string, status: User['status']): void;
    /**
     * List all users
     */
    listUsers(filter?: {
        role?: User['role'];
        status?: User['status'];
    }): User[];
    /**
     * Delete user
     */
    deleteUser(userId: string): boolean;
}
/**
 * Team Management
 */
export declare class TeamManager {
    private teams;
    /**
     * Create a new team
     */
    createTeam(name: string, ownerId: string): Team;
    /**
     * Get team by ID
     */
    getTeam(teamId: string): Team | undefined;
    /**
     * Add member to team
     */
    addMember(teamId: string, userId: string, role?: TeamMember['role']): boolean;
    /**
     * Remove member from team
     */
    removeMember(teamId: string, userId: string): boolean;
    /**
     * Update member role
     */
    updateMemberRole(teamId: string, userId: string, role: TeamMember['role']): boolean;
    /**
     * List teams for a user
     */
    listUserTeams(userId: string): Team[];
    /**
     * Delete team
     */
    deleteTeam(teamId: string): boolean;
}
/**
 * Shared Session Manager
 */
export declare class SharedSessionManager {
    private sessions;
    /**
     * Create a shared session
     */
    createSession(name: string, ownerId: string, expiresInHours?: number): SharedSession;
    /**
     * Join a session
     */
    joinSession(sessionId: string, userId: string, role?: SessionParticipant['role']): boolean;
    /**
     * Leave a session
     */
    leaveSession(sessionId: string, userId: string): boolean;
    /**
     * Update participant cursor position
     */
    updateCursor(sessionId: string, userId: string, cursor: {
        line: number;
        column: number;
    }): void;
    /**
     * Update session state
     */
    updateState(sessionId: string, state: any): void;
    /**
     * Get session
     */
    getSession(sessionId: string): SharedSession | undefined;
    /**
     * List active sessions
     */
    listSessions(userId?: string): SharedSession[];
    /**
     * Delete session
     */
    deleteSession(sessionId: string): boolean;
}
/**
 * Comment System
 */
export declare class CommentManager {
    private comments;
    /**
     * Add a comment
     */
    addComment(userId: string, content: string, context: Comment['context'], mentions?: string[]): Comment;
    /**
     * Get comment
     */
    getComment(commentId: string): Comment | undefined;
    /**
     * Update comment
     */
    updateComment(commentId: string, content: string): boolean;
    /**
     * Resolve comment
     */
    resolveComment(commentId: string): boolean;
    /**
     * List comments
     */
    listComments(filter?: {
        file?: string;
        userId?: string;
        resolved?: boolean;
    }): Comment[];
    /**
     * Delete comment
     */
    deleteComment(commentId: string): boolean;
}
/**
 * Activity Feed
 */
export interface Activity {
    id: string;
    userId: string;
    type: string;
    action: string;
    metadata: Record<string, any>;
    timestamp: Date;
}
export declare class ActivityFeed {
    private activities;
    private maxActivities;
    constructor();
    private recordActivity;
    /**
     * Get recent activities
     */
    getActivities(filter?: {
        userId?: string;
        type?: string;
        since?: Date;
        limit?: number;
    }): Activity[];
}
/**
 * Singleton instances
 */
export declare const userManager: UserManager;
export declare const teamManager: TeamManager;
export declare const sessionManager: SharedSessionManager;
export declare const commentManager: CommentManager;
export declare const activityFeed: ActivityFeed;
//# sourceMappingURL=TeamFeatures.d.ts.map