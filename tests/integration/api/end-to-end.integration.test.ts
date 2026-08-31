/**
 * Comprehensive End-to-End Integration Tests
 * Demonstrates complete system integration with all modules working together
 */

import { APIGateway, APIRequest, HTTPMethod, ValidationSchemas } from '../../../src/api/APIGateway';
import { DatabasePoolManager, DatabaseConfig, DatabaseType } from '../../../src/database/DatabasePoolManager';
import {
  AuthenticationSystem,
  RBACSystem,
  AuditLogger,
} from '../../../src/security/MEGA_SecurityAuthentication';
import { eventBus } from '../../../src/core/EventBus';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'fs';

describe('Comprehensive End-to-End Integration Tests', () => {
  let gateway: APIGateway;
  let dbManager: DatabasePoolManager;
  let authSystem: AuthenticationSystem;
  let rbacSystem: RBACSystem;
  let auditLogger: AuditLogger;
  let testDir: string;
  let testDbPath: string;

  beforeAll(() => {
    testDir = join(tmpdir(), `e2e-test-${Date.now()}`);
    testDbPath = join(testDir, 'databases');

    try {
      mkdirSync(testDir, { recursive: true });
      mkdirSync(testDbPath, { recursive: true });
    } catch (error) {
      // Directories might exist
    }
  });

  afterAll(() => {
    try {
      rmSync(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  beforeEach(async () => {
    authSystem = new AuthenticationSystem();
    rbacSystem = new RBACSystem();
    auditLogger = new AuditLogger();
    gateway = new APIGateway(authSystem, rbacSystem, auditLogger, {
      enableErrorHandling: true,
      errorHandlingOptions: {
        timeout: 10000,
        retry: { maxAttempts: 3, initialDelay: 100 },
        includeStackTrace: false,
        enableCircuitBreaker: true,
        enableRecovery: true,
      },
    });
    dbManager = new DatabasePoolManager();
  });

  afterEach(async () => {
    await dbManager.closeAll();
    eventBus.removeAllListeners();
  });

  describe('Complete E-Commerce API System', () => {
    it('should handle full e-commerce flow: user registration → product creation → order placement', async () => {
      const dbPath = join(testDbPath, 'ecommerce.db');

      // Setup database
      const dbConfig: DatabaseConfig = {
        id: 'ecommerce-db',
        type: 'sqlite' as DatabaseType,
        host: dbPath,
        port: 0,
        database: dbPath,
        username: '',
        password: '',
        poolConfig: {
          min: 2,
          max: 10,
        },
      };

      await dbManager.addDatabase(dbConfig);

      // Create tables
      await dbManager.query('ecommerce-db', {
        text: 'CREATE TABLE products (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, price REAL, stock INTEGER)',
        values: [],
      });

      await dbManager.query('ecommerce-db', {
        text: 'CREATE TABLE orders (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT, product_id INTEGER, quantity INTEGER, total REAL, status TEXT, created_at INTEGER)',
        values: [],
      });

      await dbManager.query('ecommerce-db', {
        text: 'CREATE TABLE order_events (id INTEGER PRIMARY KEY AUTOINCREMENT, order_id INTEGER, event_type TEXT, data TEXT, timestamp INTEGER)',
        values: [],
      });

      // Setup roles
      rbacSystem.createRole('customer', 'Customer role', []);
      rbacSystem.createRole('admin', 'Administrator role', []);

      // Setup event listeners for order tracking
      eventBus.on('order.placed', async (data) => {
        await dbManager.query('ecommerce-db', {
          text: 'INSERT INTO order_events (order_id, event_type, data, timestamp) VALUES (?, ?, ?, ?)',
          values: [data.orderId, 'placed', JSON.stringify(data), Date.now()],
        });
      });

      // 1. REGISTER ADMIN USER
      const admin = await authSystem.register({
        username: 'admin',
        email: 'admin@shop.com',
        password: 'AdminPass123!',
      });
      rbacSystem.assignRole(admin.id, 'admin');
      const adminSession = await authSystem.login('admin', 'AdminPass123!');

      // 2. REGISTER CUSTOMER
      const customer = await authSystem.register({
        username: 'customer',
        email: 'customer@shop.com',
        password: 'CustomerPass123!',
      });
      rbacSystem.assignRole(customer.id, 'customer');
      const customerSession = await authSystem.login('customer', 'CustomerPass123!');

      // 3. ADMIN CREATES PRODUCT
      gateway.registerEndpoint({
        path: '/api/admin/products',
        method: HTTPMethod.POST,
        handler: async (request) => {
          const { name, price, stock } = request.body;

          const result = await dbManager.query('ecommerce-db', {
            text: 'INSERT INTO products (name, price, stock) VALUES (?, ?, ?)',
            values: [name, price, stock],
          });

          return {
            statusCode: 201,
            headers: { 'Content-Type': 'application/json' },
            body: {
              id: result.rows[0]?.lastID || 1,
              name,
              price,
              stock,
            },
          };
        },
        middleware: [],
        authentication: { type: 'bearer', required: true },
        authorization: { roles: ['admin'] },
        validation: {
          body: {
            type: 'object',
            properties: {
              name: ValidationSchemas.string(1, 255),
              price: ValidationSchemas.integer(0, 1000000),
              stock: ValidationSchemas.integer(0, 100000),
            },
            required: ['name', 'price', 'stock'],
          },
        },
        tags: ['admin', 'products'],
      });

      const createProductRequest: APIRequest = {
        method: HTTPMethod.POST,
        path: '/api/admin/products',
        headers: { authorization: `Bearer ${adminSession.token}` },
        query: {},
        params: {},
        body: {
          name: 'Gaming Laptop',
          price: 1299.99,
          stock: 10,
        },
        ip: '192.168.1.100',
        userAgent: 'Admin-Dashboard',
      };

      const productResponse = await gateway.handleRequest(createProductRequest);
      expect(productResponse.statusCode).toBe(201);
      const productId = productResponse.body.id;

      // 4. CUSTOMER VIEWS PRODUCTS
      gateway.registerEndpoint({
        path: '/api/products',
        method: HTTPMethod.GET,
        handler: async () => {
          const result = await dbManager.query('ecommerce-db', {
            text: 'SELECT * FROM products WHERE stock > 0',
            values: [],
          });

          return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: { products: result.rows },
          };
        },
        middleware: [],
        caching: {
          enabled: true,
          ttl: 5000,
        },
        tags: ['products'],
      });

      const viewProductsRequest: APIRequest = {
        method: HTTPMethod.GET,
        path: '/api/products',
        headers: {},
        query: {},
        params: {},
        body: null,
        ip: '192.168.1.50',
      };

      const productsResponse = await gateway.handleRequest(viewProductsRequest);
      expect(productsResponse.statusCode).toBe(200);
      expect(productsResponse.body.products.length).toBeGreaterThan(0);

      // 5. CUSTOMER PLACES ORDER (with transaction)
      gateway.registerEndpoint({
        path: '/api/orders',
        method: HTTPMethod.POST,
        handler: async (request) => {
          const authUser = (request as any).user;
          const { productId, quantity } = request.body;

          try {
            const orderId = await dbManager.transaction('ecommerce-db', async (client) => {
              // Check product availability
              const product = await client.query({
                text: 'SELECT * FROM products WHERE id = ?',
                values: [productId],
              });

              if (product.rowCount === 0) {
                throw new Error('Product not found');
              }

              if (product.rows[0].stock < quantity) {
                throw new Error('Insufficient stock');
              }

              const total = product.rows[0].price * quantity;

              // Create order
              const orderResult = await client.query({
                text: 'INSERT INTO orders (user_id, product_id, quantity, total, status, created_at) VALUES (?, ?, ?, ?, ?, ?)',
                values: [authUser.id, productId, quantity, total, 'pending', Date.now()],
              });

              const orderId = orderResult.rows[0]?.lastID || 1;

              // Update stock
              await client.query({
                text: 'UPDATE products SET stock = stock - ? WHERE id = ?',
                values: [quantity, productId],
              });

              return orderId;
            });

            // Emit event
            eventBus.emitSync('order.placed', {
              orderId,
              userId: authUser.id,
              productId,
              quantity,
            }, 'OrderService');

            return {
              statusCode: 201,
              headers: { 'Content-Type': 'application/json' },
              body: {
                orderId,
                status: 'pending',
                message: 'Order placed successfully',
              },
            };
          } catch (error) {
            return {
              statusCode: 400,
              headers: { 'Content-Type': 'application/json' },
              body: {
                error: error instanceof Error ? error.message : 'Order failed',
              },
            };
          }
        },
        middleware: [],
        authentication: { type: 'bearer', required: true },
        authorization: { roles: ['customer', 'admin'] },
        validation: {
          body: {
            type: 'object',
            properties: {
              productId: ValidationSchemas.integer(1),
              quantity: ValidationSchemas.integer(1, 100),
            },
            required: ['productId', 'quantity'],
          },
        },
        tags: ['orders'],
      });

      const placeOrderRequest: APIRequest = {
        method: HTTPMethod.POST,
        path: '/api/orders',
        headers: { authorization: `Bearer ${customerSession.token}` },
        query: {},
        params: {},
        body: {
          productId,
          quantity: 2,
        },
        ip: '192.168.1.50',
        userAgent: 'Customer-App',
      };

      const orderResponse = await gateway.handleRequest(placeOrderRequest);
      expect(orderResponse.statusCode).toBe(201);
      expect(orderResponse.body.orderId).toBeDefined();

      // 6. VERIFY ORDER IN DATABASE
      const orderCheck = await dbManager.query('ecommerce-db', {
        text: 'SELECT * FROM orders WHERE id = ?',
        values: [orderResponse.body.orderId],
      });

      expect(orderCheck.rowCount).toBe(1);
      expect(orderCheck.rows[0].user_id).toBe(customer.id);
      expect(orderCheck.rows[0].status).toBe('pending');

      // 7. VERIFY STOCK UPDATED
      const stockCheck = await dbManager.query('ecommerce-db', {
        text: 'SELECT stock FROM products WHERE id = ?',
        values: [productId],
      });

      expect(stockCheck.rows[0].stock).toBe(8); // 10 - 2

      // 8. VERIFY EVENT LOGGED
      await new Promise(resolve => setTimeout(resolve, 100));

      const eventCheck = await dbManager.query('ecommerce-db', {
        text: 'SELECT * FROM order_events WHERE order_id = ?',
        values: [orderResponse.body.orderId],
      });

      expect(eventCheck.rowCount).toBeGreaterThan(0);

      // 9. VERIFY AUDIT LOGS
      const auditLogs = auditLogger.getRecentLogs();
      expect(auditLogs.length).toBeGreaterThan(0);

      const loginLogs = auditLogs.filter(log => log.action === 'login');
      expect(loginLogs.length).toBeGreaterThanOrEqual(2); // Admin + Customer

      const accessLogs = auditLogs.filter(log => log.action === 'access');
      expect(accessLogs.length).toBeGreaterThan(0);

      // 10. VERIFY METRICS
      const metrics = gateway.getMetrics();
      expect(metrics.length).toBeGreaterThan(0);

      const orderMetrics = metrics.find(m => m.endpoint === '/api/orders');
      expect(orderMetrics).toBeDefined();
      expect(orderMetrics!.requestCount).toBeGreaterThan(0);
    });

    it('should handle concurrent orders with proper stock management', async () => {
      const dbPath = join(testDbPath, 'concurrent-orders.db');

      const dbConfig: DatabaseConfig = {
        id: 'concurrent-db',
        type: 'sqlite' as DatabaseType,
        host: dbPath,
        port: 0,
        database: dbPath,
        username: '',
        password: '',
        poolConfig: {
          min: 5,
          max: 20,
        },
      };

      await dbManager.addDatabase(dbConfig);

      await dbManager.query('concurrent-db', {
        text: 'CREATE TABLE products (id INTEGER PRIMARY KEY, stock INTEGER)',
        values: [],
      });

      await dbManager.query('concurrent-db', {
        text: 'INSERT INTO products (id, stock) VALUES (1, 10)',
        values: [],
      });

      await dbManager.query('concurrent-db', {
        text: 'CREATE TABLE orders (id INTEGER PRIMARY KEY AUTOINCREMENT, product_id INTEGER, quantity INTEGER)',
        values: [],
      });

      const customer = await authSystem.register({
        username: 'concurrent-user',
        email: 'concurrent@example.com',
        password: 'Pass123!',
      });
      const session = await authSystem.login('concurrent-user', 'Pass123!');

      gateway.registerEndpoint({
        path: '/api/purchase',
        method: HTTPMethod.POST,
        handler: async (request) => {
          const { quantity } = request.body;

          try {
            await dbManager.transaction('concurrent-db', async (client) => {
              const product = await client.query({
                text: 'SELECT stock FROM products WHERE id = 1',
                values: [],
              });

              if (product.rows[0].stock < quantity) {
                throw new Error('Insufficient stock');
              }

              await client.query({
                text: 'UPDATE products SET stock = stock - ? WHERE id = 1',
                values: [quantity],
              });

              await client.query({
                text: 'INSERT INTO orders (product_id, quantity) VALUES (1, ?)',
                values: [quantity],
              });
            });

            return {
              statusCode: 200,
              headers: {},
              body: { success: true },
            };
          } catch (error) {
            return {
              statusCode: 400,
              headers: {},
              body: { error: error instanceof Error ? error.message : 'Failed' },
            };
          }
        },
        middleware: [],
        authentication: { type: 'bearer', required: true },
        tags: ['purchase'],
      });

      // 20 concurrent purchase attempts for 1 item each
      const requests = Array.from({ length: 20 }, () => {
        const request: APIRequest = {
          method: HTTPMethod.POST,
          path: '/api/purchase',
          headers: { authorization: `Bearer ${session.token}` },
          query: {},
          params: {},
          body: { quantity: 1 },
          ip: '192.168.1.1',
        };
        return gateway.handleRequest(request);
      });

      const responses = await Promise.all(requests);

      const successCount = responses.filter(r => r.statusCode === 200).length;
      const failCount = responses.filter(r => r.statusCode === 400).length;

      // Exactly 10 should succeed, 10 should fail
      expect(successCount).toBe(10);
      expect(failCount).toBe(10);

      // Verify final stock is 0
      const finalStock = await dbManager.query('concurrent-db', {
        text: 'SELECT stock FROM products WHERE id = 1',
        values: [],
      });

      expect(finalStock.rows[0].stock).toBe(0);

      // Verify exactly 10 orders were created
      const orderCount = await dbManager.query('concurrent-db', {
        text: 'SELECT COUNT(*) as count FROM orders',
        values: [],
      });

      expect(orderCount.rows[0].count).toBe(10);
    });

    it('should handle complete file upload → database storage → retrieval flow', async () => {
      const dbPath = join(testDbPath, 'files.db');
      const uploadDir = join(testDir, 'uploads');
      mkdirSync(uploadDir, { recursive: true });

      const dbConfig: DatabaseConfig = {
        id: 'files-db',
        type: 'sqlite' as DatabaseType,
        host: dbPath,
        port: 0,
        database: dbPath,
        username: '',
        password: '',
      };

      await dbManager.addDatabase(dbConfig);

      await dbManager.query('files-db', {
        text: 'CREATE TABLE files (id INTEGER PRIMARY KEY AUTOINCREMENT, filename TEXT, path TEXT, size INTEGER, user_id TEXT, uploaded_at INTEGER)',
        values: [],
      });

      const user = await authSystem.register({
        username: 'uploader',
        email: 'uploader@example.com',
        password: 'Pass123!',
      });
      const session = await authSystem.login('uploader', 'Pass123!');

      // Upload endpoint
      gateway.registerEndpoint({
        path: '/api/files/upload',
        method: HTTPMethod.POST,
        handler: async (request) => {
          const authUser = (request as any).user;
          const { filename, content } = request.body;

          const filepath = join(uploadDir, `${Date.now()}-${filename}`);
          writeFileSync(filepath, content);

          const fileResult = await dbManager.query('files-db', {
            text: 'INSERT INTO files (filename, path, size, user_id, uploaded_at) VALUES (?, ?, ?, ?, ?)',
            values: [filename, filepath, content.length, authUser.id, Date.now()],
          });

          return {
            statusCode: 201,
            headers: {},
            body: {
              fileId: fileResult.rows[0]?.lastID || 1,
              filename,
              size: content.length,
            },
          };
        },
        middleware: [],
        authentication: { type: 'bearer', required: true },
        tags: ['files'],
      });

      // Download endpoint
      gateway.registerEndpoint({
        path: '/api/files/:fileId',
        method: HTTPMethod.GET,
        handler: async (request) => {
          const authUser = (request as any).user;
          const { fileId } = request.params;

          const fileRecord = await dbManager.query('files-db', {
            text: 'SELECT * FROM files WHERE id = ? AND user_id = ?',
            values: [fileId, authUser.id],
          });

          if (fileRecord.rowCount === 0) {
            return {
              statusCode: 404,
              headers: {},
              body: { error: 'File not found' },
            };
          }

          const content = readFileSync(fileRecord.rows[0].path, 'utf-8');

          return {
            statusCode: 200,
            headers: { 'Content-Type': 'text/plain' },
            body: content,
          };
        },
        middleware: [],
        authentication: { type: 'bearer', required: true },
        tags: ['files'],
      });

      // Upload file
      const uploadRequest: APIRequest = {
        method: HTTPMethod.POST,
        path: '/api/files/upload',
        headers: { authorization: `Bearer ${session.token}` },
        query: {},
        params: {},
        body: {
          filename: 'document.txt',
          content: 'Important document content',
        },
        ip: '192.168.1.1',
      };

      const uploadResponse = await gateway.handleRequest(uploadRequest);
      expect(uploadResponse.statusCode).toBe(201);
      const fileId = uploadResponse.body.fileId;

      // Download file
      const downloadRequest: APIRequest = {
        method: HTTPMethod.GET,
        path: `/api/files/${fileId}`,
        headers: { authorization: `Bearer ${session.token}` },
        query: {},
        params: {},
        body: null,
        ip: '192.168.1.1',
      };

      const downloadResponse = await gateway.handleRequest(downloadRequest);
      expect(downloadResponse.statusCode).toBe(200);
      expect(downloadResponse.body).toBe('Important document content');

      // Verify file exists
      const fileCheck = await dbManager.query('files-db', {
        text: 'SELECT * FROM files WHERE id = ?',
        values: [fileId],
      });

      expect(fileCheck.rowCount).toBe(1);
      expect(existsSync(fileCheck.rows[0].path)).toBe(true);
    });
  });
});
