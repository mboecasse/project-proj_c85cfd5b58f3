// File: src/controllers/category.controller.js
// Generated: 2025-10-16 10:50:39 UTC
// Project ID: proj_c85cfd5b58f3
// Task ID: task_ug3985vgn4ca


const ApiResponse = require('../utils/response');


const categoryService = require('../services/category.service');


const logger = require('../utils/logger');

/**
 * Get all categories
 * @route GET /api/categories
 */


const getAllCategories = async (req, res, next) => {
  try {
    const { page, limit, sort, search, parentId } = req.query;

    const options = {
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 10,
      sort: sort || 'name',
      search: search || '',
      parentId: parentId || null
    };

    const result = await categoryService.getAllCategories(options);

    logger.info('Fetched all categories', {
      count: result.categories.length,
      page: options.page,
      totalPages: result.pagination.totalPages
    });

    res.status(200).json(
      ApiResponse.success(result, 'Categories fetched successfully')
    );
  } catch (error) {
    logger.error('Failed to fetch categories', {
      error: error.message,
      stack: error.stack
    });
    next(error);
  }
};

/**
 * Get category by ID
 * @route GET /api/categories/:id
 */


const getCategoryById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { includeProducts } = req.query;

    const category = await categoryService.getCategoryById(id, {
      includeProducts: includeProducts === 'true'
    });

    if (!category) {
      logger.warn('Category not found', { categoryId: id });
      return res.status(404).json(
        ApiResponse.error('Category not found', 404)
      );
    }

    logger.info('Fetched category by ID', { categoryId: id });

    res.status(200).json(
      ApiResponse.success(category, 'Category fetched successfully')
    );
  } catch (error) {
    logger.error('Failed to fetch category', {
      categoryId: req.params.id,
      error: error.message,
      stack: error.stack
    });
    next(error);
  }
};

/**
 * Create new category
 * @route POST /api/categories
 */


const createCategory = async (req, res, next) => {
  try {
    const categoryData = req.body;

    const category = await categoryService.createCategory(categoryData);

    logger.info('Created new category', {
      categoryId: category._id,
      name: category.name
    });

    res.status(201).json(
      ApiResponse.success(category, 'Category created successfully')
    );
  } catch (error) {
    logger.error('Failed to create category', {
      categoryData: req.body,
      error: error.message,
      stack: error.stack
    });
    next(error);
  }
};

/**
 * Update category
 * @route PUT /api/categories/:id
 */


const updateCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const category = await categoryService.updateCategory(id, updates);

    if (!category) {
      logger.warn('Category not found for update', { categoryId: id });
      return res.status(404).json(
        ApiResponse.error('Category not found', 404)
      );
    }

    logger.info('Updated category', {
      categoryId: id,
      updates: Object.keys(updates)
    });

    res.status(200).json(
      ApiResponse.success(category, 'Category updated successfully')
    );
  } catch (error) {
    logger.error('Failed to update category', {
      categoryId: req.params.id,
      updates: req.body,
      error: error.message,
      stack: error.stack
    });
    next(error);
  }
};

/**
 * Delete category
 * @route DELETE /api/categories/:id
 */


const deleteCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { force } = req.query;

    const result = await categoryService.deleteCategory(id, {
      force: force === 'true'
    });

    if (!result.success) {
      logger.warn('Failed to delete category', {
        categoryId: id,
        reason: result.message
      });
      return res.status(400).json(
        ApiResponse.error(result.message, 400)
      );
    }

    logger.info('Deleted category', { categoryId: id });

    res.status(200).json(
      ApiResponse.success(null, result.message)
    );
  } catch (error) {
    logger.error('Failed to delete category', {
      categoryId: req.params.id,
      error: error.message,
      stack: error.stack
    });
    next(error);
  }
};

/**
 * Get subcategories of a category
 * @route GET /api/categories/:id/subcategories
 */


const getSubcategories = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { page, limit } = req.query;

    const options = {
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 10
    };

    const result = await categoryService.getSubcategories(id, options);

    logger.info('Fetched subcategories', {
      parentId: id,
      count: result.subcategories.length
    });

    res.status(200).json(
      ApiResponse.success(result, 'Subcategories fetched successfully')
    );
  } catch (error) {
    logger.error('Failed to fetch subcategories', {
      parentId: req.params.id,
      error: error.message,
      stack: error.stack
    });
    next(error);
  }
};

/**
 * Get category tree (hierarchical structure)
 * @route GET /api/categories/tree
 */


const getCategoryTree = async (req, res, next) => {
  try {
    const { maxDepth } = req.query;

    const options = {
      maxDepth: parseInt(maxDepth) || null
    };

    const tree = await categoryService.getCategoryTree(options);

    logger.info('Fetched category tree', {
      rootCategories: tree.length
    });

    res.status(200).json(
      ApiResponse.success(tree, 'Category tree fetched successfully')
    );
  } catch (error) {
    logger.error('Failed to fetch category tree', {
      error: error.message,
      stack: error.stack
    });
    next(error);
  }
};

module.exports = {
  getAllCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
  getSubcategories,
  getCategoryTree
};
