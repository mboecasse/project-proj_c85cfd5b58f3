// File: src/services/category.service.js
// Generated: 2025-10-16 10:52:16 UTC
// Project ID: proj_c85cfd5b58f3
// Task ID: task_grbeaa88vxlk


const Category = require('../models/Category');


const logger = require('../utils/logger');


const mongoose = require('mongoose');

/**
 * Category Service
 * Handles all business logic for category management
 */
class CategoryService {
  /**
   * Create a new category
   * @param {Object} categoryData - Category data
   * @returns {Promise<Object>} Created category
   */
  async createCategory(categoryData) {
    try {
      const { name, description, parent, image, isActive, order, metadata } = categoryData;

      let level = 0;
      let parentCategory = null;

      // Validate parent category exists if parentId provided
      if (parent) {
        parentCategory = await Category.findById(parent);
        if (!parentCategory) {
          const error = new Error('Parent category not found');
          error.statusCode = 404;
          throw error;
        }

        // Validate hierarchy depth
        const parentLevel = parentCategory.level || 0;
        if (parentLevel >= 4) {
          const error = new Error('Maximum category depth (5 levels) exceeded');
          error.statusCode = 400;
          throw error;
        }

        level = (parentCategory.level || 0) + 1;
      }

      // Generate unique slug from name
      const slug = await this.generateUniqueSlug(name, parent);

      // Create category
      const category = await Category.create({
        name,
        slug,
        description,
        parent: parent || null,
        level,
        image,
        isActive: isActive !== undefined ? isActive : true,
        order: order || 0,
        metadata: metadata || {}
      });

      // Populate parent before returning
      await category.populate('parent', 'name slug');

      logger.info('Category created successfully', {
        categoryId: category._id,
        name: category.name,
        slug: category.slug,
        parent: parent || 'root'
      });

      return category;
    } catch (error) {
      logger.error('Failed to create category', {
        error: error.message,
        categoryData
      });
      throw error;
    }
  }

  /**
   * Get category by ID
   * @param {String} categoryId - Category ID
   * @param {Object} options - Query options
   * @returns {Promise<Object|null>} Category or null
   */
  async getCategoryById(categoryId, options = {}) {
    try {
      // Validate categoryId format
      if (!mongoose.Types.ObjectId.isValid(categoryId)) {
        const error = new Error('Invalid category ID format');
        error.statusCode = 400;
        throw error;
      }

      let query = Category.findById(categoryId);

      // Apply population if requested
      if (options.populate) {
        if (options.populate.includes('parent')) {
          query = query.populate('parent', 'name slug level');
        }
        if (options.populate.includes('children')) {
          query = query.populate('children', 'name slug level isActive');
        }
      }

      const category = await query;

      if (!category && options.throwOnNotFound) {
        const error = new Error('Category not found');
        error.statusCode = 404;
        throw error;
      }

      return category;
    } catch (error) {
      logger.error('Failed to fetch category by ID', {
        categoryId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get all categories with filters
   * @param {Object} filters - Filter criteria
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Categories and metadata
   */
  async getAllCategories(filters = {}, options = {}) {
    try {
      const query = {};

      // Apply filters
      if (filters.status !== undefined) {
        query.isActive = filters.status;
      }

      if (filters.parent !== undefined) {
        query.parent = filters.parent === 'root' ? null : filters.parent;
      }

      if (filters.level !== undefined) {
        query.level = filters.level;
      }

      if (filters.search) {
        query.$or = [
          { name: { $regex: filters.search, $options: 'i' } },
          { description: { $regex: filters.search, $options: 'i' } }
        ];
      }

      // Build query
      let categoryQuery = Category.find(query).sort({ order: 1, name: 1 });

      // Apply population
      if (options.populate) {
        categoryQuery = categoryQuery.populate('parent', 'name slug');
      }

      // Apply pagination if provided
      const page = options.page || 1;
      const limit = options.limit || 50;
      const skip = (page - 1) * limit;

      if (options.paginate) {
        categoryQuery = categoryQuery.skip(skip).limit(limit);
      }

      const categories = await categoryQuery;
      const total = await Category.countDocuments(query);

      logger.info('Fetched categories', {
        count: categories.length,
        total,
        filters
      });

      return {
        categories,
        meta: {
          total,
          page: options.paginate ? page : 1,
          limit: options.paginate ? limit : total,
          pages: options.paginate ? Math.ceil(total / limit) : 1
        }
      };
    } catch (error) {
      logger.error('Failed to fetch categories', {
        filters,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get category tree structure
   * @param {String|null} rootId - Root category ID (null for all roots)
   * @returns {Promise<Array>} Hierarchical category tree
   */
  async getCategoryTree(rootId = null) {
    try {
      let categories;

      if (rootId) {
        // Get specific branch
        const rootCategory = await Category.findById(rootId);
        if (!rootCategory) {
          const error = new Error('Root category not found');
          error.statusCode = 404;
          throw error;
        }

        // Get all descendants
        const descendantIds = await this.getDescendantIds(rootId);
        categories = await Category.find({
          _id: { $in: [rootId, ...descendantIds] }
        }).sort({ level: 1, order: 1, name: 1 });
      } else {
        // Get all categories
        categories = await Category.find().sort({ level: 1, order: 1, name: 1 });
      }

      // Build tree structure
      const tree = this.buildCategoryTree(categories, rootId);

      logger.info('Built category tree', {
        rootId: rootId || 'all',
        nodeCount: categories.length
      });

      return tree;
    } catch (error) {
      logger.error('Failed to build category tree', {
        rootId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Update category
   * @param {String} categoryId - Category ID
   * @param {Object} updateData - Update data
   * @returns {Promise<Object>} Updated category
   */
  async updateCategory(categoryId, updateData) {
    try {
      // Validate category exists
      const category = await Category.findById(categoryId);
      if (!category) {
        const error = new Error('Category not found');
        error.statusCode = 404;
        throw error;
      }

      // Check if parent change creates circular reference
      if (updateData.parent !== undefined && updateData.parent !== null) {
        if (updateData.parent === categoryId) {
          const error = new Error('Category cannot be its own parent');
          error.statusCode = 400;
          throw error;
        }

        await this.validateHierarchy(categoryId, updateData.parent);

        // Update level based on new parent
        const newParent = await Category.findById(updateData.parent);
        if (!newParent) {
          const error = new Error('New parent category not found');
          error.statusCode = 404;
          throw error;
        }
        updateData.level = (newParent.level || 0) + 1;
      } else if (updateData.parent === null) {
        // Moving to root level
        updateData.level = 0;
      }

      // Update slug if name changed
      if (updateData.name && updateData.name !== category.name) {
        updateData.slug = await this.generateUniqueSlug(
          updateData.name,
          updateData.parent !== undefined ? updateData.parent : category.parent,
          categoryId
        );
      }

      // Perform update
      const updatedCategory = await Category.findByIdAndUpdate(
        categoryId,
        updateData,
        { new: true, runValidators: true }
      ).populate('parent', 'name slug');

      // Update levels of all descendants if parent changed
      if (updateData.parent !== undefined) {
        await this.updateDescendantLevels(categoryId);
      }

      logger.info('Category updated successfully', {
        categoryId,
        updates: Object.keys(updateData)
      });

      return updatedCategory;
    } catch (error) {
      logger.error('Failed to update category', {
        categoryId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Delete category
   * @param {String} categoryId - Category ID
   * @param {Object} options - Deletion options
   * @returns {Promise<Object>} Deletion result
   */
  async deleteCategory(categoryId, options = {}) {
    try {
      const category = await Category.findById(categoryId);
      if (!category) {
        const error = new Error('Category not found');
        error.statusCode = 404;
        throw error;
      }

      // Check if category has children
      const childrenCount = await Category.countDocuments({ parent: categoryId });
      if (childrenCount > 0) {
        if (options.cascade) {
          // Delete all descendants
          const descendantIds = await this.getDescendantIds(categoryId);
          await Category.deleteMany({ _id: { $in: descendantIds } });
          logger.info('Deleted category descendants', {
            categoryId,
            count: descendantIds.length
          });
        } else {
          const error = new Error('Cannot delete category with children. Use cascade option or delete children first.');
          error.statusCode = 400;
          throw error;
        }
      }

      // Check if category has associated products (would need Product model)
      // This is a placeholder - actual implementation would query Product model
      // const productCount = await Product.countDocuments({ category: categoryId });
      // if (productCount > 0 && !options.force) {
      //   const error = new Error('Cannot delete category with associated products');
      //   error.statusCode = 400;
      //   throw error;
      // }

      // Perform deletion
      await Category.findByIdAndDelete(categoryId);

      logger.info('Category deleted successfully', {
        categoryId,
        cascade: options.cascade || false
      });

      return {
        success: true,
        message: 'Category deleted successfully',
        deletedId: categoryId
      };
    } catch (error) {
      logger.error('Failed to delete category', {
        categoryId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get category path (breadcrumb)
   * @param {String} categoryId - Category ID
   * @returns {Promise<Array>} Array of ancestor categories
   */
  async getCategoryPath(categoryId) {
    try {
      const path = [];
      let currentCategory = await Category.findById(categoryId);

      if (!currentCategory) {
        const error = new Error('Category not found');
        error.statusCode = 404;
        throw error;
      }

      // Build path from current to root
      while (currentCategory) {
        path.unshift({
          _id: currentCategory._id,
          name: currentCategory.name,
          slug: currentCategory.slug,
          level: currentCategory.level
        });

        if (currentCategory.parent) {
          currentCategory = await Category.findById(currentCategory.parent);
        } else {
          currentCategory = null;
        }
      }

      logger.info('Built category path', {
        categoryId,
        pathLength: path.length
      });

      return path;
    } catch (error) {
      logger.error('Failed to build category path', {
        categoryId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Validate category exists
   * @param {String} categoryId - Category ID
   * @returns {Promise<Boolean>} True if exists
   */
  async validateCategoryExists(categoryId) {
    try {
      const category = await Category.findById(categoryId);
      return !!category;
    } catch (error) {
      logger.error('Failed to validate category existence', {
        categoryId,
        error: error.message
      });
      return false;
    }
  }

  /**
   * Get category with ancestors
   * @param {String} categoryId - Category ID
   * @returns {Promise<Object>} Category with ancestors array
   */
  async getCategoryWithAncestors(categoryId) {
    try {
      const category = await Category.findById(categoryId);
      if (!category) {
        const error = new Error('Category not found');
        error.statusCode = 404;
        throw error;
      }

      const ancestors = await this.getCategoryPath(categoryId);

      return {
        ...category.toObject(),
        ancestors
      };
    } catch (error) {
      logger.error('Failed to get category with ancestors', {
        categoryId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get categories by IDs
   * @param {Array<String>} categoryIds - Array of category IDs
   * @returns {Promise<Array>} Array of categories
   */
  async getCategoriesByIds(categoryIds) {
    try {
      const categories = await Category.find({
        _id: { $in: categoryIds }
      });

      logger.info('Fetched categories by IDs', {
        requested: categoryIds.length,
        found: categories.length
      });

      return categories;
    } catch (error) {
      logger.error('Failed to fetch categories by IDs', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Generate unique slug from name
   * @param {String} name - Category name
   * @param {String|null} parentId - Parent category ID
   * @param {String|null} excludeId - Category ID to exclude from uniqueness check
   * @returns {Promise<String>} Unique slug
   */
  async generateUniqueSlug(name, parentId = null, excludeId = null) {
    try {
      // Convert name to slug
      let slug = name
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '');

      // Check uniqueness within same parent level
      const query = {
        slug,
        parent: parentId || null
      };

      if (excludeId) {
        query._id = { $ne: excludeId };
      }

      let existingCategory = await Category.findOne(query);
      let counter = 1;

      // Append number if duplicate exists
      while (existingCategory) {
        slug = `${slug.replace(/-\d+$/, '')}-${counter}`;
        query.slug = slug;
        existingCategory = await Category.findOne(query);
        counter++;
      }

      return slug;
    } catch (error) {
      logger.error('Failed to generate unique slug', {
        name,
        error: error.message
      });
      throw error;
    }
  }
}

module.exports = new CategoryService();
