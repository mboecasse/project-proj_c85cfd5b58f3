// File: src/middleware/authorization.js
// Generated: 2025-10-16 10:39:40 UTC
// Project ID: proj_c85cfd5b58f3
// Task ID: task_62yoyu09okrt


const logger = require('../utils/logger');

/**
 * Role definitions and hierarchy
 */


const ROLES = {
  ADMIN: 'admin',
  SELLER: 'seller',
  CUSTOMER: 'customer',
  GUEST: 'guest'
};

/**
 * Role hierarchy levels (higher number = more privileges)
 */


const ROLE_HIERARCHY = {
  admin: 4,
  seller: 3,
  customer: 2,
  guest: 1
};

/**
 * Permission mappings for each role
 */


const ROLE_PERMISSIONS = {
  admin: ['*'], // All permissions
  seller: [
    'products:create',
    'products:update',
    'products:delete',
    'products:read',
    'orders:read',
    'analytics:read',
    'profile:update'
  ],
  customer: [
    'cart:manage',
    'orders:create',
    'orders:read',
    'profile:update',
    'products:read'
  ],
  guest: ['products:read', 'categories:read']
};

/**
 * Middleware to require specific role(s)
 * @param {string|string[]} allowedRoles - Role or array of roles allowed
 * @returns {Function} Express middleware function
 */


const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    try {
      // Ensure user is authenticated
      if (!req.user) {
        logger.warn('Authorization attempted without authentication');
        return res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required'
          }
        });
      }

      // Normalize allowedRoles to array
      const rolesArray = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

      // Get user roles (support both single role and multiple roles)
      const userRoles = req.user.roles || [req.user.role];

      // Check if user has any of the allowed roles
      const hasRole = userRoles.some(userRole => rolesArray.includes(userRole));

      if (!hasRole) {
        logger.warn('Authorization failed - insufficient role', {
          userId: req.user.id || req.user._id,
          userRoles,
          requiredRoles: rolesArray
        });

        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'You do not have permission to perform this action'
          }
        });
      }

      logger.debug('Authorization successful', {
        userId: req.user.id || req.user._id,
        userRoles,
        requiredRoles: rolesArray
      });

      next();
    } catch (error) {
      logger.error('Error in requireRole middleware', {
        error: error.message,
        stack: error.stack
      });
      next(error);
    }
  };
};

/**
 * Middleware to verify resource ownership or admin role
 * @param {string} userIdPath - Path to user ID in req.user (e.g., 'id' or '_id')
 * @param {string} resourceIdPath - Path to resource owner ID in req (e.g., 'params.userId', 'body.userId')
 * @returns {Function} Express middleware function
 */


const requireOwnership = (userIdPath = '_id', resourceIdPath = 'params.id') => {
  return async (req, res, next) => {
    try {
      // Ensure user is authenticated
      if (!req.user) {
        logger.warn('Ownership check attempted without authentication');
        return res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required'
          }
        });
      }

      // Get user ID from req.user
      const userId = getNestedValue(req.user, userIdPath);

      // Get resource owner ID from request
      const resourceOwnerId = getNestedValue(req, resourceIdPath);

      if (!resourceOwnerId) {
        logger.warn('Resource owner ID not found in request', {
          resourceIdPath,
          params: req.params,
          body: req.body
        });
        return res.status(400).json({
          success: false,
          error: {
            code: 'BAD_REQUEST',
            message: 'Resource identifier not provided'
          }
        });
      }

      // Check if user is admin (admins can access all resources)
      const userRoles = req.user.roles || [req.user.role];
      const isAdmin = userRoles.includes(ROLES.ADMIN);

      // Check if user owns the resource
      const isOwner = userId && userId.toString() === resourceOwnerId.toString();

      if (!isAdmin && !isOwner) {
        logger.warn('Authorization failed - not owner or admin', {
          userId,
          resourceOwnerId,
          userRoles
        });

        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'You do not have permission to access this resource'
          }
        });
      }

      logger.debug('Ownership verification successful', {
        userId,
        resourceOwnerId,
        isAdmin,
        isOwner
      });

      next();
    } catch (error) {
      logger.error('Error in requireOwnership middleware', {
        error: error.message,
        stack: error.stack
      });
      next(error);
    }
  };
};

/**
 * Middleware to check specific permission
 * @param {string} permission - Permission string (e.g., 'products:write')
 * @returns {Function} Express middleware function
 */


const requirePermission = (permission) => {
  return (req, res, next) => {
    try {
      // Ensure user is authenticated
      if (!req.user) {
        logger.warn('Permission check attempted without authentication');
        return res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required'
          }
        });
      }

      // Get user roles
      const userRoles = req.user.roles || [req.user.role];

      // Check if user has the permission
      const hasPermission = checkPermission(userRoles, permission, req.user.permissions);

      if (!hasPermission) {
        logger.warn('Authorization failed - missing permission', {
          userId: req.user.id || req.user._id,
          userRoles,
          requiredPermission: permission
        });

        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'You do not have permission to perform this action'
          }
        });
      }

      logger.debug('Permission check successful', {
        userId: req.user.id || req.user._id,
        permission
      });

      next();
    } catch (error) {
      logger.error('Error in requirePermission middleware', {
        error: error.message,
        stack: error.stack
      });
      next(error);
    }
  };
};

/**
 * Middleware for conditional authorization based on custom logic
 * @param {Function} conditionFn - Async function that returns true/false
 * @returns {Function} Express middleware function
 */


const requireCondition = (conditionFn) => {
  return async (req, res, next) => {
    try {
      // Ensure user is authenticated
      if (!req.user) {
        logger.warn('Conditional authorization attempted without authentication');
        return res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required'
          }
        });
      }

      // Execute condition function
      const isAuthorized = await conditionFn(req);

      if (!isAuthorized) {
        logger.warn('Conditional authorization failed', {
          userId: req.user.id || req.user._id
        });

        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'You do not have permission to perform this action'
          }
        });
      }

      logger.debug('Conditional authorization successful', {
        userId: req.user.id || req.user._id
      });

      next();
    } catch (error) {
      logger.error('Error in requireCondition middleware', {
        error: error.message,
        stack: error.stack
      });
      next(error);
    }
  };
};

/**
 * Middleware to check if user has higher or equal role level
 * @param {string} minimumRole - Minimum role required
 * @returns {Function} Express middleware function
 */


const requireRoleLevel = (minimumRole) => {
  return (req, res, next) => {
    try {
      // Ensure user is authenticated
      if (!req.user) {
        logger.warn('Role level check attempted without authentication');
        return res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required'
          }
        });
      }

      // Get user roles
      const userRoles = req.user.roles || [req.user.role];

      // Get minimum role level
      const minimumLevel = ROLE_HIERARCHY[minimumRole] || 0;

      // Check if user has sufficient role level
      const hasLevel = userRoles.some(role => {
        const userLevel = ROLE_HIERARCHY[role] || 0;
        return userLevel >= minimumLevel;
      });

      if (!hasLevel) {
        logger.warn('Authorization failed - insufficient role level', {
          userId: req.user.id || req.user._id,
          userRoles,
          minimumRole
        });

        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'You do not have permission to perform this action'
          }
        });
      }

      logger.debug('Role level check successful', {
        userId: req.user.id || req.user._id,
        minimumRole
      });

      next();
    } catch (error) {
      logger.error('Error in requireRoleLevel middleware', {
        error: error.message,
        stack: error.stack
      });
      next(error);
    }
  };
};

/**
 * Helper function to get nested value from object using dot notation
 * @param {Object} obj - Object to search
 * @param {string} path - Dot notation path (e.g., 'user.id')
 * @returns {*} Value at path or undefined
 */


function getNestedValue(obj, path) {
  return path.split('.').reduce((current, key) => current.[key], obj);
}

/**
 * Helper function to check if user has specific permission
 * @param {string[]} userRoles - User's roles
 * @param {string} permission - Permission to check
 * @param {string[]} customPermissions - User's custom permissions (optional)
 * @returns {boolean} True if user has permission
 */


function checkPermission(userRoles, permission, customPermissions = []) {
  // Check if user has admin role (all permissions)
  if (userRoles.includes(ROLES.ADMIN)) {
    return true;
  }

  // Check custom permissions first
  if (customPermissions && customPermissions.length > 0) {
    if (customPermissions.includes('*') || customPermissions.includes(permission)) {
      return true;
    }

    // Check for wildcard permissions (e.g., 'products:*')
    const [resource] = permission.split(':');
    if (customPermissions.includes(`${resource}:*`)) {
      return true;
    }
  }

  // Check role-based permissions
  for (const role of userRoles) {
    const rolePermissions = ROLE_PERMISSIONS[role] || [];

    // Check for exact permission match
    if (rolePermissions.includes('*') || rolePermissions.includes(permission)) {
      return true;
    }

    // Check for wildcard permissions
    const [resource] = permission.split(':');
    if (rolePermissions.includes(`${resource}:*`)) {
      return true;
    }
  }

  return false;
}

/**
 * Middleware to check if user account is active
 * @returns {Function} Express middleware function
 */


const requireActiveAccount = () => {
  return (req, res, next) => {
    try {
      // Ensure user is authenticated
      if (!req.user) {
        logger.warn('Account status check attempted without authentication');
        return res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required'
          }
        });
      }

      // Check if account is active
      if (req.user.isActive === false) {
        logger.warn('Inactive account attempted access', {
          userId: req.user.id || req.user._id
        });

        return res.status(403).json({
          success: false,
          error: {
            code: 'ACCOUNT_INACTIVE',
            message: 'Your account is inactive. Please contact support.'
          }
        });
      }

      next();
    } catch (error) {
      logger.error('Error in requireActiveAccount middleware', {
        error: error.message,
        stack: error.stack
      });
      next(error);
    }
  };
};

// Export middleware functions
module.exports = {
  requireRole,
  requireOwnership,
  requirePermission,
  requireCondition,
  requireRoleLevel,
  requireActiveAccount,
  ROLES,
  ROLE_HIERARCHY,
  ROLE_PERMISSIONS
};
