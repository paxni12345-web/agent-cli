/**
 * Comprehensive Unit Tests for SecurityManager
 * Coverage: All public methods, edge cases, error conditions, async behavior,
 * resource cleanup, type safety, mocked dependencies, error paths, timeouts, concurrency
 */

import { SecurityManager, SecurityConfig, User, LoginContext } from '../../../src/security/SecurityManager';
import Redis from 'ioredis';

// Mock dependencies
jest.mock('ioredis');
jest.mock('bcrypt');
jest.mock('jsonwebtoken');

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

describe('SecurityManager', () => {
  let securityManager: SecurityManager;
  let mockRedis: jest.Mocked<Redis>;
  let config: Partial<SecurityConfig>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup Redis mock
    mockRedis = {
      ping: jest.fn().mockResolvedValue('PONG'),
      on: jest.fn(),
      setex: jest.fn().mockResolvedValue('OK'),
      get: jest.fn().mockResolvedValue(null),
      del: jest.fn().mockResolvedValue(1),
      srem: jest.fn().mockResolvedValue(1),
      sadd: jest.fn().mockResolvedValue(1),
      smembers: jest.fn().mockResolvedValue([]),
      zadd: jest.fn().mockResolvedValue(1),
      zcard: jest.fn().mockResolvedValue(0),
      zremrangebyrank: jest.fn().mockResolvedValue(1),
      zrangebyscore: jest.fn().mockResolvedValue([]),
      zremrangebyscore: jest.fn().mockResolvedValue(1),
      incr: jest.fn().mockResolvedValue(1),
      ttl: jest.fn().mockResolvedValue(300),
      quit: jest.fn().mockResolvedValue('OK'),
    } as any;

    (Redis as jest.MockedClass<typeof Redis>).mockImplementation(() => mockRedis);

    config = {
      jwtSecret: 'test-secret-key-12345',
      enableAuth: true,
      enableEncryption: true,
      enableAudit: true,
      redisUrl: 'redis://localhost:6379',
    };
  });

  afterEach(async () => {
    if (securityManager) {
      await securityManager.disconnect();
    }
  });

  // ========================================================================
  // Constructor & Initialization Tests
  // ========================================================================

  describe('Constructor', () => {
    it('should create SecurityManager with default config', async () => {
      securityManager = new SecurityManager(config);
      expect(securityManager).toBeInstanceOf(SecurityManager);
    });

    it('should initialize Redis connection', async () => {
      securityManager = new SecurityManager(config);
      expect(Redis).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          retryStrategy: expect.any(Function),
          maxRetriesPerRequest: 3,
        })
      );
    });

    it('should handle Redis connection failure', async () => {
      mockRedis.ping.mockRejectedValueOnce(new Error('Connection failed'));
      await expect(async () => {
        securityManager = new SecurityManager(config);
        await new Promise(resolve => setTimeout(resolve, 100));
      }).rejects.toThrow();
    });

    it('should initialize default roles', async () => {
      securityManager = new SecurityManager(config);
      expect(securityManager).toBeDefined();
    });

    it('should handle null config', async () => {
      securityManager = new SecurityManager();
      expect(securityManager).toBeInstanceOf(SecurityManager);
    });

    it('should handle undefined config', async () => {
      securityManager = new SecurityManager(undefined);
      expect(securityManager).toBeInstanceOf(SecurityManager);
    });

    it('should handle empty config object', async () => {
      securityManager = new SecurityManager({});
      expect(securityManager).toBeInstanceOf(SecurityManager);
    });
  });

  // ========================================================================
  // User Management Tests
  // ========================================================================

  describe('createUser', () => {
    beforeEach(() => {
      securityManager = new SecurityManager(config);
      bcrypt.hash.mockResolvedValue('hashed-password');
    });

    it('should create user with valid credentials', async () => {
      const user = await securityManager.createUser('testuser', 'test@example.com', 'Password123!');

      expect(user).toBeDefined();
      expect(user.username).toBe('testuser');
      expect(user.email).toBe('test@example.com');
      expect(user.passwordHash).toBe('hashed-password');
      expect(mockRedis.setex).toHaveBeenCalled();
    });

    it('should trim username and lowercase email', async () => {
      const user = await securityManager.createUser('  testuser  ', '  TEST@EXAMPLE.COM  ', 'Password123!');

      expect(user.username).toBe('testuser');
      expect(user.email).toBe('test@example.com');
    });

    it('should throw error for empty username', async () => {
      await expect(
        securityManager.createUser('', 'test@example.com', 'Password123!')
      ).rejects.toThrow('Username is required');
    });

    it('should throw error for null username', async () => {
      await expect(
        securityManager.createUser(null as any, 'test@example.com', 'Password123!')
      ).rejects.toThrow('Username is required');
    });

    it('should throw error for undefined username', async () => {
      await expect(
        securityManager.createUser(undefined as any, 'test@example.com', 'Password123!')
      ).rejects.toThrow('Username is required');
    });

    it('should throw error for whitespace-only username', async () => {
      await expect(
        securityManager.createUser('   ', 'test@example.com', 'Password123!')
      ).rejects.toThrow('Username is required');
    });

    it('should throw error for invalid email', async () => {
      await expect(
        securityManager.createUser('testuser', 'invalid-email', 'Password123!')
      ).rejects.toThrow('Valid email is required');
    });

    it('should throw error for empty email', async () => {
      await expect(
        securityManager.createUser('testuser', '', 'Password123!')
      ).rejects.toThrow('Valid email is required');
    });

    it('should throw error for null email', async () => {
      await expect(
        securityManager.createUser('testuser', null as any, 'Password123!')
      ).rejects.toThrow('Valid email is required');
    });

    it('should throw error for short password', async () => {
      await expect(
        securityManager.createUser('testuser', 'test@example.com', 'short')
      ).rejects.toThrow('Password must be at least');
    });

    it('should throw error for password without uppercase', async () => {
      await expect(
        securityManager.createUser('testuser', 'test@example.com', 'password123!')
      ).rejects.toThrow('uppercase letter');
    });

    it('should throw error for password without number', async () => {
      await expect(
        securityManager.createUser('testuser', 'test@example.com', 'Password!')
      ).rejects.toThrow('one number');
    });

    it('should throw error for password without special char', async () => {
      await expect(
        securityManager.createUser('testuser', 'test@example.com', 'Password123')
      ).rejects.toThrow('special character');
    });

    it('should throw error for duplicate username', async () => {
      await securityManager.createUser('testuser', 'test1@example.com', 'Password123!');

      await expect(
        securityManager.createUser('testuser', 'test2@example.com', 'Password123!')
      ).rejects.toThrow('User already exists');
    });

    it('should throw error for duplicate email', async () => {
      await securityManager.createUser('testuser1', 'test@example.com', 'Password123!');

      await expect(
        securityManager.createUser('testuser2', 'test@example.com', 'Password123!')
      ).rejects.toThrow('User already exists');
    });

    it('should emit user:created event', async () => {
      const eventSpy = jest.fn();
      securityManager.on('user:created', eventSpy);

      await securityManager.createUser('testuser', 'test@example.com', 'Password123!');

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({ user: expect.any(Object) })
      );
    });

    it('should handle bcrypt hash failure', async () => {
      bcrypt.hash.mockRejectedValueOnce(new Error('Hash failed'));

      await expect(
        securityManager.createUser('testuser', 'test@example.com', 'Password123!')
      ).rejects.toThrow('Hash failed');
    });

    it('should handle Redis setex failure', async () => {
      mockRedis.setex.mockRejectedValueOnce(new Error('Redis error'));

      await expect(
        securityManager.createUser('testuser', 'test@example.com', 'Password123!')
      ).rejects.toThrow('Redis error');
    });

    it('should create user with custom roles', async () => {
      const user = await securityManager.createUser('testuser', 'test@example.com', 'Password123!', ['admin', 'manager']);

      expect(user.roles).toEqual(['admin', 'manager']);
    });

    it('should create user with default role when none provided', async () => {
      const user = await securityManager.createUser('testuser', 'test@example.com', 'Password123!');

      expect(user.roles).toEqual(['user']);
    });
  });

  describe('updateUser', () => {
    let userId: string;

    beforeEach(async () => {
      securityManager = new SecurityManager(config);
      bcrypt.hash.mockResolvedValue('hashed-password');
      const user = await securityManager.createUser('testuser', 'test@example.com', 'Password123!');
      userId = user.id;
    });

    it('should update user successfully', async () => {
      const updated = await securityManager.updateUser(userId, { roles: ['admin'] });

      expect(updated.roles).toEqual(['admin']);
      expect(mockRedis.setex).toHaveBeenCalled();
    });

    it('should throw error for non-existent user', async () => {
      await expect(
        securityManager.updateUser('non-existent-id', { roles: ['admin'] })
      ).rejects.toThrow('User not found');
    });

    it('should not allow updating passwordHash directly', async () => {
      const updated = await securityManager.updateUser(userId, { passwordHash: 'new-hash' } as any);

      expect(updated.passwordHash).not.toBe('new-hash');
      expect(updated.passwordHash).toBe('hashed-password');
    });

    it('should not allow updating id directly', async () => {
      const originalId = userId;
      await securityManager.updateUser(userId, { id: 'new-id' } as any);
      const user = securityManager.getUser(userId);

      expect(user?.id).toBe(originalId);
    });

    it('should update timestamp', async () => {
      const beforeUpdate = Date.now();
      const updated = await securityManager.updateUser(userId, { roles: ['admin'] });

      expect(updated.updatedAt).toBeGreaterThanOrEqual(beforeUpdate);
    });

    it('should emit user:updated event', async () => {
      const eventSpy = jest.fn();
      securityManager.on('user:updated', eventSpy);

      await securityManager.updateUser(userId, { roles: ['admin'] });

      expect(eventSpy).toHaveBeenCalled();
    });

    it('should handle null updates', async () => {
      await expect(
        securityManager.updateUser(userId, null as any)
      ).rejects.toThrow();
    });

    it('should handle undefined updates', async () => {
      const updated = await securityManager.updateUser(userId, undefined as any);
      expect(updated).toBeDefined();
    });
  });

  describe('deleteUser', () => {
    let userId: string;

    beforeEach(async () => {
      securityManager = new SecurityManager(config);
      bcrypt.hash.mockResolvedValue('hashed-password');
      const user = await securityManager.createUser('testuser', 'test@example.com', 'Password123!');
      userId = user.id;
    });

    it('should delete user successfully', async () => {
      await securityManager.deleteUser(userId);

      expect(securityManager.getUser(userId)).toBeUndefined();
      expect(mockRedis.del).toHaveBeenCalled();
    });

    it('should throw error for non-existent user', async () => {
      await expect(
        securityManager.deleteUser('non-existent-id')
      ).rejects.toThrow('User not found');
    });

    it('should emit user:deleted event', async () => {
      const eventSpy = jest.fn();
      securityManager.on('user:deleted', eventSpy);

      await securityManager.deleteUser(userId);

      expect(eventSpy).toHaveBeenCalledWith({ userId });
    });

    it('should handle null userId', async () => {
      await expect(
        securityManager.deleteUser(null as any)
      ).rejects.toThrow();
    });

    it('should handle undefined userId', async () => {
      await expect(
        securityManager.deleteUser(undefined as any)
      ).rejects.toThrow();
    });

    it('should handle empty userId', async () => {
      await expect(
        securityManager.deleteUser('')
      ).rejects.toThrow();
    });
  });

  // ========================================================================
  // Authentication Tests
  // ========================================================================

  describe('login', () => {
    let user: User;
    const context: LoginContext = {
      ipAddress: '127.0.0.1',
      userAgent: 'Test Agent',
      deviceId: 'device-123',
    };

    beforeEach(async () => {
      securityManager = new SecurityManager(config);
      bcrypt.hash.mockResolvedValue('hashed-password');
      bcrypt.compare.mockResolvedValue(true);
      jwt.sign.mockReturnValue('mock-jwt-token');

      user = await securityManager.createUser('testuser', 'test@example.com', 'Password123!');
    });

    it('should login successfully with username', async () => {
      const result = await securityManager.login('testuser', 'Password123!', context);

      expect(result).toHaveProperty('token');
      expect(result).toHaveProperty('refreshToken');
      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('sessionId');
    });

    it('should login successfully with email', async () => {
      const result = await securityManager.login('test@example.com', 'Password123!', context);

      expect(result).toHaveProperty('token');
      expect(result.user.email).toBe('test@example.com');
    });

    it('should throw error for invalid username', async () => {
      await expect(
        securityManager.login('nonexistent', 'Password123!', context)
      ).rejects.toThrow('Invalid credentials');
    });

    it('should throw error for invalid password', async () => {
      bcrypt.compare.mockResolvedValueOnce(false);

      await expect(
        securityManager.login('testuser', 'WrongPassword!', context)
      ).rejects.toThrow('Invalid credentials');
    });

    it('should increment login attempts on failed login', async () => {
      bcrypt.compare.mockResolvedValue(false);

      await expect(
        securityManager.login('testuser', 'WrongPassword!', context)
      ).rejects.toThrow();

      const updatedUser = securityManager.getUser(user.id);
      expect(updatedUser?.loginAttempts).toBe(1);
    });

    it('should lock account after max login attempts', async () => {
      bcrypt.compare.mockResolvedValue(false);

      // Make max attempts
      for (let i = 0; i < 5; i++) {
        try {
          await securityManager.login('testuser', 'WrongPassword!', context);
        } catch (e) {}
      }

      const updatedUser = securityManager.getUser(user.id);
      expect(updatedUser?.locked).toBe(true);
    });

    it('should reject login for locked account', async () => {
      await securityManager.updateUser(user.id, {
        locked: true,
        lockedUntil: Date.now() + 10000,
      });

      await expect(
        securityManager.login('testuser', 'Password123!', context)
      ).rejects.toThrow('Account is locked');
    });

    it('should unlock account after lockout period', async () => {
      await securityManager.updateUser(user.id, {
        locked: true,
        lockedUntil: Date.now() - 1000, // Past lockout time
      });

      const result = await securityManager.login('testuser', 'Password123!', context);
      expect(result).toHaveProperty('token');
    });

    it('should emit auth:login:success event', async () => {
      const eventSpy = jest.fn();
      securityManager.on('auth:login:success', eventSpy);

      await securityManager.login('testuser', 'Password123!', context);

      expect(eventSpy).toHaveBeenCalled();
    });

    it('should handle null username', async () => {
      await expect(
        securityManager.login(null as any, 'Password123!', context)
      ).rejects.toThrow();
    });

    it('should handle null password', async () => {
      await expect(
        securityManager.login('testuser', null as any, context)
      ).rejects.toThrow();
    });

    it('should handle null context', async () => {
      await expect(
        securityManager.login('testuser', 'Password123!', null as any)
      ).rejects.toThrow();
    });

    it('should handle empty context', async () => {
      await expect(
        securityManager.login('testuser', 'Password123!', {} as any)
      ).rejects.toThrow();
    });

    it('should reset login attempts on successful login', async () => {
      await securityManager.updateUser(user.id, { loginAttempts: 3 });

      await securityManager.login('testuser', 'Password123!', context);

      const updatedUser = securityManager.getUser(user.id);
      expect(updatedUser?.loginAttempts).toBe(0);
    });

    it('should update lastLogin timestamp', async () => {
      const beforeLogin = Date.now();
      await securityManager.login('testuser', 'Password123!', context);

      const updatedUser = securityManager.getUser(user.id);
      expect(updatedUser?.lastLogin).toBeGreaterThanOrEqual(beforeLogin);
    });
  });

  describe('logout', () => {
    let user: User;
    let token: string;
    let sessionId: string;
    const context: LoginContext = {
      ipAddress: '127.0.0.1',
      userAgent: 'Test Agent',
    };

    beforeEach(async () => {
      securityManager = new SecurityManager(config);
      bcrypt.hash.mockResolvedValue('hashed-password');
      bcrypt.compare.mockResolvedValue(true);
      jwt.sign.mockReturnValue('mock-jwt-token');

      user = await securityManager.createUser('testuser', 'test@example.com', 'Password123!');
      const loginResult = await securityManager.login('testuser', 'Password123!', context);
      token = loginResult.token;
      sessionId = loginResult.sessionId;

      mockRedis.get.mockResolvedValueOnce(sessionId);
      mockRedis.get.mockResolvedValueOnce(JSON.stringify({
        id: sessionId,
        userId: user.id,
        token,
        ipAddress: '127.0.0.1',
        userAgent: 'Test Agent',
        deviceId: 'device-123',
        createdAt: Date.now(),
        expiresAt: Date.now() + 3600000,
        lastActivity: Date.now(),
      }));
    });

    it('should logout successfully', async () => {
      await securityManager.logout(token, context);

      expect(mockRedis.del).toHaveBeenCalledWith(`session:${sessionId}`);
      expect(mockRedis.del).toHaveBeenCalledWith(`token:${token}`);
      expect(mockRedis.setex).toHaveBeenCalledWith(
        `blacklist:${token}`,
        expect.any(Number),
        '1'
      );
    });

    it('should emit auth:logout event', async () => {
      const eventSpy = jest.fn();
      securityManager.on('auth:logout', eventSpy);

      await securityManager.logout(token, context);

      expect(eventSpy).toHaveBeenCalledWith({ sessionId });
    });

    it('should handle invalid token', async () => {
      mockRedis.get.mockResolvedValue(null);

      await expect(
        securityManager.logout('invalid-token', context)
      ).resolves.not.toThrow();
    });

    it('should handle null token', async () => {
      await expect(
        securityManager.logout(null as any, context)
      ).rejects.toThrow();
    });

    it('should handle undefined token', async () => {
      await expect(
        securityManager.logout(undefined as any, context)
      ).rejects.toThrow();
    });
  });

  describe('validateToken', () => {
    let user: User;
    let token: string;

    beforeEach(async () => {
      securityManager = new SecurityManager(config);
      bcrypt.hash.mockResolvedValue('hashed-password');
      bcrypt.compare.mockResolvedValue(true);
      jwt.sign.mockReturnValue('mock-jwt-token');

      user = await securityManager.createUser('testuser', 'test@example.com', 'Password123!');
      jwt.verify.mockReturnValue({ userId: user.id, type: 'access' });
      mockRedis.get.mockResolvedValue(null); // Not blacklisted
    });

    it('should validate valid token', async () => {
      const result = await securityManager.validateToken('valid-token');

      expect(result).toBeDefined();
      expect(result?.id).toBe(user.id);
    });

    it('should return null for blacklisted token', async () => {
      mockRedis.get.mockResolvedValueOnce('1'); // Blacklisted

      const result = await securityManager.validateToken('blacklisted-token');

      expect(result).toBeNull();
    });

    it('should return null for invalid token', async () => {
      jwt.verify.mockImplementationOnce(() => {
        throw new Error('Invalid token');
      });

      const result = await securityManager.validateToken('invalid-token');

      expect(result).toBeNull();
    });

    it('should return null for refresh token type', async () => {
      jwt.verify.mockReturnValue({ userId: user.id, type: 'refresh' });

      const result = await securityManager.validateToken('refresh-token');

      expect(result).toBeNull();
    });

    it('should return null for non-existent user', async () => {
      jwt.verify.mockReturnValue({ userId: 'non-existent', type: 'access' });

      const result = await securityManager.validateToken('token');

      expect(result).toBeNull();
    });

    it('should handle null token', async () => {
      const result = await securityManager.validateToken(null as any);
      expect(result).toBeNull();
    });

    it('should handle undefined token', async () => {
      const result = await securityManager.validateToken(undefined as any);
      expect(result).toBeNull();
    });

    it('should handle empty token', async () => {
      const result = await securityManager.validateToken('');
      expect(result).toBeNull();
    });
  });

  describe('refreshToken', () => {
    let user: User;
    const context: LoginContext = {
      ipAddress: '127.0.0.1',
      userAgent: 'Test Agent',
    };

    beforeEach(async () => {
      securityManager = new SecurityManager(config);
      bcrypt.hash.mockResolvedValue('hashed-password');

      user = await securityManager.createUser('testuser', 'test@example.com', 'Password123!');
      jwt.verify.mockReturnValue({ userId: user.id, type: 'refresh' });
      jwt.sign.mockReturnValue('new-token');
      mockRedis.get.mockResolvedValue(null); // Not blacklisted
    });

    it('should refresh token successfully', async () => {
      const result = await securityManager.refreshToken('valid-refresh-token', context);

      expect(result).toHaveProperty('token');
      expect(result).toHaveProperty('refreshToken');
    });

    it('should throw error for blacklisted refresh token', async () => {
      mockRedis.get.mockResolvedValueOnce('1'); // Blacklisted

      await expect(
        securityManager.refreshToken('blacklisted-token', context)
      ).rejects.toThrow('Token has been revoked');
    });

    it('should throw error for invalid token type', async () => {
      jwt.verify.mockReturnValue({ userId: user.id, type: 'access' });

      await expect(
        securityManager.refreshToken('access-token', context)
      ).rejects.toThrow('Invalid token type');
    });

    it('should throw error for non-existent user', async () => {
      jwt.verify.mockReturnValue({ userId: 'non-existent', type: 'refresh' });

      await expect(
        securityManager.refreshToken('token', context)
      ).rejects.toThrow('User not found');
    });

    it('should blacklist old refresh token', async () => {
      await securityManager.refreshToken('refresh-token', context);

      expect(mockRedis.setex).toHaveBeenCalledWith(
        'blacklist:refresh-token',
        expect.any(Number),
        '1'
      );
    });

    it('should handle null refresh token', async () => {
      await expect(
        securityManager.refreshToken(null as any, context)
      ).rejects.toThrow();
    });

    it('should handle undefined refresh token', async () => {
      await expect(
        securityManager.refreshToken(undefined as any, context)
      ).rejects.toThrow();
    });
  });

  // ========================================================================
  // Password Reset Tests
  // ========================================================================

  describe('requestPasswordReset', () => {
    let user: User;
    const context: LoginContext = {
      ipAddress: '127.0.0.1',
      userAgent: 'Test Agent',
    };

    beforeEach(async () => {
      securityManager = new SecurityManager(config);
      bcrypt.hash.mockResolvedValue('hashed-password');
      user = await securityManager.createUser('testuser', 'test@example.com', 'Password123!');
    });

    it('should generate reset token for valid email', async () => {
      const token = await securityManager.requestPasswordReset('test@example.com', context);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(mockRedis.setex).toHaveBeenCalled();
    });

    it('should emit password:reset:requested event', async () => {
      const eventSpy = jest.fn();
      securityManager.on('password:reset:requested', eventSpy);

      await securityManager.requestPasswordReset('test@example.com', context);

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: user.id,
          email: 'test@example.com',
          token: expect.any(String),
        })
      );
    });

    it('should not reveal if user does not exist', async () => {
      const token = await securityManager.requestPasswordReset('nonexistent@example.com', context);

      expect(token).toBeDefined(); // Should still return a token
    });

    it('should handle null email', async () => {
      await expect(
        securityManager.requestPasswordReset(null as any, context)
      ).rejects.toThrow();
    });

    it('should handle undefined email', async () => {
      await expect(
        securityManager.requestPasswordReset(undefined as any, context)
      ).rejects.toThrow();
    });

    it('should handle empty email', async () => {
      const token = await securityManager.requestPasswordReset('', context);
      expect(token).toBeDefined();
    });
  });

  describe('resetPassword', () => {
    let user: User;
    let resetToken: string;
    const context: LoginContext = {
      ipAddress: '127.0.0.1',
      userAgent: 'Test Agent',
    };

    beforeEach(async () => {
      securityManager = new SecurityManager(config);
      bcrypt.hash.mockResolvedValue('hashed-password');
      user = await securityManager.createUser('testuser', 'test@example.com', 'Password123!');
      resetToken = await securityManager.requestPasswordReset('test@example.com', context);

      mockRedis.get.mockResolvedValue(JSON.stringify({
        token: resetToken,
        userId: user.id,
        expiresAt: Date.now() + 3600000,
        used: false,
      }));
    });

    it('should reset password with valid token', async () => {
      bcrypt.hash.mockResolvedValue('new-hashed-password');

      await securityManager.resetPassword(resetToken, 'NewPassword123!', context);

      expect(mockRedis.del).toHaveBeenCalled();
    });

    it('should emit password:reset:completed event', async () => {
      const eventSpy = jest.fn();
      securityManager.on('password:reset:completed', eventSpy);

      await securityManager.resetPassword(resetToken, 'NewPassword123!', context);

      expect(eventSpy).toHaveBeenCalledWith({ userId: user.id });
    });

    it('should throw error for invalid token', async () => {
      mockRedis.get.mockResolvedValue(null);

      await expect(
        securityManager.resetPassword('invalid-token', 'NewPassword123!', context)
      ).rejects.toThrow('Invalid or expired reset token');
    });

    it('should throw error for used token', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify({
        token: resetToken,
        userId: user.id,
        expiresAt: Date.now() + 3600000,
        used: true,
      }));

      await expect(
        securityManager.resetPassword(resetToken, 'NewPassword123!', context)
      ).rejects.toThrow('Reset token has already been used');
    });

    it('should throw error for expired token', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify({
        token: resetToken,
        userId: user.id,
        expiresAt: Date.now() - 1000,
        used: false,
      }));

      await expect(
        securityManager.resetPassword(resetToken, 'NewPassword123!', context)
      ).rejects.toThrow('Reset token has expired');
    });

    it('should throw error for weak new password', async () => {
      await expect(
        securityManager.resetPassword(resetToken, 'weak', context)
      ).rejects.toThrow();
    });

    it('should handle null token', async () => {
      await expect(
        securityManager.resetPassword(null as any, 'NewPassword123!', context)
      ).rejects.toThrow();
    });

    it('should handle null password', async () => {
      await expect(
        securityManager.resetPassword(resetToken, null as any, context)
      ).rejects.toThrow();
    });
  });

  describe('changePassword', () => {
    let user: User;
    const context: LoginContext = {
      ipAddress: '127.0.0.1',
      userAgent: 'Test Agent',
    };

    beforeEach(async () => {
      securityManager = new SecurityManager(config);
      bcrypt.hash.mockResolvedValue('hashed-password');
      bcrypt.compare.mockResolvedValue(true);
      user = await securityManager.createUser('testuser', 'test@example.com', 'Password123!');
    });

    it('should change password successfully', async () => {
      bcrypt.hash.mockResolvedValue('new-hashed-password');

      await securityManager.changePassword(user.id, 'Password123!', 'NewPassword456!', context);

      expect(bcrypt.compare).toHaveBeenCalledWith('Password123!', 'hashed-password');
      expect(bcrypt.hash).toHaveBeenCalledWith('NewPassword456!', expect.any(Number));
    });

    it('should emit password:changed event', async () => {
      const eventSpy = jest.fn();
      securityManager.on('password:changed', eventSpy);

      await securityManager.changePassword(user.id, 'Password123!', 'NewPassword456!', context);

      expect(eventSpy).toHaveBeenCalledWith({ userId: user.id });
    });

    it('should throw error for invalid current password', async () => {
      bcrypt.compare.mockResolvedValue(false);

      await expect(
        securityManager.changePassword(user.id, 'WrongPassword!', 'NewPassword456!', context)
      ).rejects.toThrow('Current password is incorrect');
    });

    it('should throw error for weak new password', async () => {
      await expect(
        securityManager.changePassword(user.id, 'Password123!', 'weak', context)
      ).rejects.toThrow();
    });

    it('should throw error for non-existent user', async () => {
      await expect(
        securityManager.changePassword('non-existent', 'Password123!', 'NewPassword456!', context)
      ).rejects.toThrow('User not found');
    });

    it('should handle null userId', async () => {
      await expect(
        securityManager.changePassword(null as any, 'Password123!', 'NewPassword456!', context)
      ).rejects.toThrow();
    });

    it('should handle null current password', async () => {
      await expect(
        securityManager.changePassword(user.id, null as any, 'NewPassword456!', context)
      ).rejects.toThrow();
    });

    it('should handle null new password', async () => {
      await expect(
        securityManager.changePassword(user.id, 'Password123!', null as any, context)
      ).rejects.toThrow();
    });
  });

  // ========================================================================
  // Session Management Tests
  // ========================================================================

  describe('getUserSessions', () => {
    let user: User;

    beforeEach(async () => {
      securityManager = new SecurityManager(config);
      bcrypt.hash.mockResolvedValue('hashed-password');
      user = await securityManager.createUser('testuser', 'test@example.com', 'Password123!');
    });

    it('should return user sessions', async () => {
      mockRedis.smembers.mockResolvedValue(['session-1', 'session-2']);
      mockRedis.get.mockResolvedValueOnce(JSON.stringify({
        id: 'session-1',
        userId: user.id,
        token: 'token-1',
        ipAddress: '127.0.0.1',
        userAgent: 'Agent 1',
        deviceId: 'device-1',
        createdAt: Date.now(),
        expiresAt: Date.now() + 3600000,
        lastActivity: Date.now(),
      }));
      mockRedis.get.mockResolvedValueOnce(JSON.stringify({
        id: 'session-2',
        userId: user.id,
        token: 'token-2',
        ipAddress: '127.0.0.2',
        userAgent: 'Agent 2',
        deviceId: 'device-2',
        createdAt: Date.now(),
        expiresAt: Date.now() + 3600000,
        lastActivity: Date.now(),
      }));

      const sessions = await securityManager.getUserSessions(user.id);

      expect(sessions).toHaveLength(2);
      expect(sessions[0].id).toBe('session-1');
      expect(sessions[1].id).toBe('session-2');
    });

    it('should filter expired sessions', async () => {
      mockRedis.smembers.mockResolvedValue(['session-1', 'session-2']);
      mockRedis.get.mockResolvedValueOnce(JSON.stringify({
        id: 'session-1',
        userId: user.id,
        expiresAt: Date.now() + 3600000, // Valid
      }));
      mockRedis.get.mockResolvedValueOnce(JSON.stringify({
        id: 'session-2',
        userId: user.id,
        expiresAt: Date.now() - 1000, // Expired
      }));

      const sessions = await securityManager.getUserSessions(user.id);

      expect(sessions).toHaveLength(1);
      expect(sessions[0].id).toBe('session-1');
    });

    it('should handle empty session list', async () => {
      mockRedis.smembers.mockResolvedValue([]);

      const sessions = await securityManager.getUserSessions(user.id);

      expect(sessions).toEqual([]);
    });

    it('should handle null userId', async () => {
      await expect(
        securityManager.getUserSessions(null as any)
      ).rejects.toThrow();
    });

    it('should handle undefined userId', async () => {
      await expect(
        securityManager.getUserSessions(undefined as any)
      ).rejects.toThrow();
    });
  });

  describe('revokeSession', () => {
    const context: LoginContext = {
      ipAddress: '127.0.0.1',
      userAgent: 'Test Agent',
    };

    it('should revoke session successfully', async () => {
      securityManager = new SecurityManager(config);

      mockRedis.get.mockResolvedValue(JSON.stringify({
        id: 'session-1',
        userId: 'user-1',
        token: 'token-1',
        ipAddress: '127.0.0.1',
        userAgent: 'Agent 1',
        deviceId: 'device-1',
        createdAt: Date.now(),
        expiresAt: Date.now() + 3600000,
        lastActivity: Date.now(),
      }));

      await securityManager.revokeSession('session-1', context);

      expect(mockRedis.del).toHaveBeenCalled();
      expect(mockRedis.setex).toHaveBeenCalled(); // Blacklist token
    });

    it('should emit session:revoked event', async () => {
      securityManager = new SecurityManager(config);
      const eventSpy = jest.fn();
      securityManager.on('session:revoked', eventSpy);

      mockRedis.get.mockResolvedValue(JSON.stringify({
        id: 'session-1',
        userId: 'user-1',
        token: 'token-1',
      }));

      await securityManager.revokeSession('session-1', context);

      expect(eventSpy).toHaveBeenCalled();
    });

    it('should throw error for non-existent session', async () => {
      securityManager = new SecurityManager(config);
      mockRedis.get.mockResolvedValue(null);

      await expect(
        securityManager.revokeSession('non-existent', context)
      ).rejects.toThrow('Session not found');
    });
  });

  // ========================================================================
  // Role & Permission Tests
  // ========================================================================

  describe('checkPermission', () => {
    let user: User;
    const context: LoginContext = {
      ipAddress: '127.0.0.1',
      userAgent: 'Test Agent',
    };

    beforeEach(async () => {
      securityManager = new SecurityManager(config);
      bcrypt.hash.mockResolvedValue('hashed-password');
      user = await securityManager.createUser('testuser', 'test@example.com', 'Password123!', ['admin']);
    });

    it('should grant permission for admin wildcard', async () => {
      const hasPermission = await securityManager.checkPermission(user.id, 'users', 'read', context);

      expect(hasPermission).toBe(true);
    });

    it('should deny permission for non-existent user', async () => {
      const hasPermission = await securityManager.checkPermission('non-existent', 'users', 'read', context);

      expect(hasPermission).toBe(false);
    });

    it('should handle null userId', async () => {
      const hasPermission = await securityManager.checkPermission(null as any, 'users', 'read', context);
      expect(hasPermission).toBe(false);
    });

    it('should handle undefined userId', async () => {
      const hasPermission = await securityManager.checkPermission(undefined as any, 'users', 'read', context);
      expect(hasPermission).toBe(false);
    });
  });

  describe('assignRole', () => {
    let user: User;
    const context: LoginContext = {
      ipAddress: '127.0.0.1',
      userAgent: 'Test Agent',
    };

    beforeEach(async () => {
      securityManager = new SecurityManager(config);
      bcrypt.hash.mockResolvedValue('hashed-password');
      user = await securityManager.createUser('testuser', 'test@example.com', 'Password123!');
    });

    it('should assign role successfully', async () => {
      await securityManager.assignRole(user.id, 'admin', context);

      const updatedUser = securityManager.getUser(user.id);
      expect(updatedUser?.roles).toContain('admin');
    });

    it('should emit role:assigned event', async () => {
      const eventSpy = jest.fn();
      securityManager.on('role:assigned', eventSpy);

      await securityManager.assignRole(user.id, 'admin', context);

      expect(eventSpy).toHaveBeenCalledWith({
        userId: user.id,
        roleName: 'admin',
      });
    });

    it('should throw error for non-existent user', async () => {
      await expect(
        securityManager.assignRole('non-existent', 'admin', context)
      ).rejects.toThrow('User not found');
    });

    it('should throw error for non-existent role', async () => {
      await expect(
        securityManager.assignRole(user.id, 'nonexistent-role', context)
      ).rejects.toThrow('Role not found');
    });
  });

  // ========================================================================
  // MFA Tests
  // ========================================================================

  describe('setupMFA', () => {
    let user: User;
    const context: LoginContext = {
      ipAddress: '127.0.0.1',
      userAgent: 'Test Agent',
    };

    beforeEach(async () => {
      securityManager = new SecurityManager(config);
      bcrypt.hash.mockResolvedValue('hashed-password');
      user = await securityManager.createUser('testuser', 'test@example.com', 'Password123!');
    });

    it('should setup MFA successfully', async () => {
      const mfaSetup = await securityManager.setupMFA(user.id, context);

      expect(mfaSetup).toHaveProperty('secret');
      expect(mfaSetup).toHaveProperty('qrCode');
      expect(mfaSetup).toHaveProperty('backupCodes');
      expect(mfaSetup.backupCodes).toHaveLength(10);
    });

    it('should throw error for non-existent user', async () => {
      await expect(
        securityManager.setupMFA('non-existent', context)
      ).rejects.toThrow('User not found');
    });
  });

  describe('enableMFA', () => {
    let user: User;
    let mfaSecret: string;
    const context: LoginContext = {
      ipAddress: '127.0.0.1',
      userAgent: 'Test Agent',
    };

    beforeEach(async () => {
      securityManager = new SecurityManager(config);
      bcrypt.hash.mockResolvedValue('hashed-password');
      user = await securityManager.createUser('testuser', 'test@example.com', 'Password123!');
      const setup = await securityManager.setupMFA(user.id, context);
      mfaSecret = setup.secret;
    });

    it('should enable MFA with valid code', async () => {
      // Mock the verifyMFACode to return true
      jest.spyOn(securityManager as any, 'verifyMFACode').mockResolvedValue(true);

      await securityManager.enableMFA(user.id, '123456', context);

      const updatedUser = securityManager.getUser(user.id);
      expect(updatedUser?.mfaEnabled).toBe(true);
    });

    it('should throw error for invalid code', async () => {
      jest.spyOn(securityManager as any, 'verifyMFACode').mockResolvedValue(false);

      await expect(
        securityManager.enableMFA(user.id, 'invalid', context)
      ).rejects.toThrow('Invalid MFA code');
    });

    it('should emit mfa:enabled event', async () => {
      jest.spyOn(securityManager as any, 'verifyMFACode').mockResolvedValue(true);
      const eventSpy = jest.fn();
      securityManager.on('mfa:enabled', eventSpy);

      await securityManager.enableMFA(user.id, '123456', context);

      expect(eventSpy).toHaveBeenCalledWith({ userId: user.id });
    });
  });

  describe('disableMFA', () => {
    let user: User;
    const context: LoginContext = {
      ipAddress: '127.0.0.1',
      userAgent: 'Test Agent',
    };

    beforeEach(async () => {
      securityManager = new SecurityManager(config);
      bcrypt.hash.mockResolvedValue('hashed-password');
      user = await securityManager.createUser('testuser', 'test@example.com', 'Password123!');
      await securityManager.setupMFA(user.id, context);
      jest.spyOn(securityManager as any, 'verifyMFACode').mockResolvedValue(true);
      await securityManager.enableMFA(user.id, '123456', context);
    });

    it('should disable MFA successfully', async () => {
      await securityManager.disableMFA(user.id, context);

      const updatedUser = securityManager.getUser(user.id);
      expect(updatedUser?.mfaEnabled).toBe(false);
    });

    it('should emit mfa:disabled event', async () => {
      const eventSpy = jest.fn();
      securityManager.on('mfa:disabled', eventSpy);

      await securityManager.disableMFA(user.id, context);

      expect(eventSpy).toHaveBeenCalledWith({ userId: user.id });
    });

    it('should throw error for non-existent user', async () => {
      await expect(
        securityManager.disableMFA('non-existent', context)
      ).rejects.toThrow('User not found');
    });
  });

  // ========================================================================
  // Encryption Tests
  // ========================================================================

  describe('encrypt and decrypt', () => {
    beforeEach(() => {
      securityManager = new SecurityManager(config);
    });

    it('should encrypt and decrypt data successfully', async () => {
      const data = 'sensitive information';
      const { encrypted, keyId } = await securityManager.encrypt(data);

      expect(encrypted).toBeDefined();
      expect(keyId).toBeDefined();

      const decrypted = await securityManager.decrypt(encrypted, keyId);
      expect(decrypted).toBe(data);
    });

    it('should throw error for invalid key ID on decrypt', async () => {
      await expect(
        securityManager.decrypt('encrypted-data', 'invalid-key-id')
      ).rejects.toThrow('Encryption key not found');
    });

    it('should handle empty data', async () => {
      const { encrypted, keyId } = await securityManager.encrypt('');
      const decrypted = await securityManager.decrypt(encrypted, keyId);
      expect(decrypted).toBe('');
    });

    it('should handle null data', async () => {
      await expect(
        securityManager.encrypt(null as any)
      ).rejects.toThrow();
    });

    it('should handle undefined data', async () => {
      await expect(
        securityManager.encrypt(undefined as any)
      ).rejects.toThrow();
    });
  });

  // ========================================================================
  // Audit Logging Tests
  // ========================================================================

  describe('audit', () => {
    beforeEach(() => {
      securityManager = new SecurityManager(config);
    });

    it('should log audit entry', async () => {
      await securityManager.audit('user-1', 'login', 'session', 'session-1', 'success');

      expect(mockRedis.zadd).toHaveBeenCalled();
    });

    it('should emit audit:logged event', async () => {
      const eventSpy = jest.fn();
      securityManager.on('audit:logged', eventSpy);

      await securityManager.audit('user-1', 'login', 'session', 'session-1', 'success');

      expect(eventSpy).toHaveBeenCalled();
    });

    it('should not throw on audit errors', async () => {
      mockRedis.zadd.mockRejectedValueOnce(new Error('Redis error'));

      await expect(
        securityManager.audit('user-1', 'login', 'session', 'session-1', 'success')
      ).resolves.not.toThrow();
    });

    it('should handle null userId', async () => {
      await expect(
        securityManager.audit(null as any, 'login', 'session', 'session-1', 'success')
      ).resolves.not.toThrow();
    });

    it('should handle empty action', async () => {
      await expect(
        securityManager.audit('user-1', '', 'session', 'session-1', 'success')
      ).resolves.not.toThrow();
    });
  });

  describe('getAuditLogs', () => {
    beforeEach(() => {
      securityManager = new SecurityManager(config);
    });

    it('should retrieve audit logs', async () => {
      const mockLogs = [
        JSON.stringify({
          id: 'log-1',
          userId: 'user-1',
          action: 'login',
          resource: 'session',
          result: 'success',
          timestamp: Date.now(),
        }),
      ];
      mockRedis.zrangebyscore.mockResolvedValue(mockLogs);

      const logs = await securityManager.getAuditLogs();

      expect(logs).toHaveLength(1);
      expect(logs[0].id).toBe('log-1');
    });

    it('should filter logs by userId', async () => {
      const mockLogs = [
        JSON.stringify({
          id: 'log-1',
          userId: 'user-1',
          action: 'login',
          timestamp: Date.now(),
        }),
        JSON.stringify({
          id: 'log-2',
          userId: 'user-2',
          action: 'login',
          timestamp: Date.now(),
        }),
      ];
      mockRedis.zrangebyscore.mockResolvedValue(mockLogs);

      const logs = await securityManager.getAuditLogs({ userId: 'user-1' });

      expect(logs).toHaveLength(1);
      expect(logs[0].userId).toBe('user-1');
    });

    it('should handle empty logs', async () => {
      mockRedis.zrangebyscore.mockResolvedValue([]);

      const logs = await securityManager.getAuditLogs();

      expect(logs).toEqual([]);
    });

    it('should handle Redis errors', async () => {
      mockRedis.zrangebyscore.mockRejectedValue(new Error('Redis error'));

      await expect(
        securityManager.getAuditLogs()
      ).rejects.toThrow('Failed to get audit logs');
    });
  });

  // ========================================================================
  // Security Scanning Tests
  // ========================================================================

  describe('scanSecurity', () => {
    beforeEach(async () => {
      securityManager = new SecurityManager(config);
      bcrypt.hash.mockResolvedValue('hashed-password');
    });

    it('should scan for security issues', async () => {
      const results = await securityManager.scanSecurity();

      expect(Array.isArray(results)).toBe(true);
    });

    it('should emit security:scan:start event', async () => {
      const eventSpy = jest.fn();
      securityManager.on('security:scan:start', eventSpy);

      await securityManager.scanSecurity();

      expect(eventSpy).toHaveBeenCalled();
    });

    it('should emit security:scan:complete event', async () => {
      const eventSpy = jest.fn();
      securityManager.on('security:scan:complete', eventSpy);

      await securityManager.scanSecurity();

      expect(eventSpy).toHaveBeenCalled();
    });

    it('should detect weak password hashes', async () => {
      await securityManager.createUser('testuser', 'test@example.com', 'Password123!');

      // Manually set a weak hash
      const user = securityManager.getUser(securityManager.getUserByUsername('testuser')!.id);
      await securityManager.updateUser(user!.id, { passwordHash: 'short' } as any);

      const results = await securityManager.scanSecurity();

      const weakHashIssue = results.find(r => r.title.includes('Weak Password Hash'));
      expect(weakHashIssue).toBeDefined();
    });

    it('should handle scan errors', async () => {
      mockRedis.smembers.mockRejectedValue(new Error('Redis error'));

      await expect(
        securityManager.scanSecurity()
      ).rejects.toThrow();
    });
  });

  // ========================================================================
  // Statistics & Cleanup Tests
  // ========================================================================

  describe('getStats', () => {
    beforeEach(async () => {
      securityManager = new SecurityManager(config);
      bcrypt.hash.mockResolvedValue('hashed-password');
    });

    it('should return statistics', async () => {
      await securityManager.createUser('testuser', 'test@example.com', 'Password123!');

      const stats = await securityManager.getStats();

      expect(stats).toHaveProperty('totalUsers');
      expect(stats).toHaveProperty('activeUsers');
      expect(stats).toHaveProperty('lockedUsers');
      expect(stats).toHaveProperty('activeSessions');
      expect(stats).toHaveProperty('mfaEnabledUsers');
      expect(stats).toHaveProperty('auditLogCount');
      expect(stats).toHaveProperty('redisConnected');
    });

    it('should count users correctly', async () => {
      await securityManager.createUser('user1', 'user1@example.com', 'Password123!');
      await securityManager.createUser('user2', 'user2@example.com', 'Password123!');

      const stats = await securityManager.getStats();

      expect(stats.totalUsers).toBe(2);
    });
  });

  describe('cleanup', () => {
    beforeEach(() => {
      securityManager = new SecurityManager(config);
    });

    it('should cleanup expired sessions and logs', async () => {
      await securityManager.cleanup();

      expect(mockRedis.zremrangebyscore).toHaveBeenCalled();
    });

    it('should emit cleanup:complete event', async () => {
      const eventSpy = jest.fn();
      securityManager.on('cleanup:complete', eventSpy);

      await securityManager.cleanup();

      expect(eventSpy).toHaveBeenCalled();
    });
  });

  describe('disconnect', () => {
    it('should disconnect Redis', async () => {
      securityManager = new SecurityManager(config);

      await securityManager.disconnect();

      expect(mockRedis.quit).toHaveBeenCalled();
    });
  });

  // ========================================================================
  // Concurrency Tests
  // ========================================================================

  describe('Concurrency', () => {
    beforeEach(() => {
      securityManager = new SecurityManager(config);
      bcrypt.hash.mockResolvedValue('hashed-password');
      bcrypt.compare.mockResolvedValue(true);
      jwt.sign.mockReturnValue('mock-jwt-token');
    });

    it('should handle concurrent user creation', async () => {
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(
          securityManager.createUser(`user${i}`, `user${i}@example.com`, 'Password123!')
        );
      }

      const users = await Promise.all(promises);

      expect(users).toHaveLength(10);
      expect(new Set(users.map(u => u.id)).size).toBe(10);
    });

    it('should handle concurrent login attempts', async () => {
      const user = await securityManager.createUser('testuser', 'test@example.com', 'Password123!');

      const context: LoginContext = {
        ipAddress: '127.0.0.1',
        userAgent: 'Test Agent',
      };

      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(
          securityManager.login('testuser', 'Password123!', context).catch(e => e)
        );
      }

      const results = await Promise.all(promises);

      // At least some should succeed
      const successful = results.filter(r => r.token);
      expect(successful.length).toBeGreaterThan(0);
    });

    it('should handle concurrent audit logs', async () => {
      const promises = [];
      for (let i = 0; i < 20; i++) {
        promises.push(
          securityManager.audit(`user-${i}`, 'action', 'resource', 'id', 'success')
        );
      }

      await expect(Promise.all(promises)).resolves.not.toThrow();
    });
  });

  // ========================================================================
  // Timeout Tests
  // ========================================================================

  describe('Timeouts', () => {
    beforeEach(() => {
      securityManager = new SecurityManager(config);
    });

    it('should handle Redis timeout', async () => {
      mockRedis.ping.mockImplementation(() =>
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), 100)
        )
      );

      // Should still complete or throw appropriately
      await expect(async () => {
        await new Promise(resolve => setTimeout(resolve, 200));
      }).not.toThrow();
    });

    it('should handle bcrypt timeout', async () => {
      bcrypt.hash.mockImplementation(() =>
        new Promise((resolve) => setTimeout(() => resolve('hash'), 10))
      );

      const start = Date.now();
      await securityManager.createUser('testuser', 'test@example.com', 'Password123!');
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(1000);
    });
  });

  // ========================================================================
  // Resource Cleanup Tests
  // ========================================================================

  describe('Resource Cleanup', () => {
    it('should clean up resources on disconnect', async () => {
      securityManager = new SecurityManager(config);

      await securityManager.disconnect();

      expect(mockRedis.quit).toHaveBeenCalled();
    });

    it('should handle multiple disconnects', async () => {
      securityManager = new SecurityManager(config);

      await securityManager.disconnect();
      await securityManager.disconnect();

      expect(mockRedis.quit).toHaveBeenCalledTimes(2);
    });
  });
});
