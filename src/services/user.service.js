// File: src/services/user.service.js
// Generated: 2025-10-16 10:52:10 UTC
// Project ID: proj_c85cfd5b58f3
// Task ID: task_oaqqjkvdzhsj


const User = require('../models/User');


const bcrypt = require('bcryptjs');


const crypto = require('crypto');


const logger = require('../utils/logger');

/**
 * Custom error classes for user service
 */
class UserNotFoundError extends Error {
  constructor(message = 'User not found') {
    super(message);
    this.name = 'UserNotFoundError';
    this.statusCode = 404;
  }
}

class DuplicateEmailError extends Error {
  constructor(message = 'Email already exists') {
    super(message);
    this.name = 'DuplicateEmailError';
    this.statusCode = 409;
  }
}

class InvalidCredentialsError extends Error {
  constructor(message = 'Invalid credentials') {
    super(message);
    this.name = 'InvalidCredentialsError';
    this.statusCode = 401;
  }
}

class WeakPasswordError extends Error {
  constructor(message = 'Password does not meet strength requirements') {
    super(message);
    this.name = 'WeakPasswordError';
    this.statusCode = 400;
  }
}

/**
 * User Service Class
 * Handles all user-related business logic
 */
class UserService {
  /**
   * Validate password strength
   * @param {string} password - Password to validate
   * @throws {WeakPasswordError} If password doesn't meet requirements
   */
  validatePasswordStrength(password) {
    if (!password || password.length < 8) {
      throw new WeakPasswordError('Password must be at least 8 characters long');
    }

    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    if (!hasUpperCase) {
      throw new WeakPasswordError('Password must contain at least one uppercase letter');
    }

    if (!hasLowerCase) {
      throw new WeakPasswordError('Password must contain at least one lowercase letter');
    }

    if (!hasNumbers) {
      throw new WeakPasswordError('Password must contain at least one number');
    }

    if (!hasSpecialChar) {
      throw new WeakPasswordError('Password must contain at least one special character');
    }

    return true;
  }

  /**
   * Sanitize user object by removing sensitive fields
   * @param {Object} user - User document
   * @returns {Object} Sanitized user object
   */
  sanitizeUser(user) {
    if (!user) return null;

    const userObj = user.toObject ? user.toObject() : user;
    delete userObj.password;
    delete userObj.resetPasswordToken;
    delete userObj.resetPasswordExpire;
    delete userObj.__v;

    return userObj;
  }

  /**
   * Register a new user
   * @param {Object} userData - User registration data
   * @returns {Promise<Object>} Sanitized user object
   */
  async registerUser(userData) {
    try {
      const { email, password, name, phone } = userData;

      // Validate password strength
      this.validatePasswordStrength(password);

      // Check if email already exists
      const existingUser = await User.findOne({ email: email.toLowerCase() });
      if (existingUser) {
        logger.warn('Registration attempt with existing email', { email });
        throw new DuplicateEmailError('User with this email already exists');
      }

      // Hash password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      // Create user with default role
      const user = await User.create({
        name,
        email: email.toLowerCase(),
        password: hashedPassword,
        phone,
        role: 'customer',
        isActive: true
      });

      logger.info('User registered successfully', { userId: user._id, email: user.email });

      return this.sanitizeUser(user);
    } catch (error) {
      logger.error('User registration failed', { error: error.message, email: userData.email });
      throw error;
    }
  }

  /**
   * Authenticate user credentials
   * @param {string} email - User email
   * @param {string} password - User password
   * @returns {Promise<Object>} Sanitized user object
   */
  async authenticateUser(email, password) {
    try {
      // Find user by email
      const user = await User.findOne({ email: email.toLowerCase() });
      if (!user) {
        logger.warn('Authentication attempt with non-existent email', { email });
        throw new InvalidCredentialsError('Invalid email or password');
      }

      // Check if account is active
      if (!user.isActive) {
        logger.warn('Authentication attempt with inactive account', { email, userId: user._id });
        throw new InvalidCredentialsError('Account is deactivated');
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        logger.warn('Authentication attempt with invalid password', { email, userId: user._id });
        throw new InvalidCredentialsError('Invalid email or password');
      }

      logger.info('User authenticated successfully', { userId: user._id, email: user.email });

      return this.sanitizeUser(user);
    } catch (error) {
      logger.error('User authentication failed', { error: error.message, email });
      throw error;
    }
  }

  /**
   * Get user by ID
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Sanitized user object
   */
  async getUserById(userId) {
    try {
      const user = await User.findById(userId).select('-password -resetPasswordToken -resetPasswordExpire -__v');

      if (!user) {
        logger.warn('User not found', { userId });
        throw new UserNotFoundError(`User with ID ${userId} not found`);
      }

      logger.info('User fetched successfully', { userId });

      return user;
    } catch (error) {
      logger.error('Failed to fetch user', { userId, error: error.message });
      throw error;
    }
  }

  /**
   * Update user profile
   * @param {string} userId - User ID
   * @param {Object} updateData - Fields to update
   * @returns {Promise<Object>} Updated sanitized user object
   */
  async updateUserProfile(userId, updateData) {
    try {
      // Prevent updating sensitive fields
      const allowedFields = ['name', 'phone', 'avatar'];
      const filteredData = {};

      allowedFields.forEach(field => {
        if (updateData[field] !== undefined) {
          filteredData[field] = updateData[field];
        }
      });

      const user = await User.findByIdAndUpdate(
        userId,
        filteredData,
        { new: true, runValidators: true }
      ).select('-password -resetPasswordToken -resetPasswordExpire -__v');

      if (!user) {
        logger.warn('User not found for update', { userId });
        throw new UserNotFoundError(`User with ID ${userId} not found`);
      }

      logger.info('User profile updated successfully', { userId });

      return user;
    } catch (error) {
      logger.error('Failed to update user profile', { userId, error: error.message });
      throw error;
    }
  }

  /**
   * Change user password
   * @param {string} userId - User ID
   * @param {string} oldPassword - Current password
   * @param {string} newPassword - New password
   * @returns {Promise<void>}
   */
  async changePassword(userId, oldPassword, newPassword) {
    try {
      // Validate new password strength
      this.validatePasswordStrength(newPassword);

      const user = await User.findById(userId);

      if (!user) {
        logger.warn('User not found for password change', { userId });
        throw new UserNotFoundError(`User with ID ${userId} not found`);
      }

      // Verify old password
      const isPasswordValid = await bcrypt.compare(oldPassword, user.password);
      if (!isPasswordValid) {
        logger.warn('Invalid old password provided', { userId });
        throw new InvalidCredentialsError('Current password is incorrect');
      }

      // Hash new password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(newPassword, salt);

      user.password = hashedPassword;
      await user.save();

      logger.info('Password changed successfully', { userId });
    } catch (error) {
      logger.error('Failed to change password', { userId, error: error.message });
      throw error;
    }
  }

  /**
   * Add address to user profile
   * @param {string} userId - User ID
   * @param {Object} addressData - Address data
   * @returns {Promise<Object>} Updated user object
   */
  async addAddress(userId, addressData) {
    try {
      const { street, city, state, zipCode, country, isDefault } = addressData;

      // Validate required fields
      if (!street || !city || !state || !zipCode || !country) {
        throw new Error('Missing required address fields');
      }

      const user = await User.findById(userId);

      if (!user) {
        logger.warn('User not found for adding address', { userId });
        throw new UserNotFoundError(`User with ID ${userId} not found`);
      }

      // If this is the first address or isDefault is true, set as default
      const setAsDefault = user.addresses.length === 0 || isDefault === true;

      // If setting as default, unset other defaults
      if (setAsDefault) {
        user.addresses.forEach(addr => {
          addr.isDefault = false;
        });
      }

      user.addresses.push({
        street,
        city,
        state,
        zipCode,
        country,
        isDefault: setAsDefault
      });

      await user.save();

      logger.info('Address added successfully', { userId, addressCount: user.addresses.length });

      return this.sanitizeUser(user);
    } catch (error) {
      logger.error('Failed to add address', { userId, error: error.message });
      throw error;
    }
  }

  /**
   * Update specific address
   * @param {string} userId - User ID
   * @param {string} addressId - Address ID
   * @param {Object} addressData - Updated address data
   * @returns {Promise<Object>} Updated user object
   */
  async updateAddress(userId, addressId, addressData) {
    try {
      const user = await User.findById(userId);

      if (!user) {
        logger.warn('User not found for updating address', { userId });
        throw new UserNotFoundError(`User with ID ${userId} not found`);
      }

      const address = user.addresses.id(addressId);
      if (!address) {
        throw new Error('Address not found');
      }

      // Update address fields
      const allowedFields = ['street', 'city', 'state', 'zipCode', 'country', 'isDefault'];
      allowedFields.forEach(field => {
        if (addressData[field] !== undefined) {
          address[field] = addressData[field];
        }
      });

      // If setting as default, unset other defaults
      if (addressData.isDefault === true) {
        user.addresses.forEach(addr => {
          if (addr._id.toString() !== addressId) {
            addr.isDefault = false;
          }
        });
      }

      await user.save();

      logger.info('Address updated successfully', { userId, addressId });

      return this.sanitizeUser(user);
    } catch (error) {
      logger.error('Failed to update address', { userId, addressId, error: error.message });
      throw error;
    }
  }

  /**
   * Delete address from user profile
   * @param {string} userId - User ID
   * @param {string} addressId - Address ID
   * @returns {Promise<Object>} Updated user object
   */
  async deleteAddress(userId, addressId) {
    try {
      const user = await User.findById(userId);

      if (!user) {
        logger.warn('User not found for deleting address', { userId });
        throw new UserNotFoundError(`User with ID ${userId} not found`);
      }

      const address = user.addresses.id(addressId);
      if (!address) {
        throw new Error('Address not found');
      }

      const wasDefault = address.isDefault;
      address.remove();

      // If deleted address was default, set first remaining address as default
      if (wasDefault && user.addresses.length > 0) {
        user.addresses[0].isDefault = true;
      }

      await user.save();

      logger.info('Address deleted successfully', { userId, addressId });

      return this.sanitizeUser(user);
    } catch (error) {
      logger.error('Failed to delete address', { userId, addressId, error: error.message });
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
        logger.warn('Password reset requested for non-existent email', { email });
        throw new UserNotFoundError('User with this email does not exist');
      }

      // Generate reset token
      const resetToken = crypto.randomBytes(32).toString('hex');

      // Hash token and set expiration (1 hour)
      user.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
      user.resetPasswordExpire = Date.now() + 3600000; // 1 hour

      await user.save();

      logger.info('Password reset token generated', { userId: user._id, email });

      return resetToken;
    } catch (error) {
      logger.error('Failed to request password reset', { email, error: error.message });
      throw error;
    }
  }

  /**
   * Reset password using token
   * @param {string} resetToken - Reset token
   * @param {string} newPassword - New password
   * @returns {Promise<void>}
   */
  async resetPassword(resetToken, newPassword) {
    try {
      // Validate new password strength
      this.validatePasswordStrength(newPassword);

      // Hash token to compare with stored hash
      const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

      const user = await User.findOne({
        resetPasswordToken: hashedToken,
        resetPasswordExpire: { $gt: Date.now() }
      });

      if (!user) {
        logger.warn('Invalid or expired reset token', { token: resetToken.substring(0, 10) });
        throw new Error('Invalid or expired reset token');
      }

      // Hash new password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(newPassword, salt);

      user.password = hashedPassword;
      user.resetPasswordToken = undefined;
      user.resetPasswordExpire = undefined;

      await user.save();

      logger.info('Password reset successfully', { userId: user._id });
    } catch (error) {
      logger.error('Failed to reset password', { error: error.message });
      throw error;
    }
  }

  /**
   * Get all users with filters and pagination
   * @param {Object} filters - Filter criteria
   * @param {Object} pagination - Pagination options
   * @returns {Promise<Object>} Users list with metadata
   */
  async getAllUsers(filters = {}, pagination = {}) {
    try {
      const { page = 1, limit = 20 } = pagination;
      const skip = (page - 1) * limit;

      // Build query
      const query = {};

}}}