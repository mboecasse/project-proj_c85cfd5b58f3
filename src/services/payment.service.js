// File: src/services/payment.service.js
// Generated: 2025-10-16 10:55:14 UTC
// Project ID: proj_c85cfd5b58f3
// Task ID: task_kh20tbkxr3dj


const Order = require('../models/Order');


const PayPalService = require('./paypal.service');


const Payment = require('../models/Payment');


const StripeService = require('./stripe.service');


const logger = require('../utils/logger');

/**
 * Payment Service
 * Orchestrates payment processing across multiple payment gateways
 */
class PaymentService {
  constructor() {
    this.gateways = {
      stripe: new StripeService(),
      paypal: new PayPalService()
    };
  }

  /**
   * Process payment for an order
   * @param {string} orderId - Order ID
   * @param {Object} paymentDetails - Payment details
   * @param {string} paymentDetails.paymentMethod - Payment method (stripe/paypal)
   * @param {number} paymentDetails.amount - Payment amount
   * @param {string} paymentDetails.currency - Currency code
   * @param {string} paymentDetails.userId - User ID
   * @param {string} [paymentDetails.returnUrl] - Return URL for PayPal
   * @param {string} [paymentDetails.cancelUrl] - Cancel URL for PayPal
   * @returns {Promise<Object>} Payment result
   */
  async processPayment(orderId, paymentDetails) {
    const session = await Payment.startSession();
    session.startTransaction();

    try {
      const { paymentMethod, amount, currency, userId, returnUrl, cancelUrl } = paymentDetails;

      logger.info('Processing payment', { orderId, paymentMethod, amount, currency });

      // Validate order exists and lock it
      const order = await Order.findById(orderId).session(session);
      if (!order) {
        throw new Error('Order not found');
      }

      // Validate payment amount matches order total
      this._validatePaymentAmount(order, amount);

      // Check if order is already paid
      if (order.payment.status === 'completed') {
        throw new Error('Order is already paid');
      }

      // Check for existing pending payment to prevent duplicates
      const existingPayment = await Payment.findOne({
        orderId,
        paymentStatus: { $in: ['pending', 'completed'] }
      }).session(session);

      if (existingPayment) {
        throw new Error('Payment already in progress or completed for this order');
      }

      // Select payment gateway
      const gateway = this._selectGateway(paymentMethod);

      let paymentResult;
      let payment;

      // Process payment based on gateway
      if (paymentMethod === 'stripe') {
        // Create Stripe payment intent
        const paymentIntent = await gateway.createPaymentIntent({
          amount: Math.round(amount * 100), // Convert to cents
          currency: currency || 'usd',
          userId,
          orderId
        });

        // Create payment record
        payment = await Payment.create([{
          orderId,
          userId,
          amount,
          currency: currency || 'usd',
          paymentMethod: 'stripe',
          paymentStatus: 'pending',
          transactionId: paymentIntent.id,
          paymentGateway: 'stripe',
          gatewayResponse: {
            clientSecret: paymentIntent.client_secret,
            status: paymentIntent.status
          }
        }], { session });

        paymentResult = {
          paymentId: payment[0]._id,
          transactionId: paymentIntent.id,
          clientSecret: paymentIntent.client_secret,
          status: 'pending',
          requiresAction: paymentIntent.status === 'requires_action'
        };

      } else if (paymentMethod === 'paypal') {
        // Create PayPal order
        const paypalOrder = await gateway.createOrder({
          orderId,
          amount,
          currency: currency || 'USD',
          returnUrl: returnUrl || `${process.env.FRONTEND_URL}/payment/success`,
          cancelUrl: cancelUrl || `${process.env.FRONTEND_URL}/payment/cancel`
        });

        // Create payment record
        payment = await Payment.create([{
          orderId,
          userId,
          amount,
          currency: currency || 'USD',
          paymentMethod: 'paypal',
          paymentStatus: 'pending',
          transactionId: paypalOrder.id,
          paymentGateway: 'paypal',
          gatewayResponse: {
            approvalUrl: paypalOrder.approvalUrl,
            status: paypalOrder.status
          }
        }], { session });

        paymentResult = {
          paymentId: payment[0]._id,
          transactionId: paypalOrder.id,
          approvalUrl: paypalOrder.approvalUrl,
          status: 'pending',
          requiresAction: true
        };
      } else {
        throw new Error(`Unsupported payment method: ${paymentMethod}`);
      }

      // Update order with payment info
      await this._updateOrderStatus(orderId, 'pending_payment', {
        paymentId: payment[0]._id,
        transactionId: payment[0].transactionId
      }, session);

      await session.commitTransaction();

      logger.info('Payment processing initiated', {
        orderId,
        paymentId: payment[0]._id,
        transactionId: payment[0].transactionId,
        status: paymentResult.status
      });

      return {
        success: true,
        data: paymentResult
      };

    } catch (error) {
      await session.abortTransaction();
      logger.error('Payment processing failed', {
        orderId,
        error: error.message,
        stack: error.stack
      });
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Verify payment status
   * @param {string} paymentId - Payment ID
   * @returns {Promise<Object>} Payment verification result
   */
  async verifyPayment(paymentId) {
    try {
      logger.info('Verifying payment', { paymentId });

      const payment = await Payment.findById(paymentId);
      if (!payment) {
        throw new Error('Payment not found');
      }

      const gateway = this._selectGateway(payment.paymentMethod);

      let verificationResult;

      if (payment.paymentMethod === 'stripe') {
        // Retrieve payment intent from Stripe
        const paymentIntent = await gateway.retrievePaymentIntent(payment.transactionId);

        // Update payment status based on intent status
        if (paymentIntent.status === 'succeeded') {
          payment.paymentStatus = 'completed';
          payment.completedAt = new Date();
          await payment.save();

          await this._handlePaymentCompleted({
            orderId: payment.orderId,
            paymentId: payment._id,
            transactionId: payment.transactionId
          });

          verificationResult = {
            status: 'completed',
            verified: true
          };
        } else if (paymentIntent.status === 'requires_payment_method' || paymentIntent.status === 'canceled') {
          payment.paymentStatus = 'failed';
          await payment.save();

          await this._handlePaymentFailed({
            orderId: payment.orderId,
            paymentId: payment._id,
            reason: 'Payment verification failed'
          });

          verificationResult = {
            status: 'failed',
            verified: false
          };
        } else {
          verificationResult = {
            status: 'pending',
            verified: false
          };
        }

      } else if (payment.paymentMethod === 'paypal') {
        // Get payment details from PayPal
        const paypalPayment = await gateway.getPaymentDetails(payment.transactionId);

        if (paypalPayment.status === 'COMPLETED') {
          payment.paymentStatus = 'completed';
          payment.completedAt = new Date();
          await payment.save();

          await this._handlePaymentCompleted({
            orderId: payment.orderId,
            paymentId: payment._id,
            transactionId: payment.transactionId
          });

          verificationResult = {
            status: 'completed',
            verified: true
          };
        } else if (paypalPayment.status === 'VOIDED' || paypalPayment.status === 'FAILED') {
          payment.paymentStatus = 'failed';
          await payment.save();

          await this._handlePaymentFailed({
            orderId: payment.orderId,
            paymentId: payment._id,
            reason: 'Payment verification failed'
          });

          verificationResult = {
            status: 'failed',
            verified: false
          };
        } else {
          verificationResult = {
            status: 'pending',
            verified: false
          };
        }
      }

      logger.info('Payment verified', {
        paymentId,
        status: verificationResult.status,
        verified: verificationResult.verified
      });

      return {
        success: true,
        data: {
          paymentId: payment._id,
          orderId: payment.orderId,
          amount: payment.amount,
          currency: payment.currency,
          ...verificationResult
        }
      };

    } catch (error) {
      logger.error('Payment verification failed', {
        paymentId,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Refund payment
   * @param {string} paymentId - Payment ID
   * @param {number} [refundAmount] - Amount to refund (null for full refund)
   * @returns {Promise<Object>} Refund result
   */
  async refundPayment(paymentId, refundAmount = null) {
    try {
      logger.info('Processing refund', { paymentId, refundAmount });

      const payment = await Payment.findById(paymentId);
      if (!payment) {
        throw new Error('Payment not found');
      }

      if (payment.paymentStatus !== 'completed') {
        throw new Error('Cannot refund payment that is not completed');
      }

      if (payment.refunded) {
        throw new Error('Payment has already been refunded');
      }

      const gateway = this._selectGateway(payment.paymentMethod);

      const amountToRefund = refundAmount || payment.amount;

      if (amountToRefund > payment.amount) {
        throw new Error('Refund amount cannot exceed payment amount');
      }

      let refundResult;

      if (payment.paymentMethod === 'stripe') {
        // Create Stripe refund
        const refund = await gateway.createRefund(
          payment.transactionId,
          Math.round(amountToRefund * 100) // Convert to cents
        );

        refundResult = {
          refundId: refund.id,
          amount: amountToRefund,
          status: refund.status
        };

      } else if (payment.paymentMethod === 'paypal') {
        // Create PayPal refund
        const refund = await gateway.refundPayment(
          payment.transactionId,
          amountToRefund,
          payment.currency
        );

        refundResult = {
          refundId: refund.id,
          amount: amountToRefund,
          status: refund.status
        };
      }

      // Update payment record
      payment.refunded = true;
      payment.refundAmount = amountToRefund;
      payment.refundedAt = new Date();
      payment.refundTransactionId = refundResult.refundId;
      await payment.save();

      // Handle refund completion
      await this._handleRefundCompleted({
        orderId: payment.orderId,
        paymentId: payment._id,
        refundAmount: amountToRefund
      });

      logger.info('Refund processed successfully', {
        paymentId,
        refundId: refundResult.refundId,
        amount: amountToRefund
      });

      return {
        success: true,
        data: {
          paymentId: payment._id,
          orderId: payment.orderId,
          refundId: refundResult.refundId,
          amount: amountToRefund,
          status: refundResult.status
        }
      };

    } catch (error) {
      logger.error('Refund processing failed', {
        paymentId,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Handle webhook from payment provider
   * @param {string} provider - Payment provider (stripe/paypal)
   * @param {Object} payload - Webhook payload
   * @param {string} signature - Webhook signature
   * @returns {Promise<Object>} Webhook handling result
   */
  async handleWebhook(provider, payload, signature) {
    try {
      logger.info('Processing webhook', { provider });

      const gateway = this._selectGateway(provider);

      if (provider === 'stripe') {
        // Verify Stripe webhook signature
        const event = gateway.constructWebhookEvent(payload, signature);

        logger.info('Stripe webhook event received', { type: event.type });

        // Handle different event types
        switch (event.type) {
          case 'payment_intent.succeeded':
            await this._handleStripePaymentSucceeded(event.data.object);
            break;

          case 'payment_intent.payment_failed':
            await this._handleStripePaymentFailed(event.data.object);
            break;

          case 'charge.refunded':
            await this._handleStripeRefund(event.data.object);
            break;

          default:
            logger.info('Unhandled Stripe webhook event type', { type: event.type });
        }

      } else if (provider === 'paypal') {
        // Verify PayPal webhook signature
        const isValid = await gateway.verifyWebhookSignature(payload, signature);

        if (!isValid) {
          throw new Error('Invalid PayPal webhook signature');
        }

        logger.info('PayPal webhook event received', { type: payload.event_type });

        // Handle different event types
        switch (payload.event_type) {
          case 'PAYMENT.CAPTURE.COMPLETED':
            await this._handlePayPalCaptureCompleted(payload.resource);
            break;

          case 'PAYMENT.CAPTURE.DENIED':
            await this._handlePayPalCaptureDenied(payload.resource);
            break;

          case 'PAYMENT.CAPTURE.REFUNDED':
            await this._handlePayPalRefund(payload.resource);
            break;

          default:
            logger.info('Unhandled PayPal webhook event type', { type: payload.event_type });
        }
      }

      return {
        success: true,
        message: 'Webhook processed successfully'
      };

    } catch (error) {
      logger.error('Webhook processing failed', {
        provider,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Select payment gateway based on payment method
   * @private
   */
  _selectGateway(paymentMethod) {
    const gateway = this.gateways[paymentMethod];
    if (!gateway) {
      throw new Error(`Unsupported payment gateway: ${paymentMethod}`);
    }
    return gateway;
  }

  /**
   * Validate payment amount matches order total
   * @private
   */
  _validatePaymentAmount(order, amount) {
    const orderTotal = order.pricing.total;
    const difference = Math.abs(orderTotal - amount);

    // Allow small difference for floating point precision
    if (difference > 0.01) {
      throw new Error(
        `Payment amount (${amount}) does not match order total (${orderTotal})`
      );
    }
  }

  /**
   * Update order status and payment info
   * @private
   */
  async _updateOrderStatus(orderId, status, paymentInfo = {}, session = null) {
    try {
      const query = Order.findById(orderId);
      if (session) {
        query.session(session);
      }

      const order = await query;
      if (!order) {
        throw new Error('Order not found');
      }

      if (status) {
        await order.updateStatus(status);
      }

      if (paymentInfo.paymentId) {
        order.payment.paymentId = paymentInfo.paymentId;
      }

      if (paymentInfo.transactionId) {
        order.payment.transactionId = paymentInfo.transactionId;
      }

      await order.save({ session });

      logger.info('Order status updated', { orderId, status, paymentInfo });

    } catch (error) {
      logger.error('Failed to update order status', {
        orderId,
        status,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Handle payment completed
   * @private
   */
  async _handlePaymentCompleted(data) {
    try {
      const { orderId, paymentId, transactionId } = data;

      logger.info('Handling payment completed', { orderId, paymentId, transactionId });

      // Update order status to paid
      const order = await Order.findById(orderId);
      if (order) {
        order.payment.status = 'completed';
        order.payment.paidAt = new Date();
        await order.updateStatus('paid', 'Payment completed successfully');
      }

    } catch (error) {
      logger.error('Failed to handle payment completed', {
        data,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Handle payment failed
   * @private
   */
  async _handlePaymentFailed(data) {
    try {
      const { orderId, paymentId, reason } = data;

      logger.info('Handling payment failed', { orderId, paymentId, reason });

      // Update order status to payment failed
      const order = await Order.findById(orderId);
      if (order) {
        order.payment.status = 'failed';
        await order.updateStatus('payment_failed', reason || 'Payment failed');
      }

    } catch (error) {
      logger.error('Failed to handle payment failed', {
        data,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Handle refund completed
   * @private
   */
  async _handleRefundCompleted(data) {
    try {
      const { orderId, paymentId, refundAmount } = data;

      logger.info('Handling refund completed', { orderId, paymentId, refundAmount });

      // Update order status to refunded
      const order = await Order.findById(orderId);
      if (order) {
        order.payment.status = 'refunded';
        order.payment.refundedAt = new Date();
        await order.updateStatus('refunded', `Refund of ${refundAmount} completed`);
      }

    } catch (error) {
      logger.error('Failed to handle refund completed', {
        data,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Handle Stripe payment succeeded webhook
   * @private
   */
  async _handleStripePaymentSucceeded(paymentIntent) {
    try {
      const payment = await Payment.findOne({ transactionId: paymentIntent.id });

      if (payment) {
        payment.paymentStatus = 'completed';
        payment.completedAt = new Date();
        await payment.save();

        await this._handlePaymentCompleted({
          orderId: payment.orderId,
          paymentId: payment._id,
          transactionId: payment.transactionId
        });
      }

    } catch (error) {
      logger.error('Failed to handle Stripe payment succeeded', {
        paymentIntentId: paymentIntent.id,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Handle Stripe payment failed webhook
   * @private
   */
  async _handleStripePaymentFailed(paymentIntent) {
    try {
      const payment = await Payment.findOne({ transactionId: paymentIntent.id });

      if (payment) {
        payment.paymentStatus = 'failed';
        await payment.save();

        await this._handlePaymentFailed({
          orderId: payment.orderId,
          paymentId: payment._id,
          reason: paymentIntent.last_payment_error?.message || 'Payment failed'
        });
      }

    } catch (error) {
      logger.error('Failed to handle Stripe payment failed', {
        paymentIntentId: paymentIntent.id,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Handle Stripe refund webhook
   * @private
   */
  async _handleStripeRefund(charge) {
    try {
      const payment = await Payment.findOne({ transactionId: charge.payment_intent });

      if (payment && !payment.refunded) {
        payment.refunded = true;
        payment.refundAmount = charge.amount_refunded / 100; // Convert from cents
        payment.refundedAt = new Date();
        await payment.save();

        await this._handleRefundCompleted({
          orderId: payment.orderId,
          paymentId: payment._id,
          refundAmount: payment.refundAmount
        });
      }

    } catch (error) {
      logger.error('Failed to handle Stripe refund', {
        chargeId: charge.id,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Handle PayPal capture completed webhook
   * @private
   */
  async _handlePayPalCaptureCompleted(capture) {
    try {
      const payment = await Payment.findOne({ transactionId: capture.supplementary_data?.related_ids?.order_id });

      if (payment) {
        payment.paymentStatus = 'completed';
        payment.completedAt = new Date();
        await payment.save();

        await this._handlePaymentCompleted({
          orderId: payment.orderId,
          paymentId: payment._id,
          transactionId: payment.transactionId
        });
      }

    } catch (error) {
      logger.error('Failed to handle PayPal capture completed', {
        captureId: capture.id,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Handle PayPal capture denied webhook
   * @private
   */
  async _handlePayPalCaptureDenied(capture) {
    try {
      const payment = await Payment.findOne({ transactionId: capture.supplementary_data?.related_ids?.order_id });

      if (payment) {
        payment.paymentStatus = 'failed';
        await payment.save();

        await this._handlePaymentFailed({
          orderId: payment.orderId,
          paymentId: payment._id,
          reason: 'Payment capture denied'
        });
      }

    } catch (error) {
      logger.error('Failed to handle PayPal capture denied', {
        captureId: capture.id,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Handle PayPal refund webhook
   * @private
   */
  async _handlePayPalRefund(refund) {
    try {
      const payment = await Payment.findOne({ transactionId: refund.supplementary_data?.related_ids?.order_id });

      if (payment && !payment.refunded) {
        payment.refunded = true;
        payment.refundAmount = parseFloat(refund.amount.value);
        payment.refundedAt = new Date();
        await payment.save();

        await this._handleRefundCompleted({
          orderId: payment.orderId,
          paymentId: payment._id,
          refundAmount: payment.refundAmount
        });
      }

    } catch (error) {
      logger.error('Failed to handle PayPal refund', {
        refundId: refund.id,
        error: error.message
      });
      throw error;
    }
  }
}

module.exports = PaymentService;
