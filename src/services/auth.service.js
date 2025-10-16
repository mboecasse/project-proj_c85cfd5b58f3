// File: src/services/auth.service.js
// Generated: 2025-10-16 10:52:31 UTC
// Project ID: proj_c85cfd5b58f3
// Task ID: task_iho6lrtshby6


const Jwt = require('../utils/jwt');


const RedisService = require('./redis.service');


const User = require('../models/User');


const crypto = require('crypto');


const logger = require('../utils/logger');

const { hashPassword, comparePassword, validatePasswordStrength } = require('../utils/password');

/**
 * Authentication Service
 * Handles user authentication, token management, and session tracking
 */
class AuthService {
  constructor() {
    this.redisService = new RedisService();
    this.ACCESS_TOKEN_EXPIRY = '15m';
    this.REFRESH_TOKEN_EXPIRY = '7d';
    this.RESET_TOKEN_EXPIRY = 3600; // 1 hour in seconds
    this.MAX_LOGIN_ATTEMPTS = 5;
    this.LOGIN_ATTEMPT_WINDOW = 900; // 15 minutes in seconds
  }

  /**
   * Register new user
   * @param {Object} userData - User registration data
   * @returns {Promise<Object>} User object and tokens
   */
  async register(userData) {
    try {
      const { email, password, firstName, lastName, phone, dateOfBirth } = userData;

      // Validate password strength
      const passwordValidation = validatePasswordStrength(password);
      if (!passwordValidation.isValid) {
        throw new Error(`Weak password: ${passwordValidation.errors.join(', ')}`);
      }

      // Check if user already exists
      const existingUser = await User.findOne({ email: email.toLowerCase() });
      if (existingUser) {
        logger.warn('Registration attempt with existing email', { email });
        throw new Error('User with this email already exists');
      }

      // Hash password
      const hashedPassword = await hashPassword(password);

      // Create user
      const user = await User.create({
        email: email.toLowerCase(),
        password: hashedPassword,
        firstName,
        lastName,
        phone,
        dateOfBirth,
        role: 'user',
        isEmailVerified: false,
        isActive: true
      });

      // Generate email verification token
      const verificationToken = user.generateEmailVerificationToken();
      await user.save();

      // Generate token pair
      const tokens = this._generateTokenPair(user._id, user.email, user.role);

      // Store refresh token in Redis
      await this._storeRefreshToken(user._id.toString(), tokens.refreshToken);

      logger.info('User registered successfully', { userId: user._id, email: user.email });

      return {
        user: this._sanitizeUser(user),
        tokens
      };
    } catch (error) {
      logger.error('Registration failed', { error: error.message, email: userData.email });
      throw error;
    }
  }

  /**
   * Login user
   * @param {string} email - User email
   * @param {string} password - User password
   * @param {string} ipAddress - Client IP address
   * @returns {Promise<Object>} User object and tokens
   */
  async login(email, password, ipAddress) {
    try {
      // Check login attempts
      const attempts = await this._getLoginAttempts(email);
      if (attempts >= this.MAX_LOGIN_ATTEMPTS) {
        logger.warn('Too many login attempts', { email, ipAddress });
        throw new Error('Too many login attempts. Please try again later.');
      }

      // Find user
      const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
      if (!user) {
        await this._trackLoginAttempt(email, false);
        logger.warn('Login attempt with non-existent email', { email, ipAddress });
        throw new Error('Invalid email or password');
      }

      // Check if user is active
      if (!user.isActive) {
        logger.warn('Login attempt for inactive user', { userId: user._id, email, ipAddress });
        throw new Error('Account is deactivated. Please contact support.');
      }

      // Verify password
      const isPasswordValid = await comparePassword(password, user.password);
      if (!isPasswordValid) {
        await this._trackLoginAttempt(email, false);
        logger.warn('Invalid password attempt', { userId: user._id, email, ipAddress });
        throw new Error('Invalid email or password');
      }

      // Clear login attempts on successful login
      await this._clearLoginAttempts(email);

      // Update last login
      user.lastLogin = new Date();
      await user.save();

      // Generate token pair
      const tokens = this._generateTokenPair(user._id, user.email, user.role);

      // Store refresh token in Redis
      await this._storeRefreshToken(user._id.toString(), tokens.refreshToken);

      // Track successful login
      await this._trackLoginAttempt(email, true);

      logger.info('User logged in successfully', { userId: user._id, email, ipAddress });

      return {
        user: this._sanitizeUser(user),
        tokens
      };
    } catch (error) {
      logger.error('Login failed', { error: error.message, email, ipAddress });
      throw error;
    }
  }

  /**
   * Refresh access token
   * @param {string} refreshToken - Refresh token
   * @returns {Promise<Object>} New token pair
   */
  async refreshToken(refreshToken) {
    try {
      // Verify refresh token
      const decoded = Jwt.verifyRefreshToken(refreshToken);
      if (!decoded) {
        throw new Error('Invalid refresh token');
      }

      // Check if token is blacklisted
      const isBlacklisted = await this._isTokenBlacklisted(refreshToken);
      if (isBlacklisted) {
        throw new Error('Token has been revoked');
      }

      // Verify token exists in Redis
      const storedToken = await this._getRefreshToken(decoded.userId);
      if (!storedToken || storedToken !== refreshToken) {
        throw new Error('Invalid or expired refresh token');
      }

      // Get user
      const user = await User.findById(decoded.userId);
      if (!user || !user.isActive) {
        throw new Error('User not found or inactive');
      }

      // Generate new token pair
      const tokens = this._generateTokenPair(user._id, user.email, user.role);

      // Blacklist old refresh token
      await this._blacklistToken(refreshToken);

      // Store new refresh token
      await this._storeRefreshToken(user._id.toString(), tokens.refreshToken);

      logger.info('Token refreshed successfully', { userId: user._id });

      return { tokens };
    } catch (error) {
      logger.error('Token refresh failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Logout user
   * @param {string} userId - User ID
   * @param {string} refreshToken - Refresh token to invalidate
   * @returns {Promise<void>}
   */
  async logout(userId, refreshToken) {
    try {
      // Blacklist refresh token
      if (refreshToken) {
        await this._blacklistToken(refreshToken);
      }

      // Remove refresh token from Redis
      await this._removeRefreshToken(userId);

      logger.info('User logged out successfully', { userId });
    } catch (error) {
      logger.error('Logout failed', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Request password reset
   * @param {string} email - User email
   * @returns {Promise<string>} Reset token
   */
  async requestPasswordReset(email) {
    try {
      const user = await User.findOne({ email: email.toLowerCase() });
      if (!user) {
        // Don't reveal if email exists
        logger.warn('Password reset requested for non-existent email', { email });
        return null;
      }

      // Generate reset token
      const resetToken = user.generatePasswordResetToken();
      await user.save();

      // Store reset token in Redis with expiry
      await this._storeResetToken(email, resetToken);

      logger.info('Password reset requested', { userId: user._id, email });

      return resetToken;
    } catch (error) {
      logger.error('Password reset request failed', { error: error.message, email });
      throw error;
    }
  }

  /**
   * Reset password
   * @param {string} resetToken - Password reset token
   * @param {string} newPassword - New password
   * @returns {Promise<void>}
   */
  async resetPassword(resetToken, newPassword) {
    try {
      // Hash the token to compare with database
      const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

      // Find user with valid reset token
      const user = await User.findOne({
        passwordResetToken: hashedToken,
        passwordResetExpires: { $gt: Date.now() }
      });

      if (!user) {
        throw new Error('Invalid or expired reset token');
      }

      // Validate password strength
      const passwordValidation = validatePasswordStrength(newPassword);
      if (!passwordValidation.isValid) {
        throw new Error(`Weak password: ${passwordValidation.errors.join(', ')}`);
      }

      // Hash new password
      const hashedPassword = await hashPassword(newPassword);

      // Update password and clear reset token
      user.password = hashedPassword;
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      user.passwordChangedAt = Date.now();
      await user.save();

      // Remove reset token from Redis
      await this._removeResetToken(user.email);

      // Invalidate all existing refresh tokens
      await this._removeRefreshToken(user._id.toString());

      logger.info('Password reset successfully', { userId: user._id });
    } catch (error) {
      logger.error('Password reset failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Change password
   * @param {string} userId - User ID
   * @param {string} currentPassword - Current password
   * @param {string} newPassword - New password
   * @returns {Promise<void>}
   */
  async changePassword(userId, currentPassword, newPassword) {
    try {
      const user = await User.findById(userId).select('+password');
      if (!user) {
        throw new Error('User not found');
      }

      // Verify current password
      const isPasswordValid = await comparePassword(currentPassword, user.password);
      if (!isPasswordValid) {
        throw new Error('Current password is incorrect');
      }

      // Validate new password strength
      const passwordValidation = validatePasswordStrength(newPassword);
      if (!passwordValidation.isValid) {
        throw new Error(`Weak password: ${passwordValidation.errors.join(', ')}`);
      }

      // Check if new password is same as current
      const isSamePassword = await comparePassword(newPassword, user.password);
      if (isSamePassword) {
        throw new Error('New password must be different from current password');
      }

      // Hash new password
      const hashedPassword = await hashPassword(newPassword);

      // Update password
      user.password = hashedPassword;
      user.passwordChangedAt = Date.now();
      await user.save();

      // Invalidate all existing refresh tokens
      await this._removeRefreshToken(userId);

      logger.info('Password changed successfully', { userId });
    } catch (error) {
      logger.error('Password change failed', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Verify email
   * @param {string} verificationToken - Email verification token
   * @returns {Promise<void>}
   */
  async verifyEmail(verificationToken) {
    try {
      // Hash the token to compare with database
      const hashedToken = crypto.createHash('sha256').update(verificationToken).digest('hex');

      // Find user with valid verification token
      const user = await User.findOne({
        emailVerificationToken: hashedToken,
        emailVerificationExpires: { $gt: Date.now() }
      });

      if (!user) {
        throw new Error('Invalid or expired verification token');
      }

      // Update user
      user.isEmailVerified = true;
      user.emailVerificationToken = undefined;
      user.emailVerificationExpires = undefined;
      await user.save();

      logger.info('Email verified successfully', { userId: user._id });
    } catch (error) {
      logger.error('Email verification failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Generate token pair
   * @private
   * @param {string} userId - User ID
   * @param {string} email - User email
   * @param {string} role - User role
   * @returns {Object} Access and refresh tokens
   */
  _generateTokenPair(userId, email, role) {
    const payload = {
      userId: userId.toString(),
      email,
      role
    };

    const accessToken = Jwt.generateAccessToken(payload);
    const refreshToken = Jwt.generateRefreshToken({ userId: userId.toString() });

    return { accessToken, refreshToken };
  }

  /**
   * Sanitize user object
   * @private
   * @param {Object} user - User document
   * @returns {Object} Sanitized user object
   */
  _sanitizeUser(user) {
    const userObj = user.toObject ? user.toObject() : user;
    delete userObj.password;
    delete userObj.__v;
    delete userObj.passwordResetToken;
    delete userObj.passwordResetExpires;
    delete userObj.emailVerificationToken;
    delete userObj.emailVerificationExpires;
    return userObj;
  }

  /**
   * Track login attempt
   * @private
   * @param {string} email - User email
   * @param {boolean} success - Whether login was successful
   * @returns {Promise<void>}
   */
  async _trackLoginAttempt(email, success) {
    try {
      const key = `login_attempts:${email}`;

      if (success) {
        await this.redisService.client.del(key);
      } else {
        const attempts = await this.redisService.client.incr(key);
        if (attempts === 1) {
          await this.redisService.client.expire(key, this.LOGIN_ATTEMPT_WINDOW);
        }
      }
    } catch (error) {
      logger.error('Failed to track login attempt', { error: error.message, email });
    }
  }

  /**
   * Get login attempts count
   * @private
   * @param {string} email - User email
   * @returns {Promise<number>} Number of attempts
   */
  async _getLoginAttempts(email) {
    try {
      const key = `login_attempts:${email}`;
      const attempts = await this.redisService.client.get(key);
      return parseInt(attempts) || 0;
    } catch (error) {
      logger.error('Failed to get login attempts', { error: error.message, email });
      return 0;
    }
  }

  /**
   * Clear login attempts
   * @private
   * @param {string} email - User email
   * @returns {Promise<void>}
   */
  async _clearLoginAttempts(email) {
    try {
      const key = `login_attempts:${email}`;
      await this.redisService.client.del(key);
    } catch (error) {
      logger.error('Failed to clear login attempts', { error: error.message, email });
    }
  }

  /**
   * Store refresh token in Redis
   * @private
   * @param {string} userId - User ID
   * @param {string} token - Refresh token
   * @returns {Promise<void>}
   */
  async _storeRefreshToken(userId, token) {
    try {
      const key = this._getRefreshTokenKey(userId);
      await this.redisService.client.setex(key, 7 * 24 * 60 * 60, token); // 7 days
    } catch (error) {
      logger.error('Failed to store refresh token', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Get refresh token from Redis
   * @private
   * @param {string} userId - User ID
   * @returns {Promise<string|null>} Refresh token
   */
  async _getRefreshToken(userId) {
    try {
      const key = this._getRefreshTokenKey(userId);
      return await this.redisService.client.get(key);
    } catch (error) {
      logger.error('Failed to get refresh token', { error: error.message, userId });
      return null;
    }
  }

  /**
   * Remove refresh token from Redis
   * @private
   * @param {string} userId - User ID
   * @returns {Promise<void>}
   */
  async _removeRefreshToken(userId) {
    try {
      const key = this._getRefreshTokenKey(userId);
      await this.redisService.client.del(key);
    } catch (error) {
      logger.error('Failed to remove refresh token', { error: error.message, userId });
    }
  }

  /**
   * Blacklist token
   * @private
   * @param {string} token - Token to blacklist
   * @returns {Promise<void>}
   */
  async _blacklistToken(token) {
    try {
      const key = this._getBlacklistKey(token);
      const decoded = Jwt.decodeToken(token);
      const expiresIn = decoded.exp - Math.floor(Date.now() / 1000);

      if (expiresIn > 0) {
        await this.redisService.client.setex(key, expiresIn, '1');
      }
    } catch (error) {
      logger.error('Failed to blacklist token', { error: error.message });
    }
  }

  /**
   * Check if token is blacklisted
   * @private
   * @param {string} token - Token to check
   * @returns {Promise<boolean>} True if blacklisted
   */
  async _isTokenBlacklisted(token) {
    try {
      const key = this._getBlacklistKey(token);
      const result = await this.redisService.client.get(key);
      return result !== null;
    } catch (error) {
      logger.error('Failed to check token blacklist', { error: error.message });
      return false;
    }
  }

  /**
   * Store reset token in Redis
   * @private
   * @param {string} email - User email
   * @param {string} token - Reset token
   * @returns {Promise<void>}
   */
  async _storeResetToken(email, token) {
    try {
      const key = this._getResetTokenKey(email);
      await this.redisService.client.setex(key, this.RESET_TOKEN_EXPIRY, token);
    } catch (error) {
      logger.error('Failed to store reset token', { error: error.message, email });
    }
  }

  /**
   * Remove reset token from Redis
   * @private
   * @param {string} email - User email
   * @returns {Promise<void>}
   */
  async _removeResetToken(email) {
    try {
      const key = this._getResetTokenKey(email);
      await this.redisService.client.del(key);
    } catch (error) {
      logger.error('Failed to remove reset token', { error: error.message, email });
    }
  }

  /**
   * Get refresh token Redis key
   * @private
   * @param {string} userId - User ID
   * @returns {string} Redis key
   */
  _getRefreshTokenKey(userId) {
    return `refresh_token:${userId}`;
  }

  /**
   * Get blacklist Redis key
   * @private
   * @param {string} token - Token
   * @returns {string} Redis key
   */
  _getBlacklistKey(token) {
    return `blacklist:${token}`;
  }

  /**
   * Get reset token Redis key
   * @private
   * @param {string} email - User email
   * @returns {string} Redis key
   */
  _getResetTokenKey(email) {
    return `reset_token:${email}`;
  }
}

module.exports = new AuthService();
