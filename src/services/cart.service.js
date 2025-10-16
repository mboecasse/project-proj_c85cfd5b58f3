// File: src/services/cart.service.js
// Generated: 2025-10-16 10:50:08 UTC
// Project ID: proj_c85cfd5b58f3
// Task ID: task_7ksasuh3f1lf


const Cart = require('../models/Cart');


const Product = require('../models/Product');


const RedisService = require('./redis.service');


const logger = require('../utils/logger');

/**
 * Shopping Cart Service
 * Handles all cart operations with Redis caching and MongoDB persistence
 */
class CartService {
  constructor() {
    this.redis = new RedisService();
    this.CART_CACHE_TTL = 3600; // 1 hour cache
  }

  /**
   * Get or create cart for user or session
   * @param {String} userId - User ID (optional)
   * @param {String} sessionId - Session ID (required if no userId)
   * @returns {Promise<Object>} Cart object
   */
  async getCart(userId, sessionId) {
    try {
      if (!userId && !sessionId) {
        throw new Error('Either userId or sessionId is required');
      }

      const cacheKey = userId ? `cart:user:${userId}` : `cart:session:${sessionId}`;

      // Try to get from cache first
      const cachedCart = await this.redis.getCart(cacheKey);
      if (cachedCart) {
        logger.debug('Cart retrieved from cache', { userId, sessionId });
        return cachedCart;
      }

      // Get from database
      let cart;
      if (userId) {
        cart = await Cart.findOne({ userId }).populate('items.productId', 'name price sku image inventory');
      } else {
        cart = await Cart.findOne({ sessionId }).populate('items.productId', 'name price sku image inventory');
      }

      // Create new cart if doesn't exist
      if (!cart) {
        cart = await Cart.create({
          userId: userId || null,
          sessionId: sessionId || null,
          items: [],
          subtotal: 0,
          tax: 0,
          discount: 0,
          total: 0
        });
        logger.info('Created new cart', { userId, sessionId, cartId: cart._id });
      }

      // Cache the cart
      await this.redis.addToCart(cacheKey, cart.toObject());

      return cart;
    } catch (error) {
      logger.error('Failed to get cart', { userId, sessionId, error: error.message });
      throw error;
    }
  }

  /**
   * Add item to cart
   * @param {String} userId - User ID
   * @param {String} sessionId - Session ID
   * @param {String} productId - Product ID
   * @param {Number} quantity - Quantity to add
   * @returns {Promise<Object>} Updated cart
   */
  async addItem(userId, sessionId, productId, quantity) {
    try {
      if (!productId || !quantity || quantity < 1) {
        throw new Error('Valid productId and quantity are required');
      }

      // Verify product exists and is available
      const product = await Product.findById(productId);
      if (!product) {
        throw new Error('Product not found');
      }

      if (!product.isInStock()) {
        throw new Error('Product is out of stock');
      }

      if (!product.canPurchase(quantity)) {
        throw new Error(`Insufficient stock. Available: ${product.inventory.quantity}`);
      }

      // Get cart
      const cart = await this.getCart(userId, sessionId);

      // Add item using Cart model method
      await cart.addItem(productId, quantity);

      // Recalculate totals
      await cart.calculateTotals();

      // Save cart
      await cart.save();

      // Populate product details
      await cart.populate('items.productId', 'name price sku image inventory');

      // Update cache
      const cacheKey = userId ? `cart:user:${userId}` : `cart:session:${sessionId}`;
      await this.redis.addToCart(cacheKey, cart.toObject());

      logger.info('Item added to cart', {
        userId,
        sessionId,
        productId,
        quantity,
        cartId: cart._id
      });

      return cart;
    } catch (error) {
      logger.error('Failed to add item to cart', {
        userId,
        sessionId,
        productId,
        quantity,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Update item quantity in cart
   * @param {String} userId - User ID
   * @param {String} sessionId - Session ID
   * @param {String} productId - Product ID
   * @param {Number} quantity - New quantity
   * @returns {Promise<Object>} Updated cart
   */
  async updateItemQuantity(userId, sessionId, productId, quantity) {
    try {
      if (!productId || quantity < 0) {
        throw new Error('Valid productId and quantity are required');
      }

      // If quantity is 0, remove item
      if (quantity === 0) {
        return await this.removeItem(userId, sessionId, productId);
      }

      // Verify product availability
      const product = await Product.findById(productId);
      if (!product) {
        throw new Error('Product not found');
      }

      if (!product.canPurchase(quantity)) {
        throw new Error(`Insufficient stock. Available: ${product.inventory.quantity}`);
      }

      // Get cart
      const cart = await this.getCart(userId, sessionId);

      // Update quantity using Cart model method
      await cart.updateQuantity(productId, quantity);

      // Recalculate totals
      await cart.calculateTotals();

      // Save cart
      await cart.save();

      // Populate product details
      await cart.populate('items.productId', 'name price sku image inventory');

      // Update cache
      const cacheKey = userId ? `cart:user:${userId}` : `cart:session:${sessionId}`;
      await this.redis.addToCart(cacheKey, cart.toObject());

      logger.info('Cart item quantity updated', {
        userId,
        sessionId,
        productId,
        quantity,
        cartId: cart._id
      });

      return cart;
    } catch (error) {
      logger.error('Failed to update cart item quantity', {
        userId,
        sessionId,
        productId,
        quantity,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Remove item from cart
   * @param {String} userId - User ID
   * @param {String} sessionId - Session ID
   * @param {String} productId - Product ID
   * @returns {Promise<Object>} Updated cart
   */
  async removeItem(userId, sessionId, productId) {
    try {
      if (!productId) {
        throw new Error('Product ID is required');
      }

      // Get cart
      const cart = await this.getCart(userId, sessionId);

      // Remove item using Cart model method
      await cart.removeItem(productId);

      // Recalculate totals
      await cart.calculateTotals();

      // Save cart
      await cart.save();

      // Populate product details
      await cart.populate('items.productId', 'name price sku image inventory');

      // Update cache
      const cacheKey = userId ? `cart:user:${userId}` : `cart:session:${sessionId}`;
      await this.redis.addToCart(cacheKey, cart.toObject());

      logger.info('Item removed from cart', {
        userId,
        sessionId,
        productId,
        cartId: cart._id
      });

      return cart;
    } catch (error) {
      logger.error('Failed to remove item from cart', {
        userId,
        sessionId,
        productId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Clear all items from cart
   * @param {String} userId - User ID
   * @param {String} sessionId - Session ID
   * @returns {Promise<Object>} Empty cart
   */
  async clearCart(userId, sessionId) {
    try {
      // Get cart
      const cart = await this.getCart(userId, sessionId);

      // Clear cart using Cart model method
      await cart.clearCart();

      // Save cart
      await cart.save();

      // Update cache
      const cacheKey = userId ? `cart:user:${userId}` : `cart:session:${sessionId}`;
      await this.redis.addToCart(cacheKey, cart.toObject());

      logger.info('Cart cleared', { userId, sessionId, cartId: cart._id });

      return cart;
    } catch (error) {
      logger.error('Failed to clear cart', {
        userId,
        sessionId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Apply promo code to cart
   * @param {String} userId - User ID
   * @param {String} sessionId - Session ID
   * @param {String} promoCode - Promo code to apply
   * @returns {Promise<Object>} Updated cart with discount
   */
  async applyPromoCode(userId, sessionId, promoCode) {
    try {
      if (!promoCode) {
        throw new Error('Promo code is required');
      }

      // Get cart
      const cart = await this.getCart(userId, sessionId);

      if (cart.items.length === 0) {
        throw new Error('Cannot apply promo code to empty cart');
      }

      // TODO: Validate promo code with PromoCode service
      // For now, apply a simple 10% discount
      const discountPercentage = 10;
      cart.promoCode = promoCode.toUpperCase();
      cart.discount = (cart.subtotal * discountPercentage) / 100;

      // Recalculate totals
      await cart.calculateTotals();

      // Save cart
      await cart.save();

      // Populate product details
      await cart.populate('items.productId', 'name price sku image inventory');

      // Update cache
      const cacheKey = userId ? `cart:user:${userId}` : `cart:session:${sessionId}`;
      await this.redis.addToCart(cacheKey, cart.toObject());

      logger.info('Promo code applied to cart', {
        userId,
        sessionId,
        promoCode,
        discount: cart.discount,
        cartId: cart._id
      });

      return cart;
    } catch (error) {
      logger.error('Failed to apply promo code', {
        userId,
        sessionId,
        promoCode,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Remove promo code from cart
   * @param {String} userId - User ID
   * @param {String} sessionId - Session ID
   * @returns {Promise<Object>} Updated cart without discount
   */
  async removePromoCode(userId, sessionId) {
    try {
      // Get cart
      const cart = await this.getCart(userId, sessionId);

      cart.promoCode = null;
      cart.discount = 0;

      // Recalculate totals
      await cart.calculateTotals();

      // Save cart
      await cart.save();

      // Populate product details
      await cart.populate('items.productId', 'name price sku image inventory');

      // Update cache
      const cacheKey = userId ? `cart:user:${userId}` : `cart:session:${sessionId}`;
      await this.redis.addToCart(cacheKey, cart.toObject());

      logger.info('Promo code removed from cart', { userId, sessionId, cartId: cart._id });

      return cart;
    } catch (error) {
      logger.error('Failed to remove promo code', {
        userId,
        sessionId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Merge guest cart with user cart after login
   * @param {String} userId - User ID
   * @param {String} sessionId - Session ID of guest cart
   * @returns {Promise<Object>} Merged cart
   */
  async mergeCarts(userId, sessionId) {
    try {
      if (!userId || !sessionId) {
        throw new Error('Both userId and sessionId are required');
      }

      // Get both carts
      const userCart = await Cart.findOne({ userId });
      const guestCart = await Cart.findOne({ sessionId });

      // If no guest cart, return user cart or create new one
      if (!guestCart || guestCart.items.length === 0) {
        if (userCart) {
          await userCart.populate('items.productId', 'name price sku image inventory');
          return userCart;
        }
        return await this.getCart(userId, null);
      }

      // If no user cart, convert guest cart to user cart
      if (!userCart) {
        guestCart.userId = userId;
        guestCart.sessionId = null;
        await guestCart.save();
        await guestCart.populate('items.productId', 'name price sku image inventory');

        // Update cache
        await this.redis.addToCart(`cart:user:${userId}`, guestCart.toObject());

        logger.info('Guest cart converted to user cart', { userId, sessionId, cartId: guestCart._id });
        return guestCart;
      }

      // Merge guest cart items into user cart
      for (const guestItem of guestCart.items) {
        const existingItem = userCart.items.find(
          item => item.productId.toString() === guestItem.productId.toString()
        );

        if (existingItem) {
          // Update quantity if item exists
          existingItem.quantity += guestItem.quantity;
        } else {
          // Add new item
          userCart.items.push(guestItem);
        }
      }

      // Recalculate totals
      await userCart.calculateTotals();

      // Save merged cart
      await userCart.save();

      // Delete guest cart
      await Cart.deleteOne({ _id: guestCart._id });

      // Populate product details
      await userCart.populate('items.productId', 'name price sku image inventory');

      // Update cache
      await this.redis.addToCart(`cart:user:${userId}`, userCart.toObject());

      logger.info('Carts merged successfully', {
        userId,
        sessionId,
        userCartId: userCart._id,
        guestCartId: guestCart._id
      });

      return userCart;
    } catch (error) {
      logger.error('Failed to merge carts', {
        userId,
        sessionId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Validate cart before checkout
   * @param {String} userId - User ID
   * @param {String} sessionId - Session ID
   * @returns {Promise<Object>} Validation result with cart
   */
  async validateCart(userId, sessionId) {
    try {
      const cart = await this.getCart(userId, sessionId);

      if (cart.items.length === 0) {
        return {
          valid: false,
          errors: ['Cart is empty'],
          cart
        };
      }

      const errors = [];
      const unavailableItems = [];

      // Validate each item
      for (const item of cart.items) {
        const product = await Product.findById(item.productId);

        if (!product) {
          errors.push(`Product ${item.name} no longer exists`);
          unavailableItems.push(item.productId);
          continue;
        }

        if (!product.isInStock()) {
          errors.push(`Product ${item.name} is out of stock`);
          unavailableItems.push(item.productId);
          continue;
        }

        if (!product.canPurchase(item.quantity)) {
          errors.push(`Insufficient stock for ${item.name}. Available: ${product.inventory.quantity}`);
          unavailableItems.push(item.productI
