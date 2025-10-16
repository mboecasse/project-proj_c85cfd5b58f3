// File: src/utils/orderNumber.js
// Generated: 2025-10-16 10:40:33 UTC
// Project ID: proj_c85cfd5b58f3
// Task ID: task_vi7t2o5hqbeh


const logger = require('./logger');


const mongoose = require('mongoose');

/**
 * Counter Schema for Order Number Sequence
 * Uses atomic operations to ensure unique order numbers
 */


const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true }, // Format: order_sequence_YYYYMMDD
  sequence: { type: Number, default: 0 },
  date: { type: String, required: true }, // YYYYMMDD format
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Create Counter model if not exists


const Counter = mongoose.models.Counter || mongoose.model('Counter', counterSchema);

/**
 * Configuration for order number generation
 */


const config = {
  PREFIX: process.env.ORDER_NUMBER_PREFIX || 'ORD',
  SEQUENCE_LENGTH: parseInt(process.env.ORDER_SEQUENCE_LENGTH || '5', 10),
  MAX_DAILY_ORDERS: parseInt(process.env.ORDER_MAX_DAILY_ORDERS || '99999', 10),
  MAX_RETRIES: parseInt(process.env.ORDER_GENERATION_MAX_RETRIES || '3', 10)
};

/**
 * Get current date string in YYYYMMDD format
 * Cached for performance (changes only once per day)
 */

let cachedDateString = null;

let cachedDate = null;


function getCurrentDateString() {
  const now = new Date();
  const today = now.toISOString().split('T')[0];

  if (cachedDate !== today) {
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    cachedDateString = `${year}${month}${day}`;
    cachedDate = today;
  }

  return cachedDateString;
}

/**
 * Get next sequence number for current date using atomic operation
 * @returns {Promise<number>} Next sequence number
 * @throws {Error} If sequence overflow or database error
 */
async function getNextSequence() {
  const dateString = getCurrentDateString();
  const counterId = `order_sequence_${dateString}`;

  try {
    const counter = await Counter.findOneAndUpdate(
      { _id: counterId },
      {
        $inc: { sequence: 1 },
        $setOnInsert: { date: dateString, createdAt: new Date() },
        $set: { updatedAt: new Date() }
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true
      }
    );

    if (counter.sequence > config.MAX_DAILY_ORDERS) {
      logger.error('Order sequence overflow', {
        date: dateString,
        sequence: counter.sequence,
        maxAllowed: config.MAX_DAILY_ORDERS
      });
      throw new Error(`Daily order limit exceeded (${config.MAX_DAILY_ORDERS} orders per day)`);
    }

    return counter.sequence;
  } catch (error) {
    logger.error('Failed to get next sequence', {
      counterId,
      error: error.message
    });
    throw error;
  }
}

/**
 * Format sequence number with zero padding
 * @param {number} sequence - Sequence number to format
 * @returns {string} Zero-padded sequence string
 */


function formatSequence(sequence) {
  return String(sequence).padStart(config.SEQUENCE_LENGTH, '0');
}

/**
 * Generate a new unique order number
 * Format: PREFIX-YYYYMMDD-XXXXX (e.g., ORD-20240115-00001)
 * @returns {Promise<string>} Generated order number
 * @throws {Error} If generation fails after max retries
 */
async function generateOrderNumber() {
  let lastError = null;

  for (let attempt = 1; attempt <= config.MAX_RETRIES; attempt++) {
    try {
      const dateString = getCurrentDateString();
      const sequence = await getNextSequence();
      const formattedSequence = formatSequence(sequence);
      const orderNumber = `${config.PREFIX}-${dateString}-${formattedSequence}`;

      logger.info('Generated order number', {
        orderNumber,
        sequence,
        date: dateString,
        attempt
      });

      return orderNumber;
    } catch (error) {
      lastError = error;
      logger.warn('Order number generation attempt failed', {
        attempt,
        maxRetries: config.MAX_RETRIES,
        error: error.message
      });

      if (attempt < config.MAX_RETRIES) {
        // Exponential backoff: 100ms, 200ms, 400ms
        const delay = Math.pow(2, attempt - 1) * 100;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  logger.error('Order number generation failed after all retries', {
    maxRetries: config.MAX_RETRIES,
    error: lastError.message
  });

  throw new Error(`Failed to generate order number after ${config.MAX_RETRIES} attempts: ${lastError.message}`);
}

/**
 * Validate order number format
 * @param {string} orderNumber - Order number to validate
 * @returns {boolean} True if valid format
 */


function isValidOrderNumber(orderNumber) {
  if (!orderNumber || typeof orderNumber !== 'string') {
    return false;
  }

  // Format: PREFIX-YYYYMMDD-XXXXX
  const pattern = new RegExp(
    `^${config.PREFIX}-\\d{8}-\\d{${config.SEQUENCE_LENGTH}}$`
  );

  if (!pattern.test(orderNumber)) {
    return false;
  }

  // Validate date component
  const parts = orderNumber.split('-');
  if (parts.length !== 3) {
    return false;
  }

  const dateString = parts[1];
  const year = parseInt(dateString.substring(0, 4), 10);
  const month = parseInt(dateString.substring(4, 6), 10);
  const day = parseInt(dateString.substring(6, 8), 10);

  // Basic date validation
  if (year < 2000 || year > 2100) {
    return false;
  }

  if (month < 1 || month > 12) {
    return false;
  }

  if (day < 1 || day > 31) {
    return false;
  }

  // Validate sequence is within bounds
  const sequence = parseInt(parts[2], 10);
  if (sequence < 1 || sequence > config.MAX_DAILY_ORDERS) {
    return false;
  }

  return true;
}

/**
 * Parse order number components
 * @param {string} orderNumber - Order number to parse
 * @returns {Object|null} {prefix, date, sequence, year, month, day} or null if invalid
 */


function parseOrderNumber(orderNumber) {
  if (!isValidOrderNumber(orderNumber)) {
    logger.warn('Attempted to parse invalid order number', { orderNumber });
    return null;
  }

  const parts = orderNumber.split('-');
  const dateString = parts[1];
  const sequenceString = parts[2];

  return {
    prefix: parts[0],
    date: dateString,
    sequence: parseInt(sequenceString, 10),
    year: parseInt(dateString.substring(0, 4), 10),
    month: parseInt(dateString.substring(4, 6), 10),
    day: parseInt(dateString.substring(6, 8), 10),
    fullDate: new Date(
      parseInt(dateString.substring(0, 4), 10),
      parseInt(dateString.substring(4, 6), 10) - 1,
      parseInt(dateString.substring(6, 8), 10)
    )
  };
}

/**
 * Reset daily sequence (for maintenance/testing)
 * WARNING: Use with caution - can cause duplicate order numbers if used incorrectly
 * @param {string} dateString - Date in YYYYMMDD format (optional, defaults to today)
 * @returns {Promise<void>}
 */
async function resetDailySequence(dateString = null) {
  const targetDate = dateString || getCurrentDateString();
  const counterId = `order_sequence_${targetDate}`;

  try {
    await Counter.findByIdAndUpdate(
      counterId,
      { sequence: 0, updatedAt: new Date() },
      { upsert: true }
    );

    logger.warn('Daily sequence reset', {
      date: targetDate,
      counterId
    });
  } catch (error) {
    logger.error('Failed to reset daily sequence', {
      date: targetDate,
      error: error.message
    });
    throw error;
  }
}

/**
 * Get current sequence count for a date (for monitoring)
 * @param {string} dateString - Date in YYYYMMDD format (optional, defaults to today)
 * @returns {Promise<number>} Current sequence count
 */
async function getCurrentSequence(dateString = null) {
  const targetDate = dateString || getCurrentDateString();
  const counterId = `order_sequence_${targetDate}`;

  try {
    const counter = await Counter.findById(counterId);
    return counter ? counter.sequence : 0;
  } catch (error) {
    logger.error('Failed to get current sequence', {
      date: targetDate,
      error: error.message
    });
    throw error;
  }
}

/**
 * Get order number statistics (for monitoring/analytics)
 * @returns {Promise<Object>} Statistics object
 */
async function getOrderNumberStats() {
  try {
    const dateString = getCurrentDateString();
    const currentSequence = await getCurrentSequence(dateString);

    return {
      date: dateString,
      currentSequence,
      maxDailyOrders: config.MAX_DAILY_ORDERS,
      remainingCapacity: config.MAX_DAILY_ORDERS - currentSequence,
      utilizationPercentage: ((currentSequence / config.MAX_DAILY_ORDERS) * 100).toFixed(2),
      prefix: config.PREFIX,
      sequenceLength: config.SEQUENCE_LENGTH
    };
  } catch (error) {
    logger.error('Failed to get order number stats', {
      error: error.message
    });
    throw error;
  }
}

module.exports = {
  generateOrderNumber,
  isValidOrderNumber,
  parseOrderNumber,
  resetDailySequence,
  getCurrentSequence,
  getOrderNumberStats
};
