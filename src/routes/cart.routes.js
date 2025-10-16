// File: src/routes/cart.routes.js
// Generated: 2025-10-16 10:46:43 UTC
// Project ID: proj_c85cfd5b58f3
// Task ID: task_1hhvbsy8mfta


const Cart = require('../models/Cart');


const Product = require('../models/Product');


const express = require('express');


const logger = require('../utils/logger');


const mongoose = require('mongoose');

const { authenticate } = require('../middleware/auth');


const router = express.Router();

const {
  validateAddToCart,
  validateUpdateCartItem,
  validateRemoveFromCart,
  handleValidationErrors
} = require('../middleware/validation');

/**
 * Apply authentication middleware to all cart routes
 * All cart operations require authenticated user
 */
router.use(authenticate);

/**
 * GET /api/cart
 * Get current user's shopping cart with all items
 */
router.get('/', async (req, res, next) => {
  try {
    const userId = req.userId;

    let cart = await Cart.findOne({ userId })
      .populate('items.productId', 'name price images stock isActive');

    if (!cart) {
      logger.info('Cart not found, returning empty cart', { userId });
      return res.json({
        success: true,
        data: {
          items: [],
          subtotal: 0,
          total: 0
        }
      });
    }

    // Filter out items with deleted or inactive products
    const validItems = cart.items.filter(item =>
      item.productId && item.productId.isActive !== false
    );

    // Update cart if items were filtered out
    if (validItems.length !== cart.items.length) {
      cart.items = validItems;
      await cart.save();
      logger.info('Removed invalid items from cart', {
        userId,
        removedCount: cart.items.length - validItems.length
      });
    }

    // Calculate totals using current product prices
    const subtotal = validItems.reduce((sum, item) => {
      const currentPrice = item.productId ? item.productId.price : item.price;
      return sum + (currentPrice * item.quantity);
    }, 0);

    logger.info('Fetched user cart', { userId, itemCount: validItems.length });

    res.json({
      success: true,
      data: {
        items: validItems,
        subtotal: subtotal.toFixed(2),
        total: subtotal.toFixed(2)
      }
    });
  } catch (error) {
    logger.error('Failed to fetch cart', {
      userId: req.userId,
      error: error.message
    });
    next(error);
  }
});

/**
 * POST /api/cart/items
 * Add item to cart or update quantity if already exists
 */
router.post('/items', validateAddToCart, handleValidationErrors, async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const userId = req.userId;
    const { productId, quantity } = req.body;

    // Verify product exists and is available with lock
    const product = await Product.findById(productId).session(session);

    if (!product) {
      await session.abortTransaction();
      session.endSession();
      logger.warn('Attempt to add non-existent product to cart', { userId, productId });
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    if (product.isActive === false) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        error: 'Product is not available'
      });
    }

    // Find or create cart with lock
    let cart = await Cart.findOne({ userId }).session(session);

    if (!cart) {
      cart = new Cart({
        userId,
        items: []
      });
    }

    // Check if item already exists in cart
    const existingItemIndex = cart.items.findIndex(
      item => item.productId.toString() === productId
    );

    let totalQuantityNeeded = quantity;

    if (existingItemIndex > -1) {
      totalQuantityNeeded = cart.items[existingItemIndex].quantity + quantity;
    }

    // Atomic stock check
    if (product.stock < totalQuantityNeeded) {
      await session.abortTransaction();
      session.endSession();
      logger.warn('Insufficient stock for cart addition', {
        userId,
        productId,
        requested: totalQuantityNeeded,
        available: product.stock
      });
      return res.status(400).json({
        success: false,
        error: 'Insufficient stock available',
        available: product.stock,
        currentInCart: existingItemIndex > -1 ? cart.items[existingItemIndex].quantity : 0
      });
    }

    if (existingItemIndex > -1) {
      // Update existing item with current price
      cart.items[existingItemIndex].quantity = totalQuantityNeeded;
      cart.items[existingItemIndex].price = product.price;

      logger.info('Updated cart item quantity', {
        userId,
        productId,
        newQuantity: totalQuantityNeeded
      });
    } else {
      // Add new item with current price
      cart.items.push({
        productId,
        quantity,
        price: product.price
      });

      logger.info('Added new item to cart', { userId, productId, quantity });
    }

    await cart.save({ session });
    await session.commitTransaction();
    session.endSession();

    await cart.populate('items.productId', 'name price images stock isActive');

    // Calculate totals using current product prices
    const subtotal = cart.items.reduce((sum, item) => {
      const currentPrice = item.productId ? item.productId.price : item.price;
      return sum + (currentPrice * item.quantity);
    }, 0);

    res.status(201).json({
      success: true,
      message: 'Item added to cart successfully',
      data: {
        items: cart.items,
        subtotal: subtotal.toFixed(2),
        total: subtotal.toFixed(2)
      }
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    logger.error('Failed to add item to cart', {
      userId: req.userId,
      productId: req.body.productId,
      error: error.message
    });
    next(error);
  }
});

/**
 * PUT /api/cart/items/:productId
 * Update quantity of specific cart item
 */
router.put('/items/:productId', validateUpdateCartItem, handleValidationErrors, async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const userId = req.userId;
    const { productId } = req.params;
    const { quantity } = req.body;

    if (quantity < 1) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        error: 'Quantity must be at least 1'
      });
    }

    // Verify product exists and has sufficient stock with lock
    const product = await Product.findById(productId).session(session);

    if (!product) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    // Atomic stock check
    if (product.stock < quantity) {
      await session.abortTransaction();
      session.endSession();
      logger.warn('Insufficient stock for cart update', {
        userId,
        productId,
        requested: quantity,
        available: product.stock
      });
      return res.status(400).json({
        success: false,
        error: 'Insufficient stock available',
        available: product.stock
      });
    }

    // Find cart with lock
    const cart = await Cart.findOne({ userId }).session(session);

    if (!cart) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        error: 'Cart not found'
      });
    }

    // Find item in cart
    const itemIndex = cart.items.findIndex(
      item => item.productId.toString() === productId
    );

    if (itemIndex === -1) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        error: 'Item not found in cart'
      });
    }

    // Update item with current price
    cart.items[itemIndex].quantity = quantity;
    cart.items[itemIndex].price = product.price;

    await cart.save({ session });
    await session.commitTransaction();
    session.endSession();

    await cart.populate('items.productId', 'name price images stock isActive');

    logger.info('Updated cart item', { userId, productId, quantity });

    // Calculate totals using current product prices
    const subtotal = cart.items.reduce((sum, item) => {
      const currentPrice = item.productId ? item.productId.price : item.price;
      return sum + (currentPrice * item.quantity);
    }, 0);

    res.json({
      success: true,
      message: 'Cart item updated successfully',
      data: {
        items: cart.items,
        subtotal: subtotal.toFixed(2),
        total: subtotal.toFixed(2)
      }
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    logger.error('Failed to update cart item', {
      userId: req.userId,
      productId: req.params.productId,
      error: error.message
    });
    next(error);
  }
});

/**
 * DELETE /api/cart/items/:productId
 * Remove specific item from cart
 */
router.delete('/items/:productId', validateRemoveFromCart, handleValidationErrors, async (req, res, next) => {
  try {
    const userId = req.userId;
    const { productId } = req.params;

    const cart = await Cart.findOne({ userId });

    if (!cart) {
      return res.status(404).json({
        success: false,
        error: 'Cart not found'
      });
    }

    // Find item index
    const itemIndex = cart.items.findIndex(
      item => item.productId.toString() === productId
    );

    if (itemIndex === -1) {
      return res.status(404).json({
        success: false,
        error: 'Item not found in cart'
      });
    }

    // Remove item
    cart.items.splice(itemIndex, 1);
    await cart.save();
    await cart.populate('items.productId', 'name price images stock isActive');

    logger.info('Removed item from cart', { userId, productId });

    // Calculate totals using current product prices
    const subtotal = cart.items.reduce((sum, item) => {
      const currentPrice = item.productId ? item.productId.price : item.price;
      return sum + (currentPrice * item.quantity);
    }, 0);

    res.json({
      success: true,
      message: 'Item removed from cart successfully',
      data: {
        items: cart.items,
        subtotal: subtotal.toFixed(2),
        total: subtotal.toFixed(2)
      }
    });
  } catch (error) {
    logger.error('Failed to remove cart item', {
      userId: req.userId,
      productId: req.params.productId,
      error: error.message
    });
    next(error);
  }
});

/**
 * DELETE /api/cart
 * Clear entire cart (remove all items)
 */
router.delete('/', async (req, res, next) => {
  try {
    const userId = req.userId;

    const cart = await Cart.findOne({ userId });

    if (!cart) {
      return res.status(404).json({
        success: false,
        error: 'Cart not found'
      });
    }

    const itemCount = cart.items.length;
    cart.items = [];
    await cart.save();

    logger.info('Cleared cart', { userId, itemsRemoved: itemCount });

    res.json({
      success: true,
      message: 'Cart cleared successfully',
      data: {
        items: [],
        subtotal: 0,
        total: 0
      }
    });
  } catch (error) {
    logger.error('Failed to clear cart', {
      userId: req.userId,
      error: error.message
    });
    next(error);
  }
});

/**
 * GET /api/cart/summary
 * Get cart summary with totals only (lightweight endpoint)
 */
router.get('/summary', async (req, res, next) => {
  try {
    const userId = req.userId;

    const cart = await Cart.findOne({ userId }).populate('items.productId', 'price');

    if (!cart || cart.items.length === 0) {
      return res.json({
        success: true,
        data: {
          itemCount: 0,
          subtotal: 0,
          total: 0
        }
      });
    }

    // Calculate totals using current product prices
    const subtotal = cart.items.reduce((sum, item) => {
      const currentPrice = item.productId ? item.productId.price : item.price;
      return sum + (currentPrice * item.quantity);
    }, 0);

    const itemCount = cart.items.reduce((sum, item) => {
      return sum + item.quantity;
    }, 0);

    logger.info('Fetched cart summary', { userId, itemCount });

    res.json({
      success: true,
      data: {
        itemCount,
        subtotal: subtotal.toFixed(2),
        total: subtotal.toFixed(2)
      }
    });
  } catch (error) {
    logger.error('Failed to fetch cart summary', {
      userId: req.userId,
      error: error.message
    });
    next(error);
  }
});

module.exports = router;
