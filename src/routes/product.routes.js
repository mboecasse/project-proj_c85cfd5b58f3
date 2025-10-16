// File: src/routes/product.routes.js
// Generated: 2025-10-16 10:45:54 UTC
// Project ID: proj_c85cfd5b58f3
// Task ID: task_w3av4scold2v


const express = require('express');


const logger = require('../utils/logger');


const mongoSanitize = require('express-mongo-sanitize');


const rateLimit = require('express-rate-limit');

const { authenticate, optionalAuth } = require('../middleware/auth');

const { requireRole, ROLES } = require('../middleware/authorization');


const router = express.Router();

const {
  getAllProducts,
  getProductById,
  searchProducts,
  createProduct,
  updateProduct,
  partialUpdateProduct,
  deleteProduct,
  getProductsByCategory,
  getFeaturedProducts,
  getRelatedProducts,
  updateProductStock
} = require('../controllers/product.controller');

const {
  validateCreateProduct,
  validateUpdateProduct,
  validateProductId,
  handleValidationErrors
} = require('../middleware/validation');

// Rate limiting for public endpoints


const publicQueryLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});


const searchLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // Limit each IP to 50 search requests per windowMs
  message: 'Too many search requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Input sanitization middleware


const sanitizeInput = (req, res, next) => {
  mongoSanitize.sanitize(req.body, { replaceWith: '_' });
  mongoSanitize.sanitize(req.query, { replaceWith: '_' });
  mongoSanitize.sanitize(req.params, { replaceWith: '_' });
  next();
};

/**
 * @route   GET /api/products/search
 * @desc    Search products by text query
 * @access  Public
 * @query   q (search query), page, limit, category, minPrice, maxPrice
 */
router.get('/search', searchLimiter, sanitizeInput, async (req, res, next) => {
  try {
    logger.info('GET /api/products/search - Searching products', { query: req.query });
    await searchProducts(req, res, next);
  } catch (error) {
    logger.error('Error in GET /api/products/search', { error: error.message, stack: error.stack });
    next(error);
  }
});

/**
 * @route   GET /api/products/featured
 * @desc    Get featured products
 * @access  Public
 * @query   limit (default: 10)
 */
router.get('/featured', publicQueryLimiter, sanitizeInput, async (req, res, next) => {
  try {
    logger.info('GET /api/products/featured - Fetching featured products');
    await getFeaturedProducts(req, res, next);
  } catch (error) {
    logger.error('Error in GET /api/products/featured', { error: error.message, stack: error.stack });
    next(error);
  }
});

/**
 * @route   GET /api/products/category/:category
 * @desc    Get products by category
 * @access  Public
 * @param   category - Category name or ID
 * @query   page, limit, sort
 */
router.get('/category/:category', publicQueryLimiter, sanitizeInput, async (req, res, next) => {
  try {
    logger.info('GET /api/products/category/:category - Fetching products by category', {
      category: req.params.category
    });
    await getProductsByCategory(req, res, next);
  } catch (error) {
    logger.error('Error in GET /api/products/category/:category', {
      error: error.message,
      category: req.params.category,
      stack: error.stack
    });
    next(error);
  }
});

/**
 * @route   GET /api/products
 * @desc    Get all products with pagination, filtering, and sorting
 * @access  Public
 * @query   page, limit, sort, category, minPrice, maxPrice, inStock, brand, minRating, search
 */
router.get('/', publicQueryLimiter, sanitizeInput, async (req, res, next) => {
  try {
    logger.info('GET /api/products - Fetching products', { query: req.query });
    await getAllProducts(req, res, next);
  } catch (error) {
    logger.error('Error in GET /api/products', { error: error.message, stack: error.stack });
    next(error);
  }
});

/**
 * @route   GET /api/products/:id/related
 * @desc    Get related products based on category and tags
 * @access  Public
 * @param   id - Product ID
 * @query   limit (default: 5)
 */
router.get('/:id/related', publicQueryLimiter, sanitizeInput, validateProductId, handleValidationErrors, async (req, res, next) => {
  try {
    logger.info('GET /api/products/:id/related - Fetching related products', {
      productId: req.params.id
    });
    await getRelatedProducts(req, res, next);
  } catch (error) {
    logger.error('Error in GET /api/products/:id/related', {
      error: error.message,
      productId: req.params.id,
      stack: error.stack
    });
    next(error);
  }
});

/**
 * @route   GET /api/products/:id
 * @desc    Get single product by ID
 * @access  Public
 * @param   id - Product ID
 */
router.get('/:id', publicQueryLimiter, sanitizeInput, validateProductId, handleValidationErrors, async (req, res, next) => {
  try {
    logger.info('GET /api/products/:id - Fetching product by ID', { productId: req.params.id });
    await getProductById(req, res, next);
  } catch (error) {
    logger.error('Error in GET /api/products/:id', {
      error: error.message,
      productId: req.params.id,
      stack: error.stack
    });
    next(error);
  }
});

/**
 * @route   POST /api/products
 * @desc    Create new product
 * @access  Private/Admin
 * @body    name, description, price, category, stock, images, brand, tags, etc.
 */
router.post(
  '/',
  authenticate,
  requireRole([ROLES.ADMIN, ROLES.MANAGER]),
  sanitizeInput,
  validateCreateProduct,
  handleValidationErrors,
  async (req, res, next) => {
    try {
      logger.info('POST /api/products - Creating new product', {
        userId: req.userId,
        productName: req.body.name
      });
      await createProduct(req, res, next);
    } catch (error) {
      logger.error('Error in POST /api/products', {
        error: error.message,
        userId: req.userId,
        stack: error.stack
      });
      next(error);
    }
  }
);

/**
 * @route   PUT /api/products/:id
 * @desc    Update product (full update)
 * @access  Private/Admin
 * @param   id - Product ID
 * @body    Product fields to update
 */
router.put(
  '/:id',
  authenticate,
  requireRole([ROLES.ADMIN, ROLES.MANAGER]),
  sanitizeInput,
  validateProductId,
  validateUpdateProduct,
  handleValidationErrors,
  async (req, res, next) => {
    try {
      logger.info('PUT /api/products/:id - Updating product', {
        userId: req.userId,
        productId: req.params.id
      });
      await updateProduct(req, res, next);
    } catch (error) {
      logger.error('Error in PUT /api/products/:id', {
        error: error.message,
        userId: req.userId,
        productId: req.params.id,
        stack: error.stack
      });
      next(error);
    }
  }
);

/**
 * @route   PATCH /api/products/:id/stock
 * @desc    Update product stock level
 * @access  Private/Admin
 * @param   id - Product ID
 * @body    stock - New stock quantity
 */
router.patch(
  '/:id/stock',
  authenticate,
  requireRole([ROLES.ADMIN, ROLES.MANAGER]),
  sanitizeInput,
  validateProductId,
  handleValidationErrors,
  async (req, res, next) => {
    try {
      logger.info('PATCH /api/products/:id/stock - Updating product stock', {
        userId: req.userId,
        productId: req.params.id,
        newStock: req.body.stock
      });
      await updateProductStock(req, res, next);
    } catch (error) {
      logger.error('Error in PATCH /api/products/:id/stock', {
        error: error.message,
        userId: req.userId,
        productId: req.params.id,
        stack: error.stack
      });
      next(error);
    }
  }
);

/**
 * @route   PATCH /api/products/:id
 * @desc    Partial update product
 * @access  Private/Admin
 * @param   id - Product ID
 * @body    Product fields to update (partial)
 */
router.patch(
  '/:id',
  authenticate,
  requireRole([ROLES.ADMIN, ROLES.MANAGER]),
  sanitizeInput,
  validateProductId,
  handleValidationErrors,
  async (req, res, next) => {
    try {
      logger.info('PATCH /api/products/:id - Partially updating product', {
        userId: req.userId,
        productId: req.params.id
      });
      await partialUpdateProduct(req, res, next);
    } catch (error) {
      logger.error('Error in PATCH /api/products/:id', {
        error: error.message,
        userId: req.userId,
        productId: req.params.id,
        stack: error.stack
      });
      next(error);
    }
  }
);

/**
 * @route   DELETE /api/products/:id
 * @desc    Delete product (soft delete - marks as inactive)
 * @access  Private/Admin
 * @param   id - Product ID
 */
router.delete(
  '/:id',
  authenticate,
  requireRole([ROLES.ADMIN]),
  sanitizeInput,
  validateProductId,
  handleValidationErrors,
  async (req, res, next) => {
    try {
      logger.info('DELETE /api/products/:id - Deleting product', {
        userId: req.userId,
        productId: req.params.id
      });
      await deleteProduct(req, res, next);
    } catch (error) {
      logger.error('Error in DELETE /api/products/:id', {
        error: error.message,
        userId: req.userId,
        productId: req.params.id,
        stack: error.stack
      });
      next(error);
    }
  }
);

module.exports = router;
