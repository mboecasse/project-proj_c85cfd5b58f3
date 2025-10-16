// File: src/models/Product.js
// Generated: 2025-10-16 10:42:12 UTC
// Project ID: proj_c85cfd5b58f3
// Task ID: task_k6isvi6tnmdk


const logger = require('../utils/logger');


const mongoose = require('mongoose');


const slugify = require('slugify');

/**
 * Product Schema
 * Manages product catalog with inventory, pricing, and variants
 */


const ProductSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
      minlength: [3, 'Product name must be at least 3 characters'],
      maxlength: [200, 'Product name cannot exceed 200 characters']
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
      index: true
    },
    description: {
      type: String,
      required: [true, 'Product description is required'],
      minlength: [10, 'Description must be at least 10 characters']
    },
    shortDescription: {
      type: String,
      maxlength: [160, 'Short description cannot exceed 160 characters']
    },
    sku: {
      type: String,
      required: [true, 'SKU is required'],
      unique: true,
      uppercase: true,
      trim: true,
      index: true
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price must be greater than or equal to 0'],
      set: (val) => Math.round(val * 100) / 100
    },
    compareAtPrice: {
      type: Number,
      min: [0, 'Compare at price must be greater than or equal to 0'],
      set: (val) => (val ? Math.round(val * 100) / 100 : val),
      validate: {
        validator: function (value) {
          return !value || value > this.price;
        },
        message: 'Compare at price must be greater than selling price'
      }
    },
    costPrice: {
      type: Number,
      min: [0, 'Cost price must be greater than or equal to 0'],
      set: (val) => (val ? Math.round(val * 100) / 100 : val)
    },
    currency: {
      type: String,
      default: 'USD',
      uppercase: true,
      enum: ['USD', 'EUR', 'GBP', 'CAD', 'AUD']
    },
    inventory: {
      quantity: {
        type: Number,
        required: true,
        default: 0,
        min: [0, 'Inventory quantity cannot be negative']
      },
      lowStockThreshold: {
        type: Number,
        default: 10,
        min: [0, 'Low stock threshold cannot be negative']
      },
      trackInventory: {
        type: Boolean,
        default: true
      },
      allowBackorder: {
        type: Boolean,
        default: false
      }
    },
    categories: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
        index: true
      }
    ],
    tags: [
      {
        type: String,
        lowercase: true,
        trim: true
      }
    ],
    images: [
      {
        url: {
          type: String,
          required: [true, 'Image URL is required']
        },
        alt: {
          type: String,
          default: ''
        },
        isPrimary: {
          type: Boolean,
          default: false
        }
      }
    ],
    variants: [
      {
        name: {
          type: String,
          required: true
        },
        sku: {
          type: String,
          required: true,
          unique: true,
          uppercase: true,
          trim: true
        },
        price: {
          type: Number,
          min: [0, 'Variant price must be greater than or equal to 0']
        },
        inventory: {
          type: Number,
          default: 0,
          min: [0, 'Variant inventory cannot be negative']
        },
        attributes: {
          type: Map,
          of: String
        }
      }
    ],
    isActive: {
      type: Boolean,
      default: true,
      index: true
    },
    isFeatured: {
      type: Boolean,
      default: false,
      index: true
    },
    isDigital: {
      type: Boolean,
      default: false
    },
    weight: {
      type: Number,
      min: [0, 'Weight must be greater than or equal to 0']
    },
    dimensions: {
      length: {
        type: Number,
        min: [0, 'Length must be greater than or equal to 0']
      },
      width: {
        type: Number,
        min: [0, 'Width must be greater than or equal to 0']
      },
      height: {
        type: Number,
        min: [0, 'Height must be greater than or equal to 0']
      }
    },
    seoMetadata: {
      metaTitle: {
        type: String,
        maxlength: [60, 'Meta title cannot exceed 60 characters']
      },
      metaDescription: {
        type: String,
        maxlength: [160, 'Meta description cannot exceed 160 characters']
      }
    },
    ratings: {
      average: {
        type: Number,
        default: 0,
        min: [0, 'Rating cannot be less than 0'],
        max: [5, 'Rating cannot be greater than 5'],
        set: (val) => Math.round(val * 10) / 10
      },
      count: {
        type: Number,
        default: 0,
        min: [0, 'Rating count cannot be negative']
      }
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
ProductSchema.index({ isActive: 1, isFeatured: -1, createdAt: -1 });
ProductSchema.index({ name: 'text', description: 'text', tags: 'text' });
ProductSchema.index({ 'inventory.quantity': 1 });
ProductSchema.index({ price: 1 });

/**
 * Virtual: Calculate discount percentage
 */
ProductSchema.virtual('discountPercentage').get(function () {
  if (this.compareAtPrice && this.compareAtPrice > this.price) {
    return Math.round(((this.compareAtPrice - this.price) / this.compareAtPrice) * 100);
  }
  return 0;
});

/**
 * Virtual: Check if product is low on stock
 */
ProductSchema.virtual('isLowStock').get(function () {
  return (
    this.inventory.trackInventory &&
    this.inventory.quantity <= this.inventory.lowStockThreshold &&
    this.inventory.quantity > 0
  );
});

/**
 * Virtual: Calculate profit margin
 */
ProductSchema.virtual('profitMargin').get(function () {
  if (this.costPrice && this.costPrice > 0) {
    return Math.round(((this.price - this.costPrice) / this.price) * 100);
  }
  return null;
});

/**
 * Pre-save middleware: Generate slug from name
 */
ProductSchema.pre('save', async function (next) {
  try {
    if (!this.slug || this.isModified('name')) {
      let baseSlug = slugify(this.name, { lower: true, strict: true });
      let slug = baseSlug;
      let counter = 1;

      while (await mongoose.models.Product.findOne({ slug, _id: { $ne: this._id } })) {
        slug = `${baseSlug}-${counter}`;
        counter++;
      }

      this.slug = slug;
    }

    if (this.tags && this.tags.length > 0) {
      this.tags = this.tags.map((tag) => tag.toLowerCase().trim());
    }

    if (this.images && this.images.length > 0) {
      const primaryImages = this.images.filter((img) => img.isPrimary);
      if (primaryImages.length === 0) {
        this.images[0].isPrimary = true;
      } else if (primaryImages.length > 1) {
        this.images.forEach((img, index) => {
          img.isPrimary = index === 0;
        });
      }
    }

    if (this.variants && this.variants.length > 0) {
      const variantSkus = this.variants.map((v) => v.sku);
      if (variantSkus.includes(this.sku)) {
        return next(new Error('Variant SKU cannot match main product SKU'));
      }
    }

    if (!this.isDigital && this.inventory.trackInventory) {
      if (
        (this.weight === undefined || this.weight === null) &&
        (!this.dimensions || !this.dimensions.length || !this.dimensions.width || !this.dimensions.height)
      ) {
        logger.warn('Physical product missing weight/dimensions', { sku: this.sku });
      }
    }

    next();
  } catch (error) {
    logger.error('Error in Product pre-save middleware', { error: error.message });
    next(error);
  }
});

/**
 * Pre-update middleware: Validate inventory changes
 */
ProductSchema.pre('findOneAndUpdate', function (next) {
  try {
    const update = this.getUpdate();

    if (update.$set && update.$set['inventory.quantity'] !== undefined) {
      const newQuantity = update.$set['inventory.quantity'];
      if (newQuantity < 0 && !update.$set['inventory.allowBackorder']) {
        return next(new Error('Inventory quantity cannot be negative unless backorder is allowed'));
      }
    }

    next();
  } catch (error) {
    logger.error('Error in Product pre-update middleware', { error: error.message });
    next(error);
  }
});

/**
 * Instance method: Calculate discount amount
 */
ProductSchema.methods.calculateDiscount = function () {
  if (this.compareAtPrice && this.compareAtPrice > this.price) {
    return {
      amount: Math.round((this.compareAtPrice - this.price) * 100) / 100,
      percentage: this.discountPercentage
    };
  }
  return { amount: 0, percentage: 0 };
};

/**
 * Instance method: Check if product is in stock
 */
ProductSchema.methods.isInStock = function () {
  if (!this.inventory.trackInventory) {
    return true;
  }
  return this.inventory.quantity > 0 || this.inventory.allowBackorder;
};

/**
 * Instance method: Validate if requested quantity can be purchased
 */
ProductSchema.methods.canPurchase = function (quantity) {
  if (!this.isActive) {
    throw new Error('PRODUCT_INACTIVE');
  }

  if (!this.inventory.trackInventory) {
    return true;
  }

  if (this.inventory.quantity >= quantity) {
    return true;
  }

  if (this.inventory.allowBackorder) {
    return true;
  }

  throw new Error('INSUFFICIENT_STOCK');
};

/**
 * Instance method: Reserve stock for order (atomic operation)
 */
ProductSchema.methods.reserveStock = async function (quantity) {
  try {
    if (!this.inventory.trackInventory) {
      logger.info('Stock tracking disabled, skipping reservation', { sku: this.sku });
      return true;
    }

    const result = await mongoose.models.Product.findOneAndUpdate(
      {
        _id: this._id,
        $or: [
          { 'inventory.quantity': { $gte: quantity } },
          { 'inventory.allowBackorder': true }
        ]
      },
      {
        $inc: { 'inventory.quantity': -quantity }
      },
      { new: true }
    );

    if (!result) {
      throw new Error('INSUFFICIENT_STOCK');
    }

    this.inventory.quantity = result.inventory.quantity;

    logger.info('Stock reserved', {
      sku: this.sku,
      quantity,
      remaining: this.inventory.quantity
    });

    return true;
  } catch (error) {
    logger.error('Failed to reserve stock', {
      sku: this.sku,
      quantity,
      error: error.message
    });
    throw error;
  }
};

/**
 * Instance method: Release reserved stock (atomic operation)
 */
ProductSchema.methods.releaseStock = async function (quantity) {
  try {
    if (!this.inventory.trackInventory) {
      logger.info('Stock tracking disabled, skipping release', { sku: this.sku });
      return true;
    }

    const result = await mongoose.models.Product.findByIdAndUpdate(
      this._id,
      {
        $inc: { 'inventory.quantity': quantity }
      },
      { new: true }
    );

    if (!result) {
      throw new Error('Product not found');
    }

    this.inventory.quantity = result.inventory.quantity;

    logger.info('Stock released', {
      sku: this.sku,
      quantity,
      total: this.inventory.quantity
    });

    return true;
  } catch (error) {
    logger.error('Failed to release stock', {
      sku: this.sku,
      quantity,
      error: error.message
    });
    throw error;
  }
};

/**
 * Instance method: Update product rating
 */
ProductSchema.methods.updateRating = async function (newRating) {
  try {
    if (newRating < 0 || newRating > 5) {
      throw new Error('Rating must be between 0 and 5');
    }

    const totalRating = this.ratings.average * this.ratings.count;
    this.ratings.count += 1;
    this.ratings.average = (totalRating + newRating) / this.ratings.count;

    await this.save();

    logger.info('Product rating updated', {
      sku: this.sku,
      newAverage: this.ratings.average,
      totalReviews: this.ratings.count
    });

    return this.ratings;
  } catch (error) {
    logger.error('Failed to update rating', {
      sku: this.sku,
      error: error.message
    });
    throw error;
  }
};

/**
 * Instance method: Get formatted display price
 */
ProductSchema.methods.getDisplayPrice = function () {
  const currencySymbols = {
    USD: '$',
    EUR: '€',
    GBP: '£',
    CAD: 'CA$',
    AUD: 'A$'
  };

  const symbol = currencySymbols[this.currency] || this.currency;
  return `${symbol}${this.price.toFixed(2)}`;
};

/**
 * Static method: Find product by slug
 */
ProductSchema.statics.findBySlug = function (slug) {
  return this.findOne({ slug, isActive: true });
};

/**
 * Static method: Find products in stock
 */
ProductSchema.statics.findInStock = function () {
  return this.find({
    isActive: true,
    $or: [
      { 'inventory.trackInventory': false },
      { 'inventory.quantity': { $gt: 0 } },
      { 'inventory.allowBackorder': true }
    ]
  });
};

/**
 * Static method: Find featured products
 */
ProductSchema.statics.findFeatured = function (limit = 10) {
  return this.find({ isActive: true, isFeatured: true })
    .sort({ createdAt: -1 })
    .limit(limit);
};

/**
 * Static method: Search products with filters
 */
