// File: src/routes/category.routes.js
// Generated: 2025-10-16 10:48:41 UTC
// Project ID: proj_c85cfd5b58f3
// Task ID: task_790gqsydecje

      const Product = require('../models/Product');


const Category = require('../models/Category');


const express = require('express');


const logger = require('../utils/logger');

const { authenticate } = require('../middleware/auth');

const { body, param, query, validationResult } = require('express-validator');

const { requireRole } = require('../middleware/authorization');


const router = express.Router();

/**
 * Validation middleware for category creation
 */


const validateCreateCategory = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Category name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Category name must be between 2 and 100 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must not exceed 500 characters'),
  body('parentId')
    .optional()
    .isMongoId()
    .withMessage('Invalid parent category ID'),
  body('imageUrl')
    .optional()
    .trim()
    .isURL()
    .withMessage('Invalid image URL format'),
  body('displayOrder')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Display order must be a non-negative integer')
];

/**
 * Validation middleware for category update
 */


const validateUpdateCategory = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Category name must be between 2 and 100 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must not exceed 500 characters'),
  body('parentId')
    .optional()
    .isMongoId()
    .withMessage('Invalid parent category ID'),
  body('imageUrl')
    .optional()
    .trim()
    .isURL()
    .withMessage('Invalid image URL format'),
  body('displayOrder')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Display order must be a non-negative integer')
];

/**
 * Validation middleware for category ID parameter
 */


const validateCategoryId = [
  param('id')
    .isMongoId()
    .withMessage('Invalid category ID format')
];

/**
 * Validation middleware for slug parameter
 */


const validateSlug = [
  param('slug')
    .trim()
    .notEmpty()
    .withMessage('Slug is required')
    .matches(/^[a-z0-9-]+$/)
    .withMessage('Invalid slug format')
];

/**
 * Validation middleware for query parameters
 */


const validateQueryParams = [
  query('parent')
    .optional()
    .isMongoId()
    .withMessage('Invalid parent category ID'),
  query('active')
    .optional()
    .isBoolean()
    .withMessage('Active must be a boolean value'),
  query('includeEmpty')
    .optional()
    .isBoolean()
    .withMessage('IncludeEmpty must be a boolean value'),
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
];

/**
 * Validation error handler middleware
 */


const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    logger.warn('Validation failed', {
      path: req.path,
      errors: errors.array()
    });

    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors.array().map(err => ({
        field: err.param,
        message: err.msg
      }))
    });
  }

  next();
};

/**
 * GET /
 * Fetch all categories with optional filtering
 * Query params: parent, active, includeEmpty, page, limit
 */
router.get('/', validateQueryParams, handleValidationErrors, async (req, res, next) => {
  try {
    const { parent, active, includeEmpty, page = 1, limit = 50 } = req.query;

    // Build query
    const query = {};

    if (parent !== undefined) {
      query.parentId = parent === 'null' ? null : parent;
    }

    if (active !== undefined) {
      query.isActive = active === 'true';
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Fetch categories
    const categories = await Category.find(query)
      .sort({ displayOrder: 1, name: 1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('parentId', 'name slug')
      .lean();

    // Get total count
    const total = await Category.countDocuments(query);

    // Optionally filter out empty categories
    let filteredCategories = categories;
    if (includeEmpty === 'false') {
      const categoriesWithProducts = await Promise.all(
        categories.map(async (category) => {
          const productCount = await Product.countDocuments({
            categoryId: category._id,
            isActive: true
          });
          return productCount > 0 ? { ...category, productCount } : null;
        })
      );
      filteredCategories = categoriesWithProducts.filter(cat => cat !== null);
    }

    logger.info('Fetched categories', {
      count: filteredCategories.length,
      total,
      page,
      filters: { parent, active, includeEmpty }
    });

    res.json({
      success: true,
      data: filteredCategories,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    logger.error('Failed to fetch categories', { error: error.message });
    next(error);
  }
});

/**
 * GET /:id
 * Fetch single category by ID with details
 */
router.get('/:id', validateCategoryId, handleValidationErrors, async (req, res, next) => {
  try {
    const { id } = req.params;

    const category = await Category.findById(id)
      .populate('parentId', 'name slug')
      .lean();

    if (!category) {
      return res.status(404).json({
        success: false,
        error: 'Category not found'
      });
    }

    // Get subcategories
    const subcategories = await Category.find({ parentId: id, isActive: true })
      .sort({ displayOrder: 1, name: 1 })
      .lean();

    // Get product count
    const productCount = await Product.countDocuments({
      categoryId: id,
      isActive: true
    });

    // Build breadcrumb path
    const breadcrumb = [];
    let currentCategory = category;

    while (currentCategory) {
      breadcrumb.unshift({
        id: currentCategory._id,
        name: currentCategory.name,
        slug: currentCategory.slug
      });

      if (currentCategory.parentId) {
        currentCategory = await Category.findById(currentCategory.parentId).lean();
      } else {
        currentCategory = null;
      }
    }

    logger.info('Fetched category by ID', { categoryId: id });

    res.json({
      success: true,
      data: {
        ...category,
        subcategories,
        productCount,
        breadcrumb
      }
    });
  } catch (error) {
    logger.error('Failed to fetch category', { categoryId: req.params.id, error: error.message });
    next(error);
  }
});

/**
 * GET /slug/:slug
 * Fetch category by slug
 */
router.get('/slug/:slug', validateSlug, handleValidationErrors, async (req, res, next) => {
  try {
    const { slug } = req.params;

    const category = await Category.findOne({ slug })
      .populate('parentId', 'name slug')
      .lean();

    if (!category) {
      return res.status(404).json({
        success: false,
        error: 'Category not found'
      });
    }

    // Get subcategories
    const subcategories = await Category.find({ parentId: category._id, isActive: true })
      .sort({ displayOrder: 1, name: 1 })
      .lean();

    // Get product count
    const productCount = await Product.countDocuments({
      categoryId: category._id,
      isActive: true
    });

    logger.info('Fetched category by slug', { slug });

    res.json({
      success: true,
      data: {
        ...category,
        subcategories,
        productCount
      }
    });
  } catch (error) {
    logger.error('Failed to fetch category by slug', { slug: req.params.slug, error: error.message });
    next(error);
  }
});

/**
 * GET /:id/subcategories
 * Fetch all subcategories of a category
 */
router.get('/:id/subcategories', validateCategoryId, handleValidationErrors, async (req, res, next) => {
  try {
    const { id } = req.params;

    // Verify parent category exists
    const parentCategory = await Category.findById(id);

    if (!parentCategory) {
      return res.status(404).json({
        success: false,
        error: 'Parent category not found'
      });
    }

    // Fetch subcategories
    const subcategories = await Category.find({ parentId: id })
      .sort({ displayOrder: 1, name: 1 })
      .lean();

    logger.info('Fetched subcategories', { parentId: id, count: subcategories.length });

    res.json({
      success: true,
      data: subcategories,
      parent: {
        id: parentCategory._id,
        name: parentCategory.name,
        slug: parentCategory.slug
      }
    });
  } catch (error) {
    logger.error('Failed to fetch subcategories', { parentId: req.params.id, error: error.message });
    next(error);
  }
});

/**
 * POST /
 * Create new category (Admin only)
 */
router.post('/', authenticate, requireRole(['admin']), validateCreateCategory, handleValidationErrors, async (req, res, next) => {
  try {
    const { name, description, parentId, imageUrl, displayOrder } = req.body;

    // Check if category with same name exists under same parent
    const existingCategory = await Category.findOne({
      name: name.trim(),
      parentId: parentId || null
    });

    if (existingCategory) {
      return res.status(409).json({
        success: false,
        error: 'Category with this name already exists under the same parent'
      });
    }

    // Verify parent category exists and is active
    let level = 0;
    if (parentId) {
      const parentCategory = await Category.findById(parentId);

      if (!parentCategory) {
        return res.status(404).json({
          success: false,
          error: 'Parent category not found'
        });
      }

      if (!parentCategory.isActive) {
        return res.status(400).json({
          success: false,
          error: 'Parent category is not active'
        });
      }

      level = parentCategory.level + 1;

      // Check maximum depth
      if (level > 5) {
        return res.status(400).json({
          success: false,
          error: 'Maximum category depth (5 levels) exceeded'
        });
      }
    }

    // Generate slug from name
    const baseSlug = name.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    // Ensure unique slug
    let slug = baseSlug;
    let counter = 1;

    while (await Category.findOne({ slug })) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    // Create category
    const category = await Category.create({
      name: name.trim(),
      slug,
      description: description?.trim(),
      parentId: parentId || null,
      level,
      imageUrl,
      displayOrder: displayOrder || 0,
      isActive: true,
      metadata: {
        productCount: 0
      }
    });

    logger.info('Created new category', {
      categoryId: category._id,
      name: category.name,
      createdBy: req.userId
    });

    res.status(201).json({
      success: true,
      data: category,
      message: 'Category created successfully'
    });
  } catch (error) {
    logger.error('Failed to create category', { error: error.message, userId: req.userId });
    next(error);
  }
});

/**
 * PUT /:id
 * Update category (Admin only)
 */
router.put('/:id', authenticate, requireRole(['admin']), validateCategoryId, validateUpdateCategory, handleValidationErrors, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, description, parentId, imageUrl, displayOrder } = req.body;

    const category = await Category.findById(id);

    if (!category) {
      return res.status(404).json({
        success: false,
        error: 'Category not found'
      });
    }

    // Check for circular reference if parentId is being changed
    if (parentId !== undefined && parentId !== category.parentId?.toString()) {
      // Prevent setting parent to self
      if (parentId === id) {
        return res.status(400).json({
          success: false,
          error: 'Category cannot be its own parent'
        });
      }

      // Check if new parent would create circular reference
      if (parentId) {
        let currentParent = await Category.findById(parentId);

        if (!currentParent) {
          return res.status(404).json({
            success: false,
            error: 'Parent category not found'
          });
        }

        // Traverse up the parent chain to check for circular reference
        while (currentParent) {
          if (currentParent._id.toString() === id) {
            return res.status(400).json({
              success: false,
              error: 'Circular reference detected: category cannot be ancestor of itself'
            });
          }

          if (currentParent.parentId) {
            currentParent = await Category.findById(currentParent.parentId);
          } else {
            currentParent = null;
          }
        }

        // Calculate new level
        const parentCategory = await Category.findById(parentId);
        const newLevel = parentCategory.level + 1;

        if (newLevel > 5) {
          return res.status(400).json({
            success: false,
            error: 'Maximum category depth (5 levels) exceeded'
          });
        }
      }
    }

    // Update category fields
    if (name !== undefined) category.name = name.trim();
    if (description !== undefine
