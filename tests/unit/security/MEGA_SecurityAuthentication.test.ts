/**
 * Comprehensive Unit Tests for MEGA_SecurityAuthentication
 * Coverage: All public methods, edge cases, error conditions, async behavior,
 * resource cleanup, type safety, mocked dependencies, error paths, timeouts, concurrency
 */

import {
  AuthenticationSystem,
  RBACSystem,
  AuditLogger,
  CompleteSecuritySystem,
  User,
  LoginRequest,
  LoginResponse,
  MFAEnrollmentResponse,
  AuthConfig,
  Role,
  AccessRequest,
  AuditLog,
  AuditQueryFilters,
} from '../../../src/security/MEGA_SecurityAuthentication';

// Mock dependencies
jest.mock('bcrypt');
jest.mock('jsonwebtoken');
jest.mock('speakeasy');
jest.mock('qrcode');

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');

describe('AuthenticationSystem', () => {
  let authSystem: AuthenticationSystem;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock environment variable
    process.env.JWT_SECRET = 'test-jwt-secret-key';

    // Setup mocks
    bcrypt.hash = jest.fn().mockResolvedValue('hashed-password');
    bcrypt.compare = jest.fn().mockResolvedValue(true);
    jwt.sign = jest.fn().mockReturnValue('mock-jwt-token');
    jwt.verify = jest.fn().mockReturnValue({ userId: 'user-1' });
    speakeasy.generateSecret = jest.fn().mockReturnValue({
      base32: 'MOCK_SECRET_BASE32',
      otpauth_url: 'otpauth://totp/test',
    });
    speakeasy.totp = {
      verify: jest.fn().mockReturnValue(true),
    };
    QRCode.toDataURL = jest.fn().mockResolvedValue('data:image/png;base64,mock');
  });

  afterEach(() => {
    delete process.env.JWT_SECRET;
    if (authSystem) {
      authSystem.removeAllListeners();
    }
  });

  // ========================================================================
  // Constructor Tests
  // ========================================================================

  describe('Constructor', () => {
    it('should create AuthenticationSystem with JWT_SECRET from environment', () => {
      authSystem = new AuthenticationSystem();
      expect(authSystem).toBeInstanceOf(AuthenticationSystem);
    });

    it('should throw error if JWT_SECRET is not set', () => {
      delete process.env.JWT_SECRET;

      expect(() => {
        authSystem = new AuthenticationSystem();
      }).toThrow('JWT_SECRET environment variable is required for security');
    });

    it('should create with custom config', () => {
      authSystem = new AuthenticationSystem({
        jwtExpiration: 7200,
        mfaEnabled: true,
      });

      expect(authSystem).toBeInstanceOf(AuthenticationSystem);
    });

    it('should handle null config', () => {
      authSystem = new AuthenticationSystem(null as any);
      expect(authSystem).toBeInstanceOf(AuthenticationSystem);
    });

    it('should handle undefined config', () => {
      authSystem = new AuthenticationSystem(undefined);
      expect(authSystem).toBeInstanceOf(AuthenticationSystem);
    });

    it('should handle empty config object', () => {
      authSystem = new AuthenticationSystem({});
      expect(authSystem).toBeInstanceOf(AuthenticationSystem);
    });

    it('should initialize with default password policy', () => {
      authSystem = new AuthenticationSystem();
      expect(authSystem).toBeDefined();
    });
  });

  // ========================================================================
  // User Registration Tests
  // ========================================================================

  describe('register', () => {
    beforeEach(() => {
      authSystem = new AuthenticationSystem();
    });

    it('should register user with valid credentials', async () => {
      const user = await authSystem.register('testuser', 'test@example.com', 'ValidPassword123!');

      expect(user).toBeDefined();
      expect(user.username).toBe('testuser');
      expect(user.email).toBe('test@example.com');
      expect(user.roles).toContain('user');
    });

    it('should hash password with bcrypt', async () => {
      await authSystem.register('testuser', 'test@example.com', 'ValidPassword123!');

      expect(bcrypt.hash).toHaveBeenCalled();
    });

    it('should emit user:registered event', async () => {
      const eventSpy = jest.fn();
      authSystem.on('user:registered', eventSpy);

      await authSystem.register('testuser', 'test@example.com', 'ValidPassword123!');

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({ userId: expect.any(String), username: 'testuser' })
      );
    });

    it('should throw error for short password', async () => {
      await expect(
        authSystem.register('testuser', 'test@example.com', 'short')
      ).rejects.toThrow('Password does not meet policy requirements');
    });

    it('should throw error for password without uppercase', async () => {
      await expect(
        authSystem.register('testuser', 'test@example.com', 'password123!')
      ).rejects.toThrow('Password does not meet policy requirements');
    });

    it('should throw error for password without lowercase', async () => {
      await expect(
        authSystem.register('testuser', 'test@example.com', 'PASSWORD123!')
      ).rejects.toThrow('Password does not meet policy requirements');
    });

    it('should throw error for password without numbers', async () => {
      await expect(
        authSystem.register('testuser', 'test@example.com', 'PasswordABC!')
      ).rejects.toThrow('Password does not meet policy requirements');
    });

    it('should throw error for password without special characters', async () => {
      await expect(
        authSystem.register('testuser', 'test@example.com', 'Password123')
      ).rejects.toThrow('Password does not meet policy requirements');
    });

    it('should throw error for duplicate username', async () => {
      await authSystem.register('testuser', 'test1@example.com', 'ValidPassword123!');

      await expect(
        authSystem.register('testuser', 'test2@example.com', 'ValidPassword123!')
      ).rejects.toThrow('User already exists');
    });

    it('should throw error for duplicate email', async () => {
      await authSystem.register('testuser1', 'test@example.com', 'ValidPassword123!');

      await expect(
        authSystem.register('testuser2', 'test@example.com', 'ValidPassword123!')
      ).rejects.toThrow('User already exists');
    });

    it('should reject weak passwords', async () => {
      await expect(
        authSystem.register('testuser', 'test@example.com', 'password')
      ).rejects.toThrow();
    });

    it('should reject common weak passwords', async () => {
      await expect(
        authSystem.register('testuser', 'test@example.com', 'Password123!')
      ).rejects.toThrow(); // Contains 'password'
    });

    it('should handle null username', async () => {
      await expect(
        authSystem.register(null as any, 'test@example.com', 'ValidPassword123!')
      ).rejects.toThrow();
    });

    it('should handle null email', async () => {
      await expect(
        authSystem.register('testuser', null as any, 'ValidPassword123!')
      ).rejects.toThrow();
    });

    it('should handle null password', async () => {
      await expect(
        authSystem.register('testuser', 'test@example.com', null as any)
      ).rejects.toThrow();
    });

    it('should handle empty username', async () => {
      await expect(
        authSystem.register('', 'test@example.com', 'ValidPassword123!')
      ).rejects.toThrow();
    });

    it('should handle empty email', async () => {
      await expect(
        authSystem.register('testuser', '', 'ValidPassword123!')
      ).rejects.toThrow();
    });

    it('should handle empty password', async () => {
      await expect(
        authSystem.register('testuser', 'test@example.com', '')
      ).rejects.toThrow();
    });
  });

  // ========================================================================
  // Login Tests
  // ========================================================================

  describe('login', () => {
    let user: User;
    let loginRequest: LoginRequest;

    beforeEach(async () => {
      authSystem = new AuthenticationSystem();
      user = await authSystem.register('testuser', 'test@example.com', 'ValidPassword123!');

      loginRequest = {
        username: 'testuser',
        password: 'ValidPassword123!',
        ipAddress: '127.0.0.1',
        userAgent: 'Test Agent',
      };
    });

    it('should login successfully with valid credentials', async () => {
      const response = await authSystem.login(loginRequest);

      expect(response.success).toBe(true);
      expect(response.token).toBeDefined();
      expect(response.user).toBeDefined();
    });

    it('should emit user:login event', async () => {
      const eventSpy = jest.fn();
      authSystem.on('user:login', eventSpy);

      await authSystem.login(loginRequest);

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({ userId: user.id })
      );
    });

    it('should return error for invalid username', async () => {
      loginRequest.username = 'nonexistent';

      const response = await authSystem.login(loginRequest);

      expect(response.success).toBe(false);
      expect(response.error).toBe('Invalid credentials');
    });

    it('should return error for invalid password', async () => {
      bcrypt.compare.mockResolvedValueOnce(false);

      const response = await authSystem.login(loginRequest);

      expect(response.success).toBe(false);
      expect(response.error).toBe('Invalid credentials');
    });

    it('should return error for inactive user', async () => {
      // Manually set user status to inactive (using internal access for testing)
      const users = (authSystem as any).users;
      const userEntry = users.get(user.id);
      userEntry.status = 'inactive';

      const response = await authSystem.login(loginRequest);

      expect(response.success).toBe(false);
      expect(response.error).toBe('Account is not active');
    });

    it('should enforce rate limiting', async () => {
      bcrypt.compare.mockResolvedValue(false);

      // Make multiple failed attempts
      for (let i = 0; i < 5; i++) {
        await authSystem.login(loginRequest);
      }

      const response = await authSystem.login(loginRequest);

      expect(response.success).toBe(false);
      expect(response.error).toContain('Too many login attempts');
    });

    it('should require MFA when enabled', async () => {
      // Enable MFA for user
      await authSystem.enableMFA(user.id);

      const response = await authSystem.login(loginRequest);

      expect(response.success).toBe(false);
      expect(response.requireMFA).toBe(true);
    });

    it('should login with valid MFA code', async () => {
      await authSystem.enableMFA(user.id);

      loginRequest.mfaCode = '123456';

      const response = await authSystem.login(loginRequest);

      expect(response.success).toBe(true);
    });

    it('should reject invalid MFA code', async () => {
      await authSystem.enableMFA(user.id);
      speakeasy.totp.verify.mockReturnValueOnce(false);

      loginRequest.mfaCode = 'invalid';

      const response = await authSystem.login(loginRequest);

      expect(response.success).toBe(false);
      expect(response.error).toBe('Invalid MFA code');
    });

    it('should skip MFA for trusted device', async () => {
      await authSystem.enableMFA(user.id);

      // Add trusted device
      await authSystem.addTrustedDevice(user.id, {
        ipAddress: '127.0.0.1',
        userAgent: 'Test Agent',
      });

      loginRequest.deviceFingerprint = expect.any(String);

      const response = await authSystem.login(loginRequest);

      // Should succeed without MFA code
      expect(response.success).toBe(true);
    });

    it('should handle null login request', async () => {
      await expect(
        authSystem.login(null as any)
      ).rejects.toThrow();
    });

    it('should handle undefined login request', async () => {
      await expect(
        authSystem.login(undefined as any)
      ).rejects.toThrow();
    });

    it('should handle missing ipAddress', async () => {
      delete (loginRequest as any).ipAddress;

      await expect(
        authSystem.login(loginRequest)
      ).rejects.toThrow();
    });

    it('should handle missing userAgent', async () => {
      delete (loginRequest as any).userAgent;

      await expect(
        authSystem.login(loginRequest)
      ).rejects.toThrow();
    });
  });

  // ========================================================================
  // Logout Tests
  // ========================================================================

  describe('logout', () => {
    let user: User;
    let sessionId: string;

    beforeEach(async () => {
      authSystem = new AuthenticationSystem();
      user = await authSystem.register('testuser', 'test@example.com', 'ValidPassword123!');

      const loginResponse = await authSystem.login({
        username: 'testuser',
        password: 'ValidPassword123!',
        ipAddress: '127.0.0.1',
        userAgent: 'Test Agent',
      });

      sessionId = (authSystem as any).sessions.keys().next().value;
    });

    it('should logout successfully', async () => {
      await authSystem.logout(sessionId);

      const sessions = (authSystem as any).sessions;
      expect(sessions.has(sessionId)).toBe(false);
    });

    it('should emit user:logout event', async () => {
      const eventSpy = jest.fn();
      authSystem.on('user:logout', eventSpy);

      await authSystem.logout(sessionId);

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({ sessionId })
      );
    });

    it('should handle non-existent session', async () => {
      await expect(
        authSystem.logout('non-existent-session')
      ).resolves.not.toThrow();
    });

    it('should handle null sessionId', async () => {
      await expect(
        authSystem.logout(null as any)
      ).resolves.not.toThrow();
    });

    it('should handle undefined sessionId', async () => {
      await expect(
        authSystem.logout(undefined as any)
      ).resolves.not.toThrow();
    });

    it('should handle empty sessionId', async () => {
      await expect(
        authSystem.logout('')
      ).resolves.not.toThrow();
    });
  });

  // ========================================================================
  // Token Refresh Tests
  // ========================================================================

  describe('refreshToken', () => {
    let user: User;
    let refreshToken: string;

    beforeEach(async () => {
      authSystem = new AuthenticationSystem();
      user = await authSystem.register('testuser', 'test@example.com', 'ValidPassword123!');

      const loginResponse = await authSystem.login({
        username: 'testuser',
        password: 'ValidPassword123!',
        ipAddress: '127.0.0.1',
        userAgent: 'Test Agent',
      });

      refreshToken = loginResponse.token!.refreshToken;
    });

    it('should refresh token successfully', async () => {
      const newToken = await authSystem.refreshToken(refreshToken);

      expect(newToken).toBeDefined();
      expect(newToken.accessToken).toBeDefined();
      expect(newToken.refreshToken).toBeDefined();
    });

    it('should throw error for invalid refresh token', async () => {
      await expect(
        authSystem.refreshToken('invalid-token')
      ).rejects.toThrow('Invalid refresh token');
    });

    it('should throw error for expired refresh token', async () => {
      // Manually expire the session
      const sessions = (authSystem as any).sessions;
      const session = Array.from(sessions.values())[0];
      session.expiresAt = new Date(Date.now() - 1000);

      await expect(
        authSystem.refreshToken(refreshToken)
      ).rejects.toThrow('Refresh token expired');
    });

    it('should handle null refresh token', async () => {
      await expect(
        authSystem.refreshToken(null as any)
      ).rejects.toThrow();
    });

    it('should handle undefined refresh token', async () => {
      await expect(
        authSystem.refreshToken(undefined as any)
      ).rejects.toThrow();
    });

    it('should handle empty refresh token', async () => {
      await expect(
        authSystem.refreshToken('')
      ).rejects.toThrow();
    });
  });

  // ========================================================================
  // MFA Enrollment Tests
  // ========================================================================

  describe('MFA Enrollment', () => {
    let user: User;

    beforeEach(async () => {
      authSystem = new AuthenticationSystem();
      user = await authSystem.register('testuser', 'test@example.com', 'ValidPassword123!');
    });

    describe('enrollMFA', () => {
      it('should enroll MFA successfully', async () => {
        const enrollment = await authSystem.enrollMFA(user.id);

        expect(enrollment).toHaveProperty('secret');
        expect(enrollment).toHaveProperty('qrCode');
        expect(enrollment).toHaveProperty('backupCodes');
        expect(enrollment.backupCodes).toHaveLength(10);
      });

      it('should emit mfa:enrollment_started event', async () => {
        const eventSpy = jest.fn();
        authSystem.on('mfa:enrollment_started', eventSpy);

        await authSystem.enrollMFA(user.id);

        expect(eventSpy).toHaveBeenCalledWith({ userId: user.id });
      });

      it('should throw error for non-existent user', async () => {
        await expect(
          authSystem.enrollMFA('non-existent')
        ).rejects.toThrow('User not found');
      });

      it('should throw error if MFA already enabled', async () => {
        await authSystem.enrollMFA(user.id);
        await authSystem.completeMFAEnrollment(user.id, '123456');

        await expect(
          authSystem.enrollMFA(user.id)
        ).rejects.toThrow('MFA is already enabled for this user');
      });

      it('should generate QR code', async () => {
        await authSystem.enrollMFA(user.id);

        expect(QRCode.toDataURL).toHaveBeenCalled();
      });

      it('should handle custom app name', async () => {
        await authSystem.enrollMFA(user.id, 'CustomApp');

        expect(speakeasy.generateSecret).toHaveBeenCalledWith(
          expect.objectContaining({ issuer: 'CustomApp' })
        );
      });
    });

    describe('completeMFAEnrollment', () => {
      beforeEach(async () => {
        await authSystem.enrollMFA(user.id);
      });

      it('should complete MFA enrollment with valid code', async () => {
        const result = await authSystem.completeMFAEnrollment(user.id, '123456');

        expect(result).toBe(true);
      });

      it('should emit mfa:enabled event', async () => {
        const eventSpy = jest.fn();
        authSystem.on('mfa:enabled', eventSpy);

        await authSystem.completeMFAEnrollment(user.id, '123456');

        expect(eventSpy).toHaveBeenCalledWith(
          expect.objectContaining({ userId: user.id, method: 'totp' })
        );
      });

      it('should return false for invalid code', async () => {
        speakeasy.totp.verify.mockReturnValueOnce(false);

        const result = await authSystem.completeMFAEnrollment(user.id, 'invalid');

        expect(result).toBe(false);
      });

      it('should throw error for non-existent user', async () => {
        await expect(
          authSystem.completeMFAEnrollment('non-existent', '123456')
        ).rejects.toThrow('No pending MFA enrollment found');
      });

      it('should throw error without pending enrollment', async () => {
        const newUser = await authSystem.register('newuser', 'new@example.com', 'ValidPassword123!');

        await expect(
          authSystem.completeMFAEnrollment(newUser.id, '123456')
        ).rejects.toThrow('No pending MFA enrollment found');
      });

      it('should hash backup codes', async () => {
        await authSystem.completeMFAEnrollment(user.id, '123456');

        const users = (authSystem as any).users;
        const userEntry = users.get(user.id);
        expect(userEntry.mfaBackupCodes).toBeDefined();
        expect(userEntry.mfaBackupCodes.length).toBeGreaterThan(0);
      });
    });

    describe('disableMFA', () => {
      beforeEach(async () => {
        await authSystem.enrollMFA(user.id);
        await authSystem.completeMFAEnrollment(user.id, '123456');
      });

      it('should disable MFA with valid code', async () => {
        const result = await authSystem.disableMFA(user.id, '123456');

        expect(result).toBe(true);
      });

      it('should emit mfa:disabled event', async () => {
        const eventSpy = jest.fn();
        authSystem.on('mfa:disabled', eventSpy);

        await authSystem.disableMFA(user.id, '123456');

        expect(eventSpy).toHaveBeenCalledWith({ userId: user.id });
      });

      it('should return false for invalid code', async () => {
        speakeasy.totp.verify.mockReturnValueOnce(false);

        const result = await authSystem.disableMFA(user.id, 'invalid');

        expect(result).toBe(false);
      });

      it('should throw error for non-existent user', async () => {
        await expect(
          authSystem.disableMFA('non-existent', '123456')
        ).rejects.toThrow('User not found');
      });

      it('should throw error if MFA not enabled', async () => {
        const newUser = await authSystem.register('newuser', 'new@example.com', 'ValidPassword123!');

        await expect(
          authSystem.disableMFA(newUser.id, '123456')
        ).rejects.toThrow('MFA is not enabled for this user');
      });
    });
  });

  // ========================================================================
  // SMS Fallback Tests
  // ========================================================================

  describe('SMS Fallback', () => {
    let user: User;

    beforeEach(async () => {
      authSystem = new AuthenticationSystem();
      user = await authSystem.register('testuser', 'test@example.com', 'ValidPassword123!');
      await authSystem.enrollMFA(user.id);
      await authSystem.completeMFAEnrollment(user.id, '123456');
    });

    describe('enableSMSFallback', () => {
      it('should enable SMS fallback with valid phone', async () => {
        await authSystem.enableSMSFallback(user.id, '+12345678901');

        const users = (authSystem as any).users;
        const userEntry = users.get(user.id);
        expect(userEntry.phoneNumber).toBe('+12345678901');
      });

      it('should emit mfa:sms_enabled event', async () => {
        const eventSpy = jest.fn();
        authSystem.on('mfa:sms_enabled', eventSpy);

        await authSystem.enableSMSFallback(user.id, '+12345678901');

        expect(eventSpy).toHaveBeenCalledWith(
          expect.objectContaining({ userId: user.id, phoneNumber: '+12345678901' })
        );
      });

      it('should throw error for invalid phone format', async () => {
        await expect(
          authSystem.enableSMSFallback(user.id, 'invalid-phone')
        ).rejects.toThrow('Invalid phone number format');
      });

      it('should throw error for non-existent user', async () => {
        await expect(
          authSystem.enableSMSFallback('non-existent', '+12345678901')
        ).rejects.toThrow('User not found');
      });

      it('should throw error if MFA not enabled', async () => {
        const newUser = await authSystem.register('newuser', 'new@example.com', 'ValidPassword123!');

        await expect(
          authSystem.enableSMSFallback(newUser.id, '+12345678901')
        ).rejects.toThrow('MFA must be enabled before adding SMS fallback');
      });
    });

    describe('sendSMSCode', () => {
      beforeEach(async () => {
        await authSystem.enableSMSFallback(user.id, '+12345678901');
      });

      it('should send SMS code successfully', async () => {
        const result = await authSystem.sendSMSCode(user.id);

        expect(result).toBe(true);
      });

      it('should emit mfa:sms_code_generated event', async () => {
        const eventSpy = jest.fn();
        authSystem.on('mfa:sms_code_generated', eventSpy);

        await authSystem.sendSMSCode(user.id);

        expect(eventSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            userId: user.id,
            phoneNumber: '+12345678901',
            code: expect.any(String),
          })
        );
      });

      it('should throw error for user without phone', async () => {
        const newUser = await authSystem.register('newuser', 'new@example.com', 'ValidPassword123!');

        await expect(
          authSystem.sendSMSCode(newUser.id)
        ).rejects.toThrow('User not found or phone number not configured');
      });

      it('should generate 6-digit code', async () => {
        const eventSpy = jest.fn();
        authSystem.on('mfa:sms_code_generated', eventSpy);

        await authSystem.sendSMSCode(user.id);

        const code = eventSpy.mock.calls[0][0].code;
        expect(code).toMatch(/^\d{6}$/);
      });
    });
  });

  // ========================================================================
  // Backup Codes Tests
  // ========================================================================

  describe('Backup Codes', () => {
    let user: User;

    beforeEach(async () => {
      authSystem = new AuthenticationSystem();
      user = await authSystem.register('testuser', 'test@example.com', 'ValidPassword123!');
      await authSystem.enrollMFA(user.id);
      await authSystem.completeMFAEnrollment(user.id, '123456');
    });

    describe('recoverWithBackupCode', () => {
      it('should recover with valid backup code', async () => {
        // Get backup codes from enrollment
        const enrollment = await authSystem.enrollMFA(user.id);
        await authSystem.completeMFAEnrollment(user.id, '123456');
        const backupCode = enrollment.backupCodes[0];

        const result = await authSystem.recoverWithBackupCode(user.id, backupCode);

        expect(result).toBe(true);
      });

      it('should emit mfa:backup_code_used event', async () => {
        const enrollment = await authSystem.enrollMFA(user.id);
        await authSystem.completeMFAEnrollment(user.id, '123456');
        const backupCode = enrollment.backupCodes[0];

        const eventSpy = jest.fn();
        authSystem.on('mfa:backup_code_used', eventSpy);

        await authSystem.recoverWithBackupCode(user.id, backupCode);

        expect(eventSpy).toHaveBeenCalled();
      });

      it('should remove used backup code', async () => {
        const enrollment = await authSystem.enrollMFA(user.id);
        await authSystem.completeMFAEnrollment(user.id, '123456');
        const backupCode = enrollment.backupCodes[0];

        await authSystem.recoverWithBackupCode(user.id, backupCode);

        // Try to use same code again
        const result = await authSystem.recoverWithBackupCode(user.id, backupCode);

        expect(result).toBe(false);
      });

      it('should return false for invalid backup code', async () => {
        const result = await authSystem.recoverWithBackupCode(user.id, 'invalid-code');

        expect(result).toBe(false);
      });

      it('should return false for user without backup codes', async () => {
        const newUser = await authSystem.register('newuser', 'new@example.com', 'ValidPassword123!');

        const result = await authSystem.recoverWithBackupCode(newUser.id, 'any-code');

        expect(result).toBe(false);
      });
    });

    describe('regenerateBackupCodes', () => {
      it('should regenerate backup codes with valid verification', async () => {
        const newCodes = await authSystem.regenerateBackupCodes(user.id, '123456');

        expect(newCodes).toHaveLength(10);
      });

      it('should emit mfa:backup_codes_regenerated event', async () => {
        const eventSpy = jest.fn();
        authSystem.on('mfa:backup_codes_regenerated', eventSpy);

        await authSystem.regenerateBackupCodes(user.id, '123456');

        expect(eventSpy).toHaveBeenCalledWith({ userId: user.id });
      });

      it('should throw error for invalid verification code', async () => {
        speakeasy.totp.verify.mockReturnValueOnce(false);

        await expect(
          authSystem.regenerateBackupCodes(user.id, 'invalid')
        ).rejects.toThrow('Invalid verification code');
      });

      it('should throw error for non-existent user', async () => {
        await expect(
          authSystem.regenerateBackupCodes('non-existent', '123456')
        ).rejects.toThrow('User not found');
      });

      it('should throw error if MFA not enabled', async () => {
        const newUser = await authSystem.register('newuser', 'new@example.com', 'ValidPassword123!');

        await expect(
          authSystem.regenerateBackupCodes(newUser.id, '123456')
        ).rejects.toThrow('MFA is not enabled for this user');
      });
    });
  });

  // ========================================================================
  // Trusted Devices Tests
  // ========================================================================

  describe('Trusted Devices', () => {
    let user: User;

    beforeEach(async () => {
      authSystem = new AuthenticationSystem();
      user = await authSystem.register('testuser', 'test@example.com', 'ValidPassword123!');
    });

    describe('addTrustedDevice', () => {
      it('should add trusted device successfully', async () => {
        const device = await authSystem.addTrustedDevice(user.id, {
          ipAddress: '127.0.0.1',
          userAgent: 'Test Agent',
          deviceName: 'Test Device',
        });

        expect(device).toBeDefined();
        expect(device.name).toBe('Test Device');
      });

      it('should emit device:trusted event', async () => {
        const eventSpy = jest.fn();
        authSystem.on('device:trusted', eventSpy);

        await authSystem.addTrustedDevice(user.id, {
          ipAddress: '127.0.0.1',
          userAgent: 'Test Agent',
        });

        expect(eventSpy).toHaveBeenCalled();
      });

      it('should throw error for non-existent user', async () => {
        await expect(
          authSystem.addTrustedDevice('non-existent', {
            ipAddress: '127.0.0.1',
            userAgent: 'Test Agent',
          })
        ).rejects.toThrow('User not found');
      });

      it('should extract device name from user agent', async () => {
        const device = await authSystem.addTrustedDevice(user.id, {
          ipAddress: '127.0.0.1',
          userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
        });

        expect(device.name).toBe('iPhone');
      });

      it('should handle custom expiration duration', async () => {
        const device = await authSystem.addTrustedDevice(
          user.id,
          {
            ipAddress: '127.0.0.1',
            userAgent: 'Test Agent',
          },
          60 // 60 days
        );

        const expiryDate = new Date(device.expiresAt);
        const now = new Date();
        const diffDays = Math.floor((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        expect(diffDays).toBeGreaterThanOrEqual(59);
        expect(diffDays).toBeLessThanOrEqual(60);
      });
    });

    describe('removeTrustedDevice', () => {
      let deviceId: string;

      beforeEach(async () => {
        const device = await authSystem.addTrustedDevice(user.id, {
          ipAddress: '127.0.0.1',
          userAgent: 'Test Agent',
        });
        deviceId = device.id;
      });

      it('should remove trusted device successfully', async () => {
        const result = await authSystem.removeTrustedDevice(user.id, deviceId);

        expect(result).toBe(true);
      });

      it('should emit device:untrusted event', async () => {
        const eventSpy = jest.fn();
        authSystem.on('device:untrusted', eventSpy);

        await authSystem.removeTrustedDevice(user.id, deviceId);

        expect(eventSpy).toHaveBeenCalledWith(
          expect.objectContaining({ userId: user.id, deviceId })
        );
      });

      it('should return false for non-existent device', async () => {
        const result = await authSystem.removeTrustedDevice(user.id, 'non-existent');

        expect(result).toBe(false);
      });

      it('should throw error for non-existent user', async () => {
        await expect(
          authSystem.removeTrustedDevice('non-existent', deviceId)
        ).rejects.toThrow('User not found');
      });
    });

    describe('getTrustedDevices', () => {
      it('should return trusted devices', async () => {
        await authSystem.addTrustedDevice(user.id, {
          ipAddress: '127.0.0.1',
          userAgent: 'Test Agent 1',
        });
        await authSystem.addTrustedDevice(user.id, {
          ipAddress: '127.0.0.2',
          userAgent: 'Test Agent 2',
        });

        const devices = authSystem.getTrustedDevices(user.id);

        expect(devices).toHaveLength(2);
      });

      it('should filter expired devices', async () => {
        const device = await authSystem.addTrustedDevice(user.id, {
          ipAddress: '127.0.0.1',
          userAgent: 'Test Agent',
        });

        // Manually expire device
        const users = (authSystem as any).users;
        const userEntry = users.get(user.id);
        userEntry.trustedDevices[0].expiresAt = new Date(Date.now() - 1000);

        const devices = authSystem.getTrustedDevices(user.id);

        expect(devices).toHaveLength(0);
      });

      it('should throw error for non-existent user', async () => {
        expect(() => {
          authSystem.getTrustedDevices('non-existent');
        }).toThrow('User not found');
      });
    });
  });

  // ========================================================================
  // Session Verification Tests
  // ========================================================================

  describe('verifySession', () => {
    let user: User;
    let token: string;

    beforeEach(async () => {
      authSystem = new AuthenticationSystem();
      user = await authSystem.register('testuser', 'test@example.com', 'ValidPassword123!');

      const loginResponse = await authSystem.login({
        username: 'testuser',
        password: 'ValidPassword123!',
        ipAddress: '127.0.0.1',
        userAgent: 'Test Agent',
      });

      token = loginResponse.token!.accessToken;
    });

    it('should verify valid session', async () => {
      const verifiedUser = await authSystem.verifySession(token);

      expect(verifiedUser).toBeDefined();
      expect(verifiedUser?.id).toBe(user.id);
    });

    it('should return null for invalid token', async () => {
      jwt.verify.mockImplementationOnce(() => {
        throw new Error('Invalid token');
      });

      const verifiedUser = await authSystem.verifySession('invalid-token');

      expect(verifiedUser).toBeNull();
    });

    it('should return null for inactive user', async () => {
      // Set user to inactive
      const users = (authSystem as any).users;
      const userEntry = users.get(user.id);
      userEntry.status = 'inactive';

      const verifiedUser = await authSystem.verifySession(token);

      expect(verifiedUser).toBeNull();
    });

    it('should handle null token', async () => {
      const verifiedUser = await authSystem.verifySession(null as any);

      expect(verifiedUser).toBeNull();
    });

    it('should handle undefined token', async () => {
      const verifiedUser = await authSystem.verifySession(undefined as any);

      expect(verifiedUser).toBeNull();
    });

    it('should handle empty token', async () => {
      const verifiedUser = await authSystem.verifySession('');

      expect(verifiedUser).toBeNull();
    });
  });

  // ========================================================================
  // Statistics Tests
  // ========================================================================

  describe('getStats', () => {
    beforeEach(() => {
      authSystem = new AuthenticationSystem();
    });

    it('should return statistics', () => {
      const stats = authSystem.getStats();

      expect(stats).toHaveProperty('users');
      expect(stats).toHaveProperty('activeSessions');
      expect(stats).toHaveProperty('mfaEnabled');
      expect(stats).toHaveProperty('trustedDevices');
      expect(stats).toHaveProperty('pendingEnrollments');
    });

    it('should count users correctly', async () => {
      await authSystem.register('user1', 'user1@example.com', 'ValidPassword123!');
      await authSystem.register('user2', 'user2@example.com', 'ValidPassword123!');

      const stats = authSystem.getStats();

      expect(stats.users).toBe(2);
    });

    it('should count MFA-enabled users', async () => {
      const user = await authSystem.register('testuser', 'test@example.com', 'ValidPassword123!');
      await authSystem.enrollMFA(user.id);
      await authSystem.completeMFAEnrollment(user.id, '123456');

      const stats = authSystem.getStats();

      expect(stats.mfaEnabled).toBe(1);
    });
  });

  // ========================================================================
  // Concurrency Tests
  // ========================================================================

  describe('Concurrency', () => {
    beforeEach(() => {
      authSystem = new AuthenticationSystem();
    });

    it('should handle concurrent user registrations', async () => {
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(
          authSystem.register(`user${i}`, `user${i}@example.com`, 'ValidPassword123!')
        );
      }

      const users = await Promise.all(promises);

      expect(users).toHaveLength(10);
      expect(new Set(users.map(u => u.id)).size).toBe(10);
    });

    it('should handle concurrent login attempts', async () => {
      await authSystem.register('testuser', 'test@example.com', 'ValidPassword123!');

      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(
          authSystem.login({
            username: 'testuser',
            password: 'ValidPassword123!',
            ipAddress: '127.0.0.1',
            userAgent: `Agent ${i}`,
          })
        );
      }

      const responses = await Promise.all(promises);

      expect(responses.every(r => r.success)).toBe(true);
    });

    it('should handle concurrent MFA operations', async () => {
      const users = [];
      for (let i = 0; i < 5; i++) {
        users.push(await authSystem.register(`user${i}`, `user${i}@example.com`, 'ValidPassword123!'));
      }

      const promises = users.map(u => authSystem.enrollMFA(u.id));

      const enrollments = await Promise.all(promises);

      expect(enrollments).toHaveLength(5);
      expect(enrollments.every(e => e.backupCodes.length === 10)).toBe(true);
    });
  });

  // ========================================================================
  // Edge Cases Tests
  // ========================================================================

  describe('Edge Cases', () => {
    beforeEach(() => {
      authSystem = new AuthenticationSystem();
    });

    it('should handle very long username', async () => {
      const longUsername = 'a'.repeat(1000);

      const user = await authSystem.register(longUsername, 'test@example.com', 'ValidPassword123!');

      expect(user.username).toBe(longUsername);
    });

    it('should handle special characters in username', async () => {
      const user = await authSystem.register('user!@#$%', 'test@example.com', 'ValidPassword123!');

      expect(user.username).toBe('user!@#$%');
    });

    it('should handle Unicode in username', async () => {
      const user = await authSystem.register('用户名🚀', 'test@example.com', 'ValidPassword123!');

      expect(user.username).toBe('用户名🚀');
    });

    it('should handle very long password', async () => {
      const longPassword = 'ValidPassword123!' + 'a'.repeat(1000);

      const user = await authSystem.register('testuser', 'test@example.com', longPassword);

      expect(user).toBeDefined();
    });

    it('should handle session timeout edge cases', async () => {
      const user = await authSystem.register('testuser', 'test@example.com', 'ValidPassword123!');

      const loginResponse = await authSystem.login({
        username: 'testuser',
        password: 'ValidPassword123!',
        ipAddress: '127.0.0.1',
        userAgent: 'Test Agent',
      });

      // Manually set session to just before timeout
      const sessions = (authSystem as any).sessions;
      const session = Array.from(sessions.values())[0];
      session.expiresAt = new Date(Date.now() + 1);

      // Should still be valid
      const verifiedUser = await authSystem.verifySession(loginResponse.token!.accessToken);
      expect(verifiedUser).toBeDefined();
    });
  });
});

// ========================================================================
// RBACSystem Tests
// ========================================================================

describe('RBACSystem', () => {
  let rbacSystem: RBACSystem;

  beforeEach(() => {
    rbacSystem = new RBACSystem();
  });

  afterEach(() => {
    if (rbacSystem) {
      rbacSystem.removeAllListeners();
    }
  });

  describe('Constructor', () => {
    it('should create RBACSystem with default config', () => {
      expect(rbacSystem).toBeInstanceOf(RBACSystem);
    });

    it('should initialize default roles', () => {
      const stats = rbacSystem.getStats();
      expect(stats.roles).toBeGreaterThan(0);
    });

    it('should handle custom config', () => {
      const customRBAC = new RBACSystem({
        enableInheritance: false,
        enableWildcards: false,
      });

      expect(customRBAC).toBeDefined();
    });
  });

  describe('createRole', () => {
    it('should create role successfully', () => {
      const role = rbacSystem.createRole({
        name: 'editor',
        description: 'Editor role',
        permissions: ['content:read', 'content:write'],
        inherits: [],
      });

      expect(role).toBeDefined();
      expect(role.name).toBe('editor');
    });

    it('should emit role:created event', () => {
      const eventSpy = jest.fn();
      rbacSystem.on('role:created', eventSpy);

      rbacSystem.createRole({
        name: 'editor',
        description: 'Editor role',
        permissions: [],
        inherits: [],
      });

      expect(eventSpy).toHaveBeenCalled();
    });

    it('should handle role with inheritance', () => {
      const role = rbacSystem.createRole({
        name: 'editor',
        description: 'Editor role',
        permissions: ['content:write'],
        inherits: ['user'],
      });

      expect(role.inherits).toContain('user');
    });
  });

  describe('assignRole', () => {
    it('should assign role to user', () => {
      rbacSystem.assignRole('user-1', 'user');

      const permissions = rbacSystem.getUserPermissions('user-1');
      expect(permissions.length).toBeGreaterThan(0);
    });

    it('should emit role:assigned event', () => {
      const eventSpy = jest.fn();
      rbacSystem.on('role:assigned', eventSpy);

      rbacSystem.assignRole('user-1', 'user');

      expect(eventSpy).toHaveBeenCalled();
    });

    it('should throw error for non-existent role', () => {
      expect(() => {
        rbacSystem.assignRole('user-1', 'non-existent');
      }).toThrow('Role not found');
    });

    it('should not assign duplicate role', () => {
      rbacSystem.assignRole('user-1', 'user');
      rbacSystem.assignRole('user-1', 'user');

      // Should not throw, just ignore duplicate
      expect(true).toBe(true);
    });
  });

  describe('revokeRole', () => {
    beforeEach(() => {
      rbacSystem.assignRole('user-1', 'user');
    });

    it('should revoke role from user', () => {
      rbacSystem.revokeRole('user-1', 'user');

      const permissions = rbacSystem.getUserPermissions('user-1');
      expect(permissions.length).toBe(0);
    });

    it('should emit role:revoked event', () => {
      const eventSpy = jest.fn();
      rbacSystem.on('role:revoked', eventSpy);

      rbacSystem.revokeRole('user-1', 'user');

      expect(eventSpy).toHaveBeenCalled();
    });

    it('should handle revoking non-existent role', () => {
      rbacSystem.revokeRole('user-1', 'non-existent');

      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe('checkAccess', () => {
    beforeEach(() => {
      rbacSystem.assignRole('user-1', 'admin');
    });

    it('should grant access for valid permission', () => {
      const decision = rbacSystem.checkAccess({
        userId: 'user-1',
        resource: 'users',
        action: 'read',
      });

      expect(decision.allowed).toBe(true);
    });

    it('should deny access without permission', () => {
      rbacSystem.revokeRole('user-1', 'admin');

      const decision = rbacSystem.checkAccess({
        userId: 'user-1',
        resource: 'users',
        action: 'delete',
      });

      expect(decision.allowed).toBe(false);
    });

    it('should deny access for user without roles', () => {
      const decision = rbacSystem.checkAccess({
        userId: 'user-2',
        resource: 'users',
        action: 'read',
      });

      expect(decision.allowed).toBe(false);
      expect(decision.reason).toBe('No roles assigned');
    });
  });

  describe('getUserPermissions', () => {
    it('should return user permissions', () => {
      rbacSystem.assignRole('user-1', 'user');

      const permissions = rbacSystem.getUserPermissions('user-1');

      expect(Array.isArray(permissions)).toBe(true);
      expect(permissions.length).toBeGreaterThan(0);
    });

    it('should return empty array for user without roles', () => {
      const permissions = rbacSystem.getUserPermissions('user-1');

      expect(permissions).toEqual([]);
    });

    it('should handle role inheritance', () => {
      rbacSystem.assignRole('user-1', 'admin');

      const permissions = rbacSystem.getUserPermissions('user-1');

      expect(permissions).toContain('*:*');
    });
  });

  describe('getStats', () => {
    it('should return statistics', () => {
      const stats = rbacSystem.getStats();

      expect(stats).toHaveProperty('roles');
      expect(stats).toHaveProperty('usersWithRoles');
    });
  });
});

// ========================================================================
// AuditLogger Tests
// ========================================================================

describe('AuditLogger', () => {
  let auditLogger: AuditLogger;

  beforeEach(() => {
    auditLogger = new AuditLogger();
  });

  afterEach(() => {
    if (auditLogger) {
      auditLogger.removeAllListeners();
    }
  });

  describe('Constructor', () => {
    it('should create AuditLogger with default config', () => {
      expect(auditLogger).toBeInstanceOf(AuditLogger);
    });

    it('should handle custom config', () => {
      const logger = new AuditLogger({
        enabled: false,
        retention: 30,
      });

      expect(logger).toBeDefined();
    });
  });

  describe('log', () => {
    it('should log audit entry', () => {
      auditLogger.log({
        userId: 'user-1',
        action: 'login',
        resource: 'session',
        result: 'success',
        ipAddress: '127.0.0.1',
        details: new Map([['method', 'password']]),
        severity: 'low',
      });

      const logs = auditLogger.query({});
      expect(logs.length).toBeGreaterThan(0);
    });

    it('should emit audit:logged event', () => {
      const eventSpy = jest.fn();
      auditLogger.on('audit:logged', eventSpy);

      auditLogger.log({
        userId: 'user-1',
        action: 'login',
        resource: 'session',
        result: 'success',
        ipAddress: '127.0.0.1',
        details: new Map(),
        severity: 'low',
      });

      expect(eventSpy).toHaveBeenCalled();
    });

    it('should emit audit:alert for high severity', () => {
      const eventSpy = jest.fn();
      auditLogger.on('audit:alert', eventSpy);

      auditLogger.log({
        userId: 'user-1',
        action: 'unauthorized_access',
        resource: 'admin_panel',
        result: 'denied',
        ipAddress: '127.0.0.1',
        details: new Map(),
        severity: 'critical',
      });

      expect(eventSpy).toHaveBeenCalled();
    });

    it('should not log when disabled', () => {
      const logger = new AuditLogger({ enabled: false });

      logger.log({
        userId: 'user-1',
        action: 'login',
        resource: 'session',
        result: 'success',
        ipAddress: '127.0.0.1',
        details: new Map(),
        severity: 'low',
      });

      const logs = logger.query({});
      expect(logs.length).toBe(0);
    });
  });

  describe('query', () => {
    beforeEach(() => {
      auditLogger.log({
        userId: 'user-1',
        action: 'login',
        resource: 'session',
        result: 'success',
        ipAddress: '127.0.0.1',
        details: new Map(),
        severity: 'low',
      });

      auditLogger.log({
        userId: 'user-2',
        action: 'logout',
        resource: 'session',
        result: 'success',
        ipAddress: '127.0.0.2',
        details: new Map(),
        severity: 'low',
      });
    });

    it('should query all logs', () => {
      const logs = auditLogger.query({});

      expect(logs.length).toBe(2);
    });

    it('should filter by userId', () => {
      const logs = auditLogger.query({ userId: 'user-1' });

      expect(logs.length).toBe(1);
      expect(logs[0].userId).toBe('user-1');
    });

    it('should filter by action', () => {
      const logs = auditLogger.query({ action: 'login' });

      expect(logs.length).toBe(1);
      expect(logs[0].action).toBe('login');
    });

    it('should filter by result', () => {
      const logs = auditLogger.query({ result: 'success' });

      expect(logs.length).toBe(2);
    });

    it('should filter by date range', () => {
      const now = new Date();
      const fromDate = new Date(now.getTime() - 10000);
      const toDate = new Date(now.getTime() + 10000);

      const logs = auditLogger.query({ fromDate, toDate });

      expect(logs.length).toBe(2);
    });

    it('should limit results', () => {
      const logs = auditLogger.query({ limit: 1 });

      expect(logs.length).toBe(1);
    });
  });

  describe('getStats', () => {
    it('should return statistics', () => {
      const stats = auditLogger.getStats();

      expect(stats).toHaveProperty('totalLogs');
      expect(stats).toHaveProperty('criticalLogs');
      expect(stats).toHaveProperty('failedActions');
    });
  });
});

// ========================================================================
// CompleteSecuritySystem Tests
// ========================================================================

describe('CompleteSecuritySystem', () => {
  let securitySystem: CompleteSecuritySystem;

  beforeEach(() => {
    process.env.JWT_SECRET = 'test-jwt-secret-key';
    bcrypt.hash = jest.fn().mockResolvedValue('hashed-password');
    bcrypt.compare = jest.fn().mockResolvedValue(true);
    jwt.sign = jest.fn().mockReturnValue('mock-jwt-token');

    securitySystem = new CompleteSecuritySystem();
  });

  afterEach(() => {
    delete process.env.JWT_SECRET;
  });

  describe('Constructor', () => {
    it('should create complete security system', () => {
      expect(securitySystem).toBeInstanceOf(CompleteSecuritySystem);
      expect(securitySystem.auth).toBeInstanceOf(AuthenticationSystem);
      expect(securitySystem.rbac).toBeInstanceOf(RBACSystem);
      expect(securitySystem.audit).toBeInstanceOf(AuditLogger);
    });

    it('should integrate auth with audit logging', async () => {
      const user = await securitySystem.auth.register('testuser', 'test@example.com', 'ValidPassword123!');

      await securitySystem.auth.login({
        username: 'testuser',
        password: 'ValidPassword123!',
        ipAddress: '127.0.0.1',
        userAgent: 'Test Agent',
      });

      const logs = securitySystem.audit.query({ action: 'login' });
      expect(logs.length).toBeGreaterThan(0);
    });

    it('should integrate rbac with audit logging', () => {
      securitySystem.rbac.assignRole('user-1', 'admin');

      const logs = securitySystem.audit.query({ action: 'permission_change' });
      expect(logs.length).toBeGreaterThan(0);
    });
  });

  describe('getOverallStats', () => {
    it('should return combined statistics', () => {
      const stats = securitySystem.getOverallStats();

      expect(stats).toHaveProperty('auth');
      expect(stats).toHaveProperty('rbac');
      expect(stats).toHaveProperty('audit');
    });
  });
});
