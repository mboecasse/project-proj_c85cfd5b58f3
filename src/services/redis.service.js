// File: src/services/redis.service.js
// Generated: 2025-10-16 10:52:19 UTC
// Project ID: proj_c85cfd5b58f3
// Task ID: task_3hg21bgb2bru


const crypto = require('crypto');


const logger = require('../utils/logger');

// Import Redis client and utilities from config

const {
  client,
  KEY_PREFIXES,
  TTL_DEFAULTS,
  getKey,
  getTTL,
  setWithTTL,
  getWithParse,
  deleteKeys,
  deleteByPattern,
  isHealthy,
  getInfo,
  disconnect: disconnectClient,
  incrementWithTTL,
  acquireLock: acquireLockUtil,
  releaseLock: releaseLockUtil
} = require('../config/redis');

/**
 * Custom Redis Error Classes
 */
class RedisConnectionError extends Error {
  constructor(message) {
    super(message);
    this.name = 'RedisConnectionError';
  }
}

class RedisOperationError extends Error {
  constructor(message, operation, key) {
    super(message);
    this.name = 'RedisOperationError';
    this.operation = operation;
    this.key = key;
  }
}

/**
 * Redis Service - Wrapper for Redis operations in e-commerce backend
 * Handles shopping cart, product caching, sessions, inventory locking, and more
 */
class RedisService {
  constructor() {
    this.client = client;
    this.isConnected = false;
    this.subscriber = null;
  }

  /**
   * Initialize Redis connection and event handlers
   * @returns {Promise<void>}
   */
  async connect() {
    try {
      if (this.isConnected) {
        logger.info('Redis already connected');
        return;
      }

      // Set up event handlers
      this.client.on('connect', () => {
        logger.info('Redis client connecting...');
      });

      this.client.on('ready', () => {
        this.isConnected = true;
        logger.info('Redis client connected and ready');
      });

      this.client.on('error', (error) => {
        logger.error('Redis client error', { error: error.message });
      });

      this.client.on('end', () => {
        this.isConnected = false;
        logger.warn('Redis client connection closed');
      });

      this.client.on('reconnecting', () => {
        logger.info('Redis client reconnecting...');
      });

      // Wait for connection to be ready
      if (this.client.status === 'ready') {
        this.isConnected = true;
      } else if (this.client.status !== 'ready') {
        await this.client.connect();
        this.isConnected = true;
      }

      logger.info('Redis service initialized');
    } catch (error) {
      logger.error('Failed to connect to Redis', { error: error.message });
      throw new RedisConnectionError(`Redis connection failed: ${error.message}`);
    }
  }

  /**
   * Gracefully disconnect from Redis
   * @returns {Promise<void>}
   */
  async disconnect() {
    try {
      if (this.subscriber) {
        await this.subscriber.quit();
        this.subscriber = null;
      }
      await disconnectClient();
      this.isConnected = false;
      logger.info('Redis service disconnected gracefully');
    } catch (error) {
      logger.error('Error disconnecting from Redis', { error: error.message });
      throw error;
    }
  }

  /**
   * Health check - ping Redis
   * @returns {Promise<boolean>}
   */
  async ping() {
    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch (error) {
      logger.error('Redis ping failed', { error: error.message });
      return false;
    }
  }

  /**
   * Get Redis connection stats and memory usage
   * @returns {Promise<Object>}
   */
  async getStats() {
    try {
      const info = await getInfo();
      const dbSize = await this.client.dbsize();

      return {
        connected: this.isConnected,
        status: this.client.status,
        dbSize,
        memory: info.used_memory_human,
        uptime: info.uptime_in_seconds,
        connectedClients: info.connected_clients
      };
    } catch (error) {
      logger.error('Failed to get Redis stats', { error: error.message });
      throw new RedisOperationError(error.message, 'getStats', 'info');
    }
  }

  /**
   * ==================== SHOPPING CART OPERATIONS ====================
   */

  /**
   * Store shopping cart for user
   * @param {string} userId - User ID
   * @param {Object} cartData - Cart data with items, totalPrice, etc.
   * @param {number} [ttl] - Time to live in seconds (default: 24h)
   * @returns {Promise<boolean>}
   */
  async setCart(userId, cartData, ttl = TTL_DEFAULTS.CART) {
    try {
      const key = getKey(KEY_PREFIXES.CART, userId);
      const value = JSON.stringify({
        ...cartData,
        updatedAt: Date.now()
      });

      await setWithTTL(key, value, ttl);
      logger.info('Cart stored', { userId, itemCount: cartData.items?.length || 0 });
      return true;
    } catch (error) {
      logger.error('Failed to set cart', { userId, error: error.message });
      throw new RedisOperationError(error.message, 'setCart', `cart:${userId}`);
    }
  }

  /**
   * Retrieve shopping cart for user
   * @param {string} userId - User ID
   * @returns {Promise<Object|null>}
   */
  async getCart(userId) {
    try {
      const key = getKey(KEY_PREFIXES.CART, userId);
      const cart = await getWithParse(key);

      if (cart) {
        logger.debug('Cart retrieved', { userId, itemCount: cart.items?.length || 0 });
      }

      return cart;
    } catch (error) {
      logger.error('Failed to get cart', { userId, error: error.message });
      throw new RedisOperationError(error.message, 'getCart', `cart:${userId}`);
    }
  }

  /**
   * Update specific item in cart
   * @param {string} userId - User ID
   * @param {string} productId - Product ID
   * @param {number} quantity - New quantity
   * @returns {Promise<Object|null>}
   */
  async updateCartItem(userId, productId, quantity) {
    try {
      const cart = await this.getCart(userId);

      if (!cart) {
        return null;
      }

      const itemIndex = cart.items.findIndex(item => item.productId === productId);

      if (quantity <= 0) {
        // Remove item if quantity is 0 or negative
        if (itemIndex > -1) {
          cart.items.splice(itemIndex, 1);
        }
      } else {
        // Update or add item
        if (itemIndex > -1) {
          cart.items[itemIndex].quantity = quantity;
        } else {
          cart.items.push({ productId, quantity });
        }
      }

      // Recalculate total (assuming price info is in items)
      cart.totalPrice = cart.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

      await this.setCart(userId, cart);
      logger.info('Cart item updated', { userId, productId, quantity });

      return cart;
    } catch (error) {
      logger.error('Failed to update cart item', { userId, productId, error: error.message });
      throw new RedisOperationError(error.message, 'updateCartItem', `cart:${userId}`);
    }
  }

  /**
   * Clear cart (typically after order completion)
   * @param {string} userId - User ID
   * @returns {Promise<boolean>}
   */
  async clearCart(userId) {
    try {
      const key = getKey(KEY_PREFIXES.CART, userId);
      await deleteKeys([key]);
      logger.info('Cart cleared', { userId });
      return true;
    } catch (error) {
      logger.error('Failed to clear cart', { userId, error: error.message });
      throw new RedisOperationError(error.message, 'clearCart', `cart:${userId}`);
    }
  }

  /**
   * ==================== PRODUCT CACHING OPERATIONS ====================
   */

  /**
   * Cache single product
   * @param {string} productId - Product ID
   * @param {Object} productData - Product data
   * @param {number} [ttl] - Time to live in seconds (default: 1h)
   * @returns {Promise<boolean>}
   */
  async cacheProduct(productId, productData, ttl = TTL_DEFAULTS.PRODUCT) {
    try {
      const key = getKey(KEY_PREFIXES.PRODUCT, productId);
      const value = JSON.stringify(productData);

      await setWithTTL(key, value, ttl);
      logger.debug('Product cached', { productId });
      return true;
    } catch (error) {
      logger.error('Failed to cache product', { productId, error: error.message });
      throw new RedisOperationError(error.message, 'cacheProduct', `product:${productId}`);
    }
  }

  /**
   * Get cached product
   * @param {string} productId - Product ID
   * @returns {Promise<Object|null>}
   */
  async getCachedProduct(productId) {
    try {
      const key = getKey(KEY_PREFIXES.PRODUCT, productId);
      const product = await getWithParse(key);

      if (product) {
        logger.debug('Product cache hit', { productId });
      } else {
        logger.debug('Product cache miss', { productId });
      }

      return product;
    } catch (error) {
      logger.error('Failed to get cached product', { productId, error: error.message });
      throw new RedisOperationError(error.message, 'getCachedProduct', `product:${productId}`);
    }
  }

  /**
   * Cache product list with filters
   * @param {Object} filters - Filter object
   * @param {Array} products - Array of products
   * @param {number} [ttl] - Time to live in seconds (default: 5m)
   * @returns {Promise<boolean>}
   */
  async cacheProductList(filters, products, ttl = TTL_DEFAULTS.PRODUCT_LIST) {
    try {
      const filterHash = crypto.createHash('md5').update(JSON.stringify(filters)).digest('hex');
      const key = getKey(KEY_PREFIXES.PRODUCT_LIST, filterHash);
      const value = JSON.stringify(products);

      await setWithTTL(key, value, ttl);
      logger.debug('Product list cached', { filterHash, count: products.length });
      return true;
    } catch (error) {
      logger.error('Failed to cache product list', { error: error.message });
      throw new RedisOperationError(error.message, 'cacheProductList', 'products:*');
    }
  }

  /**
   * Get cached product list
   * @param {Object} filters - Filter object
   * @returns {Promise<Array|null>}
   */
  async getCachedProductList(filters) {
    try {
      const filterHash = crypto.createHash('md5').update(JSON.stringify(filters)).digest('hex');
      const key = getKey(KEY_PREFIXES.PRODUCT_LIST, filterHash);
      const products = await getWithParse(key);

      if (products) {
        logger.debug('Product list cache hit', { filterHash, count: products.length });
      } else {
        logger.debug('Product list cache miss', { filterHash });
      }

      return products;
    } catch (error) {
      logger.error('Failed to get cached product list', { error: error.message });
      throw new RedisOperationError(error.message, 'getCachedProductList', 'products:*');
    }
  }

  /**
   * Invalidate product cache and related caches
   * @param {string} productId - Product ID
   * @returns {Promise<boolean>}
   */
  async invalidateProductCache(productId) {
    try {
      const productKey = getKey(KEY_PREFIXES.PRODUCT, productId);
      await deleteKeys([productKey]);

      // Also invalidate all product lists
      await deleteByPattern(`${KEY_PREFIXES.PRODUCT_LIST}:*`);

      logger.info('Product cache invalidated', { productId });
      return true;
    } catch (error) {
      logger.error('Failed to invalidate product cache', { productId, error: error.message });
      throw new RedisOperationError(error.message, 'invalidateProductCache', `product:${productId}`);
    }
  }

  /**
   * ==================== SESSION MANAGEMENT ====================
   */

  /**
   * Store user session
   * @param {string} sessionId - Session ID
   * @param {Object} userData - User data
   * @param {number} [ttl] - Time to live in seconds (default: 7d)
   * @returns {Promise<boolean>}
   */
  async setSession(sessionId, userData, ttl = TTL_DEFAULTS.SESSION) {
    try {
      const key = getKey(KEY_PREFIXES.SESSION, sessionId);
      const value = JSON.stringify({
        ...userData,
        loginAt: Date.now()
      });

      await setWithTTL(key, value, ttl);
      logger.info('Session stored', { sessionId, userId: userData.userId });
      return true;
    } catch (error) {
      logger.error('Failed to set session', { sessionId, error: error.message });
      throw new RedisOperationError(error.message, 'setSession', `session:${sessionId}`);
    }
  }

  /**
   * Get user session and extend TTL (sliding expiration)
   * @param {string} sessionId - Session ID
   * @returns {Promise<Object|null>}
   */
  async getSession(sessionId) {
    try {
      const key = getKey(KEY_PREFIXES.SESSION, sessionId);
      const session = await getWithParse(key);

      if (session) {
        // Extend TTL (sliding expiration)
        await this.client.expire(key, TTL_DEFAULTS.SESSION);
        logger.debug('Session retrieved and extended', { sessionId });
      }

      return session;
    } catch (error) {
      logger.error('Failed to get session', { sessionId, error: error.message });
      throw new RedisOperationError(error.message, 'getSession', `session:${sessionId}`);
    }
  }

  /**
   * Delete user session (logout)
   * @param {string} sessionId - Session ID
   * @returns {Promise<boolean>}
   */
  async deleteSession(sessionId) {
    try {
      const key = getKey(KEY_PREFIXES.SESSION, sessionId);
      await deleteKeys([key]);
      logger.info('Session deleted', { sessionId });
      return true;
    } catch (error) {
      logger.error('Failed to delete session', { sessionId, error: error.message });
      throw new RedisOperationError(error.message, 'deleteSession', `session:${sessionId}`);
    }
  }

  /**
   * ==================== INVENTORY LOCKING ====================
   */

  /**
   * Lock inventory for order processing
   * @param {string} productId - Product ID
   * @param {number} quantity - Quantity to lock
   * @param {string} orderId - Order ID
   * @param {number} [ttl] - Time to live in seconds (default: 10m)
   * @returns {Promise<boolean>}

}