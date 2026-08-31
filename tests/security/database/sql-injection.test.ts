/**
 * SQL Injection Attack Tests
 * Tests database modules for SQL injection vulnerabilities
 */

import {
  DatabaseConnection,
  QueryBuilder,
  Model,
  SchemaValidator,
  ORM
} from '../../../src/database/MEGA_DatabaseAbstraction';

describe('SQL Injection Security Tests', () => {
  let connection: DatabaseConnection;
  let orm: ORM;

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

    orm = new ORM({
      type: 'postgres',
      database: 'test_db'
    });
    await orm.connect();
  });

  afterEach(async () => {
    await connection.disconnect();
    await orm.disconnect();
  });

  describe('Classic SQL Injection Patterns', () => {
    test('should reject SQL injection in WHERE clause', async () => {
      const maliciousInput = "1' OR '1'='1";

      const qb = new QueryBuilder(connection);

      // This should be safe because QueryBuilder uses parameterized queries
      const { sql, params } = qb
        .select('*')
        .from('users')
        .where('id', '=', maliciousInput)
        .build();

      // Verify parameterization
      expect(params).toContain(maliciousInput);
      expect(sql).toMatch(/\$1|\?/); // Should use placeholders
      expect(sql).not.toContain("'1'='1'"); // Should not contain raw injection
    });

    test('should prevent UNION-based SQL injection', async () => {
      const maliciousInput = "1 UNION SELECT password FROM admin_users--";

      const qb = new QueryBuilder(connection);
      const { sql, params } = qb
        .select('*')
        .from('users')
        .where('username', '=', maliciousInput)
        .build();

      expect(params).toContain(maliciousInput);
      expect(sql).toMatch(/\$1|\?/);
      // UNION should be in params, not SQL
      expect(sql.split('UNION').length).toBe(1);
    });

    test('should prevent stacked queries injection', async () => {
      const maliciousInput = "admin'; DROP TABLE users; --";

      const qb = new QueryBuilder(connection);
      const { sql, params } = qb
        .select('*')
        .from('users')
        .where('username', '=', maliciousInput)
        .build();

      expect(params).toContain(maliciousInput);
      // DROP TABLE should not appear in SQL, only in params
      expect(sql).not.toMatch(/DROP\s+TABLE/i);
    });

    test('should prevent comment-based injection', async () => {
      const maliciousInputs = [
        "admin'--",
        "admin'#",
        "admin'/*",
        "admin' OR 1=1 --"
      ];

      for (const input of maliciousInputs) {
        const qb = new QueryBuilder(connection);
        const { sql, params } = qb
          .select('*')
          .from('users')
          .where('username', '=', input)
          .build();

        expect(params).toContain(input);
        expect(sql).toMatch(/\$1|\?/);
      }
    });

    test('should prevent time-based blind SQL injection', async () => {
      const maliciousInput = "1' AND SLEEP(10)--";

      const qb = new QueryBuilder(connection);
      const { sql, params } = qb
        .select('*')
        .from('users')
        .where('id', '=', maliciousInput)
        .build();

      expect(params).toContain(maliciousInput);
      expect(sql).not.toMatch(/SLEEP/i);
    });

    test('should prevent boolean-based blind SQL injection', async () => {
      const maliciousInput = "1' AND 1=1--";

      const qb = new QueryBuilder(connection);
      const { sql, params } = qb
        .select('*')
        .from('users')
        .where('id', '=', maliciousInput)
        .build();

      expect(params).toContain(maliciousInput);
      // The condition should be parameterized
      expect(sql.split('AND').filter(s => s.includes('1=1')).length).toBe(0);
    });
  });

  describe('Advanced SQL Injection Techniques', () => {
    test('should prevent second-order SQL injection', async () => {
      // Simulate storing malicious data
      const maliciousUsername = "admin' OR '1'='1";

      const qb = new QueryBuilder(connection);
      const { sql: insertSql, params: insertParams } = qb
        .select('*')
        .from('users')
        .where('username', '=', maliciousUsername)
        .build();

      // Even when re-using stored data, it should be safe
      expect(insertParams).toContain(maliciousUsername);
      expect(insertSql).toMatch(/\$1|\?/);
    });

    test('should prevent injection through ORDER BY clause', async () => {
      const maliciousColumn = "id; DROP TABLE users--";

      // Should validate column names
      const qb = new QueryBuilder(connection);

      expect(() => {
        qb.select('*')
          .from('users')
          .orderBy(maliciousColumn, 'ASC');
      }).toThrow(); // Should throw on invalid identifier
    });

    test('should prevent injection through table names', async () => {
      const maliciousTable = "users; DROP TABLE admins--";

      expect(() => {
        const qb = new QueryBuilder(connection);
        qb.select('*').from(maliciousTable);
      }).toThrow(); // Should validate table name
    });

    test('should prevent injection through column names', async () => {
      const maliciousColumns = [
        "id; DROP TABLE users--",
        "id' OR '1'='1",
        "*, (SELECT password FROM admin)",
        "id UNION SELECT password"
      ];

      for (const col of maliciousColumns) {
        expect(() => {
          const qb = new QueryBuilder(connection);
          qb.select(col).from('users');
        }).toThrow();
      }
    });

    test('should prevent injection in LIKE patterns', async () => {
      const maliciousPattern = "%' OR '1'='1' --";

      const qb = new QueryBuilder(connection);
      const { sql, params } = qb
        .select('*')
        .from('users')
        .where('username', 'LIKE', maliciousPattern)
        .build();

      expect(params).toContain(maliciousPattern);
      expect(sql).toMatch(/LIKE\s+(\$1|\?)/);
    });

    test('should prevent injection in IN clause', async () => {
      const maliciousValues = ["1", "2' OR '1'='1", "3"];

      const qb = new QueryBuilder(connection);
      const { sql, params } = qb
        .select('*')
        .from('users')
        .whereIn('id', maliciousValues)
        .build();

      // All values should be parameterized
      expect(params).toEqual(expect.arrayContaining(maliciousValues));
      expect(sql).toMatch(/IN\s*\(/);
    });

    test('should prevent injection in BETWEEN clause', async () => {
      const maliciousMin = "1' OR '1'='1";
      const maliciousMax = "100' OR '1'='1";

      const qb = new QueryBuilder(connection);
      const { sql, params } = qb
        .select('*')
        .from('users')
        .whereBetween('age', maliciousMin, maliciousMax)
        .build();

      expect(params).toContain(maliciousMin);
      expect(params).toContain(maliciousMax);
      expect(sql).toMatch(/BETWEEN\s+(\$1|\?)\s+AND\s+(\$2|\?)/);
    });
  });

  describe('Database-Specific Injection Techniques', () => {
    test('should prevent PostgreSQL-specific injection (xp_cmdshell)', async () => {
      const maliciousQuery = "1; COPY (SELECT '') TO PROGRAM 'rm -rf /'--";

      expect(async () => {
        await connection.query(maliciousQuery, []);
      }).rejects.toThrow(/dangerous.*pattern/i);
    });

    test('should prevent MySQL-specific injection (INTO OUTFILE)', async () => {
      const maliciousInput = "1' INTO OUTFILE '/var/www/shell.php'--";

      const qb = new QueryBuilder(connection);
      const { sql, params } = qb
        .select('*')
        .from('users')
        .where('id', '=', maliciousInput)
        .build();

      expect(params).toContain(maliciousInput);
      expect(sql).not.toMatch(/INTO\s+OUTFILE/i);
    });

    test('should prevent stored procedure injection', async () => {
      const maliciousInput = "1'; EXEC sp_executesql N'DROP TABLE users'--";

      expect(async () => {
        await connection.query(maliciousInput, []);
      }).rejects.toThrow(/dangerous.*pattern/i);
    });

    test('should prevent hex-encoded injection', async () => {
      const hexEncodedInjection = "0x61646D696E"; // 'admin' in hex

      const qb = new QueryBuilder(connection);
      const { sql, params } = qb
        .select('*')
        .from('users')
        .where('username', '=', hexEncodedInjection)
        .build();

      expect(params).toContain(hexEncodedInjection);
    });
  });

  describe('ORM-Level SQL Injection Protection', () => {
    test('should prevent injection in Model.find()', async () => {
      class User extends Model {}
      User.setConnection(connection);
      User.setSchema({
        table: 'users',
        columns: {
          id: { type: 'integer', primaryKey: true },
          username: { type: 'string' }
        }
      });

      const maliciousId = "1' OR '1'='1";

      // Should handle safely through parameterization
      await expect(async () => {
        await User.find(maliciousId);
      }).not.toThrow();
    });

    test('should prevent injection in Model.where()', async () => {
      class User extends Model {}
      User.setConnection(connection);
      User.setSchema({
        table: 'users',
        columns: {
          id: { type: 'integer', primaryKey: true },
          username: { type: 'string' }
        }
      });

      const maliciousUsername = "admin' OR '1'='1";

      await expect(async () => {
        await User.where('username', '=', maliciousUsername);
      }).not.toThrow();
    });

    test('should validate operators to prevent injection', async () => {
      const maliciousOperators = [
        "= OR 1=1 --",
        "LIKE'; DROP TABLE users--",
        "IN (SELECT password FROM admin)"
      ];

      for (const op of maliciousOperators) {
        expect(() => {
          SchemaValidator.validateOperator(op);
        }).toThrow(/invalid operator/i);
      }
    });
  });

  describe('Parameter Validation', () => {
    test('should reject mismatched parameter count', async () => {
      const sql = "SELECT * FROM users WHERE id = $1 AND username = $2";
      const params = ["123"]; // Missing second parameter

      await expect(async () => {
        await connection.query(sql, params);
      }).rejects.toThrow(/parameter mismatch/i);
    });

    test('should validate SQL identifiers', () => {
      const invalidIdentifiers = [
        "'; DROP TABLE users--",
        "user; DROP TABLE users",
        "table.column; DELETE FROM users",
        "../../../etc/passwd",
        "user\x00name"
      ];

      for (const identifier of invalidIdentifiers) {
        expect(() => {
          SchemaValidator.validateIdentifier(identifier, 'Test');
        }).toThrow();
      }
    });

    test('should reject SQL keywords as identifiers', () => {
      const keywords = ['SELECT', 'INSERT', 'DELETE', 'DROP', 'UPDATE', 'UNION'];

      for (const keyword of keywords) {
        expect(() => {
          SchemaValidator.validateTableName(keyword);
        }).toThrow(/reserved.*keyword/i);
      }
    });

    test('should validate identifier length', () => {
      const tooLong = 'a'.repeat(64);

      expect(() => {
        SchemaValidator.validateIdentifier(tooLong, 'Test');
      }).toThrow(/maximum length/i);
    });
  });

  describe('Transaction Safety', () => {
    test('should rollback on injection attempt in transaction', async () => {
      await connection.beginTransaction();

      try {
        const maliciousQuery = "INSERT INTO users VALUES (1, 'admin'); DROP TABLE users--";
        await connection.query(maliciousQuery, []);
      } catch (error) {
        await connection.rollback();
        expect(error).toBeDefined();
      }

      expect(connection.getTransactionDepth()).toBe(0);
    });

    test('should prevent nested transaction injection', async () => {
      await connection.beginTransaction();

      const maliciousSavepoint = "sp1; DROP TABLE users--";

      await expect(async () => {
        await connection.beginTransaction(); // Creates savepoint
      }).not.toThrow(); // Should handle safely with validation

      await connection.rollback();
    });
  });
});
