/**
 * Integration Tests: End-to-End Database Workflows
 * Tests complete workflows combining multiple database operations
 */

import {
  ORM,
  Model,
  Schema,
  DatabaseConfig,
  Migration,
  Seeder,
  transaction
} from '../../../src/database/MEGA_DatabaseAbstraction';

describe('End-to-End Database Workflows', () => {
  let orm: ORM;

  beforeAll(async () => {
    const config: DatabaseConfig = {
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: 'test_e2e',
      username: 'test',
      password: 'test',
      logging: false
    };

    orm = new ORM(config);
    await orm.connect();
  });

  afterAll(async () => {
    await orm.disconnect();
  });

  describe('Complete User Management Workflow', () => {
    let User: typeof Model;
    let Post: typeof Model;
    let Comment: typeof Model;

    beforeAll(async () => {
      // Define models
      class UserModel extends Model {}
      class PostModel extends Model {}
      class CommentModel extends Model {}

      const userSchema: Schema = {
        table: 'e2e_users',
        columns: {
          id: { type: 'integer', primaryKey: true, autoIncrement: true },
          username: { type: 'string', length: 100, nullable: false, unique: true },
          email: { type: 'string', length: 255, nullable: false, unique: true },
          password_hash: { type: 'string', length: 255, nullable: false },
          status: { type: 'enum', enum: ['active', 'inactive', 'banned'], default: 'active' },
          created_at: { type: 'timestamp' },
          updated_at: { type: 'timestamp' }
        },
        timestamps: true
      };

      const postSchema: Schema = {
        table: 'e2e_posts',
        columns: {
          id: { type: 'integer', primaryKey: true, autoIncrement: true },
          user_id: { type: 'integer', nullable: false },
          title: { type: 'string', length: 255, nullable: false },
          content: { type: 'text' },
          published: { type: 'boolean', default: false },
          published_at: { type: 'timestamp', nullable: true },
          created_at: { type: 'timestamp' },
          updated_at: { type: 'timestamp' }
        },
        timestamps: true
      };

      const commentSchema: Schema = {
        table: 'e2e_comments',
        columns: {
          id: { type: 'integer', primaryKey: true, autoIncrement: true },
          post_id: { type: 'integer', nullable: false },
          user_id: { type: 'integer', nullable: false },
          content: { type: 'text', nullable: false },
          created_at: { type: 'timestamp' },
          updated_at: { type: 'timestamp' }
        },
        timestamps: true
      };

      orm.registerModel('E2EUser', UserModel, userSchema);
      orm.registerModel('E2EPost', PostModel, postSchema);
      orm.registerModel('E2EComment', CommentModel, commentSchema);

      User = orm.model('E2EUser');
      Post = orm.model('E2EPost');
      Comment = orm.model('E2EComment');
    });

    test('should complete full user registration workflow', async () => {
      // Step 1: Create user
      const user = await User.create({
        username: 'johndoe',
        email: 'john@example.com',
        password_hash: 'hashed_password_123',
        status: 'active'
      });

      expect(user.getAttribute('id')).toBeDefined();
      expect(user.getAttribute('username')).toBe('johndoe');

      // Step 2: Verify user can be found
      const foundUser = await User.find(user.getAttribute('id'));
      expect(foundUser).not.toBeNull();
      expect(foundUser?.getAttribute('email')).toBe('john@example.com');

      // Step 3: Update user profile
      foundUser?.setAttribute('status', 'active');
      await foundUser?.save();

      // Step 4: Query user by email
      const userByEmail = await User.query()
        .where('email', '=', 'john@example.com')
        .first();

      expect(userByEmail?.getAttribute('username')).toBe('johndoe');
    });

    test('should handle blog post creation and publishing workflow', async () => {
      // Create author
      const author = await User.create({
        username: 'blogger',
        email: 'blogger@example.com',
        password_hash: 'hashed_pass'
      });

      // Create draft post
      const post = await Post.create({
        user_id: author.getAttribute('id'),
        title: 'My First Blog Post',
        content: 'This is the content of my first blog post.',
        published: false
      });

      expect(post.getAttribute('published')).toBe(false);
      expect(post.getAttribute('published_at')).toBeNull();

      // Publish post
      post.setAttribute('published', true);
      post.setAttribute('published_at', new Date());
      await post.save();

      // Verify publication
      const publishedPost = await Post.find(post.getAttribute('id'));
      expect(publishedPost?.getAttribute('published')).toBe(true);
      expect(publishedPost?.getAttribute('published_at')).toBeDefined();
    });

    test('should handle comment thread workflow', async () => {
      // Create user and post
      const user = await User.create({
        username: 'commenter',
        email: 'commenter@example.com',
        password_hash: 'hash'
      });

      const post = await Post.create({
        user_id: user.getAttribute('id'),
        title: 'Discussion Post',
        content: 'Let\'s discuss!',
        published: true
      });

      // Add multiple comments
      const comments = await Promise.all([
        Comment.create({
          post_id: post.getAttribute('id'),
          user_id: user.getAttribute('id'),
          content: 'First comment'
        }),
        Comment.create({
          post_id: post.getAttribute('id'),
          user_id: user.getAttribute('id'),
          content: 'Second comment'
        }),
        Comment.create({
          post_id: post.getAttribute('id'),
          user_id: user.getAttribute('id'),
          content: 'Third comment'
        })
      ]);

      // Query all comments for post
      const postComments = await Comment.query()
        .where('post_id', '=', post.getAttribute('id'))
        .orderBy('created_at', 'ASC')
        .get();

      expect(postComments.length).toBe(3);
      expect(postComments[0].getAttribute('content')).toBe('First comment');
    });

    test('should handle user deactivation workflow', async () => {
      const user = await User.create({
        username: 'deactivate_test',
        email: 'deactivate@example.com',
        password_hash: 'hash',
        status: 'active'
      });

      // Deactivate user
      user.setAttribute('status', 'inactive');
      await user.save();

      // Verify deactivation
      const deactivated = await User.find(user.getAttribute('id'));
      expect(deactivated?.getAttribute('status')).toBe('inactive');

      // Query only active users
      const activeUsers = await User.query()
        .where('status', '=', 'active')
        .get();

      const userIds = activeUsers.map(u => u.getAttribute('id'));
      expect(userIds).not.toContain(user.getAttribute('id'));
    });
  });

  describe('E-commerce Order Processing Workflow', () => {
    let Customer: typeof Model;
    let Order: typeof Model;
    let OrderItem: typeof Model;

    beforeAll(() => {
      class CustomerModel extends Model {}
      class OrderModel extends Model {}
      class OrderItemModel extends Model {}

      orm.registerModel('E2ECustomer', CustomerModel, {
        table: 'e2e_customers',
        columns: {
          id: { type: 'integer', primaryKey: true, autoIncrement: true },
          name: { type: 'string', length: 255 },
          email: { type: 'string', length: 255, unique: true },
          total_orders: { type: 'integer', default: 0 },
          total_spent: { type: 'decimal', precision: 10, scale: 2, default: 0 }
        },
        timestamps: true
      });

      orm.registerModel('E2EOrder', OrderModel, {
        table: 'e2e_orders',
        columns: {
          id: { type: 'integer', primaryKey: true, autoIncrement: true },
          customer_id: { type: 'integer', nullable: false },
          status: { type: 'enum', enum: ['pending', 'processing', 'completed', 'cancelled'], default: 'pending' },
          total_amount: { type: 'decimal', precision: 10, scale: 2, default: 0 },
          created_at: { type: 'timestamp' }
        },
        timestamps: true
      });

      orm.registerModel('E2EOrderItem', OrderItemModel, {
        table: 'e2e_order_items',
        columns: {
          id: { type: 'integer', primaryKey: true, autoIncrement: true },
          order_id: { type: 'integer', nullable: false },
          product_name: { type: 'string', length: 255 },
          quantity: { type: 'integer', nullable: false },
          price: { type: 'decimal', precision: 10, scale: 2, nullable: false }
        }
      });

      Customer = orm.model('E2ECustomer');
      Order = orm.model('E2EOrder');
      OrderItem = orm.model('E2EOrderItem');
    });

    test('should process complete order with transaction', async () => {
      const result = await orm.transaction(async () => {
        // Step 1: Create or get customer
        const customer = await Customer.create({
          name: 'Jane Smith',
          email: 'jane@example.com'
        });

        // Step 2: Create order
        const order = await Order.create({
          customer_id: customer.getAttribute('id'),
          status: 'pending',
          total_amount: 0
        });

        // Step 3: Add order items
        const items = await Promise.all([
          OrderItem.create({
            order_id: order.getAttribute('id'),
            product_name: 'Widget A',
            quantity: 2,
            price: 29.99
          }),
          OrderItem.create({
            order_id: order.getAttribute('id'),
            product_name: 'Widget B',
            quantity: 1,
            price: 49.99
          })
        ]);

        // Step 4: Calculate total
        const total = items.reduce(
          (sum, item) =>
            sum + item.getAttribute('quantity') * item.getAttribute('price'),
          0
        );

        // Step 5: Update order total
        order.setAttribute('total_amount', total);
        order.setAttribute('status', 'processing');
        await order.save();

        // Step 6: Update customer statistics
        customer.setAttribute('total_orders', customer.getAttribute('total_orders') + 1);
        customer.setAttribute('total_spent', customer.getAttribute('total_spent') + total);
        await customer.save();

        return { customer, order, items, total };
      });

      expect(result.order.getAttribute('status')).toBe('processing');
      expect(result.total).toBe(109.97);
      expect(result.customer.getAttribute('total_orders')).toBe(1);
    });

    test('should rollback order on payment failure', async () => {
      const initialOrders = await Order.query().count();

      await expect(
        orm.transaction(async () => {
          const customer = await Customer.create({
            name: 'Failed Payment',
            email: 'failed@example.com'
          });

          const order = await Order.create({
            customer_id: customer.getAttribute('id'),
            status: 'pending',
            total_amount: 100
          });

          // Simulate payment failure
          throw new Error('Payment processing failed');
        })
      ).rejects.toThrow('Payment processing failed');

      const finalOrders = await Order.query().count();
      expect(finalOrders).toBe(initialOrders);
    });

    test('should handle order cancellation workflow', async () => {
      const customer = await Customer.create({
        name: 'Cancel Test',
        email: 'cancel@example.com'
      });

      const order = await Order.create({
        customer_id: customer.getAttribute('id'),
        status: 'pending',
        total_amount: 50
      });

      // Cancel order
      order.setAttribute('status', 'cancelled');
      await order.save();

      const cancelled = await Order.find(order.getAttribute('id'));
      expect(cancelled?.getAttribute('status')).toBe('cancelled');
    });

    test('should generate order report', async () => {
      // Create test data
      const customer = await Customer.create({
        name: 'Report Test',
        email: 'report@example.com'
      });

      await Promise.all([
        Order.create({
          customer_id: customer.getAttribute('id'),
          status: 'completed',
          total_amount: 100
        }),
        Order.create({
          customer_id: customer.getAttribute('id'),
          status: 'completed',
          total_amount: 150
        }),
        Order.create({
          customer_id: customer.getAttribute('id'),
          status: 'pending',
          total_amount: 75
        })
      ]);

      // Generate report
      const completedOrders = await Order.query()
        .where('customer_id', '=', customer.getAttribute('id'))
        .where('status', '=', 'completed')
        .get();

      const totalRevenue = completedOrders.reduce(
        (sum, order) => sum + parseFloat(order.getAttribute('total_amount')),
        0
      );

      expect(completedOrders.length).toBe(2);
      expect(totalRevenue).toBe(250);
    });
  });

  describe('Data Migration and Seeding Workflow', () => {
    test('should seed database with test data', async () => {
      class TestSeeder extends Seeder {
        async run(): Promise<void> {
          const User = this.connection['orm']?.model('E2EUser');

          if (User) {
            await User.createMany([
              { username: 'seed1', email: 'seed1@example.com', password_hash: 'hash' },
              { username: 'seed2', email: 'seed2@example.com', password_hash: 'hash' },
              { username: 'seed3', email: 'seed3@example.com', password_hash: 'hash' }
            ]);
          }
        }
      }

      const seederManager = orm.seeders();
      const connection = orm.getConnection();
      connection['orm'] = orm;

      seederManager.register('test_seeder', new TestSeeder(connection));

      await expect(seederManager.run(['test_seeder'])).resolves.not.toThrow();
    });
  });

  describe('Complex Query Workflows', () => {
    let Product: typeof Model;

    beforeAll(() => {
      class ProductModel extends Model {}

      orm.registerModel('E2EProduct', ProductModel, {
        table: 'e2e_products',
        columns: {
          id: { type: 'integer', primaryKey: true, autoIncrement: true },
          name: { type: 'string', length: 255 },
          category: { type: 'string', length: 100 },
          price: { type: 'decimal', precision: 10, scale: 2 },
          stock: { type: 'integer', default: 0 },
          rating: { type: 'float', nullable: true },
          active: { type: 'boolean', default: true }
        }
      });

      Product = orm.model('E2EProduct');
    });

    test('should execute complex filtering workflow', async () => {
      // Seed products
      await Product.createMany([
        { name: 'Product A', category: 'Electronics', price: 299.99, stock: 10, rating: 4.5, active: true },
        { name: 'Product B', category: 'Electronics', price: 199.99, stock: 5, rating: 4.0, active: true },
        { name: 'Product C', category: 'Books', price: 29.99, stock: 50, rating: 4.8, active: true },
        { name: 'Product D', category: 'Electronics', price: 499.99, stock: 0, rating: 3.5, active: false }
      ]);

      // Complex query: Active electronics, price < 300, in stock, rating > 4.0
      const results = await Product.query()
        .where('category', '=', 'Electronics')
        .where('active', '=', true)
        .where('price', '<', 300)
        .where('stock', '>', 0)
        .where('rating', '>', 4.0)
        .orderBy('rating', 'DESC')
        .get();

      expect(results.length).toBeGreaterThan(0);
      results.forEach(product => {
        expect(product.getAttribute('category')).toBe('Electronics');
        expect(product.getAttribute('active')).toBe(true);
        expect(product.getAttribute('price')).toBeLessThan(300);
        expect(product.getAttribute('stock')).toBeGreaterThan(0);
      });
    });

    test('should paginate search results', async () => {
      // Create many products
      const products = Array.from({ length: 25 }, (_, i) => ({
        name: `Search Product ${i}`,
        category: 'Search',
        price: 10 + i,
        stock: i,
        active: true
      }));

      await Product.createMany(products);

      // Paginate results
      const page1 = await Product.query()
        .where('category', '=', 'Search')
        .paginate(1, 10);

      const page2 = await Product.query()
        .where('category', '=', 'Search')
        .paginate(2, 10);

      expect(page1.data).toHaveLength(10);
      expect(page2.data).toHaveLength(10);
      expect(page1.currentPage).toBe(1);
      expect(page2.currentPage).toBe(2);
      expect(page1.total).toBeGreaterThanOrEqual(25);
    });

    test('should perform batch update workflow', async () => {
      // Create products
      await Product.createMany([
        { name: 'Batch 1', category: 'Batch', price: 100, active: true },
        { name: 'Batch 2', category: 'Batch', price: 150, active: true },
        { name: 'Batch 3', category: 'Batch', price: 200, active: true }
      ]);

      // Get all batch products
      const batchProducts = await Product.query()
        .where('category', '=', 'Batch')
        .get();

      // Update all
      await Promise.all(
        batchProducts.map(async product => {
          product.setAttribute('price', product.getAttribute('price') * 0.9); // 10% discount
          return product.save();
        })
      );

      // Verify updates
      const updated = await Product.query()
        .where('category', '=', 'Batch')
        .get();

      updated.forEach(product => {
        expect(product.getAttribute('price')).toBeLessThan(200);
      });
    });
  });

  describe('Error Recovery Workflow', () => {
    test('should recover from failed operations', async () => {
      const User = orm.model('E2EUser');

      const operations = [];

      for (let i = 0; i < 10; i++) {
        operations.push(
          (async () => {
            try {
              return await User.create({
                username: `recovery_${i}`,
                email: `recovery_${i}@example.com`,
                password_hash: 'hash'
              });
            } catch (error) {
              // Some might fail due to unique constraints
              return null;
            }
          })()
        );
      }

      const results = await Promise.all(operations);
      const successful = results.filter(r => r !== null);

      expect(successful.length).toBeGreaterThan(0);
    });

    test('should handle partial transaction success', async () => {
      const Customer = orm.model('E2ECustomer');
      const Order = orm.model('E2EOrder');

      let createdCustomer: any = null;

      try {
        await orm.transaction(async () => {
          createdCustomer = await Customer.create({
            name: 'Partial Test',
            email: 'partial@example.com'
          });

          await Order.create({
            customer_id: createdCustomer.getAttribute('id'),
            status: 'pending',
            total_amount: 100
          });

          throw new Error('Simulated failure');
        });
      } catch (error) {
        // Transaction should rollback
      }

      // Verify rollback
      if (createdCustomer) {
        const customer = await Customer.find(createdCustomer.getAttribute('id'));
        expect(customer).toBeNull();
      }
    });
  });
});
