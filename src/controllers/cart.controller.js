// File: src/controllers/cart.controller.js
// Generated: 2025-10-16 10:49:34 UTC
// Project ID: proj_c85cfd5b58f3
// Task ID: task_gj6yvybslx8m


const ApiResponse = require('../utils/response');


const cartService = require('../services/cart.service');


const logger = require('../utils/logger');

/**
 * Get user's cart
 * GET /api/cart
 */


const getCart = async (req, res, next) => {
  try {
    const userId = req.userId;

    const cart = await cartService.getCartByUserId(userId);

    logger.info('Retrieved cart', { userId, itemCount: cart.items.length });

    res.json(ApiResponse.success(cart, 'Cart retrieved successfully'));
  } catch (error) {
    logger.error('Failed to retrieve cart', { userId: req.userId, error: error.message });
    next(error);
  }
};

/**
 * Add item to cart
 * POST /api/cart/items
 */


const addItem = async (req, res, next) => {
  try {
    const userId = req.userId;
    const { productId, quantity } = req.body;

    if (!productId) {
      return res.status(400).json(ApiResponse.error('Product ID is required'));
    }

    if (!quantity || quantity < 1) {
      return res.status(400).json(ApiResponse.error('Valid quantity is required'));
    }

    const cart = await cartService.addItemToCart(userId, productId, quantity);

    logger.info('Added item to cart', { userId, productId, quantity });

    res.status(201).json(ApiResponse.success(cart, 'Item added to cart successfully'));
  } catch (error) {
    logger.error('Failed to add item to cart', {
      userId: req.userId,
      productId: req.body.productId,
      error: error.message
    });

    if (error.message.includes('not found') || error.message.includes('does not exist')) {
      return res.status(404).json(ApiResponse.error(error.message));
    }

    if (error.message.includes('stock') || error.message.includes('available')) {
      return res.status(400).json(ApiResponse.error(error.message));
    }

    next(error);
  }
};

/**
 * Update cart item quantity
 * PUT /api/cart/items/:productId
 */


const updateItem = async (req, res, next) => {
  try {
    const userId = req.userId;
    const { productId } = req.params;
    const { quantity } = req.body;

    if (!quantity || quantity < 0) {
      return res.status(400).json(ApiResponse.error('Valid quantity is required'));
    }

    const cart = await cartService.updateCartItem(userId, productId, quantity);

    logger.info('Updated cart item', { userId, productId, quantity });

    res.json(ApiResponse.success(cart, 'Cart item updated successfully'));
  } catch (error) {
    logger.error('Failed to update cart item', {
      userId: req.userId,
      productId: req.params.productId,
      error: error.message
    });

    if (error.message.includes('not found') || error.message.includes('does not exist')) {
      return res.status(404).json(ApiResponse.error(error.message));
    }

    if (error.message.includes('stock') || error.message.includes('available')) {
      return res.status(400).json(ApiResponse.error(error.message));
    }

    next(error);
  }
};

/**
 * Remove item from cart
 * DELETE /api/cart/items/:productId
 */


const removeItem = async (req, res, next) => {
  try {
    const userId = req.userId;
    const { productId } = req.params;

    const cart = await cartService.removeItemFromCart(userId, productId);

    logger.info('Removed item from cart', { userId, productId });

    res.json(ApiResponse.success(cart, 'Item removed from cart successfully'));
  } catch (error) {
    logger.error('Failed to remove item from cart', {
      userId: req.userId,
      productId: req.params.productId,
      error: error.message
    });

    if (error.message.includes('not found') || error.message.includes('does not exist')) {
      return res.status(404).json(ApiResponse.error(error.message));
    }

    next(error);
  }
};

/**
 * Clear entire cart
 * DELETE /api/cart
 */


const clearCart = async (req, res, next) => {
  try {
    const userId = req.userId;

    const cart = await cartService.clearCart(userId);

    logger.info('Cleared cart', { userId });

    res.json(ApiResponse.success(cart, 'Cart cleared successfully'));
  } catch (error) {
    logger.error('Failed to clear cart', { userId: req.userId, error: error.message });

    if (error.message.includes('not found') || error.message.includes('does not exist')) {
      return res.status(404).json(ApiResponse.error(error.message));
    }

    next(error);
  }
};

module.exports = {
  getCart,
  addItem,
  updateItem,
  removeItem,
  clearCart
};
