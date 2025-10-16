// File: tests/unit/services/auth.service.test.js
// Generated: 2025-10-16 10:56:54 UTC
// Project ID: proj_c85cfd5b58f3
// Task ID: task_lu5sdvk74xsa


const AuthService = require('../../../src/services/auth.service');


const User = require('../../../src/models/User');


const jwt = require('../../../src/utils/jwt');


const logger = require('../../../src/utils/logger');


const redisService = require('../../../src/services/redis.service');

// Mock dependencies
jest.mock('../../../src/models/User');
jest.mock('../../../src/utils/jwt');
jest.mock('../../../src/services/redis.service');
jest.mock('../../../src/utils/logger');

describe('AuthService', () => {
  let authService;

  beforeEach(() => {
    authService = new AuthService();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('register', () => {
    const validUserData = {
      name: 'Test User',
      email: 'test@example.com',
      password: 'Password123!',
      role: 'customer'
    };

    it('should successfully register a new user', async () => {
      const mockUser = {
        _id: 'user123',
        name: validUserData.name,
        email: validUserData.email,
        role: validUserData.role,
        isEmailVerified: false,
        save: jest.fn().mockResolvedValue(true)
      };

      const mockTokens = {
        accessToken: 'access_token_123',
        refreshToken: 'refresh_token_123'
      };

      User.findOne.mockResolvedValue(null);
      User.prototype.save = jest.fn().mockResolvedValue(mockUser);
      User.mockImplementation(() => mockUser);
      jwt.generateTokens.mockReturnValue(mockTokens);
      redisService.setRefreshToken.mockResolvedValue(true);

      const result = await authService.register(validUserData);

      expect(User.findOne).toHaveBeenCalledWith({ email: validUserData.email });
      expect(jwt.generateTokens).toHaveBeenCalledWith(mockUser._id, mockUser.role);
      expect(redisService.setRefreshToken).toHaveBeenCalledWith(
        mockUser._id,
        mockTokens.refreshToken
      );
      expect(result).toEqual({
        user: expect.objectContaining({
          _id: mockUser._id,
          email: mockUser.email,
          name: mockUser.name
        }),
        tokens: mockTokens
      });
    });

    it('should throw error if user already exists', async () => {
      User.findOne.mockResolvedValue({ email: validUserData.email });

      await expect(authService.register(validUserData)).rejects.toThrow(
        'User with this email already exists'
      );

      expect(User.findOne).toHaveBeenCalledWith({ email: validUserData.email });
      expect(jwt.generateTokens).not.toHaveBeenCalled();
    });

    it('should throw error if email is invalid', async () => {
      const invalidData = { ...validUserData, email: 'invalid-email' };

      await expect(authService.register(invalidData)).rejects.toThrow();
    });

    it('should throw error if password is too weak', async () => {
      const weakPasswordData = { ...validUserData, password: '123' };

      await expect(authService.register(weakPasswordData)).rejects.toThrow();
    });

    it('should handle database errors gracefully', async () => {
      User.findOne.mockRejectedValue(new Error('Database connection failed'));

      await expect(authService.register(validUserData)).rejects.toThrow(
        'Database connection failed'
      );

      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('login', () => {
    const loginCredentials = {
      email: 'test@example.com',
      password: 'Password123!',
      ipAddress: '192.168.1.1'
    };

    it('should successfully login with valid credentials', async () => {
      const mockUser = {
        _id: 'user123',
        email: loginCredentials.email,
        password: 'hashed_password',
        role: 'customer',
        isActive: true,
        loginAttempts: 0,
        comparePassword: jest.fn().mockResolvedValue(true),
        save: jest.fn().mockResolvedValue(true)
      };

      const mockTokens = {
        accessToken: 'access_token_123',
        refreshToken: 'refresh_token_123'
      };

      User.findOne.mockResolvedValue(mockUser);
      jwt.generateTokens.mockReturnValue(mockTokens);
      redisService.setRefreshToken.mockResolvedValue(true);

      const result = await authService.login(
        loginCredentials.email,
        loginCredentials.password,
        loginCredentials.ipAddress
      );

      expect(User.findOne).toHaveBeenCalledWith({ email: loginCredentials.email });
      expect(mockUser.comparePassword).toHaveBeenCalledWith(loginCredentials.password);
      expect(jwt.generateTokens).toHaveBeenCalledWith(mockUser._id, mockUser.role);
      expect(result).toEqual({
        user: expect.objectContaining({
          _id: mockUser._id,
          email: mockUser.email
        }),
        tokens: mockTokens
      });
    });

    it('should throw error if user not found', async () => {
      User.findOne.mockResolvedValue(null);

      await expect(
        authService.login(
          loginCredentials.email,
          loginCredentials.password,
          loginCredentials.ipAddress
        )
      ).rejects.toThrow('Invalid credentials');

      expect(User.findOne).toHaveBeenCalledWith({ email: loginCredentials.email });
    });

    it('should throw error if password is incorrect', async () => {
      const mockUser = {
        _id: 'user123',
        email: loginCredentials.email,
        comparePassword: jest.fn().mockResolvedValue(false),
        loginAttempts: 0,
        save: jest.fn().mockResolvedValue(true)
      };

      User.findOne.mockResolvedValue(mockUser);

      await expect(
        authService.login(
          loginCredentials.email,
          loginCredentials.password,
          loginCredentials.ipAddress
        )
      ).rejects.toThrow('Invalid credentials');

      expect(mockUser.comparePassword).toHaveBeenCalledWith(loginCredentials.password);
      expect(mockUser.loginAttempts).toBe(1);
      expect(mockUser.save).toHaveBeenCalled();
    });

    it('should lock account after max failed attempts', async () => {
      const mockUser = {
        _id: 'user123',
        email: loginCredentials.email,
        comparePassword: jest.fn().mockResolvedValue(false),
        loginAttempts: 4,
        isActive: true,
        save: jest.fn().mockResolvedValue(true)
      };

      User.findOne.mockResolvedValue(mockUser);

      await expect(
        authService.login(
          loginCredentials.email,
          loginCredentials.password,
          loginCredentials.ipAddress
        )
      ).rejects.toThrow('Account locked due to too many failed login attempts');

      expect(mockUser.loginAttempts).toBe(5);
      expect(mockUser.isActive).toBe(false);
      expect(mockUser.save).toHaveBeenCalled();
    });

    it('should throw error if account is inactive', async () => {
      const mockUser = {
        _id: 'user123',
        email: loginCredentials.email,
        isActive: false
      };

      User.findOne.mockResolvedValue(mockUser);

      await expect(
        authService.login(
          loginCredentials.email,
          loginCredentials.password,
          loginCredentials.ipAddress
        )
      ).rejects.toThrow('Account is locked or inactive');
    });

    it('should reset login attempts on successful login', async () => {
      const mockUser = {
        _id: 'user123',
        email: loginCredentials.email,
        password: 'hashed_password',
        role: 'customer',
        isActive: true,
        loginAttempts: 2,
        comparePassword: jest.fn().mockResolvedValue(true),
        save: jest.fn().mockResolvedValue(true)
      };

      const mockTokens = {
        accessToken: 'access_token_123',
        refreshToken: 'refresh_token_123'
      };

      User.findOne.mockResolvedValue(mockUser);
      jwt.generateTokens.mockReturnValue(mockTokens);
      redisService.setRefreshToken.mockResolvedValue(true);

      await authService.login(
        loginCredentials.email,
        loginCredentials.password,
        loginCredentials.ipAddress
      );

      expect(mockUser.loginAttempts).toBe(0);
      expect(mockUser.save).toHaveBeenCalled();
    });
  });

  describe('refreshToken', () => {
    const validRefreshToken = 'valid_refresh_token';

    it('should successfully refresh tokens with valid refresh token', async () => {
      const mockDecoded = {
        userId: 'user123',
        role: 'customer'
      };

      const mockUser = {
        _id: 'user123',
        role: 'customer',
        isActive: true
      };

      const mockNewTokens = {
        accessToken: 'new_access_token',
        refreshToken: 'new_refresh_token'
      };

      jwt.verifyRefreshToken.mockReturnValue(mockDecoded);
      redisService.getRefreshToken.mockResolvedValue(validRefreshToken);
      User.findById.mockResolvedValue(mockUser);
      jwt.generateTokens.mockReturnValue(mockNewTokens);
      redisService.deleteRefreshToken.mockResolvedValue(true);
      redisService.setRefreshToken.mockResolvedValue(true);

      const result = await authService.refreshToken(validRefreshToken);

      expect(jwt.verifyRefreshToken).toHaveBeenCalledWith(validRefreshToken);
      expect(redisService.getRefreshToken).toHaveBeenCalledWith(mockDecoded.userId);
      expect(User.findById).toHaveBeenCalledWith(mockDecoded.userId);
      expect(jwt.generateTokens).toHaveBeenCalledWith(mockUser._id, mockUser.role);
      expect(redisService.deleteRefreshToken).toHaveBeenCalledWith(mockDecoded.userId);
      expect(redisService.setRefreshToken).toHaveBeenCalledWith(
        mockUser._id,
        mockNewTokens.refreshToken
      );
      expect(result).toEqual({ tokens: mockNewTokens });
    });

    it('should throw error if refresh token is invalid', async () => {
      jwt.verifyRefreshToken.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(authService.refreshToken(validRefreshToken)).rejects.toThrow(
        'Invalid or expired refresh token'
      );

      expect(jwt.verifyRefreshToken).toHaveBeenCalledWith(validRefreshToken);
    });

    it('should throw error if refresh token not found in Redis', async () => {
      const mockDecoded = {
        userId: 'user123',
        role: 'customer'
      };

      jwt.verifyRefreshToken.mockReturnValue(mockDecoded);
      redisService.getRefreshToken.mockResolvedValue(null);

      await expect(authService.refreshToken(validRefreshToken)).rejects.toThrow(
        'Invalid or expired refresh token'
      );

      expect(redisService.getRefreshToken).toHaveBeenCalledWith(mockDecoded.userId);
    });

    it('should throw error if refresh token does not match stored token', async () => {
      const mockDecoded = {
        userId: 'user123',
        role: 'customer'
      };

      jwt.verifyRefreshToken.mockReturnValue(mockDecoded);
      redisService.getRefreshToken.mockResolvedValue('different_token');

      await expect(authService.refreshToken(validRefreshToken)).rejects.toThrow(
        'Invalid or expired refresh token'
      );
    });

    it('should throw error if user not found', async () => {
      const mockDecoded = {
        userId: 'user123',
        role: 'customer'
      };

      jwt.verifyRefreshToken.mockReturnValue(mockDecoded);
      redisService.getRefreshToken.mockResolvedValue(validRefreshToken);
      User.findById.mockResolvedValue(null);

      await expect(authService.refreshToken(validRefreshToken)).rejects.toThrow(
        'User not found'
      );

      expect(User.findById).toHaveBeenCalledWith(mockDecoded.userId);
    });

    it('should throw error if user account is inactive', async () => {
      const mockDecoded = {
        userId: 'user123',
        role: 'customer'
      };

      const mockUser = {
        _id: 'user123',
        role: 'customer',
        isActive: false
      };

      jwt.verifyRefreshToken.mockReturnValue(mockDecoded);
      redisService.getRefreshToken.mockResolvedValue(validRefreshToken);
      User.findById.mockResolvedValue(mockUser);

      await expect(authService.refreshToken(validRefreshToken)).rejects.toThrow(
        'Account is inactive'
      );
    });
  });

  describe('logout', () => {
    const userId = 'user123';
    const refreshToken = 'refresh_token_123';

    it('should successfully logout user', async () => {
      redisService.deleteRefreshToken.mockResolvedValue(true);
      redisService.blacklistToken.mockResolvedValue(true);

      await authService.logout(userId, refreshToken);

      expect(redisService.deleteRefreshToken).toHaveBeenCalledWith(userId);
      expect(redisService.blacklistToken).toHaveBeenCalledWith(refreshToken);
      expect(logger.info).toHaveBeenCalledWith('User logged out', { userId });
    });

    it('should handle Redis errors gracefully', async () => {
      redisService.deleteRefreshToken.mockRejectedValue(
        new Error('Redis connection failed')
      );

      await expect(authService.logout(userId, refreshToken)).rejects.toThrow(
        'Redis connection failed'
      );

      expect(logger.error).toHaveBeenCalled();
    });

    it('should logout even if refresh token does not exist', async () => {
      redisService.deleteRefreshToken.mockResolvedValue(false);
      redisService.blacklistToken.mockResolvedValue(true);

      await authService.logout(userId, refreshToken);

      expect(redisService.deleteRefreshToken).toHaveBeenCalledWith(userId);
      expect(redisService.blacklistToken).toHaveBeenCalledWith(refreshToken);
    });
  });

  describe('requestPasswordReset', () => {
    const email = 'test@example.com';

    it('should generate password reset token for valid email', async () => {
      const mockUser = {
        _id: 'user123',
        email: email
      };

      const mockResetToken = 'reset_token_123';

      User.findOne.mockResolvedValue(mockUser);
      redisService.setPasswordResetToken.mockResolvedValue(mockResetToken);

      const result = await authService.requestPasswordReset(email);

      expect(User.findOne).toHaveBeenCalledWith({ email });
      expect(redisService.setPasswordResetToken).toHaveBeenCalledWith(
        mockUser._id,
        expect.any(String)
      );
      expect(result).toBe(mockResetToken);
      expect(logger.info).toHaveBeenCalledWith('Password reset requested', {
        userId: mockUser._id,
        email
      });
    });

    it('should return null if user not found', async () => {
      User.findOne.mockResolvedValue(null);

      const result = await authService.requestPasswordReset(email);

      expect(User.findOne).toHaveBeenCalledWith({ email });
      expect(redisService.setPasswordResetToken).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });

    it('should handle database errors', async () => {
      User.findOne.mockRejectedValue(new Error('Database error'));

      await expect(authService.requestPasswordReset(email)).rejects.toThrow(
        'Database error'
      );

      expect(logger.error).toHaveBeenCalled();
    });

    it('should generate unique reset tokens', async () => {
      const mockUser = {
        _id: 'user123',
        email: email
      };

      User.findOne.mockResolvedValue(mockUser);
      redisService.setPasswordResetToken.mockResolvedValue('token1');

      const result1 = await authService.requestPasswordReset(email);

      redisService.setPasswordResetToken.mockResolvedValue('token2');

      const result2 = await authService.requestPasswordReset(email);

      expect(result1).not.toBe(result2);
    });
  });

  describe('resetPassword', () => {
    const resetToken = 'reset_token_123';
    const newPassword = 'NewPassword123!';
    const userId = 'user123';

    it('should successfully reset password with valid token', async () => {
      const mockUser = {
        _id: userId,
        password: 'old_hashed_password',
        save: jest.fn().mockResolvedValue(true)
      };

      redisService.getPasswordResetToken.mockResolvedValue(resetToken);
      User.findById.mockResolvedValue(mockUser);
      redisService.deletePasswordResetToken.mockResolvedValue(true);

      await authService.resetPassword(resetToken, newPassword);

      expect(redisService.getPasswordResetToken).toHaveBeenCalledWith(resetToken);
      expect(User.findById).toHaveBeenCalled();
      expect(mockUser.password).toBe(newPassword);
      expect(mockUser.save).toHaveBeenCalled();
      expect(redisService.deletePasswordResetToken).toHaveBeenCalledWith(resetToken);
      expect(logger.info).toHaveBeenCalledWith('Password reset successful', { userId });
    });

    it('should throw error if reset token is invalid', async () => {
      redisService.getPasswordResetToken.mockResolvedValue(null);

      await expect(authService.resetPassword(resetToken, newPassword)).rejects.toThrow(
        'Invalid or expired reset token'
      );

      expect(redisService.getPasswordResetToken).toHaveBeenCalledWith(resetToken);
      expect(User.findById).not.toHaveBeenCalled();
    });

    it('should throw error if user not found', async () => {
      redisService.getPasswordResetToken.mockResolvedValue(resetToken);
      User.findById.mockResolvedValue(null);

      await expect(authService.resetPassword(resetToken, newPassword)).rejects.toThrow(
        'User not found'
      );

      expect(User.findById).toHaveBeenCalled();
    });

    it('should throw error if new password is weak', async () => {
      const weakPassword = '123';

      redisService.getPasswordResetToken.mockResolvedValue(resetToken);

      await expect(authService.resetPassword(resetToken, weakPassword)).rejects.toThrow();
    });

    it('should delete reset token after successful reset', async () => {
      const mockUser = {
        _id: userId,
        password: 'old_hashed_password',
        save: jest.fn().mockResolvedValue(true)
      };

      redisService.getPasswordResetToken.mockResolvedValue(resetToken);
      User.findById.mockResolvedValue(mockUser);
      redisService.deletePasswordResetToken.mockResolvedValue(true);

      await authService.resetPassword(resetToken, newPassword);

      expect(redisService.deletePasswordResetToken).toHaveBeenCalledWith(resetToken);
    });
  });

  describe('changePassword', () => {
    const userId = 'user123';
    const currentPassword = 'CurrentPassword123!';
    const newPassword = 'NewPassword123!';

    it('should successfully change password with correct current password', async () => {
      const mockUser = {
        _id: userId,
        password: 'hashed_current_password',
        comparePassword: jest.fn().mockResolvedValue(true),
        save: jest.fn().mockResolvedValue(true)
      };

      User.findById.mockResolvedValue(mockUser);

      await authService.changePassword(userId, currentPassword, newPassword);

      expect(User.findById).toHaveBeenCalledWith(userId);
      expect(mockUser.comparePassword).toHaveBeenCalledWith(currentPassword);
      expect(mockUser.password).toBe(newPassword);
      expect(mockUser.save).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('Password changed', { userId });
    });

    it('should throw error if user not found', async () => {
      User.findById.mockResolvedValue(null);

      await expect(
        authService.changePassword(userId, currentPassword, newPassword)
      ).rejects.toThrow('User not found');

      expect(User.findById).toHaveBeenCalledWith(userId);
    });

    it('should throw error if current password is incorrect', async () => {
      const mockUser = {
        _id: userId,
        comparePassword: jest.fn().mockResolvedValue(false)
      };

      User.findById.mockResolvedValue(mockUser);

      await expect(
        authService.changePassword(userId, currentPassword, newPassword)
      ).rejects.toThrow('Current password is incorrect');

      expect(mockUser.comparePassword).toHaveBeenCalledWith(currentPassword);
    });

    it('should throw error if new password is weak', async () => {
      const weakPassword = '123';
      const mockUser = {
        _id: userId,
        comparePassword: jest.fn().mockResolvedValue(true)
      };

      User.findById.mockResolvedValue(mockUser);

      await expect(
        authService.changePassword(userId, currentPassword, weakPassword)
      ).rejects.toThrow();
    });

    it('should throw error if new password is same as current password', async () => {
      const mockUser = {
        _id: userId,
        comparePassword: jest.fn().mockResolvedValue(true)
      };

      User.findById.mockResolvedValue(mockUser);

      await expect(
        authService.changePassword(userId, currentPassword, currentPassword)
      ).rejects.toThrow('New password must be different from current password');
    });
  });

  describe('verifyEmail', () => {
    const verificationToken = 'verification_token_123';
    const userId = 'user123';

    it('should successfully verify email with valid token', async () => {
      const mockUser = {
        _id: userId,
        isEmailVerified: false,
        emailVerificationToken: verificationToken,
        save: jest.fn().mockResolvedValue(true)
      };

      User.findOne.mockResolvedValue(mockUser);

      await authService.verifyEmail(verificationToken);

      expect(User.findOne).toHaveBeenCalledWith({ emailVerificationToken: verificationToken });
      expect(mockUser.isEmailVerified).toBe(true);
      expect(mockUser.emailVerificationToken).toBeUndefined();
      expect(mockUser.save).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('Email verified', { userId });
    });

    it('should throw error if verification token is invalid', async () => {
      User.findOne.mockResolvedValue(null);

      await expect(authService.verifyEmail(verificationToken)).rejects.toThrow(
        'Invalid verification token'
      );

      expect(User.findOne).toHaveBeenCalledWith({ emailVerificationToken: verificationToken });
    });

    it('should handle already verified emails gracefully', async () => {
      const mockUser = {
        _id: userId,
        isEmailVerified: true,
        emailVerificationToken: verificationToken,
        save: jest.fn().mockResolvedValue(true)
      };

      User.findOne.mockResolvedValue(mockUser);

      await authService.verifyEmail(verificationToken);

      expect(mockUser.isEmailVerified).toBe(true);
      expect(mockUser.save).toHaveBeenCalled();
    });

    it('should handle database errors', async () => {
      User.findOne.mockRejectedValue(new Error('Database error'));

      await expect(authService.verifyEmail(verificationToken)).rejects.toThrow(
        'Database error'
      );

      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle null or undefined inputs gracefully', async () => {
      await expect(authService.register(null)).rejects.toThrow();
      await expect(authService.login(null, null, null)).rejects.toThrow();
      await expect(authService.refreshToken(null)).rejects.toThrow();
    });

    it('should handle empty string inputs', async () => {
      await expect(authService.register({ email: '', password: '' })).rejects.toThrow();
      await expect(authService.login('', '', '')).rejects.toThrow();
    });

    it('should handle concurrent login attempts with token invalidation', async () => {
      const mockUser = {
        _id: 'user123',
        email: 'test@example.com',
        password: 'hashed_password',
        role: 'customer',
        isActive: true,
        loginAttempts: 0,
        comparePassword: jest.fn().mockResolvedValue(true),
        save: jest.fn().mockResolvedValue(true)
      };

      const mockTokens1 = {
        accessToken: 'access_token_1',
        refreshToken: 'refresh_token_1'
      };

      const mockTokens2 = {
        accessToken: 'access_token_2',
        refreshToken: 'refresh_token_2'
      };

      const mockTokens3 = {
        accessToken: 'access_token_3',
        refreshToken: 'refresh_token_3'
      };

      User.findOne.mockResolvedValue(mockUser);
      jwt.generateTokens
        .mockReturnValueOnce(mockTokens1)
        .mockReturnValueOnce(mockTokens2)
        .mockReturnValueOnce(mockTokens3);

      redisService.setRefreshToken.mockImplementation(async (userId, token) => {
        await redisService.deleteRefreshToken(userId);
        return true;
      });
      redisService.deleteRefreshToken.mockResolvedValue(true);

      const loginPromises = [
        authService.login('test@example.com', 'Password123!', '192.168.1.1'),
        authService.login('test@example.com', 'Password123!', '192.168.1.2'),
        authService.login('test@example.com', 'Password123!', '192.168.1.3')
      ];

      const results = await Promise.all(loginPromises);

      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result).toHaveProperty('user');
        expect(result).toHaveProperty('tokens');
      });

      expect(redisService.deleteRefreshToken).toHaveBeenCalledWith(mockUser._id);
      expect(redisService.setRefreshToken).toHaveBeenCalledTimes(3);

      const tokens = results.map(r => r.tokens.refreshToken);
      expect(new Set(tokens).size).toBe(3);
    });

    it('should handle Redis connection failures with fallback mechanism', async () => {
      const mockUser = {
        _id: 'user123',
        email: 'test@example.com',
        password: 'hashed_password',
        role: 'customer',
        isActive: true,
        loginAttempts: 0,
        comparePassword: jest.fn().mockResolvedValue(true),
        save: jest.fn().mockResolvedValue(true)
      };

      const mockTokens = {
        accessToken: 'token',
        refreshToken: 'refresh'
      };

      User.findOne.mockResolvedValue(mockUser);
      jwt.generateTokens.mockReturnValue(mockTokens);
      redisService.setRefreshToken.mockRejectedValue(new Error('Redis unavailable'));

      const result = await authService.login('test@example.com', 'Password123!', '192.168.1.1');

      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('tokens');
      expect(result.tokens).toEqual(mockTokens);
      expect(logger.warn).toHaveBeenCalledWith(
        'Redis unavailable, proceeding without token storage',
        expect.any(Object)
      );
    });
  });
});
