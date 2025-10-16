// File: src/models/Cart.js
// Generated: 2025-10-16 10:40:33 UTC
// Project ID: proj_c85cfd5b58f3
// Task ID: task_sao9tutzti1q

    const Product = require('./Product');


const logger = require('../utils/logger');


const mongoose = require('mongoose');

/**
 * Cart Item Schema
 * Stores snapshot of product at time of addition
 */


const cartItemSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: [true, 'Product ID is required']
  },
  name: {
    type: String,
    required: [true, 'Product name is required'],
    trim: true
  },
  price: {
    type: Number,
    required: [true, 'Product price is required'],
    min: [0, 'Price cannot be negative'],
    validate: {
      validator: function(value) {
        return Number.isFinite(value) && value >= 0;
      },
      message: 'Price must be a valid non-negative number'
    }
  },
  quantity: {
    type: Number,
    required: [true, 'Quantity is required'],
    min: [1, 'Quantity must be at least 1'],
    max: [99, 'Quantity cannot exceed 99'],
    validate: {
      validator: Number.isInteger,
      message: 'Quantity must be an integer'
    }
  },
  image: {
    type: String,
    default: ''
  },
  sku: {
    type: String,
    default: ''
  }
}, { _id: false });

/**
 * Cart Schema
 * Represents shopping cart for authenticated and guest users
 */


const cartSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    index: true
  },
  sessionId: {
    type: String,
    index: true,
    sparse: true
  },
  items: {
    type: [cartItemSchema],
    default: [],
    validate: {
      validator: function(items) {
        return items.length <= 100;
      },
      message: 'Cart cannot contain more than 100 items'
    }
  },
  subtotal: {
    type: Number,
    default: 0,
    min: [0, 'Subtotal cannot be negative']
  },
  tax: {
    type: Number,
    default: 0,
    min: [0, 'Tax cannot be negative']
  },
  discount: {
    type: Number,
    default: 0,
    min: [0, 'Discount cannot be negative']
  },
  total: {
    type: Number,
    default: 0,
    min: [0, 'Total cannot be negative']
  },
  promoCode: {
    type: String,
    default: null,
    trim: true,
    uppercase: true
  },
  status: {
    type: String,
    enum: {
      values: ['active', 'abandoned', 'converted'],
      message: '{VALUE} is not a valid cart status'
    },
    default: 'active',
    index: true
  },
  lastActivity: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true
});

/**
 * Compound indexes for optimized queries
 */
cartSchema.index({ userId: 1, status: 1 });
cartSchema.index({ sessionId: 1, status: 1 });
cartSchema.index({ status: 1, lastActivity: 1 });

/**
 * Virtual: Total item count
 */
cartSchema.virtual('itemCount').get(function() {
  return this.items.reduce((sum, item) => sum + item.quantity, 0);
});

/**
 * Virtual: Check if cart is empty
 */
cartSchema.virtual('isEmpty').get(function() {
  return this.items.length === 0;
});

/**
 * Virtual: Check if cart is abandoned (no activity in 24 hours)
 */
cartSchema.virtual('isAbandoned').get(function() {
  const hoursSinceActivity = (Date.now() - this.lastActivity.getTime()) / (1000 * 60 * 60);
  return hoursSinceActivity > 24 && this.status === 'active';
});

/**
 * Instance Method: Add item to cart
 * @param {ObjectId} productId - Product ID to add
 * @param {Number} quantity - Quantity to add
 * @returns {Promise<Cart>} Updated cart
 */
cartSchema.methods.addItem = async function(productId, quantity = 1) {
  try {

    // Validate quantity
    if (!Number.isInteger(quantity) || quantity < 1) {
      throw new Error('Quantity must be a positive integer');
    }

    // Fetch product details
    const product = await Product.findById(productId);
    if (!product) {
      throw new Error('Product not found');
    }

    if (!product.isAvailable) {
      throw new Error('Product is not available');
    }

    // Check if product already exists in cart
    const existingItemIndex = this.items.findIndex(
      item => item.productId.toString() === productId.toString()
    );

    if (existingItemIndex > -1) {
      // Update quantity of existing item
      const newQuantity = this.items[existingItemIndex].quantity + quantity;

      if (newQuantity > product.stock) {
        throw new Error(`Insufficient stock. Available: ${product.stock}`);
      }

      if (newQuantity > 99) {
        throw new Error('Maximum quantity per item is 99');
      }

      this.items[existingItemIndex].quantity = newQuantity;
      logger.info('Updated cart item quantity', {
        productId,
        newQuantity,
        cartId: this._id
      });
    } else {
      // Add new item
      if (quantity > product.stock) {
        throw new Error(`Insufficient stock. Available: ${product.stock}`);
      }

      this.items.push({
        productId: product._id,
        name: product.name,
        price: product.price,
        quantity,
        image: product.images && product.images.length > 0 ? product.images[0] : '',
        sku: product.sku || ''
      });

      logger.info('Added new item to cart', {
        productId,
        quantity,
        cartId: this._id
      });
    }

    await this.calculateTotals();
    await this.save();

    return this;
  } catch (error) {
    logger.error('Failed to add item to cart', {
      productId,
      quantity,
      error: error.message
    });
    throw error;
  }
};

/**
 * Instance Method: Remove item from cart
 * @param {ObjectId} productId - Product ID to remove
 * @returns {Promise<Cart>} Updated cart
 */
cartSchema.methods.removeItem = async function(productId) {
  try {
    const initialLength = this.items.length;
    this.items = this.items.filter(
      item => item.productId.toString() !== productId.toString()
    );

    if (this.items.length === initialLength) {
      throw new Error('Item not found in cart');
    }

    await this.calculateTotals();
    await this.save();

    logger.info('Removed item from cart', {
      productId,
      cartId: this._id
    });

    return this;
  } catch (error) {
    logger.error('Failed to remove item from cart', {
      productId,
      error: error.message
    });
    throw error;
  }
};

/**
 * Instance Method: Update item quantity
 * @param {ObjectId} productId - Product ID to update
 * @param {Number} quantity - New quantity
 * @returns {Promise<Cart>} Updated cart
 */
cartSchema.methods.updateQuantity = async function(productId, quantity) {
  try {

    if (!Number.isInteger(quantity) || quantity < 1) {
      throw new Error('Quantity must be a positive integer');
    }

    if (quantity > 99) {
      throw new Error('Maximum quantity per item is 99');
    }

    const itemIndex = this.items.findIndex(
      item => item.productId.toString() === productId.toString()
    );

    if (itemIndex === -1) {
      throw new Error('Item not found in cart');
    }

    // Check stock availability
    const product = await Product.findById(productId);
    if (!product) {
      throw new Error('Product not found');
    }

    if (quantity > product.stock) {
      throw new Error(`Insufficient stock. Available: ${product.stock}`);
    }

    this.items[itemIndex].quantity = quantity;

    await this.calculateTotals();
    await this.save();

    logger.info('Updated item quantity', {
      productId,
      quantity,
      cartId: this._id
    });

    return this;
  } catch (error) {
    logger.error('Failed to update item quantity', {
      productId,
      quantity,
      error: error.message
    });
    throw error;
  }
};

/**
 * Instance Method: Clear all items from cart
 * @returns {Promise<Cart>} Updated cart
 */
cartSchema.methods.clearCart = async function() {
  try {
    this.items = [];
    this.subtotal = 0;
    this.tax = 0;
    this.discount = 0;
    this.total = 0;
    this.promoCode = null;

    await this.save();

    logger.info('Cleared cart', { cartId: this._id });

    return this;
  } catch (error) {
    logger.error('Failed to clear cart', { error: error.message });
    throw error;
  }
};

/**
 * Instance Method: Calculate cart totals
 * @returns {Promise<void>}
 */
cartSchema.methods.calculateTotals = async function() {
  try {
    // Calculate subtotal
    this.subtotal = this.items.reduce((sum, item) => {
      return sum + (item.price * item.quantity);
    }, 0);

    // Round to 2 decimal places
    this.subtotal = Math.round(this.subtotal * 100) / 100;

    // Calculate tax (8% for example)
    const taxRate = 0.08;
    this.tax = Math.round(this.subtotal * taxRate * 100) / 100;

    // Calculate total (subtotal + tax - discount)
    this.total = Math.round((this.subtotal + this.tax - this.discount) * 100) / 100;

    // Ensure total is not negative
    if (this.total < 0) {
      this.total = 0;
    }

    logger.debug('Calculated cart totals', {
      cartId: this._id,
      subtotal: this.subtotal,
      tax: this.tax,
      discount: this.discount,
      total: this.total
    });
  } catch (error) {
    logger.error('Failed to calculate totals', { error: error.message });
    throw error;
  }
};

/**
 * Instance Method: Apply promo code
 * @param {String} code - Promo code to apply
 * @returns {Promise<Cart>} Updated cart
 */
cartSchema.methods.applyPromoCode = async function(code) {
  try {
    if (!code || typeof code !== 'string') {
      throw new Error('Invalid promo code');
    }

    const normalizedCode = code.trim().toUpperCase();

    // Placeholder for promo code validation
    // In production, this would validate against PromoCode model
    const validPromoCodes = {
      'SAVE10': 0.10,  // 10% discount
      'SAVE20': 0.20,  // 20% discount
      'FLAT50': 50     // $50 flat discount
    };

    if (!validPromoCodes[normalizedCode]) {
      throw new Error('Invalid or expired promo code');
    }

    const discountValue = validPromoCodes[normalizedCode];

    // Apply discount
    if (discountValue < 1) {
      // Percentage discount
      this.discount = Math.round(this.subtotal * discountValue * 100) / 100;
    } else {
      // Flat discount
      this.discount = Math.min(discountValue, this.subtotal);
    }

    this.promoCode = normalizedCode;

    await this.calculateTotals();
    await this.save();

    logger.info('Applied promo code', {
      code: normalizedCode,
      discount: this.discount,
      cartId: this._id
    });

    return this;
  } catch (error) {
    logger.error('Failed to apply promo code', {
      code,
      error: error.message
    });
    throw error;
  }
};

/**
 * Instance Method: Validate stock availability for all items
 * @returns {Promise<Boolean>} True if all items in stock
 */
cartSchema.methods.validateStock = async function() {
  try {

    for (const item of this.items) {
      const product = await Product.findById(item.productId);

      if (!product) {
        throw new Error(`Product ${item.name} no longer exists`);
      }

      if (!product.isAvailable) {
        throw new Error(`Product ${item.name} is no longer available`);
      }

      if (product.stock < item.quantity) {
        throw new Error(
          `Insufficient stock for ${item.name}. Available: ${product.stock}, Required: ${item.quantity}`
        );
      }
    }

    logger.info('Stock validation successful', { cartId: this._id });
    return true;
  } catch (error) {
    logger.error('Stock validation failed', {
      cartId: this._id,
      error: error.message
    });
    throw error;
  }
};

/**
 * Instance Method: Convert cart to order data
 * @returns {Object} Order data object
 */
cartSchema.methods.convertToOrder = async function() {
  try {
    await this.validateStock();

    const orderData = {
      userId: this.userId,
      items: this.items.map(item => ({
        productId: item.productId,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        image: item.image,
        sku: item.sku
      })),
      subtotal: this.subtotal,
      tax: this.tax,
      discount: this.discount,
      total: this.total,
      promoCode: this.promoCode
    };

    logger.info('Converted cart to order data', { cartId: this._id });

    return orderData;
  } catch (error) {
    logger.error('Failed to convert cart to order', {
      cartId: this._id,
      error: error.message
    });
    throw error;
  }
};

/**
 * Static Method: Find active cart for user
 * @param {ObjectId} userId - User ID
 * @returns {Promise<Cart|null>} Active cart or null
 */
cartSchema.statics.findActiveCart = async function(userId) {
  try {
    const cart = await this.findOne({ userId, status: 'active' });

    if (cart) {
      logger.debug('Found active cart', { userId, cartId: cart._id });
    }

    return cart;
  } catch (error) {
    logger.error('Failed to find active cart', {
      userId,
      error: error.message
    });
    throw error;
  }
};

/**
 * Static Method: Find or create cart for user/session
 * @param {ObjectId} userId - User ID (optional)
 * @param {String} sessionId - Session ID (optional)
 * @returns {Promise<Cart>} Cart instance
 */
cartSchema.statics.findOrCreateCart = async function
