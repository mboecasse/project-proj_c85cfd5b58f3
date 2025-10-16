// File: src/services/inventory.service.js
// Generated: 2025-10-16 10:52:54 UTC
// Project ID: proj_c85cfd5b58f3
// Task ID: task_78473b8jtiny


const Product = require('../models/Product');


const logger = require('../utils/logger');


const mongoose = require('mongoose');

/**
 * Inventory Service
 * Manages product stock levels, reservations, and inventory operations
 */
class InventoryService {
  /**
   * Check stock availability for a product
   * @param {string} productId - Product ID
   * @param {number} quantity - Quantity to check
   * @param {string|null} variantId - Optional variant ID
   * @returns {Promise<Object>} Availability status and current stock
   */
  async checkAvailability(productId, quantity, variantId = null) {
    try {
      const product = await Product.findById(productId);

      if (!product) {
        logger.warn('Product not found for availability check', { productId });
        return { available: false, currentStock: 0 };
      }

      let currentStock = 0;

      if (variantId && product.variants && product.variants.length > 0) {
        const variant = product.variants.find(v => v._id.toString() === variantId);
        if (!variant) {
          logger.warn('Variant not found', { productId, variantId });
          return { available: false, currentStock: 0 };
        }
        currentStock = variant.stock || 0;
      } else {
        currentStock = product.stock || 0;
      }

      const available = currentStock >= quantity;

      logger.info('Stock availability checked', {
        productId,
        variantId,
        quantity,
        currentStock,
        available
      });

      return { available, currentStock };
    } catch (error) {
      logger.error('Failed to check stock availability', {
        productId,
        variantId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Reserve stock during checkout (temporary hold)
   * @param {string} productId - Product ID
   * @param {number} quantity - Quantity to reserve
   * @param {string} orderId - Order ID for tracking
   * @param {string|null} variantId - Optional variant ID
   * @param {number} expiresIn - Expiration time in milliseconds (default 15 minutes)
   * @returns {Promise<Object>} Reservation details
   */
  async reserveStock(productId, quantity, orderId, variantId = null, expiresIn = 900000) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const product = await Product.findById(productId).session(session);

      if (!product) {
        throw new Error('Product not found');
      }

      // Check availability atomically within transaction
      let currentStock = 0;
      if (variantId && product.variants && product.variants.length > 0) {
        const variant = product.variants.find(v => v._id.toString() === variantId);
        if (!variant) {
          throw new Error('Variant not found');
        }
        currentStock = variant.stock || 0;
      } else {
        currentStock = product.stock || 0;
      }

      // Calculate active reservations
      let reservedStock = 0;
      if (product.reservations && product.reservations.length > 0) {
        const activeReservations = product.reservations.filter(r => {
          return r.status === 'active' &&
                 new Date() <= r.expiresAt &&
                 (!variantId || r.variantId === variantId);
        });
        reservedStock = activeReservations.reduce((sum, r) => sum + r.quantity, 0);
      }

      const availableStock = currentStock - reservedStock;

      if (availableStock < quantity) {
        throw new Error(`Insufficient stock. Available: ${availableStock}, Requested: ${quantity}`);
      }

      const expiresAt = new Date(Date.now() + expiresIn);
      const reservationId = `res_${orderId}_${Date.now()}`;

      // Initialize reservations array if not exists
      if (!product.reservations) {
        product.reservations = [];
      }

      // Add reservation
      product.reservations.push({
        reservationId,
        orderId,
        variantId,
        quantity,
        expiresAt,
        status: 'active'
      });

      await product.save({ session });
      await session.commitTransaction();

      logger.info('Stock reserved', {
        productId,
        variantId,
        orderId,
        quantity,
        reservationId,
        expiresAt
      });

      return {
        success: true,
        reservationId,
        expiresAt
      };
    } catch (error) {
      await session.abortTransaction();
      logger.error('Failed to reserve stock', {
        productId,
        variantId,
        orderId,
        quantity,
        error: error.message
      });
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Confirm reservation and deduct from stock
   * @param {string} reservationId - Reservation ID
   * @returns {Promise<Object>} Confirmation result
   */
  async confirmReservation(reservationId) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const product = await Product.findOne({
        'reservations.reservationId': reservationId
      }).session(session);

      if (!product) {
        throw new Error('Reservation not found');
      }

      const reservation = product.reservations.find(r => r.reservationId === reservationId);

      if (!reservation) {
        throw new Error('Reservation not found');
      }

      if (reservation.status !== 'active') {
        throw new Error(`Reservation already ${reservation.status}`);
      }

      if (new Date() > reservation.expiresAt) {
        throw new Error('Reservation has expired');
      }

      // Deduct stock
      if (reservation.variantId) {
        const variant = product.variants.find(v => v._id.toString() === reservation.variantId);
        if (variant) {
          variant.stock -= reservation.quantity;
        }
      } else {
        product.stock -= reservation.quantity;
      }

      // Mark reservation as confirmed
      reservation.status = 'confirmed';

      await product.save({ session });
      await session.commitTransaction();

      logger.info('Reservation confirmed and stock deducted', {
        reservationId,
        productId: product._id,
        variantId: reservation.variantId,
        quantity: reservation.quantity
      });

      return {
        success: true,
        message: 'Reservation confirmed and stock deducted'
      };
    } catch (error) {
      await session.abortTransaction();
      logger.error('Failed to confirm reservation', {
        reservationId,
        error: error.message
      });
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Release reserved stock (cancelled or expired orders)
   * @param {string} reservationId - Reservation ID
   * @returns {Promise<Object>} Release result
   */
  async releaseReservation(reservationId) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const product = await Product.findOne({
        'reservations.reservationId': reservationId
      }).session(session);

      if (!product) {
        throw new Error('Reservation not found');
      }

      const reservation = product.reservations.find(r => r.reservationId === reservationId);

      if (!reservation) {
        throw new Error('Reservation not found');
      }

      if (reservation.status === 'released') {
        await session.commitTransaction();
        return {
          success: true,
          message: 'Reservation already released'
        };
      }

      // Mark reservation as released
      reservation.status = 'released';

      await product.save({ session });
      await session.commitTransaction();

      logger.info('Reservation released', {
        reservationId,
        productId: product._id,
        variantId: reservation.variantId,
        quantity: reservation.quantity
      });

      return {
        success: true,
        message: 'Reservation released'
      };
    } catch (error) {
      await session.abortTransaction();
      logger.error('Failed to release reservation', {
        reservationId,
        error: error.message
      });
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Direct stock deduction for confirmed orders
   * @param {string} productId - Product ID
   * @param {number} quantity - Quantity to deduct
   * @param {string} orderId - Order ID for tracking
   * @param {string|null} variantId - Optional variant ID
   * @returns {Promise<Object>} Deduction result
   */
  async deductStock(productId, quantity, orderId, variantId = null) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const product = await Product.findById(productId).session(session);

      if (!product) {
        throw new Error('Product not found');
      }

      // Check availability atomically
      let currentStock = 0;
      if (variantId) {
        const variant = product.variants.find(v => v._id.toString() === variantId);
        if (!variant) {
          throw new Error('Variant not found');
        }
        currentStock = variant.stock || 0;
      } else {
        currentStock = product.stock || 0;
      }

      if (currentStock < quantity) {
        throw new Error(`Insufficient stock. Available: ${currentStock}, Requested: ${quantity}`);
      }

      // Deduct stock
      if (variantId) {
        const variant = product.variants.find(v => v._id.toString() === variantId);
        variant.stock -= quantity;
      } else {
        product.stock -= quantity;
      }

      // Add to stock history
      if (!product.stockHistory) {
        product.stockHistory = [];
      }

      product.stockHistory.push({
        type: 'deduction',
        quantity,
        reason: `Order ${orderId}`,
        variantId,
        date: new Date()
      });

      await product.save({ session });
      await session.commitTransaction();

      const remainingStock = variantId
        ? product.variants.find(v => v._id.toString() === variantId).stock
        : product.stock;

      logger.info('Stock deducted', {
        productId,
        variantId,
        orderId,
        quantity
      });

      return {
        success: true,
        message: 'Stock deducted successfully',
        remainingStock
      };
    } catch (error) {
      await session.abortTransaction();
      logger.error('Failed to deduct stock', {
        productId,
        variantId,
        orderId,
        quantity,
        error: error.message
      });
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Add stock (restocking)
   * @param {string} productId - Product ID
   * @param {number} quantity - Quantity to add
   * @param {string} reason - Reason for adding stock
   * @param {string|null} variantId - Optional variant ID
   * @returns {Promise<Object>} Addition result
   */
  async addStock(productId, quantity, reason, variantId = null) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const product = await Product.findById(productId).session(session);

      if (!product) {
        throw new Error('Product not found');
      }

      // Add stock
      if (variantId) {
        const variant = product.variants.find(v => v._id.toString() === variantId);
        if (!variant) {
          throw new Error('Variant not found');
        }
        variant.stock += quantity;
      } else {
        product.stock += quantity;
      }

      // Add to stock history
      if (!product.stockHistory) {
        product.stockHistory = [];
      }

      product.stockHistory.push({
        type: 'addition',
        quantity,
        reason,
        variantId,
        date: new Date()
      });

      await product.save({ session });
      await session.commitTransaction();

      const newStock = variantId
        ? product.variants.find(v => v._id.toString() === variantId).stock
        : product.stock;

      logger.info('Stock added', {
        productId,
        variantId,
        quantity,
        reason
      });

      return {
        success: true,
        message: 'Stock added successfully',
        newStock
      };
    } catch (error) {
      await session.abortTransaction();
      logger.error('Failed to add stock', {
        productId,
        variantId,
        quantity,
        reason,
        error: error.message
      });
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Get current stock levels
   * @param {string} productId - Product ID
   * @param {string|null} variantId - Optional variant ID
   * @returns {Promise<Object>} Stock level details
   */
  async getStockLevel(productId, variantId = null) {
    try {
      const product = await Product.findById(productId);

      if (!product) {
        throw new Error('Product not found');
      }

      let available = 0;
      let reserved = 0;

      if (variantId) {
        const variant = product.variants.find(v => v._id.toString() === variantId);
        if (!variant) {
          throw new Error('Variant not found');
        }
        available = variant.stock || 0;
      } else {
        available = product.stock || 0;
      }

      // Calculate reserved stock
      if (product.reservations && product.reservations.length > 0) {
        const activeReservations = product.reservations.filter(r => {
          return r.status === 'active' &&
                 new Date() <= r.expiresAt &&
                 (!variantId || r.variantId === variantId);
        });

        reserved = activeReservations.reduce((sum, r) => sum + r.quantity, 0);
      }

      const total = available + reserved;

      logger.info('Stock level retrieved', {
        productId,
        variantId,
        available,
        reserved,
        total
      });

      return {
        productId,
        variantId,
        available,
        reserved,
        total
      };
    } catch (error) {
      logger.error('Failed to get stock level', {
        productId,
        variantId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Find products below stock threshold
   * @param {number} threshold - Stock threshold (default 10)
   * @returns {Promise<Array>} Products with low stock
   */
  async getLowStockProducts(threshold = 10) {
    try {
      const products = await Product.find({
        $or: [
          { stock: { $lte: threshold } },
          { 'variants.stock': { $lte: threshold } }
        ],
        isActive: true
      }).select('name slug stock variants.name variants.stock');

      const lowStockProducts = [];

      for (const product of products) {
        // Check main product stock
        if (product.stock <= threshold) {
          lowStockProducts.push({
            productId: product._id,
            name: product.name,
            slug: product.slug,
            variantId: null,
            variantName: null,
            currentStock: product.stock,
            threshold
          });
        }

        // Check variant stocks
        if (product.variants && product.variants.length > 0) {
          for (const variant of product.variants) {
            if (variant.stock <= threshold) {
              lowStockProducts.push
