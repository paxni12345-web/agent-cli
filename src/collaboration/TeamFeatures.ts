/**
 * Collaboration & Team Features - Multi-user support and real-time collaboration
 * User management, team workspaces, and shared sessions
 */

import { eventBus } from '../core/EventBus';

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
  cursor?: { line: number; column: number };
  selection?: { start: number; end: number };
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
export class UserManager {
  private users: Map<string, User> = new Map();
  private sessions: Map<string, string> = new Map(); // sessionId -> userId

  /**
   * Create a new user
   */
  createUser(email: string, name: string, role: User['role'] = 'developer'): User {
    const user: User = {
      id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      email,
      name,
      role,
      status: 'offline',
      lastSeen: new Date(),
      createdAt: new Date(),
    };

    this.users.set(user.id, user);
    eventBus.emitSync('user.created', user, 'UserManager');

    return user;
  }

  /**
   * Get user by ID
   */
  getUser(userId: string): User | undefined {
    return this.users.get(userId);
  }

  /**
   * Update user
   */
  updateUser(userId: string, updates: Partial<User>): User | undefined {
    const user = this.users.get(userId);
    if (!user) return undefined;

    Object.assign(user, updates);
    eventBus.emitSync('user.updated', user, 'UserManager');

    return user;
  }

  /**
   * Set user status
   */
  setStatus(userId: string, status: User['status']): void {
    const user = this.users.get(userId);
    if (!user) return;

    user.status = status;
    user.lastSeen = new Date();

    eventBus.emitSync('user.status_changed', { userId, status }, 'UserManager');
  }

  /**
   * List all users
   */
  listUsers(filter?: { role?: User['role']; status?: User['status'] }): User[] {
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
  deleteUser(userId: string): boolean {
    const deleted = this.users.delete(userId);
    if (deleted) {
      eventBus.emitSync('user.deleted', { userId }, 'UserManager');
    }
    return deleted;
  }
}

/**
 * Team Management
 */
export class TeamManager {
  private teams: Map<string, Team> = new Map();

  /**
   * Create a new team
   */
  createTeam(name: string, ownerId: string): Team {
    const team: Team = {
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
    eventBus.emitSync('team.created', team, 'TeamManager');

    return team;
  }

  /**
   * Get team by ID
   */
  getTeam(teamId: string): Team | undefined {
    return this.teams.get(teamId);
  }

  /**
   * Add member to team
   */
  addMember(teamId: string, userId: string, role: TeamMember['role'] = 'member'): boolean {
    const team = this.teams.get(teamId);
    if (!team) return false;

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
    eventBus.emitSync('team.member_added', { teamId, userId, role }, 'TeamManager');

    return true;
  }

  /**
   * Remove member from team
   */
  removeMember(teamId: string, userId: string): boolean {
    const team = this.teams.get(teamId);
    if (!team) return false;

    const initialLength = team.members.length;
    team.members = team.members.filter((m) => m.userId !== userId);

    if (team.members.length < initialLength) {
      team.updatedAt = new Date();
      eventBus.emitSync('team.member_removed', { teamId, userId }, 'TeamManager');
      return true;
    }

    return false;
  }

  /**
   * Update member role
   */
  updateMemberRole(teamId: string, userId: string, role: TeamMember['role']): boolean {
    const team = this.teams.get(teamId);
    if (!team) return false;

    const member = team.members.find((m) => m.userId === userId);
    if (!member) return false;

    member.role = role;
    team.updatedAt = new Date();

    eventBus.emitSync('team.member_role_updated', { teamId, userId, role }, 'TeamManager');

    return true;
  }

  /**
   * List teams for a user
   */
  listUserTeams(userId: string): Team[] {
    return Array.from(this.teams.values()).filter((team) =>
      team.members.some((m) => m.userId === userId)
    );
  }

  /**
   * Delete team
   */
  deleteTeam(teamId: string): boolean {
    const deleted = this.teams.delete(teamId);
    if (deleted) {
      eventBus.emitSync('team.deleted', { teamId }, 'TeamManager');
    }
    return deleted;
  }
}

/**
 * Shared Session Manager
 */
export class SharedSessionManager {
  private sessions: Map<string, SharedSession> = new Map();

  /**
   * Create a shared session
   */
  createSession(name: string, ownerId: string, expiresInHours?: number): SharedSession {
    const session: SharedSession = {
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
    eventBus.emitSync('session.created', session, 'SharedSessionManager');

    return session;
  }

  /**
   * Join a session
   */
  joinSession(sessionId: string, userId: string, role: SessionParticipant['role'] = 'viewer'): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    // Check if already a participant
    if (session.participants.some((p) => p.userId === userId)) {
      return false;
    }

    session.participants.push({
      userId,
      role,
      joinedAt: new Date(),
    });

    eventBus.emitSync('session.joined', { sessionId, userId }, 'SharedSessionManager');

    return true;
  }

  /**
   * Leave a session
   */
  leaveSession(sessionId: string, userId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    const initialLength = session.participants.length;
    session.participants = session.participants.filter((p) => p.userId !== userId);

    if (session.participants.length < initialLength) {
      eventBus.emitSync('session.left', { sessionId, userId }, 'SharedSessionManager');
      return true;
    }

    return false;
  }

  /**
   * Update participant cursor position
   */
  updateCursor(sessionId: string, userId: string, cursor: { line: number; column: number }): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const participant = session.participants.find((p) => p.userId === userId);
    if (!participant) return;

    participant.cursor = cursor;

    eventBus.emitSync(
      'session.cursor_updated',
      { sessionId, userId, cursor },
      'SharedSessionManager'
    );
  }

  /**
   * Update session state
   */
  updateState(sessionId: string, state: any): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.state = { ...session.state, ...state };

    eventBus.emitSync('session.state_updated', { sessionId, state }, 'SharedSessionManager');
  }

  /**
   * Get session
   */
  getSession(sessionId: string): SharedSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * List active sessions
   */
  listSessions(userId?: string): SharedSession[] {
    let sessions = Array.from(this.sessions.values());

    // Filter expired sessions
    const now = new Date();
    sessions = sessions.filter(
      (s) => !s.expiresAt || s.expiresAt > now
    );

    if (userId) {
      sessions = sessions.filter((s) =>
        s.participants.some((p) => p.userId === userId)
      );
    }

    return sessions;
  }

  /**
   * Delete session
   */
  deleteSession(sessionId: string): boolean {
    const deleted = this.sessions.delete(sessionId);
    if (deleted) {
      eventBus.emitSync('session.deleted', { sessionId }, 'SharedSessionManager');
    }
    return deleted;
  }
}

/**
 * Comment System
 */
export class CommentManager {
  private comments: Map<string, Comment> = new Map();

  /**
   * Add a comment
   */
  addComment(
    userId: string,
    content: string,
    context: Comment['context'],
    mentions: string[] = []
  ): Comment {
    const comment: Comment = {
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

    eventBus.emitSync('comment.created', comment, 'CommentManager');

    // Notify mentioned users
    for (const mentionedUserId of mentions) {
      eventBus.emitSync(
        'comment.mention',
        { commentId: comment.id, userId: mentionedUserId },
        'CommentManager'
      );
    }

    return comment;
  }

  /**
   * Get comment
   */
  getComment(commentId: string): Comment | undefined {
    return this.comments.get(commentId);
  }

  /**
   * Update comment
   */
  updateComment(commentId: string, content: string): boolean {
    const comment = this.comments.get(commentId);
    if (!comment) return false;

    comment.content = content;
    comment.updatedAt = new Date();

    eventBus.emitSync('comment.updated', comment, 'CommentManager');

    return true;
  }

  /**
   * Resolve comment
   */
  resolveComment(commentId: string): boolean {
    const comment = this.comments.get(commentId);
    if (!comment) return false;

    comment.resolved = true;
    comment.updatedAt = new Date();

    eventBus.emitSync('comment.resolved', { commentId }, 'CommentManager');

    return true;
  }

  /**
   * List comments
   */
  listComments(filter?: {
    file?: string;
    userId?: string;
    resolved?: boolean;
  }): Comment[] {
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
  deleteComment(commentId: string): boolean {
    const deleted = this.comments.delete(commentId);
    if (deleted) {
      eventBus.emitSync('comment.deleted', { commentId }, 'CommentManager');
    }
    return deleted;
  }
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

export class ActivityFeed {
  private activities: Activity[] = [];
  private maxActivities = 1000;

  constructor() {
    // Subscribe to all events
    eventBus.on('*', (event) => {
      this.recordActivity(event);
    });
  }

  private recordActivity(event: any): void {
    const activity: Activity = {
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
  getActivities(filter?: {
    userId?: string;
    type?: string;
    since?: Date;
    limit?: number;
  }): Activity[] {
    let activities = [...this.activities];

    if (filter?.userId) {
      activities = activities.filter((a) => a.userId === filter.userId);
    }

    if (filter?.type) {
      activities = activities.filter((a) => a.type.startsWith(filter.type!));
    }

    if (filter?.since) {
      activities = activities.filter((a) => a.timestamp >= filter.since!);
    }

    // Sort by timestamp descending
    activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    if (filter?.limit) {
      activities = activities.slice(0, filter.limit);
    }

    return activities;
  }
}

/**
 * Singleton instances
 */
export const userManager = new UserManager();
export const teamManager = new TeamManager();
export const sessionManager = new SharedSessionManager();
export const commentManager = new CommentManager();
export const activityFeed = new ActivityFeed();
