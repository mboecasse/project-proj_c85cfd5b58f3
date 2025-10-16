// File: src/validators/cart.validator.js
// Generated: 2025-10-16 10:42:06 UTC
// Project ID: proj_c85cfd5b58f3
// Task ID: task_3ymb42zrxnnp


const logger = require('../utils/logger');

const { body, param, validationResult } = require('express-validator');

/**
 * Middleware to handle validation results
 * Checks for validation errors and returns formatted error response
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Object} JSON response with validation errors or calls next()
 */


const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map(error => ({
      field: error.path || error.param,
      message: error.msg
    }));

    logger.warn('Validation failed', {
      path: req.path,
      method: req.method,
      errors: formattedErrors
    });

    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors: formattedErrors
    });
  }

  next();
};

/**
 * Validates MongoDB ObjectId format
 * Custom validator for checking valid ObjectId strings
 *
 * @param {string} value - The value to validate
 * @returns {boolean} True if valid ObjectId format
 */


const isValidObjectId = (value) => {
  return /^[0-9a-fA-F]{24}$/.test(value);
};

/**
 * Validation rules for adding item to cart
 * Validates productId, quantity, and optional variant/options
 */


const validateAddToCart = [
  body('productId')
    .trim()
    .notEmpty()
    .withMessage('Product ID is required')
    .custom(isValidObjectId)
    .withMessage('Invalid product ID format'),

  body('quantity')
    .notEmpty()
    .withMessage('Quantity is required')
    .isInt({ min: 1, max: 99 })
    .withMessage('Quantity must be an integer between 1 and 99'),

  body('variantId')
    .optional()
    .trim()
    .custom(isValidObjectId)
    .withMessage('Invalid variant ID format'),

  body('options')
    .optional()
    .isObject()
    .withMessage('Options must be an object'),

  body('giftMessage')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Gift message must not exceed 500 characters')
    .escape(),

  handleValidationErrors
];

/**
 * Validation rules for updating cart item quantity
 * Validates itemId and new quantity
 */


const validateUpdateQuantity = [
  param('itemId')
    .trim()
    .notEmpty()
    .withMessage('Item ID is required')
    .custom(isValidObjectId)
    .withMessage('Invalid item ID format'),

  body('quantity')
    .notEmpty()
    .withMessage('Quantity is required')
    .isInt({ min: 1, max: 99 })
    .withMessage('Quantity must be an integer between 1 and 99'),

  handleValidationErrors
];

/**
 * Validation rules for removing item from cart
 * Validates itemId parameter
 */


const validateRemoveItem = [
  param('itemId')
    .trim()
    .notEmpty()
    .withMessage('Item ID is required')
    .custom(isValidObjectId)
    .withMessage('Invalid item ID format'),

  handleValidationErrors
];

/**
 * Validation rules for applying promo/discount code
 * Validates code format and structure
 */


const validateApplyPromoCode = [
  body('code')
    .trim()
    .notEmpty()
    .withMessage('Promo code is required')
    .isLength({ min: 4, max: 20 })
    .withMessage('Promo code must be between 4 and 20 characters')
    .matches(/^[A-Z0-9]+$/)
    .withMessage('Promo code must contain only uppercase letters and numbers')
    .customSanitizer(value => value.toUpperCase()),

  handleValidationErrors
];

/**
 * Validation rules for removing promo code
 * No body validation needed, just ensures proper request format
 */


const validateRemovePromoCode = [
  handleValidationErrors
];

/**
 * Validation rules for updating shipping address
 * Validates either addressId (for saved address) or full address object
 */


const validateUpdateShippingAddress = [
  body('addressId')
    .optional()
    .trim()
    .custom(isValidObjectId)
    .withMessage('Invalid address ID format'),

  body('street')
    .if(body('addressId').not().exists())
    .trim()
    .notEmpty()
    .withMessage('Street address is required when not using saved address')
    .isLength({ min: 5, max: 200 })
    .withMessage('Street address must be between 5 and 200 characters')
    .escape(),

  body('city')
    .if(body('addressId').not().exists())
    .trim()
    .notEmpty()
    .withMessage('City is required when not using saved address')
    .isLength({ min: 2, max: 100 })
    .withMessage('City must be between 2 and 100 characters')
    .escape(),

  body('state')
    .if(body('addressId').not().exists())
    .trim()
    .notEmpty()
    .withMessage('State is required when not using saved address')
    .isLength({ min: 2, max: 100 })
    .withMessage('State must be between 2 and 100 characters')
    .escape(),

  body('zipCode')
    .if(body('addressId').not().exists())
    .trim()
    .notEmpty()
    .withMessage('Zip code is required when not using saved address')
    .matches(/^[A-Z0-9\s-]{3,10}$/i)
    .withMessage('Invalid zip code format'),

  body('country')
    .if(body('addressId').not().exists())
    .trim()
    .notEmpty()
    .withMessage('Country is required when not using saved address')
    .isLength({ min: 2, max: 100 })
    .withMessage('Country must be between 2 and 100 characters')
    .escape(),

  body('phone')
    .optional()
    .trim()
    .matches(/^[\d\s\-\+\(\)]{10,20}$/)
    .withMessage('Invalid phone number format'),

  handleValidationErrors
];

/**
 * Validation rules for merging guest cart with user cart
 * Validates array of cart items from guest session
 */


const validateMergeCart = [
  body('guestCartItems')
    .isArray({ min: 1 })
    .withMessage('Guest cart items must be a non-empty array'),

  body('guestCartItems.*.productId')
    .trim()
    .notEmpty()
    .withMessage('Product ID is required for each item')
    .custom(isValidObjectId)
    .withMessage('Invalid product ID format'),

  body('guestCartItems.*.quantity')
    .isInt({ min: 1, max: 99 })
    .withMessage('Quantity must be an integer between 1 and 99'),

  body('guestCartItems.*.variantId')
    .optional()
    .trim()
    .custom(isValidObjectId)
    .withMessage('Invalid variant ID format'),

  handleValidationErrors
];

/**
 * Validation rules for clearing cart
 * No body validation needed, just ensures proper request format
 */


const validateClearCart = [
  handleValidationErrors
];

/**
 * Validation rules for getting cart
 * No body validation needed for GET request
 */


const validateGetCart = [
  handleValidationErrors
];

/**
 * Validation rules for cart checkout preparation
 * Validates all required checkout information
 */


const validateCheckoutPreparation = [
  body('shippingAddressId')
    .optional()
    .trim()
    .custom(isValidObjectId)
    .withMessage('Invalid shipping address ID format'),

  body('billingAddressId')
    .optional()
    .trim()
    .custom(isValidObjectId)
    .withMessage('Invalid billing address ID format'),

  body('shippingMethod')
    .optional()
    .trim()
    .isIn(['standard', 'express', 'overnight'])
    .withMessage('Invalid shipping method. Must be standard, express, or overnight'),

  body('paymentMethod')
    .optional()
    .trim()
    .isIn(['card', 'paypal', 'stripe', 'cash_on_delivery'])
    .withMessage('Invalid payment method'),

  body('specialInstructions')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Special instructions must not exceed 1000 characters')
    .escape(),

  handleValidationErrors
];

/**
 * Validation rules for updating cart item options
 * Validates itemId and options object
 */


const validateUpdateItemOptions = [
  param('itemId')
    .trim()
    .notEmpty()
    .withMessage('Item ID is required')
    .custom(isValidObjectId)
    .withMessage('Invalid item ID format'),

  body('options')
    .notEmpty()
    .withMessage('Options are required')
    .isObject()
    .withMessage('Options must be an object'),

  handleValidationErrors
];

/**
 * Validation rules for bulk cart operations
 * Validates array of items for bulk add/update/remove
 */


const validateBulkCartOperation = [
  body('items')
    .isArray({ min: 1, max: 50 })
    .withMessage('Items must be an array with 1 to 50 elements'),

  body('items.*.productId')
    .trim()
    .notEmpty()
    .withMessage('Product ID is required for each item')
    .custom(isValidObjectId)
    .withMessage('Invalid product ID format'),

  body('items.*.quantity')
    .isInt({ min: 1, max: 99 })
    .withMessage('Quantity must be an integer between 1 and 99'),

  body('items.*.variantId')
    .optional()
    .trim()
    .custom(isValidObjectId)
    .withMessage('Invalid variant ID format'),

  handleValidationErrors
];

module.exports = {
  validateAddToCart,
  validateUpdateQuantity,
  validateRemoveItem,
  validateApplyPromoCode,
  validateRemovePromoCode,
  validateUpdateShippingAddress,
  validateMergeCart,
  validateClearCart,
  validateGetCart,
  validateCheckoutPreparation,
  validateUpdateItemOptions,
  validateBulkCartOperation,
  handleValidationErrors,
  isValidObjectId
};
