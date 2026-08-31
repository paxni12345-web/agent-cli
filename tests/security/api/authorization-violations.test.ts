/**
 * Security Tests: Authorization Violations
 * Tests for authorization bypass, privilege escalation, and access control vulnerabilities
 */

import {
  APIGateway,
  APIRequest,
  HTTPMethod,
} from '../../../src/api/APIGateway';
import {
  AuthenticationSystem,
  RBACSystem,
  AuditLogger,
  User,
  Role,
  Permission,
} from '../../../src/security/MEGA_SecurityAuthentication';

describe('Security Tests: Authorization Violations', () => {
  let gateway: APIGateway;
  let authSystem: AuthenticationSystem;
  let rbacSystem: RBACSystem;
  let auditLogger: AuditLogger;
  let adminUser: User;
  let regularUser: User;
  let adminToken: string;
  let userToken: string;

  beforeEach(async () => {
    authSystem = new AuthenticationSystem();
    rbacSystem = new RBACSystem();
    auditLogger = new AuditLogger();
    gateway = new APIGateway(authSystem, rbacSystem, auditLogger);

    // Create admin user
    adminUser = await authSystem.register('admin', 'Admin@123', 'admin@example.com');
    adminUser.roles = ['admin', 'user'];
    const adminSession = await authSystem.login('admin', 'Admin@123');
    adminToken = adminSession.token;

    // Create regular user
    regularUser = await authSystem.register('user', 'User@123', 'user@example.com');
    regularUser.roles = ['user'];
    const userSession = await authSystem.login('user', 'User@123');
    userToken = userSession.token;

    // Setup roles and permissions
    const adminRole = new Role('admin', 'Administrator', [
      new Permission('users', 'create'),
      new Permission('users', 'read'),
      new Permission('users', 'update'),
      new Permission('users', 'delete'),
      new Permission('admin', 'access'),
    ]);

    const userRole = new Role('user', 'Regular User', [
      new Permission('users', 'read'),
      new Permission('profile', 'update'),
    ]);

    rbacSystem.addRole(adminRole);
    rbacSystem.addRole(userRole);
    rbacSystem.assignRole(adminUser.id, 'admin');
    rbacSystem.assignRole(regularUser.id, 'user');
  });

  describe('Horizontal Privilege Escalation', () => {
    it('should not allow user to access another users data', async () => {
      gateway.registerEndpoint({
        path: '/api/users/:userId/profile',
        method: HTTPMethod.GET,
        handler: async (req, ctx) => {
          // Check if accessing own profile
          if (req.params.userId !== ctx.userId) {
            return {
              statusCode: 403,
              headers: {},
              body: { error: 'Cannot access other users profiles' },
            };
          }
          return {
            statusCode: 200,
            headers: {},
            body: { userId: req.params.userId, data: 'private' },
          };
        },
        middleware: [],
        authentication: {
          type: 'bearer',
          required: true,
        },
        tags: ['users'],
      });

      // Try to access admin's profile with regular user token
      const request: APIRequest = {
        method: HTTPMethod.GET,
        path: `/api/users/${adminUser.id}/profile`,
        headers: { authorization: `Bearer ${userToken}` },
        query: {},
        params: { userId: adminUser.id },
        body: null,
        ip: '192.168.1.1',
      };

      const response = await gateway.handleRequest(request);
      expect(response.statusCode).toBe(403);
    });

    it('should prevent IDOR (Insecure Direct Object Reference)', async () => {
      gateway.registerEndpoint({
        path: '/api/documents/:docId',
        method: HTTPMethod.GET,
        handler: async (req, ctx) => {
          // Simulate document ownership check
          const docOwnerId = req.params.docId.startsWith('admin') ? adminUser.id : regularUser.id;

          if (docOwnerId !== ctx.userId) {
            return {
              statusCode: 403,
              headers: {},
              body: { error: 'Access denied' },
            };
          }

          return {
            statusCode: 200,
            headers: {},
            body: { document: 'content' },
          };
        },
        middleware: [],
        authentication: {
          type: 'bearer',
          required: true,
        },
        tags: ['documents'],
      });

      const request: APIRequest = {
        method: HTTPMethod.GET,
        path: '/api/documents/admin-doc-123',
        headers: { authorization: `Bearer ${userToken}` },
        query: {},
        params: { docId: 'admin-doc-123' },
        body: null,
        ip: '192.168.1.1',
      };

      const response = await gateway.handleRequest(request);
      expect(response.statusCode).toBe(403);
    });

    it('should validate resource ownership on updates', async () => {
      gateway.registerEndpoint({
        path: '/api/posts/:postId',
        method: HTTPMethod.PUT,
        handler: async (req, ctx) => {
          const postOwnerId = req.params.postId.includes('admin') ? adminUser.id : regularUser.id;

          if (postOwnerId !== ctx.userId) {
            return {
              statusCode: 403,
              headers: {},
              body: { error: 'Cannot modify other users posts' },
            };
          }

          return {
            statusCode: 200,
            headers: {},
            body: { success: true },
          };
        },
        middleware: [],
        authentication: {
          type: 'bearer',
          required: true,
        },
        tags: ['posts'],
      });

      const request: APIRequest = {
        method: HTTPMethod.PUT,
        path: '/api/posts/admin-post-1',
        headers: { authorization: `Bearer ${userToken}` },
        query: {},
        params: { postId: 'admin-post-1' },
        body: { title: 'Modified' },
        ip: '192.168.1.1',
      };

      const response = await gateway.handleRequest(request);
      expect(response.statusCode).toBe(403);
    });
  });

  describe('Vertical Privilege Escalation', () => {
    it('should block regular users from admin endpoints', async () => {
      gateway.registerEndpoint({
        path: '/api/admin/users',
        method: HTTPMethod.GET,
        handler: async (req) => ({
          statusCode: 200,
          headers: {},
          body: { users: [] },
        }),
        middleware: [],
        authentication: {
          type: 'bearer',
          required: true,
        },
        authorization: {
          roles: ['admin'],
        },
        tags: ['admin'],
      });

      const request: APIRequest = {
        method: HTTPMethod.GET,
        path: '/api/admin/users',
        headers: { authorization: `Bearer ${userToken}` },
        query: {},
        params: {},
        body: null,
        ip: '192.168.1.1',
      };

      const response = await gateway.handleRequest(request);
      expect(response.statusCode).toBe(403);
      expect(response.body.error.message).toContain('permission');
    });

    it('should enforce permission-based access control', async () => {
      gateway.registerEndpoint({
        path: '/api/users/:userId',
        method: HTTPMethod.DELETE,
        handler: async (req) => ({
          statusCode: 204,
          headers: {},
          body: null,
        }),
        middleware: [],
        authentication: {
          type: 'bearer',
          required: true,
        },
        authorization: {
          permissions: ['users:delete'],
        },
        tags: ['users'],
      });

      const request: APIRequest = {
        method: HTTPMethod.DELETE,
        path: `/api/users/${regularUser.id}`,
        headers: { authorization: `Bearer ${userToken}` },
        query: {},
        params: { userId: regularUser.id },
        body: null,
        ip: '192.168.1.1',
      };

      const response = await gateway.handleRequest(request);
      expect(response.statusCode).toBe(403);
    });

    it('should prevent role escalation via request manipulation', async () => {
      gateway.registerEndpoint({
        path: '/api/users/:userId/role',
        method: HTTPMethod.PUT,
        handler: async (req, ctx) => {
          // Only admins can change roles
          const user = (req as any).user as User;
          if (!user.roles.includes('admin')) {
            return {
              statusCode: 403,
              headers: {},
              body: { error: 'Insufficient privileges' },
            };
          }

          return {
            statusCode: 200,
            headers: {},
            body: { success: true },
          };
        },
        middleware: [],
        authentication: {
          type: 'bearer',
          required: true,
        },
        tags: ['users'],
      });

      // Regular user tries to make themselves admin
      const request: APIRequest = {
        method: HTTPMethod.PUT,
        path: `/api/users/${regularUser.id}/role`,
        headers: { authorization: `Bearer ${userToken}` },
        query: {},
        params: { userId: regularUser.id },
        body: { role: 'admin' },
        ip: '192.168.1.1',
      };

      const response = await gateway.handleRequest(request);
      expect(response.statusCode).toBe(403);
    });
  });

  describe('Missing Authorization Checks', () => {
    it('should reject requests without authorization when required', async () => {
      gateway.registerEndpoint({
        path: '/api/sensitive',
        method: HTTPMethod.GET,
        handler: async (req) => ({
          statusCode: 200,
          headers: {},
          body: { data: 'sensitive' },
        }),
        middleware: [],
        authentication: {
          type: 'bearer',
          required: true,
        },
        authorization: {
          roles: ['admin'],
        },
        tags: ['sensitive'],
      });

      const request: APIRequest = {
        method: HTTPMethod.GET,
        path: '/api/sensitive',
        headers: { authorization: `Bearer ${userToken}` },
        query: {},
        params: {},
        body: null,
        ip: '192.168.1.1',
      };

      const response = await gateway.handleRequest(request);
      expect(response.statusCode).toBe(403);
    });

    it('should apply authorization to all HTTP methods', async () => {
      const methods = [HTTPMethod.GET, HTTPMethod.POST, HTTPMethod.PUT, HTTPMethod.DELETE, HTTPMethod.PATCH];

      for (const method of methods) {
        gateway.registerEndpoint({
          path: `/api/admin/${method.toLowerCase()}`,
          method,
          handler: async (req) => ({
            statusCode: 200,
            headers: {},
            body: { success: true },
          }),
          middleware: [],
          authentication: {
            type: 'bearer',
            required: true,
          },
          authorization: {
            roles: ['admin'],
          },
          tags: ['admin'],
        });

        const request: APIRequest = {
          method,
          path: `/api/admin/${method.toLowerCase()}`,
          headers: { authorization: `Bearer ${userToken}` },
          query: {},
          params: {},
          body: {},
          ip: '192.168.1.1',
        };

        const response = await gateway.handleRequest(request);
        expect(response.statusCode).toBe(403);
      }
    });
  });

  describe('Path Traversal in Authorization', () => {
    it('should not allow path manipulation to bypass authorization', async () => {
      gateway.registerEndpoint({
        path: '/api/files/:path',
        method: HTTPMethod.GET,
        handler: async (req, ctx) => {
          // Simulate file ownership check
          if (!req.params.path.startsWith(ctx.userId || '')) {
            return {
              statusCode: 403,
              headers: {},
              body: { error: 'Access denied' },
            };
          }

          return {
            statusCode: 200,
            headers: {},
            body: { content: 'file data' },
          };
        },
        middleware: [],
        authentication: {
          type: 'bearer',
          required: true,
        },
        tags: ['files'],
      });

      const maliciousPaths = [
        `../admin/${adminUser.id}/secret.txt`,
        `${regularUser.id}/../${adminUser.id}/file.txt`,
        `${regularUser.id}/../../admin/data`,
      ];

      for (const path of maliciousPaths) {
        const request: APIRequest = {
          method: HTTPMethod.GET,
          path: `/api/files/${path}`,
          headers: { authorization: `Bearer ${userToken}` },
          query: {},
          params: { path },
          body: null,
          ip: '192.168.1.1',
        };

        const response = await gateway.handleRequest(request);
        expect(response.statusCode).toBe(403);
      }
    });
  });

  describe('Mass Assignment Vulnerabilities', () => {
    it('should not allow updating restricted fields', async () => {
      gateway.registerEndpoint({
        path: '/api/users/:userId',
        method: HTTPMethod.PUT,
        handler: async (req, ctx) => {
          // Prevent updating sensitive fields
          const restrictedFields = ['role', 'isAdmin', 'permissions', 'status'];
          const hasRestrictedField = restrictedFields.some(field => req.body[field] !== undefined);

          if (hasRestrictedField && ctx.userId !== adminUser.id) {
            return {
              statusCode: 403,
              headers: {},
              body: { error: 'Cannot update restricted fields' },
            };
          }

          return {
            statusCode: 200,
            headers: {},
            body: { success: true },
          };
        },
        middleware: [],
        authentication: {
          type: 'bearer',
          required: true,
        },
        tags: ['users'],
      });

      const request: APIRequest = {
        method: HTTPMethod.PUT,
        path: `/api/users/${regularUser.id}`,
        headers: { authorization: `Bearer ${userToken}` },
        query: {},
        params: { userId: regularUser.id },
        body: {
          name: 'New Name',
          isAdmin: true, // Attempting to escalate privileges
          role: 'admin',
        },
        ip: '192.168.1.1',
      };

      const response = await gateway.handleRequest(request);
      expect(response.statusCode).toBe(403);
    });
  });

  describe('Context-Based Authorization', () => {
    it('should enforce IP-based access restrictions', async () => {
      gateway.registerEndpoint({
        path: '/api/admin/console',
        method: HTTPMethod.GET,
        handler: async (req) => ({
          statusCode: 200,
          headers: {},
          body: { data: 'console' },
        }),
        middleware: [],
        authentication: {
          type: 'bearer',
          required: true,
        },
        authorization: {
          custom: async (req, ctx) => {
            // Only allow admin console from specific IPs
            const allowedIPs = ['10.0.0.1', '10.0.0.2'];
            return allowedIPs.includes(req.ip);
          },
        },
        tags: ['admin'],
      });

      const request: APIRequest = {
        method: HTTPMethod.GET,
        path: '/api/admin/console',
        headers: { authorization: `Bearer ${adminToken}` },
        query: {},
        params: {},
        body: null,
        ip: '192.168.1.100', // Not in allowed list
      };

      const response = await gateway.handleRequest(request);
      expect(response.statusCode).toBe(403);
    });

    it('should enforce time-based access restrictions', async () => {
      gateway.registerEndpoint({
        path: '/api/maintenance',
        method: HTTPMethod.POST,
        handler: async (req) => ({
          statusCode: 200,
          headers: {},
          body: { success: true },
        }),
        middleware: [],
        authentication: {
          type: 'bearer',
          required: true,
        },
        authorization: {
          custom: async (req, ctx) => {
            // Only allow maintenance during off-hours (example: 2am-4am)
            const hour = new Date().getHours();
            return hour >= 2 && hour < 4;
          },
        },
        tags: ['maintenance'],
      });

      const request: APIRequest = {
        method: HTTPMethod.POST,
        path: '/api/maintenance',
        headers: { authorization: `Bearer ${adminToken}` },
        query: {},
        params: {},
        body: { action: 'restart' },
        ip: '192.168.1.1',
      };

      const response = await gateway.handleRequest(request);
      // Will fail unless run between 2-4am
      const hour = new Date().getHours();
      const expectedStatus = (hour >= 2 && hour < 4) ? 200 : 403;
      expect(response.statusCode).toBe(expectedStatus);
    });
  });

  describe('Batch Operations Authorization', () => {
    it('should validate authorization for each batch item', async () => {
      gateway.registerEndpoint({
        path: '/api/batch/delete',
        method: HTTPMethod.POST,
        handler: async (req, ctx) => {
          const ids = req.body.ids || [];
          const unauthorized = ids.filter((id: string) => !id.startsWith(ctx.userId || ''));

          if (unauthorized.length > 0) {
            return {
              statusCode: 403,
              headers: {},
              body: { error: 'Cannot delete other users resources' },
            };
          }

          return {
            statusCode: 200,
            headers: {},
            body: { deleted: ids.length },
          };
        },
        middleware: [],
        authentication: {
          type: 'bearer',
          required: true,
        },
        tags: ['batch'],
      });

      // Try to delete mix of own and others' resources
      const request: APIRequest = {
        method: HTTPMethod.POST,
        path: '/api/batch/delete',
        headers: { authorization: `Bearer ${userToken}` },
        query: {},
        params: {},
        body: {
          ids: [
            `${regularUser.id}-item-1`,
            `${regularUser.id}-item-2`,
            `${adminUser.id}-item-1`, // Unauthorized
          ],
        },
        ip: '192.168.1.1',
      };

      const response = await gateway.handleRequest(request);
      expect(response.statusCode).toBe(403);
    });
  });

  describe('Audit Logging for Authorization', () => {
    it('should log authorization failures', async () => {
      gateway.registerEndpoint({
        path: '/api/admin/logs',
        method: HTTPMethod.GET,
        handler: async (req) => ({
          statusCode: 200,
          headers: {},
          body: { logs: [] },
        }),
        middleware: [],
        authentication: {
          type: 'bearer',
          required: true,
        },
        authorization: {
          roles: ['admin'],
        },
        tags: ['admin'],
      });

      const request: APIRequest = {
        method: HTTPMethod.GET,
        path: '/api/admin/logs',
        headers: { authorization: `Bearer ${userToken}` },
        query: {},
        params: {},
        body: null,
        ip: '192.168.1.1',
        userAgent: 'TestAgent/1.0',
      };

      await gateway.handleRequest(request);

      const logs = auditLogger.getLogs({
        action: 'access',
        userId: regularUser.id,
      });
      const deniedAccess = logs.find(log => log.result === 'denied');

      expect(deniedAccess).toBeDefined();
      expect(deniedAccess?.resource).toContain('/api/admin/logs');
    });

    it('should log successful authorization with context', async () => {
      gateway.registerEndpoint({
        path: '/api/admin/dashboard',
        method: HTTPMethod.GET,
        handler: async (req) => ({
          statusCode: 200,
          headers: {},
          body: { data: 'dashboard' },
        }),
        middleware: [],
        authentication: {
          type: 'bearer',
          required: true,
        },
        authorization: {
          roles: ['admin'],
        },
        tags: ['admin'],
      });

      const request: APIRequest = {
        method: HTTPMethod.GET,
        path: '/api/admin/dashboard',
        headers: { authorization: `Bearer ${adminToken}` },
        query: {},
        params: {},
        body: null,
        ip: '192.168.1.1',
      };

      await gateway.handleRequest(request);

      const logs = auditLogger.getLogs({
        action: 'access',
        userId: adminUser.id,
      });
      const successAccess = logs.find(log =>
        log.result === 'success' &&
        log.resource === '/api/admin/dashboard'
      );

      expect(successAccess).toBeDefined();
    });
  });

  describe('GraphQL Authorization', () => {
    it('should enforce field-level authorization', async () => {
      gateway.registerEndpoint({
        path: '/api/graphql',
        method: HTTPMethod.POST,
        handler: async (req, ctx) => {
          const query = req.body.query || '';

          // Check if query includes sensitive fields
          const sensitiveFields = ['ssn', 'creditCard', 'password'];
          const hasSensitiveField = sensitiveFields.some(field => query.includes(field));

          if (hasSensitiveField) {
            const user = (req as any).user as User;
            if (!user.roles.includes('admin')) {
              return {
                statusCode: 403,
                headers: {},
                body: { error: 'Cannot query sensitive fields' },
              };
            }
          }

          return {
            statusCode: 200,
            headers: {},
            body: { data: {} },
          };
        },
        middleware: [],
        authentication: {
          type: 'bearer',
          required: true,
        },
        tags: ['graphql'],
      });

      const request: APIRequest = {
        method: HTTPMethod.POST,
        path: '/api/graphql',
        headers: { authorization: `Bearer ${userToken}` },
        query: {},
        params: {},
        body: {
          query: '{ user { name email ssn } }',
        },
        ip: '192.168.1.1',
      };

      const response = await gateway.handleRequest(request);
      expect(response.statusCode).toBe(403);
    });
  });
});
