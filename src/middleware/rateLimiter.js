// File: src/middleware/rateLimiter.js
// Generated: 2025-10-16 10:50:01 UTC
// Project ID: proj_c85cfd5b58f3
// Task ID: task_cx78nymrktrt


const RedisStore = require('rate-limit-redis');


const logger = require('../utils/logger');


const rateLimit = require('express-rate-limit');

const { redisClient } = require('../config/redis');

/**
 * Rate limiter configurations for different endpoint types
 */

// Wrapper to handle Redis connection errors


const createRedisStore = (prefix) => {
  try {
    if (!redisClient || !redisClient.isReady) {
      logger.error('Redis client not available for rate limiting', { prefix });
      return undefined;
    }
    return new RedisStore({
      client: redisClient,
      prefix,
      sendCommand: async (...args) => {
        try {
          return await redisClient.sendCommand(args);
        } catch (error) {
          logger.error('Redis command failed in rate limiter', { error: error.message, prefix });
          throw error;
        }
      }
    });
  } catch (error) {
    logger.error('Failed to create Redis store for rate limiter', { error: error.message, prefix });
    return undefined;
  }
};

// General API rate limiter - 100 requests per 15 minutes


const apiLimiter = rateLimit({
  store: createRedisStore('ratelimit:api:'),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many requests from this IP, please try again later'
  },
  handler: (req, res) => {
    logger.warn('Rate limit exceeded', {
      ip: req.ip,
      path: req.path,
      method: req.method
    });
    res.status(429).json({
      success: false,
      error: 'Too many requests from this IP, please try again later'
    });
  },
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === '/health' || req.path === '/api/health';
  }
});

// Strict rate limiter for authentication endpoints - 5 requests per 15 minutes


const authLimiter = rateLimit({
  store: createRedisStore('ratelimit:auth:'),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  skipFailedRequests: false,
  message: {
    success: false,
    error: 'Too many authentication attempts, please try again later'
  },
  handler: (req, res) => {
    logger.warn('Auth rate limit exceeded', {
      ip: req.ip,
      path: req.path,
      emailProvided: !!(req.body && req.body.email)
    });
    res.status(429).json({
      success: false,
      error: 'Too many authentication attempts, please try again later'
    });
  }
});

// Payment rate limiter - 10 requests per hour


const paymentLimiter = rateLimit({
  store: createRedisStore('ratelimit:payment:'),
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many payment requests, please try again later'
  },
  handler: (req, res) => {
    logger.warn('Payment rate limit exceeded', {
      ip: req.ip,
      userId: req.userId || req.user._id,
      path: req.path
    });
    res.status(429).json({
      success: false,
      error: 'Too many payment requests, please try again later'
    });
  }
});

// Order creation rate limiter - 20 orders per hour


const orderLimiter = rateLimit({
  store: createRedisStore('ratelimit:order:'),
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many order requests, please try again later'
  },
  handler: (req, res) => {
    logger.warn('Order rate limit exceeded', {
      ip: req.ip,
      userId: req.userId || req.user?._id,
      path: req.path
    });
    res.status(429).json({
      success: false,
      error: 'Too many order requests, please try again later'
    });
  }
});

// Cart operations rate limiter - 50 requests per 15 minutes


const cartLimiter = rateLimit({
  store: createRedisStore('ratelimit:cart:'),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many cart operations, please try again later'
  },
  handler: (req, res) => {
    logger.warn('Cart rate limit exceeded', {
      ip: req.ip,
      userId: req.userId || req.user?._id,
      path: req.path
    });
    res.status(429).json({
      success: false,
      error: 'Too many cart operations, please try again later'
    });
  }
});

// Search rate limiter - 30 requests per minute


const searchLimiter = rateLimit({
  store: createRedisStore('ratelimit:search:'),
  windowMs: 60 * 1000, // 1 minute
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many search requests, please slow down'
  },
  handler: (req, res) => {
    logger.warn('Search rate limit exceeded', {
      ip: req.ip,
      path: req.path,
      hasQuery: !!(req.query && req.query.q)
    });
    res.status(429).json({
      success: false,
      error: 'Too many search requests, please slow down'
    });
  }
});

// Create account rate limiter - 3 accounts per day per IP


const createAccountLimiter = rateLimit({
  store: createRedisStore('ratelimit:createaccount:'),
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Maximum account creation limit reached for today'
  },
  handler: (req, res) => {
    logger.warn('Create account rate limit exceeded', {
      ip: req.ip,
      emailProvided: !!(req.body && req.body.email)
    });
    res.status(429).json({
      success: false,
      error: 'Maximum account creation limit reached for today'
    });
  }
});

// Password reset rate limiter - 3 requests per hour


const passwordResetLimiter = rateLimit({
  store: createRedisStore('ratelimit:passwordreset:'),
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many password reset attempts, please try again later'
  },
  handler: (req, res) => {
    logger.warn('Password reset rate limit exceeded', {
      ip: req.ip,
      emailProvided: !!(req.body && req.body.email)
    });
    res.status(429).json({
      success: false,
      error: 'Too many password reset attempts, please try again later'
    });
  }
});

/**
 * Custom rate limiter factory
 * Creates a rate limiter with custom configuration
 *
 * @param {Object} options - Rate limiter options
 * @param {string} options.prefix - Redis key prefix
 * @param {number} options.windowMs - Time window in milliseconds
 * @param {number} options.max - Maximum number of requests
 * @param {string} options.message - Error message
 * @returns {Function} Rate limiter middleware
 */


const createRateLimiter = (options) => {
  const {
    prefix = 'ratelimit:custom:',
    windowMs = 15 * 60 * 1000,
    max = 100,
    message = 'Too many requests, please try again later'
  } = options;

  return rateLimit({
    store: createRedisStore(prefix),
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      error: message
    },
    handler: (req, res) => {
      logger.warn('Custom rate limit exceeded', {
        ip: req.ip,
        path: req.path,
        prefix
      });
      res.status(429).json({
        success: false,
        error: message
      });
    }
  });
};

/**
 * User-specific rate limiter
 * Limits requests per authenticated user instead of IP
 *
 * @param {number} windowMs - Time window in milliseconds
 * @param {number} max - Maximum number of requests
 * @returns {Function} Rate limiter middleware
 */


const userRateLimiter = (windowMs = 15 * 60 * 1000, max = 100) => {
  return rateLimit({
    store: createRedisStore('ratelimit:user:'),
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
      // Use user ID if authenticated, otherwise fall back to IP
      return req.userId || req.user?._id?.toString() || req.ip;
    },
    message: {
      success: false,
      error: 'Too many requests, please try again later'
    },
    handler: (req, res) => {
      logger.warn('User rate limit exceeded', {
        userId: req.userId || req.user?._id,
        ip: req.ip,
        path: req.path
      });
      res.status(429).json({
        success: false,
        error: 'Too many requests, please try again later'
      });
    }
  });
};

module.exports = {
  apiLimiter,
  authLimiter,
  paymentLimiter,
  orderLimiter,
  cartLimiter,
  searchLimiter,
  createAccountLimiter,
  passwordResetLimiter,
  createRateLimiter,
  userRateLimiter
};
