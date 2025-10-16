// File: src/middleware/validation.js
// Generated: 2025-10-16 10:42:17 UTC
// Project ID: proj_c85cfd5b58f3
// Task ID: task_dqkmo3y1p5kq


const logger = require('../utils/logger');


const mongoose = require('mongoose');

const { body, param, query, validationResult } = require('express-validator');

/**
 * Custom validator to check if value is a valid MongoDB ObjectId
 *
 * @param {string} value - The value to validate
 * @returns {boolean} True if valid ObjectId
 * @throws {Error} If invalid ObjectId format
 */


const isValidObjectId = (value) => {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    throw new Error('Invalid ID format');
  }
  return true;
};

/**
 * Custom validator to check if quantity is valid
 *
 * @param {number} value - The quantity value
 * @returns {boolean} True if valid quantity
 * @throws {Error} If invalid quantity
 */


const isValidQuantity = (value) => {
  if (!Number.isInteger(value) || value < 1 || value > 100) {
    throw new Error('Quantity must be between 1 and 100');
  }
  return true;
};

/**
 * Custom validator to check if price is valid
 *
 * @param {number} value - The price value
 * @returns {boolean} True if valid price
 * @throws {Error} If invalid price
 */


const isValidPrice = (value) => {
  if (typeof value !== 'number' || value < 0 || !isFinite(value)) {
    throw new Error('Price must be a positive number');
  }
  return true;
};

/**
 * Middleware to handle validation errors
 * Formats validation errors and returns 400 response
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */


const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map(err => ({
      field: err.path || err.param,
      message: err.msg
    }));

    logger.warn('Validation failed', {
      path: req.path,
      method: req.method,
      errors: formattedErrors
    });

    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      errors: formattedErrors
    });
  }

  next();
};

/**
 * Product Validations
 */

// Validate product creation


const validateCreateProduct = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Product name is required')
    .isLength({ min: 3, max: 200 })
    .withMessage('Product name must be between 3 and 200 characters')
    .escape(),

  body('description')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Description cannot exceed 2000 characters')
    .escape(),

  body('price')
    .notEmpty()
    .withMessage('Price is required')
    .isFloat({ min: 0.01 })
    .withMessage('Price must be a positive number')
    .custom(isValidPrice),

  body('stock')
    .notEmpty()
    .withMessage('Stock is required')
    .isInt({ min: 0 })
    .withMessage('Stock must be a non-negative integer')
    .toInt(),

  body('category')
    .trim()
    .notEmpty()
    .withMessage('Category is required')
    .custom(isValidObjectId)
    .withMessage('Invalid category ID'),

  body('images')
    .optional()
    .isArray({ min: 0, max: 5 })
    .withMessage('Images must be an array with maximum 5 items'),

  body('images.*.url')
    .optional()
    .isURL()
    .withMessage('Invalid image URL'),

  body('images.*.alt')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Image alt text cannot exceed 100 characters')
    .escape(),

  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array'),

  body('tags.*')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Tag cannot exceed 50 characters')
    .escape(),

  body('featured')
    .optional()
    .isBoolean()
    .withMessage('Featured must be a boolean')
    .toBoolean(),

  body('onSale')
    .optional()
    .isBoolean()
    .withMessage('onSale must be a boolean')
    .toBoolean(),

  body('discountPrice')
    .optional()
    .if(body('onSale').equals(true))
    .isFloat({ min: 0 })
    .withMessage('Discount price must be a positive number')
    .custom((value, { req }) => {
      if (value >= req.body.price) {
        throw new Error('Discount price must be less than regular price');
      }
      return true;
    })
];

// Validate product update


const validateUpdateProduct = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 3, max: 200 })
    .withMessage('Product name must be between 3 and 200 characters')
    .escape(),

  body('description')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Description cannot exceed 2000 characters')
    .escape(),

  body('price')
    .optional()
    .isFloat({ min: 0.01 })
    .withMessage('Price must be a positive number')
    .custom(isValidPrice),

  body('stock')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Stock must be a non-negative integer')
    .toInt(),

  body('category')
    .optional()
    .trim()
    .custom(isValidObjectId)
    .withMessage('Invalid category ID'),

  body('images')
    .optional()
    .isArray({ min: 0, max: 5 })
    .withMessage('Images must be an array with maximum 5 items'),

  body('images.*.url')
    .optional()
    .isURL()
    .withMessage('Invalid image URL'),

  body('images.*.alt')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Image alt text cannot exceed 100 characters')
    .escape(),

  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array'),

  body('tags.*')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Tag cannot exceed 50 characters')
    .escape(),

  body('featured')
    .optional()
    .isBoolean()
    .withMessage('Featured must be a boolean')
    .toBoolean(),

  body('onSale')
    .optional()
    .isBoolean()
    .withMessage('onSale must be a boolean')
    .toBoolean(),

  body('discountPrice')
    .optional()
    .if(body('onSale').equals(true))
    .isFloat({ min: 0 })
    .withMessage('Discount price must be a positive number')
    .custom((value, { req }) => {
      if (req.body.price && value >= req.body.price) {
        throw new Error('Discount price must be less than regular price');
      }
      return true;
    })
];

// Validate product ID parameter


const validateProductId = [
  param('id')
    .custom(isValidObjectId)
    .withMessage('Invalid product ID')
];

/**
 * User Validations
 */

// Validate user registration


const validateUserRegistration = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Invalid email format')
    .normalizeEmail()
    .isLength({ max: 255 })
    .withMessage('Email cannot exceed 255 characters'),

  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 8, max: 128 })
    .withMessage('Password must be between 8 and 128 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),

  body('firstName')
    .trim()
    .notEmpty()
    .withMessage('First name is required')
    .isLength({ min: 1, max: 50 })
    .withMessage('First name must be between 1 and 50 characters')
    .escape(),

  body('lastName')
    .trim()
    .notEmpty()
    .withMessage('Last name is required')
    .isLength({ min: 1, max: 50 })
    .withMessage('Last name must be between 1 and 50 characters')
    .escape(),

  body('phone')
    .optional()
    .trim()
    .matches(/^[\d\s\-\+\(\)]+$/)
    .withMessage('Invalid phone number format')
    .isLength({ max: 20 })
    .withMessage('Phone number cannot exceed 20 characters')
];

// Validate user login


const validateUserLogin = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Invalid email format')
    .normalizeEmail(),

  body('password')
    .notEmpty()
    .withMessage('Password is required')
];

// Validate user profile update


const validateUserUpdate = [
  body('firstName')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('First name must be between 1 and 50 characters')
    .escape(),

  body('lastName')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Last name must be between 1 and 50 characters')
    .escape(),

  body('phone')
    .optional()
    .trim()
    .matches(/^[\d\s\-\+\(\)]+$/)
    .withMessage('Invalid phone number format')
    .isLength({ max: 20 })
    .withMessage('Phone number cannot exceed 20 characters'),

  body('address.street')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Street address cannot exceed 200 characters')
    .escape(),

  body('address.city')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('City cannot exceed 100 characters')
    .escape(),

  body('address.state')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('State cannot exceed 100 characters')
    .escape(),

  body('address.zipCode')
    .optional()
    .trim()
    .matches(/^[\d\-\s]+$/)
    .withMessage('Invalid zip code format')
    .isLength({ max: 20 })
    .withMessage('Zip code cannot exceed 20 characters'),

  body('address.country')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Country cannot exceed 100 characters')
    .escape()
];

/**
 * Cart Validations
 */

// Validate add to cart


const validateAddToCart = [
  body('productId')
    .trim()
    .notEmpty()
    .withMessage('Product ID is required')
    .custom(isValidObjectId)
    .withMessage('Invalid product ID'),

  body('quantity')
    .notEmpty()
    .withMessage('Quantity is required')
    .isInt({ min: 1, max: 100 })
    .withMessage('Quantity must be between 1 and 100')
    .toInt()
    .custom(isValidQuantity)
];

// Validate update cart item


const validateUpdateCartItem = [
  param('itemId')
    .custom(isValidObjectId)
    .withMessage('Invalid cart item ID'),

  body('quantity')
    .notEmpty()
    .withMessage('Quantity is required')
    .isInt({ min: 1, max: 100 })
    .withMessage('Quantity must be between 1 and 100')
    .toInt()
    .custom(isValidQuantity)
];

// Validate remove from cart


const validateRemoveFromCart = [
  param('itemId')
    .custom(isValidObjectId)
    .withMessage('Invalid cart item ID')
];

/**
 * Order Validations
 */

// Validate create order


const validateCreateOrder = [
  body('shippingAddress.street')
    .trim()
    .notEmpty()
    .withMessage('Street address is required')
    .isLength({ max: 200 })
    .withMessage('Street address cannot exceed 200 characters')
    .escape(),

  body('shippingAddress.city')
    .trim()
    .notEmpty()
    .withMessage('City is required')
    .isLength({ max: 100 })
    .withMessage('City cannot exceed 100 characters')
    .escape(),

  body('shippingAddress.state')
    .trim()
    .notEmpty()
    .withMessage('State is required')
    .isLength({ max: 100 })
    .withMessage('State cannot exceed 100 characters')
    .escape(),

  body('shippingAddress.zipCode')
    .trim()
    .notEmpty()
    .withMessage('Zip code is required')
    .matches(/^\d{5}(-\d{4})?$/)
    .withMessage('Invalid zip code format (use 12345 or 12345-6789)'),

  body('shippingAddress.country')
    .trim()
    .notEmpty()
    .withMessage('Country is required')
    .isLength({ max: 100 })
    .withMessage('Country cannot exceed 100 characters')
    .escape(),

  body('paymentMethod')
    .trim()
    .notEmpty()
    .withMessage('Payment method is required')
    .isIn(['credit_card', 'debit_card', 'paypal', 'stripe'])
    .withMessage('Invalid payment method'),

  body('items')
    .optional()
    .isArray({ min: 1 })
    .withMessage('Order must contain at least one item'),

  body('items.*.productId')
    .optional()
    .custom(isValidObjectId)
    .withMessage('Invalid product ID in order items'),

  body('items.*.quantity')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Item quantity must be at least 1')
    .toInt()
];

// Validate update order status


const validateUpdateOrderStatus = [
  param('id')
    .custom(isValidObjectId)
    .withMessage('Invalid order ID'),

  body('status')
    .trim()
    .notEmpty()
    .withMessage('Status is required')
    .isIn(['pending', 'processing', 'shipped', 'delivered', 'cancelled'])
    .withMessage('Invalid order status')
];

module.exports = {
  handleValidationErrors,
  validateCreateProduct,
  validateUpdateProduct,
  validateProductId,
