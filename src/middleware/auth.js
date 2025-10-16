// File: src/middleware/auth.js
// Generated: 2025-10-16 10:50:07 UTC
// Project ID: proj_c85cfd5b58f3
// Task ID: task_bh6y9rt5p1m9

        const Model = require(`../models/${resourceModel}`);


const Jwt = require('../utils/jwt');


const logger = require('../utils/logger');

/**
 * Authentication middleware - Verifies JWT token and attaches user to request
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */


const authenticate = async (req, res, next) => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logger.warn('Authentication failed: No token provided', {
        ip: req.ip,
        path: req.path
      });
      return res.status(401).json({
        success: false,
        error: 'Authentication required. Please provide a valid token.'
      });
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      logger.warn('Authentication failed: Invalid token format', {
        ip: req.ip,
        path: req.path
      });
      return res.status(401).json({
        success: false,
        error: 'Invalid token format'
      });
    }

    // Verify token
    const jwt = new Jwt();
    const decoded = await jwt.verifyToken(token);

    // Attach user information to request
    req.user = decoded;
    req.userId = decoded.userId || decoded.id || decoded._id;

    logger.debug('User authenticated successfully', {
      userId: req.userId,
      path: req.path
    });

    next();
  } catch (error) {
    logger.error('Authentication error', {
      error: error.message,
      ip: req.ip,
      path: req.path
    });

    if (error.message.includes('expired')) {
      return res.status(401).json({
        success: false,
        error: 'Token has expired. Please login again.'
      });
    }

    if (error.message.includes('invalid')) {
      return res.status(401).json({
        success: false,
        error: 'Invalid token. Please login again.'
      });
    }

    return res.status(401).json({
      success: false,
      error: 'Authentication failed'
    });
  }
};

/**
 * Authorization middleware - Checks if user has required role(s)
 * @param {...string} allowedRoles - Roles that are allowed to access the route
 * @returns {Function} Express middleware function
 */


const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        logger.warn('Authorization failed: User not authenticated', {
          ip: req.ip,
          path: req.path
        });
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      const userRole = req.user.role;

      if (!userRole) {
        logger.warn('Authorization failed: No role found for user', {
          userId: req.userId,
          path: req.path
        });
        return res.status(403).json({
          success: false,
          error: 'Access denied. No role assigned.'
        });
      }

      if (!allowedRoles.includes(userRole)) {
        logger.warn('Authorization failed: Insufficient permissions', {
          userId: req.userId,
          userRole,
          requiredRoles: allowedRoles,
          path: req.path
        });
        return res.status(403).json({
          success: false,
          error: 'Access denied. Insufficient permissions.'
        });
      }

      logger.debug('User authorized successfully', {
        userId: req.userId,
        userRole,
        path: req.path
      });

      next();
    } catch (error) {
      logger.error('Authorization error', {
        error: error.message,
        userId: req.userId,
        path: req.path
      });
      return res.status(500).json({
        success: false,
        error: 'Authorization check failed'
      });
    }
  };
};

/**
 * Optional authentication middleware - Attaches user if token is valid, but doesn't require it
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */


const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // No token provided, continue without authentication
      return next();
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      return next();
    }

    // Try to verify token
    const jwt = new Jwt();
    const decoded = await jwt.verifyToken(token);

    // Attach user information to request
    req.user = decoded;
    req.userId = decoded.userId || decoded.id || decoded._id;

    logger.debug('Optional auth: User authenticated', {
      userId: req.userId,
      path: req.path
    });

    next();
  } catch (error) {
    // Token verification failed, but continue without authentication
    logger.debug('Optional auth: Token verification failed, continuing without auth', {
      error: error.message,
      path: req.path
    });
    next();
  }
};

/**
 * Middleware to require authentication - Alias for authenticate
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */


const requireAuth = authenticate;

/**
 * Middleware to check if user owns the resource
 * @param {string} resourceIdParam - Name of the route parameter containing resource ID
 * @param {string} resourceModel - Name of the model to check ownership
 * @returns {Function} Express middleware function
 */


const checkOwnership = (resourceIdParam = 'id', resourceModel = null) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      const resourceId = req.params[resourceIdParam];
      const userId = req.userId;

      // If resource model is provided, fetch and check ownership
      if (resourceModel) {
        const resource = await Model.findById(resourceId);

        if (!resource) {
          return res.status(404).json({
            success: false,
            error: 'Resource not found'
          });
        }

        const resourceOwnerId = resource.userId || resource.user || resource.createdBy;

        if (resourceOwnerId.toString() !== userId.toString()) {
          logger.warn('Ownership check failed', {
            userId,
            resourceId,
            resourceOwnerId,
            model: resourceModel
          });
          return res.status(403).json({
            success: false,
            error: 'Access denied. You do not own this resource.'
          });
        }
      }

      next();
    } catch (error) {
      logger.error('Ownership check error', {
        error: error.message,
        userId: req.userId,
        resourceId: req.params[resourceIdParam]
      });
      next(error);
    }
  };
};

module.exports = {
  authenticate,
  authorize,
  requireAuth,
  optionalAuth,
  checkOwnership,
  auth: authenticate
};
