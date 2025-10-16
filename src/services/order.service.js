// File: src/services/order.service.js
// Generated: 2025-10-16 10:57:08 UTC
// Project ID: proj_c85cfd5b58f3
// Task ID: task_kdf3coy2bpqo


const CartService = require('./cart.service');


const InventoryService = require('./inventory.service');


const Order = require('../models/Order');


const OrderItem = require('../models/OrderItem');


const Product = require('../models/Product');


const emailService = require('./email.service');


const logger = require('../utils/logger');


const mongoose = require('mongoose');

/**
 * Order Service
 * Handles order creation, management, and business logic
 */
class OrderServiceClass {
  constructor() {
    this.cartService = new CartService();
    this.inventoryService = new InventoryService();
  }

  /**
   * Create a new order from user's cart
   * @param {string} userId - User ID
   * @param {Object} orderData - Order data (shippingAddress, billingAddress, paymentMethod)
   * @returns {Promise<Object>} Created order
   */
  async createOrder(userId, orderData) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Get user's cart
      const cart = await this.cartService.getCart(userId);

      if (!cart || !cart.items || cart.items.length === 0) {
        throw new Error('Cart is empty');
      }

      // Validate and calculate order totals
      const validatedItems = await this.validateAndCalculateOrder(cart.items, session);

      // Reserve inventory for all items with session for transactional consistency
      const reservations = [];
      for (const item of validatedItems) {
        try {
          await this.inventoryService.reserveStock(item.product._id, item.quantity, session);
          reservations.push({ productId: item.product._id, quantity: item.quantity });
        } catch (error) {
          // Release already reserved stock within transaction
          for (const reservation of reservations) {
            await this.inventoryService.releaseReservation(reservation.productId, reservation.quantity, session);
          }
          throw new Error(`Insufficient stock for product: ${item.product.name}`);
        }
      }

      // Calculate pricing
      const subtotal = validatedItems.reduce((sum, item) => sum + item.finalPrice, 0);
      const shipping = this.calculateShipping(subtotal);
      const tax = subtotal * 0.1; // 10% tax
      const discount = cart.discount || 0;
      const total = subtotal + shipping + tax - discount;

      // Generate order number
      const orderNumber = await this.generateOrderNumber();

      // Create order
      const orderDoc = new Order({
        orderNumber,
        user: userId,
        items: [],
        pricing: {
          subtotal,
          shipping,
          tax,
          discount,
          total
        },
        status: 'pending',
        payment: {
          method: orderData.paymentMethod || 'pending',
          status: 'pending'
        },
        shippingAddress: orderData.shippingAddress,
        billingAddress: orderData.billingAddress || orderData.shippingAddress,
        promoCode: cart.promoCode || null
      });

      await orderDoc.save({ session });

      // Create order items
      const orderItems = [];
      for (const item of validatedItems) {
        const orderItem = new OrderItem({
          order: orderDoc._id,
          product: item.product._id,
          productSnapshot: {
            name: item.product.name,
            sku: item.product.sku,
            description: item.product.description,
            images: item.product.images
          },
          quantity: item.quantity,
          price: item.product.price,
          discount: item.discount || 0,
          tax: item.product.price * item.quantity * 0.1,
          finalPrice: item.finalPrice
        });

        await orderItem.save({ session });
        orderItems.push(orderItem);
      }

      orderDoc.items = orderItems.map(item => item._id);
      await orderDoc.save({ session });

      // Confirm inventory reservations within transaction
      for (const reservation of reservations) {
        await this.inventoryService.confirmReservation(reservation.productId, reservation.quantity, session);
      }

      // Clear user's cart within transaction
      await this.cartService.clearCart(userId, session);

      await session.commitTransaction();

      logger.info('Order created successfully', {
        orderId: orderDoc._id,
        orderNumber: orderDoc.orderNumber,
        userId,
        total
      });

      // Send order confirmation email (async, don't wait)
      this.sendOrderConfirmation(orderDoc).catch(error => {
        logger.error('Failed to send order confirmation email', {
          orderId: orderDoc._id,
          error: error.message
        });
      });

      // Populate order for response
      const populatedOrder = await Order.findById(orderDoc._id)
        .populate('user', 'name email')
        .populate({
          path: 'items',
          populate: { path: 'product', select: 'name sku images' }
        });

      return populatedOrder;
    } catch (error) {
      await session.abortTransaction();
      logger.error('Failed to create order', {
        userId,
        error: error.message,
        stack: error.stack
      });
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Validate cart items and calculate totals
   * @param {Array} items - Cart items
   * @param {Object} session - Mongoose session for transaction
   * @returns {Promise<Array>} Validated items with calculated prices
   */
  async validateAndCalculateOrder(items, session) {
    const validatedItems = [];

    for (const item of items) {
      // Fetch fresh product data with session and lock for update
      const product = await Product.findById(item.product).session(session);

      if (!product) {
        throw new Error(`Product not found: ${item.product}`);
      }

      if (!product.isActive) {
        throw new Error(`Product is no longer available: ${product.name}`);
      }

      // Check stock availability
      const canPurchase = await product.canPurchase(item.quantity);
      if (!canPurchase) {
        throw new Error(`Insufficient stock for product: ${product.name}`);
      }

      // Calculate item pricing
      const discount = product.calculateDiscount();
      const itemPrice = discount.amount > 0 ? product.price - discount.amount : product.price;
      const finalPrice = itemPrice * item.quantity;

      validatedItems.push({
        product,
        quantity: item.quantity,
        price: product.price,
        discount: discount.amount * item.quantity,
        finalPrice
      });
    }

    return validatedItems;
  }

  /**
   * Update order status
   * @param {string} orderId - Order ID
   * @param {string} newStatus - New status
   * @param {Object} metadata - Additional metadata (note, updatedBy)
   * @returns {Promise<Object>} Updated order
   */
  async updateOrderStatus(orderId, newStatus, metadata = {}) {
    try {
      const order = await Order.findById(orderId);

      if (!order) {
        throw new Error('Order not found');
      }

      // Validate status transition
      const validTransitions = order.getValidStatusTransitions();
      if (!validTransitions.includes(newStatus)) {
        throw new Error(`Invalid status transition from ${order.status} to ${newStatus}`);
      }

      // Update status
      await order.updateStatus(newStatus, metadata.note, metadata.updatedBy);

      logger.info('Order status updated', {
        orderId,
        oldStatus: order.status,
        newStatus,
        updatedBy: metadata.updatedBy
      });

      // Send status notification email
      await this.sendStatusNotification(order, newStatus);

      return order;
    } catch (error) {
      logger.error('Failed to update order status', {
        orderId,
        newStatus,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Cancel an order
   * @param {string} orderId - Order ID
   * @param {string} reason - Cancellation reason
   * @returns {Promise<Object>} Cancelled order
   */
  async cancelOrder(orderId, reason) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const order = await Order.findById(orderId).populate('items').session(session);

      if (!order) {
        throw new Error('Order not found');
      }

      if (!order.canBeCancelled()) {
        throw new Error(`Order cannot be cancelled in ${order.status} status`);
      }

      // Release inventory for all items within transaction
      const orderItems = await OrderItem.find({ order: orderId }).session(session);
      for (const item of orderItems) {
        await this.inventoryService.releaseReservation(item.product, item.quantity, session);
      }

      // Cancel order
      await order.cancel(reason);
      await order.save({ session });

      await session.commitTransaction();

      logger.info('Order cancelled', {
        orderId,
        reason
      });

      // Send cancellation notification
      await emailService.queueEmail({
        type: 'order_cancelled',
        recipient: order.user.email,
        data: {
          orderNumber: order.orderNumber,
          reason
        }
      });

      return order;
    } catch (error) {
      await session.abortTransaction();
      logger.error('Failed to cancel order', {
        orderId,
        error: error.message
      });
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Get order by ID
   * @param {string} orderId - Order ID
   * @param {string} userId - User ID (for authorization)
   * @returns {Promise<Object>} Order
   */
  async getOrderById(orderId, userId) {
    try {
      const order = await Order.findById(orderId)
        .populate('user', 'name email')
        .populate({
          path: 'items',
          populate: { path: 'product', select: 'name sku images price' }
        });

      if (!order) {
        throw new Error('Order not found');
      }

      // Check authorization
      if (order.user._id.toString() !== userId.toString()) {
        throw new Error('Unauthorized access to order');
      }

      return order;
    } catch (error) {
      logger.error('Failed to fetch order', {
        orderId,
        userId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get user's orders with pagination and filtering
   * @param {string} userId - User ID
   * @param {Object} options - Query options (page, limit, status, sortBy)
   * @returns {Promise<Object>} Orders with pagination info
   */
  async getUserOrders(userId, options = {}) {
    try {
      const {
        page = 1,
        limit = 10,
        status,
        sortBy = '-createdAt'
      } = options;

      const query = { user: userId };
      if (status) {
        query.status = status;
      }

      const skip = (page - 1) * limit;

      const [orders, total] = await Promise.all([
        Order.find(query)
          .populate({
            path: 'items',
            populate: { path: 'product', select: 'name sku images price' }
          })
          .sort(sortBy)
          .skip(skip)
          .limit(limit),
        Order.countDocuments(query)
      ]);

      logger.info('Fetched user orders', {
        userId,
        page,
        limit,
        total
      });

      return {
        orders,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logger.error('Failed to fetch user orders', {
        userId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Generate unique order number
   * @returns {Promise<string>} Order number
   */
  async generateOrderNumber() {
    const prefix = 'ORD';
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();

    let orderNumber = `${prefix}-${timestamp}-${random}`;

    // Ensure uniqueness
    let exists = await Order.findOne({ orderNumber });
    while (exists) {
      const newRandom = Math.random().toString(36).substring(2, 6).toUpperCase();
      orderNumber = `${prefix}-${timestamp}-${newRandom}`;
      exists = await Order.findOne({ orderNumber });
    }

    return orderNumber;
  }

  /**
   * Calculate shipping cost based on subtotal
   * @param {number} subtotal - Order subtotal
   * @returns {number} Shipping cost
   */
  calculateShipping(subtotal) {
    if (subtotal >= 100) {
      return 0; // Free shipping over $100
    } else if (subtotal >= 50) {
      return 5; // $5 shipping for $50-$100
    } else {
      return 10; // $10 shipping under $50
    }
  }

  /**
   * Validate status transition
   * @param {string} currentStatus - Current status
   * @param {string} newStatus - New status
   * @returns {boolean} Is valid transition
   */
  validateStatusTransition(currentStatus, newStatus) {
    const validTransitions = {
      pending: ['processing', 'cancelled'],
      processing: ['shipped', 'cancelled'],
      shipped: ['delivered', 'returned'],
      delivered: ['returned'],
      cancelled: [],
      returned: []
    };

    return validTransitions[currentStatus]?.includes(newStatus) || false;
  }

  /**
   * Send order status notification email
   * @param {Object} order - Order object
   * @param {string} status - New status
   * @returns {Promise<void>}
   */
  async sendStatusNotification(order, status) {
    try {
      const emailTypes = {
        processing: 'order_processing',
        shipped: 'order_shipped',
        delivered: 'order_delivered',
        cancelled: 'order_cancelled'
      };

      const emailType = emailTypes[status];
      if (!emailType) {
        return;
      }

      await emailService.queueEmail({
        type: emailType,
        recipient: order.user.email,
        data: {
          orderNumber: order.orderNumber,
          status,
          trackingNumber: order.tracking?.trackingNumber
        }
      });

      logger.info('Order status notification queued', {
        orderId: order._id,
        status,
        emailType
      });
    } catch (error) {
      logger.error('Failed to queue status notification', {
        orderId: order._id,
        status,
        error: error.message
      });
    }
  }

  /**
   * Send order confirmation email
   * @param {Object} order - Order object
   * @returns {Promise<void>}
   */
  async sendOrderConfirmation(order) {
    try {
      const populatedOrder = await Order.findById(order._id)
        .populate('user', 'name email')
        .populate({
          path: 'items',
          populate: { path: 'product', select: 'name sku images price' }
        });

      await emailService.sendOrderConfirmation(
        populatedOrder.user.email,
        {
          orderNumber: populatedOrder.orderNumber,
          items: populatedOrder.items,
          pricing: populatedOrder.pricing,
          shippingAddress: populatedOrder.shippingAddress
        }
      );

      logger.info('Order confirmation email sent', {
        orderId: order._id,
        orderNumber: order.orderNumber
      });
    } catch (error) {
      logger.error('
