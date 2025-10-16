// File: src/models/User.js
// Generated: 2025-10-16 10:42:18 UTC
// Project ID: proj_c85cfd5b58f3
// Task ID: task_acs65cft2urn


const bcrypt = require('bcryptjs');


const crypto = require('crypto');


const jwt = require('jsonwebtoken');


const logger = require('../utils/logger');


const mongoose = require('mongoose');


const validator = require('validator');

/**
 * Validate JWT secrets are configured
 */


const validateJWTSecrets = () => {
  if (!process.env.JWT_ACCESS_SECRET) {
    throw new Error('JWT_ACCESS_SECRET environment variable is required');
  }
  if (!process.env.JWT_REFRESH_SECRET) {
    throw new Error('JWT_REFRESH_SECRET environment variable is required');
  }
};

// Validate on module load
validateJWTSecrets();

/**
 * Address subdocument schema for shipping and billing addresses
 */


const addressSchema = new mongoose.Schema({
  street: {
    type: String,
    required: [true, 'Street address is required'],
    trim: true
  },
  city: {
    type: String,
    required: [true, 'City is required'],
    trim: true
  },
  state: {
    type: String,
    required: [true, 'State is required'],
    trim: true
  },
  zipCode: {
    type: String,
    required: [true, 'ZIP code is required'],
    trim: true
  },
  country: {
    type: String,
    required: [true, 'Country is required'],
    trim: true,
    default: 'United States'
  },
  isDefault: {
    type: Boolean,
    default: false
  }
}, { _id: true, timestamps: true });

/**
 * User schema definition with authentication and profile fields
 */


const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    validate: {
      validator: (value) => validator.isEmail(value),
      message: 'Invalid email format'
    }
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters'],
    select: false
  },
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true,
    maxlength: [50, 'First name cannot exceed 50 characters']
  },
  lastName: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true,
    maxlength: [50, 'Last name cannot exceed 50 characters']
  },
  phone: {
    type: String,
    trim: true,
    validate: {
      validator: function(value) {
        if (!value) return true;
        return validator.isMobilePhone(value, 'any', { strictMode: false });
      },
      message: 'Invalid phone number format'
    }
  },
  dateOfBirth: {
    type: Date,
    validate: {
      validator: function(value) {
        if (!value) return true;
        const age = Math.floor((Date.now() - value.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
        return age >= 13;
      },
      message: 'User must be at least 13 years old'
    }
  },
  avatar: {
    type: String,
    validate: {
      validator: function(value) {
        if (!value) return true;
        return validator.isURL(value, {
          protocols: ['http', 'https'],
          require_protocol: true,
          require_valid_protocol: true,
          allow_underscores: false,
          allow_trailing_dot: false,
          allow_protocol_relative_urls: false
        });
      },
      message: 'Invalid avatar URL'
    }
  },
  shippingAddresses: [addressSchema],
  billingAddress: addressSchema,
  isVerified: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  role: {
    type: String,
    enum: {
      values: ['customer', 'admin', 'vendor'],
      message: '{VALUE} is not a valid role'
    },
    default: 'customer'
  },
  lastLogin: {
    type: Date
  },
  emailVerificationToken: {
    type: String,
    select: false
  },
  emailVerificationExpires: {
    type: Date,
    select: false
  },
  passwordResetToken: {
    type: String,
    select: false
  },
  passwordResetExpires: {
    type: Date,
    select: false
  },
  wishlist: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product'
  }],
  orderHistory: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order'
  }],
  failedLoginAttempts: {
    type: Number,
    default: 0,
    select: false
  },
  accountLockedUntil: {
    type: Date,
    select: false
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

/**
 * Virtual field for full name
 */
userSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

/**
 * Indexes for query performance
 */
userSchema.index({ email: 1 });
userSchema.index({ createdAt: -1 });
userSchema.index({ role: 1 });
userSchema.index({ isActive: 1, isVerified: 1 });

/**
 * Pre-save middleware to hash password before saving
 */
userSchema.pre('save', async function(next) {
  try {
    // Only hash password if it's modified
    if (!this.isModified('password')) {
      return next();
    }

    // Generate salt and hash password
    const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
    this.password = await bcrypt.hash(this.password, saltRounds);

    logger.debug('Password hashed successfully', { userId: this._id });
    next();
  } catch (error) {
    logger.error('Error hashing password', { error: error.message });
    next(error);
  }
});

/**
 * Pre-save middleware to ensure only one default shipping address
 */
userSchema.pre('save', function(next) {
  if (this.isModified('shippingAddresses')) {
    const defaultAddresses = this.shippingAddresses.filter(addr => addr.isDefault);

    if (defaultAddresses.length > 1) {
      // Keep only the last one as default
      this.shippingAddresses.forEach((addr, index) => {
        addr.isDefault = index === this.shippingAddresses.length - 1;
      });
    }
  }
  next();
});

/**
 * Instance method to compare password for authentication
 * @param {string} candidatePassword - Password to compare
 * @returns {Promise<boolean>} True if password matches
 */
userSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    logger.error('Error comparing password', { userId: this._id, error: error.message });
    throw error;
  }
};

/**
 * Instance method to generate JWT authentication token
 * @returns {string} JWT token
 */
userSchema.methods.generateAuthToken = function() {
  try {
    if (!process.env.JWT_ACCESS_SECRET) {
      throw new Error('JWT_ACCESS_SECRET is not configured');
    }

    const payload = {
      id: this._id,
      email: this.email,
      role: this.role
    };

    const token = jwt.sign(
      payload,
      process.env.JWT_ACCESS_SECRET,
      {
        expiresIn: process.env.JWT_ACCESS_EXPIRY || '15m'
      }
    );

    logger.debug('Generated auth token', { userId: this._id });
    return token;
  } catch (error) {
    logger.error('Error generating auth token', { userId: this._id, error: error.message });
    throw error;
  }
};

/**
 * Instance method to generate refresh token
 * @returns {string} JWT refresh token
 */
userSchema.methods.generateRefreshToken = function() {
  try {
    if (!process.env.JWT_REFRESH_SECRET) {
      throw new Error('JWT_REFRESH_SECRET is not configured');
    }

    const payload = {
      id: this._id
    };

    const token = jwt.sign(
      payload,
      process.env.JWT_REFRESH_SECRET,
      {
        expiresIn: process.env.JWT_REFRESH_EXPIRY || '7d'
      }
    );

    logger.debug('Generated refresh token', { userId: this._id });
    return token;
  } catch (error) {
    logger.error('Error generating refresh token', { userId: this._id, error: error.message });
    throw error;
  }
};

/**
 * Instance method to generate password reset token
 * @returns {string} Password reset token
 */
userSchema.methods.generatePasswordResetToken = function() {
  try {
    // Generate random token
    const resetToken = crypto.randomBytes(32).toString('hex');

    // Hash token and set to passwordResetToken field
    this.passwordResetToken = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');

    // Set expiry to 1 hour from now
    this.passwordResetExpires = Date.now() + 60 * 60 * 1000;

    logger.debug('Generated password reset token', { userId: this._id });

    // Return unhashed token to send via email
    return resetToken;
  } catch (error) {
    logger.error('Error generating password reset token', { userId: this._id, error: error.message });
    throw error;
  }
};

/**
 * Instance method to generate email verification token
 * @returns {string} Email verification token
 */
userSchema.methods.generateEmailVerificationToken = function() {
  try {
    // Generate random token
    const verificationToken = crypto.randomBytes(32).toString('hex');

    // Hash token and set to emailVerificationToken field
    this.emailVerificationToken = crypto
      .createHash('sha256')
      .update(verificationToken)
      .digest('hex');

    // Set expiry to 24 hours from now
    this.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000;

    logger.debug('Generated email verification token', { userId: this._id });

    // Return unhashed token to send via email
    return verificationToken;
  } catch (error) {
    logger.error('Error generating email verification token', { userId: this._id, error: error.message });
    throw error;
  }
};

/**
 * Instance method to sanitize user object for client response
 * Removes sensitive fields like password and tokens
 * @returns {Object} Sanitized user object
 */
userSchema.methods.toSafeObject = function() {
  const obj = this.toObject();

  // Remove sensitive fields
  delete obj.password;
  delete obj.passwordResetToken;
  delete obj.passwordResetExpires;
  delete obj.emailVerificationToken;
  delete obj.emailVerificationExpires;
  delete obj.failedLoginAttempts;
  delete obj.accountLockedUntil;
  delete obj.__v;

  return obj;
};

/**
 * Instance method to check if account is locked
 * @returns {boolean} True if account is locked
 */
userSchema.methods.isAccountLocked = function() {
  return this.accountLockedUntil && this.accountLockedUntil > Date.now();
};

/**
 * Instance method to increment failed login attempts
 */
userSchema.methods.incrementFailedLoginAttempts = async function() {
  try {
    // If we have a previous lock that has expired, reset attempts
    if (this.accountLockedUntil && this.accountLockedUntil < Date.now()) {
      this.failedLoginAttempts = 1;
      this.accountLockedUntil = undefined;
    } else {
      this.failedLoginAttempts += 1;

      // Lock account for 2 hours after 5 failed attempts
      if (this.failedLoginAttempts >= 5) {
        this.accountLockedUntil = Date.now() + 2 * 60 * 60 * 1000;
        logger.warn('Account locked due to failed login attempts', { userId: this._id, email: this.email });
      }
    }

    await this.save();
  } catch (error) {
    logger.error('Error incrementing failed login attempts', { userId: this._id, error: error.message });
    throw error;
  }
};

/**
 * Instance method to reset failed login attempts
 */
userSchema.methods.resetFailedLoginAttempts = async function() {
  try {
    if (this.failedLoginAttempts > 0 || this.accountLockedUntil) {
      this.failedLoginAttempts = 0;
      this.accountLockedUntil = undefined;
      await this.save();
      logger.debug('Reset failed login attempts', { userId: this._id });
    }
  } catch (error) {
    logger.error('Error resetting failed login attempts', { userId: this._id, error: error.message });
    throw error;
  }
};

/**
 * Instance method to update last login timestamp
 */
userSchema.methods.updateLastLogin = async function() {
  try {
    this.lastLogin = Date.now();
    await this.save();
    logger.debug('Updated last login', { userId: this._id });
  } catch (error) {
    logger.error('Error updating last login', { userId: this._id, error: error.message });
    throw error;
  }
};

/**
 * Static method to find user by email
 * @param {string} email - User email
 * @returns {Promise<User>} User document
 */
userSchema.statics.findByEmail = function(email) {
  return this.findOne({ email: email.toLowerCase() });
};

/**
 * Static method to find active and verified users
 * @returns {Promise<Array>} Array of active users
 */
userSchema.statics.findActiveUsers = function() {
  return this.find({ isActive: true, isVerified: true });
};

/**
 * Static method to find user by password reset token
 * @param {string} token - Reset token
 * @returns {Promise<User>} User document
 */
userSchema.statics.findByPasswordResetToken = function(token) {
  const hashedToken = crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');

  return this.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() }
  });
};

/**
 * Static method to find user by email verification token
 * @param {string} token - Verification token
 * @returns {Promise<User>} User document
 */
userSchema.statics.findByEmailVerificationToken = function(token) {
  const hashedToken = crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');

  return this.findOne({
    emailVerificationToken: hashedToken,
    emailVerificationExpires: { $gt: Date.now() }
  });
};

/**
 * User model
 */


const User = mongoose.model('User', userSchema);

module.exports = User;
