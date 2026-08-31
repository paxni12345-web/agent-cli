/**
 * Integration Tests: ORM Operations
 * Tests real database CRUD operations, relationships, and model interactions
 */

import {
  ORM,
  Model,
  Schema,
  DatabaseConfig,
  transaction
} from '../../../src/database/MEGA_DatabaseAbstraction';

describe('ORM Operations Integration', () => {
  let orm: ORM;
  let config: DatabaseConfig;

  beforeAll(async () => {
    config = {
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'test_orm',
      username: process.env.DB_USER || 'test',
      password: process.env.DB_PASSWORD || 'test',
      logging: false
    };

    orm = new ORM(config);
    await orm.connect();
  });

  afterAll(async () => {
    await orm.disconnect();
  });

  describe('Model Registration and Schema', () => {
    test('should register model with schema', () => {
      class User extends Model {}

      const userSchema: Schema = {
        table: 'users',
        columns: {
          id: { type: 'integer', primaryKey: true, autoIncrement: true },
          name: { type: 'string', length: 255, nullable: false },
          email: { type: 'string', length: 255, unique: true, nullable: false },
          age: { type: 'integer', nullable: true },
          created_at: { type: 'timestamp', nullable: true }
        },
        timestamps: true
      };

      orm.registerModel('User', User, userSchema);

      const UserModel = orm.model('User');
      expect(UserModel).toBe(User);
      expect(User.getTableName()).toBe('users');
    });

    test('should throw error for unregistered model', () => {
      expect(() => orm.model('NonExistent')).toThrow('not registered');
    });
  });

  describe('CRUD Operations', () => {
    let User: typeof Model;

    beforeAll(() => {
      class UserModel extends Model {}

      const schema: Schema = {
        table: 'test_users',
        columns: {
          id: { type: 'integer', primaryKey: true, autoIncrement: true },
          username: { type: 'string', length: 100, nullable: false },
          email: { type: 'string', length: 255, nullable: false },
          age: { type: 'integer', nullable: true },
          active: { type: 'boolean', default: true }
        },
        timestamps: true
      };

      orm.registerModel('TestUser', UserModel, schema);
      User = orm.model('TestUser');
    });

    test('should create new record', async () => {
      const user = await User.create({
        username: 'testuser',
        email: 'test@example.com',
        age: 25
      });

      expect(user.getAttribute('username')).toBe('testuser');
      expect(user.getAttribute('email')).toBe('test@example.com');
    });

    test('should find record by ID', async () => {
      const created = await User.create({
        username: 'findtest',
        email: 'find@example.com'
      });

      const found = await User.find(created.getAttribute('id'));

      expect(found).not.toBeNull();
      expect(found?.getAttribute('username')).toBe('findtest');
    });

    test('should find or fail', async () => {
      await expect(User.findOrFail(99999)).rejects.toThrow('not found');
    });

    test('should update existing record', async () => {
      const user = await User.create({
        username: 'updatetest',
        email: 'update@example.com',
        age: 30
      });

      user.setAttribute('age', 31);
      await user.save();

      expect(user.getAttribute('age')).toBe(31);
    });

    test('should delete record', async () => {
      const user = await User.create({
        username: 'deletetest',
        email: 'delete@example.com'
      });

      const userId = user.getAttribute('id');
      const deleted = await user.delete();

      expect(deleted).toBe(true);

      const found = await User.find(userId);
      expect(found).toBeNull();
    });

    test('should get all records', async () => {
      await User.create({ username: 'user1', email: 'user1@example.com' });
      await User.create({ username: 'user2', email: 'user2@example.com' });

      const users = await User.all();

      expect(Array.isArray(users)).toBe(true);
      expect(users.length).toBeGreaterThanOrEqual(2);
    });

    test('should query with where clause', async () => {
      await User.create({ username: 'alice', email: 'alice@example.com', age: 25 });
      await User.create({ username: 'bob', email: 'bob@example.com', age: 30 });

      const users = await User.where('age', '>', 25);

      expect(users.length).toBeGreaterThanOrEqual(1);
      expect(users.every(u => u.getAttribute('age') > 25)).toBe(true);
    });

    test('should create multiple records', async () => {
      const users = await User.createMany([
        { username: 'multi1', email: 'multi1@example.com' },
        { username: 'multi2', email: 'multi2@example.com' },
        { username: 'multi3', email: 'multi3@example.com' }
      ]);

      expect(users).toHaveLength(3);
    });

    test('should update or create', async () => {
      const user1 = await User.updateOrCreate(
        { email: 'updateorcreate@example.com' },
        { username: 'testuser', age: 20 }
      );

      expect(user1.getAttribute('age')).toBe(20);

      const user2 = await User.updateOrCreate(
        { email: 'updateorcreate@example.com' },
        { username: 'testuser', age: 21 }
      );

      expect(user2.getAttribute('age')).toBe(21);
    });
  });

  describe('Query Builder Integration', () => {
    let Product: typeof Model;

    beforeAll(() => {
      class ProductModel extends Model {}

      const schema: Schema = {
        table: 'test_products',
        columns: {
          id: { type: 'integer', primaryKey: true, autoIncrement: true },
          name: { type: 'string', length: 255 },
          price: { type: 'decimal', precision: 10, scale: 2 },
          category: { type: 'string', length: 100 },
          in_stock: { type: 'boolean', default: true }
        }
      };

      orm.registerModel('TestProduct', ProductModel, schema);
      Product = orm.model('TestProduct');
    });

    test('should build complex query with joins', async () => {
      const query = Product.query()
        .select('name', 'price', 'category')
        .where('price', '>', 100)
        .orderBy('price', 'DESC')
        .limit(10);

      const products = await query.get();
      expect(Array.isArray(products)).toBe(true);
    });

    test('should use whereIn clause', async () => {
      await Product.create({ name: 'Product A', price: 50, category: 'A' });
      await Product.create({ name: 'Product B', price: 75, category: 'B' });
      await Product.create({ name: 'Product C', price: 100, category: 'C' });

      const products = await Product.query()
        .whereIn('category', ['A', 'B'])
        .get();

      expect(products.length).toBeGreaterThanOrEqual(2);
    });

    test('should use whereNull and whereNotNull', async () => {
      const query1 = Product.query().whereNull('category');
      const query2 = Product.query().whereNotNull('category');

      await expect(query1.get()).resolves.toBeDefined();
      await expect(query2.get()).resolves.toBeDefined();
    });

    test('should use whereBetween', async () => {
      await Product.create({ name: 'Low', price: 10, category: 'test' });
      await Product.create({ name: 'Mid', price: 50, category: 'test' });
      await Product.create({ name: 'High', price: 100, category: 'test' });

      const products = await Product.query()
        .whereBetween('price', 25, 75)
        .get();

      expect(products.some(p => p.getAttribute('price') === 50)).toBe(true);
    });

    test('should count records', async () => {
      const count = await Product.query().count();
      expect(typeof count).toBe('number');
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test('should get first record', async () => {
      await Product.create({ name: 'First Test', price: 10, category: 'first' });

      const first = await Product.query()
        .where('category', '=', 'first')
        .first();

      expect(first).toBeDefined();
      expect(first?.getAttribute('category')).toBe('first');
    });

    test('should paginate results', async () => {
      // Create test data
      for (let i = 0; i < 15; i++) {
        await Product.create({
          name: `Paginate Product ${i}`,
          price: i * 10,
          category: 'paginate'
        });
      }

      const page1 = await Product.query()
        .where('category', '=', 'paginate')
        .paginate(1, 5);

      expect(page1.data).toHaveLength(5);
      expect(page1.currentPage).toBe(1);
      expect(page1.perPage).toBe(5);
      expect(page1.total).toBeGreaterThanOrEqual(15);
    });
  });

  describe('Transactions', () => {
    let Account: typeof Model;

    beforeAll(() => {
      class AccountModel extends Model {}

      const schema: Schema = {
        table: 'test_accounts',
        columns: {
          id: { type: 'integer', primaryKey: true, autoIncrement: true },
          name: { type: 'string', length: 100 },
          balance: { type: 'decimal', precision: 10, scale: 2 }
        }
      };

      orm.registerModel('TestAccount', AccountModel, schema);
      Account = orm.model('TestAccount');
    });

    test('should commit successful transaction', async () => {
      const result = await orm.transaction(async () => {
        const account = await Account.create({
          name: 'Transaction Test',
          balance: 1000
        });

        account.setAttribute('balance', 1500);
        await account.save();

        return account;
      });

      expect(result.getAttribute('balance')).toBe(1500);
    });

    test('should rollback failed transaction', async () => {
      const beforeCount = await Account.query().count();

      await expect(
        orm.transaction(async () => {
          await Account.create({
            name: 'Rollback Test',
            balance: 500
          });

          throw new Error('Force rollback');
        })
      ).rejects.toThrow('Force rollback');

      const afterCount = await Account.query().count();
      expect(afterCount).toBe(beforeCount);
    });

    test('should handle nested transactions', async () => {
      const connection = orm.getConnection();

      await connection.beginTransaction();

      try {
        await Account.create({
          name: 'Outer Transaction',
          balance: 100
        });

        await connection.beginTransaction();

        try {
          await Account.create({
            name: 'Inner Transaction',
            balance: 200
          });

          await connection.commit();
        } catch (error) {
          await connection.rollback();
        }

        await connection.commit();
      } catch (error) {
        await connection.rollback();
      }

      expect(connection.getTransactionDepth()).toBe(0);
    });
  });

  describe('Model Validation', () => {
    let ValidatedModel: typeof Model;

    beforeAll(() => {
      class TestValidatedModel extends Model {}

      const schema: Schema = {
        table: 'test_validated',
        columns: {
          id: { type: 'integer', primaryKey: true, autoIncrement: true },
          email: {
            type: 'string',
            length: 255,
            nullable: false,
            validate: (value: any) => {
              const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
              return emailRegex.test(value);
            }
          },
          age: {
            type: 'integer',
            nullable: false,
            validate: (value: any) => value >= 0 && value <= 150
          },
          status: {
            type: 'enum',
            enum: ['active', 'inactive', 'pending']
          }
        }
      };

      orm.registerModel('TestValidated', TestValidatedModel, schema);
      ValidatedModel = orm.model('TestValidated');
    });

    test('should validate email format', async () => {
      await expect(
        ValidatedModel.create({
          email: 'invalid-email',
          age: 25,
          status: 'active'
        })
      ).rejects.toThrow('validation');
    });

    test('should validate age range', async () => {
      await expect(
        ValidatedModel.create({
          email: 'test@example.com',
          age: 200,
          status: 'active'
        })
      ).rejects.toThrow('validation');
    });

    test('should validate enum values', async () => {
      await expect(
        ValidatedModel.create({
          email: 'test@example.com',
          age: 25,
          status: 'invalid-status'
        })
      ).rejects.toThrow('validation');
    });

    test('should pass validation with correct data', async () => {
      const model = await ValidatedModel.create({
        email: 'valid@example.com',
        age: 25,
        status: 'active'
      });

      expect(model.getAttribute('email')).toBe('valid@example.com');
    });
  });

  describe('Model Serialization', () => {
    let SerializableModel: typeof Model;

    beforeAll(() => {
      class TestSerializableModel extends Model {}

      const schema: Schema = {
        table: 'test_serializable',
        columns: {
          id: { type: 'integer', primaryKey: true, autoIncrement: true },
          name: { type: 'string', length: 100 },
          data: { type: 'json' },
          created_at: { type: 'timestamp' }
        }
      };

      orm.registerModel('TestSerializable', TestSerializableModel, schema);
      SerializableModel = orm.model('TestSerializable');
    });

    test('should serialize model to JSON', async () => {
      const model = await SerializableModel.create({
        name: 'Test',
        data: { key: 'value', nested: { prop: 123 } }
      });

      const json = model.toJSON();

      expect(json).toHaveProperty('id');
      expect(json).toHaveProperty('name');
      expect(json).toHaveProperty('data');
      expect(json.name).toBe('Test');
    });

    test('should handle JSON column types', async () => {
      const jsonData = {
        array: [1, 2, 3],
        object: { nested: true },
        string: 'value'
      };

      const model = await SerializableModel.create({
        name: 'JSON Test',
        data: jsonData
      });

      const retrieved = await SerializableModel.find(model.getAttribute('id'));
      expect(retrieved).toBeDefined();
    });
  });

  describe('Dirty Tracking', () => {
    let TrackingModel: typeof Model;

    beforeAll(() => {
      class TestTrackingModel extends Model {}

      const schema: Schema = {
        table: 'test_tracking',
        columns: {
          id: { type: 'integer', primaryKey: true, autoIncrement: true },
          name: { type: 'string', length: 100 },
          value: { type: 'integer' }
        }
      };

      orm.registerModel('TestTracking', TestTrackingModel, schema);
      TrackingModel = orm.model('TestTracking');
    });

    test('should track dirty attributes', async () => {
      const model = await TrackingModel.create({
        name: 'Original',
        value: 100
      });

      expect(model.isDirty()).toBe(false);

      model.setAttribute('name', 'Modified');
      expect(model.isDirty()).toBe(true);
      expect(model.isDirty('name')).toBe(true);
      expect(model.isDirty('value')).toBe(false);
    });

    test('should get original values', async () => {
      const model = await TrackingModel.create({
        name: 'Original',
        value: 100
      });

      model.setAttribute('name', 'Modified');

      expect(model.getOriginal('name')).toBe('Original');
      expect(model.getAttribute('name')).toBe('Modified');
    });

    test('should clear dirty state after save', async () => {
      const model = await TrackingModel.create({
        name: 'Test',
        value: 50
      });

      model.setAttribute('value', 75);
      expect(model.isDirty()).toBe(true);

      await model.save();
      expect(model.isDirty()).toBe(false);
    });
  });

  describe('Model Refresh', () => {
    let RefreshModel: typeof Model;

    beforeAll(() => {
      class TestRefreshModel extends Model {}

      const schema: Schema = {
        table: 'test_refresh',
        columns: {
          id: { type: 'integer', primaryKey: true, autoIncrement: true },
          counter: { type: 'integer', default: 0 }
        }
      };

      orm.registerModel('TestRefresh', TestRefreshModel, schema);
      RefreshModel = orm.model('TestRefresh');
    });

    test('should refresh model from database', async () => {
      const model = await RefreshModel.create({ counter: 1 });

      // Simulate external update
      model.setAttribute('counter', 999);

      await model.refresh();

      // Should have database value, not local change
      expect(model.getAttribute('counter')).not.toBe(999);
    });

    test('should throw error when refreshing non-existent model', async () => {
      const model = new (RefreshModel as any)({ id: 99999 });
      model['exists'] = true;

      await expect(model.refresh()).rejects.toThrow();
    });
  });

  describe('Soft Deletes', () => {
    let SoftDeleteModel: typeof Model;

    beforeAll(() => {
      class TestSoftDeleteModel extends Model {}

      const schema: Schema = {
        table: 'test_soft_deletes',
        columns: {
          id: { type: 'integer', primaryKey: true, autoIncrement: true },
          name: { type: 'string', length: 100 },
          deleted_at: { type: 'timestamp', nullable: true }
        },
        softDeletes: true
      };

      orm.registerModel('TestSoftDelete', TestSoftDeleteModel, schema);
      SoftDeleteModel = orm.model('TestSoftDelete');
    });

    test('should soft delete model', async () => {
      const model = await SoftDeleteModel.create({ name: 'Soft Delete Test' });

      await model.delete();

      expect(model.getAttribute('deleted_at')).toBeDefined();
      expect(model.getAttribute('deleted_at')).toBeInstanceOf(Date);
    });
  });
});
