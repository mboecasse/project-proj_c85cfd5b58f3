// File: src/validators/auth.validator.js
// Generated: 2025-10-16 10:40:31 UTC
// Project ID: proj_c85cfd5b58f3
// Task ID: task_hcvv5wmmlin8


const logger = require('../utils/logger');

const { body, validationResult } = require('express-validator');

/**
 * Format validation errors into consistent structure
 *
 * @param {Object} errors - Validation errors from express-validator
 * @returns {Array} Formatted error array
 */


const formatValidationErrors = (errors) => {
  return errors.array().map(err => ({
    field: err.path || err.param,
    message: err.msg
  }));
};

/**
 * Validation middleware wrapper
 * Executes validation rules and returns formatted errors
 *
 * @param {Array} validations - Array of validation rules
 * @returns {Function} Express middleware function
 */


const validate = (validations) => {
  return async (req, res, next) => {
    try {
      // Execute all validations
      for (let validation of validations) {
        const result = await validation.run(req);
        if (result.errors && result.errors.length) break;
      }

      const errors = validationResult(req);
      if (errors.isEmpty()) {
        return next();
      }

      logger.warn('Validation failed', {
        path: req.path,
        method: req.method,
        errors: formatValidationErrors(errors)
      });

      return res.status(400).json({
        success: false,
        errors: formatValidationErrors(errors)
      });
    } catch (error) {
      logger.error('Validation middleware error', { error: error.message });
      next(error);
    }
  };
};

/**
 * Registration validation rules
 * Validates user registration input including email, password, names, and optional phone
 */


const registerValidation = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Valid email is required')
    .normalizeEmail()
    .isLength({ max: 255 }).withMessage('Email must not exceed 255 characters')
    .matches(/^[^\s@]+@[^\s@]+\.[^\s@]+$/).withMessage('Invalid email format'),

  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]+$/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character (@$!%*?&)'),

  body('confirmPassword')
    .notEmpty().withMessage('Password confirmation is required')
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Passwords do not match');
      }
      return true;
    })
    .withMessage('Password confirmation must match password'),

  body('firstName')
    .trim()
    .notEmpty().withMessage('First name is required')
    .isLength({ min: 2, max: 50 }).withMessage('First name must be between 2 and 50 characters')
    .matches(/^[a-zA-Z\s'-]+$/).withMessage('First name can only contain letters, spaces, hyphens, and apostrophes')
    .escape(),

  body('lastName')
    .trim()
    .notEmpty().withMessage('Last name is required')
    .isLength({ min: 2, max: 50 }).withMessage('Last name must be between 2 and 50 characters')
    .matches(/^[a-zA-Z\s'-]+$/).withMessage('Last name can only contain letters, spaces, hyphens, and apostrophes')
    .escape(),

  body('phone')
    .optional()
    .trim()
    .matches(/^\+?[1-9]\d{1,14}$/).withMessage('Invalid phone number format. Use international format (e.g., +1234567890)')
];

/**
 * Login validation rules
 * Validates login credentials (email or username and password)
 */


const loginValidation = [
  body('emailOrUsername')
    .trim()
    .notEmpty().withMessage('Email or username is required')
    .custom((value) => {
      const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
      const isUsername = /^[a-zA-Z0-9_-]{3,30}$/.test(value);

      if (!isEmail && !isUsername) {
        throw new Error('Invalid email or username format');
      }
      return true;
    }),

  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 1 }).withMessage('Password cannot be empty'),

  body('rememberMe')
    .optional()
    .isBoolean().withMessage('Remember me must be a boolean value')
    .toBoolean()
];

/**
 * Forgot password validation rules
 * Validates email for password reset request
 */


const forgotPasswordValidation = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Valid email is required')
    .normalizeEmail()
    .isLength({ max: 255 }).withMessage('Email must not exceed 255 characters')
];

/**
 * Reset password validation rules
 * Validates token and new password for password reset
 */


const resetPasswordValidation = [
  body('token')
    .notEmpty().withMessage('Reset token is required')
    .isLength({ min: 20, max: 500 }).withMessage('Invalid token format')
    .trim(),

  body('newPassword')
    .notEmpty().withMessage('New password is required')
    .isLength({ min: 8 }).withMessage('New password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]+$/)
    .withMessage('New password must contain at least one uppercase letter, one lowercase letter, one number, and one special character (@$!%*?&)'),

  body('confirmPassword')
    .notEmpty().withMessage('Password confirmation is required')
    .custom((value, { req }) => {
      if (value !== req.body.newPassword) {
        throw new Error('Passwords do not match');
      }
      return true;
    })
];

/**
 * Change password validation rules
 * Validates current password and new password for password change
 */


const changePasswordValidation = [
  body('currentPassword')
    .notEmpty().withMessage('Current password is required')
    .isLength({ min: 1 }).withMessage('Current password cannot be empty'),

  body('newPassword')
    .notEmpty().withMessage('New password is required')
    .isLength({ min: 8 }).withMessage('New password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]+$/)
    .withMessage('New password must contain at least one uppercase letter, one lowercase letter, one number, and one special character (@$!%*?&)')
    .custom((value, { req }) => {
      if (value === req.body.currentPassword) {
        throw new Error('New password must be different from current password');
      }
      return true;
    }),

  body('confirmPassword')
    .notEmpty().withMessage('Password confirmation is required')
    .custom((value, { req }) => {
      if (value !== req.body.newPassword) {
        throw new Error('Passwords do not match');
      }
      return true;
    })
];

/**
 * Email verification validation rules
 * Validates verification token
 */


const verifyEmailValidation = [
  body('token')
    .notEmpty().withMessage('Verification token is required')
    .isLength({ min: 20, max: 500 }).withMessage('Invalid token format')
    .trim()
];

/**
 * Resend verification email validation rules
 * Validates email for resending verification
 */


const resendVerificationValidation = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Valid email is required')
    .normalizeEmail()
    .isLength({ max: 255 }).withMessage('Email must not exceed 255 characters')
];

/**
 * Refresh token validation rules
 * Validates refresh token for token refresh
 */


const refreshTokenValidation = [
  body('refreshToken')
    .notEmpty().withMessage('Refresh token is required')
    .isLength({ min: 20 }).withMessage('Invalid refresh token format')
    .trim()
];

/**
 * Logout validation rules
 * Validates refresh token for logout
 */


const logoutValidation = [
  body('refreshToken')
    .optional()
    .isLength({ min: 20 }).withMessage('Invalid refresh token format')
    .trim()
];

/**
 * Update profile validation rules
 * Validates user profile update fields
 */


const updateProfileValidation = [
  body('firstName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 }).withMessage('First name must be between 2 and 50 characters')
    .matches(/^[a-zA-Z\s'-]+$/).withMessage('First name can only contain letters, spaces, hyphens, and apostrophes')
    .escape(),

  body('lastName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 }).withMessage('Last name must be between 2 and 50 characters')
    .matches(/^[a-zA-Z\s'-]+$/).withMessage('Last name can only contain letters, spaces, hyphens, and apostrophes')
    .escape(),

  body('phone')
    .optional()
    .trim()
    .matches(/^\+?[1-9]\d{1,14}$/).withMessage('Invalid phone number format. Use international format (e.g., +1234567890)'),

  body('email')
    .optional()
    .trim()
    .isEmail().withMessage('Valid email is required')
    .normalizeEmail()
    .isLength({ max: 255 }).withMessage('Email must not exceed 255 characters')
];

module.exports = {
  registerValidation,
  loginValidation,
  forgotPasswordValidation,
  resetPasswordValidation,
  changePasswordValidation,
  verifyEmailValidation,
  resendVerificationValidation,
  refreshTokenValidation,
  logoutValidation,
  updateProfileValidation,
  validate,
  formatValidationErrors
};
