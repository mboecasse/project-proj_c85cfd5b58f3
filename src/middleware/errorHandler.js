// File: src/middleware/errorHandler.js
// Generated: 2025-10-16 10:50:20 UTC
// Project ID: proj_c85cfd5b58f3
// Task ID: task_pu5q3w5jh5bk


const Errors = require('../utils/errors');


const logger = require('../config/logger');

/**
 * Error handler middleware
 * Centralized error handling for all routes
 *
 * @param {Error} err - Error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */


const errorHandler = (err, req, res, next) => {
  let error = {
    name: err.name,
    message: err.message,
    statusCode: err.statusCode,
    stack: err.stack
  };

  // Log error with context (but sanitize for production)
  logger.error('Error occurred', {
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    path: req.path,
    method: req.method,
    statusCode: err.statusCode || 500,
    name: err.name
  });

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = 'Resource not found';
    error = new Errors.NotFoundError(message);
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const message = 'Duplicate field value. Please use another value';
    error = new Errors.ValidationError(message);
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = 'Validation failed. Please check your input';
    error = new Errors.ValidationError(message);
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    const message = 'Invalid token. Please log in again';
    error = new Errors.UnauthorizedError(message);
  }

  if (err.name === 'TokenExpiredError') {
    const message = 'Token expired. Please log in again';
    error = new Errors.UnauthorizedError(message);
  }

  // Get status code and message
  const statusCode = error.statusCode || err.statusCode || 500;
  const message = error.message || err.message || 'Internal Server Error';

  // Build error response
  const errorResponse = {
    success: false,
    error: message,
    statusCode
  };

  res.status(statusCode).json(errorResponse);
};

/**
 * Handle 404 errors - Route not found
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */


const notFound = (req, res, next) => {
  const error = new Errors.NotFoundError(`Route ${req.originalUrl} not found`);
  next(error);
};

/**
 * Async handler wrapper to catch errors in async route handlers
 *
 * @param {Function} fn - Async function to wrap
 * @returns {Function} Express middleware function
 */


const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = {
  errorHandler,
  notFound,
  asyncHandler
};
