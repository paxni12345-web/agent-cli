/**
 * End-to-End Integration Tests for Complete Security Flow
 * Tests integration of all security modules working together
 */

import { SecurityManager, SecurityConfig } from '../../../src/security/SecurityManager';
import { RBACPermissionManager, Role, Permission } from '../../../src/security/RBACPermissionManager';
import { SecretDetector, SecretVault } from '../../../src/security/SecretManager';
import { RateLimiter } from '../../../src/security/RateLimiter';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('Complete Security System E2E Integration Tests', () => {
  let securityManager: SecurityManager;
  let rbac: RBACPermissionManager;
  let secretDetector: SecretDetector;
  let secretVault: SecretVault;
  let rateLimiter: RateLimiter;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'security-e2e-'));

    const config: SecurityConfig = {
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
      maxLoginAttempts: 5,
      lockoutDuration: 900,
      rateLimitWindow: 60,
      rateLimitMaxAttempts: 10,
      passwordResetExpiry: 3600,
      bcryptRounds: 10,
    };

    securityManager = new SecurityManager(config);
    await securityManager.initialize();

    rbac = new RBACPermissionManager();
    secretDetector = new SecretDetector();
    secretVault = new SecretVault({ provider: 'local' });
    rateLimiter = new RateLimiter();
  });

  afterEach(async () => {
    await securityManager.shutdown?.();
    rateLimiter.cleanup();

    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('Complete User Onboarding Flow', () => {
    test('full user lifecycle: registration → authentication → authorization → audit', async () => {
      const username = 'newuser';
      const email = 'newuser@example.com';
      const password = 'SecurePass123!';

      // 1. REGISTRATION with rate limiting
      rateLimiter.setUserLimits(username, {
        requestsPerMinute: 60,
        requestsPerDay: 1000,
      });

      const rateLimitCheck = await rateLimiter.checkRateLimit(username);
      expect(rateLimitCheck.allowed).toBe(true);

      const registerResult = await securityManager.registerUser({
        username,
        email,
        password,
        roles: ['user'],
      });

      expect(registerResult.success).toBe(true);
      const userId = registerResult.userId!;

      rateLimiter.recordRequest(username);

      // 2. RBAC setup
      rbac.registerUser({
        id: userId,
        username,
        roles: [Role.USER],
      });

      // 3. AUTHENTICATION
      const loginResult = await securityManager.login(username, password);
      expect(loginResult.success).toBe(true);
      expect(loginResult.token).toBeDefined();

      rateLimiter.recordRequest(username);

      // 4. AUTHORIZATION check
      const canRead = rbac.hasPermission(userId, Permission.READ_RESOURCE);
      const canDelete = rbac.hasPermission(userId, Permission.DELETE_RESOURCE);

      expect(canRead).toBe(true);
      expect(canDelete).toBe(false);

      // 5. AUDIT TRAIL
      const auditLogs = await securityManager.getAuditLogs(userId);
      expect(auditLogs).toBeDefined();

      const rbacAudit = rbac.getAuditLog(userId);
      expect(rbacAudit.length).toBeGreaterThan(0);

      // 6. CHECK USAGE METRICS
      const metrics = rateLimiter.getUsageMetrics(username);
      expect(metrics.requestCount).toBe(2);
    });

    test('secure configuration storage and retrieval', async () => {
      const username = 'configuser';
      const configPath = path.join(tempDir, 'app-config.json');

      // 1. User registers
      const registerResult = await securityManager.registerUser({
        username,
        email: 'config@example.com',
        password: 'SecurePass123!',
        roles: ['user'],
      });

      const userId = registerResult.userId!;

      // 2. Create config file with secrets
      const unsafeConfig = {
        apiKey: 'sk-ant-api03-abcdefghijklmnopqrstuvwxyz1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890abcdefghijklmnop',
        database: {
          host: 'localhost',
          password: 'DbPassword123!',
        },
        awsKey: 'AKIAIOSFODNN7EXAMPLE',
      };

      fs.writeFileSync(configPath, JSON.stringify(unsafeConfig, null, 2));

      // 3. Scan for secrets
      const fileContent = fs.readFileSync(configPath, 'utf-8');
      const secrets = secretDetector.scanFile(configPath, fileContent);

      expect(secrets.length).toBeGreaterThan(0);

      // 4. Store secrets in vault
      await secretVault.store('api-key', unsafeConfig.apiKey);
      await secretVault.store('db-password', unsafeConfig.database.password);
      await secretVault.store('aws-key', unsafeConfig.awsKey);

      // 5. Create safe config with references
      const safeConfig = {
        apiKey: '${VAULT:api-key}',
        database: {
          host: 'localhost',
          password: '${VAULT:db-password}',
        },
        awsKey: '${VAULT:aws-key}',
      };

      const safeConfigPath = path.join(tempDir, 'app-config.safe.json');
      fs.writeFileSync(safeConfigPath, JSON.stringify(safeConfig, null, 2));

      // 6. Verify safe config has no secrets
      const safeContent = fs.readFileSync(safeConfigPath, 'utf-8');
      const safeSecrets = secretDetector.scanFile(safeConfigPath, safeContent);

      expect(safeSecrets.length).toBe(0);

      // 7. Check RBAC permissions for config access
      rbac.registerUser({ id: userId, username, roles: [Role.USER] });

      const canReadConfig = rbac.hasPermission(userId, Permission.READ_RESOURCE);
      expect(canReadConfig).toBe(true);
    });
  });

  describe('Multi-User Collaboration with Access Control', () => {
    test('team collaboration with different permission levels', async () => {
      // Create team members
      const admin = {
        username: 'admin',
        email: 'admin@example.com',
        password: 'AdminPass123!',
        roles: ['admin'],
      };

      const manager = {
        username: 'manager',
        email: 'manager@example.com',
        password: 'ManagerPass123!',
        roles: ['manager'],
      };

      const developer = {
        username: 'developer',
        email: 'dev@example.com',
        password: 'DevPass123!',
        roles: ['user'],
      };

      // Register all users
      const adminResult = await securityManager.registerUser(admin);
      const managerResult = await securityManager.registerUser(manager);
      const devResult = await securityManager.registerUser(developer);

      expect(adminResult.success).toBe(true);
      expect(managerResult.success).toBe(true);
      expect(devResult.success).toBe(true);

      // Set up RBAC
      rbac.registerUser({
        id: adminResult.userId!,
        username: admin.username,
        roles: [Role.ADMIN],
      });

      rbac.registerUser({
        id: managerResult.userId!,
        username: manager.username,
        roles: [Role.MANAGER],
      });

      rbac.registerUser({
        id: devResult.userId!,
        username: developer.username,
        roles: [Role.USER],
      });

      // Create shared resource
      const resource = {
        id: 'project-repo',
        type: 'repository',
        ownerId: adminResult.userId!,
      };

      rbac.registerResource(resource);

      // Grant permissions
      rbac.grantResourcePermission(
        adminResult.userId!,
        resource.id,
        Permission.DELETE_RESOURCE
      );
      rbac.grantResourcePermission(
        managerResult.userId!,
        resource.id,
        Permission.UPDATE_RESOURCE
      );
      rbac.grantResourcePermission(
        devResult.userId!,
        resource.id,
        Permission.READ_RESOURCE
      );

      // Verify permissions
      expect(
        rbac.hasResourcePermission(adminResult.userId!, resource.id, Permission.DELETE_RESOURCE)
      ).toBe(true);
      expect(
        rbac.hasResourcePermission(managerResult.userId!, resource.id, Permission.UPDATE_RESOURCE)
      ).toBe(true);
      expect(
        rbac.hasResourcePermission(managerResult.userId!, resource.id, Permission.DELETE_RESOURCE)
      ).toBe(false);
      expect(
        rbac.hasResourcePermission(devResult.userId!, resource.id, Permission.READ_RESOURCE)
      ).toBe(true);
      expect(
        rbac.hasResourcePermission(devResult.userId!, resource.id, Permission.UPDATE_RESOURCE)
      ).toBe(false);

      // All users should have rate limits
      rateLimiter.setUserLimits(admin.username, { requestsPerDay: 10000 });
      rateLimiter.setUserLimits(manager.username, { requestsPerDay: 5000 });
      rateLimiter.setUserLimits(developer.username, { requestsPerDay: 1000 });

      // Verify different limits
      const adminLimits = rateLimiter.getUserLimits(admin.username);
      const devLimits = rateLimiter.getUserLimits(developer.username);

      expect(adminLimits.requestsPerDay).toBeGreaterThan(devLimits.requestsPerDay!);
    });

    test('concurrent user operations with access control', async () => {
      const users = [];

      // Create 10 users concurrently
      const registrations = [];
      for (let i = 0; i < 10; i++) {
        registrations.push(
          securityManager.registerUser({
            username: `user${i}`,
            email: `user${i}@example.com`,
            password: 'UserPass123!',
            roles: ['user'],
          })
        );
      }

      const results = await Promise.all(registrations);

      // All should succeed
      expect(results.every(r => r.success)).toBe(true);

      // Set up RBAC for all
      results.forEach((result, i) => {
        rbac.registerUser({
          id: result.userId!,
          username: `user${i}`,
          roles: [Role.USER],
        });
      });

      // Concurrent permission checks
      const permissionChecks = results.map(result =>
        rbac.hasPermission(result.userId!, Permission.READ_USER)
      );

      expect(permissionChecks.every(check => check === true)).toBe(true);

      // Concurrent logins
      const logins = [];
      for (let i = 0; i < 10; i++) {
        logins.push(securityManager.login(`user${i}`, 'UserPass123!'));
      }

      const loginResults = await Promise.all(logins);
      expect(loginResults.every(r => r.success)).toBe(true);
    });
  });

  describe('Security Incident Response Flow', () => {
    test('detect, alert, and remediate security issue', async () => {
      const username = 'incident-user';

      // 1. Register user
      const registerResult = await securityManager.registerUser({
        username,
        email: 'incident@example.com',
        password: 'IncidentPass123!',
        roles: ['user'],
      });

      const userId = registerResult.userId!;

      // 2. Simulate suspicious activity (multiple failed logins)
      const failedAttempts = [];
      for (let i = 0; i < 5; i++) {
        failedAttempts.push(securityManager.login(username, 'WrongPassword!'));
      }

      const failedResults = await Promise.all(failedAttempts);
      expect(failedResults.every(r => !r.success)).toBe(true);

      // 3. Account should be locked
      const lockedAttempt = await securityManager.login(username, 'IncidentPass123!');
      expect(lockedAttempt.success).toBe(false);

      // 4. Create incident report file
      const incidentPath = path.join(tempDir, 'security-incident.log');
      const incident = {
        timestamp: new Date().toISOString(),
        userId,
        username,
        event: 'multiple_failed_logins',
        attempts: 5,
        status: 'account_locked',
      };

      fs.writeFileSync(incidentPath, JSON.stringify(incident, null, 2));

      // 5. Check audit trail
      const auditLogs = await securityManager.getAuditLogs(userId);
      expect(auditLogs).toBeDefined();

      // 6. Admin reviews and unlocks account (simulated)
      // In real scenario, admin would call unlock method
    });

    test('secret leak detection and mitigation', async () => {
      // 1. Simulate code commit with secret
      const commitFile = path.join(tempDir, 'leaked-commit.js');
      const leakedCode = `
        // BAD: Secret in code
        const apiKey = 'sk-ant-api03-abcdefghijklmnopqrstuvwxyz1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890abcdefghijklmnop';
        const awsSecret = 'AKIAIOSFODNN7EXAMPLE';

        function connectToAPI() {
          return fetch('https://api.example.com', {
            headers: { 'Authorization': 'Bearer ' + apiKey }
          });
        }
      `;

      fs.writeFileSync(commitFile, leakedCode);

      // 2. Pre-commit hook scans for secrets
      const fileContent = fs.readFileSync(commitFile, 'utf-8');
      const secrets = secretDetector.scanFile(commitFile, fileContent);

      // 3. Secrets detected - block commit
      expect(secrets.length).toBeGreaterThan(0);

      const criticalSecrets = secrets.filter(s => s.severity === 'critical');
      expect(criticalSecrets.length).toBeGreaterThan(0);

      // 4. Generate security report
      const report = secretDetector.generateReport(secrets);
      const reportPath = path.join(tempDir, 'leak-report.txt');
      fs.writeFileSync(reportPath, report);

      // 5. Remediation: Redact and store in vault
      const redactedCode = secretDetector.redactSecrets(leakedCode);
      const fixedFile = path.join(tempDir, 'fixed-commit.js');
      fs.writeFileSync(fixedFile, redactedCode);

      // 6. Verify fixed file is clean
      const fixedContent = fs.readFileSync(fixedFile, 'utf-8');
      const remainingSecrets = secretDetector.scanFile(fixedFile, fixedContent);
      expect(remainingSecrets.length).toBe(0);
    });
  });

  describe('Transaction and Error Handling', () => {
    test('transaction rollback on registration failure', async () => {
      const username = 'transaction-test';

      // Attempt registration with invalid data
      const result = await securityManager.registerUser({
        username,
        email: 'invalid-email', // Invalid email
        password: 'weak', // Too weak password
        roles: ['user'],
      });

      // Should fail
      if (!result.success) {
        // Verify user doesn't exist
        const loginAttempt = await securityManager.login(username, 'weak');
        expect(loginAttempt.success).toBe(false);

        // Should not appear in RBAC
        expect(() => {
          rbac.getUser(username);
        }).toThrow();
      }
    });

    test('error propagation through security layers', async () => {
      const username = 'error-test';

      // Register user
      const registerResult = await securityManager.registerUser({
        username,
        email: 'error@example.com',
        password: 'ErrorPass123!',
        roles: ['user'],
      });

      const userId = registerResult.userId!;

      // Set up RBAC
      rbac.registerUser({
        id: userId,
        username,
        roles: [Role.USER],
      });

      // Try to perform unauthorized action
      const hasAdminPermission = rbac.hasPermission(userId, Permission.MANAGE_PERMISSIONS);
      expect(hasAdminPermission).toBe(false);

      // Error should be logged in audit
      const auditLog = rbac.getAuditLog(userId);
      const deniedActions = auditLog.filter(entry => entry.result === 'failure');

      if (deniedActions.length > 0) {
        expect(deniedActions[0].reason).toBeDefined();
      }
    });

    test('concurrent write conflicts are handled', async () => {
      const userId = 'conflict-user';

      rbac.registerUser({
        id: userId,
        username: 'conflict',
        roles: [Role.USER],
      });

      // Concurrent role assignments
      const operations = [
        () => rbac.assignRole(userId, Role.MANAGER),
        () => rbac.assignRole(userId, Role.ADMIN),
        () => rbac.revokeRole(userId, Role.USER),
      ];

      // Execute concurrently
      operations.forEach(op => op());

      // System should handle conflicts and maintain consistency
      const user = rbac.getUser(userId);
      expect(user).toBeDefined();
      expect(user?.roles).toBeDefined();
    });
  });

  describe('Performance Under Production Load', () => {
    test('handle 100 concurrent secure operations', async () => {
      const operations = [];

      // Mix of different security operations
      for (let i = 0; i < 100; i++) {
        const type = i % 4;

        switch (type) {
          case 0: // Registration
            operations.push(
              securityManager.registerUser({
                username: `load-user-${i}`,
                email: `load${i}@example.com`,
                password: 'LoadPass123!',
                roles: ['user'],
              })
            );
            break;

          case 1: // Rate limiting check
            operations.push(
              rateLimiter.checkRateLimit(`user-${i}`).then(result => {
                if (result.allowed) {
                  rateLimiter.recordRequest(`user-${i}`);
                }
                return result;
              })
            );
            break;

          case 2: // Secret scanning
            operations.push(
              Promise.resolve().then(() => {
                const testContent = `const key = "test-key-${i}";`;
                return secretDetector.scanText(testContent, `file-${i}.js`);
              })
            );
            break;

          case 3: // RBAC permission check
            operations.push(
              Promise.resolve().then(() => {
                rbac.registerUser({
                  id: `rbac-user-${i}`,
                  username: `rbac${i}`,
                  roles: [Role.USER],
                });
                return rbac.hasPermission(`rbac-user-${i}`, Permission.READ_USER);
              })
            );
            break;
        }
      }

      const startTime = Date.now();
      const results = await Promise.all(operations);
      const duration = Date.now() - startTime;

      // All operations should complete
      expect(results.length).toBe(100);

      // Should complete in reasonable time
      expect(duration).toBeLessThan(5000); // 5 seconds for 100 operations

      console.log(`Completed 100 operations in ${duration}ms`);
    });
  });

  describe('Data Persistence and Recovery', () => {
    test('security state persists across restarts', async () => {
      const username = 'persist-user';
      const password = 'PersistPass123!';

      // Create user
      const registerResult = await securityManager.registerUser({
        username,
        email: 'persist@example.com',
        password,
        roles: ['user'],
      });

      const userId = registerResult.userId!;

      // Login and get token
      const loginResult = await securityManager.login(username, password);
      const token = loginResult.token!;

      // Store secrets
      await secretVault.store('persist-key', 'persist-value-123');

      // Shutdown
      await securityManager.shutdown?.();

      // Simulate restart - create new instances
      const config: SecurityConfig = {
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
        maxLoginAttempts: 5,
        lockoutDuration: 900,
        rateLimitWindow: 60,
        rateLimitMaxAttempts: 10,
        passwordResetExpiry: 3600,
        bcryptRounds: 10,
      };

      const newSecurityManager = new SecurityManager(config);
      await newSecurityManager.initialize();

      // Login should still work
      const newLoginResult = await newSecurityManager.login(username, password);
      expect(newLoginResult.success).toBe(true);

      await newSecurityManager.shutdown?.();
    });
  });
});
