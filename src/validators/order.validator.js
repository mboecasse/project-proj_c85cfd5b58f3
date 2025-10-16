// File: src/validators/order.validator.js
// Generated: 2025-10-16 10:42:20 UTC
// Project ID: proj_c85cfd5b58f3
// Task ID: task_3fjs9u87bl35


const logger = require('../utils/logger');

const { body, param, query, validationResult } = require('express-validator');

/**
 * Validation middleware to check for validation errors
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */


const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map(err => ({
      field: err.path || err.param,
      message: err.msg
    }));

    logger.warn('Validation failed', { errors: formattedErrors, path: req.path });

    return res.status(400).json({
      success: false,
      error: 'Validation Error',
      errors: formattedErrors
    });
  }
  next();
};

/**
 * Validation rules for creating an order
 */


const createOrderValidation = [
  body('userId')
    .notEmpty()
    .withMessage('User ID is required')
    .isMongoId()
    .withMessage('User ID must be a valid MongoDB ObjectId'),

  body('items')
    .isArray({ min: 1 })
    .withMessage('Items must be a non-empty array'),

  body('items.*.productId')
    .notEmpty()
    .withMessage('Product ID is required for each item')
    .isMongoId()
    .withMessage('Product ID must be a valid MongoDB ObjectId'),

  body('items.*.quantity')
    .notEmpty()
    .withMessage('Quantity is required for each item')
    .isInt({ min: 1, max: 999 })
    .withMessage('Quantity must be a positive integer between 1 and 999'),

  body('items.*.price')
    .notEmpty()
    .withMessage('Price is required for each item')
    .isFloat({ min: 0.01 })
    .withMessage('Price must be a positive number greater than 0'),

  body('shippingAddress')
    .notEmpty()
    .withMessage('Shipping address is required')
    .isObject()
    .withMessage('Shipping address must be an object'),

  body('shippingAddress.fullName')
    .notEmpty()
    .withMessage('Full name is required')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Full name must be between 2 and 100 characters'),

  body('shippingAddress.addressLine1')
    .notEmpty()
    .withMessage('Address line 1 is required')
    .trim()
    .isLength({ min: 5, max: 200 })
    .withMessage('Address line 1 must be between 5 and 200 characters'),

  body('shippingAddress.addressLine2')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Address line 2 must not exceed 200 characters'),

  body('shippingAddress.city')
    .notEmpty()
    .withMessage('City is required')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('City must be between 2 and 100 characters'),

  body('shippingAddress.state')
    .notEmpty()
    .withMessage('State is required')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('State must be between 2 and 100 characters'),

  body('shippingAddress.postalCode')
    .notEmpty()
    .withMessage('Postal code is required')
    .trim()
    .isLength({ min: 3, max: 20 })
    .withMessage('Postal code must be between 3 and 20 characters'),

  body('shippingAddress.country')
    .notEmpty()
    .withMessage('Country is required')
    .trim()
    .isLength({ min: 2, max: 2 })
    .withMessage('Country must be a 2-letter country code (e.g., US, GB, CA)'),

  body('paymentMethod')
    .notEmpty()
    .withMessage('Payment method is required')
    .isIn(['credit_card', 'debit_card', 'paypal', 'stripe'])
    .withMessage('Payment method must be one of: credit_card, debit_card, paypal, stripe'),

  body('couponCode')
    .optional()
    .trim()
    .isLength({ min: 3, max: 50 })
    .withMessage('Coupon code must be between 3 and 50 characters'),

  body('specialInstructions')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Special instructions must not exceed 500 characters'),

  body('phoneNumber')
    .optional()
    .trim()
    .matches(/^\+?[1-9]\d{1,14}$/)
    .withMessage('Phone number must be in international format (e.g., +1234567890)'),

  body('totalAmount')
    .optional()
    .isFloat({ min: 0.01 })
    .withMessage('Total amount must be a positive number')
];

/**
 * Validation rules for updating an order
 */


const updateOrderValidation = [
  param('id')
    .notEmpty()
    .withMessage('Order ID is required')
    .isMongoId()
    .withMessage('Order ID must be a valid MongoDB ObjectId'),

  body('status')
    .optional()
    .isIn(['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'])
    .withMessage('Status must be one of: pending, confirmed, processing, shipped, delivered, cancelled'),

  body('trackingNumber')
    .optional()
    .trim()
    .isLength({ min: 5, max: 100 })
    .withMessage('Tracking number must be between 5 and 100 characters'),

  body('shippingAddress')
    .optional()
    .isObject()
    .withMessage('Shipping address must be an object'),

  body('shippingAddress.fullName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Full name must be between 2 and 100 characters'),

  body('shippingAddress.addressLine1')
    .optional()
    .trim()
    .isLength({ min: 5, max: 200 })
    .withMessage('Address line 1 must be between 5 and 200 characters'),

  body('shippingAddress.addressLine2')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Address line 2 must not exceed 200 characters'),

  body('shippingAddress.city')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('City must be between 2 and 100 characters'),

  body('shippingAddress.state')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('State must be between 2 and 100 characters'),

  body('shippingAddress.postalCode')
    .optional()
    .trim()
    .isLength({ min: 3, max: 20 })
    .withMessage('Postal code must be between 3 and 20 characters'),

  body('shippingAddress.country')
    .optional()
    .trim()
    .isLength({ min: 2, max: 2 })
    .withMessage('Country must be a 2-letter country code')
];

/**
 * Validation rules for order ID parameter
 */


const validateOrderId = [
  param('id')
    .notEmpty()
    .withMessage('Order ID is required')
    .isMongoId()
    .withMessage('Order ID must be a valid MongoDB ObjectId')
];

/**
 * Validation rules for updating order status
 */


const updateOrderStatusValidation = [
  param('id')
    .notEmpty()
    .withMessage('Order ID is required')
    .isMongoId()
    .withMessage('Order ID must be a valid MongoDB ObjectId'),

  body('status')
    .notEmpty()
    .withMessage('Status is required')
    .isIn(['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'])
    .withMessage('Status must be one of: pending, confirmed, processing, shipped, delivered, cancelled'),

  body('reason')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Reason must not exceed 500 characters')
];

/**
 * Validation rules for querying orders
 */


const queryOrdersValidation = [
  query('status')
    .optional()
    .isIn(['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'])
    .withMessage('Status must be one of: pending, confirmed, processing, shipped, delivered, cancelled'),

  query('userId')
    .optional()
    .isMongoId()
    .withMessage('User ID must be a valid MongoDB ObjectId'),

  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date'),

  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date'),

  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer')
    .toInt(),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
    .toInt(),

  query('sortBy')
    .optional()
    .isIn(['createdAt', 'totalAmount', 'status', 'updatedAt'])
    .withMessage('Sort by must be one of: createdAt, totalAmount, status, updatedAt'),

  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Sort order must be either asc or desc')
];

/**
 * Validation rules for cancelling an order
 */


const cancelOrderValidation = [
  param('id')
    .notEmpty()
    .withMessage('Order ID is required')
    .isMongoId()
    .withMessage('Order ID must be a valid MongoDB ObjectId'),

  body('reason')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Cancellation reason must not exceed 500 characters')
];

/**
 * Custom validation middleware to check order total calculation
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */


const validateOrderTotal = (req, res, next) => {
  try {
    const { items, totalAmount } = req.body;

    if (items && totalAmount) {
      const calculatedTotal = items.reduce((sum, item) => {
        return sum + (item.price * item.quantity);
      }, 0);

      // Allow small floating point differences (0.01)
      const difference = Math.abs(calculatedTotal - totalAmount);
      if (difference > 0.01) {
        logger.warn('Order total mismatch', {
          provided: totalAmount,
          calculated: calculatedTotal,
          difference
        });

        return res.status(400).json({
          success: false,
          error: 'Total amount does not match calculated total',
          details: {
            provided: totalAmount,
            calculated: parseFloat(calculatedTotal.toFixed(2))
          }
        });
      }
    }

    next();
  } catch (error) {
    logger.error('Error validating order total', { error: error.message });
    next(error);
  }
};

/**
 * Custom validation middleware to check status transition validity
 * This validates that the requested status transition is allowed based on current order status
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */


const validateStatusTransition = async (req, res, next) => {
  try {
    const { status: newStatus } = req.body;

    // If no status change is requested, skip validation
    if (!newStatus) {
      return next();
    }

    // Valid status transitions map
    const validTransitions = {
      'pending': ['confirmed', 'cancelled'],
      'confirmed': ['processing', 'cancelled'],
      'processing': ['shipped', 'cancelled'],
      'shipped': ['delivered'],
      'delivered': [],
      'cancelled': []
    };

    // Get current order status - this assumes the order is attached to req.order
    // If not available, the controller should fetch it before this middleware
    const currentStatus = req.order.status;

    if (!currentStatus) {
      logger.error('Current order status not available for transition validation');
      return res.status(500).json({
        success: false,
        error: 'Unable to validate status transition'
      });
    }

    // Check if the transition is valid
    const allowedTransitions = validTransitions[currentStatus] || [];

    if (!allowedTransitions.includes(newStatus)) {
      logger.warn('Invalid status transition attempted', {
        orderId: req.params.id,
        currentStatus,
        requestedStatus: newStatus,
        allowedTransitions
      });

      return res.status(400).json({
        success: false,
        error: 'Invalid status transition',
        details: {
          currentStatus,
          requestedStatus: newStatus,
          allowedTransitions
        }
      });
    }

    // Store valid transitions in request for controller to use if needed
    req.validTransitions = validTransitions;

    next();
  } catch (error) {
    logger.error('Error validating status transition', { error: error.message });
    next(error);
  }
};

module.exports = {
  validate,
  createOrderValidation,
  updateOrderValidation,
  validateOrderId,
  updateOrderStatusValidation,
  queryOrdersValidation,
  cancelOrderValidation,
  validateOrderTotal,
  validateStatusTransition
};
