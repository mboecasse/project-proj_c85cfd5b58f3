// File: src/controllers/order.controller.js
// Generated: 2025-10-16 10:52:12 UTC
// Project ID: proj_c85cfd5b58f3
// Task ID: task_uoa0nxc2myp5


const ApiResponse = require('../utils/response');


const Cart = require('../models/Cart');


const Order = require('../models/Order');


const Product = require('../models/Product');


const logger = require('../utils/logger');


const mongoose = require('mongoose');

/**
 * Order Controller
 * Handles all order-related operations
 */
class OrderController {
  /**
   * Create a new order
   * POST /api/orders
   */
  async createOrder(req, res, next) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const userId = req.userId;
      const { shippingAddress, paymentMethod, couponCode } = req.body;

      // Fetch user's cart
      const cart = await Cart.findOne({ user: userId }).populate('items.product').session(session);

      if (!cart || cart.items.length === 0) {
        await session.abortTransaction();
        session.endSession();
        return ApiResponse.error(res, 'Cart is empty', 400);
      }

      // Validate stock availability and lock prices
      const orderItems = [];
      let subtotal = 0;

      for (const item of cart.items) {
        const product = await Product.findById(item.product._id).session(session);

        if (!product) {
          await session.abortTransaction();
          session.endSession();
          return ApiResponse.error(res, `Product ${item.product.name} not found`, 404);
        }

        if (product.stock < item.quantity) {
          await session.abortTransaction();
          session.endSession();
          return ApiResponse.error(
            res,
            `Insufficient stock for ${product.name}. Available: ${product.stock}`,
            400
          );
        }

        // Lock price at order time
        const itemTotal = product.price * item.quantity;
        subtotal += itemTotal;

        orderItems.push({
          product: product._id,
          name: product.name,
          quantity: item.quantity,
          price: product.price,
          total: itemTotal
        });
      }

      // Calculate tax (10%)
      const tax = subtotal * 0.1;

      // Calculate shipping (free if subtotal > $100, else $10)
      const shipping = subtotal > 100 ? 0 : 10;

      // Apply coupon discount if provided
      let discount = 0;
      if (couponCode) {
        // Placeholder for coupon validation logic
        // In production, validate against Coupon model
        discount = subtotal * 0.1; // Example: 10% discount
      }

      // Calculate total
      const total = subtotal + tax + shipping - discount;

      // Reserve inventory atomically within transaction
      for (const item of orderItems) {
        const updatedProduct = await Product.findOneAndUpdate(
          {
            _id: item.product,
            stock: { $gte: item.quantity }
          },
          { $inc: { stock: -item.quantity } },
          { new: true, session }
        );

        if (!updatedProduct) {
          await session.abortTransaction();
          session.endSession();
          return ApiResponse.error(
            res,
            `Insufficient stock for product. Another order may have been placed.`,
            400
          );
        }
      }

      // Create order
      const orderArray = await Order.create([{
        user: userId,
        items: orderItems,
        shippingAddress,
        paymentMethod,
        subtotal,
        tax,
        shipping,
        discount,
        total,
        couponCode: couponCode || null,
        status: 'pending'
      }], { session });

      const order = orderArray[0];

      // Clear cart
      await Cart.findOneAndUpdate(
        { user: userId },
        { $set: { items: [] } },
        { session }
      );

      // Commit transaction
      await session.commitTransaction();
      session.endSession();

      logger.info('Order created successfully', {
        orderId: order._id,
        userId,
        total
      });

      return ApiResponse.success(
        res,
        order,
        'Order created successfully',
        201
      );
    } catch (error) {
      await session.abortTransaction();
      session.endSession();

      logger.error('Failed to create order', {
        userId: req.userId,
        error: error.message
      });
      next(error);
    }
  }

  /**
   * Get order by ID
   * GET /api/orders/:id
   */
  async getOrderById(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.userId;
      const userRole = req.user.role;

      const order = await Order.findById(id)
        .populate('items.product', 'name price images')
        .populate('user', 'name email');

      if (!order) {
        return ApiResponse.error(res, 'Order not found', 404);
      }

      // Verify ownership (skip for admin)
      if (userRole !== 'admin' && order.user._id.toString() !== userId) {
        return ApiResponse.error(res, 'Access denied', 403);
      }

      logger.info('Order fetched successfully', { orderId: id, userId });

      return ApiResponse.success(res, order, 'Order retrieved successfully');
    } catch (error) {
      logger.error('Failed to fetch order', {
        orderId: req.params.id,
        userId: req.userId,
        error: error.message
      });
      next(error);
    }
  }

  /**
   * Get all orders with pagination and filters
   * GET /api/orders
   */
  async getOrders(req, res, next) {
    try {
      const userId = req.userId;
      const userRole = req.user.role;
      const {
        page = 1,
        limit = 10,
        status,
        startDate,
        endDate
      } = req.query;

      const query = {};

      // Filter by userId unless admin
      if (userRole !== 'admin') {
        query.user = userId;
      }

      // Filter by status
      if (status) {
        query.status = status;
      }

      // Filter by date range
      if (startDate || endDate) {
        query.createdAt = {};
        if (startDate) {
          query.createdAt.$gte = new Date(startDate);
        }
        if (endDate) {
          query.createdAt.$lte = new Date(endDate);
        }
      }

      const skip = (parseInt(page) - 1) * parseInt(limit);

      const orders = await Order.find(query)
        .populate('items.product', 'name price images')
        .populate('user', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

      const total = await Order.countDocuments(query);

      logger.info('Orders fetched successfully', {
        userId,
        count: orders.length,
        total
      });

      return ApiResponse.success(
        res,
        {
          orders,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / parseInt(limit))
          }
        },
        'Orders retrieved successfully'
      );
    } catch (error) {
      logger.error('Failed to fetch orders', {
        userId: req.userId,
        error: error.message
      });
      next(error);
    }
  }

  /**
   * Update order status
   * PATCH /api/orders/:id/status
   */
  async updateOrderStatus(req, res, next) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const { id } = req.params;
      const { status, trackingNumber, notes } = req.body;

      const order = await Order.findById(id).session(session);

      if (!order) {
        await session.abortTransaction();
        session.endSession();
        return ApiResponse.error(res, 'Order not found', 404);
      }

      // Validate status transitions
      const validTransitions = {
        pending: ['processing', 'cancelled'],
        processing: ['shipped', 'cancelled'],
        shipped: ['delivered', 'returned'],
        delivered: ['completed', 'returned'],
        completed: ['refunded'],
        cancelled: [],
        returned: [],
        refunded: []
      };

      const allowedStatuses = validTransitions[order.status] || [];

      if (!allowedStatuses.includes(status)) {
        await session.abortTransaction();
        session.endSession();
        return ApiResponse.error(
          res,
          `Cannot transition from ${order.status} to ${status}`,
          400
        );
      }

      const oldStatus = order.status;

      // Update order
      order.status = status;

      if (trackingNumber) {
        order.trackingNumber = trackingNumber;
      }

      if (notes) {
        order.notes = notes;
      }

      // Update timestamps based on status
      if (status === 'shipped') {
        order.shippedAt = new Date();
      } else if (status === 'delivered') {
        order.deliveredAt = new Date();
      }

      await order.save({ session });

      // Release inventory if cancelled
      if (status === 'cancelled' || status === 'returned') {
        for (const item of order.items) {
          await Product.findByIdAndUpdate(
            item.product,
            { $inc: { stock: item.quantity } },
            { session }
          );
        }
      }

      await session.commitTransaction();
      session.endSession();

      logger.info('Order status updated', {
        orderId: id,
        oldStatus: oldStatus,
        newStatus: status
      });

      return ApiResponse.success(
        res,
        order,
        'Order status updated successfully'
      );
    } catch (error) {
      await session.abortTransaction();
      session.endSession();

      logger.error('Failed to update order status', {
        orderId: req.params.id,
        error: error.message
      });
      next(error);
    }
  }

  /**
   * Cancel order
   * POST /api/orders/:id/cancel
   */
  async cancelOrder(req, res, next) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const { id } = req.params;
      const userId = req.userId;

      const order = await Order.findById(id).session(session);

      if (!order) {
        await session.abortTransaction();
        session.endSession();
        return ApiResponse.error(res, 'Order not found', 404);
      }

      // Verify ownership
      if (order.user.toString() !== userId) {
        await session.abortTransaction();
        session.endSession();
        return ApiResponse.error(res, 'Access denied', 403);
      }

      // Check cancellation eligibility
      if (!['pending', 'processing'].includes(order.status)) {
        await session.abortTransaction();
        session.endSession();
        return ApiResponse.error(
          res,
          `Cannot cancel order with status: ${order.status}`,
          400
        );
      }

      // Release reserved inventory
      for (const item of order.items) {
        await Product.findByIdAndUpdate(
          item.product,
          { $inc: { stock: item.quantity } },
          { session }
        );
      }

      // Update order status
      order.status = 'cancelled';
      order.cancelledAt = new Date();
      await order.save({ session });

      // Initiate refund if payment completed
      if (order.paymentStatus === 'completed') {
        // Placeholder for payment gateway refund logic
        order.refundStatus = 'pending';
        await order.save({ session });
      }

      await session.commitTransaction();
      session.endSession();

      logger.info('Order cancelled successfully', {
        orderId: id,
        userId
      });

      return ApiResponse.success(
        res,
        order,
        'Order cancelled successfully'
      );
    } catch (error) {
      await session.abortTransaction();
      session.endSession();

      logger.error('Failed to cancel order', {
        orderId: req.params.id,
        userId: req.userId,
        error: error.message
      });
      next(error);
    }
  }

  /**
   * Refund order (Admin only)
   * POST /api/orders/:id/refund
   */
  async refundOrder(req, res, next) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const { id } = req.params;
      const { amount, reason } = req.body;
      const userRole = req.user.role;

      // Admin only
      if (userRole !== 'admin') {
        await session.abortTransaction();
        session.endSession();
        return ApiResponse.error(res, 'Access denied. Admin only', 403);
      }

      const order = await Order.findById(id).session(session);

      if (!order) {
        await session.abortTransaction();
        session.endSession();
        return ApiResponse.error(res, 'Order not found', 404);
      }

      // Validate refund eligibility
      if (!['completed', 'delivered', 'returned'].includes(order.status)) {
        await session.abortTransaction();
        session.endSession();
        return ApiResponse.error(
          res,
          `Cannot refund order with status: ${order.status}`,
          400
        );
      }

      // Validate refund amount
      if (amount > order.total) {
        await session.abortTransaction();
        session.endSession();
        return ApiResponse.error(
          res,
          'Refund amount cannot exceed order total',
          400
        );
      }

      // Process refund through payment gateway
      // Placeholder for payment gateway integration
      const refundSuccess = true; // Simulated success

      if (refundSuccess) {
        order.refundStatus = 'completed';
        order.refundAmount = amount;
        order.refundReason = reason;
        order.refundedAt = new Date();
        order.status = 'refunded';
        await order.save({ session });

        await session.commitTransaction();
        session.endSession();

        logger.info('Order refunded successfully', {
          orderId: id,
          amount,
          reason
        });

        return ApiResponse.success(
          res,
          order,
          'Order refunded successfully'
        );
      } else {
        await session.abortTransaction();
        session.endSession();
        return ApiResponse.error(res, 'Refund processing failed', 500);
      }
    } catch (error) {
      await session.abortTransaction();
      session.endSession();

      logger.error('Failed to refund order', {
        orderId: req.params.id,
        error: error.message
      });
      next(error);
    }
  }
}


const controller = new OrderController();

module.exports = {
  'getOrder.Controllers': controller.getOrders.bind(controller),
  'getOrder.ControllerById': controller.getOrderById.bind(controller),
  'createOrder.Controller': controller.createOrder.bind(controller),
  'updateOrder.Controller': controller.updateOrderStatus.bind(controller),
  'deleteOrder.Controller': controller.cancelOrder.bind(controller)
};
