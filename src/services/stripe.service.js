// File: src/services/stripe.service.js
// Generated: 2025-10-16 10:51:24 UTC
// Project ID: proj_c85cfd5b58f3
// Task ID: task_r93qxv4ov9mo


const Payment = require('../models/Payment');


const logger = require('../utils/logger');

const { stripe, config, verifyConnection, constructWebhookEvent, formatAmountForStripe, formatAmountFromStripe } = require('../config/stripe');

/**
 * Stripe Service
 * Handles all Stripe payment operations
 */
class StripeService {
  /**
   * Initialize Stripe service and verify connection
   */
  async initialize() {
    try {
      await verifyConnection();
      logger.info('Stripe service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Stripe service', { error: error.message });
      throw error;
    }
  }

  /**
   * Create a payment intent
   * @param {Object} params - Payment parameters
   * @param {number} params.amount - Amount in dollars
   * @param {string} params.currency - Currency code
   * @param {string} params.userId - User ID
   * @param {string} params.orderId - Order ID
   * @param {Object} params.metadata - Additional metadata
   * @returns {Object} Payment intent and payment record
   */
  async createPaymentIntent({ amount, currency = 'usd', userId, orderId, metadata = {} }) {
    try {
      logger.info('Creating payment intent', { amount, currency, userId, orderId });

      // Format amount for Stripe (convert to cents)
      const stripeAmount = formatAmountForStripe(amount, currency);

      // Create payment intent
      const paymentIntent = await stripe.paymentIntents.create({
        amount: stripeAmount,
        currency: currency.toLowerCase(),
        metadata: {
          userId,
          orderId,
          ...metadata
        },
        automatic_payment_methods: {
          enabled: true
        }
      });

      // Create payment record in database
      const payment = await Payment.create({
        userId,
        orderId,
        stripePaymentIntentId: paymentIntent.id,
        amount,
        currency: currency.toUpperCase(),
        status: 'pending',
        paymentMethod: 'stripe',
        metadata: {
          userId,
          orderId,
          ...metadata
        }
      });

      logger.info('Payment intent created successfully', {
        paymentId: payment._id,
        paymentIntentId: paymentIntent.id
      });

      return {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        paymentId: payment._id,
        amount: payment.amount,
        currency: payment.currency
      };
    } catch (error) {
      logger.error('Failed to create payment intent', {
        error: error.message,
        userId,
        orderId
      });
      throw error;
    }
  }

  /**
   * Retrieve payment intent
   * @param {string} paymentIntentId - Stripe payment intent ID
   * @returns {Object} Payment intent
   */
  async retrievePaymentIntent(paymentIntentId) {
    try {
      logger.info('Retrieving payment intent', { paymentIntentId });

      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

      logger.info('Payment intent retrieved successfully', { paymentIntentId });

      return paymentIntent;
    } catch (error) {
      logger.error('Failed to retrieve payment intent', {
        error: error.message,
        paymentIntentId
      });
      throw error;
    }
  }

  /**
   * Confirm payment intent
   * @param {string} paymentIntentId - Stripe payment intent ID
   * @param {string} paymentMethodId - Payment method ID
   * @returns {Object} Confirmed payment intent
   */
  async confirmPaymentIntent(paymentIntentId, paymentMethodId) {
    try {
      logger.info('Confirming payment intent', { paymentIntentId, paymentMethodId });

      const paymentIntent = await stripe.paymentIntents.confirm(paymentIntentId, {
        payment_method: paymentMethodId
      });

      // Update payment record
      await Payment.findOneAndUpdate(
        { stripePaymentIntentId: paymentIntentId },
        {
          status: paymentIntent.status === 'succeeded' ? 'completed' : 'processing',
          stripePaymentMethodId: paymentMethodId,
          paidAt: paymentIntent.status === 'succeeded' ? new Date() : undefined
        }
      );

      logger.info('Payment intent confirmed successfully', {
        paymentIntentId,
        status: paymentIntent.status
      });

      return paymentIntent;
    } catch (error) {
      logger.error('Failed to confirm payment intent', {
        error: error.message,
        paymentIntentId
      });
      throw error;
    }
  }

  /**
   * Cancel payment intent
   * @param {string} paymentIntentId - Stripe payment intent ID
   * @returns {Object} Cancelled payment intent
   */
  async cancelPaymentIntent(paymentIntentId) {
    try {
      logger.info('Cancelling payment intent', { paymentIntentId });

      const paymentIntent = await stripe.paymentIntents.cancel(paymentIntentId);

      // Update payment record
      await Payment.findOneAndUpdate(
        { stripePaymentIntentId: paymentIntentId },
        { status: 'cancelled' }
      );

      logger.info('Payment intent cancelled successfully', { paymentIntentId });

      return paymentIntent;
    } catch (error) {
      logger.error('Failed to cancel payment intent', {
        error: error.message,
        paymentIntentId
      });
      throw error;
    }
  }

  /**
   * Create a refund
   * @param {string} paymentIntentId - Stripe payment intent ID
   * @param {number} amount - Amount to refund (optional, full refund if not provided)
   * @param {string} reason - Refund reason
   * @returns {Object} Refund object
   */
  async createRefund(paymentIntentId, amount = null, reason = 'requested_by_customer') {
    try {
      logger.info('Creating refund', { paymentIntentId, amount, reason });

      const refundParams = {
        payment_intent: paymentIntentId,
        reason
      };

      if (amount) {
        const payment = await Payment.findOne({ stripePaymentIntentId: paymentIntentId });
        if (!payment) {
          throw new Error('Payment not found');
        }
        refundParams.amount = formatAmountForStripe(amount, payment.currency);
      }

      const refund = await stripe.refunds.create(refundParams);

      // Update payment record
      const payment = await Payment.findOne({ stripePaymentIntentId: paymentIntentId });
      const refundAmount = amount || payment.amount;

      await Payment.findOneAndUpdate(
        { stripePaymentIntentId: paymentIntentId },
        {
          status: refund.status === 'succeeded' ? 'refunded' : 'refund_pending',
          refundAmount: refundAmount,
          refundedAt: refund.status === 'succeeded' ? new Date() : undefined,
          stripeRefundId: refund.id
        }
      );

      logger.info('Refund created successfully', {
        paymentIntentId,
        refundId: refund.id,
        amount: refundAmount
      });

      return {
        refundId: refund.id,
        amount: formatAmountFromStripe(refund.amount, refund.currency),
        status: refund.status,
        currency: refund.currency
      };
    } catch (error) {
      logger.error('Failed to create refund', {
        error: error.message,
        paymentIntentId
      });
      throw error;
    }
  }

  /**
   * Create a customer
   * @param {Object} params - Customer parameters
   * @param {string} params.email - Customer email
   * @param {string} params.name - Customer name
   * @param {string} params.userId - User ID
   * @param {Object} params.metadata - Additional metadata
   * @returns {Object} Stripe customer
   */
  async createCustomer({ email, name, userId, metadata = {} }) {
    try {
      logger.info('Creating Stripe customer', { email, name, userId });

      const customer = await stripe.customers.create({
        email,
        name,
        metadata: {
          userId,
          ...metadata
        }
      });

      logger.info('Stripe customer created successfully', {
        customerId: customer.id,
        userId
      });

      return customer;
    } catch (error) {
      logger.error('Failed to create Stripe customer', {
        error: error.message,
        email,
        userId
      });
      throw error;
    }
  }

  /**
   * Retrieve customer
   * @param {string} customerId - Stripe customer ID
   * @returns {Object} Stripe customer
   */
  async retrieveCustomer(customerId) {
    try {
      logger.info('Retrieving Stripe customer', { customerId });

      const customer = await stripe.customers.retrieve(customerId);

      logger.info('Stripe customer retrieved successfully', { customerId });

      return customer;
    } catch (error) {
      logger.error('Failed to retrieve Stripe customer', {
        error: error.message,
        customerId
      });
      throw error;
    }
  }

  /**
   * Update customer
   * @param {string} customerId - Stripe customer ID
   * @param {Object} updates - Customer updates
   * @returns {Object} Updated customer
   */
  async updateCustomer(customerId, updates) {
    try {
      logger.info('Updating Stripe customer', { customerId, updates });

      const customer = await stripe.customers.update(customerId, updates);

      logger.info('Stripe customer updated successfully', { customerId });

      return customer;
    } catch (error) {
      logger.error('Failed to update Stripe customer', {
        error: error.message,
        customerId
      });
      throw error;
    }
  }

  /**
   * Delete customer
   * @param {string} customerId - Stripe customer ID
   * @returns {Object} Deletion confirmation
   */
  async deleteCustomer(customerId) {
    try {
      logger.info('Deleting Stripe customer', { customerId });

      const deleted = await stripe.customers.del(customerId);

      logger.info('Stripe customer deleted successfully', { customerId });

      return deleted;
    } catch (error) {
      logger.error('Failed to delete Stripe customer', {
        error: error.message,
        customerId
      });
      throw error;
    }
  }

  /**
   * Attach payment method to customer
   * @param {string} paymentMethodId - Payment method ID
   * @param {string} customerId - Customer ID
   * @returns {Object} Payment method
   */
  async attachPaymentMethod(paymentMethodId, customerId) {
    try {
      logger.info('Attaching payment method to customer', { paymentMethodId, customerId });

      const paymentMethod = await stripe.paymentMethods.attach(paymentMethodId, {
        customer: customerId
      });

      logger.info('Payment method attached successfully', { paymentMethodId, customerId });

      return paymentMethod;
    } catch (error) {
      logger.error('Failed to attach payment method', {
        error: error.message,
        paymentMethodId,
        customerId
      });
      throw error;
    }
  }

  /**
   * Detach payment method from customer
   * @param {string} paymentMethodId - Payment method ID
   * @returns {Object} Payment method
   */
  async detachPaymentMethod(paymentMethodId) {
    try {
      logger.info('Detaching payment method', { paymentMethodId });

      const paymentMethod = await stripe.paymentMethods.detach(paymentMethodId);

      logger.info('Payment method detached successfully', { paymentMethodId });

      return paymentMethod;
    } catch (error) {
      logger.error('Failed to detach payment method', {
        error: error.message,
        paymentMethodId
      });
      throw error;
    }
  }

  /**
   * List customer payment methods
   * @param {string} customerId - Customer ID
   * @param {string} type - Payment method type (default: 'card')
   * @returns {Array} Payment methods
   */
  async listPaymentMethods(customerId, type = 'card') {
    try {
      logger.info('Listing customer payment methods', { customerId, type });

      const paymentMethods = await stripe.paymentMethods.list({
        customer: customerId,
        type
      });

      logger.info('Payment methods retrieved successfully', {
        customerId,
        count: paymentMethods.data.length
      });

      return paymentMethods.data;
    } catch (error) {
      logger.error('Failed to list payment methods', {
        error: error.message,
        customerId
      });
      throw error;
    }
  }

  /**
   * Handle webhook event
   * @param {string} rawBody - Raw request body
   * @param {string} signature - Stripe signature header
   * @returns {Object} Processed event
   */
  async handleWebhook(rawBody, signature) {
    try {
      logger.info('Processing Stripe webhook');

      // Verify webhook signature and construct event
      if (!signature) {
        throw new Error('Missing Stripe signature header');
      }

      const event = constructWebhookEvent(rawBody, signature);

      logger.info('Webhook event received', { type: event.type, id: event.id });

      // Handle different event types
      switch (event.type) {
        case 'payment_intent.succeeded':
          await this.handlePaymentIntentSucceeded(event.data.object);
          break;

        case 'payment_intent.payment_failed':
          await this.handlePaymentIntentFailed(event.data.object);
          break;

        case 'payment_intent.canceled':
          await this.handlePaymentIntentCanceled(event.data.object);
          break;

        case 'charge.refunded':
          await this.handleChargeRefunded(event.data.object);
          break;

        case 'customer.created':
          await this.handleCustomerCreated(event.data.object);
          break;

        case 'customer.deleted':
          await this.handleCustomerDeleted(event.data.object);
          break;

        default:
          logger.info('Unhandled webhook event type', { type: event.type });
      }

      logger.info('Webhook processed successfully', { type: event.type, id: event.id });

      return event;
    } catch (error) {
      logger.error('Failed to process webhook', { error: error.message });
      throw error;
    }
  }

  /**
   * Handle payment intent succeeded event
   * @param {Object} paymentIntent - Payment intent object
   */
  async handlePaymentIntentSucceeded(paymentIntent) {
    try {
      logger.info('Handling payment intent succeeded', { paymentIntentId: paymentIntent.id });

      await Payment.findOneAndUpdate(
        { stripePaymentIntentId: paymentIntent.id },
        {
          status: 'completed',
          paidAt: new Date(),
          stripePaymentMethodId: paymentIntent.payment_method
        }
      );

      logger.info('Payment marked as completed', { paymentIntentId: paymentIntent.id });
    } catch (error) {
      logger.error('Failed to handle payment intent succeeded', {
        error: error.message,
        paymentIntentId: paymentIntent.id
      });
      throw error;
    }
  }

  /**
   * Handle payment intent failed event
   * @param {Object} paymentIntent - Payment intent object
   */
  async handlePaymentIntentFailed(paymentIntent) {
    try {
      logger.info('Handling payment intent failed', { paymentIntentId: paymentIntent.id });

      await Payment.findOneAndUpdate(
        { stripePay
