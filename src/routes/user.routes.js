// File: src/routes/user.routes.js
// Generated: 2025-10-16 10:45:52 UTC
// Project ID: proj_c85cfd5b58f3
// Task ID: task_d0oyv0t2dvlk


const express = require('express');


const logger = require('../utils/logger');


const userController = require('../controllers/user.controller');

const { authenticate, authorize } = require('../middleware/auth');


const router = express.Router();

const {
  validateUserRegistration,
  validateUserLogin,
  validateUserUpdate,
  handleValidationErrors
} = require('../middleware/validation');

// Import user controller (to be created)

/**
 * @route   POST /api/users/register
 * @desc    Register a new user
 * @access  Public
 */
router.post(
  '/register',
  validateUserRegistration,
  handleValidationErrors,
  async (req, res, next) => {
    try {
      await userController.register(req, res, next);
    } catch (error) {
      logger.error('Error in POST /api/users/register', {
        error: error.message
      });
      next(error);
    }
  }
);

/**
 * @route   POST /api/users/login
 * @desc    Authenticate user and return JWT token
 * @access  Public
 */
router.post(
  '/login',
  validateUserLogin,
  handleValidationErrors,
  async (req, res, next) => {
    try {
      await userController.login(req, res, next);
    } catch (error) {
      logger.error('Error in POST /api/users/login', {
        error: error.message
      });
      next(error);
    }
  }
);

/**
 * @route   POST /api/users/forgot-password
 * @desc    Request password reset email
 * @access  Public
 */
router.post('/forgot-password', async (req, res, next) => {
  try {
    await userController.forgotPassword(req, res, next);
  } catch (error) {
    logger.error('Error in POST /api/users/forgot-password', {
      error: error.message
    });
    next(error);
  }
});

/**
 * @route   POST /api/users/reset-password/:token
 * @desc    Reset password using token
 * @access  Public
 */
router.post('/reset-password/:token', async (req, res, next) => {
  try {
    await userController.resetPassword(req, res, next);
  } catch (error) {
    logger.error('Error in POST /api/users/reset-password/:token', {
      error: error.message
    });
    next(error);
  }
});

/**
 * @route   GET /api/users/profile
 * @desc    Get current user\'s profile
 * @access  Private
 */
router.get('/profile', authenticate, async (req, res, next) => {
  try {
    await userController.getProfile(req, res, next);
  } catch (error) {
    logger.error('Error in GET /api/users/profile', {
      error: error.message,
      userId: req.userId
    });
    next(error);
  }
});

/**
 * @route   PUT /api/users/profile
 * @desc    Update user profile
 * @access  Private
 */
router.put(
  '/profile',
  authenticate,
  validateUserUpdate,
  handleValidationErrors,
  async (req, res, next) => {
    try {
      await userController.updateProfile(req, res, next);
    } catch (error) {
      logger.error('Error in PUT /api/users/profile', {
        error: error.message,
        userId: req.userId
      });
      next(error);
    }
  }
);

/**
 * @route   PUT /api/users/change-password
 * @desc    Change user password (requires old password)
 * @access  Private
 */
router.put('/change-password', authenticate, async (req, res, next) => {
  try {
    await userController.changePassword(req, res, next);
  } catch (error) {
    logger.error('Error in PUT /api/users/change-password', {
      error: error.message,
      userId: req.userId
    });
    next(error);
  }
});

/**
 * @route   DELETE /api/users/account
 * @desc    Delete/deactivate user account
 * @access  Private
 */
router.delete('/account', authenticate, async (req, res, next) => {
  try {
    await userController.deleteAccount(req, res, next);
  } catch (error) {
    logger.error('Error in DELETE /api/users/account', {
      error: error.message,
      userId: req.userId
    });
    next(error);
  }
});

/**
 * @route   GET /api/users/addresses
 * @desc    Get all user addresses
 * @access  Private
 */
router.get('/addresses', authenticate, async (req, res, next) => {
  try {
    await userController.getAddresses(req, res, next);
  } catch (error) {
    logger.error('Error in GET /api/users/addresses', {
      error: error.message,
      userId: req.userId
    });
    next(error);
  }
});

/**
 * @route   POST /api/users/addresses
 * @desc    Add new address
 * @access  Private
 */
router.post('/addresses', authenticate, async (req, res, next) => {
  try {
    await userController.addAddress(req, res, next);
  } catch (error) {
    logger.error('Error in POST /api/users/addresses', {
      error: error.message,
      userId: req.userId
    });
    next(error);
  }
});

/**
 * @route   PUT /api/users/addresses/:addressId
 * @desc    Update specific address
 * @access  Private
 */
router.put('/addresses/:addressId', authenticate, async (req, res, next) => {
  try {
    await userController.updateAddress(req, res, next);
  } catch (error) {
    logger.error('Error in PUT /api/users/addresses/:addressId', {
      error: error.message,
      userId: req.userId,
      addressId: req.params.addressId
    });
    next(error);
  }
});

/**
 * @route   DELETE /api/users/addresses/:addressId
 * @desc    Remove address
 * @access  Private
 */
router.delete('/addresses/:addressId', authenticate, async (req, res, next) => {
  try {
    await userController.deleteAddress(req, res, next);
  } catch (error) {
    logger.error('Error in DELETE /api/users/addresses/:addressId', {
      error: error.message,
      userId: req.userId,
      addressId: req.params.addressId
    });
    next(error);
  }
});

/**
 * @route   GET /api/users/orders
 * @desc    Get user\'s order history
 * @access  Private
 */
router.get('/orders', authenticate, async (req, res, next) => {
  try {
    await userController.getOrderHistory(req, res, next);
  } catch (error) {
    logger.error('Error in GET /api/users/orders', {
      error: error.message,
      userId: req.userId
    });
    next(error);
  }
});

/**
 * @route   GET /api/users
 * @desc    Get all users (paginated)
 * @access  Private/Admin
 */
router.get('/', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    await userController.getAllUsers(req, res, next);
  } catch (error) {
    logger.error('Error in GET /api/users', {
      error: error.message,
      adminId: req.userId
    });
    next(error);
  }
});

/**
 * @route   GET /api/users/:userId
 * @desc    Get specific user details
 * @access  Private/Admin
 */
router.get('/:userId', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    await userController.getUserById(req, res, next);
  } catch (error) {
    logger.error('Error in GET /api/users/:userId', {
      error: error.message,
      adminId: req.userId,
      targetUserId: req.params.userId
    });
    next(error);
  }
});

/**
 * @route   PUT /api/users/:userId/role
 * @desc    Update user role
 * @access  Private/Admin
 */
router.put('/:userId/role', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    await userController.updateUserRole(req, res, next);
  } catch (error) {
    logger.error('Error in PUT /api/users/:userId/role', {
      error: error.message,
      adminId: req.userId,
      targetUserId: req.params.userId
    });
    next(error);
  }
});

module.exports = router;
