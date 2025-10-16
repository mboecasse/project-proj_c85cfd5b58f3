// File: src/models/Category.js
// Generated: 2025-10-16 10:42:09 UTC
// Project ID: proj_c85cfd5b58f3
// Task ID: task_vtunzynmerh7


const logger = require('../utils/logger');


const mongoose = require('mongoose');

/**
 * Category Schema
 * Supports hierarchical category structure with parent-child relationships
 */


const CategorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Category name is required'],
      trim: true,
      minlength: [2, 'Category name must be at least 2 characters'],
      maxlength: [100, 'Category name cannot exceed 100 characters'],
      validate: {
        validator: function(value) {
          return /^[a-zA-Z0-9\s\-']+$/.test(value);
        },
        message: 'Category name can only contain letters, numbers, spaces, hyphens, and apostrophes'
      }
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      validate: {
        validator: function(value) {
          return /^[a-z0-9\-]+$/.test(value);
        },
        message: 'Slug can only contain lowercase letters, numbers, and hyphens'
      }
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters']
    },
    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      default: null
    },
    level: {
      type: Number,
      default: 0,
      min: [0, 'Level cannot be negative'],
      max: [5, 'Maximum nesting level is 5']
    },
    path: {
      type: [mongoose.Schema.Types.ObjectId],
      default: []
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true
    },
    displayOrder: {
      type: Number,
      default: 0,
      min: [0, 'Display order cannot be negative']
    },
    image: {
      type: String,
      trim: true
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

/**
 * Indexes for performance optimization
 */
CategorySchema.index({ parent: 1, displayOrder: 1 });
CategorySchema.index({ isActive: 1, isDeleted: 1 });
CategorySchema.index({ slug: 1 }, { unique: true });
CategorySchema.index({ name: 'text', description: 'text' });
CategorySchema.index({ path: 1 });

/**
 * Virtual for child count
 */
CategorySchema.virtual('childCount', {
  ref: 'Category',
  localField: '_id',
  foreignField: 'parent',
  count: true
});

/**
 * Pre-save middleware
 * Auto-generate slug, calculate level, validate parent, and update path
 */
CategorySchema.pre('save', async function(next) {
  try {
    // Generate slug from name if not provided or name changed
    if (this.isModified('name') && !this.isModified('slug')) {
      this.slug = await this.constructor.generateUniqueSlug(this.name, this._id);
    }

    // Validate and process parent category
    if (this.parent) {
      const parentCategory = await this.constructor.findOne({
        _id: this.parent,
        isDeleted: false
      });

      if (!parentCategory) {
        throw new Error('Parent category does not exist or has been deleted');
      }

      if (!parentCategory.isActive) {
        throw new Error('Parent category must be active');
      }

      // Check for circular reference
      if (this._id && parentCategory.path.includes(this._id)) {
        throw new Error('Circular parent-child relationship detected');
      }

      // Calculate level and path
      this.level = parentCategory.level + 1;

      if (this.level > 5) {
        throw new Error('Maximum nesting level of 5 exceeded');
      }

      this.path = [...parentCategory.path, parentCategory._id];
    } else {
      // Root category
      this.level = 0;
      this.path = [];
    }

    next();
  } catch (error) {
    logger.error('Category pre-save error', {
      categoryId: this._id,
      error: error.message
    });
    next(error);
  }
});

/**
 * Pre-update middleware to handle parent changes
 */
CategorySchema.pre('findOneAndUpdate', async function(next) {
  try {
    const update = this.getUpdate();

    if (update.parent !== undefined || update.$set.parent !== undefined) {
      const parentId = update.parent || update.$set?.parent;
      const docId = this.getQuery()._id;

      if (parentId) {
        const parentCategory = await this.model.findOne({
          _id: parentId,
          isDeleted: false
        });

        if (!parentCategory) {
          throw new Error('Parent category does not exist or has been deleted');
        }

        if (!parentCategory.isActive) {
          throw new Error('Parent category must be active');
        }

        // Check for circular reference
        if (docId && parentCategory.path.includes(docId)) {
          throw new Error('Circular parent-child relationship detected');
        }

        const newLevel = parentCategory.level + 1;
        if (newLevel > 5) {
          throw new Error('Maximum nesting level of 5 exceeded');
        }

        // Update level and path
        if (update.$set) {
          update.$set.level = newLevel;
          update.$set.path = [...parentCategory.path, parentCategory._id];
        } else {
          update.level = newLevel;
          update.path = [...parentCategory.path, parentCategory._id];
        }
      } else {
        // Moving to root
        if (update.$set) {
          update.$set.level = 0;
          update.$set.path = [];
        } else {
          update.level = 0;
          update.path = [];
        }
      }
    }

    next();
  } catch (error) {
    logger.error('Category pre-update error', { error: error.message });
    next(error);
  }
});

/**
 * Generate unique slug from name
 * @param {String} name - Category name
 * @param {ObjectId} excludeId - Category ID to exclude from uniqueness check
 * @returns {String} Unique slug
 */
CategorySchema.statics.generateUniqueSlug = async function(name, excludeId = null) {
  const baseSlug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s\-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  let slug = baseSlug;
  let counter = 1;

  while (true) {
    const query = { slug };
    if (excludeId) {
      query._id = { $ne: excludeId };
    }

    const existing = await this.findOne(query);
    if (!existing) {
      return slug;
    }

    slug = `${baseSlug}-${counter}`;
    counter++;
  }
};

/**
 * Get all root categories (top-level categories)
 * @param {Boolean} activeOnly - Return only active categories
 * @returns {Array} Root categories
 */
CategorySchema.statics.getRootCategories = async function(activeOnly = true) {
  try {
    const query = { parent: null, isDeleted: false };
    if (activeOnly) {
      query.isActive = true;
    }

    const categories = await this.find(query)
      .sort({ displayOrder: 1, name: 1 })
      .lean();

    logger.info('Fetched root categories', { count: categories.length });
    return categories;
  } catch (error) {
    logger.error('Failed to fetch root categories', { error: error.message });
    throw error;
  }
};

/**
 * Build nested category tree
 * @param {ObjectId} parentId - Parent category ID (null for root)
 * @param {Boolean} activeOnly - Include only active categories
 * @returns {Array} Nested category tree
 */
CategorySchema.statics.getCategoryTree = async function(parentId = null, activeOnly = true) {
  try {
    const query = { parent: parentId, isDeleted: false };
    if (activeOnly) {
      query.isActive = true;
    }

    const categories = await this.find(query)
      .sort({ displayOrder: 1, name: 1 })
      .lean();

    // Recursively fetch children
    for (const category of categories) {
      category.children = await this.getCategoryTree(category._id, activeOnly);
    }

    return categories;
  } catch (error) {
    logger.error('Failed to build category tree', { error: error.message });
    throw error;
  }
};

/**
 * Find category by slug
 * @param {String} slug - Category slug
 * @returns {Object} Category document
 */
CategorySchema.statics.findBySlug = async function(slug) {
  try {
    const category = await this.findOne({ slug, isDeleted: false });

    if (!category) {
      logger.warn('Category not found by slug', { slug });
      return null;
    }

    return category;
  } catch (error) {
    logger.error('Failed to find category by slug', { slug, error: error.message });
    throw error;
  }
};

/**
 * Get all active categories (flat list)
 * @returns {Array} Active categories
 */
CategorySchema.statics.getActiveCategories = async function() {
  try {
    const categories = await this.find({ isActive: true, isDeleted: false })
      .sort({ level: 1, displayOrder: 1, name: 1 })
      .lean();

    return categories;
  } catch (error) {
    logger.error('Failed to fetch active categories', { error: error.message });
    throw error;
  }
};

/**
 * Reorder categories by updating display order
 * @param {Array} categoryIds - Array of category IDs in desired order
 * @returns {Boolean} Success status
 */
CategorySchema.statics.reorderCategories = async function(categoryIds) {
  try {
    const bulkOps = categoryIds.map((id, index) => ({
      updateOne: {
        filter: { _id: id },
        update: { $set: { displayOrder: index } }
      }
    }));

    await this.bulkWrite(bulkOps);
    logger.info('Reordered categories', { count: categoryIds.length });
    return true;
  } catch (error) {
    logger.error('Failed to reorder categories', { error: error.message });
    throw error;
  }
};

/**
 * Get direct children of this category
 * @returns {Array} Child categories
 */
CategorySchema.methods.getChildren = async function() {
  try {
    const children = await this.constructor.find({
      parent: this._id,
      isDeleted: false
    })
    .sort({ displayOrder: 1, name: 1 })
    .lean();

    return children;
  } catch (error) {
    logger.error('Failed to get category children', {
      categoryId: this._id,
      error: error.message
    });
    throw error;
  }
};

/**
 * Get all descendants (nested children) recursively
 * @returns {Array} All descendant categories
 */
CategorySchema.methods.getDescendants = async function() {
  try {
    const descendants = await this.constructor.find({
      path: this._id,
      isDeleted: false
    })
    .sort({ level: 1, displayOrder: 1, name: 1 })
    .lean();

    return descendants;
  } catch (error) {
    logger.error('Failed to get category descendants', {
      categoryId: this._id,
      error: error.message
    });
    throw error;
  }
};

/**
 * Get ancestor chain (parent hierarchy)
 * @returns {Array} Ancestor categories from root to immediate parent
 */
CategorySchema.methods.getAncestors = async function() {
  try {
    if (this.path.length === 0) {
      return [];
    }

    const ancestors = await this.constructor.find({
      _id: { $in: this.path },
      isDeleted: false
    })
    .sort({ level: 1 })
    .lean();

    return ancestors;
  } catch (error) {
    logger.error('Failed to get category ancestors', {
      categoryId: this._id,
      error: error.message
    });
    throw error;
  }
};

/**
 * Get full path breadcrumb (ancestors + current)
 * @returns {Array} Full category path
 */
CategorySchema.methods.getPath = async function() {
  try {
    const ancestors = await this.getAncestors();
    return [...ancestors, this.toObject()];
  } catch (error) {
    logger.error('Failed to get category path', {
      categoryId: this._id,
      error: error.message
    });
    throw error;
  }
};

/**
 * Check if category has associated products
 * @returns {Boolean} True if category has products
 */
CategorySchema.methods.hasProducts = async function() {
  try {
    const Product = mongoose.model('Product');
    const count = await Product.countDocuments({ category: this._id });
    return count > 0;
  } catch (error) {
    logger.error('Failed to check if category has products', {
      categoryId: this._id,
      error: error.message
    });
    throw error;
  }
};

/**
 * Check if category can be safely deleted
 * @returns {Object} { canDelete: Boolean, reason: String }
 */
CategorySchema.methods.canDelete = async function() {
  try {
    // Check for any descendants (direct children and nested children)
    const descendantsCount = await this.constructor.countDocuments({
      path: this._id,
      isDeleted: false
    });

    if (descendantsCount > 0) {
      return {
        canDelete: false,
        reason: `Category has ${descendantsCount} descendant ${descendantsCount === 1 ? 'category' : 'categories'} in its hierarchy`
      };
    }

    // Check for products
    const hasProducts = await this.hasProducts();
    if (hasProducts) {
      return {
        canDelete: false,
        reason: 'Category has associated products'
      };
    }

    return { canDelete: true, reason: null };
  } catch (error) {
    logger.error('Failed to check if category can be deleted', {
      categoryId: this._id,
      error: error.message
    });
    throw error;
  }
};

/**
 * Soft delete category
 * @returns {Object} Updated category
 */
CategorySchema.methods.softDelete = async function() {
  try {
    const deleteCheck = await this.canDelete();

    if (!deleteCheck.canDelete) {
      throw new Error(deleteCheck.reason);
    }

    this.isDeleted = true;
    this.isActive = false;
    await this.save();

    logger.info('Soft deleted category', { categoryId: this._id });
    return this;
  } catch (error) {
    logger.error('Failed to soft delete category', {
      categoryId: this._id,
      error: error.message
    });
    throw error;
  }
};


const Category = mongoose.model('Category', CategorySchema);

module.exports = Category;
