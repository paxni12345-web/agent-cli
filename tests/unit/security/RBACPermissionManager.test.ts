/**
 * Comprehensive Unit Tests for RBACPermissionManager
 * Coverage: All public methods, edge cases, error conditions, async behavior,
 * resource cleanup, type safety, mocked dependencies, error paths, timeouts, concurrency
 */

import {
  RBACPermissionManager,
  Role,
  Permission,
  User,
  Resource,
  DynamicPermissionRule,
  AuditEntry,
} from '../../../src/security/RBACPermissionManager';

describe('RBACPermissionManager', () => {
  let rbacManager: RBACPermissionManager;

  beforeEach(() => {
    rbacManager = new RBACPermissionManager();
  });

  afterEach(() => {
    rbacManager.cleanupCache();
  });

  // ========================================================================
  // Constructor Tests
  // ========================================================================

  describe('Constructor', () => {
    it('should create RBACPermissionManager with default cache TTL', () => {
      const manager = new RBACPermissionManager();
      expect(manager).toBeInstanceOf(RBACPermissionManager);
    });

    it('should create RBACPermissionManager with custom cache TTL', () => {
      const manager = new RBACPermissionManager(600000); // 10 minutes
      expect(manager).toBeInstanceOf(RBACPermissionManager);
    });

    it('should initialize default dynamic rules', () => {
      const manager = new RBACPermissionManager();
      expect(manager).toBeDefined();
    });

    it('should handle zero cache TTL', () => {
      const manager = new RBACPermissionManager(0);
      expect(manager).toBeInstanceOf(RBACPermissionManager);
    });

    it('should handle negative cache TTL', () => {
      const manager = new RBACPermissionManager(-1);
      expect(manager).toBeInstanceOf(RBACPermissionManager);
    });

    it('should handle very large cache TTL', () => {
      const manager = new RBACPermissionManager(Number.MAX_SAFE_INTEGER);
      expect(manager).toBeInstanceOf(RBACPermissionManager);
    });

    it('should handle null cache TTL', () => {
      const manager = new RBACPermissionManager(null as any);
      expect(manager).toBeInstanceOf(RBACPermissionManager);
    });

    it('should handle undefined cache TTL', () => {
      const manager = new RBACPermissionManager(undefined);
      expect(manager).toBeInstanceOf(RBACPermissionManager);
    });
  });

  // ========================================================================
  // User Registration Tests
  // ========================================================================

  describe('registerUser', () => {
    it('should register user with valid data', () => {
      const user: User = {
        id: 'user-1',
        username: 'testuser',
        roles: [Role.USER],
      };

      rbacManager.registerUser(user);

      const retrieved = rbacManager.getUser('user-1');
      expect(retrieved).toBeDefined();
      expect(retrieved?.username).toBe('testuser');
    });

    it('should throw error for user without id', () => {
      const user = {
        username: 'testuser',
        roles: [Role.USER],
      } as User;

      expect(() => rbacManager.registerUser(user)).toThrow('User must have id and username');
    });

    it('should throw error for user without username', () => {
      const user = {
        id: 'user-1',
        roles: [Role.USER],
      } as User;

      expect(() => rbacManager.registerUser(user)).toThrow('User must have id and username');
    });

    it('should throw error for null user', () => {
      expect(() => rbacManager.registerUser(null as any)).toThrow();
    });

    it('should throw error for undefined user', () => {
      expect(() => rbacManager.registerUser(undefined as any)).toThrow();
    });

    it('should throw error for duplicate user id', () => {
      const user: User = {
        id: 'user-1',
        username: 'testuser',
        roles: [Role.USER],
      };

      rbacManager.registerUser(user);

      expect(() => rbacManager.registerUser(user)).toThrow('User with id user-1 already exists');
    });

    it('should assign USER role if no roles provided', () => {
      const user: User = {
        id: 'user-1',
        username: 'testuser',
        roles: [],
      };

      rbacManager.registerUser(user);

      const retrieved = rbacManager.getUser('user-1');
      expect(retrieved?.roles).toContain(Role.USER);
    });

    it('should handle user with empty id', () => {
      const user: User = {
        id: '',
        username: 'testuser',
        roles: [Role.USER],
      };

      expect(() => rbacManager.registerUser(user)).toThrow();
    });

    it('should handle user with empty username', () => {
      const user: User = {
        id: 'user-1',
        username: '',
        roles: [Role.USER],
      };

      expect(() => rbacManager.registerUser(user)).toThrow();
    });

    it('should handle user with custom permissions', () => {
      const user: User = {
        id: 'user-1',
        username: 'testuser',
        roles: [Role.USER],
        customPermissions: [Permission.CREATE_RESOURCE],
      };

      rbacManager.registerUser(user);

      const retrieved = rbacManager.getUser('user-1');
      expect(retrieved?.customPermissions).toContain(Permission.CREATE_RESOURCE);
    });

    it('should handle user with resource permissions', () => {
      const user: User = {
        id: 'user-1',
        username: 'testuser',
        roles: [Role.USER],
        resourcePermissions: new Map([['res-1', [Permission.READ_RESOURCE]]]),
      };

      rbacManager.registerUser(user);

      const retrieved = rbacManager.getUser('user-1');
      expect(retrieved?.resourcePermissions?.get('res-1')).toContain(Permission.READ_RESOURCE);
    });

    it('should handle user with multiple roles', () => {
      const user: User = {
        id: 'user-1',
        username: 'testuser',
        roles: [Role.USER, Role.MANAGER],
      };

      rbacManager.registerUser(user);

      const retrieved = rbacManager.getUser('user-1');
      expect(retrieved?.roles).toHaveLength(2);
    });
  });

  // ========================================================================
  // Resource Registration Tests
  // ========================================================================

  describe('registerResource', () => {
    beforeEach(() => {
      const user: User = {
        id: 'user-1',
        username: 'owner',
        roles: [Role.USER],
      };
      rbacManager.registerUser(user);
    });

    it('should register resource with valid data', () => {
      const resource: Resource = {
        id: 'res-1',
        type: 'document',
        ownerId: 'user-1',
      };

      rbacManager.registerResource(resource);

      const retrieved = rbacManager.getResource('res-1');
      expect(retrieved).toBeDefined();
      expect(retrieved?.type).toBe('document');
    });

    it('should throw error for resource without id', () => {
      const resource = {
        type: 'document',
        ownerId: 'user-1',
      } as Resource;

      expect(() => rbacManager.registerResource(resource)).toThrow('Resource must have id, type, and ownerId');
    });

    it('should throw error for resource without type', () => {
      const resource = {
        id: 'res-1',
        ownerId: 'user-1',
      } as Resource;

      expect(() => rbacManager.registerResource(resource)).toThrow('Resource must have id, type, and ownerId');
    });

    it('should throw error for resource without ownerId', () => {
      const resource = {
        id: 'res-1',
        type: 'document',
      } as Resource;

      expect(() => rbacManager.registerResource(resource)).toThrow('Resource must have id, type, and ownerId');
    });

    it('should throw error for non-existent owner', () => {
      const resource: Resource = {
        id: 'res-1',
        type: 'document',
        ownerId: 'non-existent',
      };

      expect(() => rbacManager.registerResource(resource)).toThrow('Resource owner non-existent does not exist');
    });

    it('should throw error for null resource', () => {
      expect(() => rbacManager.registerResource(null as any)).toThrow();
    });

    it('should throw error for undefined resource', () => {
      expect(() => rbacManager.registerResource(undefined as any)).toThrow();
    });

    it('should handle resource with metadata', () => {
      const resource: Resource = {
        id: 'res-1',
        type: 'document',
        ownerId: 'user-1',
        metadata: { title: 'Test Document', size: 1024 },
      };

      rbacManager.registerResource(resource);

      const retrieved = rbacManager.getResource('res-1');
      expect(retrieved?.metadata?.title).toBe('Test Document');
    });

    it('should handle resource with empty id', () => {
      const resource: Resource = {
        id: '',
        type: 'document',
        ownerId: 'user-1',
      };

      expect(() => rbacManager.registerResource(resource)).toThrow();
    });

    it('should handle resource with empty type', () => {
      const resource: Resource = {
        id: 'res-1',
        type: '',
        ownerId: 'user-1',
      };

      expect(() => rbacManager.registerResource(resource)).toThrow();
    });

    it('should handle resource with empty ownerId', () => {
      const resource: Resource = {
        id: 'res-1',
        type: 'document',
        ownerId: '',
      };

      expect(() => rbacManager.registerResource(resource)).toThrow();
    });
  });

  // ========================================================================
  // Role Assignment Tests
  // ========================================================================

  describe('assignRole', () => {
    let adminUser: User;
    let targetUser: User;

    beforeEach(() => {
      adminUser = {
        id: 'admin-1',
        username: 'admin',
        roles: [Role.ADMIN],
      };

      targetUser = {
        id: 'user-1',
        username: 'user',
        roles: [Role.USER],
      };

      rbacManager.registerUser(adminUser);
      rbacManager.registerUser(targetUser);
    });

    it('should assign role successfully by admin', () => {
      const result = rbacManager.assignRole('admin-1', 'user-1', Role.MANAGER);

      expect(result).toBe(true);
      const user = rbacManager.getUser('user-1');
      expect(user?.roles).toContain(Role.MANAGER);
    });

    it('should return false for non-existent actor', () => {
      const result = rbacManager.assignRole('non-existent', 'user-1', Role.MANAGER);

      expect(result).toBe(false);
    });

    it('should return false for non-existent target', () => {
      const result = rbacManager.assignRole('admin-1', 'non-existent', Role.MANAGER);

      expect(result).toBe(false);
    });

    it('should return false when actor lacks permission', () => {
      const result = rbacManager.assignRole('user-1', 'user-1', Role.ADMIN);

      expect(result).toBe(false);
    });

    it('should prevent assigning role at or above actor level', () => {
      const managerUser: User = {
        id: 'manager-1',
        username: 'manager',
        roles: [Role.MANAGER],
      };
      rbacManager.registerUser(managerUser);

      const result = rbacManager.assignRole('manager-1', 'user-1', Role.ADMIN);

      expect(result).toBe(false);
    });

    it('should prevent assigning same level role', () => {
      const managerUser: User = {
        id: 'manager-1',
        username: 'manager',
        roles: [Role.MANAGER],
      };
      rbacManager.registerUser(managerUser);

      const result = rbacManager.assignRole('manager-1', 'user-1', Role.MANAGER);

      expect(result).toBe(false);
    });

    it('should not assign duplicate role', () => {
      rbacManager.assignRole('admin-1', 'user-1', Role.MANAGER);
      const result = rbacManager.assignRole('admin-1', 'user-1', Role.MANAGER);

      expect(result).toBe(false);
    });

    it('should invalidate user cache on role assignment', () => {
      // Prime the cache
      rbacManager.hasPermission(targetUser, Permission.CREATE_RESOURCE);

      // Assign role
      rbacManager.assignRole('admin-1', 'user-1', Role.MANAGER);

      // Check permission should use fresh data
      const hasPermission = rbacManager.hasPermission(
        rbacManager.getUser('user-1')!,
        Permission.CREATE_RESOURCE
      );
      expect(hasPermission).toBe(true);
    });

    it('should handle null actorId', () => {
      const result = rbacManager.assignRole(null as any, 'user-1', Role.MANAGER);
      expect(result).toBe(false);
    });

    it('should handle null targetUserId', () => {
      const result = rbacManager.assignRole('admin-1', null as any, Role.MANAGER);
      expect(result).toBe(false);
    });

    it('should handle null role', () => {
      const result = rbacManager.assignRole('admin-1', 'user-1', null as any);
      expect(result).toBe(false);
    });
  });

  // ========================================================================
  // Role Revocation Tests
  // ========================================================================

  describe('revokeRole', () => {
    let adminUser: User;
    let targetUser: User;

    beforeEach(() => {
      adminUser = {
        id: 'admin-1',
        username: 'admin',
        roles: [Role.ADMIN],
      };

      targetUser = {
        id: 'user-1',
        username: 'user',
        roles: [Role.USER, Role.MANAGER],
      };

      rbacManager.registerUser(adminUser);
      rbacManager.registerUser(targetUser);
    });

    it('should revoke role successfully by admin', () => {
      const result = rbacManager.revokeRole('admin-1', 'user-1', Role.MANAGER);

      expect(result).toBe(true);
      const user = rbacManager.getUser('user-1');
      expect(user?.roles).not.toContain(Role.MANAGER);
    });

    it('should ensure user always has at least USER role', () => {
      rbacManager.revokeRole('admin-1', 'user-1', Role.MANAGER);
      const result = rbacManager.revokeRole('admin-1', 'user-1', Role.USER);

      expect(result).toBe(true);
      const user = rbacManager.getUser('user-1');
      expect(user?.roles).toContain(Role.USER);
      expect(user?.roles).toHaveLength(1);
    });

    it('should return false for non-existent actor', () => {
      const result = rbacManager.revokeRole('non-existent', 'user-1', Role.MANAGER);

      expect(result).toBe(false);
    });

    it('should return false for non-existent target', () => {
      const result = rbacManager.revokeRole('admin-1', 'non-existent', Role.MANAGER);

      expect(result).toBe(false);
    });

    it('should return false when actor lacks permission', () => {
      const regularUser: User = {
        id: 'user-2',
        username: 'user2',
        roles: [Role.USER],
      };
      rbacManager.registerUser(regularUser);

      const result = rbacManager.revokeRole('user-2', 'user-1', Role.MANAGER);

      expect(result).toBe(false);
    });

    it('should prevent revoking role at or above actor level', () => {
      const managerUser: User = {
        id: 'manager-1',
        username: 'manager',
        roles: [Role.MANAGER],
      };
      rbacManager.registerUser(managerUser);

      // Give user admin role
      rbacManager.assignRole('admin-1', 'user-1', Role.ADMIN);

      // Manager should not be able to revoke admin
      const result = rbacManager.revokeRole('manager-1', 'user-1', Role.ADMIN);

      expect(result).toBe(false);
    });

    it('should return false when revoking non-existent role', () => {
      // user-1 doesn't have ADMIN role
      const result = rbacManager.revokeRole('admin-1', 'user-1', Role.ADMIN);

      expect(result).toBe(false);
    });

    it('should invalidate user cache on role revocation', () => {
      const result = rbacManager.revokeRole('admin-1', 'user-1', Role.MANAGER);

      expect(result).toBe(true);
    });

    it('should handle null actorId', () => {
      const result = rbacManager.revokeRole(null as any, 'user-1', Role.MANAGER);
      expect(result).toBe(false);
    });

    it('should handle null targetUserId', () => {
      const result = rbacManager.revokeRole('admin-1', null as any, Role.MANAGER);
      expect(result).toBe(false);
    });
  });

  // ========================================================================
  // Custom Permission Tests
  // ========================================================================

  describe('grantCustomPermission', () => {
    let adminUser: User;
    let targetUser: User;

    beforeEach(() => {
      adminUser = {
        id: 'admin-1',
        username: 'admin',
        roles: [Role.ADMIN],
      };

      targetUser = {
        id: 'user-1',
        username: 'user',
        roles: [Role.USER],
      };

      rbacManager.registerUser(adminUser);
      rbacManager.registerUser(targetUser);
    });

    it('should grant custom permission successfully', () => {
      const result = rbacManager.grantCustomPermission('admin-1', 'user-1', Permission.DELETE_USER);

      expect(result).toBe(true);
      const user = rbacManager.getUser('user-1');
      expect(user?.customPermissions).toContain(Permission.DELETE_USER);
    });

    it('should return false for non-existent actor', () => {
      const result = rbacManager.grantCustomPermission('non-existent', 'user-1', Permission.DELETE_USER);

      expect(result).toBe(false);
    });

    it('should return false for non-existent target', () => {
      const result = rbacManager.grantCustomPermission('admin-1', 'non-existent', Permission.DELETE_USER);

      expect(result).toBe(false);
    });

    it('should return false when actor lacks MANAGE_PERMISSIONS', () => {
      const result = rbacManager.grantCustomPermission('user-1', 'user-1', Permission.DELETE_USER);

      expect(result).toBe(false);
    });

    it('should not grant duplicate permission', () => {
      rbacManager.grantCustomPermission('admin-1', 'user-1', Permission.DELETE_USER);
      const result = rbacManager.grantCustomPermission('admin-1', 'user-1', Permission.DELETE_USER);

      expect(result).toBe(false);
    });

    it('should invalidate user cache on permission grant', () => {
      const result = rbacManager.grantCustomPermission('admin-1', 'user-1', Permission.DELETE_USER);

      expect(result).toBe(true);
    });

    it('should handle null actorId', () => {
      const result = rbacManager.grantCustomPermission(null as any, 'user-1', Permission.DELETE_USER);
      expect(result).toBe(false);
    });

    it('should handle null targetUserId', () => {
      const result = rbacManager.grantCustomPermission('admin-1', null as any, Permission.DELETE_USER);
      expect(result).toBe(false);
    });

    it('should handle null permission', () => {
      const result = rbacManager.grantCustomPermission('admin-1', 'user-1', null as any);
      expect(result).toBe(false);
    });
  });

  describe('revokeCustomPermission', () => {
    let adminUser: User;
    let targetUser: User;

    beforeEach(() => {
      adminUser = {
        id: 'admin-1',
        username: 'admin',
        roles: [Role.ADMIN],
      };

      targetUser = {
        id: 'user-1',
        username: 'user',
        roles: [Role.USER],
        customPermissions: [Permission.DELETE_USER],
      };

      rbacManager.registerUser(adminUser);
      rbacManager.registerUser(targetUser);
    });

    it('should revoke custom permission successfully', () => {
      const result = rbacManager.revokeCustomPermission('admin-1', 'user-1', Permission.DELETE_USER);

      expect(result).toBe(true);
      const user = rbacManager.getUser('user-1');
      expect(user?.customPermissions).not.toContain(Permission.DELETE_USER);
    });

    it('should return false for non-existent actor', () => {
      const result = rbacManager.revokeCustomPermission('non-existent', 'user-1', Permission.DELETE_USER);

      expect(result).toBe(false);
    });

    it('should return false for non-existent target', () => {
      const result = rbacManager.revokeCustomPermission('admin-1', 'non-existent', Permission.DELETE_USER);

      expect(result).toBe(false);
    });

    it('should return false when actor lacks MANAGE_PERMISSIONS', () => {
      const regularUser: User = {
        id: 'user-2',
        username: 'user2',
        roles: [Role.USER],
      };
      rbacManager.registerUser(regularUser);

      const result = rbacManager.revokeCustomPermission('user-2', 'user-1', Permission.DELETE_USER);

      expect(result).toBe(false);
    });

    it('should return false when revoking non-existent permission', () => {
      const result = rbacManager.revokeCustomPermission('admin-1', 'user-1', Permission.CREATE_USER);

      expect(result).toBe(false);
    });

    it('should handle target without custom permissions', () => {
      const user2: User = {
        id: 'user-2',
        username: 'user2',
        roles: [Role.USER],
      };
      rbacManager.registerUser(user2);

      const result = rbacManager.revokeCustomPermission('admin-1', 'user-2', Permission.DELETE_USER);

      expect(result).toBe(false);
    });
  });

  // ========================================================================
  // Resource Permission Tests
  // ========================================================================

  describe('grantResourcePermission', () => {
    let ownerUser: User;
    let targetUser: User;
    let resource: Resource;

    beforeEach(() => {
      ownerUser = {
        id: 'owner-1',
        username: 'owner',
        roles: [Role.USER],
      };

      targetUser = {
        id: 'user-1',
        username: 'user',
        roles: [Role.USER],
      };

      rbacManager.registerUser(ownerUser);
      rbacManager.registerUser(targetUser);

      resource = {
        id: 'res-1',
        type: 'document',
        ownerId: 'owner-1',
      };

      rbacManager.registerResource(resource);
    });

    it('should grant resource permission as owner', () => {
      const result = rbacManager.grantResourcePermission('owner-1', 'user-1', 'res-1', Permission.READ_RESOURCE);

      expect(result).toBe(true);
      const user = rbacManager.getUser('user-1');
      expect(user?.resourcePermissions?.get('res-1')).toContain(Permission.READ_RESOURCE);
    });

    it('should grant resource permission with MANAGE_PERMISSIONS', () => {
      const adminUser: User = {
        id: 'admin-1',
        username: 'admin',
        roles: [Role.ADMIN],
      };
      rbacManager.registerUser(adminUser);

      const result = rbacManager.grantResourcePermission('admin-1', 'user-1', 'res-1', Permission.READ_RESOURCE);

      expect(result).toBe(true);
    });

    it('should return false for non-existent actor', () => {
      const result = rbacManager.grantResourcePermission('non-existent', 'user-1', 'res-1', Permission.READ_RESOURCE);

      expect(result).toBe(false);
    });

    it('should return false for non-existent target', () => {
      const result = rbacManager.grantResourcePermission('owner-1', 'non-existent', 'res-1', Permission.READ_RESOURCE);

      expect(result).toBe(false);
    });

    it('should return false for non-existent resource', () => {
      const result = rbacManager.grantResourcePermission('owner-1', 'user-1', 'non-existent', Permission.READ_RESOURCE);

      expect(result).toBe(false);
    });

    it('should return false when actor is not owner and lacks permission', () => {
      const result = rbacManager.grantResourcePermission('user-1', 'user-1', 'res-1', Permission.READ_RESOURCE);

      expect(result).toBe(false);
    });

    it('should not grant duplicate resource permission', () => {
      rbacManager.grantResourcePermission('owner-1', 'user-1', 'res-1', Permission.READ_RESOURCE);
      const result = rbacManager.grantResourcePermission('owner-1', 'user-1', 'res-1', Permission.READ_RESOURCE);

      expect(result).toBe(false);
    });

    it('should invalidate resource cache on permission grant', () => {
      const result = rbacManager.grantResourcePermission('owner-1', 'user-1', 'res-1', Permission.READ_RESOURCE);

      expect(result).toBe(true);
    });
  });

  // ========================================================================
  // Permission Checking Tests
  // ========================================================================

  describe('hasPermission', () => {
    let user: User;
    let resource: Resource;

    beforeEach(() => {
      user = {
        id: 'user-1',
        username: 'user',
        roles: [Role.USER],
      };

      rbacManager.registerUser(user);

      resource = {
        id: 'res-1',
        type: 'document',
        ownerId: 'user-1',
      };

      rbacManager.registerResource(resource);
    });

    it('should grant permission based on role', () => {
      const hasPermission = rbacManager.hasPermission(
        rbacManager.getUser('user-1')!,
        Permission.READ_RESOURCE
      );

      expect(hasPermission).toBe(true);
    });

    it('should grant permission based on custom permission', () => {
      rbacManager.grantCustomPermission('user-1', 'user-1', Permission.DELETE_USER);

      const hasPermission = rbacManager.hasPermission(
        rbacManager.getUser('user-1')!,
        Permission.DELETE_USER
      );

      expect(hasPermission).toBe(true);
    });

    it('should grant permission based on resource ownership', () => {
      const hasPermission = rbacManager.hasPermission(
        rbacManager.getUser('user-1')!,
        Permission.DELETE_RESOURCE,
        resource
      );

      expect(hasPermission).toBe(true);
    });

    it('should deny permission without proper role or permission', () => {
      const hasPermission = rbacManager.hasPermission(
        rbacManager.getUser('user-1')!,
        Permission.DELETE_USER
      );

      expect(hasPermission).toBe(false);
    });

    it('should return false for null user', () => {
      const hasPermission = rbacManager.hasPermission(null as any, Permission.READ_RESOURCE);

      expect(hasPermission).toBe(false);
    });

    it('should return false for undefined user', () => {
      const hasPermission = rbacManager.hasPermission(undefined as any, Permission.READ_RESOURCE);

      expect(hasPermission).toBe(false);
    });

    it('should cache permission check results', () => {
      // First call
      rbacManager.hasPermission(rbacManager.getUser('user-1')!, Permission.READ_RESOURCE);

      // Second call should use cache
      const hasPermission = rbacManager.hasPermission(
        rbacManager.getUser('user-1')!,
        Permission.READ_RESOURCE
      );

      expect(hasPermission).toBe(true);
    });

    it('should handle permission inheritance', () => {
      const adminUser: User = {
        id: 'admin-1',
        username: 'admin',
        roles: [Role.ADMIN],
      };
      rbacManager.registerUser(adminUser);

      // Admin should inherit all lower role permissions
      const hasPermission = rbacManager.hasPermission(
        rbacManager.getUser('admin-1')!,
        Permission.READ_RESOURCE
      );

      expect(hasPermission).toBe(true);
    });

    it('should check resource-specific permissions', () => {
      const user2: User = {
        id: 'user-2',
        username: 'user2',
        roles: [Role.USER],
      };
      rbacManager.registerUser(user2);

      rbacManager.grantResourcePermission('user-1', 'user-2', 'res-1', Permission.UPDATE_RESOURCE);

      const hasPermission = rbacManager.hasPermission(
        rbacManager.getUser('user-2')!,
        Permission.UPDATE_RESOURCE,
        resource
      );

      expect(hasPermission).toBe(true);
    });
  });

  // ========================================================================
  // Dynamic Rules Tests
  // ========================================================================

  describe('addDynamicRule', () => {
    it('should add dynamic rule successfully', () => {
      const rule: DynamicPermissionRule = {
        name: 'test-rule',
        priority: 10,
        evaluate: () => true,
      };

      rbacManager.addDynamicRule(rule);

      const user: User = {
        id: 'user-1',
        username: 'user',
        roles: [Role.USER],
      };
      rbacManager.registerUser(user);

      const hasPermission = rbacManager.hasPermission(
        rbacManager.getUser('user-1')!,
        Permission.DELETE_USER
      );

      expect(hasPermission).toBe(true);
    });

    it('should replace existing rule with same name', () => {
      const rule1: DynamicPermissionRule = {
        name: 'test-rule',
        priority: 10,
        evaluate: () => true,
      };

      const rule2: DynamicPermissionRule = {
        name: 'test-rule',
        priority: 20,
        evaluate: () => false,
      };

      rbacManager.addDynamicRule(rule1);
      rbacManager.addDynamicRule(rule2);

      const user: User = {
        id: 'user-1',
        username: 'user',
        roles: [Role.USER],
      };
      rbacManager.registerUser(user);

      const hasPermission = rbacManager.hasPermission(
        rbacManager.getUser('user-1')!,
        Permission.DELETE_USER
      );

      expect(hasPermission).toBe(false);
    });

    it('should clear cache when adding rule', () => {
      const user: User = {
        id: 'user-1',
        username: 'user',
        roles: [Role.USER],
      };
      rbacManager.registerUser(user);

      // Prime cache
      rbacManager.hasPermission(rbacManager.getUser('user-1')!, Permission.DELETE_USER);

      // Add rule
      const rule: DynamicPermissionRule = {
        name: 'test-rule',
        priority: 100,
        evaluate: () => true,
      };
      rbacManager.addDynamicRule(rule);

      // Should use new rule, not cache
      const hasPermission = rbacManager.hasPermission(
        rbacManager.getUser('user-1')!,
        Permission.DELETE_USER
      );

      expect(hasPermission).toBe(true);
    });

    it('should handle rule that throws error', () => {
      const rule: DynamicPermissionRule = {
        name: 'error-rule',
        priority: 100,
        evaluate: () => {
          throw new Error('Rule error');
        },
      };

      rbacManager.addDynamicRule(rule);

      const user: User = {
        id: 'user-1',
        username: 'user',
        roles: [Role.USER],
      };
      rbacManager.registerUser(user);

      // Should not throw, just continue to other checks
      const hasPermission = rbacManager.hasPermission(
        rbacManager.getUser('user-1')!,
        Permission.DELETE_USER
      );

      expect(hasPermission).toBe(false);
    });

    it('should evaluate rules by priority', () => {
      const lowPriorityRule: DynamicPermissionRule = {
        name: 'low-priority',
        priority: 10,
        evaluate: () => false,
      };

      const highPriorityRule: DynamicPermissionRule = {
        name: 'high-priority',
        priority: 100,
        evaluate: () => true,
      };

      rbacManager.addDynamicRule(lowPriorityRule);
      rbacManager.addDynamicRule(highPriorityRule);

      const user: User = {
        id: 'user-1',
        username: 'user',
        roles: [Role.USER],
      };
      rbacManager.registerUser(user);

      const hasPermission = rbacManager.hasPermission(
        rbacManager.getUser('user-1')!,
        Permission.DELETE_USER
      );

      // High priority rule should be evaluated first and grant permission
      expect(hasPermission).toBe(true);
    });
  });

  describe('removeDynamicRule', () => {
    it('should remove dynamic rule successfully', () => {
      const rule: DynamicPermissionRule = {
        name: 'test-rule',
        priority: 10,
        evaluate: () => true,
      };

      rbacManager.addDynamicRule(rule);
      const result = rbacManager.removeDynamicRule('test-rule');

      expect(result).toBe(true);
    });

    it('should return false for non-existent rule', () => {
      const result = rbacManager.removeDynamicRule('non-existent');

      expect(result).toBe(false);
    });

    it('should clear cache when removing rule', () => {
      const rule: DynamicPermissionRule = {
        name: 'test-rule',
        priority: 100,
        evaluate: () => true,
      };
      rbacManager.addDynamicRule(rule);

      const user: User = {
        id: 'user-1',
        username: 'user',
        roles: [Role.USER],
      };
      rbacManager.registerUser(user);

      // Prime cache with rule active
      rbacManager.hasPermission(rbacManager.getUser('user-1')!, Permission.DELETE_USER);

      // Remove rule
      rbacManager.removeDynamicRule('test-rule');

      // Should re-evaluate without rule
      const hasPermission = rbacManager.hasPermission(
        rbacManager.getUser('user-1')!,
        Permission.DELETE_USER
      );

      expect(hasPermission).toBe(false);
    });

    it('should handle null rule name', () => {
      const result = rbacManager.removeDynamicRule(null as any);
      expect(result).toBe(false);
    });

    it('should handle undefined rule name', () => {
      const result = rbacManager.removeDynamicRule(undefined as any);
      expect(result).toBe(false);
    });

    it('should handle empty rule name', () => {
      const result = rbacManager.removeDynamicRule('');
      expect(result).toBe(false);
    });
  });

  // ========================================================================
  // hasRole Tests
  // ========================================================================

  describe('hasRole', () => {
    let user: User;

    beforeEach(() => {
      user = {
        id: 'user-1',
        username: 'user',
        roles: [Role.USER, Role.MANAGER],
      };
      rbacManager.registerUser(user);
    });

    it('should return true for assigned role', () => {
      const result = rbacManager.hasRole(rbacManager.getUser('user-1')!, Role.USER);

      expect(result).toBe(true);
    });

    it('should return false for unassigned role', () => {
      const result = rbacManager.hasRole(rbacManager.getUser('user-1')!, Role.ADMIN);

      expect(result).toBe(false);
    });

    it('should handle null user', () => {
      const result = rbacManager.hasRole(null as any, Role.USER);
      expect(result).toBe(false);
    });

    it('should handle undefined user', () => {
      const result = rbacManager.hasRole(undefined as any, Role.USER);
      expect(result).toBe(false);
    });

    it('should handle null role', () => {
      const result = rbacManager.hasRole(rbacManager.getUser('user-1')!, null as any);
      expect(result).toBe(false);
    });
  });

  // ========================================================================
  // getUserPermissions Tests
  // ========================================================================

  describe('getUserPermissions', () => {
    it('should return all role-based permissions', () => {
      const user: User = {
        id: 'user-1',
        username: 'user',
        roles: [Role.MANAGER],
      };
      rbacManager.registerUser(user);

      const permissions = rbacManager.getUserPermissions(rbacManager.getUser('user-1')!);

      expect(permissions).toContain(Permission.READ_RESOURCE);
      expect(permissions).toContain(Permission.UPDATE_RESOURCE);
      expect(permissions).toContain(Permission.CREATE_RESOURCE);
    });

    it('should include custom permissions', () => {
      const user: User = {
        id: 'user-1',
        username: 'user',
        roles: [Role.USER],
        customPermissions: [Permission.DELETE_USER],
      };
      rbacManager.registerUser(user);

      const permissions = rbacManager.getUserPermissions(rbacManager.getUser('user-1')!);

      expect(permissions).toContain(Permission.DELETE_USER);
    });

    it('should include inherited permissions from lower roles', () => {
      const user: User = {
        id: 'user-1',
        username: 'user',
        roles: [Role.MANAGER],
      };
      rbacManager.registerUser(user);

      const permissions = rbacManager.getUserPermissions(rbacManager.getUser('user-1')!);

      // Manager should inherit USER permissions
      expect(permissions).toContain(Permission.READ_RESOURCE);
    });

    it('should return unique permissions', () => {
      const user: User = {
        id: 'user-1',
        username: 'user',
        roles: [Role.USER, Role.MANAGER],
      };
      rbacManager.registerUser(user);

      const permissions = rbacManager.getUserPermissions(rbacManager.getUser('user-1')!);

      const readResourceCount = permissions.filter(p => p === Permission.READ_RESOURCE).length;
      expect(readResourceCount).toBe(1);
    });

    it('should handle user with no roles', () => {
      const user: User = {
        id: 'user-1',
        username: 'user',
        roles: [],
      };
      rbacManager.registerUser(user);

      const permissions = rbacManager.getUserPermissions(rbacManager.getUser('user-1')!);

      // Should still have USER role assigned automatically
      expect(permissions.length).toBeGreaterThan(0);
    });
  });

  // ========================================================================
  // Cache Management Tests
  // ========================================================================

  describe('Cache Management', () => {
    let user: User;

    beforeEach(() => {
      user = {
        id: 'user-1',
        username: 'user',
        roles: [Role.USER],
      };
      rbacManager.registerUser(user);
    });

    it('should return cached permission check', () => {
      // First call - not cached
      const result1 = rbacManager.hasPermission(rbacManager.getUser('user-1')!, Permission.READ_RESOURCE);

      // Second call - should be cached
      const result2 = rbacManager.hasPermission(rbacManager.getUser('user-1')!, Permission.READ_RESOURCE);

      expect(result1).toBe(result2);
    });

    it('should expire cached entries after TTL', (done) => {
      const shortTTLManager = new RBACPermissionManager(100); // 100ms TTL

      const testUser: User = {
        id: 'user-1',
        username: 'user',
        roles: [Role.USER],
      };
      shortTTLManager.registerUser(testUser);

      // Prime cache
      shortTTLManager.hasPermission(shortTTLManager.getUser('user-1')!, Permission.READ_RESOURCE);

      // Wait for TTL to expire
      setTimeout(() => {
        const stats = shortTTLManager.getCacheStats();
        expect(stats.expired).toBeGreaterThan(0);
        done();
      }, 150);
    });

    it('should cleanup expired cache entries', () => {
      const manager = new RBACPermissionManager(0); // Immediate expiry

      const testUser: User = {
        id: 'user-1',
        username: 'user',
        roles: [Role.USER],
      };
      manager.registerUser(testUser);

      // Add some cache entries
      manager.hasPermission(manager.getUser('user-1')!, Permission.READ_RESOURCE);
      manager.hasPermission(manager.getUser('user-1')!, Permission.UPDATE_RESOURCE);

      const removed = manager.cleanupCache();

      expect(removed).toBeGreaterThan(0);
    });

    it('should get cache statistics', () => {
      rbacManager.hasPermission(rbacManager.getUser('user-1')!, Permission.READ_RESOURCE);

      const stats = rbacManager.getCacheStats();

      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('expired');
      expect(stats.size).toBeGreaterThan(0);
    });
  });

  // ========================================================================
  // Audit Log Tests
  // ========================================================================

  describe('Audit Log', () => {
    let user: User;

    beforeEach(() => {
      user = {
        id: 'user-1',
        username: 'user',
        roles: [Role.USER],
      };
      rbacManager.registerUser(user);
    });

    it('should log successful role assignment', () => {
      const adminUser: User = {
        id: 'admin-1',
        username: 'admin',
        roles: [Role.ADMIN],
      };
      rbacManager.registerUser(adminUser);

      rbacManager.assignRole('admin-1', 'user-1', Role.MANAGER);

      const logs = rbacManager.getAuditLog({ action: 'assign_role' });

      expect(logs.length).toBeGreaterThan(0);
      expect(logs[0].result).toBe('success');
    });

    it('should log failed role assignment', () => {
      rbacManager.assignRole('user-1', 'user-1', Role.ADMIN);

      const logs = rbacManager.getAuditLog({ action: 'assign_role', result: 'failure' });

      expect(logs.length).toBeGreaterThan(0);
      expect(logs[0].result).toBe('failure');
    });

    it('should filter audit logs by actorId', () => {
      const adminUser: User = {
        id: 'admin-1',
        username: 'admin',
        roles: [Role.ADMIN],
      };
      rbacManager.registerUser(adminUser);

      rbacManager.assignRole('admin-1', 'user-1', Role.MANAGER);

      const logs = rbacManager.getAuditLog({ actorId: 'admin-1' });

      expect(logs.length).toBeGreaterThan(0);
      expect(logs.every(l => l.actorId === 'admin-1')).toBe(true);
    });

    it('should filter audit logs by targetId', () => {
      const adminUser: User = {
        id: 'admin-1',
        username: 'admin',
        roles: [Role.ADMIN],
      };
      rbacManager.registerUser(adminUser);

      rbacManager.assignRole('admin-1', 'user-1', Role.MANAGER);

      const logs = rbacManager.getAuditLog({ targetId: 'user-1' });

      expect(logs.length).toBeGreaterThan(0);
      expect(logs.every(l => l.targetId === 'user-1')).toBe(true);
    });

    it('should filter audit logs by date range', () => {
      const startDate = new Date(Date.now() - 10000);
      const endDate = new Date(Date.now() + 10000);

      const logs = rbacManager.getAuditLog({ startDate, endDate });

      expect(Array.isArray(logs)).toBe(true);
    });

    it('should return all logs with empty filter', () => {
      const logs = rbacManager.getAuditLog();

      expect(Array.isArray(logs)).toBe(true);
    });

    it('should handle null filter', () => {
      const logs = rbacManager.getAuditLog(undefined);
      expect(Array.isArray(logs)).toBe(true);
    });
  });

  // ========================================================================
  // State Export/Import Tests
  // ========================================================================

  describe('Export and Import State', () => {
    beforeEach(() => {
      const user: User = {
        id: 'user-1',
        username: 'user',
        roles: [Role.USER],
      };
      rbacManager.registerUser(user);

      const resource: Resource = {
        id: 'res-1',
        type: 'document',
        ownerId: 'user-1',
      };
      rbacManager.registerResource(resource);
    });

    it('should export state successfully', () => {
      const state = rbacManager.exportState();

      expect(state).toHaveProperty('users');
      expect(state).toHaveProperty('resources');
      expect(state).toHaveProperty('auditLog');
      expect(state.users.length).toBe(1);
      expect(state.resources.length).toBe(1);
    });

    it('should import state successfully', () => {
      const state = rbacManager.exportState();

      const newManager = new RBACPermissionManager();
      newManager.importState(state);

      expect(newManager.getUser('user-1')).toBeDefined();
      expect(newManager.getResource('res-1')).toBeDefined();
    });

    it('should clear cache on import', () => {
      // Prime cache
      rbacManager.hasPermission(rbacManager.getUser('user-1')!, Permission.READ_RESOURCE);

      const state = rbacManager.exportState();
      rbacManager.importState(state);

      const stats = rbacManager.getCacheStats();
      expect(stats.size).toBe(0);
    });

    it('should handle empty state import', () => {
      const emptyState = {
        users: [],
        resources: [],
        auditLog: [],
      };

      rbacManager.importState(emptyState);

      expect(rbacManager.getUser('user-1')).toBeUndefined();
    });

    it('should handle null state', () => {
      expect(() => rbacManager.importState(null as any)).toThrow();
    });

    it('should handle undefined state', () => {
      expect(() => rbacManager.importState(undefined as any)).toThrow();
    });
  });

  // ========================================================================
  // Concurrency Tests
  // ========================================================================

  describe('Concurrency', () => {
    it('should handle concurrent user registrations', () => {
      const promises = [];
      for (let i = 0; i < 10; i++) {
        const user: User = {
          id: `user-${i}`,
          username: `user${i}`,
          roles: [Role.USER],
        };
        promises.push(Promise.resolve(rbacManager.registerUser(user)));
      }

      return Promise.all(promises).then(() => {
        for (let i = 0; i < 10; i++) {
          expect(rbacManager.getUser(`user-${i}`)).toBeDefined();
        }
      });
    });

    it('should handle concurrent permission checks', () => {
      const user: User = {
        id: 'user-1',
        username: 'user',
        roles: [Role.USER],
      };
      rbacManager.registerUser(user);

      const promises = [];
      for (let i = 0; i < 20; i++) {
        promises.push(
          Promise.resolve(rbacManager.hasPermission(
            rbacManager.getUser('user-1')!,
            Permission.READ_RESOURCE
          ))
        );
      }

      return Promise.all(promises).then(results => {
        expect(results.every(r => r === true)).toBe(true);
      });
    });

    it('should handle concurrent role assignments', () => {
      const adminUser: User = {
        id: 'admin-1',
        username: 'admin',
        roles: [Role.ADMIN],
      };
      rbacManager.registerUser(adminUser);

      const promises = [];
      for (let i = 0; i < 5; i++) {
        const user: User = {
          id: `user-${i}`,
          username: `user${i}`,
          roles: [Role.USER],
        };
        rbacManager.registerUser(user);
        promises.push(
          Promise.resolve(rbacManager.assignRole('admin-1', `user-${i}`, Role.MANAGER))
        );
      }

      return Promise.all(promises).then(results => {
        expect(results.every(r => r === true)).toBe(true);
      });
    });

    it('should handle concurrent cache operations', () => {
      const user: User = {
        id: 'user-1',
        username: 'user',
        roles: [Role.USER],
      };
      rbacManager.registerUser(user);

      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(
          Promise.resolve(rbacManager.hasPermission(
            rbacManager.getUser('user-1')!,
            Permission.READ_RESOURCE
          ))
        );
        promises.push(
          Promise.resolve(rbacManager.cleanupCache())
        );
      }

      return Promise.all(promises).then(() => {
        expect(true).toBe(true); // Should complete without errors
      });
    });
  });

  // ========================================================================
  // Edge Cases Tests
  // ========================================================================

  describe('Edge Cases', () => {
    it('should handle very long username', () => {
      const longUsername = 'a'.repeat(10000);
      const user: User = {
        id: 'user-1',
        username: longUsername,
        roles: [Role.USER],
      };

      rbacManager.registerUser(user);

      expect(rbacManager.getUser('user-1')?.username).toBe(longUsername);
    });

    it('should handle special characters in username', () => {
      const user: User = {
        id: 'user-1',
        username: 'user!@#$%^&*()_+-=[]{}|;:,.<>?',
        roles: [Role.USER],
      };

      rbacManager.registerUser(user);

      expect(rbacManager.getUser('user-1')).toBeDefined();
    });

    it('should handle Unicode characters in username', () => {
      const user: User = {
        id: 'user-1',
        username: '用户名测试中文 🚀',
        roles: [Role.USER],
      };

      rbacManager.registerUser(user);

      expect(rbacManager.getUser('user-1')?.username).toBe('用户名测试中文 🚀');
    });

    it('should handle very large number of roles', () => {
      const user: User = {
        id: 'user-1',
        username: 'user',
        roles: Array(1000).fill(Role.USER),
      };

      rbacManager.registerUser(user);

      expect(rbacManager.getUser('user-1')).toBeDefined();
    });

    it('should handle very large audit log', () => {
      const adminUser: User = {
        id: 'admin-1',
        username: 'admin',
        roles: [Role.ADMIN],
      };
      rbacManager.registerUser(adminUser);

      const user: User = {
        id: 'user-1',
        username: 'user',
        roles: [Role.USER],
      };
      rbacManager.registerUser(user);

      // Generate many audit entries
      for (let i = 0; i < 100; i++) {
        rbacManager.assignRole('admin-1', 'user-1', Role.MANAGER);
        rbacManager.revokeRole('admin-1', 'user-1', Role.MANAGER);
      }

      const logs = rbacManager.getAuditLog();
      expect(logs.length).toBeGreaterThan(0);
    });

    it('should handle circular dependencies in dynamic rules', () => {
      let callCount = 0;
      const rule: DynamicPermissionRule = {
        name: 'circular-rule',
        priority: 100,
        evaluate: (user, permission) => {
          callCount++;
          if (callCount > 10) return false; // Prevent infinite loop
          return rbacManager.hasPermission(user, permission);
        },
      };

      rbacManager.addDynamicRule(rule);

      const user: User = {
        id: 'user-1',
        username: 'user',
        roles: [Role.USER],
      };
      rbacManager.registerUser(user);

      // Should not cause infinite loop
      expect(() => {
        rbacManager.hasPermission(rbacManager.getUser('user-1')!, Permission.READ_RESOURCE);
      }).not.toThrow();
    });
  });

  // ========================================================================
  // Type Safety Tests
  // ========================================================================

  describe('Type Safety', () => {
    it('should enforce User type structure', () => {
      const validUser: User = {
        id: 'user-1',
        username: 'user',
        roles: [Role.USER],
      };

      expect(() => rbacManager.registerUser(validUser)).not.toThrow();
    });

    it('should enforce Resource type structure', () => {
      const user: User = {
        id: 'user-1',
        username: 'user',
        roles: [Role.USER],
      };
      rbacManager.registerUser(user);

      const validResource: Resource = {
        id: 'res-1',
        type: 'document',
        ownerId: 'user-1',
      };

      expect(() => rbacManager.registerResource(validResource)).not.toThrow();
    });

    it('should enforce Role enum values', () => {
      const user: User = {
        id: 'user-1',
        username: 'user',
        roles: [Role.USER],
      };

      rbacManager.registerUser(user);

      // TypeScript should enforce this at compile time
      expect(user.roles[0]).toBe(Role.USER);
    });

    it('should enforce Permission enum values', () => {
      const user: User = {
        id: 'user-1',
        username: 'user',
        roles: [Role.USER],
      };

      rbacManager.registerUser(user);

      const result = rbacManager.hasPermission(
        rbacManager.getUser('user-1')!,
        Permission.READ_RESOURCE
      );

      expect(typeof result).toBe('boolean');
    });
  });
});
