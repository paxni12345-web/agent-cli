"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.RBACPermissionManager = exports.Permission = exports.Role = void 0;
var Role;
(function (Role) {
    Role["ADMIN"] = "admin";
    Role["MANAGER"] = "manager";
    Role["USER"] = "user";
})(Role || (exports.Role = Role = {}));
var Permission;
(function (Permission) {
    // User management
    Permission["CREATE_USER"] = "user:create";
    Permission["READ_USER"] = "user:read";
    Permission["UPDATE_USER"] = "user:update";
    Permission["DELETE_USER"] = "user:delete";
    // Resource management
    Permission["CREATE_RESOURCE"] = "resource:create";
    Permission["READ_RESOURCE"] = "resource:read";
    Permission["UPDATE_RESOURCE"] = "resource:update";
    Permission["DELETE_RESOURCE"] = "resource:delete";
    // Role management
    Permission["ASSIGN_ROLE"] = "role:assign";
    Permission["REVOKE_ROLE"] = "role:revoke";
    // System permissions
    Permission["MANAGE_PERMISSIONS"] = "system:manage_permissions";
    Permission["VIEW_AUDIT_LOG"] = "system:view_audit_log";
    Permission["CONFIGURE_SYSTEM"] = "system:configure";
})(Permission || (exports.Permission = Permission = {}));
class RBACPermissionManager {
    // Role hierarchy: higher value = more privileges
    static ROLE_HIERARCHY = {
        [Role.USER]: 1,
        [Role.MANAGER]: 2,
        [Role.ADMIN]: 3,
    };
    // Default permissions for each role
    static ROLE_PERMISSIONS = {
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
    users;
    resources;
    permissionCache;
    auditLog;
    dynamicRules;
    cacheTTL; // in milliseconds
    constructor(cacheTTL = 300000) {
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
    initializeDefaultDynamicRules() {
        // Resource owner always has full access
        this.addDynamicRule({
            name: 'resource_owner',
            priority: 100,
            evaluate: (user, permission, resource) => {
                if (!resource)
                    return false;
                return resource.ownerId === user.id;
            },
        });
        // Managers can manage resources owned by users with lower roles
        this.addDynamicRule({
            name: 'manager_subordinate_access',
            priority: 50,
            evaluate: (user, permission, resource) => {
                if (!resource || !this.hasRole(user, Role.MANAGER))
                    return false;
                const resourceOwner = this.users.get(resource.ownerId);
                if (!resourceOwner)
                    return false;
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
    registerUser(user) {
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
    registerResource(resource) {
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
    assignRole(actorId, targetUserId, role) {
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
    revokeRole(actorId, targetUserId, role) {
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
    grantCustomPermission(actorId, targetUserId, permission) {
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
    revokeCustomPermission(actorId, targetUserId, permission) {
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
    grantResourcePermission(actorId, targetUserId, resourceId, permission) {
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
    hasPermission(user, permission, resource) {
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
    evaluatePermission(user, permission, resource) {
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
    hasRolePermission(user, permission) {
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
                    const inheritPermissions = RBACPermissionManager.ROLE_PERMISSIONS[inheritRole];
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
    evaluateDynamicRules(user, permission, resource) {
        // Sort rules by priority (descending)
        const sortedRules = [...this.dynamicRules].sort((a, b) => b.priority - a.priority);
        for (const rule of sortedRules) {
            try {
                const result = rule.evaluate(user, permission, resource);
                if (result) {
                    return true;
                }
            }
            catch (error) {
                // Log error but continue with other rules
                console.error(`Error evaluating dynamic rule ${rule.name}:`, error);
            }
        }
        return null; // No dynamic rule granted permission
    }
    /**
     * Add a dynamic permission rule
     */
    addDynamicRule(rule) {
        // Remove existing rule with same name
        this.dynamicRules = this.dynamicRules.filter(r => r.name !== rule.name);
        this.dynamicRules.push(rule);
        // Clear cache as rules have changed
        this.clearCache();
    }
    /**
     * Remove a dynamic permission rule
     */
    removeDynamicRule(ruleName) {
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
    hasRole(user, role) {
        return user.roles.includes(role);
    }
    /**
     * Get highest role level for a user
     */
    getHighestRoleLevel(user) {
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
    getUserPermissions(user) {
        const permissions = new Set();
        // Add role-based permissions
        for (const role of user.roles) {
            const rolePerms = RBACPermissionManager.ROLE_PERMISSIONS[role];
            rolePerms.forEach(p => permissions.add(p));
            // Add inherited permissions
            const roleLevel = RBACPermissionManager.ROLE_HIERARCHY[role];
            for (const [inheritRole, inheritLevel] of Object.entries(RBACPermissionManager.ROLE_HIERARCHY)) {
                if (inheritLevel < roleLevel) {
                    const inheritPerms = RBACPermissionManager.ROLE_PERMISSIONS[inheritRole];
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
    getCacheKey(userId, permission, resourceId) {
        return resourceId
            ? `${userId}:${permission}:${resourceId}`
            : `${userId}:${permission}`;
    }
    getFromCache(cacheKey) {
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
    addToCache(cacheKey, userId, permission, resourceId, granted) {
        const entry = {
            userId,
            permission,
            resourceId,
            granted,
            expiresAt: Date.now() + this.cacheTTL,
        };
        this.permissionCache.set(cacheKey, entry);
    }
    invalidateUserCache(userId) {
        const keysToDelete = [];
        for (const [key, entry] of this.permissionCache.entries()) {
            if (entry.userId === userId) {
                keysToDelete.push(key);
            }
        }
        keysToDelete.forEach(key => this.permissionCache.delete(key));
    }
    invalidateResourceCache(userId, resourceId) {
        const keysToDelete = [];
        for (const [key, entry] of this.permissionCache.entries()) {
            if (entry.userId === userId && entry.resourceId === resourceId) {
                keysToDelete.push(key);
            }
        }
        keysToDelete.forEach(key => this.permissionCache.delete(key));
    }
    clearCache() {
        this.permissionCache.clear();
    }
    /**
     * Clean up expired cache entries
     */
    cleanupCache() {
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
    logAudit(entry) {
        this.auditLog.push(entry);
    }
    /**
     * Get audit log entries
     */
    getAuditLog(filter) {
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
                entries = entries.filter(e => e.timestamp >= filter.startDate);
            }
            if (filter.endDate) {
                entries = entries.filter(e => e.timestamp <= filter.endDate);
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
    getUser(userId) {
        return this.users.get(userId);
    }
    /**
     * Get resource by ID
     */
    getResource(resourceId) {
        return this.resources.get(resourceId);
    }
    /**
     * Get cache statistics
     */
    getCacheStats() {
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
    exportState() {
        return {
            users: Array.from(this.users.entries()),
            resources: Array.from(this.resources.entries()),
            auditLog: [...this.auditLog],
        };
    }
    /**
     * Import system state
     */
    importState(state) {
        this.users = new Map(state.users);
        this.resources = new Map(state.resources);
        this.auditLog = [...state.auditLog];
        this.clearCache();
    }
}
exports.RBACPermissionManager = RBACPermissionManager;
