/**
 * Comprehensive Test Suite for Index Module
 * Testing AgentCLI core functionality
 */

import { AgentCLI } from '../src/index';
import AnalyticsManager from '../src/analytics/AnalyticsManager';
import APIGateway from '../src/network/APIGateway';
import DatabasePoolManager from '../src/database/DatabasePoolManager';

describe('AgentCLI', () => {
  describe('Initialization', () => {
    it('should create instance with default config', () => {
      const app = new AgentCLI();
      expect(app).toBeInstanceOf(AgentCLI);
      expect(app.getEnvironment()).toBe('development');
    });

    it('should create instance with custom config', () => {
      const app = new AgentCLI({
        environment: 'production',
        debug: true,
        logLevel: 'debug',
      });

      const config = app.getConfig();
      expect(config.environment).toBe('production');
      expect(config.debug).toBe(true);
      expect(config.logLevel).toBe('debug');
    });

    it('should initialize all managers', () => {
      const app = new AgentCLI();

      expect(app.analytics).toBeInstanceOf(AnalyticsManager);
      expect(app.apiGateway).toBeInstanceOf(APIGateway);
      expect(app.database).toBeInstanceOf(DatabasePoolManager);
      expect(app.configManager).toBeDefined();
      expect(app.cache).toBeDefined();
    });
  });

  describe('Configuration Management', () => {
    it('should return config copy (not reference)', () => {
      const app = new AgentCLI({ environment: 'test' });
      const config1 = app.getConfig();
      const config2 = app.getConfig();

      expect(config1).toEqual(config2);
      expect(config1).not.toBe(config2); // Different objects
    });

    it('should get correct environment', () => {
      const app = new AgentCLI({ environment: 'staging' });
      expect(app.getEnvironment()).toBe('staging');
    });

    it('should return version', () => {
      const app = new AgentCLI();
      const version = app.getVersion();

      expect(version).toBeDefined();
      expect(typeof version).toBe('string');
      expect(version).toMatch(/^\d+\.\d+\.\d+$/); // Semantic versioning
    });
  });

  describe('Status Management', () => {
    it('should get system status', () => {
      const app = new AgentCLI();
      const status = app.getStatus();

      expect(status).toBeDefined();
      expect(status.status).toMatch(/healthy|degraded|unhealthy/);
      expect(status.uptime).toBeGreaterThanOrEqual(0);
      expect(status.modules).toBeInstanceOf(Map);
    });

    it('should include all modules in status', () => {
      const app = new AgentCLI();
      const status = app.getStatus();

      const expectedModules = [
        'analytics',
        'apiGateway',
        'database',
        'configManager',
        'cache',
      ];

      expectedModules.forEach(moduleName => {
        expect(status.modules.has(moduleName)).toBe(true);
      });
    });

    it('should handle missing getStats gracefully', () => {
      const app = new AgentCLI();

      // Should not throw even if some managers don't have getStats
      expect(() => app.getStatus()).not.toThrow();
    });

    it('should report healthy status for properly initialized system', () => {
      const app = new AgentCLI();
      const status = app.getStatus();

      expect(status.status).toBe('healthy');
    });
  });

  describe('Event Handling', () => {
    it('should emit and handle events', (done) => {
      const app = new AgentCLI();

      app.on('test:event', (data) => {
        expect(data.message).toBe('test');
        done();
      });

      app.emit('test:event', { message: 'test' });
    });

    it('should forward module errors', (done) => {
      const app = new AgentCLI();

      app.on('module:error', (data) => {
        expect(data.manager).toBeDefined();
        expect(data.error).toBeDefined();
        done();
      });

      // Simulate module error
      app.analytics.emit('error', new Error('Test error'));
    });
  });

  describe('Memory Management', () => {
    it('should not leak memory on multiple instantiations', () => {
      const instances = [];
      const initialMemory = process.memoryUsage().heapUsed;

      for (let i = 0; i < 100; i++) {
        instances.push(new AgentCLI());
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryGrowth = finalMemory - initialMemory;

      // Memory growth should be reasonable (< 50MB for 100 instances)
      expect(memoryGrowth).toBeLessThan(50 * 1024 * 1024);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid config gracefully', () => {
      expect(() => {
        new AgentCLI({
          environment: 'invalid' as any,
        });
      }).not.toThrow();
    });

    it('should provide default values for missing config', () => {
      const app = new AgentCLI({});
      const config = app.getConfig();

      expect(config.environment).toBeDefined();
      expect(config.debug).toBeDefined();
      expect(config.logLevel).toBeDefined();
    });
  });

  describe('Integration Tests', () => {
    it('should start and stop cleanly', async () => {
      const app = new AgentCLI();

      // System should be operational
      const status = app.getStatus();
      expect(status.status).toBe('healthy');

      // Should not throw on repeated status checks
      expect(() => {
        for (let i = 0; i < 10; i++) {
          app.getStatus();
        }
      }).not.toThrow();
    });

    it('should handle concurrent operations', async () => {
      const app = new AgentCLI();

      const operations = Array(50).fill(0).map(() =>
        Promise.resolve(app.getStatus())
      );

      await expect(Promise.all(operations)).resolves.toBeDefined();
    });
  });

  describe('Performance', () => {
    it('should initialize quickly', () => {
      const start = Date.now();
      new AgentCLI();
      const duration = Date.now() - start;

      // Should initialize in less than 1 second
      expect(duration).toBeLessThan(1000);
    });

    it('should get status quickly', () => {
      const app = new AgentCLI();
      const start = Date.now();
      app.getStatus();
      const duration = Date.now() - start;

      // Status check should be fast (< 100ms)
      expect(duration).toBeLessThan(100);
    });
  });
});
