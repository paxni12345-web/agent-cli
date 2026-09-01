"use strict";
/**
 * Collaboration & Team Features - Multi-user support and real-time collaboration
 * User management, team workspaces, and shared sessions
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.activityFeed = exports.commentManager = exports.sessionManager = exports.teamManager = exports.userManager = exports.ActivityFeed = exports.CommentManager = exports.SharedSessionManager = exports.TeamManager = exports.UserManager = void 0;
const EventBus_1 = require("../core/EventBus");
/**
 * User Management
 */
class UserManager {
    users = new Map();
    sessions = new Map(); // sessionId -> userId
    /**
     * Create a new user
     */
    createUser(email, name, role = 'developer') {
        const user = {
            id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            email,
            name,
            role,
            status: 'offline',
            lastSeen: new Date(),
            createdAt: new Date(),
        };
        this.users.set(user.id, user);
        EventBus_1.eventBus.emitSync('user.created', user, 'UserManager');
        return user;
    }
    /**
     * Get user by ID
     */
    getUser(userId) {
        return this.users.get(userId);
    }
    /**
     * Update user
     */
    updateUser(userId, updates) {
        const user = this.users.get(userId);
        if (!user)
            return undefined;
        Object.assign(user, updates);
        EventBus_1.eventBus.emitSync('user.updated', user, 'UserManager');
        return user;
    }
    /**
     * Set user status
     */
    setStatus(userId, status) {
        const user = this.users.get(userId);
        if (!user)
            return;
        user.status = status;
        user.lastSeen = new Date();
        EventBus_1.eventBus.emitSync('user.status_changed', { userId, status }, 'UserManager');
    }
    /**
     * List all users
     */
    listUsers(filter) {
        let users = Array.from(this.users.values());
        if (filter?.role) {
            users = users.filter((u) => u.role === filter.role);
        }
        if (filter?.status) {
            users = users.filter((u) => u.status === filter.status);
        }
        return users;
    }
    /**
     * Delete user
     */
    deleteUser(userId) {
        const deleted = this.users.delete(userId);
        if (deleted) {
            EventBus_1.eventBus.emitSync('user.deleted', { userId }, 'UserManager');
        }
        return deleted;
    }
}
exports.UserManager = UserManager;
/**
 * Team Management
 */
class TeamManager {
    teams = new Map();
    /**
     * Create a new team
     */
    createTeam(name, ownerId) {
        const team = {
            id: `team_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name,
            ownerId,
            members: [
                {
                    userId: ownerId,
                    role: 'owner',
                    joinedAt: new Date(),
                },
            ],
            settings: {
                allowGuestAccess: false,
                defaultPermissions: ['read', 'write'],
                maxMembers: 10,
                features: ['chat', 'shared-sessions', 'version-control'],
            },
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        this.teams.set(team.id, team);
        EventBus_1.eventBus.emitSync('team.created', team, 'TeamManager');
        return team;
    }
    /**
     * Get team by ID
     */
    getTeam(teamId) {
        return this.teams.get(teamId);
    }
    /**
     * Add member to team
     */
    addMember(teamId, userId, role = 'member') {
        const team = this.teams.get(teamId);
        if (!team)
            return false;
        // Check if user is already a member
        if (team.members.some((m) => m.userId === userId)) {
            return false;
        }
        team.members.push({
            userId,
            role,
            joinedAt: new Date(),
        });
        team.updatedAt = new Date();
        EventBus_1.eventBus.emitSync('team.member_added', { teamId, userId, role }, 'TeamManager');
        return true;
    }
    /**
     * Remove member from team
     */
    removeMember(teamId, userId) {
        const team = this.teams.get(teamId);
        if (!team)
            return false;
        const initialLength = team.members.length;
        team.members = team.members.filter((m) => m.userId !== userId);
        if (team.members.length < initialLength) {
            team.updatedAt = new Date();
            EventBus_1.eventBus.emitSync('team.member_removed', { teamId, userId }, 'TeamManager');
            return true;
        }
        return false;
    }
    /**
     * Update member role
     */
    updateMemberRole(teamId, userId, role) {
        const team = this.teams.get(teamId);
        if (!team)
            return false;
        const member = team.members.find((m) => m.userId === userId);
        if (!member)
            return false;
        member.role = role;
        team.updatedAt = new Date();
        EventBus_1.eventBus.emitSync('team.member_role_updated', { teamId, userId, role }, 'TeamManager');
        return true;
    }
    /**
     * List teams for a user
     */
    listUserTeams(userId) {
        return Array.from(this.teams.values()).filter((team) => team.members.some((m) => m.userId === userId));
    }
    /**
     * Delete team
     */
    deleteTeam(teamId) {
        const deleted = this.teams.delete(teamId);
        if (deleted) {
            EventBus_1.eventBus.emitSync('team.deleted', { teamId }, 'TeamManager');
        }
        return deleted;
    }
}
exports.TeamManager = TeamManager;
/**
 * Shared Session Manager
 */
class SharedSessionManager {
    sessions = new Map();
    /**
     * Create a shared session
     */
    createSession(name, ownerId, expiresInHours) {
        const session = {
            id: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name,
            ownerId,
            participants: [
                {
                    userId: ownerId,
                    role: 'owner',
                    joinedAt: new Date(),
                },
            ],
            state: {},
            createdAt: new Date(),
            expiresAt: expiresInHours
                ? new Date(Date.now() + expiresInHours * 3600000)
                : undefined,
        };
        this.sessions.set(session.id, session);
        EventBus_1.eventBus.emitSync('session.created', session, 'SharedSessionManager');
        return session;
    }
    /**
     * Join a session
     */
    joinSession(sessionId, userId, role = 'viewer') {
        const session = this.sessions.get(sessionId);
        if (!session)
            return false;
        // Check if already a participant
        if (session.participants.some((p) => p.userId === userId)) {
            return false;
        }
        session.participants.push({
            userId,
            role,
            joinedAt: new Date(),
        });
        EventBus_1.eventBus.emitSync('session.joined', { sessionId, userId }, 'SharedSessionManager');
        return true;
    }
    /**
     * Leave a session
     */
    leaveSession(sessionId, userId) {
        const session = this.sessions.get(sessionId);
        if (!session)
            return false;
        const initialLength = session.participants.length;
        session.participants = session.participants.filter((p) => p.userId !== userId);
        if (session.participants.length < initialLength) {
            EventBus_1.eventBus.emitSync('session.left', { sessionId, userId }, 'SharedSessionManager');
            return true;
        }
        return false;
    }
    /**
     * Update participant cursor position
     */
    updateCursor(sessionId, userId, cursor) {
        const session = this.sessions.get(sessionId);
        if (!session)
            return;
        const participant = session.participants.find((p) => p.userId === userId);
        if (!participant)
            return;
        participant.cursor = cursor;
        EventBus_1.eventBus.emitSync('session.cursor_updated', { sessionId, userId, cursor }, 'SharedSessionManager');
    }
    /**
     * Update session state
     */
    updateState(sessionId, state) {
        const session = this.sessions.get(sessionId);
        if (!session)
            return;
        session.state = { ...session.state, ...state };
        EventBus_1.eventBus.emitSync('session.state_updated', { sessionId, state }, 'SharedSessionManager');
    }
    /**
     * Get session
     */
    getSession(sessionId) {
        return this.sessions.get(sessionId);
    }
    /**
     * List active sessions
     */
    listSessions(userId) {
        let sessions = Array.from(this.sessions.values());
        // Filter expired sessions
        const now = new Date();
        sessions = sessions.filter((s) => !s.expiresAt || s.expiresAt > now);
        if (userId) {
            sessions = sessions.filter((s) => s.participants.some((p) => p.userId === userId));
        }
        return sessions;
    }
    /**
     * Delete session
     */
    deleteSession(sessionId) {
        const deleted = this.sessions.delete(sessionId);
        if (deleted) {
            EventBus_1.eventBus.emitSync('session.deleted', { sessionId }, 'SharedSessionManager');
        }
        return deleted;
    }
}
exports.SharedSessionManager = SharedSessionManager;
/**
 * Comment System
 */
class CommentManager {
    comments = new Map();
    /**
     * Add a comment
     */
    addComment(userId, content, context, mentions = []) {
        const comment = {
            id: `comment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            userId,
            content,
            context,
            mentions,
            resolved: false,
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        this.comments.set(comment.id, comment);
        EventBus_1.eventBus.emitSync('comment.created', comment, 'CommentManager');
        // Notify mentioned users
        for (const mentionedUserId of mentions) {
            EventBus_1.eventBus.emitSync('comment.mention', { commentId: comment.id, userId: mentionedUserId }, 'CommentManager');
        }
        return comment;
    }
    /**
     * Get comment
     */
    getComment(commentId) {
        return this.comments.get(commentId);
    }
    /**
     * Update comment
     */
    updateComment(commentId, content) {
        const comment = this.comments.get(commentId);
        if (!comment)
            return false;
        comment.content = content;
        comment.updatedAt = new Date();
        EventBus_1.eventBus.emitSync('comment.updated', comment, 'CommentManager');
        return true;
    }
    /**
     * Resolve comment
     */
    resolveComment(commentId) {
        const comment = this.comments.get(commentId);
        if (!comment)
            return false;
        comment.resolved = true;
        comment.updatedAt = new Date();
        EventBus_1.eventBus.emitSync('comment.resolved', { commentId }, 'CommentManager');
        return true;
    }
    /**
     * List comments
     */
    listComments(filter) {
        let comments = Array.from(this.comments.values());
        if (filter?.file) {
            comments = comments.filter((c) => c.context.file === filter.file);
        }
        if (filter?.userId) {
            comments = comments.filter((c) => c.userId === filter.userId);
        }
        if (filter?.resolved !== undefined) {
            comments = comments.filter((c) => c.resolved === filter.resolved);
        }
        return comments.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }
    /**
     * Delete comment
     */
    deleteComment(commentId) {
        const deleted = this.comments.delete(commentId);
        if (deleted) {
            EventBus_1.eventBus.emitSync('comment.deleted', { commentId }, 'CommentManager');
        }
        return deleted;
    }
}
exports.CommentManager = CommentManager;
class ActivityFeed {
    activities = [];
    maxActivities = 1000;
    constructor() {
        // Subscribe to all events
        EventBus_1.eventBus.on('*', (event) => {
            this.recordActivity(event);
        });
    }
    recordActivity(event) {
        const activity = {
            id: `activity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            userId: event.data?.userId || 'system',
            type: event.type,
            action: event.type.split('.')[1] || 'unknown',
            metadata: event.data || {},
            timestamp: event.timestamp,
        };
        this.activities.push(activity);
        if (this.activities.length > this.maxActivities) {
            this.activities.shift();
        }
    }
    /**
     * Get recent activities
     */
    getActivities(filter) {
        let activities = [...this.activities];
        if (filter?.userId) {
            activities = activities.filter((a) => a.userId === filter.userId);
        }
        if (filter?.type) {
            activities = activities.filter((a) => a.type.startsWith(filter.type));
        }
        if (filter?.since) {
            activities = activities.filter((a) => a.timestamp >= filter.since);
        }
        // Sort by timestamp descending
        activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        if (filter?.limit) {
            activities = activities.slice(0, filter.limit);
        }
        return activities;
    }
}
exports.ActivityFeed = ActivityFeed;
/**
 * Singleton instances
 */
exports.userManager = new UserManager();
exports.teamManager = new TeamManager();
exports.sessionManager = new SharedSessionManager();
exports.commentManager = new CommentManager();
exports.activityFeed = new ActivityFeed();
