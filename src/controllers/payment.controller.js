// File: src/controllers/payment.controller.js
// Generated: 2025-10-16 10:50:11 UTC
// Project ID: proj_c85cfd5b58f3
// Task ID: task_ri0bkg1hnqsh


const ApiResponse = require('../utils/response');


const logger = require('../utils/logger');


const orderService = require('../services/order.service');


const paymentService = require('../services/payment.service');

/**
 * Create payment intent for order
 * POST /api/payments/intent
 */
exports.createPaymentIntent = async (req, res, next) => {
  try {
    const { orderId, paymentMethod } = req.body;
    const userId = req.userId;

    logger.info('Creating payment intent', { orderId, userId, paymentMethod });

    // Verify order belongs to user
    const order = await orderService.getOrderById(orderId);
    if (!order) {
      return res.status(404).json(
        ApiResponse.error('Order not found')
      );
    }

    if (order.user.toString() !== userId.toString()) {
      return res.status(403).json(
        ApiResponse.error('Unauthorized to access this order')
      );
    }

    if (order.paymentStatus === 'paid') {
      return res.status(400).json(
        ApiResponse.error('Order already paid')
      );
    }

    // Create payment intent
    const paymentIntent = await paymentService.createPaymentIntent({
      orderId,
      amount: order.totalAmount,
      currency: order.currency || 'usd',
      paymentMethod,
      userId,
      metadata: {
        orderId: order._id.toString(),
        userId: userId.toString()
      }
    });

    logger.info('Payment intent created', {
      paymentIntentId: paymentIntent.id,
      orderId
    });

    res.status(200).json(
      ApiResponse.success(paymentIntent, 'Payment intent created successfully')
    );
  } catch (error) {
    logger.error('Failed to create payment intent', {
      error: error.message,
      orderId: req.body.orderId,
      userId: req.userId
    });
    next(error);
  }
};

/**
 * Handle payment webhook from payment provider
 * POST /api/payments/webhook
 */
exports.handleWebhook = async (req, res, next) => {
  try {
    const signature = req.headers['stripe-signature'];
    const rawBody = req.rawBody;

    logger.info('Received payment webhook', {
      signature: signature ? 'present' : 'missing'
    });

    // Verify webhook signature
    const event = await paymentService.verifyWebhookSignature(rawBody, signature);

    if (!event) {
      logger.warn('Invalid webhook signature');
      return res.status(400).json(
        ApiResponse.error('Invalid signature')
      );
    }

    // Handle different event types
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentSuccess(event.data.object);
        break;

      case 'payment_intent.payment_failed':
        await handlePaymentFailure(event.data.object);
        break;

      case 'charge.refunded':
        await handleRefund(event.data.object);
        break;

      default:
        logger.info('Unhandled webhook event type', { type: event.type });
    }

    res.status(200).json({ received: true });
  } catch (error) {
    logger.error('Webhook processing failed', {
      error: error.message
    });
    res.status(400).json(
      ApiResponse.error('Webhook processing failed')
    );
  }
};

/**
 * Process refund for order
 * POST /api/payments/refund
 */
exports.processRefund = async (req, res, next) => {
  try {
    const { orderId, amount, reason } = req.body;
    const userId = req.userId;

    logger.info('Processing refund', { orderId, userId, amount, reason });

    // Verify order belongs to user
    const order = await orderService.getOrderById(orderId);
    if (!order) {
      return res.status(404).json(
        ApiResponse.error('Order not found')
      );
    }

    if (order.user.toString() !== userId.toString()) {
      return res.status(403).json(
        ApiResponse.error('Unauthorized to access this order')
      );
    }

    if (order.paymentStatus !== 'paid') {
      return res.status(400).json(
        ApiResponse.error('Order is not paid')
      );
    }

    if (!order.paymentIntentId) {
      return res.status(400).json(
        ApiResponse.error('No payment information found for this order')
      );
    }

    // Process refund
    const refund = await paymentService.createRefund({
      paymentIntentId: order.paymentIntentId,
      amount: amount || order.totalAmount,
      reason: reason || 'requested_by_customer',
      orderId: order._id
    });

    // Update order status
    await orderService.updateOrderPaymentStatus(orderId, 'refunded');

    logger.info('Refund processed successfully', {
      refundId: refund.id,
      orderId
    });

    res.status(200).json(
      ApiResponse.success(refund, 'Refund processed successfully')
    );
  } catch (error) {
    logger.error('Failed to process refund', {
      error: error.message,
      orderId: req.body.orderId,
      userId: req.userId
    });
    next(error);
  }
};

/**
 * Get payment status for order
 * GET /api/payments/status/:orderId
 */
exports.getPaymentStatus = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const userId = req.userId;

    logger.info('Fetching payment status', { orderId, userId });

    // Verify order belongs to user
    const order = await orderService.getOrderById(orderId);
    if (!order) {
      return res.status(404).json(
        ApiResponse.error('Order not found')
      );
    }

    if (order.user.toString() !== userId.toString()) {
      return res.status(403).json(
        ApiResponse.error('Unauthorized to access this order')
      );
    }

    let paymentDetails = null;
    if (order.paymentIntentId) {
      paymentDetails = await paymentService.getPaymentIntent(order.paymentIntentId);
    }

    const paymentStatus = {
      orderId: order._id,
      paymentStatus: order.paymentStatus,
      totalAmount: order.totalAmount,
      currency: order.currency || 'usd',
      paymentIntentId: order.paymentIntentId,
      paymentMethod: order.paymentMethod,
      paidAt: order.paidAt,
      paymentDetails
    };

    logger.info('Payment status retrieved', { orderId });

    res.status(200).json(
      ApiResponse.success(paymentStatus, 'Payment status retrieved successfully')
    );
  } catch (error) {
    logger.error('Failed to fetch payment status', {
      error: error.message,
      orderId: req.params.orderId,
      userId: req.userId
    });
    next(error);
  }
};

/**
 * Get payment methods for user
 * GET /api/payments/methods
 */
exports.getPaymentMethods = async (req, res, next) => {
  try {
    const userId = req.userId;

    logger.info('Fetching payment methods', { userId });

    const paymentMethods = await paymentService.getPaymentMethods(userId);

    res.status(200).json(
      ApiResponse.success(paymentMethods, 'Payment methods retrieved successfully')
    );
  } catch (error) {
    logger.error('Failed to fetch payment methods', {
      error: error.message,
      userId: req.userId
    });
    next(error);
  }
};

/**
 * Add payment method for user
 * POST /api/payments/methods
 */
exports.addPaymentMethod = async (req, res, next) => {
  try {
    const { paymentMethodId } = req.body;
    const userId = req.userId;

    logger.info('Adding payment method', { userId, paymentMethodId });

    const paymentMethod = await paymentService.attachPaymentMethod(userId, paymentMethodId);

    logger.info('Payment method added', { userId, paymentMethodId });

    res.status(201).json(
      ApiResponse.success(paymentMethod, 'Payment method added successfully')
    );
  } catch (error) {
    logger.error('Failed to add payment method', {
      error: error.message,
      userId: req.userId
    });
    next(error);
  }
};

/**
 * Delete payment method
 * DELETE /api/payments/methods/:methodId
 */
exports.deletePaymentMethod = async (req, res, next) => {
  try {
    const { methodId } = req.params;
    const userId = req.userId;

    logger.info('Deleting payment method', { userId, methodId });

    await paymentService.detachPaymentMethod(methodId);

    logger.info('Payment method deleted', { userId, methodId });

    res.status(200).json(
      ApiResponse.success(null, 'Payment method deleted successfully')
    );
  } catch (error) {
    logger.error('Failed to delete payment method', {
      error: error.message,
      methodId: req.params.methodId,
      userId: req.userId
    });
    next(error);
  }
};

/**
 * Helper: Handle successful payment
 */
async function handlePaymentSuccess(paymentIntent) {
  try {
    const orderId = paymentIntent.metadata.orderId;

    logger.info('Processing successful payment', {
      paymentIntentId: paymentIntent.id,
      orderId
    });

    // Update order payment status
    await orderService.updateOrderPaymentStatus(orderId, 'paid', {
      paymentIntentId: paymentIntent.id,
      paymentMethod: paymentIntent.payment_method,
      paidAt: new Date()
    });

    // Update order status to processing
    await orderService.updateOrderStatus(orderId, 'processing');

    logger.info('Payment success handled', { orderId });
  } catch (error) {
    logger.error('Failed to handle payment success', {
      error: error.message,
      paymentIntentId: paymentIntent.id
    });
    throw error;
  }
}

/**
 * Helper: Handle failed payment
 */
async function handlePaymentFailure(paymentIntent) {
  try {
    const orderId = paymentIntent.metadata.orderId;

    logger.info('Processing failed payment', {
      paymentIntentId: paymentIntent.id,
      orderId
    });

    // Update order payment status
    await orderService.updateOrderPaymentStatus(orderId, 'failed', {
      paymentIntentId: paymentIntent.id,
      failureReason: paymentIntent.last_payment_error?.message
    });

    logger.info('Payment failure handled', { orderId });
  } catch (error) {
    logger.error('Failed to handle payment failure', {
      error: error.message,
      paymentIntentId: paymentIntent.id
    });
    throw error;
  }
}

/**
 * Helper: Handle refund
 */
async function handleRefund(charge) {
  try {
    const paymentIntentId = charge.payment_intent;

    logger.info('Processing refund webhook', {
      chargeId: charge.id,
      paymentIntentId
    });

    // Find order by payment intent ID
    const order = await orderService.getOrderByPaymentIntent(paymentIntentId);

    if (order) {
      await orderService.updateOrderPaymentStatus(order._id, 'refunded', {
        refundedAt: new Date(),
        refundAmount: charge.amount_refunded
      });

      logger.info('Refund webhook handled', { orderId: order._id });
    }
  } catch (error) {
    logger.error('Failed to handle refund webhook', {
      error: error.message,
      chargeId: charge.id
    });
    throw error;
  }
}

module.exports = {
  createPaymentIntent: exports.createPaymentIntent,
  handleWebhook: exports.handleWebhook,
  processRefund: exports.processRefund,
  getPaymentStatus: exports.getPaymentStatus,
  getPaymentMethods: exports.getPaymentMethods,
  addPaymentMethod: exports.addPaymentMethod,
  deletePaymentMethod: exports.deletePaymentMethod
};
