// File: src/config/redis.js
// Generated: 2025-10-16 10:40:38 UTC
// Project ID: proj_c85cfd5b58f3
// Task ID: task_o7tg4tyi7g2t


const logger = require('../utils/logger');


const redis = require('ioredis');

* - Configurable TTL defaults
 * - Health check mechanism
 * - Graceful shutdown support
 */

/**
 * Key namespace prefixes for different data types
 * Helps organize Redis keys and prevent collisions
 */


const KEY_PREFIXES = {
  SESSION: 'sess:',
  CART: 'cart:',
  PRODUCT_CACHE: 'prod:',
  INVENTORY: 'inv:',
  PRICE: 'price:',
  RATE_LIMIT: 'rl:',
  ORDER_LOCK: 'lock:order:',
  USER_SESSION: 'user:sess:'
};

/**
 * Default TTL (Time To Live) values in seconds
 * Different data types have different expiration requirements
 */


const TTL_DEFAULTS = {
  SESSION: 86400,           // 24 hours
  CART_GUEST: 604800,       // 7 days
  CART_USER: 2592000,       // 30 days
  PRODUCT: 3600,            // 1 hour
  INVENTORY: 300,           // 5 minutes
  PRICE: 900,               // 15 minutes
  RATE_LIMIT: 60,           // 1 minute
  ORDER_LOCK: 300           // 5 minutes
};

/**
 * Get Redis configuration based on environment
 * Supports both standalone and cluster/sentinel modes
 */


const getRedisConfig = () => {
  const config = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB || '0', 10),

    // Connection settings
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    lazyConnect: false,
    connectTimeout: 10000,
    commandTimeout: 5000,
    keepAlive: 30000,

    // Retry strategy with exponential backoff
    retryStrategy: (times) => {
      if (times > 10) {
        logger.error('Redis max retry attempts exceeded', { attempts: times });
        return null; // Stop retrying
      }
      const delay = Math.min(times * 50, 2000);
      logger.warn('Redis connection retry', { attempt: times, delay });
      return delay;
    },

    // Reconnect on error
    reconnectOnError: (err) => {
      const targetError = 'READONLY';
      if (err.message.includes(targetError)) {
        logger.warn('Redis reconnecting on READONLY error');
        return true;
      }
      return false;
    }
  };

  // Production: Support for Redis Sentinel
  if (process.env.NODE_ENV === 'production' && process.env.REDIS_SENTINELS) {
    try {
      const sentinels = JSON.parse(process.env.REDIS_SENTINELS);
      return {
        sentinels,
        name: process.env.REDIS_SENTINEL_NAME || 'mymaster',
        password: config.password,
        db: config.db,
        retryStrategy: config.retryStrategy,
        reconnectOnError: config.reconnectOnError,
        sentinelRetryStrategy: config.retryStrategy
      };
    } catch (error) {
      logger.error('Failed to parse REDIS_SENTINELS, using standalone mode', { error: error.message });
    }
  }

  // TLS/SSL support for production
  if (process.env.NODE_ENV === 'production' && process.env.REDIS_TLS === 'true') {
    config.tls = {
      rejectUnauthorized: process.env.REDIS_TLS_REJECT_UNAUTHORIZED !== 'false'
    };
  }

  return config;
};

/**
 * Create Redis client instance
 */


const client = new redis(getRedisConfig());

/**
 * Connection event handlers
 */
client.on('connect', () => {
  logger.info('Redis client connecting', {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    db: process.env.REDIS_DB || 0
  });
});

client.on('ready', () => {
  logger.info('Redis client ready to accept commands');
});

client.on('error', (error) => {
  logger.error('Redis client error', {
    error: error.message,
    code: error.code,
    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
  });
});

client.on('close', () => {
  logger.warn('Redis client connection closed');
});

client.on('reconnecting', (delay) => {
  logger.info('Redis client reconnecting', { delay });
});

client.on('end', () => {
  logger.info('Redis client connection ended');
});

/**
 * Generate namespaced key
 *
 * @param {string} prefix - Key prefix from KEY_PREFIXES
 * @param {string} identifier - Unique identifier for the key
 * @returns {string} Namespaced key
 */


const getKey = (prefix, identifier) => {
  if (!prefix || !identifier) {
    throw new Error('Both prefix and identifier are required');
  }
  return `${prefix}${identifier}`;
};

/**
 * Get TTL for a specific data type
 *
 * @param {string} type - Type of data (e.g., 'SESSION', 'CART_USER')
 * @param {boolean} isAuthenticated - Whether user is authenticated (for cart)
 * @returns {number} TTL in seconds
 */


const getTTL = (type, isAuthenticated = false) => {
  if (type === 'CART') {
    return isAuthenticated ? TTL_DEFAULTS.CART_USER : TTL_DEFAULTS.CART_GUEST;
  }
  return TTL_DEFAULTS[type] || 3600; // Default 1 hour
};

/**
 * Set value with automatic JSON serialization
 *
 * @param {string} key - Redis key
 * @param {any} value - Value to store
 * @param {number} ttl - Time to live in seconds
 * @returns {Promise<string>} Redis response
 */


const setWithTTL = async (key, value, ttl) => {
  try {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    if (ttl) {
      return await client.setex(key, ttl, serialized);
    }
    return await client.set(key, serialized);
  } catch (error) {
    logger.error('Redis setWithTTL failed', { key, error: error.message });
    throw error;
  }
};

/**
 * Get value with automatic JSON deserialization
 *
 * @param {string} key - Redis key
 * @param {boolean} parseJSON - Whether to parse as JSON
 * @returns {Promise<any>} Stored value or null
 */


const getWithParse = async (key, parseJSON = true) => {
  try {
    const value = await client.get(key);
    if (!value) return null;

    if (parseJSON) {
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    }
    return value;
  } catch (error) {
    logger.error('Redis getWithParse failed', { key, error: error.message });
    throw error;
  }
};

/**
 * Delete key(s)
 *
 * @param {string|string[]} keys - Key or array of keys to delete
 * @returns {Promise<number>} Number of keys deleted
 */


const deleteKeys = async (keys) => {
  try {
    const keyArray = Array.isArray(keys) ? keys : [keys];
    if (keyArray.length === 0) return 0;
    return await client.del(...keyArray);
  } catch (error) {
    logger.error('Redis deleteKeys failed', { keys, error: error.message });
    throw error;
  }
};

/**
 * Delete keys by pattern
 *
 * @param {string} pattern - Key pattern (e.g., 'cart:*')
 * @returns {Promise<number>} Number of keys deleted
 */


const deleteByPattern = async (pattern) => {
  try {
    const keys = await client.keys(pattern);
    if (keys.length === 0) return 0;
    return await client.del(...keys);
  } catch (error) {
    logger.error('Redis deleteByPattern failed', { pattern, error: error.message });
    throw error;
  }
};

/**
 * Check if Redis is healthy
 *
 * @returns {Promise<boolean>} True if Redis is responsive
 */


const isHealthy = async () => {
  try {
    const result = await client.ping();
    return result === 'PONG';
  } catch (error) {
    logger.error('Redis health check failed', { error: error.message });
    return false;
  }
};

/**
 * Get Redis info
 *
 * @returns {Promise<object>} Redis server info
 */


const getInfo = async () => {
  try {
    const info = await client.info();
    const dbSize = await client.dbsize();
    return {
      connected: client.status === 'ready',
      dbSize,
      info: info.split('\r\n').reduce((acc, line) => {
        const [key, value] = line.split(':');
        if (key && value) acc[key] = value;
        return acc;
      }, {})
    };
  } catch (error) {
    logger.error('Redis getInfo failed', { error: error.message });
    return { connected: false, error: error.message };
  }
};

/**
 * Gracefully disconnect from Redis
 *
 * @returns {Promise<void>}
 */


const disconnect = async () => {
  try {
    logger.info('Disconnecting Redis client');
    await client.quit();
    logger.info('Redis client disconnected successfully');
  } catch (error) {
    logger.error('Error disconnecting Redis client', { error: error.message });
    // Force disconnect if graceful quit fails
    client.disconnect();
  }
};

/**
 * Increment counter with TTL
 *
 * @param {string} key - Redis key
 * @param {number} ttl - Time to live in seconds
 * @returns {Promise<number>} New counter value
 */


const incrementWithTTL = async (key, ttl) => {
  try {
    const value = await client.incr(key);
    if (value === 1 && ttl) {
      await client.expire(key, ttl);
    }
    return value;
  } catch (error) {
    logger.error('Redis incrementWithTTL failed', { key, error: error.message });
    throw error;
  }
};

/**
 * Acquire distributed lock
 *
 * @param {string} lockKey - Lock key
 * @param {number} ttl - Lock TTL in seconds
 * @param {string} lockValue - Unique lock value
 * @returns {Promise<boolean>} True if lock acquired
 */


const acquireLock = async (lockKey, ttl, lockValue) => {
  try {
    const result = await client.set(lockKey, lockValue, 'EX', ttl, 'NX');
    return result === 'OK';
  } catch (error) {
    logger.error('Redis acquireLock failed', { lockKey, error: error.message });
    return false;
  }
};

/**
 * Release distributed lock
 *
 * @param {string} lockKey - Lock key
 * @param {string} lockValue - Lock value to verify ownership
 * @returns {Promise<boolean>} True if lock released
 */


const releaseLock = async (lockKey, lockValue) => {
  try {
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;
    const result = await client.eval(script, 1, lockKey, lockValue);
    return result === 1;
  } catch (error) {
    logger.error('Redis releaseLock failed', { lockKey, error: error.message });
    return false;
  }
};

// Export Redis client and utilities
module.exports = {
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
  disconnect,
  incrementWithTTL,
  acquireLock,
  releaseLock
};
