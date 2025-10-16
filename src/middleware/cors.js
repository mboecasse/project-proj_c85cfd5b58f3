// File: src/middleware/cors.js
// Generated: 2025-10-16 10:49:56 UTC
// Project ID: proj_c85cfd5b58f3
// Task ID: task_gfp9nzdi9y16


const config = require('../config/environment');


const logger = require('../utils/logger');

/**
 * Validate origin against whitelist
 * @param {string} origin - Request origin
 * @param {Function} callback - CORS callback
 */


const corsOriginValidator = (origin, callback) => {
  // Allow requests with no origin (mobile apps, Postman, server-to-server)
  if (!origin) {
    logger.debug('CORS: Allowing request with no origin');
    return callback(null, true);
  }

  // Development mode - allow all origins
  if (config.nodeEnv === 'development') {
    logger.debug('CORS: Development mode - allowing origin', { origin });
    return callback(null, true);
  }

  // Production mode - strict whitelist validation
  const allowedOrigins = config.allowedOrigins || [];

  if (allowedOrigins.includes(origin)) {
    logger.debug('CORS: Origin allowed', { origin });
    return callback(null, true);
  }

  // Check admin origins if configured
  const adminOrigins = config.adminAllowedOrigins || [];
  if (adminOrigins.includes(origin)) {
    logger.debug('CORS: Admin origin allowed', { origin });
    return callback(null, true);
  }

  // Reject unauthorized origin
  logger.warn('CORS: Origin rejected', { origin, allowedOrigins });
  callback(new Error(`Origin ${origin} not allowed by CORS policy`));
};

/**
 * CORS configuration options
 */


const corsOptions = {
  // Origin validation
  origin: corsOriginValidator,

  // Allow credentials (cookies, authorization headers, TLS client certificates)
  // CRITICAL for JWT cookies and session management
  credentials: true,

  // Allowed HTTP methods
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],

  // Allowed request headers
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'X-CSRF-Token',
    'Accept',
    'Origin',
    'Cache-Control',
    'X-File-Name'
  ],

  // Exposed response headers (accessible to client)
  exposedHeaders: [
    'X-Total-Count',
    'X-Page-Count',
    'X-Current-Page',
    'X-Per-Page',
    'X-RateLimit-Limit',
    'X-RateLimit-Remaining',
    'X-RateLimit-Reset',
    'Content-Range',
    'Content-Disposition'
  ],

  // Preflight cache duration (24 hours)
  maxAge: config.corsMaxAge || 86400,

  // Pass CORS preflight response to next handler
  preflightContinue: false,

  // Provide successful OPTIONS response
  optionsSuccessStatus: 204
};

/**
 * Admin-specific CORS configuration
 * Stricter rules for admin endpoints
 */


const adminCorsOptions = {
  origin: (origin, callback) => {
    // No origin requests not allowed for admin
    if (!origin) {
      logger.warn('CORS: Admin endpoint - rejecting no-origin request');
      return callback(new Error('Admin endpoints require valid origin'));
    }

    // Development mode
    if (config.nodeEnv === 'development') {
      logger.debug('CORS: Admin development mode - allowing origin', { origin });
      return callback(null, true);
    }

    // Check admin whitelist
    const adminOrigins = config.adminAllowedOrigins || config.allowedOrigins || [];

    if (adminOrigins.includes(origin)) {
      logger.debug('CORS: Admin origin allowed', { origin });
      return callback(null, true);
    }

    logger.warn('CORS: Admin origin rejected', { origin, adminOrigins });
    callback(new Error(`Admin origin ${origin} not allowed by CORS policy`));
  },

  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: corsOptions.allowedHeaders,
  exposedHeaders: corsOptions.exposedHeaders,
  maxAge: config.corsMaxAge || 86400,
  preflightContinue: false,
  optionsSuccessStatus: 204
};

/**
 * Payment gateway CORS configuration
 * Allows specific payment provider origins
 */


const paymentCorsOptions = {
  origin: (origin, callback) => {
    // Allow no origin for server-to-server payment callbacks
    if (!origin) {
      logger.debug('CORS: Payment callback - allowing no-origin request');
      return callback(null, true);
    }

    const allowedOrigins = [
      ...(config.allowedOrigins || []),
      ...(config.paymentGatewayOrigins || [])
    ];

    if (allowedOrigins.includes(origin)) {
      logger.debug('CORS: Payment origin allowed', { origin });
      return callback(null, true);
    }

    logger.warn('CORS: Payment origin rejected', { origin });
    callback(new Error(`Payment origin ${origin} not allowed`));
  },

  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: corsOptions.allowedHeaders,
  exposedHeaders: corsOptions.exposedHeaders,
  maxAge: 3600, // Shorter cache for payment endpoints
  preflightContinue: false,
  optionsSuccessStatus: 204
};

/**
 * CORS error handler middleware
 * Catches CORS errors and formats response
 */


const corsErrorHandler = (err, req, res, next) => {
  if (err.message && err.message.includes('CORS')) {
    logger.error('CORS error', {
      origin: req.headers.origin,
      method: req.method,
      path: req.path,
      error: err.message
    });

    return res.status(403).json({
      success: false,
      error: 'CORS policy violation',
      message: config.nodeEnv === 'development' ? err.message : 'Origin not allowed'
    });
  }

  next(err);
};

/**
 * Log CORS requests for monitoring
 */


const corsLogger = (req, res, next) => {
  const origin = req.headers.origin;
  const method = req.method;

  if (method === 'OPTIONS') {
    logger.debug('CORS preflight request', {
      origin,
      method: req.headers['access-control-request-method'],
      headers: req.headers['access-control-request-headers']
    });
  } else if (origin) {
    logger.debug('CORS request', { origin, method, path: req.path });
  }

  next();
};

module.exports = {
  corsOptions,
  adminCorsOptions,
  paymentCorsOptions,
  corsErrorHandler,
  corsLogger
};
