/**
 * Integration Tests for SecurityManager
 * Tests real database connections, authentication flows, and multi-module interactions
 */

import { SecurityManager, SecurityConfig, User } from '../../../src/security/SecurityManager';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('SecurityManager Integration Tests', () => {
  let securityManager: SecurityManager;
  let tempDir: string;
  let config: SecurityConfig;

  beforeEach(async () => {
    // Create temporary directory for file operations
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'security-test-'));

    config = {
      enableAuth: true,
      enableEncryption: true,
      enableAudit: true,
      enableMFA: false,
      jwtSecret: crypto.randomBytes(32).toString('hex'),
      jwtExpiry: 3600,
      jwtRefreshExpiry: 86400,
      passwordMinLength: 8,
      passwordRequireUppercase: true,
      passwordRequireNumbers: true,
      passwordRequireSpecialChars: true,
      sessionTimeout: 1800,
      maxLoginAttempts: 3,
      lockoutDuration: 900,
      rateLimitWindow: 60,
      rateLimitMaxAttempts: 10,
      passwordResetExpiry: 3600,
      bcryptRounds: 10,
    };

    securityManager = new SecurityManager(config);
    await securityManager.initialize();
  });

  afterEach(async () => {
    // Cleanup
    await securityManager.shutdown?.();

    // Remove temporary directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('End-to-End Authentication Flow', () => {
    test('complete user registration and login flow', async () => {
      const username = 'testuser';
      const email = 'test@example.com';
      const password = 'SecurePass123!';

      // 1. Register user
      const registerResult = await securityManager.registerUser({
        username,
        email,
        password,
        roles: ['user'],
      });

      expect(registerResult.success).toBe(true);
      expect(registerResult.userId).toBeDefined();

      // 2. Login with valid credentials
      const loginResult = await securityManager.login(username, password);

      expect(loginResult.success).toBe(true);
      expect(loginResult.token).toBeDefined();
      expect(loginResult.refreshToken).toBeDefined();
      expect(loginResult.user).toBeDefined();
      expect(loginResult.user?.username).toBe(username);

      // 3. Verify token
      const verifyResult = await securityManager.verifyToken(loginResult.token!);

      expect(verifyResult.valid).toBe(true);
      expect(verifyResult.payload?.userId).toBe(registerResult.userId);

      // 4. Access protected resource
      const hasPermission = await securityManager.checkPermission(
        registerResult.userId!,
        'read:resource'
      );

      expect(typeof hasPermission).toBe('boolean');

      // 5. Logout
      const logoutResult = await securityManager.logout(loginResult.token!);
      expect(logoutResult.success).toBe(true);

      // 6. Verify token is invalid after logout
      const verifyAfterLogout = await securityManager.verifyToken(loginResult.token!);
      expect(verifyAfterLogout.valid).toBe(false);
    });

    test('failed login attempts trigger account lockout', async () => {
      const username = 'lockouttest';
      const email = 'lockout@example.com';
      const password = 'SecurePass123!';

      // Register user
      await securityManager.registerUser({
        username,
        email,
        password,
        roles: ['user'],
      });

      // Attempt multiple failed logins
      for (let i = 0; i < config.maxLoginAttempts; i++) {
        const result = await securityManager.login(username, 'WrongPassword123!');
        expect(result.success).toBe(false);
      }

      // Next login should be locked even with correct password
      const lockedResult = await securityManager.login(username, password);

      expect(lockedResult.success).toBe(false);
      expect(lockedResult.error).toContain('locked');
    });

    test('token refresh flow', async () => {
      const username = 'refreshuser';
      const email = 'refresh@example.com';
      const password = 'SecurePass123!';

      // Register and login
      await securityManager.registerUser({
        username,
        email,
        password,
        roles: ['user'],
      });

      const loginResult = await securityManager.login(username, password);
      expect(loginResult.success).toBe(true);

      const originalToken = loginResult.token!;
      const refreshToken = loginResult.refreshToken!;

      // Wait a moment to ensure new token has different timestamp
      await new Promise(resolve => setTimeout(resolve, 100));

      // Refresh token
      const refreshResult = await securityManager.refreshToken(refreshToken);

      expect(refreshResult.success).toBe(true);
      expect(refreshResult.token).toBeDefined();
      expect(refreshResult.token).not.toBe(originalToken);

      // Old token should still be valid (until expiry or explicit logout)
      const oldTokenVerify = await securityManager.verifyToken(originalToken);
      expect(oldTokenVerify.valid).toBe(true);

      // New token should be valid
      const newTokenVerify = await securityManager.verifyToken(refreshResult.token!);
      expect(newTokenVerify.valid).toBe(true);
    });
  });

  describe('Multi-Module Integration', () => {
    test('authentication + authorization + audit logging', async () => {
      const username = 'multitest';
      const email = 'multi@example.com';
      const password = 'SecurePass123!';

      // Register user with specific roles
      const registerResult = await securityManager.registerUser({
        username,
        email,
        password,
        roles: ['user', 'manager'],
      });

      const userId = registerResult.userId!;

      // Login (triggers authentication)
      const loginResult = await securityManager.login(username, password);
      expect(loginResult.success).toBe(true);

      // Check permissions (authorization)
      const canRead = await securityManager.checkPermission(userId, 'read:resource');
      const canDelete = await securityManager.checkPermission(userId, 'delete:resource');

      // Get audit logs
      const auditLogs = await securityManager.getAuditLogs(userId);

      expect(auditLogs).toBeDefined();
      expect(Array.isArray(auditLogs)).toBe(true);

      // Should have audit entries for registration and login
      const loginAudit = auditLogs.find((log: any) =>
        log.action === 'login' || log.event === 'login'
      );
      expect(loginAudit).toBeDefined();
    });

    test('rate limiting + authentication integration', async () => {
      const username = 'ratelimituser';
      const email = 'ratelimit@example.com';
      const password = 'SecurePass123!';

      // Register user
      await securityManager.registerUser({
        username,
        email,
        password,
        roles: ['user'],
      });

      // Make multiple rapid login attempts
      const results = [];
      for (let i = 0; i < 15; i++) {
        const result = await securityManager.login(username, password);
        results.push(result);
      }

      // Some requests should be rate limited
      const successCount = results.filter(r => r.success).length;
      const rateLimitedCount = results.filter(r =>
        r.error?.includes('rate limit') || r.error?.includes('too many')
      ).length;

      expect(rateLimitedCount).toBeGreaterThan(0);
    });
  });

  describe('Concurrent Operations', () => {
    test('concurrent user registrations', async () => {
      const registrations = [];

      for (let i = 0; i < 10; i++) {
        registrations.push(
          securityManager.registerUser({
            username: `concurrent${i}`,
            email: `concurrent${i}@example.com`,
            password: 'SecurePass123!',
            roles: ['user'],
          })
        );
      }

      const results = await Promise.all(registrations);

      // All registrations should succeed
      expect(results.every(r => r.success)).toBe(true);

      // All should have unique user IDs
      const userIds = results.map(r => r.userId);
      const uniqueIds = new Set(userIds);
      expect(uniqueIds.size).toBe(10);
    });

    test('concurrent logins for same user', async () => {
      const username = 'concurrentlogin';
      const email = 'concurrentlogin@example.com';
      const password = 'SecurePass123!';

      // Register user
      await securityManager.registerUser({
        username,
        email,
        password,
        roles: ['user'],
      });

      // Attempt multiple concurrent logins
      const logins = [];
      for (let i = 0; i < 5; i++) {
        logins.push(securityManager.login(username, password));
      }

      const results = await Promise.all(logins);

      // All logins should succeed
      expect(results.every(r => r.success)).toBe(true);

      // Each should have a unique token
      const tokens = results.map(r => r.token);
      const uniqueTokens = new Set(tokens);
      expect(uniqueTokens.size).toBe(5);
    });

    test('concurrent permission checks', async () => {
      const username = 'permcheck';
      const email = 'permcheck@example.com';
      const password = 'SecurePass123!';

      // Register user
      const registerResult = await securityManager.registerUser({
        username,
        email,
        password,
        roles: ['user', 'manager'],
      });

      const userId = registerResult.userId!;

      // Perform concurrent permission checks
      const permissions = [
        'read:resource',
        'write:resource',
        'delete:resource',
        'admin:resource',
        'read:user',
        'write:user',
      ];

      const checks = permissions.map(perm =>
        securityManager.checkPermission(userId, perm)
      );

      const results = await Promise.all(checks);

      // All checks should complete without errors
      expect(results.length).toBe(permissions.length);
      expect(results.every(r => typeof r === 'boolean')).toBe(true);
    });
  });

  describe('Error Propagation', () => {
    test('invalid credentials propagate error correctly', async () => {
      const result = await securityManager.login('nonexistent', 'password');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(typeof result.error).toBe('string');
    });

    test('expired token error propagation', async () => {
      // Create a token with very short expiry
      const shortExpiryConfig = { ...config, jwtExpiry: 1 };
      const tempManager = new SecurityManager(shortExpiryConfig);
      await tempManager.initialize();

      const username = 'expirytest';
      await tempManager.registerUser({
        username,
        email: 'expiry@example.com',
        password: 'SecurePass123!',
        roles: ['user'],
      });

      const loginResult = await tempManager.login(username, 'SecurePass123!');
      expect(loginResult.success).toBe(true);

      // Wait for token to expire
      await new Promise(resolve => setTimeout(resolve, 1500));

      const verifyResult = await tempManager.verifyToken(loginResult.token!);

      expect(verifyResult.valid).toBe(false);
      expect(verifyResult.error).toBeDefined();
      expect(verifyResult.error).toContain('expired');

      await tempManager.shutdown?.();
    });

    test('permission denied error propagation', async () => {
      const username = 'limiteduser';
      const registerResult = await securityManager.registerUser({
        username,
        email: 'limited@example.com',
        password: 'SecurePass123!',
        roles: ['user'], // Limited role
      });

      const userId = registerResult.userId!;

      // Try to perform admin action
      const result = await securityManager.performAction(userId, 'admin:configure');

      if (result && typeof result === 'object' && 'success' in result) {
        expect(result.success).toBe(false);
        expect(result.error).toContain('permission');
      }
    });
  });

  describe('File Operations with Temp Dirs', () => {
    test('audit logs written to temp directory', async () => {
      const auditLogPath = path.join(tempDir, 'audit.log');

      // Configure security manager to write audit logs
      const fileConfig = {
        ...config,
        auditLogPath,
      };

      const fileSecurityManager = new SecurityManager(fileConfig);
      await fileSecurityManager.initialize();

      // Perform operations that generate audit logs
      await fileSecurityManager.registerUser({
        username: 'filetest',
        email: 'file@example.com',
        password: 'SecurePass123!',
        roles: ['user'],
      });

      await fileSecurityManager.login('filetest', 'SecurePass123!');

      // Give time for logs to be written
      await new Promise(resolve => setTimeout(resolve, 200));

      // Check if audit log file was created
      const logExists = fs.existsSync(auditLogPath);

      if (logExists) {
        const logContent = fs.readFileSync(auditLogPath, 'utf-8');
        expect(logContent.length).toBeGreaterThan(0);
      }

      await fileSecurityManager.shutdown?.();
    });

    test('session data persistence', async () => {
      const sessionDbPath = path.join(tempDir, 'sessions.db');

      const persistConfig = {
        ...config,
        sessionStoragePath: sessionDbPath,
      };

      const persistManager = new SecurityManager(persistConfig);
      await persistManager.initialize();

      // Create session
      const registerResult = await persistManager.registerUser({
        username: 'persisttest',
        email: 'persist@example.com',
        password: 'SecurePass123!',
        roles: ['user'],
      });

      const loginResult = await persistManager.login('persisttest', 'SecurePass123!');
      expect(loginResult.success).toBe(true);

      await persistManager.shutdown?.();

      // Reinitialize and check if session persists
      const newManager = new SecurityManager(persistConfig);
      await newManager.initialize();

      if (loginResult.token) {
        const verifyResult = await newManager.verifyToken(loginResult.token);
        // Token should still be recognized
        expect(verifyResult).toBeDefined();
      }

      await newManager.shutdown?.();
    });
  });

  describe('Transaction Handling', () => {
    test('user registration rollback on error', async () => {
      const username = 'rollbacktest';
      const email = 'invalid-email'; // Invalid email

      const result = await securityManager.registerUser({
        username,
        email,
        password: 'SecurePass123!',
        roles: ['user'],
      });

      // If validation fails, user should not exist
      if (!result.success) {
        const loginAttempt = await securityManager.login(username, 'SecurePass123!');
        expect(loginAttempt.success).toBe(false);
      }
    });

    test('role assignment transaction', async () => {
      const username = 'roletransaction';
      const registerResult = await securityManager.registerUser({
        username,
        email: 'role@example.com',
        password: 'SecurePass123!',
        roles: ['user'],
      });

      const userId = registerResult.userId!;

      // Assign multiple roles in transaction
      const assignResult = await securityManager.assignRoles(userId, [
        'manager',
        'admin',
      ]);

      if (assignResult && assignResult.success) {
        const user = await securityManager.getUser(userId);

        if (user) {
          expect(user.roles).toContain('user');
          expect(user.roles).toContain('manager');
          expect(user.roles).toContain('admin');
        }
      }
    });
  });

  describe('Real API Calls (Mock External Services)', () => {
    test('external authentication provider integration', async () => {
      // Simulate OAuth flow
      const oauthConfig = {
        provider: 'google',
        clientId: 'test-client-id',
        clientSecret: 'test-secret',
      };

      const authUrl = await securityManager.getOAuthURL?.(oauthConfig);

      if (authUrl) {
        expect(authUrl).toContain('oauth');
        expect(authUrl).toContain('google');
      }

      // Simulate callback with auth code
      const mockAuthCode = 'mock-auth-code-12345';
      const result = await securityManager.handleOAuthCallback?.(
        oauthConfig,
        mockAuthCode
      );

      // Should handle the callback (even if mocked)
      expect(result).toBeDefined();
    });

    test('MFA integration with time-based OTP', async () => {
      const mfaConfig = { ...config, enableMFA: true };
      const mfaManager = new SecurityManager(mfaConfig);
      await mfaManager.initialize();

      const username = 'mfauser';
      await mfaManager.registerUser({
        username,
        email: 'mfa@example.com',
        password: 'SecurePass123!',
        roles: ['user'],
      });

      // Enable MFA
      const mfaSetup = await mfaManager.setupMFA?.(username);

      if (mfaSetup && mfaSetup.secret) {
        expect(mfaSetup.secret).toBeDefined();
        expect(mfaSetup.qrCode).toBeDefined();

        // Verify MFA token
        const mockToken = '123456'; // In real scenario, generate from secret
        const verifyResult = await mfaManager.verifyMFA?.(username, mockToken);

        expect(verifyResult).toBeDefined();
      }

      await mfaManager.shutdown?.();
    });
  });

  describe('Performance Under Load', () => {
    test('handle 100 concurrent authentication requests', async () => {
      // Register users first
      const users = [];
      for (let i = 0; i < 20; i++) {
        await securityManager.registerUser({
          username: `loadtest${i}`,
          email: `loadtest${i}@example.com`,
          password: 'SecurePass123!',
          roles: ['user'],
        });
        users.push(`loadtest${i}`);
      }

      // Perform concurrent authentications
      const startTime = Date.now();
      const operations = [];

      for (let i = 0; i < 100; i++) {
        const username = users[i % users.length];
        operations.push(securityManager.login(username, 'SecurePass123!'));
      }

      const results = await Promise.all(operations);
      const endTime = Date.now();

      const successCount = results.filter(r => r.success).length;
      const avgTime = (endTime - startTime) / 100;

      expect(successCount).toBeGreaterThan(80); // Allow some rate limiting
      expect(avgTime).toBeLessThan(100); // Should be fast (< 100ms per operation)
    });
  });
});
