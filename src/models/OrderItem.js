// File: src/models/OrderItem.js
// Generated: 2025-10-16 10:42:40 UTC
// Project ID: proj_c85cfd5b58f3
// Task ID: task_722l7v3s073c


const mongoose = require('mongoose');

/**
 * OrderItem Schema
 * Stores individual items in an order with product information snapshot
 * This ensures order history remains accurate even if product details change
 */


const OrderItemSchema = new mongoose.Schema(
  {
    // Reference to parent order
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: [true, 'Order reference is required'],
      index: true
    },

    // Reference to original product (for linking purposes)
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: [true, 'Product reference is required'],
      index: true
    },

    // Product snapshot - preserves product details at time of purchase
    productSnapshot: {
      name: {
        type: String,
        required: [true, 'Product name is required'],
        trim: true
      },
      description: {
        type: String,
        trim: true
      },
      sku: {
        type: String,
        trim: true
      },
      images: [{
        url: {
          type: String,
          required: true
        },
        alt: {
          type: String,
          default: ''
        }
      }],
      category: {
        type: String,
        trim: true
      },
      brand: {
        type: String,
        trim: true
      },
      // Store any custom attributes that existed at purchase time
      attributes: {
        type: Map,
        of: mongoose.Schema.Types.Mixed,
        default: {}
      }
    },

    // Quantity ordered
    quantity: {
      type: Number,
      required: [true, 'Quantity is required'],
      min: [1, 'Quantity must be at least 1'],
      validate: {
        validator: Number.isInteger,
        message: 'Quantity must be an integer'
      }
    },

    // Price at time of purchase (per unit)
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price cannot be negative'],
      set: val => Math.round(val * 100) / 100 // Round to 2 decimal places
    },

    // Discount applied (per unit)
    discount: {
      type: Number,
      default: 0,
      min: [0, 'Discount cannot be negative'],
      set: val => Math.round(val * 100) / 100,
      validate: {
        validator: function(value) {
          return value <= this.price;
        },
        message: 'Discount cannot exceed price'
      }
    },

    // Tax amount (per unit)
    tax: {
      type: Number,
      default: 0,
      min: [0, 'Tax cannot be negative'],
      set: val => Math.round(val * 100) / 100
    },

    // Final price per unit after discount
    finalPrice: {
      type: Number,
      required: [true, 'Final price is required'],
      min: [0, 'Final price cannot be negative'],
      set: val => Math.round(val * 100) / 100
    },

    // Total for this line item (finalPrice * quantity + tax)
    subtotal: {
      type: Number,
      required: true,
      min: [0, 'Subtotal cannot be negative'],
      set: val => Math.round(val * 100) / 100
    },

    // Selected variant/options (size, color, etc.)
    selectedOptions: {
      type: Map,
      of: String,
      default: {}
    },

    // Item status within the order
    status: {
      type: String,
      enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'returned', 'refunded'],
      default: 'pending',
      index: true
    },

    // Tracking information for this specific item
    tracking: {
      carrier: {
        type: String,
        trim: true
      },
      trackingNumber: {
        type: String,
        trim: true
      },
      trackingUrl: {
        type: String,
        trim: true
      },
      shippedAt: {
        type: Date
      },
      deliveredAt: {
        type: Date
      }
    },

    // Return/refund information
    returnInfo: {
      requested: {
        type: Boolean,
        default: false
      },
      requestedAt: {
        type: Date
      },
      reason: {
        type: String,
        trim: true
      },
      approved: {
        type: Boolean,
        default: false
      },
      approvedAt: {
        type: Date
      },
      refundAmount: {
        type: Number,
        min: 0,
        set: val => val ? Math.round(val * 100) / 100 : undefined
      },
      refundedAt: {
        type: Date
      }
    },

    // Notes specific to this item
    notes: {
      type: String,
      trim: true,
      maxlength: [1000, 'Notes cannot exceed 1000 characters']
    },

    // Metadata for additional information
    metadata: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: {}
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
OrderItemSchema.index({ order: 1, product: 1 });
OrderItemSchema.index({ status: 1, createdAt: -1 });
OrderItemSchema.index({ 'tracking.trackingNumber': 1 });
OrderItemSchema.index({ 'returnInfo.requested': 1, 'returnInfo.approved': 1 });

/**
 * Virtual for total price including tax
 */
OrderItemSchema.virtual('totalWithTax').get(function() {
  return Math.round((this.subtotal + (this.tax * this.quantity)) * 100) / 100;
});

/**
 * Virtual for total discount amount
 */
OrderItemSchema.virtual('totalDiscount').get(function() {
  return Math.round(this.discount * this.quantity * 100) / 100;
});

/**
 * Virtual for original total before discount
 */
OrderItemSchema.virtual('originalTotal').get(function() {
  return Math.round(this.price * this.quantity * 100) / 100;
});

/**
 * Pre-save middleware to calculate prices
 * Ensures all price calculations are consistent
 */
OrderItemSchema.pre('save', function(next) {
  try {
    // Validate discount does not exceed price
    if (this.discount > this.price) {
      return next(new Error('Discount cannot exceed price'));
    }

    // Calculate final price per unit (price - discount)
    this.finalPrice = Math.round((this.price - this.discount) * 100) / 100;

    // Ensure final price is not negative
    if (this.finalPrice < 0) {
      this.finalPrice = 0;
    }

    // Calculate subtotal (finalPrice * quantity)
    this.subtotal = Math.round(this.finalPrice * this.quantity * 100) / 100;

    next();
  } catch (error) {
    next(error);
  }
});

/**
 * Pre-save middleware to validate status transitions
 */
OrderItemSchema.pre('save', function(next) {
  try {
    // If item is being marked as shipped, ensure tracking info exists
    if (this.status === 'shipped' && !this.tracking.shippedAt) {
      this.tracking.shippedAt = new Date();
    }

    // If item is being marked as delivered, ensure delivery date exists
    if (this.status === 'delivered' && !this.tracking.deliveredAt) {
      this.tracking.deliveredAt = new Date();
    }

    // If return is approved, set approval date
    if (this.returnInfo.approved && !this.returnInfo.approvedAt) {
      this.returnInfo.approvedAt = new Date();
    }

    // If item is refunded, set refund date
    if (this.status === 'refunded' && !this.returnInfo.refundedAt) {
      this.returnInfo.refundedAt = new Date();
    }

    next();
  } catch (error) {
    next(error);
  }
});

/**
 * Instance method to request return
 * @param {string} reason - Reason for return
 * @returns {Promise<OrderItem>} Updated order item
 */
OrderItemSchema.methods.requestReturn = async function(reason) {
  // Can only request return for delivered items
  if (this.status !== 'delivered') {
    throw new Error('Can only request return for delivered items');
  }

  this.returnInfo.requested = true;
  this.returnInfo.requestedAt = new Date();
  this.returnInfo.reason = reason;
  this.status = 'returned';

  return await this.save();
};

/**
 * Instance method to approve return
 * @param {number} refundAmount - Amount to refund
 * @returns {Promise<OrderItem>} Updated order item
 */
OrderItemSchema.methods.approveReturn = async function(refundAmount) {
  if (!this.returnInfo.requested) {
    throw new Error('No return request exists for this item');
  }

  this.returnInfo.approved = true;
  this.returnInfo.approvedAt = new Date();
  this.returnInfo.refundAmount = refundAmount || this.subtotal;

  return await this.save();
};

/**
 * Instance method to mark as refunded
 * @returns {Promise<OrderItem>} Updated order item
 */
OrderItemSchema.methods.markAsRefunded = async function() {
  if (!this.returnInfo.approved) {
    throw new Error('Return must be approved before refunding');
  }

  this.status = 'refunded';
  this.returnInfo.refundedAt = new Date();

  return await this.save();
};

/**
 * Instance method to update tracking information
 * @param {Object} trackingData - Tracking information
 * @returns {Promise<OrderItem>} Updated order item
 */
OrderItemSchema.methods.updateTracking = async function(trackingData) {
  this.tracking = {
    ...this.tracking,
    ...trackingData
  };

  if (trackingData.carrier || trackingData.trackingNumber) {
    this.status = 'shipped';
    if (!this.tracking.shippedAt) {
      this.tracking.shippedAt = new Date();
    }
  }

  return await this.save();
};

/**
 * Static method to get items by order
 * @param {string} orderId - Order ID
 * @returns {Promise<Array>} Array of order items
 */
OrderItemSchema.statics.getByOrder = async function(orderId) {
  return await this.find({ order: orderId })
    .populate('product', 'name sku price stock')
    .sort({ createdAt: 1 });
};

/**
 * Static method to get items by product
 * @param {string} productId - Product ID
 * @param {Object} options - Query options
 * @returns {Promise<Array>} Array of order items
 */
OrderItemSchema.statics.getByProduct = async function(productId, options = {}) {
  const query = { product: productId };

  if (options.status) {
    query.status = options.status;
  }

  return await this.find(query)
    .populate('order', 'orderNumber status customer')
    .sort({ createdAt: -1 })
    .limit(options.limit || 100);
};

/**
 * Static method to get items pending return approval
 * @returns {Promise<Array>} Array of order items
 */
OrderItemSchema.statics.getPendingReturns = async function() {
  return await this.find({
    'returnInfo.requested': true,
    'returnInfo.approved': false
  })
    .populate('order', 'orderNumber customer')
    .populate('product', 'name sku')
    .sort({ 'returnInfo.requestedAt': 1 });
};

/**
 * Static method to calculate total sales for a product
 * @param {string} productId - Product ID
 * @param {Object} dateRange - Optional date range
 * @returns {Promise<Object>} Sales statistics
 */
OrderItemSchema.statics.getProductSalesStats = async function(productId, dateRange = {}) {
  const matchStage = {
    product: new mongoose.Types.ObjectId(productId),
    status: { $in: ['delivered', 'shipped', 'processing'] }
  };

  if (dateRange.startDate || dateRange.endDate) {
    matchStage.createdAt = {};
    if (dateRange.startDate) {
      matchStage.createdAt.$gte = new Date(dateRange.startDate);
    }
    if (dateRange.endDate) {
      matchStage.createdAt.$lte = new Date(dateRange.endDate);
    }
  }

  const stats = await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalQuantity: { $sum: '$quantity' },
        totalRevenue: { $sum: '$subtotal' },
        totalOrders: { $sum: 1 },
        averagePrice: { $avg: '$finalPrice' }
      }
    }
  ]);

  return stats[0] || {
    totalQuantity: 0,
    totalRevenue: 0,
    totalOrders: 0,
    averagePrice: 0
  };
};

module.exports = mongoose.model('OrderItem', OrderItemSchema);
