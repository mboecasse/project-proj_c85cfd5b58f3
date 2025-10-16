// File: src/validators/product.validator.js
// Generated: 2025-10-16 10:41:17 UTC
// Project ID: proj_c85cfd5b58f3
// Task ID: task_xy14r1gy4p36


const logger = require('../utils/logger');

const { body, param, query, validationResult } = require('express-validator');

/**
 * Middleware to handle validation errors
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
      errors: formattedErrors
    });
  }

  next();
};

/**
 * Validation rules for creating a product
 */


const createProductValidation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Product name is required')
    .isLength({ min: 3, max: 200 })
    .withMessage('Product name must be between 3 and 200 characters'),

  body('description')
    .trim()
    .notEmpty()
    .withMessage('Product description is required')
    .isLength({ min: 10, max: 2000 })
    .withMessage('Product description must be between 10 and 2000 characters'),

  body('price')
    .notEmpty()
    .withMessage('Price is required')
    .isFloat({ min: 0.01 })
    .withMessage('Price must be a positive number')
    .custom((value) => {
      const decimalPlaces = (value.toString().split('.')[1] || '').length;
      if (decimalPlaces > 2) {
        throw new Error('Price can have maximum 2 decimal places');
      }
      return true;
    }),

  body('compareAtPrice')
    .optional()
    .isFloat({ min: 0.01 })
    .withMessage('Compare at price must be a positive number')
    .custom((value, { req }) => {
      if (value && req.body.price && parseFloat(value) <= parseFloat(req.body.price)) {
        throw new Error('Compare at price must be greater than regular price');
      }
      return true;
    }),

  body('sku')
    .trim()
    .notEmpty()
    .withMessage('SKU is required')
    .matches(/^[A-Z0-9-]{6,20}$/)
    .withMessage('SKU must be 6-20 characters long and contain only uppercase letters, numbers, and hyphens'),

  body('category')
    .trim()
    .notEmpty()
    .withMessage('Category is required')
    .isMongoId()
    .withMessage('Invalid category ID format'),

  body('subcategory')
    .optional()
    .trim()
    .isMongoId()
    .withMessage('Invalid subcategory ID format'),

  body('brand')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Brand name must not exceed 100 characters')
    .escape(),

  body('stock')
    .notEmpty()
    .withMessage('Stock quantity is required')
    .isInt({ min: 0 })
    .withMessage('Stock must be a non-negative integer'),

  body('images')
    .isArray({ min: 1, max: 10 })
    .withMessage('Product must have between 1 and 10 images')
    .custom((images) => {
      const urlPattern = /^https?:\/\/.+/;
      const allValid = images.every(img => typeof img === 'string' && urlPattern.test(img));
      if (!allValid) {
        throw new Error('All images must be valid URLs');
      }
      return true;
    }),

  body('tags')
    .optional()
    .isArray({ max: 20 })
    .withMessage('Maximum 20 tags allowed')
    .custom((tags) => {
      const allValid = tags.every(tag =>
        typeof tag === 'string' && tag.trim().length > 0 && tag.length <= 50
      );
      if (!allValid) {
        throw new Error('Each tag must be a non-empty string with maximum 50 characters');
      }
      return true;
    }),

  body('specifications')
    .optional()
    .isObject()
    .withMessage('Specifications must be an object'),

  body('dimensions')
    .optional()
    .isObject()
    .withMessage('Dimensions must be an object'),

  body('dimensions.length')
    .optional()
    .isFloat({ min: 0.01 })
    .withMessage('Length must be a positive number'),

  body('dimensions.width')
    .optional()
    .isFloat({ min: 0.01 })
    .withMessage('Width must be a positive number'),

  body('dimensions.height')
    .optional()
    .isFloat({ min: 0.01 })
    .withMessage('Height must be a positive number'),

  body('dimensions.unit')
    .optional()
    .isIn(['cm', 'inch'])
    .withMessage('Dimension unit must be either cm or inch'),

  body('weight')
    .optional()
    .isObject()
    .withMessage('Weight must be an object'),

  body('weight.value')
    .optional()
    .isFloat({ min: 0.01 })
    .withMessage('Weight value must be a positive number'),

  body('weight.unit')
    .optional()
    .isIn(['kg', 'lb', 'g'])
    .withMessage('Weight unit must be kg, lb, or g'),

  body('status')
    .optional()
    .isIn(['active', 'inactive', 'draft', 'out_of_stock', 'discontinued'])
    .withMessage('Invalid product status'),

  body('minOrderQuantity')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Minimum order quantity must be at least 1'),

  body('maxOrderQuantity')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Maximum order quantity must be at least 1')
    .custom((value, { req }) => {
      if (value && req.body.minOrderQuantity && parseInt(value) < parseInt(req.body.minOrderQuantity)) {
        throw new Error('Maximum order quantity must be greater than or equal to minimum order quantity');
      }
      return true;
    }),

  body('featured')
    .optional()
    .isBoolean()
    .withMessage('Featured must be a boolean value'),

  body('promoted')
    .optional()
    .isBoolean()
    .withMessage('Promoted must be a boolean value'),

  handleValidationErrors
];

/**
 * Validation rules for updating a product
 */


const updateProductValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid product ID format'),

  body('name')
    .optional()
    .trim()
    .isLength({ min: 3, max: 200 })
    .withMessage('Product name must be between 3 and 200 characters'),

  body('description')
    .optional()
    .trim()
    .isLength({ min: 10, max: 2000 })
    .withMessage('Product description must be between 10 and 2000 characters'),

  body('price')
    .optional()
    .isFloat({ min: 0.01 })
    .withMessage('Price must be a positive number')
    .custom((value) => {
      const decimalPlaces = (value.toString().split('.')[1] || '').length;
      if (decimalPlaces > 2) {
        throw new Error('Price can have maximum 2 decimal places');
      }
      return true;
    }),

  body('compareAtPrice')
    .optional()
    .isFloat({ min: 0.01 })
    .withMessage('Compare at price must be a positive number')
    .custom((value, { req }) => {
      if (value && req.body.price && parseFloat(value) <= parseFloat(req.body.price)) {
        throw new Error('Compare at price must be greater than regular price');
      }
      return true;
    }),

  body('sku')
    .optional()
    .trim()
    .matches(/^[A-Z0-9-]{6,20}$/)
    .withMessage('SKU must be 6-20 characters long and contain only uppercase letters, numbers, and hyphens'),

  body('category')
    .optional()
    .trim()
    .isMongoId()
    .withMessage('Invalid category ID format'),

  body('subcategory')
    .optional()
    .trim()
    .isMongoId()
    .withMessage('Invalid subcategory ID format'),

  body('brand')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Brand name must not exceed 100 characters')
    .escape(),

  body('stock')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Stock must be a non-negative integer'),

  body('images')
    .optional()
    .isArray({ min: 1, max: 10 })
    .withMessage('Product must have between 1 and 10 images')
    .custom((images) => {
      const urlPattern = /^https?:\/\/.+/;
      const allValid = images.every(img => typeof img === 'string' && urlPattern.test(img));
      if (!allValid) {
        throw new Error('All images must be valid URLs');
      }
      return true;
    }),

  body('tags')
    .optional()
    .isArray({ max: 20 })
    .withMessage('Maximum 20 tags allowed')
    .custom((tags) => {
      const allValid = tags.every(tag =>
        typeof tag === 'string' && tag.trim().length > 0 && tag.length <= 50
      );
      if (!allValid) {
        throw new Error('Each tag must be a non-empty string with maximum 50 characters');
      }
      return true;
    }),

  body('specifications')
    .optional()
    .isObject()
    .withMessage('Specifications must be an object'),

  body('dimensions')
    .optional()
    .isObject()
    .withMessage('Dimensions must be an object'),

  body('dimensions.length')
    .optional()
    .isFloat({ min: 0.01 })
    .withMessage('Length must be a positive number'),

  body('dimensions.width')
    .optional()
    .isFloat({ min: 0.01 })
    .withMessage('Width must be a positive number'),

  body('dimensions.height')
    .optional()
    .isFloat({ min: 0.01 })
    .withMessage('Height must be a positive number'),

  body('dimensions.unit')
    .optional()
    .isIn(['cm', 'inch'])
    .withMessage('Dimension unit must be either cm or inch'),

  body('weight')
    .optional()
    .isObject()
    .withMessage('Weight must be an object'),

  body('weight.value')
    .optional()
    .isFloat({ min: 0.01 })
    .withMessage('Weight value must be a positive number'),

  body('weight.unit')
    .optional()
    .isIn(['kg', 'lb', 'g'])
    .withMessage('Weight unit must be kg, lb, or g'),

  body('status')
    .optional()
    .isIn(['active', 'inactive', 'draft', 'out_of_stock', 'discontinued'])
    .withMessage('Invalid product status'),

  body('minOrderQuantity')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Minimum order quantity must be at least 1'),

  body('maxOrderQuantity')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Maximum order quantity must be at least 1')
    .custom((value, { req }) => {
      if (value && req.body.minOrderQuantity && parseInt(value) < parseInt(req.body.minOrderQuantity)) {
        throw new Error('Maximum order quantity must be greater than or equal to minimum order quantity');
      }
      return true;
    }),

  body('featured')
    .optional()
    .isBoolean()
    .withMessage('Featured must be a boolean value'),

  body('promoted')
    .optional()
    .isBoolean()
    .withMessage('Promoted must be a boolean value'),

  handleValidationErrors
];

/**
 * Validation rules for product ID parameter
 */


const validateProductId = [
  param('id')
    .isMongoId()
    .withMessage('Invalid product ID format'),

  handleValidationErrors
];

/**
 * Validation rules for product query parameters
 */


const productQueryValidation = [
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

  query('sort')
    .optional()
    .isIn(['price_asc', 'price_desc', 'name_asc', 'name_desc', 'newest', 'oldest', 'popular', 'rating'])
    .withMessage('Invalid sort option'),

  query('category')
    .optional()
    .isMongoId()
    .withMessage('Invalid category ID format'),

  query('subcategory')
    .optional()
    .isMongoId()
    .withMessage('Invalid subcategory ID format'),

  query('minPrice')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Minimum price must be a non-negative number')
    .toFloat(),

  query('maxPrice')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Maximum price must be a non-negative number')
    .toFloat()
    .custom((value, { req }) => {
      if (req.query.minPrice && parseFloat(value) < parseFloat(req.query.minPrice)) {
        throw new Error('Maximum price must be greater than minimum price');
      }
      return true;
    }),

  query('inStock')
    .optional()
    .isBoolean()
    .withMessage('inStock must be a boolean value')
    .toBoolean(),

  query('search')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Search query must be between 2 and 100 characters')
    .escape(),

  query('tags')
    .optional()
    .custom((value) => {
      if (typeof value === 'string') {
        return true;
      }
      if (Array.isArray(value)) {
        return value.every(tag => typeof tag === 'string');
      }
      throw new Error('Tags must be a string or array of strings');
    }),

  query('brand')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Brand filter must not exceed 100 characters'),

  query('status')
    .optional()
    .isIn(['active', 'inactive', 'draft', 'out_of_stock', 'discontinued'])
    .withMessage('Invalid status filter'),

  query('featured')
    .optional()
    .isBoolean()
    .withMessage('Featured filter must be a boolean value')
    .toBoolean(),

  query('promoted')
    .optional()
    .isBoolean()
    .withMessage('Promoted filter must be a boolean value')
    .toBoolean(),

  handleValidationErrors
];

/**
 * Validation rules for bulk operations
 */


const bulkUpdateValidation = [
  body('productIds')
    .isArray({ min: 1, max: 100 })
    .withMessage('Product IDs must be
])