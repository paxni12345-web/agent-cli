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
export declare enum Role {
    ADMIN = "admin",
    MANAGER = "manager",
    USER = "user"
}
export declare enum Permission {
    CREATE_USER = "user:create",
    READ_USER = "user:read",
    UPDATE_USER = "user:update",
    DELETE_USER = "user:delete",
    CREATE_RESOURCE = "resource:create",
    READ_RESOURCE = "resource:read",
    UPDATE_RESOURCE = "resource:update",
    DELETE_RESOURCE = "resource:delete",
    ASSIGN_ROLE = "role:assign",
    REVOKE_ROLE = "role:revoke",
    MANAGE_PERMISSIONS = "system:manage_permissions",
    VIEW_AUDIT_LOG = "system:view_audit_log",
    CONFIGURE_SYSTEM = "system:configure"
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
export declare class RBACPermissionManager {
    private static readonly ROLE_HIERARCHY;
    private static readonly ROLE_PERMISSIONS;
    private users;
    private resources;
    private permissionCache;
    private auditLog;
    private dynamicRules;
    private cacheTTL;
    constructor(cacheTTL?: number);
    /**
     * Initialize default dynamic permission rules
     */
    private initializeDefaultDynamicRules;
    /**
     * Register a user in the system
     */
    registerUser(user: User): void;
    /**
     * Register a resource in the system
     */
    registerResource(resource: Resource): void;
    /**
     * Assign a role to a user
     */
    assignRole(actorId: string, targetUserId: string, role: Role): boolean;
    /**
     * Revoke a role from a user
     */
    revokeRole(actorId: string, targetUserId: string, role: Role): boolean;
    /**
     * Grant custom permission to a user
     */
    grantCustomPermission(actorId: string, targetUserId: string, permission: Permission): boolean;
    /**
     * Revoke custom permission from a user
     */
    revokeCustomPermission(actorId: string, targetUserId: string, permission: Permission): boolean;
    /**
     * Grant resource-specific permission to a user
     */
    grantResourcePermission(actorId: string, targetUserId: string, resourceId: string, permission: Permission): boolean;
    /**
     * Check if user has a specific permission
     */
    hasPermission(user: User, permission: Permission, resource?: Resource): boolean;
    /**
     * Evaluate permission without cache
     */
    private evaluatePermission;
    /**
     * Check if user has permission through role hierarchy
     */
    private hasRolePermission;
    /**
     * Evaluate dynamic permission rules
     */
    private evaluateDynamicRules;
    /**
     * Add a dynamic permission rule
     */
    addDynamicRule(rule: DynamicPermissionRule): void;
    /**
     * Remove a dynamic permission rule
     */
    removeDynamicRule(ruleName: string): boolean;
    /**
     * Check if user has a specific role
     */
    hasRole(user: User, role: Role): boolean;
    /**
     * Get highest role level for a user
     */
    private getHighestRoleLevel;
    /**
     * Get all permissions for a user
     */
    getUserPermissions(user: User): Permission[];
    /**
     * Cache management
     */
    private getCacheKey;
    private getFromCache;
    private addToCache;
    private invalidateUserCache;
    private invalidateResourceCache;
    private clearCache;
    /**
     * Clean up expired cache entries
     */
    cleanupCache(): number;
    /**
     * Audit log management
     */
    private logAudit;
    /**
     * Get audit log entries
     */
    getAuditLog(filter?: {
        actorId?: string;
        targetId?: string;
        action?: string;
        startDate?: Date;
        endDate?: Date;
        result?: 'success' | 'failure';
    }): AuditEntry[];
    /**
     * Get user by ID
     */
    getUser(userId: string): User | undefined;
    /**
     * Get resource by ID
     */
    getResource(resourceId: string): Resource | undefined;
    /**
     * Get cache statistics
     */
    getCacheStats(): {
        size: number;
        expired: number;
        hitRate?: number;
    };
    /**
     * Export system state for backup/restore
     */
    exportState(): {
        users: Array<[string, User]>;
        resources: Array<[string, Resource]>;
        auditLog: AuditEntry[];
    };
    /**
     * Import system state
     */
    importState(state: {
        users: Array<[string, User]>;
        resources: Array<[string, Resource]>;
        auditLog: AuditEntry[];
    }): void;
}
//# sourceMappingURL=RBACPermissionManager.d.ts.map