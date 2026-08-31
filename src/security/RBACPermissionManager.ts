/**
 * RBAC Permission Manager
 * Implements comprehensive role-based access control with:
 * - Role hierarchy
 * - Permission checking
 * - Resource-based access control
 * - Permission caching with TTL
 * - Dynamic permission evaluation
 * - Permission inheritance
 * - Role assignment/revocation
 * - Audit trail
 */

export enum Role {
  ADMIN = 'admin',
  MANAGER = 'manager',
  USER = 'user',
}

export enum Permission {
  // User management
  CREATE_USER = 'user:create',
  READ_USER = 'user:read',
  UPDATE_USER = 'user:update',
  DELETE_USER = 'user:delete',

  // Resource management
  CREATE_RESOURCE = 'resource:create',
  READ_RESOURCE = 'resource:read',
  UPDATE_RESOURCE = 'resource:update',
  DELETE_RESOURCE = 'resource:delete',

  // Role management
  ASSIGN_ROLE = 'role:assign',
  REVOKE_ROLE = 'role:revoke',

  // System permissions
  MANAGE_PERMISSIONS = 'system:manage_permissions',
  VIEW_AUDIT_LOG = 'system:view_audit_log',
  CONFIGURE_SYSTEM = 'system:configure',
}

export interface User {
  id: string;
  username: string;
  roles: Role[];
  customPermissions?: Permission[];
  resourcePermissions?: Map<string, Permission[]>;
}

export interface Resource {
  id: string;
  type: string;
  ownerId: string;
  metadata?: Record<string, any>;
}

export interface AuditEntry {
  timestamp: Date;
  action: string;
  actorId: string;
  targetId: string;
  details: Record<string, any>;
  result: 'success' | 'failure';
  reason?: string;
}

export interface PermissionCacheEntry {
  userId: string;
  permission: Permission;
  resourceId?: string;
  granted: boolean;
  expiresAt: number;
}

export interface DynamicPermissionRule {
  name: string;
  evaluate: (user: User, permission: Permission, resource?: Resource) => boolean;
  priority: number;
}

export class RBACPermissionManager {
  // Role hierarchy: higher value = more privileges
  private static readonly ROLE_HIERARCHY: Record<Role, number> = {
    [Role.USER]: 1,
    [Role.MANAGER]: 2,
    [Role.ADMIN]: 3,
  };

  // Default permissions for each role
  private static readonly ROLE_PERMISSIONS: Record<Role, Permission[]> = {
    [Role.USER]: [
      Permission.READ_USER,
      Permission.READ_RESOURCE,
    ],
    [Role.MANAGER]: [
      Permission.READ_USER,
      Permission.UPDATE_USER,
      Permission.CREATE_RESOURCE,
      Permission.READ_RESOURCE,
      Permission.UPDATE_RESOURCE,
      Permission.DELETE_RESOURCE,
    ],
    [Role.ADMIN]: [
      Permission.CREATE_USER,
      Permission.READ_USER,
      Permission.UPDATE_USER,
      Permission.DELETE_USER,
      Permission.CREATE_RESOURCE,
      Permission.READ_RESOURCE,
      Permission.UPDATE_RESOURCE,
      Permission.DELETE_RESOURCE,
      Permission.ASSIGN_ROLE,
      Permission.REVOKE_ROLE,
      Permission.MANAGE_PERMISSIONS,
      Permission.VIEW_AUDIT_LOG,
      Permission.CONFIGURE_SYSTEM,
    ],
  };

  private users: Map<string, User>;
  private resources: Map<string, Resource>;
  private permissionCache: Map<string, PermissionCacheEntry>;
  private auditLog: AuditEntry[];
  private dynamicRules: DynamicPermissionRule[];
  private cacheTTL: number; // in milliseconds

  constructor(cacheTTL: number = 300000) { // Default 5 minutes
    this.users = new Map();
    this.resources = new Map();
    this.permissionCache = new Map();
    this.auditLog = [];
    this.dynamicRules = [];
    this.cacheTTL = cacheTTL;

    // Initialize default dynamic rules
    this.initializeDefaultDynamicRules();
  }

  /**
   * Initialize default dynamic permission rules
   */
  private initializeDefaultDynamicRules(): void {
    // Resource owner always has full access
    this.addDynamicRule({
      name: 'resource_owner',
      priority: 100,
      evaluate: (user: User, permission: Permission, resource?: Resource): boolean => {
        if (!resource) return false;
        return resource.ownerId === user.id;
      },
    });

    // Managers can manage resources owned by users with lower roles
    this.addDynamicRule({
      name: 'manager_subordinate_access',
      priority: 50,
      evaluate: (user: User, permission: Permission, resource?: Resource): boolean => {
        if (!resource || !this.hasRole(user, Role.MANAGER)) return false;

        const resourceOwner = this.users.get(resource.ownerId);
        if (!resourceOwner) return false;

        const userLevel = this.getHighestRoleLevel(user);
        const ownerLevel = this.getHighestRoleLevel(resourceOwner);

        return userLevel > ownerLevel &&
               (permission === Permission.READ_RESOURCE ||
                permission === Permission.UPDATE_RESOURCE);
      },
    });
  }

  /**
   * Register a user in the system
   */
  public registerUser(user: User): void {
    if (!user.id || !user.username) {
      throw new Error('User must have id and username');
    }

    if (this.users.has(user.id)) {
      throw new Error(`User with id ${user.id} already exists`);
    }

    // Ensure user has at least USER role
    if (!user.roles || user.roles.length === 0) {
      user.roles = [Role.USER];
    }

    this.users.set(user.id, { ...user });

    this.logAudit({
      timestamp: new Date(),
      action: 'user_registered',
      actorId: 'system',
      targetId: user.id,
      details: { username: user.username, roles: user.roles },
      result: 'success',
    });
  }

  /**
   * Register a resource in the system
   */
  public registerResource(resource: Resource): void {
    if (!resource.id || !resource.type || !resource.ownerId) {
      throw new Error('Resource must have id, type, and ownerId');
    }

    if (!this.users.has(resource.ownerId)) {
      throw new Error(`Resource owner ${resource.ownerId} does not exist`);
    }

    this.resources.set(resource.id, { ...resource });

    this.logAudit({
      timestamp: new Date(),
      action: 'resource_registered',
      actorId: resource.ownerId,
      targetId: resource.id,
      details: { type: resource.type },
      result: 'success',
    });
  }

  /**
   * Assign a role to a user
   */
  public assignRole(actorId: string, targetUserId: string, role: Role): boolean {
    const actor = this.users.get(actorId);
    const targetUser = this.users.get(targetUserId);

    if (!actor || !targetUser) {
      this.logAudit({
        timestamp: new Date(),
        action: 'assign_role',
        actorId,
        targetId: targetUserId,
        details: { role },
        result: 'failure',
        reason: 'User not found',
      });
      return false;
    }

    // Check if actor has permission to assign roles
    if (!this.hasPermission(actor, Permission.ASSIGN_ROLE)) {
      this.logAudit({
        timestamp: new Date(),
        action: 'assign_role',
        actorId,
        targetId: targetUserId,
        details: { role },
        result: 'failure',
        reason: 'Insufficient permissions',
      });
      return false;
    }

    // Cannot assign a role higher than or equal to actor's highest role
    const actorLevel = this.getHighestRoleLevel(actor);
    const roleLevel = RBACPermissionManager.ROLE_HIERARCHY[role];

    if (roleLevel >= actorLevel) {
      this.logAudit({
        timestamp: new Date(),
        action: 'assign_role',
        actorId,
        targetId: targetUserId,
        details: { role },
        result: 'failure',
        reason: 'Cannot assign role at or above own level',
      });
      return false;
    }

    // Add role if not already present
    if (!targetUser.roles.includes(role)) {
      targetUser.roles.push(role);
      this.invalidateUserCache(targetUserId);

      this.logAudit({
        timestamp: new Date(),
        action: 'assign_role',
        actorId,
        targetId: targetUserId,
        details: { role },
        result: 'success',
      });

      return true;
    }

    return false;
  }

  /**
   * Revoke a role from a user
   */
  public revokeRole(actorId: string, targetUserId: string, role: Role): boolean {
    const actor = this.users.get(actorId);
    const targetUser = this.users.get(targetUserId);

    if (!actor || !targetUser) {
      this.logAudit({
        timestamp: new Date(),
        action: 'revoke_role',
        actorId,
        targetId: targetUserId,
        details: { role },
        result: 'failure',
        reason: 'User not found',
      });
      return false;
    }

    // Check if actor has permission to revoke roles
    if (!this.hasPermission(actor, Permission.REVOKE_ROLE)) {
      this.logAudit({
        timestamp: new Date(),
        action: 'revoke_role',
        actorId,
        targetId: targetUserId,
        details: { role },
        result: 'failure',
        reason: 'Insufficient permissions',
      });
      return false;
    }

    // Cannot revoke a role higher than or equal to actor's highest role
    const actorLevel = this.getHighestRoleLevel(actor);
    const roleLevel = RBACPermissionManager.ROLE_HIERARCHY[role];

    if (roleLevel >= actorLevel) {
      this.logAudit({
        timestamp: new Date(),
        action: 'revoke_role',
        actorId,
        targetId: targetUserId,
        details: { role },
        result: 'failure',
        reason: 'Cannot revoke role at or above own level',
      });
      return false;
    }

    // Remove role if present
    const roleIndex = targetUser.roles.indexOf(role);
    if (roleIndex !== -1) {
      targetUser.roles.splice(roleIndex, 1);

      // Ensure user always has at least USER role
      if (targetUser.roles.length === 0) {
        targetUser.roles.push(Role.USER);
      }

      this.invalidateUserCache(targetUserId);

      this.logAudit({
        timestamp: new Date(),
        action: 'revoke_role',
        actorId,
        targetId: targetUserId,
        details: { role },
        result: 'success',
      });

      return true;
    }

    return false;
  }

  /**
   * Grant custom permission to a user
   */
  public grantCustomPermission(actorId: string, targetUserId: string, permission: Permission): boolean {
    const actor = this.users.get(actorId);
    const targetUser = this.users.get(targetUserId);

    if (!actor || !targetUser) {
      return false;
    }

    if (!this.hasPermission(actor, Permission.MANAGE_PERMISSIONS)) {
      this.logAudit({
        timestamp: new Date(),
        action: 'grant_custom_permission',
        actorId,
        targetId: targetUserId,
        details: { permission },
        result: 'failure',
        reason: 'Insufficient permissions',
      });
      return false;
    }

    if (!targetUser.customPermissions) {
      targetUser.customPermissions = [];
    }

    if (!targetUser.customPermissions.includes(permission)) {
      targetUser.customPermissions.push(permission);
      this.invalidateUserCache(targetUserId);

      this.logAudit({
        timestamp: new Date(),
        action: 'grant_custom_permission',
        actorId,
        targetId: targetUserId,
        details: { permission },
        result: 'success',
      });

      return true;
    }

    return false;
  }

  /**
   * Revoke custom permission from a user
   */
  public revokeCustomPermission(actorId: string, targetUserId: string, permission: Permission): boolean {
    const actor = this.users.get(actorId);
    const targetUser = this.users.get(targetUserId);

    if (!actor || !targetUser || !targetUser.customPermissions) {
      return false;
    }

    if (!this.hasPermission(actor, Permission.MANAGE_PERMISSIONS)) {
      this.logAudit({
        timestamp: new Date(),
        action: 'revoke_custom_permission',
        actorId,
        targetId: targetUserId,
        details: { permission },
        result: 'failure',
        reason: 'Insufficient permissions',
      });
      return false;
    }

    const permIndex = targetUser.customPermissions.indexOf(permission);
    if (permIndex !== -1) {
      targetUser.customPermissions.splice(permIndex, 1);
      this.invalidateUserCache(targetUserId);

      this.logAudit({
        timestamp: new Date(),
        action: 'revoke_custom_permission',
        actorId,
        targetId: targetUserId,
        details: { permission },
        result: 'success',
      });

      return true;
    }

    return false;
  }

  /**
   * Grant resource-specific permission to a user
   */
  public grantResourcePermission(
    actorId: string,
    targetUserId: string,
    resourceId: string,
    permission: Permission
  ): boolean {
    const actor = this.users.get(actorId);
    const targetUser = this.users.get(targetUserId);
    const resource = this.resources.get(resourceId);

    if (!actor || !targetUser || !resource) {
      return false;
    }

    // Actor must be resource owner or have MANAGE_PERMISSIONS
    const isOwner = resource.ownerId === actorId;
    const hasManagePerms = this.hasPermission(actor, Permission.MANAGE_PERMISSIONS);

    if (!isOwner && !hasManagePerms) {
      this.logAudit({
        timestamp: new Date(),
        action: 'grant_resource_permission',
        actorId,
        targetId: targetUserId,
        details: { resourceId, permission },
        result: 'failure',
        reason: 'Insufficient permissions',
      });
      return false;
    }

    if (!targetUser.resourcePermissions) {
      targetUser.resourcePermissions = new Map();
    }

    const resourcePerms = targetUser.resourcePermissions.get(resourceId) || [];
    if (!resourcePerms.includes(permission)) {
      resourcePerms.push(permission);
      targetUser.resourcePermissions.set(resourceId, resourcePerms);
      this.invalidateResourceCache(targetUserId, resourceId);

      this.logAudit({
        timestamp: new Date(),
        action: 'grant_resource_permission',
        actorId,
        targetId: targetUserId,
        details: { resourceId, permission },
        result: 'success',
      });

      return true;
    }

    return false;
  }

  /**
   * Check if user has a specific permission
   */
  public hasPermission(user: User, permission: Permission, resource?: Resource): boolean {
    if (!user) {
      return false;
    }

    const resourceId = resource?.id;
    const cacheKey = this.getCacheKey(user.id, permission, resourceId);

    // Check cache first
    const cached = this.getFromCache(cacheKey);
    if (cached !== null) {
      return cached;
    }

    // Evaluate permission
    const granted = this.evaluatePermission(user, permission, resource);

    // Cache the result
    this.addToCache(cacheKey, user.id, permission, resourceId, granted);

    return granted;
  }

  /**
   * Evaluate permission without cache
   */
  private evaluatePermission(user: User, permission: Permission, resource?: Resource): boolean {
    // 1. Check dynamic rules first (highest priority)
    const dynamicResult = this.evaluateDynamicRules(user, permission, resource);
    if (dynamicResult !== null) {
      return dynamicResult;
    }

    // 2. Check resource-specific permissions
    if (resource && user.resourcePermissions) {
      const resourcePerms = user.resourcePermissions.get(resource.id);
      if (resourcePerms && resourcePerms.includes(permission)) {
        return true;
      }
    }

    // 3. Check custom permissions
    if (user.customPermissions && user.customPermissions.includes(permission)) {
      return true;
    }

    // 4. Check role-based permissions with inheritance
    return this.hasRolePermission(user, permission);
  }

  /**
   * Check if user has permission through role hierarchy
   */
  private hasRolePermission(user: User, permission: Permission): boolean {
    for (const role of user.roles) {
      // Get permissions for this role
      const rolePermissions = RBACPermissionManager.ROLE_PERMISSIONS[role];
      if (rolePermissions.includes(permission)) {
        return true;
      }

      // Check inherited permissions from lower roles
      const roleLevel = RBACPermissionManager.ROLE_HIERARCHY[role];
      for (const [inheritRole, inheritLevel] of Object.entries(RBACPermissionManager.ROLE_HIERARCHY)) {
        if (inheritLevel < roleLevel) {
          const inheritPermissions = RBACPermissionManager.ROLE_PERMISSIONS[inheritRole as Role];
          if (inheritPermissions.includes(permission)) {
            return true;
          }
        }
      }
    }

    return false;
  }

  /**
   * Evaluate dynamic permission rules
   */
  private evaluateDynamicRules(user: User, permission: Permission, resource?: Resource): boolean | null {
    // Sort rules by priority (descending)
    const sortedRules = [...this.dynamicRules].sort((a, b) => b.priority - a.priority);

    for (const rule of sortedRules) {
      try {
        const result = rule.evaluate(user, permission, resource);
        if (result) {
          return true;
        }
      } catch (error) {
        // Log error but continue with other rules
        console.error(`Error evaluating dynamic rule ${rule.name}:`, error);
      }
    }

    return null; // No dynamic rule granted permission
  }

  /**
   * Add a dynamic permission rule
   */
  public addDynamicRule(rule: DynamicPermissionRule): void {
    // Remove existing rule with same name
    this.dynamicRules = this.dynamicRules.filter(r => r.name !== rule.name);
    this.dynamicRules.push(rule);

    // Clear cache as rules have changed
    this.clearCache();
  }

  /**
   * Remove a dynamic permission rule
   */
  public removeDynamicRule(ruleName: string): boolean {
    const initialLength = this.dynamicRules.length;
    this.dynamicRules = this.dynamicRules.filter(r => r.name !== ruleName);

    if (this.dynamicRules.length < initialLength) {
      this.clearCache();
      return true;
    }

    return false;
  }

  /**
   * Check if user has a specific role
   */
  public hasRole(user: User, role: Role): boolean {
    return user.roles.includes(role);
  }

  /**
   * Get highest role level for a user
   */
  private getHighestRoleLevel(user: User): number {
    let maxLevel = 0;
    for (const role of user.roles) {
      const level = RBACPermissionManager.ROLE_HIERARCHY[role];
      if (level > maxLevel) {
        maxLevel = level;
      }
    }
    return maxLevel;
  }

  /**
   * Get all permissions for a user
   */
  public getUserPermissions(user: User): Permission[] {
    const permissions = new Set<Permission>();

    // Add role-based permissions
    for (const role of user.roles) {
      const rolePerms = RBACPermissionManager.ROLE_PERMISSIONS[role];
      rolePerms.forEach(p => permissions.add(p));

      // Add inherited permissions
      const roleLevel = RBACPermissionManager.ROLE_HIERARCHY[role];
      for (const [inheritRole, inheritLevel] of Object.entries(RBACPermissionManager.ROLE_HIERARCHY)) {
        if (inheritLevel < roleLevel) {
          const inheritPerms = RBACPermissionManager.ROLE_PERMISSIONS[inheritRole as Role];
          inheritPerms.forEach(p => permissions.add(p));
        }
      }
    }

    // Add custom permissions
    if (user.customPermissions) {
      user.customPermissions.forEach(p => permissions.add(p));
    }

    return Array.from(permissions);
  }

  /**
   * Cache management
   */
  private getCacheKey(userId: string, permission: Permission, resourceId?: string): string {
    return resourceId
      ? `${userId}:${permission}:${resourceId}`
      : `${userId}:${permission}`;
  }

  private getFromCache(cacheKey: string): boolean | null {
    const entry = this.permissionCache.get(cacheKey);
    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.permissionCache.delete(cacheKey);
      return null;
    }

    return entry.granted;
  }

  private addToCache(
    cacheKey: string,
    userId: string,
    permission: Permission,
    resourceId: string | undefined,
    granted: boolean
  ): void {
    const entry: PermissionCacheEntry = {
      userId,
      permission,
      resourceId,
      granted,
      expiresAt: Date.now() + this.cacheTTL,
    };

    this.permissionCache.set(cacheKey, entry);
  }

  private invalidateUserCache(userId: string): void {
    const keysToDelete: string[] = [];
    for (const [key, entry] of this.permissionCache.entries()) {
      if (entry.userId === userId) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach(key => this.permissionCache.delete(key));
  }

  private invalidateResourceCache(userId: string, resourceId: string): void {
    const keysToDelete: string[] = [];
    for (const [key, entry] of this.permissionCache.entries()) {
      if (entry.userId === userId && entry.resourceId === resourceId) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach(key => this.permissionCache.delete(key));
  }

  private clearCache(): void {
    this.permissionCache.clear();
  }

  /**
   * Clean up expired cache entries
   */
  public cleanupCache(): number {
    const now = Date.now();
    let removed = 0;

    for (const [key, entry] of this.permissionCache.entries()) {
      if (now > entry.expiresAt) {
        this.permissionCache.delete(key);
        removed++;
      }
    }

    return removed;
  }

  /**
   * Audit log management
   */
  private logAudit(entry: AuditEntry): void {
    this.auditLog.push(entry);
  }

  /**
   * Get audit log entries
   */
  public getAuditLog(filter?: {
    actorId?: string;
    targetId?: string;
    action?: string;
    startDate?: Date;
    endDate?: Date;
    result?: 'success' | 'failure';
  }): AuditEntry[] {
    let entries = [...this.auditLog];

    if (filter) {
      if (filter.actorId) {
        entries = entries.filter(e => e.actorId === filter.actorId);
      }
      if (filter.targetId) {
        entries = entries.filter(e => e.targetId === filter.targetId);
      }
      if (filter.action) {
        entries = entries.filter(e => e.action === filter.action);
      }
      if (filter.startDate) {
        entries = entries.filter(e => e.timestamp >= filter.startDate!);
      }
      if (filter.endDate) {
        entries = entries.filter(e => e.timestamp <= filter.endDate!);
      }
      if (filter.result) {
        entries = entries.filter(e => e.result === filter.result);
      }
    }

    return entries;
  }

  /**
   * Get user by ID
   */
  public getUser(userId: string): User | undefined {
    return this.users.get(userId);
  }

  /**
   * Get resource by ID
   */
  public getResource(resourceId: string): Resource | undefined {
    return this.resources.get(resourceId);
  }

  /**
   * Get cache statistics
   */
  public getCacheStats(): {
    size: number;
    expired: number;
    hitRate?: number;
  } {
    const now = Date.now();
    let expired = 0;

    for (const entry of this.permissionCache.values()) {
      if (now > entry.expiresAt) {
        expired++;
      }
    }

    return {
      size: this.permissionCache.size,
      expired,
    };
  }

  /**
   * Export system state for backup/restore
   */
  public exportState(): {
    users: Array<[string, User]>;
    resources: Array<[string, Resource]>;
    auditLog: AuditEntry[];
  } {
    return {
      users: Array.from(this.users.entries()),
      resources: Array.from(this.resources.entries()),
      auditLog: [...this.auditLog],
    };
  }

  /**
   * Import system state
   */
  public importState(state: {
    users: Array<[string, User]>;
    resources: Array<[string, Resource]>;
    auditLog: AuditEntry[];
  }): void {
    this.users = new Map(state.users);
    this.resources = new Map(state.resources);
    this.auditLog = [...state.auditLog];
    this.clearCache();
  }
}
