/**
 * Test Suite for ConfigManager
 * Testing timer leak fixes and configuration management
 */

import { ConfigManager } from '../../src/config/ConfigManager';

describe('ConfigManager', () => {
  let configManager: ConfigManager;

  beforeEach(() => {
    configManager = new ConfigManager({
      defaultEnvironment: 'development',
      enableEncryption: false,
      enableValidation: true,
      enableVersioning: true,
      enableRemoteConfig: false,
      refreshInterval: 1000,
      configPaths: ['./config'],
    });
  });

  afterEach(() => {
    if (configManager) {
      configManager.close();
    }
  });

  describe('Initialization', () => {
    it('should create instance with default config', () => {
      const manager = new ConfigManager();
      expect(manager).toBeInstanceOf(ConfigManager);
      manager.close();
    });

    it('should create instance with custom config', () => {
      expect(configManager).toBeInstanceOf(ConfigManager);
    });

    it('should not start sync interval when remote config disabled', () => {
      const manager = new ConfigManager({ enableRemoteConfig: false });
      const interval = (manager as any).syncInterval;
      expect(interval).toBeNull();
      manager.close();
    });

    it('should start sync interval when remote config enabled', () => {
      const manager = new ConfigManager({ enableRemoteConfig: true });
      const interval = (manager as any).syncInterval;
      expect(interval).not.toBeNull();
      manager.close();
    });
  });

  describe('Timer Leak Fix', () => {
    it('should clear sync interval on close', () => {
      const manager = new ConfigManager({ enableRemoteConfig: true });
      const interval = (manager as any).syncInterval;

      expect(interval).not.toBeNull();

      manager.close();

      const clearedInterval = (manager as any).syncInterval;
      expect(clearedInterval).toBeNull();
    });

    it('should not leak timers with multiple instances', () => {
      const instances = [];

      for (let i = 0; i < 10; i++) {
        instances.push(new ConfigManager({ enableRemoteConfig: true }));
      }

      // Close all instances
      instances.forEach(m => m.close());

      // Verify all intervals are cleared
      instances.forEach(m => {
        expect((m as any).syncInterval).toBeNull();
      });
    });

    it('should handle close when sync not enabled', () => {
      const manager = new ConfigManager({ enableRemoteConfig: false });

      expect(() => manager.close()).not.toThrow();
      expect((manager as any).syncInterval).toBeNull();
    });
  });

  describe('Configuration Management', () => {
    it('should create configuration', () => {
      const config = configManager.createConfiguration('app', 'development');

      expect(config).toBeDefined();
      expect(config.id).toBeDefined();
      expect(config.name).toBe('app');
      expect(config.environment).toBe('development');
    });

    it('should get configuration', () => {
      const config = configManager.createConfiguration('app', 'development');
      const retrieved = configManager.getConfiguration(config.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(config.id);
    });

    it('should list configurations', () => {
      configManager.createConfiguration('app1', 'development');
      configManager.createConfiguration('app2', 'production');

      const configs = configManager.listConfigurations();

      expect(configs.length).toBeGreaterThanOrEqual(2);
    });

    it('should delete configuration', () => {
      const config = configManager.createConfiguration('app', 'development');
      configManager.deleteConfiguration(config.id);

      const retrieved = configManager.getConfiguration(config.id);
      expect(retrieved).toBeUndefined();
    });
  });

  describe('Value Management', () => {
    it('should set and get value', () => {
      const config = configManager.createConfiguration('app', 'development');

      configManager.setValue(config.id, 'key1', 'value1');
      const value = configManager.getValue(config.id, 'key1');

      expect(value).toBe('value1');
    });

    it('should get all values', () => {
      const config = configManager.createConfiguration('app', 'development');

      configManager.setValue(config.id, 'key1', 'value1');
      configManager.setValue(config.id, 'key2', 'value2');

      const values = configManager.getAllValues(config.id);

      expect(values.get('key1')).toBe('value1');
      expect(values.get('key2')).toBe('value2');
    });

    it('should delete value', () => {
      const config = configManager.createConfiguration('app', 'development');

      configManager.setValue(config.id, 'key1', 'value1');
      configManager.deleteValue(config.id, 'key1');

      const value = configManager.getValue(config.id, 'key1');
      expect(value).toBeUndefined();
    });
  });

  describe('Feature Flags', () => {
    it('should set and check feature flag', () => {
      const config = configManager.createConfiguration('app', 'development');

      configManager.setFeatureFlag(config.id, 'feature1', true);
      const enabled = configManager.isFeatureEnabled(config.id, 'feature1');

      expect(enabled).toBe(true);
    });

    it('should return false for non-existent feature', () => {
      const config = configManager.createConfiguration('app', 'development');
      const enabled = configManager.isFeatureEnabled(config.id, 'nonexistent');

      expect(enabled).toBe(false);
    });
  });

  describe('Statistics', () => {
    it('should get stats', () => {
      configManager.createConfiguration('app1', 'development');
      configManager.createConfiguration('app2', 'production');

      const stats = configManager.getStats();

      expect(stats.configurations).toBeGreaterThanOrEqual(2);
      expect(stats.totalValues).toBeDefined();
      expect(stats.totalSecrets).toBeDefined();
      expect(stats.totalFlags).toBeDefined();
    });
  });

  describe('Close & Cleanup', () => {
    it('should clear all configurations', () => {
      configManager.createConfiguration('app1', 'development');
      configManager.createConfiguration('app2', 'production');

      configManager.close();

      const configurations = (configManager as any).configurations;
      expect(configurations.size).toBe(0);
    });

    it('should clear all data structures', () => {
      configManager.close();

      expect((configManager as any).configurations.size).toBe(0);
      expect((configManager as any).versions.size).toBe(0);
      expect((configManager as any).watches.size).toBe(0);
      expect((configManager as any).remoteSources.size).toBe(0);
      expect((configManager as any).cache.size).toBe(0);
    });

    it('should emit manager:closed event', (done) => {
      configManager.on('manager:closed', () => {
        done();
      });

      configManager.close();
    });
  });

  describe('Memory Management', () => {
    it('should not leak memory with many configurations', () => {
      const initialMemory = process.memoryUsage().heapUsed;

      for (let i = 0; i < 100; i++) {
        const config = configManager.createConfiguration(`app-${i}`, 'development');
        configManager.deleteConfiguration(config.id);
      }

      if (global.gc) global.gc();

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryGrowth = finalMemory - initialMemory;

      // Memory growth should be minimal (< 5MB)
      expect(memoryGrowth).toBeLessThan(5 * 1024 * 1024);
    });
  });

  describe('Event Handling', () => {
    it('should emit configuration:created event', (done) => {
      configManager.on('configuration:created', (data) => {
        expect(data.configuration).toBeDefined();
        done();
      });

      configManager.createConfiguration('app', 'development');
    });

    it('should emit value:set event', (done) => {
      const config = configManager.createConfiguration('app', 'development');

      configManager.on('value:set', (data) => {
        expect(data.configurationId).toBe(config.id);
        expect(data.key).toBe('key1');
        done();
      });

      configManager.setValue(config.id, 'key1', 'value1');
    });
  });

  describe('Performance', () => {
    it('should handle many configurations quickly', () => {
      const start = Date.now();

      for (let i = 0; i < 100; i++) {
        configManager.createConfiguration(`app-${i}`, 'development');
      }

      const duration = Date.now() - start;

      // Should handle 100 configs quickly (< 100ms)
      expect(duration).toBeLessThan(100);
    });

    it('should get value quickly', () => {
      const config = configManager.createConfiguration('app', 'development');
      configManager.setValue(config.id, 'key1', 'value1');

      const start = Date.now();
      configManager.getValue(config.id, 'key1');
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(10);
    });
  });
});
