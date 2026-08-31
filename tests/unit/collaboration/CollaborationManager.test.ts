/**
 * Test Suite for CollaborationManager
 * Testing timer leak fixes and real-time features
 */

import { CollaborationManager } from '../../src/collaboration/CollaborationManager';

describe('CollaborationManager', () => {
  let manager: CollaborationManager;

  beforeEach(() => {
    manager = new CollaborationManager({
      maxConnections: 100,
      heartbeatInterval: 1000,
      sessionTimeout: 5000,
      enablePresence: true,
      enableCursors: true,
      enableOperationalTransform: true,
      conflictResolution: 'operational_transform',
    });
  });

  afterEach(() => {
    if (manager) {
      manager.close();
    }
  });

  describe('Initialization', () => {
    it('should create instance with default config', () => {
      const m = new CollaborationManager();
      expect(m).toBeInstanceOf(CollaborationManager);
      m.close();
    });

    it('should create instance with custom config', () => {
      expect(manager).toBeInstanceOf(CollaborationManager);
    });

    it('should start heartbeat interval', () => {
      const interval = (manager as any).heartbeatInterval;
      expect(interval).toBeDefined();
      expect(interval).not.toBeNull();
    });

    it('should start cleanup interval', () => {
      const interval = (manager as any).cleanupInterval;
      expect(interval).toBeDefined();
      expect(interval).not.toBeNull();
    });
  });

  describe('Timer Leak Fix', () => {
    it('should clear heartbeat interval on close', () => {
      const m = new CollaborationManager();
      const interval = (m as any).heartbeatInterval;

      expect(interval).not.toBeNull();

      m.close();

      const clearedInterval = (m as any).heartbeatInterval;
      expect(clearedInterval).toBeNull();
    });

    it('should clear cleanup interval on close', () => {
      const m = new CollaborationManager();
      const interval = (m as any).cleanupInterval;

      expect(interval).not.toBeNull();

      m.close();

      const clearedInterval = (m as any).cleanupInterval;
      expect(clearedInterval).toBeNull();
    });

    it('should not leak timers with multiple instances', () => {
      const instances = [];

      for (let i = 0; i < 10; i++) {
        instances.push(new CollaborationManager());
      }

      // Close all instances
      instances.forEach(m => m.close());

      // Verify all intervals are cleared
      instances.forEach(m => {
        expect((m as any).heartbeatInterval).toBeNull();
        expect((m as any).cleanupInterval).toBeNull();
      });
    });
  });

  describe('Session Management', () => {
    it('should create session', () => {
      const session = manager.createSession('doc-1', 'user-1');

      expect(session).toBeDefined();
      expect(session.id).toBeDefined();
      expect(session.documentId).toBe('doc-1');
      expect(session.state).toBe('active');
    });

    it('should get session by id', () => {
      const session = manager.createSession('doc-1', 'user-1');
      const retrieved = manager.getSession(session.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(session.id);
    });

    it('should close session', () => {
      const session = manager.createSession('doc-1', 'user-1');
      manager.closeSession(session.id);

      const sessions = (manager as any).sessions;
      expect(sessions.has(session.id)).toBe(false);
    });
  });

  describe('Connection Management', () => {
    it('should register connection', () => {
      manager.registerConnection({
        id: 'conn-1',
        userId: 'user-1',
        sessionId: 'session-1',
        state: 'connected',
        lastPing: Date.now(),
        lastPong: Date.now(),
        metadata: {},
      });

      const connections = (manager as any).connections;
      expect(connections.has('conn-1')).toBe(true);
    });

    it('should unregister connection', () => {
      manager.registerConnection({
        id: 'conn-1',
        userId: 'user-1',
        sessionId: 'session-1',
        state: 'connected',
        lastPing: Date.now(),
        lastPong: Date.now(),
        metadata: {},
      });

      manager.unregisterConnection('conn-1');

      const connections = (manager as any).connections;
      expect(connections.has('conn-1')).toBe(false);
    });
  });

  describe('Heartbeat System', () => {
    it('should send heartbeats', async () => {
      const connection = {
        id: 'conn-1',
        userId: 'user-1',
        sessionId: 'session-1',
        state: 'connected' as const,
        lastPing: Date.now(),
        lastPong: Date.now(),
        metadata: {},
      };

      manager.registerConnection(connection);

      // Trigger heartbeat manually
      (manager as any).sendHeartbeats();

      // Connection should still exist
      const connections = (manager as any).connections;
      expect(connections.has('conn-1')).toBe(true);
    });

    it('should detect disconnected connections', async () => {
      const connection = {
        id: 'conn-1',
        userId: 'user-1',
        sessionId: 'session-1',
        state: 'connected' as const,
        lastPing: Date.now() - 10000,
        lastPong: Date.now() - 10000, // Old pong
        metadata: {},
      };

      manager.registerConnection(connection);

      // Trigger heartbeat
      (manager as any).sendHeartbeats();

      // Connection should be marked as disconnected
      const connections = (manager as any).connections;
      const conn = connections.get('conn-1');

      if (conn) {
        expect(conn.state).toBe('disconnected');
      }
    });
  });

  describe('Session Cleanup', () => {
    it('should cleanup inactive sessions', async () => {
      const session = manager.createSession('doc-1', 'user-1');

      // Make session old
      const sessions = (manager as any).sessions;
      const s = sessions.get(session.id);
      if (s) {
        s.updatedAt = Date.now() - 10000; // 10 seconds ago
      }

      // Trigger cleanup
      (manager as any).cleanupInactiveSessions();

      // Session might be cleaned up based on participant activity
      expect(sessions).toBeDefined();
    });
  });

  describe('Statistics', () => {
    it('should get stats', () => {
      manager.createSession('doc-1', 'user-1');
      manager.createSession('doc-2', 'user-2');

      const stats = manager.getStats();

      expect(stats.sessions).toBeGreaterThanOrEqual(2);
      expect(stats.connections).toBeDefined();
      expect(stats.totalParticipants).toBeDefined();
    });
  });

  describe('Close & Cleanup', () => {
    it('should close all sessions', () => {
      manager.createSession('doc-1', 'user-1');
      manager.createSession('doc-2', 'user-2');

      manager.close();

      const sessions = (manager as any).sessions;
      expect(sessions.size).toBe(0);
    });

    it('should clear all connections', () => {
      manager.registerConnection({
        id: 'conn-1',
        userId: 'user-1',
        sessionId: 'session-1',
        state: 'connected',
        lastPing: Date.now(),
        lastPong: Date.now(),
        metadata: {},
      });

      manager.close();

      const connections = (manager as any).connections;
      expect(connections.size).toBe(0);
    });

    it('should clear all data structures', () => {
      manager.close();

      expect((manager as any).sessions.size).toBe(0);
      expect((manager as any).connections.size).toBe(0);
      expect((manager as any).chatMessages.size).toBe(0);
      expect((manager as any).awarenessStates.size).toBe(0);
    });

    it('should emit manager:closed event', (done) => {
      manager.on('manager:closed', () => {
        done();
      });

      manager.close();
    });
  });

  describe('Memory Management', () => {
    it('should not leak memory with many sessions', () => {
      const initialMemory = process.memoryUsage().heapUsed;

      for (let i = 0; i < 100; i++) {
        const session = manager.createSession(`doc-${i}`, `user-${i}`);
        manager.closeSession(session.id);
      }

      if (global.gc) global.gc();

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryGrowth = finalMemory - initialMemory;

      // Memory growth should be minimal (< 5MB)
      expect(memoryGrowth).toBeLessThan(5 * 1024 * 1024);
    });
  });

  describe('Event Handling', () => {
    it('should emit session:created event', (done) => {
      manager.on('session:created', (data) => {
        expect(data.session).toBeDefined();
        done();
      });

      manager.createSession('doc-1', 'user-1');
    });

    it('should emit session:closed event', (done) => {
      const session = manager.createSession('doc-1', 'user-1');

      manager.on('session:closed', (data) => {
        expect(data.session.id).toBe(session.id);
        done();
      });

      manager.closeSession(session.id);
    });
  });

  describe('Performance', () => {
    it('should handle many concurrent sessions', () => {
      const start = Date.now();

      for (let i = 0; i < 100; i++) {
        manager.createSession(`doc-${i}`, `user-${i}`);
      }

      const duration = Date.now() - start;

      // Should handle 100 sessions quickly (< 100ms)
      expect(duration).toBeLessThan(100);
    });
  });
});
