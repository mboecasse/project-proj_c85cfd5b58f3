// File: src/utils/password.js
// Generated: 2025-10-16 10:40:26 UTC
// Project ID: proj_c85cfd5b58f3
// Task ID: task_e0cghiqkhx3u


const bcrypt = require('bcryptjs');


const logger = require('./logger');

async * Provides secure password hashing and comparison functionality
 * Uses bcryptjs for cryptographic operations
 *
 * @module utils/password
 */

/**
 * Number of salt rounds for bcrypt hashing
 * Higher values = more secure but slower
 * 12 rounds provides good balance between security and performance
 * @constant {number}
 */


const SALT_ROUNDS = 12;

/**
 * Minimum password length requirement
 * @constant {number}
 */


const MIN_PASSWORD_LENGTH = 8;

/**
 * Maximum password length (bcrypt limitation)
 * @constant {number}
 */


const MAX_PASSWORD_LENGTH = 72;

/**
 * Common passwords to reject
 * @constant {Set<string>}
 */


const COMMON_PASSWORDS = new Set([
  'password', 'password123', '123456', '12345678', 'qwerty', 'abc123',
  'monkey', '1234567', 'letmein', 'trustno1', 'dragon', 'baseball',
  'iloveyou', 'master', 'sunshine', 'ashley', 'bailey', 'passw0rd',
  'shadow', '123123', '654321', 'superman', 'qazwsx', 'michael',
  'football', 'welcome', 'jesus', 'ninja', 'mustang', 'password1'
]);

/**
 * Hash a plain text password using bcrypt
 *
 * @async
 * @param {string} plainPassword - The plain text password to hash
 * @returns {Promise<string>} The hashed password
 * @throws {Error} If password is invalid or hashing fails
 *
 * @example
 * const hashedPassword = await hashPassword('mySecurePassword123');
 */


const hashPassword = async (plainPassword) => {
  try {
    // Validate input type
    if (!plainPassword || typeof plainPassword !== 'string') {
      const error = new Error('Password must be a non-empty string');
      logger.error('Password hashing failed: Invalid input type');
      throw error;
    }

    // Validate minimum length
    if (plainPassword.length < MIN_PASSWORD_LENGTH) {
      const error = new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters long`);
      logger.error('Password hashing failed: Password too short');
      throw error;
    }

    // Validate maximum length (bcrypt limitation)
    if (plainPassword.length > MAX_PASSWORD_LENGTH) {
      const error = new Error(`Password must not exceed ${MAX_PASSWORD_LENGTH} characters`);
      logger.error('Password hashing failed: Password too long');
      throw error;
    }

    // Generate salt
    const salt = await bcrypt.genSalt(SALT_ROUNDS);

    // Hash password with salt
    const hashedPassword = await bcrypt.hash(plainPassword, salt);

    logger.debug('Password hashed successfully');

    return hashedPassword;
  } catch (error) {
    // If error is already our validation error, rethrow it
    if (error.message.includes('Password must')) {
      throw error;
    }

    // Log unexpected errors
    logger.error('Unexpected error during password hashing');

    // Throw generic error to avoid exposing internal details
    throw new Error('Password processing failed');
  }
};

/**
 * Compare a plain text password with a hashed password
 * Uses timing-safe comparison to prevent timing attacks
 *
 * @async
 * @param {string} plainPassword - The plain text password to verify
 * @param {string} hashedPassword - The hashed password to compare against
 * @returns {Promise<boolean>} True if passwords match, false otherwise
 *
 * @example
 * const isValid = await comparePassword('myPassword', user.password);
 * if (isValid) {
 *   // Password is correct
 * }
 */


const comparePassword = async (plainPassword, hashedPassword) => {
  try {
    // Validate inputs - return false instead of throwing for security
    // Don't reveal whether password or hash is invalid
    if (!plainPassword || typeof plainPassword !== 'string') {
      logger.warn('Password comparison failed: Invalid plain password input');
      return false;
    }

    if (!hashedPassword || typeof hashedPassword !== 'string') {
      logger.warn('Password comparison failed: Invalid hashed password input');
      return false;
    }

    // Perform timing-safe comparison using bcrypt
    const isMatch = await bcrypt.compare(plainPassword, hashedPassword);

    logger.debug('Password comparison completed');

    return isMatch;
  } catch (error) {
    // Log error but return false instead of throwing
    // This prevents revealing information about the comparison failure
    logger.error('Error during password comparison');

    return false;
  }
};

/**
 * Validate password strength requirements
 * Checks for minimum length, complexity, common passwords, etc.
 *
 * @param {string} password - The password to validate
 * @returns {Object} Validation result with isValid boolean and errors array
 *
 * @example
 * const validation = validatePasswordStrength('weak');
 * if (!validation.isValid) {
 *   console.log(validation.errors);
 * }
 */


const validatePasswordStrength = (password) => {
  const errors = [];

  // Check if password exists
  if (!password || typeof password !== 'string') {
    errors.push('Password is required');
    return { isValid: false, errors };
  }

  // Check minimum length
  if (password.length < MIN_PASSWORD_LENGTH) {
    errors.push(`Password must be at least ${MIN_PASSWORD_LENGTH} characters long`);
  }

  // Check maximum length
  if (password.length > MAX_PASSWORD_LENGTH) {
    errors.push(`Password must not exceed ${MAX_PASSWORD_LENGTH} characters`);
  }

  // Check for at least one uppercase letter
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  // Check for at least one lowercase letter
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  // Check for at least one number
  if (!/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  // Check for at least one special character
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  // Check against common passwords
  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    errors.push('Password is too common. Please choose a more unique password');
  }

  // Check for sequential characters
  if (/(.)\1{2,}/.test(password)) {
    errors.push('Password should not contain repeated characters');
  }

  // Check for common patterns
  if (/^(?:123|abc|qwe)/i.test(password)) {
    errors.push('Password should not start with common patterns');
  }

  const isValid = errors.length === 0;

  if (!isValid) {
    logger.debug('Password strength validation failed');
  }

  return { isValid, errors };
};

/**
 * Check if a password needs rehashing
 * Useful when salt rounds are increased for better security
 *
 * @param {string} hashedPassword - The hashed password to check
 * @returns {boolean} True if password should be rehashed
 *
 * @example
 * if (needsRehash(user.password)) {
 *   user.password = await hashPassword(plainPassword);
 *   await user.save();
 * }
 */


const needsRehash = (hashedPassword) => {
  try {
    if (!hashedPassword || typeof hashedPassword !== 'string') {
      return false;
    }

    // Extract the cost factor (salt rounds) from the hash
    // bcrypt hash format: $2a$[cost]$[salt][hash]
    const rounds = bcrypt.getRounds(hashedPassword);

    // If current rounds are less than our target, needs rehash
    const shouldRehash = rounds < SALT_ROUNDS;

    if (shouldRehash) {
      logger.info('Password needs rehashing');
    }

    return shouldRehash;
  } catch (error) {
    logger.error('Error checking if password needs rehash');
    return false;
  }
};

module.exports = {
  hashPassword,
  comparePassword,
  validatePasswordStrength,
  needsRehash,
  SALT_ROUNDS,
  MIN_PASSWORD_LENGTH,
  MAX_PASSWORD_LENGTH
};
