// File: src/utils/errors.js
// Generated: 2025-10-16 10:42:10 UTC
// Project ID: proj_c85cfd5b58f3
// Task ID: task_xuyj7ansqvpo

async * Provides domain-specific error classes for e-commerce operations
 * and utilities for error transformation and handling.
 *
 * @module utils/errors
 */

/**
 * Base Application Error Class
 * All custom errors extend from this class
 */
class AppError extends Error {
  /**
   * Create an application error
   * @param {string} message - Error message
   * @param {number} statusCode - HTTP status code
   * @param {string} errorCode - Application-specific error code
   * @param {Object} metadata - Additional error context
   */
  constructor(message, statusCode, errorCode, metadata = {}) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.metadata = metadata;
    this.isOperational = true;
    this.timestamp = new Date().toISOString();
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Convert error to JSON format for API responses
   * @returns {Object} JSON representation of error
   */
  toJSON() {
    return {
      success: false,
      error: {
        code: this.errorCode,
        message: this.message,
        statusCode: this.statusCode,
        metadata: this.metadata,
        timestamp: this.timestamp
      }
    };
  }
}

/**
 * Validation Error
 * Used for input validation failures
 */
class ValidationError extends AppError {
  /**
   * Create a validation error
   * @param {string} message - Error message
   * @param {Array} fields - Array of field validation errors
   */
  constructor(message, fields = []) {
    super(message, 400, 'VALIDATION_ERROR', { fields });
  }
}

/**
 * Not Found Error
 * Used when a requested resource doesn't exist
 */
class NotFoundError extends AppError {
  /**
   * Create a not found error
   * @param {string} resource - Type of resource (e.g., 'Product', 'Order')
   * @param {string} identifier - Resource identifier
   */
  constructor(resource, identifier) {
    super(
      `${resource} not found`,
      404,
      'RESOURCE_NOT_FOUND',
      { resource, identifier }
    );
  }
}

/**
 * Authentication Error
 * Used for authentication failures
 */
class AuthenticationError extends AppError {
  /**
   * Create an authentication error
   * @param {string} message - Error message
   */
  constructor(message = 'Authentication failed') {
    super(message, 401, 'AUTHENTICATION_ERROR');
  }
}

/**
 * Authorization Error
 * Used when user lacks required permissions
 */
class AuthorizationError extends AppError {
  /**
   * Create an authorization error
   * @param {string} message - Error message
   */
  constructor(message = 'Insufficient permissions') {
    super(message, 403, 'AUTHORIZATION_ERROR');
  }
}

/**
 * Product Error
 * Used for product-related business logic errors
 */
class ProductError extends AppError {
  /**
   * Create a product error
   * @param {string} message - Error message
   * @param {Object} metadata - Additional context
   */
  constructor(message, metadata = {}) {
    super(message, 400, 'PRODUCT_ERROR', metadata);
  }
}

/**
 * Insufficient Stock Error
 * Used when product stock is insufficient for requested quantity
 */
class InsufficientStockError extends ProductError {
  /**
   * Create an insufficient stock error
   * @param {string} productId - Product identifier
   * @param {number} requested - Requested quantity
   * @param {number} available - Available quantity
   */
  constructor(productId, requested, available) {
    super(
      'Insufficient stock available',
      { productId, requested, available }
    );
    this.errorCode = 'INSUFFICIENT_STOCK';
  }
}

/**
 * Cart Error
 * Used for shopping cart related errors
 */
class CartError extends AppError {
  /**
   * Create a cart error
   * @param {string} message - Error message
   * @param {Object} metadata - Additional context
   */
  constructor(message, metadata = {}) {
    super(message, 400, 'CART_ERROR', metadata);
  }
}

/**
 * Order Error
 * Used for order processing errors
 */
class OrderError extends AppError {
  /**
   * Create an order error
   * @param {string} message - Error message
   * @param {Object} metadata - Additional context
   */
  constructor(message, metadata = {}) {
    super(message, 400, 'ORDER_ERROR', metadata);
  }
}

/**
 * Payment Error
 * Used for payment processing failures
 */
class PaymentError extends AppError {
  /**
   * Create a payment error
   * @param {string} message - Error message
   * @param {Object} metadata - Additional context
   */
  constructor(message, metadata = {}) {
    super(message, 402, 'PAYMENT_ERROR', metadata);
  }
}

/**
 * Conflict Error
 * Used for resource conflicts (e.g., duplicate entries)
 */
class ConflictError extends AppError {
  /**
   * Create a conflict error
   * @param {string} message - Error message
   * @param {Object} metadata - Additional context
   */
  constructor(message, metadata = {}) {
    super(message, 409, 'CONFLICT_ERROR', metadata);
  }
}

/**
 * Database Error
 * Used for database operation failures
 */
class DatabaseError extends AppError {
  /**
   * Create a database error
   * @param {string} message - Error message
   * @param {Error} originalError - Original error from database
   */
  constructor(message, originalError) {
    super(message, 500, 'DATABASE_ERROR', {
      originalMessage: originalError?.message
    });
    this.isOperational = false;
  }
}

/**
 * Transform MongoDB errors to application errors
 * @param {Error} error - MongoDB error
 * @returns {AppError} Transformed application error
 */


const handleMongoError = (error) => {
  // Duplicate key error (code 11000)
  if (error.code === 11000) {
    const field = Object.keys(error.keyPattern || {})[0];
    const value = error.keyValue ? error.keyValue[field] : 'unknown';
    return new ConflictError(
      `${field} already exists`,
      { field, value }
    );
  }

  // Validation error
  if (error.name === 'ValidationError') {
    const fields = Object.keys(error.errors || {}).map(key => ({
      field: key,
      message: error.errors[key].message,
      value: error.errors[key].value
    }));
    return new ValidationError('Validation failed', fields);
  }

  // Cast error (invalid ObjectId, type casting failures)
  if (error.name === 'CastError') {
    return new ValidationError(
      `Invalid ${error.path}: ${error.value}`,
      [{ field: error.path, value: error.value, type: error.kind }]
    );
  }

  // Document not found error
  if (error.name === 'DocumentNotFoundError') {
    return new NotFoundError('Document', error.value);
  }

  // Default to database error
  return new DatabaseError('Database operation failed', error);
};

/**
 * Express error handler middleware
 * Handles all errors and sends appropriate responses
 *
 * @param {Error} err - Error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */


const errorHandler = (err, req, res, next) => {
  let error = err;

  // Transform MongoDB errors
  if (err.name === 'MongoError' ||
      err.name === 'MongoServerError' ||
      err.name === 'ValidationError' ||
      err.name === 'CastError' ||
      err.name === 'DocumentNotFoundError') {
    error = handleMongoError(err);
  }

  // Handle non-operational errors (programming errors)
  if (!error.isOperational) {
    // Don't expose internal error details in production
    if (process.env.NODE_ENV === 'production') {
      return res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred',
          timestamp: new Date().toISOString()
        }
      });
    }

    // In development, include stack trace
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      }
    });
  }

  // Handle operational errors
  const statusCode = error.statusCode || 500;
  const response = error.toJSON ? error.toJSON() : {
    success: false,
    error: {
      code: error.errorCode || 'UNKNOWN_ERROR',
      message: error.message,
      timestamp: new Date().toISOString()
    }
  };

  // Include stack trace in development
  if (process.env.NODE_ENV === 'development') {
    response.error.stack = error.stack;
  }

  res.status(statusCode).json(response);
};

/**
 * Async handler wrapper
 * Wraps async route handlers to catch promise rejections
 *
 * @param {Function} fn - Async function to wrap
 * @returns {Function} Wrapped function
 */


const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * Create a not found error for missing routes
 * @param {string} path - Request path
 * @returns {NotFoundError} Not found error
 */


const createNotFoundError = (path) => {
  return new NotFoundError('Route', path);
};

/**
 * Validate that error is operational
 * @param {Error} error - Error to check
 * @returns {boolean} True if operational error
 */


const isOperationalError = (error) => {
  if (error instanceof AppError) {
    return error.isOperational;
  }
  return false;
};


const Errors = {
  // Base error class
  AppError,

  // Domain-specific errors
  ValidationError,
  NotFoundError,
  AuthenticationError,
  AuthorizationError,
  ProductError,
  InsufficientStockError,
  CartError,
  OrderError,
  PaymentError,
  ConflictError,
  DatabaseError,

  // Utilities
  handleMongoError,
  errorHandler,
  asyncHandler,
  createNotFoundError,
  isOperationalError
};

module.exports = Errors;
