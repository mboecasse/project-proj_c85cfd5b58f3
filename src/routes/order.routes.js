// File: src/routes/order.routes.js
// Generated: 2025-10-16 10:45:13 UTC
// Project ID: proj_c85cfd5b58f3
// Task ID: task_su5katv0h4ri


const express = require('express');


const logger = require('../utils/logger');

const { authenticate } = require('../middleware/auth');

const { requireRole, requireOwnership } = require('../middleware/authorization');


const router = express.Router();

const {
  validateCreateOrder,
  validateUpdateOrderStatus,
  handleValidationErrors
} = require('../middleware/validation');

// Import order controller functions

const {
  createOrder,
  getUserOrders,
  getOrderById,
  updateOrderStatus,
  cancelOrder,
  getAllOrders,
  updateShippingInfo
} = require('../controllers/order.controller');

/**
 * All order routes require authentication
 */
router.use(authenticate);

/**
 * POST /
 * Create new order from cart or direct items
 * @access Private (authenticated users)
 */
router.post('/', validateCreateOrder, handleValidationErrors, async (req, res, next) => {
  try {
    logger.info('Creating new order', { userId: req.userId });
    await createOrder(req, res, next);
  } catch (error) {
    logger.error('Error in POST /orders', {
      error: error.message,
      userId: req.userId,
      stack: error.stack
    });
    next(error);
  }
});

/**
 * GET /
 * Get authenticated user's orders with pagination and filtering
 * @access Private (authenticated users)
 */
router.get('/', async (req, res, next) => {
  try {
    logger.info('Fetching user orders', {
      userId: req.userId,
      query: req.query
    });
    await getUserOrders(req, res, next);
  } catch (error) {
    logger.error('Error in GET /orders', {
      error: error.message,
      userId: req.userId,
      stack: error.stack
    });
    next(error);
  }
});

/**
 * GET /admin/all
 * Get all orders across all users (admin only)
 * @access Private (admin only)
 */
router.get('/admin/all', requireRole(['admin']), async (req, res, next) => {
  try {
    logger.info('Admin fetching all orders', {
      adminId: req.userId,
      query: req.query
    });
    await getAllOrders(req, res, next);
  } catch (error) {
    logger.error('Error in GET /orders/admin/all', {
      error: error.message,
      adminId: req.userId,
      stack: error.stack
    });
    next(error);
  }
});

/**
 * GET /:orderId
 * Get single order by ID
 * @access Private (order owner or admin)
 */
router.get('/:orderId', requireOwnership('order', 'orderId'), async (req, res, next) => {
  try {
    logger.info('Fetching order by ID', {
      userId: req.userId,
      orderId: req.params.orderId
    });
    await getOrderById(req, res, next);
  } catch (error) {
    logger.error('Error in GET /orders/:orderId', {
      error: error.message,
      userId: req.userId,
      orderId: req.params.orderId,
      stack: error.stack
    });
    next(error);
  }
});

/**
 * PATCH /:orderId/status
 * Update order status (admin/staff only)
 * @access Private (admin/staff only)
 */
router.patch(
  '/:orderId/status',
  requireRole(['admin', 'staff']),
  validateUpdateOrderStatus,
  handleValidationErrors,
  async (req, res, next) => {
    try {
      logger.info('Updating order status', {
        userId: req.userId,
        orderId: req.params.orderId,
        newStatus: req.body.status
      });
      await updateOrderStatus(req, res, next);
    } catch (error) {
      logger.error('Error in PATCH /orders/:orderId/status', {
        error: error.message,
        userId: req.userId,
        orderId: req.params.orderId,
        stack: error.stack
      });
      next(error);
    }
  }
);

/**
 * PATCH /:orderId/cancel
 * Cancel order (order owner only, if eligible)
 * @access Private (order owner)
 */
router.patch('/:orderId/cancel', requireOwnership('order', 'orderId'), async (req, res, next) => {
  try {
    logger.info('Cancelling order', {
      userId: req.userId,
      orderId: req.params.orderId
    });
    await cancelOrder(req, res, next);
  } catch (error) {
    logger.error('Error in PATCH /orders/:orderId/cancel', {
      error: error.message,
      userId: req.userId,
      orderId: req.params.orderId,
      stack: error.stack
    });
    next(error);
  }
});

/**
 * PATCH /:orderId/shipping
 * Update shipping information (admin/staff only)
 * @access Private (admin/staff only)
 */
router.patch(
  '/:orderId/shipping',
  requireRole(['admin', 'staff']),
  async (req, res, next) => {
    try {
      logger.info('Updating shipping information', {
        userId: req.userId,
        orderId: req.params.orderId
      });
      await updateShippingInfo(req, res, next);
    } catch (error) {
      logger.error('Error in PATCH /orders/:orderId/shipping', {
        error: error.message,
        userId: req.userId,
        orderId: req.params.orderId,
        stack: error.stack
      });
      next(error);
    }
  }
);

module.exports = router;
