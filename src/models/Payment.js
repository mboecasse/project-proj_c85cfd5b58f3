// File: src/models/Payment.js
// Generated: 2025-10-16 10:42:13 UTC
// Project ID: proj_c85cfd5b58f3
// Task ID: task_hrrosm7k26bm

    const Order = require('./Order');


const crypto = require('crypto');


const logger = require('../utils/logger');


const mongoose = require('mongoose');

// Encryption configuration


const ENCRYPTION_KEY = process.env.PAYMENT_ENCRYPTION_KEY || crypto.randomBytes(32);


const ENCRYPTION_ALGORITHM = 'aes-256-gcm';


const IV_LENGTH = 16;


const AUTH_TAG_LENGTH = 16;

/**
 * Encrypt sensitive data
 * @param {String} text - Text to encrypt
 * @returns {String} Encrypted text with IV and auth tag
 */


function encrypt(text) {
  if (!text) return null;
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt sensitive data
 * @param {String} text - Encrypted text with IV and auth tag
 * @returns {String} Decrypted text
 */


function decrypt(text) {
  if (!text) return null;
  const parts = text.split(':');
  if (parts.length !== 3) return null;
  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const encrypted = parts[2];
  const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, ENCRYPTION_KEY, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

/**
 * Validate metadata object
 * @param {Object} metadata - Metadata to validate
 * @returns {Boolean} True if valid
 */


function validateMetadata(metadata) {
  if (!metadata || typeof metadata !== 'object') return false;

  // Check for dangerous properties
  const dangerousKeys = ['__proto__', 'constructor', 'prototype'];
  for (const key of Object.keys(metadata)) {
    if (dangerousKeys.includes(key)) return false;
    if (typeof key !== 'string' || key.length > 100) return false;
  }

  // Limit metadata size
  const metadataString = JSON.stringify(metadata);
  if (metadataString.length > 10000) return false;

  return true;
}

/**
 * Sanitize metadata object
 * @param {Object} metadata - Metadata to sanitize
 * @returns {Object} Sanitized metadata
 */


function sanitizeMetadata(metadata) {
  if (!metadata || typeof metadata !== 'object') return {};

  const sanitized = {};
  const allowedKeys = ['refunds', 'cancelledAt', 'cancellationReason', 'gatewayMetadata'];

  for (const key of Object.keys(metadata)) {
    if (allowedKeys.includes(key)) {
      if (typeof metadata[key] === 'string') {
        sanitized[key] = metadata[key].substring(0, 1000);
      } else if (Array.isArray(metadata[key])) {
        sanitized[key] = metadata[key].slice(0, 100);
      } else if (typeof metadata[key] === 'object' && metadata[key] !== null) {
        sanitized[key] = JSON.parse(JSON.stringify(metadata[key]).substring(0, 5000));
      } else {
        sanitized[key] = metadata[key];
      }
    }
  }

  return sanitized;
}

/**
 * Payment Schema
 * Handles payment transactions for orders with comprehensive validation and security
 */


const PaymentSchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: [true, 'Order ID is required'],
      index: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true
    },
    amount: {
      type: Number,
      required: [true, 'Payment amount is required'],
      min: [0, 'Amount cannot be negative'],
      set: (val) => Math.round(val * 100) / 100
    },
    currency: {
      type: String,
      enum: ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CNY', 'INR'],
      default: 'USD',
      uppercase: true
    },
    paymentMethod: {
      type: String,
      enum: ['credit_card', 'debit_card', 'paypal', 'stripe', 'bank_transfer', 'apple_pay', 'google_pay'],
      required: [true, 'Payment method is required']
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed', 'refunded', 'cancelled', 'partially_refunded'],
      default: 'pending',
      index: true
    },
    transactionId: {
      type: String,
      sparse: true,
      unique: true,
      index: true
    },
    paymentGateway: {
      type: String,
      enum: ['stripe', 'paypal', 'square', 'braintree', 'authorize_net'],
      required: [true, 'Payment gateway is required']
    },
    paymentDetails: {
      last4Digits: {
        type: String,
        maxlength: 4,
        get: decrypt,
        set: encrypt
      },
      cardBrand: {
        type: String,
        enum: ['Visa', 'Mastercard', 'American Express', 'Discover', 'JCB', 'Diners Club', 'UnionPay']
      },
      paypalEmail: {
        type: String,
        get: decrypt,
        set: encrypt
      },
      expiryMonth: {
        type: String,
        maxlength: 2,
        get: decrypt,
        set: encrypt
      },
      expiryYear: {
        type: String,
        maxlength: 4,
        get: decrypt,
        set: encrypt
      }
    },
    billingAddress: {
      street: {
        type: String,
        trim: true
      },
      city: {
        type: String,
        trim: true
      },
      state: {
        type: String,
        trim: true
      },
      zipCode: {
        type: String,
        trim: true
      },
      country: {
        type: String,
        trim: true,
        uppercase: true
      }
    },
    metadata: {
      type: Object,
      default: {},
      validate: {
        validator: validateMetadata,
        message: 'Invalid metadata format'
      }
    },
    failureReason: {
      type: String,
      trim: true
    },
    refundAmount: {
      type: Number,
      default: 0,
      min: [0, 'Refund amount cannot be negative'],
      set: (val) => Math.round(val * 100) / 100
    },
    refundedAt: {
      type: Date
    },
    ipAddress: {
      type: String
    },
    userAgent: {
      type: String
    }
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      getters: false,
      transform: function (doc, ret) {
        delete ret.metadata;
        delete ret.__v;
        if (ret.paymentDetails) {
          delete ret.paymentDetails.paypalEmail;
          delete ret.paymentDetails.expiryMonth;
          delete ret.paymentDetails.expiryYear;
        }
        return ret;
      }
    },
    toObject: { virtuals: true, getters: false }
  }
);

// Compound indexes for performance
PaymentSchema.index({ orderId: 1, paymentStatus: 1 });
PaymentSchema.index({ userId: 1, createdAt: -1 });
PaymentSchema.index({ paymentStatus: 1, createdAt: -1 });
PaymentSchema.index({ transactionId: 1 }, { unique: true, sparse: true });

// Virtual fields
PaymentSchema.virtual('isSuccessful').get(function () {
  return this.paymentStatus === 'completed';
});

PaymentSchema.virtual('isRefundable').get(function () {
  if (this.paymentStatus !== 'completed') return false;
  if (this.refundAmount >= this.amount) return false;

  const refundWindow = 90 * 24 * 60 * 60 * 1000;
  const timeSincePayment = Date.now() - this.createdAt.getTime();

  return timeSincePayment <= refundWindow;
});

PaymentSchema.virtual('netAmount').get(function () {
  return Math.round((this.amount - this.refundAmount) * 100) / 100;
});

/**
 * Pre-save middleware
 * Validates payment data and ensures business rules
 */
PaymentSchema.pre('save', async function (next) {
  try {
    // Sanitize metadata
    if (this.metadata) {
      this.metadata = sanitizeMetadata(this.metadata);
    }

    if (!this.isNew) {
      return next();
    }

    const order = await Order.findById(this.orderId);

    if (!order) {
      const error = new Error('Order not found');
      error.name = 'ValidationError';
      logger.error('Payment validation failed: Order not found', { orderId: this.orderId });
      return next(error);
    }

    if (Math.abs(this.amount - order.totalAmount) > 0.01) {
      const error = new Error('Payment amount does not match order total');
      error.name = 'PAYMENT_AMOUNT_MISMATCH';
      logger.error('Payment amount mismatch', {
        orderId: this.orderId,
        paymentAmount: this.amount,
        orderAmount: order.totalAmount
      });
      return next(error);
    }

    const existingPayment = await this.constructor.findOne({
      orderId: this.orderId,
      paymentStatus: 'completed'
    });

    if (existingPayment) {
      const error = new Error('Order already has a completed payment');
      error.name = 'PAYMENT_DUPLICATE';
      logger.error('Duplicate payment attempt', { orderId: this.orderId });
      return next(error);
    }

    logger.info('Payment validation passed', {
      paymentId: this._id,
      orderId: this.orderId,
      amount: this.amount
    });

    next();
  } catch (error) {
    logger.error('Payment pre-save error', { error: error.message });
    next(error);
  }
});

/**
 * Process payment with gateway response
 * @param {Object} gatewayResponse - Response from payment gateway
 * @returns {Object} Standardized payment result
 */
PaymentSchema.methods.processPayment = async function (gatewayResponse) {
  try {
    const { transactionId, status, metadata } = gatewayResponse;

    this.transactionId = transactionId;
    this.metadata = sanitizeMetadata(metadata || {});

    if (status === 'success' || status === 'completed') {
      this.paymentStatus = 'completed';
      logger.info('Payment processed successfully', {
        paymentId: this._id,
        transactionId,
        orderId: this.orderId
      });
    } else {
      this.paymentStatus = 'failed';
      this.failureReason = gatewayResponse.errorMessage || 'Payment processing failed';
      logger.warn('Payment processing failed', {
        paymentId: this._id,
        reason: this.failureReason
      });
    }

    await this.save();

    return {
      success: this.paymentStatus === 'completed',
      paymentId: this._id,
      transactionId: this.transactionId,
      status: this.paymentStatus,
      amount: this.amount,
      currency: this.currency
    };
  } catch (error) {
    logger.error('Error processing payment', {
      paymentId: this._id,
      error: error.message
    });
    throw error;
  }
};

/**
 * Refund payment (full or partial)
 * @param {Number} amount - Amount to refund
 * @param {String} reason - Reason for refund
 * @returns {Object} Refund result
 */
PaymentSchema.methods.refundPayment = async function (amount, reason) {
  try {
    const totalRefunded = this.refundAmount + amount;
    if (totalRefunded > this.amount) {
      throw new Error('Refund amount exceeds original payment amount');
    }

    if (this.paymentStatus !== 'completed' && this.paymentStatus !== 'partially_refunded') {
      throw new Error('Can only refund completed payments');
    }

    this.refundAmount = totalRefunded;
    this.refundedAt = new Date();

    if (totalRefunded >= this.amount) {
      this.paymentStatus = 'refunded';
    } else {
      this.paymentStatus = 'partially_refunded';
    }

    if (!this.metadata.refunds) {
      this.metadata.refunds = [];
    }
    this.metadata.refunds.push({
      amount,
      reason: reason ? reason.substring(0, 500) : '',
      timestamp: new Date()
    });

    await this.save();

    logger.info('Payment refunded', {
      paymentId: this._id,
      refundAmount: amount,
      totalRefunded,
      status: this.paymentStatus
    });

    return {
      success: true,
      paymentId: this._id,
      refundAmount: amount,
      totalRefunded,
      status: this.paymentStatus,
      netAmount: this.netAmount
    };
  } catch (error) {
    logger.error('Error refunding payment', {
      paymentId: this._id,
      error: error.message
    });
    throw error;
  }
};

/**
 * Cancel payment
 * @param {String} reason - Reason for cancellation
 * @returns {Object} Cancellation result
 */
PaymentSchema.methods.cancelPayment = async function (reason) {
  try {
    if (this.paymentStatus !== 'pending' && this.paymentStatus !== 'processing') {
      throw new Error(`Cannot cancel payment with status: ${this.paymentStatus}`);
    }

    this.paymentStatus = 'cancelled';
    this.failureReason = reason;
    this.metadata.cancelledAt = new Date();
    this.metadata.cancellationReason = reason ? reason.substring(0, 500) : '';

    await this.save();

    logger.info('Payment cancelled', {
      paymentId: this._id,
      reason
    });

    return {
      success: true,
      paymentId: this._id,
      status: this.paymentStatus,
      reason
    };
  } catch (error) {
    logger.error('Error cancelling payment', {
      paymentId: this._id,
      error: error.message
    });
    throw error;
  }
};

/**
 * Get safe payment summary for client
 * @returns {Object} Safe payment information
 */
PaymentSchema.methods.getPaymentSummary = function () {
  return {
    id: this._id,
    orderId: this.orderId,
    amount

}}