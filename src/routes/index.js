// File: src/routes/index.js
// Generated: 2025-10-16 10:39:24 UTC
// Project ID: proj_c85cfd5b58f3
// Task ID: task_2jnto6pefc5p


const authRoutes = require('./auth.routes');


const cartRoutes = require('./cart.routes');


const categoryRoutes = require('./category.routes');


const express = require('express');


const logger = require('../utils/logger');


const orderRoutes = require('./order.routes');


const paymentRoutes = require('./payment.routes');


const productRoutes = require('./product.routes');


const rateLimit = require('express-rate-limit');


const userRoutes = require('./user.routes');

const { auth, optionalAuth } = require('../middleware/auth');


const router = express.Router();

// Import route modules

// Import middleware

/**
 * Rate Limiter Configuration
 * Different limits for different route groups to prevent abuse
 */

// Strict rate limiting for authentication endpoints


const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: {
    success: false,
    error: 'Too many authentication attempts, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use combination of IP, user agent, and forwarded IP for better tracking
    const forwarded = req.headers['x-forwarded-for'];
    const userAgent = req.headers['user-agent'] || '';
    return `${req.ip}-${forwarded || ''}-${userAgent}`.substring(0, 100);
  },
  handler: (req, res) => {
    logger.warn('Rate limit exceeded for auth endpoint', {
      ip: req.ip,
      path: req.path,
      forwardedFor: req.headers['x-forwarded-for']
    });
    res.status(429).json({
      success: false,
      error: 'Too many authentication attempts, please try again later'
    });
  }
});

// General API rate limiting


const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: {
    success: false,
    error: 'Too many requests, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use combination of IP, user agent, and forwarded IP for better tracking
    const forwarded = req.headers['x-forwarded-for'];
    const userAgent = req.headers['user-agent'] || '';
    return `${req.ip}-${forwarded || ''}-${userAgent}`.substring(0, 100);
  },
  handler: (req, res) => {
    logger.warn('Rate limit exceeded', {
      ip: req.ip,
      path: req.path,
      forwardedFor: req.headers['x-forwarded-for']
    });
    res.status(429).json({
      success: false,
      error: 'Too many requests, please try again later'
    });
  }
});

// Strict rate limiting for payment endpoints


const paymentLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 payment requests per hour
  message: {
    success: false,
    error: 'Too many payment attempts, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use combination of IP, user agent, and forwarded IP for better tracking
    const forwarded = req.headers['x-forwarded-for'];
    const userAgent = req.headers['user-agent'] || '';
    return `${req.ip}-${forwarded || ''}-${userAgent}`.substring(0, 100);
  },
  handler: (req, res) => {
    logger.warn('Rate limit exceeded for payment endpoint', {
      ip: req.ip,
      path: req.path,
      forwardedFor: req.headers['x-forwarded-for'],
      userId: req.userId || 'unauthenticated'
    });
    res.status(429).json({
      success: false,
      error: 'Too many payment attempts, please try again later'
    });
  }
});

/**
 * Health Check Endpoint
 * Used by load balancers and monitoring systems
 */
router.get('/health', (req, res) => {
  try {
    const healthCheck = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      service: 'ecommerce-api',
      version: '1.0.0'
    };

    logger.debug('Health check requested', { status: 'healthy' });

    res.status(200).json({
      success: true,
      data: healthCheck
    });
  } catch (error) {
    logger.error('Health check failed', { error: error.message });
    res.status(503).json({
      success: false,
      status: 'unhealthy',
      error: 'Service temporarily unavailable'
    });
  }
});

/**
 * API Information Endpoint
 * Provides basic API information
 */
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'E-commerce API',
    version: '1.0.0',
    documentation: '/api/v1/docs'
  });
});

/**
 * Mount Route Modules
 * Routes are organized by resource and mounted with appropriate middleware
 */

// Public routes - No authentication required
router.use('/auth', authLimiter, authRoutes);

// Product and category routes - Public read access, authenticated write access
router.use('/products', apiLimiter, productRoutes);
router.use('/categories', apiLimiter, categoryRoutes);

// Protected routes - Authentication required
router.use('/users', apiLimiter, auth, userRoutes);
router.use('/cart', apiLimiter, auth, cartRoutes);
router.use('/orders', apiLimiter, auth, orderRoutes);
router.use('/payments', auth, paymentLimiter, paymentRoutes);

/**
 * 404 Handler for Undefined Routes
 * Must be defined after all route definitions
 */
router.use('*', (req, res) => {
  logger.warn('Route not found', {
    method: req.method,
    path: req.originalUrl,
    ip: req.ip
  });

  res.status(404).json({
    success: false,
    error: 'Route not found',
    message: `The requested resource was not found`
  });
});

/**
 * Error Handler Middleware
 * Catches errors from all routes and passes them to the centralized error handler
 * Note: Final error handling is done in app.js after this router is mounted
 */
router.use((err, req, res, next) => {
  // Log the error with context
  logger.error('Error in route handler', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    userId: req.userId
  });

  // Pass to centralized error handler in app.js
  next(err);
});

// Log router initialization
logger.info('Main router initialized with all route modules');

module.exports = router;
