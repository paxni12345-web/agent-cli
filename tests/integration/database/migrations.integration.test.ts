/**
 * Integration Tests: Database Migrations
 * Tests migration execution, rollback, and schema changes
 */

import {
  ORM,
  Migration,
  MigrationManager,
  DatabaseConfig,
  TableBuilder
} from '../../../src/database/MEGA_DatabaseAbstraction';

describe('Database Migrations Integration', () => {
  let orm: ORM;
  let migrationManager: MigrationManager;

  beforeAll(async () => {
    const config: DatabaseConfig = {
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'test_migrations',
      username: process.env.DB_USER || 'test',
      password: process.env.DB_PASSWORD || 'test',
      logging: false
    };

    orm = new ORM(config);
    await orm.connect();
    migrationManager = orm.migrations();
  });

  afterAll(async () => {
    await orm.disconnect();
  });

  describe('Migration Execution', () => {
    test('should run pending migrations', async () => {
      class CreateUsersTable extends Migration {
        async up(): Promise<void> {
          await this.createTable('migration_test_users', (table: TableBuilder) => {
            table.id();
            table.string('username', 100).notNullable();
            table.string('email', 255).notNullable().unique();
            table.timestamps();
          });
        }

        async down(): Promise<void> {
          await this.dropTable('migration_test_users');
        }
      }

      migrationManager.register('001_create_users_table', new CreateUsersTable(orm.getConnection()));

      await expect(migrationManager.up()).resolves.not.toThrow();
    });

    test('should track executed migrations', async () => {
      class CreatePostsTable extends Migration {
        async up(): Promise<void> {
          await this.createTable('migration_test_posts', (table: TableBuilder) => {
            table.id();
            table.string('title', 255).notNullable();
            table.text('content');
            table.timestamps();
          });
        }

        async down(): Promise<void> {
          await this.dropTable('migration_test_posts');
        }
      }

      migrationManager.register('002_create_posts_table', new CreatePostsTable(orm.getConnection()));

      await migrationManager.up();

      const status = await migrationManager.status();
      const postsStatus = status.find(s => s.name === '002_create_posts_table');

      expect(postsStatus?.executed).toBe(true);
    });

    test('should skip already executed migrations', async () => {
      const initialStatus = await migrationManager.status();
      const executedCount = initialStatus.filter(s => s.executed).length;

      await migrationManager.up();

      const finalStatus = await migrationManager.status();
      const finalExecutedCount = finalStatus.filter(s => s.executed).length;

      expect(finalExecutedCount).toBe(executedCount);
    });

    test('should rollback migrations', async () => {
      class CreateTempTable extends Migration {
        async up(): Promise<void> {
          await this.createTable('migration_temp_table', (table: TableBuilder) => {
            table.id();
            table.string('name', 100);
          });
        }

        async down(): Promise<void> {
          await this.dropTable('migration_temp_table');
        }
      }

      migrationManager.register('003_create_temp_table', new CreateTempTable(orm.getConnection()));

      await migrationManager.up();

      const beforeRollback = await migrationManager.status();
      expect(beforeRollback.find(s => s.name === '003_create_temp_table')?.executed).toBe(true);

      await migrationManager.down(1);

      const afterRollback = await migrationManager.status();
      expect(afterRollback.find(s => s.name === '003_create_temp_table')?.executed).toBe(false);
    });

    test('should handle migration failure and rollback', async () => {
      class FailingMigration extends Migration {
        async up(): Promise<void> {
          await this.createTable('failing_table', (table: TableBuilder) => {
            table.id();
          });

          throw new Error('Intentional migration failure');
        }

        async down(): Promise<void> {
          await this.dropTable('failing_table');
        }
      }

      migrationManager.register('004_failing_migration', new FailingMigration(orm.getConnection()));

      await expect(migrationManager.up()).rejects.toThrow('Intentional migration failure');

      const status = await migrationManager.status();
      expect(status.find(s => s.name === '004_failing_migration')?.executed).toBe(false);
    });
  });

  describe('Schema Changes', () => {
    test('should add column to existing table', async () => {
      class AddColumnMigration extends Migration {
        async up(): Promise<void> {
          await this.addColumn('migration_test_users', 'age', {
            type: 'integer',
            nullable: true
          });
        }

        async down(): Promise<void> {
          await this.dropColumn('migration_test_users', 'age');
        }
      }

      const migration = new AddColumnMigration(orm.getConnection());
      await expect(migration.up()).resolves.not.toThrow();
    });

    test('should drop column from existing table', async () => {
      class DropColumnMigration extends Migration {
        async up(): Promise<void> {
          await this.addColumn('migration_test_users', 'temp_column', {
            type: 'string',
            length: 50
          });
        }

        async down(): Promise<void> {
          await this.dropColumn('migration_test_users', 'temp_column');
        }
      }

      const migration = new DropColumnMigration(orm.getConnection());
      await migration.up();
      await expect(migration.down()).resolves.not.toThrow();
    });

    test('should add index to table', async () => {
      class AddIndexMigration extends Migration {
        async up(): Promise<void> {
          await this.addIndex('migration_test_users', ['email'], false);
        }

        async down(): Promise<void> {
          await this.dropIndex('migration_test_users', 'migration_test_users_email_index');
        }
      }

      const migration = new AddIndexMigration(orm.getConnection());
      await expect(migration.up()).resolves.not.toThrow();
    });

    test('should add unique index', async () => {
      class AddUniqueIndexMigration extends Migration {
        async up(): Promise<void> {
          await this.addIndex('migration_test_users', ['username'], true);
        }

        async down(): Promise<void> {
          await this.dropIndex('migration_test_users', 'migration_test_users_username_unique');
        }
      }

      const migration = new AddUniqueIndexMigration(orm.getConnection());
      await expect(migration.up()).resolves.not.toThrow();
    });
  });

  describe('Complex Table Creation', () => {
    test('should create table with foreign keys', async () => {
      class CreateOrdersTable extends Migration {
        async up(): Promise<void> {
          await this.createTable('migration_test_orders', (table: TableBuilder) => {
            table.id();
            table.integer('user_id').notNullable();
            table.decimal('total', 10, 2).notNullable();
            table.string('status', 50).default('pending');
            table.timestamps();

            table.foreign('user_id')
              .on('migration_test_users')
              .column('id')
              .onDelete('CASCADE');
          });
        }

        async down(): Promise<void> {
          await this.dropTable('migration_test_orders');
        }
      }

      const migration = new CreateOrdersTable(orm.getConnection());
      await expect(migration.up()).resolves.not.toThrow();
    });

    test('should create table with multiple column types', async () => {
      class CreateComplexTable extends Migration {
        async up(): Promise<void> {
          await this.createTable('migration_complex', (table: TableBuilder) => {
            table.id();
            table.string('name', 255).notNullable();
            table.text('description');
            table.integer('count').default(0);
            table.bigInteger('big_number');
            table.float('rating');
            table.decimal('price', 10, 2);
            table.boolean('active').default(true);
            table.date('start_date');
            table.datetime('scheduled_at');
            table.timestamp('processed_at');
            table.json('metadata');
            table.uuid('external_id');
            table.enum('category', ['A', 'B', 'C']);
            table.timestamps();
            table.softDeletes();
          });
        }

        async down(): Promise<void> {
          await this.dropTable('migration_complex');
        }
      }

      const migration = new CreateComplexTable(orm.getConnection());
      await expect(migration.up()).resolves.not.toThrow();
    });

    test('should create table with indexes', async () => {
      class CreateIndexedTable extends Migration {
        async up(): Promise<void> {
          await this.createTable('migration_indexed', (table: TableBuilder) => {
            table.id();
            table.string('code', 50).notNullable().unique();
            table.string('name', 255);
            table.integer('category_id');

            table.index(['name']);
            table.index(['category_id', 'name']);
            table.unique(['code']);
          });
        }

        async down(): Promise<void> {
          await this.dropTable('migration_indexed');
        }
      }

      const migration = new CreateIndexedTable(orm.getConnection());
      await expect(migration.up()).resolves.not.toThrow();
    });
  });

  describe('Migration Status and Ordering', () => {
    test('should execute migrations in order', async () => {
      const executionOrder: string[] = [];

      class FirstMigration extends Migration {
        async up(): Promise<void> {
          executionOrder.push('first');
        }
        async down(): Promise<void> {}
      }

      class SecondMigration extends Migration {
        async up(): Promise<void> {
          executionOrder.push('second');
        }
        async down(): Promise<void> {}
      }

      class ThirdMigration extends Migration {
        async up(): Promise<void> {
          executionOrder.push('third');
        }
        async down(): Promise<void> {}
      }

      migrationManager.register('010_first', new FirstMigration(orm.getConnection()));
      migrationManager.register('011_second', new SecondMigration(orm.getConnection()));
      migrationManager.register('012_third', new ThirdMigration(orm.getConnection()));

      await migrationManager.up();

      expect(executionOrder).toEqual(['first', 'second', 'third']);
    });

    test('should get migration status', async () => {
      const status = await migrationManager.status();

      expect(Array.isArray(status)).toBe(true);
      status.forEach(s => {
        expect(s).toHaveProperty('name');
        expect(s).toHaveProperty('executed');
        expect(typeof s.executed).toBe('boolean');
      });
    });

    test('should rollback multiple migrations', async () => {
      class RollbackTest1 extends Migration {
        async up(): Promise<void> {
          await this.createTable('rollback_test_1', (table: TableBuilder) => {
            table.id();
          });
        }
        async down(): Promise<void> {
          await this.dropTable('rollback_test_1');
        }
      }

      class RollbackTest2 extends Migration {
        async up(): Promise<void> {
          await this.createTable('rollback_test_2', (table: TableBuilder) => {
            table.id();
          });
        }
        async down(): Promise<void> {
          await this.dropTable('rollback_test_2');
        }
      }

      migrationManager.register('020_rollback_1', new RollbackTest1(orm.getConnection()));
      migrationManager.register('021_rollback_2', new RollbackTest2(orm.getConnection()));

      await migrationManager.up();

      const beforeRollback = await migrationManager.status();
      const executedBefore = beforeRollback.filter(s => s.executed).length;

      await migrationManager.down(2);

      const afterRollback = await migrationManager.status();
      const executedAfter = afterRollback.filter(s => s.executed).length;

      expect(executedAfter).toBe(executedBefore - 2);
    });
  });

  describe('Transaction Safety', () => {
    test('should run migration in transaction', async () => {
      const connection = orm.getConnection();
      const initialDepth = connection.getTransactionDepth();

      class TransactionalMigration extends Migration {
        async up(): Promise<void> {
          await this.createTable('transactional_test', (table: TableBuilder) => {
            table.id();
            table.string('name', 100);
          });
        }

        async down(): Promise<void> {
          await this.dropTable('transactional_test');
        }
      }

      migrationManager.register('030_transactional', new TransactionalMigration(connection));

      await migrationManager.up();

      expect(connection.getTransactionDepth()).toBe(initialDepth);
    });

    test('should rollback on migration error', async () => {
      class ErrorMigration extends Migration {
        async up(): Promise<void> {
          await this.createTable('error_test_1', (table: TableBuilder) => {
            table.id();
          });

          throw new Error('Simulated error');
        }

        async down(): Promise<void> {
          await this.dropTable('error_test_1');
        }
      }

      migrationManager.register('031_error_test', new ErrorMigration(orm.getConnection()));

      await expect(migrationManager.up()).rejects.toThrow('Simulated error');

      // Verify transaction was rolled back
      const status = await migrationManager.status();
      expect(status.find(s => s.name === '031_error_test')?.executed).toBe(false);
    });
  });

  describe('Validation and Security', () => {
    test('should validate table name', async () => {
      class InvalidTableName extends Migration {
        async up(): Promise<void> {
          await this.createTable('invalid-table-name!', (table: TableBuilder) => {
            table.id();
          });
        }
        async down(): Promise<void> {}
      }

      const migration = new InvalidTableName(orm.getConnection());
      await expect(migration.up()).rejects.toThrow();
    });

    test('should validate column name', async () => {
      class InvalidColumnName extends Migration {
        async up(): Promise<void> {
          await this.addColumn('migration_test_users', 'invalid-column!', {
            type: 'string'
          });
        }
        async down(): Promise<void> {}
      }

      const migration = new InvalidColumnName(orm.getConnection());
      await expect(migration.up()).rejects.toThrow();
    });

    test('should reject SQL keywords as identifiers', async () => {
      class SQLKeywordMigration extends Migration {
        async up(): Promise<void> {
          await this.createTable('SELECT', (table: TableBuilder) => {
            table.id();
          });
        }
        async down(): Promise<void> {}
      }

      const migration = new SQLKeywordMigration(orm.getConnection());
      await expect(migration.up()).rejects.toThrow('reserved SQL keyword');
    });
  });
});
