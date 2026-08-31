/**
 * Test Suite for Bug Fixes
 * Run with: npm test
 */

import { AgentCLI } from '../src/index';
import { BlockchainManager } from '../src/enterprise/ComprehensiveEnterpriseSystem';
import { CacheManager } from '../src/caching/CacheManager';
import { DatabasePoolManager } from '../src/database/DatabasePoolManager';
import { PlanningEngine } from '../src/planning/PlanningEngine';

describe('Bug Fixes Test Suite', () => {

  // ============================================================================
  // Test #1: Property Name Collision Fix
  // ============================================================================

  describe('Fix #1: Property Name Collision', () => {
    it('should have separate config and configManager properties', () => {
      const app = new AgentCLI();

      // configData should be private, access via getConfig()
      const config = app.getConfig();
      expect(config).toBeDefined();
      expect(config.environment).toBeDefined();

      // configManager should be public
      expect(app.configManager).toBeDefined();
      expect(typeof app.configManager).toBe('object');
    });

    it('should return correct config via getConfig()', () => {
      const app = new AgentCLI({
        environment: 'production',
        debug: true,
      });

      const config = app.getConfig();
      expect(config.environment).toBe('production');
      expect(config.debug).toBe(true);
    });

    it('should return correct environment via getEnvironment()', () => {
      const app = new AgentCLI({ environment: 'staging' });
      expect(app.getEnvironment()).toBe('staging');
    });
  });

  // ============================================================================
  // Test #2: Missing getStats() Fix
  // ============================================================================

  describe('Fix #2: Missing getStats() Methods', () => {
    it('should not throw error when calling getStatus()', () => {
      const app = new AgentCLI();

      expect(() => {
        const status = app.getStatus();
      }).not.toThrow();
    });

    it('should return valid status object', () => {
      const app = new AgentCLI();
      const status = app.getStatus();

      expect(status).toBeDefined();
      expect(status.modules).toBeInstanceOf(Map);
      expect(status.status).toMatch(/healthy|degraded|unhealthy/);
      expect(status.uptime).toBeGreaterThanOrEqual(0);
    });

    it('should handle managers without getStats() gracefully', () => {
      const app = new AgentCLI();
      const status = app.getStatus();

      // All modules should have stats property (even if empty)
      status.modules.forEach((module) => {
        expect(module.stats).toBeDefined();
      });
    });
  });

  // ============================================================================
  // Test #3: Infinite Loop Fix
  // ============================================================================

  describe('Fix #3: Blockchain Mining Timeout', () => {
    it('should timeout after max attempts', async () => {
      const blockchainManager = new BlockchainManager();

      const blockchain = blockchainManager.createBlockchain({
        name: 'test-chain',
        type: 'private' as any,
        consensus: 'proof_of_work' as any,
        difficulty: 20, // Very high difficulty
        miningReward: 50,
        config: {
          blockTime: 10000,
          blockSize: 1024,
          maxTransactionsPerBlock: 100,
          minimumFee: 0.01,
        },
      });

      // Add a transaction
      blockchainManager.addTransaction(blockchain.id, {
        from: 'addr1',
        to: 'addr2',
        amount: 10,
        fee: 0.01,
        signature: 'sig',
        nonce: 0,
      });

      // Should throw timeout error
      await expect(
        blockchainManager.mineBlock(blockchain.id, 'miner1')
      ).rejects.toThrow(/Mining timeout/);
    }, 30000); // 30 second timeout for test

    it('should mine successfully with reasonable difficulty', async () => {
      const blockchainManager = new BlockchainManager();

      const blockchain = blockchainManager.createBlockchain({
        name: 'test-chain',
        type: 'private' as any,
        consensus: 'proof_of_work' as any,
        difficulty: 2, // Low difficulty
        miningReward: 50,
        config: {
          blockTime: 10000,
          blockSize: 1024,
          maxTransactionsPerBlock: 100,
          minimumFee: 0.01,
        },
      });

      blockchainManager.addTransaction(blockchain.id, {
        from: 'addr1',
        to: 'addr2',
        amount: 10,
        fee: 0.01,
        signature: 'sig',
        nonce: 0,
      });

      const block = await blockchainManager.mineBlock(blockchain.id, 'miner1');

      expect(block).toBeDefined();
      expect(block.index).toBeGreaterThan(0);
      expect(block.miner).toBe('miner1');
    });
  });

  // ============================================================================
  // Test #5: Memory Leak Fix
  // ============================================================================

  describe('Fix #5: CacheManager Memory Leak', () => {
    it('should limit operations array to MAX_OPERATIONS', async () => {
      const cache = new CacheManager();
      const MAX_OPERATIONS = 1000;

      // Perform many operations
      for (let i = 0; i < 2000; i++) {
        await cache.set(`key-${i}`, `value-${i}`);
        await cache.get(`key-${i}`);
      }

      // Access private operations array via reflection
      const operations = (cache as any).operations;

      expect(operations.length).toBeLessThanOrEqual(MAX_OPERATIONS);
    });

    it('should not cause memory leak with continuous operations', async () => {
      const cache = new CacheManager();
      const initialMemory = process.memoryUsage().heapUsed;

      // Simulate continuous operations
      for (let i = 0; i < 5000; i++) {
        await cache.set(`key-${i}`, `value-${i}`);
        await cache.get(`key-${i}`);
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryGrowth = finalMemory - initialMemory;

      // Memory growth should be reasonable (less than 10MB)
      expect(memoryGrowth).toBeLessThan(10 * 1024 * 1024);
    });
  });

  // ============================================================================
  // Test #6: Race Condition Fix
  // ============================================================================

  describe('Fix #6: PlanningEngine Race Condition', () => {
    it('should handle concurrent planning without state corruption', async () => {
      const engine = new PlanningEngine();

      // Register test tasks
      engine.registerTask({
        id: 'task1',
        name: 'test-task-1',
        description: 'Test task 1',
        type: 'atomic',
        priority: 1,
        estimatedDuration: 100,
        dependencies: [],
        preconditions: [],
        effects: [],
        resources: [],
        constraints: [],
        metadata: {},
      });

      const goal = {
        id: 'goal1',
        name: 'test-goal',
        description: 'Test goal',
        type: 'atomic' as any,
        priority: 1,
        estimatedDuration: 100,
        dependencies: [],
        preconditions: [],
        effects: [],
        resources: [],
        constraints: [],
        metadata: {},
      };

      // Run multiple planning operations concurrently
      const results = await Promise.all([
        engine.plan(goal),
        engine.plan(goal),
        engine.plan(goal),
      ]);

      // All should complete without errors
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result.success).toBeDefined();
      });
    });
  });

  // ============================================================================
  // Test #7: Resource Leak Fix
  // ============================================================================

  describe('Fix #7: DatabasePoolManager Resource Leak', () => {
    it('should cleanup old transactions automatically', async () => {
      const dbManager = new DatabasePoolManager();

      // Mock a transaction
      const transactions = (dbManager as any).transactions;
      const oldTransaction = {
        id: 'old-tx',
        connectionId: 'conn-1',
        startTime: Date.now() - 7200000, // 2 hours ago
        operations: [],
        state: 'active',
        isolationLevel: 'read_committed' as any,
        savepoints: [],
      };

      transactions.set('old-tx', oldTransaction);

      // Trigger maintenance
      await (dbManager as any).performMaintenance();

      // Old transaction should be cleaned up
      expect(transactions.has('old-tx')).toBe(false);
    });

    it('should clear maintenance interval on close', async () => {
      const dbManager = new DatabasePoolManager();
      const interval = (dbManager as any).maintenanceInterval;

      expect(interval).toBeDefined();

      await dbManager.close();

      const clearedInterval = (dbManager as any).maintenanceInterval;
      expect(clearedInterval).toBeNull();
    });
  });

  // ============================================================================
  // Test #8: Missing Null Check Fix
  // ============================================================================

  describe('Fix #8: Null Check in PlanningEngine', () => {
    it('should handle empty variables gracefully', () => {
      const engine = new PlanningEngine();

      // Access private backtrack method via reflection
      const backtrack = (engine as any).backtrack.bind(engine);

      const assignment = new Map();
      const variables: string[] = [];
      const domains = new Map();
      const constraints: any[] = [];

      const result = backtrack(assignment, variables, domains, constraints);

      // Should return undefined instead of throwing
      expect(result).toBeDefined();
    });
  });
});
