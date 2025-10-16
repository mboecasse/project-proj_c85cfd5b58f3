// File: src/models/index.js
// Generated: 2025-10-16 10:39:17 UTC
// Project ID: proj_c85cfd5b58f3
// Task ID: task_fgg2m8frmzkd


const logger = require('../utils/logger');

async * This file aggregates all models for easy importing throughout the application.
 *
 * Usage:
 *   const { User, Product, Order } = require('./models');
 *   or
 *   const models = require('./models');
 *   const user = await models.User.findById(userId);
 */

// Import all models in dependency order
// Independent models first, then models with references

let User, Product, Category, Cart, Order, OrderItem, Payment;

try {
  // Independent models
  User = require('./User');
  Category = require('./Category');

  // Product model (references Category)
  Product = require('./Product');

  // Cart model (references User)
  Cart = require('./Cart');

  // Order models (reference User and Product)
  Order = require('./Order');
  OrderItem = require('./OrderItem');

  // Payment model (references Order and User)
  Payment = require('./Payment');

  logger.info('All models loaded successfully');
} catch (error) {
  logger.error('Error loading models', {
    error: error.message,
    stack: error.stack
  });
  throw new Error(`Failed to initialize models: ${error.message}`);
}

/**
 * Exported models object
 * All Mongoose models are available through this single export
 */
module.exports = {
  User,
  Product,
  Category,
  Cart,
  Order,
  OrderItem,
  Payment
};
