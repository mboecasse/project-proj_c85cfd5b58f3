// File: src/models/Order.js
// Generated: 2025-10-16 10:42:12 UTC
// Project ID: proj_c85cfd5b58f3
// Task ID: task_7sy7a3snzrit


const logger = require('../utils/logger');


const mongoose = require('mongoose');

/**
 * Order Status Enumeration
 * Defines the lifecycle states of an order
 */


const ORDER_STATUSES = {
  PENDING: 'pending',
  PAYMENT_FAILED: 'payment_failed',
  PAID: 'paid',
  PROCESSING: 'processing',
  SHIPPED: 'shipped',
  DELIVERED: 'delivered',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  REFUNDED: 'refunded'
};

/**
 * Payment Status Enumeration
 * Tracks the payment processing state
 */


const PAYMENT_STATUSES = {
  PENDING: 'pending',
  AUTHORIZED: 'authorized',
  CAPTURED: 'captured',
  FAILED: 'failed',
  REFUNDED: 'refunded',
  PARTIALLY_REFUNDED: 'partially_refunded'
};

/**
 * Order Schema
 * Comprehensive order management with status tracking, payment info, and shipping details
 */


const orderSchema = new mongoose.Schema({
  orderNumber: {
    type: String,
    required: [true, 'Order number is required'],
    unique: true,
    index: true
  },

  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User reference is required'],
    index: true
  },

  items: [{
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: [true, 'Product reference is required']
    },
    name: {
      type: String,
      required: [true, 'Product name is required']
    },
    price: {
      type: Number,
      required: [true, 'Product price is required'],
      min: [0, 'Price cannot be negative']
    },
    quantity: {
      type: Number,
      required: [true, 'Quantity is required'],
      min: [1, 'Quantity must be at least 1']
    },
    subtotal: {
      type: Number,
      required: [true, 'Item subtotal is required'],
      min: [0, 'Subtotal cannot be negative']
    }
  }],

  pricing: {
    subtotal: {
      type: Number,
      required: [true, 'Subtotal is required'],
      min: [0, 'Subtotal cannot be negative']
    },
    tax: {
      type: Number,
      default: 0,
      min: [0, 'Tax cannot be negative']
    },
    shipping: {
      type: Number,
      default: 0,
      min: [0, 'Shipping cost cannot be negative']
    },
    discount: {
      type: Number,
      default: 0,
      min: [0, 'Discount cannot be negative']
    },
    total: {
      type: Number,
      required: [true, 'Total is required'],
      min: [0, 'Total cannot be negative']
    }
  },

  status: {
    type: String,
    enum: {
      values: Object.values(ORDER_STATUSES),
      message: '{VALUE} is not a valid order status'
    },
    default: ORDER_STATUSES.PENDING,
    index: true
  },

  payment: {
    method: {
      type: String,
      required: [true, 'Payment method is required'],
      enum: {
        values: ['credit_card', 'debit_card', 'paypal', 'stripe', 'cash_on_delivery'],
        message: '{VALUE} is not a valid payment method'
      }
    },
    status: {
      type: String,
      enum: {
        values: Object.values(PAYMENT_STATUSES),
        message: '{VALUE} is not a valid payment status'
      },
      default: PAYMENT_STATUSES.PENDING
    },
    transactionId: {
      type: String,
      index: true
    },
    gatewayResponse: mongoose.Schema.Types.Mixed,
    paidAt: Date,
    refundedAt: Date,
    refundAmount: {
      type: Number,
      min: [0, 'Refund amount cannot be negative']
    }
  },

  shippingAddress: {
    fullName: {
      type: String,
      required: [true, 'Full name is required for shipping']
    },
    addressLine1: {
      type: String,
      required: [true, 'Address line 1 is required']
    },
    addressLine2: String,
    city: {
      type: String,
      required: [true, 'City is required']
    },
    state: String,
    postalCode: {
      type: String,
      required: [true, 'Postal code is required']
    },
    country: {
      type: String,
      required: [true, 'Country is required']
    },
    phone: {
      type: String,
      validate: {
        validator: function(v) {
          return !v || /^[\d\s\-\+\(\)]+$/.test(v);
        },
        message: 'Invalid phone number format'
      }
    }
  },

  billingAddress: {
    fullName: String,
    addressLine1: String,
    addressLine2: String,
    city: String,
    state: String,
    postalCode: String,
    country: String
  },

  tracking: {
    carrier: String,
    trackingNumber: {
      type: String,
      index: true
    },
    shippedAt: Date,
    estimatedDelivery: Date,
    deliveredAt: Date
  },

  statusHistory: [{
    status: {
      type: String,
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    note: String,
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],

  notes: String,
  cancelReason: String

}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

/**
 * Indexes for performance optimization
 */
orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ 'payment.transactionId': 1 });
orderSchema.index({ createdAt: -1 });
orderSchema.index({ orderNumber: 1 }, { unique: true });

/**
 * Virtual for order age in days
 */
orderSchema.virtual('orderAge').get(function() {
  if (!this.createdAt) return 0;
  const now = new Date();
  const created = new Date(this.createdAt);
  return Math.floor((now - created) / (1000 * 60 * 60 * 24));
});

/**
 * Pre-save hook to generate order number and calculate totals
 */
orderSchema.pre('save', async function(next) {
  try {
    // Generate order number for new orders
    if (this.isNew && !this.orderNumber) {
      this.orderNumber = await this.constructor.generateOrderNumber();
      logger.info('Generated order number', { orderNumber: this.orderNumber });
    }

    // Calculate item subtotals
    if (this.items && this.items.length > 0) {
      this.items.forEach(item => {
        if (!item.subtotal || item.isModified('quantity') || item.isModified('price')) {
          item.subtotal = item.price * item.quantity;
        }
      });
    }

    // Calculate pricing totals
    if (this.isModified('items') || this.isModified('pricing')) {
      this.calculateTotals();
    }

    // Add to status history if status changed
    if (this.isModified('status') && !this.isNew) {
      this.statusHistory.push({
        status: this.status,
        timestamp: new Date(),
        note: `Status changed to ${this.status}`
      });
    }

    next();
  } catch (error) {
    logger.error('Error in order pre-save hook', { error: error.message });
    next(error);
  }
});

/**
 * Pre-save validation to ensure data consistency
 */
orderSchema.pre('save', function(next) {
  try {
    // Validate items array is not empty
    if (!this.items || this.items.length === 0) {
      throw new Error('Order must contain at least one item');
    }

    // Validate transaction ID when payment is captured
    if (this.payment.status === PAYMENT_STATUSES.CAPTURED && !this.payment.transactionId) {
      throw new Error('Transaction ID is required when payment is captured');
    }

    // Validate status transitions
    if (this.isModified('status') && !this.isNew) {
      const validTransitions = this.getValidStatusTransitions();
      if (!validTransitions.includes(this.status)) {
        throw new Error(`Invalid status transition to ${this.status}`);
      }
    }

    next();
  } catch (error) {
    logger.error('Order validation failed', { error: error.message });
    next(error);
  }
});

/**
 * Calculate order totals
 * Computes subtotal from items and final total including tax, shipping, and discount
 */
orderSchema.methods.calculateTotals = function() {
  try {
    // Calculate subtotal from items
    this.pricing.subtotal = this.items.reduce((sum, item) => {
      return sum + (item.subtotal || (item.price * item.quantity));
    }, 0);

    // Calculate final total
    this.pricing.total = this.pricing.subtotal
      + (this.pricing.tax || 0)
      + (this.pricing.shipping || 0)
      - (this.pricing.discount || 0);

    // Ensure total is not negative
    if (this.pricing.total < 0) {
      this.pricing.total = 0;
    }

    logger.debug('Calculated order totals', {
      orderId: this._id,
      subtotal: this.pricing.subtotal,
      total: this.pricing.total
    });
  } catch (error) {
    logger.error('Error calculating order totals', { error: error.message });
    throw error;
  }
};

/**
 * Update order status with validation and history tracking
 * @param {string} newStatus - New status to set
 * @param {string} note - Optional note about status change
 * @param {ObjectId} updatedBy - User ID who updated the status
 * @returns {Promise<Order>} Updated order
 */
orderSchema.methods.updateStatus = async function(newStatus, note = null, updatedBy = null) {
  try {
    // Validate new status
    if (!Object.values(ORDER_STATUSES).includes(newStatus)) {
      throw new Error(`Invalid order status: ${newStatus}`);
    }

    // Check if transition is valid
    const validTransitions = this.getValidStatusTransitions();
    if (!validTransitions.includes(newStatus)) {
      throw new Error(`Cannot transition from ${this.status} to ${newStatus}`);
    }

    // Update status
    const oldStatus = this.status;
    this.status = newStatus;

    // Add to history
    this.statusHistory.push({
      status: newStatus,
      timestamp: new Date(),
      note: note || `Status changed from ${oldStatus} to ${newStatus}`,
      updatedBy: updatedBy
    });

    // Update tracking dates based on status
    if (newStatus === ORDER_STATUSES.SHIPPED && !this.tracking.shippedAt) {
      this.tracking.shippedAt = new Date();
    }

    if (newStatus === ORDER_STATUSES.DELIVERED && !this.tracking.deliveredAt) {
      this.tracking.deliveredAt = new Date();
    }

    await this.save();

    logger.info('Order status updated', {
      orderId: this._id,
      oldStatus,
      newStatus,
      updatedBy
    });

    return this;
  } catch (error) {
    logger.error('Failed to update order status', {
      orderId: this._id,
      newStatus,
      error: error.message
    });
    throw error;
  }
};

/**
 * Get valid status transitions from current status
 * @returns {Array<string>} Array of valid next statuses
 */
orderSchema.methods.getValidStatusTransitions = function() {
  const transitions = {
    [ORDER_STATUSES.PENDING]: [ORDER_STATUSES.PAID, ORDER_STATUSES.PAYMENT_FAILED, ORDER_STATUSES.CANCELLED],
    [ORDER_STATUSES.PAYMENT_FAILED]: [ORDER_STATUSES.PENDING, ORDER_STATUSES.CANCELLED],
    [ORDER_STATUSES.PAID]: [ORDER_STATUSES.PROCESSING, ORDER_STATUSES.CANCELLED],
    [ORDER_STATUSES.PROCESSING]: [ORDER_STATUSES.SHIPPED, ORDER_STATUSES.CANCELLED],
    [ORDER_STATUSES.SHIPPED]: [ORDER_STATUSES.DELIVERED, ORDER_STATUSES.CANCELLED],
    [ORDER_STATUSES.DELIVERED]: [ORDER_STATUSES.COMPLETED, ORDER_STATUSES.REFUNDED],
    [ORDER_STATUSES.COMPLETED]: [ORDER_STATUSES.REFUNDED],
    [ORDER_STATUSES.CANCELLED]: [],
    [ORDER_STATUSES.REFUNDED]: []
  };

  return transitions[this.status] || [];
};

/**
 * Check if order can be cancelled
 * @returns {boolean} True if order can be cancelled
 */
orderSchema.methods.canBeCancelled = function() {
  const cancellableStatuses = [
    ORDER_STATUSES.PENDING,
    ORDER_STATUSES.PAID,
    ORDER_STATUSES.PROCESSING
  ];
  return cancellableStatuses.includes(this.status);
};

/**
 * Cancel order
 * @param {string} reason - Reason for cancellation
 * @param {ObjectId} cancelledBy - User ID who cancelled the order
 * @returns {Promise<Order>} Cancelled order
 */
orderSchema.methods.cancel = async function(reason, cancelledBy = null) {
  try {
    if (!this.canBeCancelled()) {
      throw new Error(`Order cannot be cancelled in ${this.status} status`);
    }

    this.cancelReason = reason;
    await this.updateStatus(ORDER_STATUSES.CANCELLED, `Order cancelled: ${reason}`, cancelledBy);

    logger.info('Order cancelled', {
      orderId: this._id,
      reason,
      cancelledBy
    });

    return this;
  } catch (error) {
    logger.error('Failed to cancel order', {
      orderId: this._id,
      error: error.message
    });
    throw error;
  }
};

/**
 * Process refund for order
 * @param {number} amount - Amount to refund
 * @param {string} reason - Reason for refund
 * @returns {Promise<Order>} Updated order
 */
orderSchema.methods.processRefund = async function(amount, reason = null) {
  try {
    // Validate refund amount
    if (amount <= 0) {
      throw new Error('Refund amount must be positive');
    }

    if (amount > this.pricing.total) {
      throw new Error('Refund amount cannot exceed order total');
    }

    // Update payment status
    const currentRefund = this.payment.refundAmount || 0;
    this.payment.refundAmount = currentRefund + amount;
    this.payment

}}