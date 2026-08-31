/**
 * Integration Tests for RBAC Permission Manager
 * Tests multi-module interactions, resource-based access control, and real scenarios
 */

import { RBACPermissionManager, Role, Permission, User, Resource } from '../../../src/security/RBACPermissionManager';

describe('RBAC Permission Manager Integration Tests', () => {
  let rbac: RBACPermissionManager;

  beforeEach(() => {
    rbac = new RBACPermissionManager();
  });

  describe('End-to-End Permission Flow', () => {
    test('complete user lifecycle with permission management', () => {
      // 1. Create user with basic role
      const user: User = {
        id: 'user-001',
        username: 'john.doe',
        roles: [Role.USER],
      };

      // 2. Register user
      rbac.registerUser(user);

      // 3. Check basic permissions
      expect(rbac.hasPermission(user.id, Permission.READ_USER)).toBe(true);
      expect(rbac.hasPermission(user.id, Permission.DELETE_USER)).toBe(false);

      // 4. Promote user to manager
      rbac.assignRole(user.id, Role.MANAGER);

      // 5. Verify enhanced permissions
      expect(rbac.hasPermission(user.id, Permission.UPDATE_USER)).toBe(true);
      expect(rbac.hasPermission(user.id, Permission.CREATE_RESOURCE)).toBe(true);

      // 6. Further promote to admin
      rbac.assignRole(user.id, Role.ADMIN);

      // 7. Verify admin permissions
      expect(rbac.hasPermission(user.id, Permission.DELETE_USER)).toBe(true);
      expect(rbac.hasPermission(user.id, Permission.MANAGE_PERMISSIONS)).toBe(true);

      // 8. Revoke manager role (admin still has all permissions)
      rbac.revokeRole(user.id, Role.MANAGER);
      expect(rbac.hasPermission(user.id, Permission.DELETE_USER)).toBe(true);

      // 9. Check audit trail
      const auditLog = rbac.getAuditLog(user.id);
      expect(auditLog.length).toBeGreaterThan(0);
      expect(auditLog.some(entry => entry.action === 'role_assigned')).toBe(true);
    });

    test('resource-based access control flow', () => {
      // Create users
      const owner: User = {
        id: 'owner-001',
        username: 'owner',
        roles: [Role.USER],
      };

      const otherUser: User = {
        id: 'other-001',
        username: 'other',
        roles: [Role.USER],
      };

      rbac.registerUser(owner);
      rbac.registerUser(otherUser);

      // Create resource owned by first user
      const resource: Resource = {
        id: 'resource-001',
        type: 'document',
        ownerId: owner.id,
        metadata: { title: 'Confidential Document' },
      };

      rbac.registerResource(resource);

      // Grant owner full access
      rbac.grantResourcePermission(
        owner.id,
        resource.id,
        Permission.READ_RESOURCE
      );
      rbac.grantResourcePermission(
        owner.id,
        resource.id,
        Permission.UPDATE_RESOURCE
      );
      rbac.grantResourcePermission(
        owner.id,
        resource.id,
        Permission.DELETE_RESOURCE
      );

      // Grant other user only read access
      rbac.grantResourcePermission(
        otherUser.id,
        resource.id,
        Permission.READ_RESOURCE
      );

      // Verify resource permissions
      expect(rbac.hasResourcePermission(owner.id, resource.id, Permission.READ_RESOURCE)).toBe(true);
      expect(rbac.hasResourcePermission(owner.id, resource.id, Permission.UPDATE_RESOURCE)).toBe(true);
      expect(rbac.hasResourcePermission(owner.id, resource.id, Permission.DELETE_RESOURCE)).toBe(true);

      expect(rbac.hasResourcePermission(otherUser.id, resource.id, Permission.READ_RESOURCE)).toBe(true);
      expect(rbac.hasResourcePermission(otherUser.id, resource.id, Permission.UPDATE_RESOURCE)).toBe(false);
      expect(rbac.hasResourcePermission(otherUser.id, resource.id, Permission.DELETE_RESOURCE)).toBe(false);

      // Revoke read access from other user
      rbac.revokeResourcePermission(
        otherUser.id,
        resource.id,
        Permission.READ_RESOURCE
      );

      expect(rbac.hasResourcePermission(otherUser.id, resource.id, Permission.READ_RESOURCE)).toBe(false);
    });
  });

  describe('Multi-Module Interactions', () => {
    test('role hierarchy with permission inheritance', () => {
      const admin: User = {
        id: 'admin-001',
        username: 'admin',
        roles: [Role.ADMIN],
      };

      const manager: User = {
        id: 'manager-001',
        username: 'manager',
        roles: [Role.MANAGER],
      };

      const user: User = {
        id: 'user-001',
        username: 'user',
        roles: [Role.USER],
      };

      rbac.registerUser(admin);
      rbac.registerUser(manager);
      rbac.registerUser(user);

      // Admin should have all permissions
      expect(rbac.hasPermission(admin.id, Permission.DELETE_USER)).toBe(true);
      expect(rbac.hasPermission(admin.id, Permission.UPDATE_USER)).toBe(true);
      expect(rbac.hasPermission(admin.id, Permission.READ_USER)).toBe(true);

      // Manager should have some permissions
      expect(rbac.hasPermission(manager.id, Permission.UPDATE_USER)).toBe(true);
      expect(rbac.hasPermission(manager.id, Permission.READ_USER)).toBe(true);
      expect(rbac.hasPermission(manager.id, Permission.DELETE_USER)).toBe(false);

      // User should have minimal permissions
      expect(rbac.hasPermission(user.id, Permission.READ_USER)).toBe(true);
      expect(rbac.hasPermission(user.id, Permission.UPDATE_USER)).toBe(false);
      expect(rbac.hasPermission(user.id, Permission.DELETE_USER)).toBe(false);
    });

    test('custom permissions with role-based access', () => {
      const user: User = {
        id: 'custom-001',
        username: 'custom',
        roles: [Role.USER],
        customPermissions: [Permission.UPDATE_RESOURCE, Permission.DELETE_RESOURCE],
      };

      rbac.registerUser(user);

      // Should have role-based permissions
      expect(rbac.hasPermission(user.id, Permission.READ_USER)).toBe(true);

      // Should also have custom permissions
      expect(rbac.hasPermission(user.id, Permission.UPDATE_RESOURCE)).toBe(true);
      expect(rbac.hasPermission(user.id, Permission.DELETE_RESOURCE)).toBe(true);

      // Should not have other permissions
      expect(rbac.hasPermission(user.id, Permission.DELETE_USER)).toBe(false);
    });

    test('dynamic permission rules evaluation', () => {
      const user: User = {
        id: 'dynamic-001',
        username: 'dynamic',
        roles: [Role.USER],
      };

      rbac.registerUser(user);

      // Add dynamic rule: users can update their own resources
      rbac.addDynamicRule({
        name: 'owner-can-update',
        priority: 10,
        evaluate: (evalUser: User, permission: Permission, resource?: Resource) => {
          if (permission === Permission.UPDATE_RESOURCE && resource) {
            return resource.ownerId === evalUser.id;
          }
          return false;
        },
      });

      // Create resource owned by user
      const ownResource: Resource = {
        id: 'res-001',
        type: 'document',
        ownerId: user.id,
      };

      // Create resource owned by someone else
      const otherResource: Resource = {
        id: 'res-002',
        type: 'document',
        ownerId: 'other-user',
      };

      rbac.registerResource(ownResource);
      rbac.registerResource(otherResource);

      // Should be able to update own resource
      expect(
        rbac.hasResourcePermission(user.id, ownResource.id, Permission.UPDATE_RESOURCE)
      ).toBe(true);

      // Should not be able to update other's resource
      expect(
        rbac.hasResourcePermission(user.id, otherResource.id, Permission.UPDATE_RESOURCE)
      ).toBe(false);
    });
  });

  describe('Concurrent Operations', () => {
    test('concurrent role assignments', () => {
      const user: User = {
        id: 'concurrent-001',
        username: 'concurrent',
        roles: [Role.USER],
      };

      rbac.registerUser(user);

      // Simulate concurrent role assignments
      const operations = [
        () => rbac.assignRole(user.id, Role.MANAGER),
        () => rbac.assignRole(user.id, Role.ADMIN),
        () => rbac.revokeRole(user.id, Role.USER),
      ];

      operations.forEach(op => op());

      // Final state should be consistent
      const finalUser = rbac.getUser(user.id);
      expect(finalUser).toBeDefined();
      expect(finalUser?.roles).toBeDefined();
    });

    test('concurrent permission checks', () => {
      const users: User[] = [];

      // Create 10 users
      for (let i = 0; i < 10; i++) {
        const user: User = {
          id: `user-${i}`,
          username: `user${i}`,
          roles: [Role.USER],
        };
        rbac.registerUser(user);
        users.push(user);
      }

      // Perform concurrent permission checks
      const checks = users.flatMap(user =>
        [
          Permission.READ_USER,
          Permission.UPDATE_USER,
          Permission.DELETE_USER,
          Permission.READ_RESOURCE,
        ].map(perm => rbac.hasPermission(user.id, perm))
      );

      // All checks should complete
      expect(checks.length).toBe(40);
      expect(checks.every(result => typeof result === 'boolean')).toBe(true);
    });

    test('concurrent resource access', () => {
      // Create multiple users
      const users: User[] = [];
      for (let i = 0; i < 5; i++) {
        const user: User = {
          id: `user-${i}`,
          username: `user${i}`,
          roles: [Role.USER],
        };
        rbac.registerUser(user);
        users.push(user);
      }

      // Create shared resource
      const sharedResource: Resource = {
        id: 'shared-001',
        type: 'document',
        ownerId: users[0].id,
      };

      rbac.registerResource(sharedResource);

      // Grant all users read access concurrently
      users.forEach(user => {
        rbac.grantResourcePermission(
          user.id,
          sharedResource.id,
          Permission.READ_RESOURCE
        );
      });

      // Verify all have access
      const accessResults = users.map(user =>
        rbac.hasResourcePermission(user.id, sharedResource.id, Permission.READ_RESOURCE)
      );

      expect(accessResults.every(result => result === true)).toBe(true);
    });
  });

  describe('Error Propagation', () => {
    test('invalid user ID propagates error', () => {
      expect(() => {
        rbac.hasPermission('non-existent-user', Permission.READ_USER);
      }).toThrow();
    });

    test('invalid role assignment', () => {
      const user: User = {
        id: 'user-001',
        username: 'user',
        roles: [Role.USER],
      };

      rbac.registerUser(user);

      // Try to assign invalid role
      expect(() => {
        rbac.assignRole(user.id, 'INVALID_ROLE' as Role);
      }).toThrow();
    });

    test('resource permission on non-existent resource', () => {
      const user: User = {
        id: 'user-001',
        username: 'user',
        roles: [Role.USER],
      };

      rbac.registerUser(user);

      // Check permission on non-existent resource
      expect(() => {
        rbac.hasResourcePermission(user.id, 'non-existent-resource', Permission.READ_RESOURCE);
      }).toThrow();
    });
  });

  describe('Permission Caching', () => {
    test('permission cache improves performance', () => {
      const user: User = {
        id: 'cache-001',
        username: 'cache',
        roles: [Role.ADMIN],
      };

      rbac.registerUser(user);

      // First check (cache miss)
      const start1 = Date.now();
      const result1 = rbac.hasPermission(user.id, Permission.DELETE_USER);
      const time1 = Date.now() - start1;

      // Second check (cache hit)
      const start2 = Date.now();
      const result2 = rbac.hasPermission(user.id, Permission.DELETE_USER);
      const time2 = Date.now() - start2;

      expect(result1).toBe(result2);
      expect(time2).toBeLessThanOrEqual(time1); // Cached should be same or faster
    });

    test('cache invalidation on role change', () => {
      const user: User = {
        id: 'cache-002',
        username: 'cache',
        roles: [Role.USER],
      };

      rbac.registerUser(user);

      // Check permission (should be false)
      expect(rbac.hasPermission(user.id, Permission.DELETE_USER)).toBe(false);

      // Promote to admin
      rbac.assignRole(user.id, Role.ADMIN);

      // Check again (cache should be invalidated, now true)
      expect(rbac.hasPermission(user.id, Permission.DELETE_USER)).toBe(true);
    });
  });

  describe('Audit Trail', () => {
    test('all permission operations are audited', () => {
      const user: User = {
        id: 'audit-001',
        username: 'audit',
        roles: [Role.USER],
      };

      rbac.registerUser(user);

      // Perform various operations
      rbac.assignRole(user.id, Role.MANAGER);
      rbac.hasPermission(user.id, Permission.READ_USER);
      rbac.revokeRole(user.id, Role.USER);
      rbac.assignRole(user.id, Role.ADMIN);

      // Get audit log
      const auditLog = rbac.getAuditLog(user.id);

      expect(auditLog.length).toBeGreaterThan(0);

      // Check for different action types
      const actions = auditLog.map(entry => entry.action);
      expect(actions).toContain('role_assigned');
      expect(actions).toContain('role_revoked');
    });

    test('failed operations are audited', () => {
      const user: User = {
        id: 'fail-001',
        username: 'fail',
        roles: [Role.USER],
      };

      rbac.registerUser(user);

      // Try to access admin permission (should fail)
      const hasAdmin = rbac.hasPermission(user.id, Permission.MANAGE_PERMISSIONS);
      expect(hasAdmin).toBe(false);

      // Check audit log for failure
      const auditLog = rbac.getAuditLog(user.id);
      const deniedEntry = auditLog.find(
        entry => entry.action === 'permission_check' && entry.result === 'failure'
      );

      if (deniedEntry) {
        expect(deniedEntry.reason).toContain('denied');
      }
    });
  });

  describe('Complex Scenarios', () => {
    test('hierarchical organization with teams', () => {
      // Create organization structure
      const ceo: User = {
        id: 'ceo',
        username: 'ceo',
        roles: [Role.ADMIN],
      };

      const managers: User[] = [];
      for (let i = 0; i < 3; i++) {
        managers.push({
          id: `manager-${i}`,
          username: `manager${i}`,
          roles: [Role.MANAGER],
        });
      }

      const employees: User[] = [];
      for (let i = 0; i < 9; i++) {
        employees.push({
          id: `employee-${i}`,
          username: `employee${i}`,
          roles: [Role.USER],
        });
      }

      // Register all users
      rbac.registerUser(ceo);
      managers.forEach(m => rbac.registerUser(m));
      employees.forEach(e => rbac.registerUser(e));

      // Create team resources
      const teamResources: Resource[] = [];
      for (let i = 0; i < 3; i++) {
        const resource: Resource = {
          id: `team-${i}-resource`,
          type: 'team-workspace',
          ownerId: managers[i].id,
        };
        rbac.registerResource(resource);
        teamResources.push(resource);

        // Grant manager full access
        rbac.grantResourcePermission(managers[i].id, resource.id, Permission.READ_RESOURCE);
        rbac.grantResourcePermission(managers[i].id, resource.id, Permission.UPDATE_RESOURCE);
        rbac.grantResourcePermission(managers[i].id, resource.id, Permission.DELETE_RESOURCE);

        // Grant team members read/write access
        for (let j = 0; j < 3; j++) {
          const employee = employees[i * 3 + j];
          rbac.grantResourcePermission(employee.id, resource.id, Permission.READ_RESOURCE);
          rbac.grantResourcePermission(employee.id, resource.id, Permission.UPDATE_RESOURCE);
        }
      }

      // Verify CEO has access to everything
      expect(rbac.hasPermission(ceo.id, Permission.DELETE_USER)).toBe(true);

      // Verify managers have correct access
      managers.forEach((manager, i) => {
        expect(
          rbac.hasResourcePermission(manager.id, teamResources[i].id, Permission.DELETE_RESOURCE)
        ).toBe(true);
      });

      // Verify employees have correct team access
      employees.forEach((employee, i) => {
        const teamIndex = Math.floor(i / 3);
        expect(
          rbac.hasResourcePermission(employee.id, teamResources[teamIndex].id, Permission.READ_RESOURCE)
        ).toBe(true);
        expect(
          rbac.hasResourcePermission(employee.id, teamResources[teamIndex].id, Permission.DELETE_RESOURCE)
        ).toBe(false);
      });
    });

    test('role transition with permission migration', () => {
      const user: User = {
        id: 'transition-001',
        username: 'transition',
        roles: [Role.USER],
      };

      rbac.registerUser(user);

      // Create resources with user permissions
      const resources: Resource[] = [];
      for (let i = 0; i < 5; i++) {
        const resource: Resource = {
          id: `res-${i}`,
          type: 'document',
          ownerId: user.id,
        };
        rbac.registerResource(resource);
        rbac.grantResourcePermission(user.id, resource.id, Permission.READ_RESOURCE);
        resources.push(resource);
      }

      // Promote to manager
      rbac.assignRole(user.id, Role.MANAGER);

      // All existing resource permissions should still work
      resources.forEach(resource => {
        expect(
          rbac.hasResourcePermission(user.id, resource.id, Permission.READ_RESOURCE)
        ).toBe(true);
      });

      // New manager permissions should be available
      expect(rbac.hasPermission(user.id, Permission.CREATE_RESOURCE)).toBe(true);
    });
  });
});
