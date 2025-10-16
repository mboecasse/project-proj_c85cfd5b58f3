// File: src/services/paypal.service.js
// Generated: 2025-10-16 10:51:23 UTC
// Project ID: proj_c85cfd5b58f3
// Task ID: task_e4vzgcyepsak


const Payment = require('../models/Payment');


const checkoutNodeJssdk = require('@paypal/checkout-server-sdk');


const config = require('../config/paypal');


const logger = require('../utils/logger');

/**
 * PayPal Service Class
 * Manages all PayPal payment operations
 */
class PayPalService {
  constructor() {
    this.client = this.initializeClient();
  }

  /**
   * Initialize PayPal client based on environment
   * @returns {checkoutNodeJssdk.core.PayPalHttpClient} PayPal HTTP client
   */
  initializeClient() {
    try {
      let environment;

      if (config.mode === 'live') {
        environment = new checkoutNodeJssdk.core.LiveEnvironment(
          config.clientId,
          config.clientSecret
        );
        logger.info('PayPal client initialized in LIVE mode');
      } else {
        environment = new checkoutNodeJssdk.core.SandboxEnvironment(
          config.clientId,
          config.clientSecret
        );
        logger.info('PayPal client initialized in SANDBOX mode');
      }

      return new checkoutNodeJssdk.core.PayPalHttpClient(environment);
    } catch (error) {
      logger.error('Failed to initialize PayPal client', { error: error.message });
      throw new Error(`PayPal initialization failed: ${error.message}`);
    }
  }

  /**
   * Create PayPal order with itemized breakdown
   * @param {Object} orderData - Order details
   * @param {string} orderData.orderId - Internal order ID
   * @param {number} orderData.amount - Total amount
   * @param {string} orderData.currency - Currency code (USD, EUR, etc.)
   * @param {Array} orderData.items - Array of order items
   * @param {number} orderData.itemTotal - Subtotal of items
   * @param {number} orderData.shipping - Shipping cost
   * @param {number} orderData.tax - Tax amount
   * @param {string} orderData.returnUrl - Success return URL
   * @param {string} orderData.cancelUrl - Cancel return URL
   * @returns {Promise<Object>} PayPal order details with approval URL
   */
  async createOrder(orderData) {
    try {
      // Validate required parameters
      if (!orderData) {
        throw new Error('orderData is required');
      }

      const {
        orderId,
        amount,
        currency = 'USD',
        items = [],
        itemTotal,
        shipping = 0,
        tax = 0,
        returnUrl,
        cancelUrl
      } = orderData;

      // Validate required fields
      if (!orderId) {
        throw new Error('orderId is required');
      }
      if (amount === undefined || amount === null || typeof amount !== 'number') {
        throw new Error('amount is required and must be a number');
      }
      if (!returnUrl) {
        throw new Error('returnUrl is required');
      }
      if (!cancelUrl) {
        throw new Error('cancelUrl is required');
      }
      if (itemTotal === undefined || itemTotal === null || typeof itemTotal !== 'number') {
        throw new Error('itemTotal is required and must be a number');
      }

      // Build purchase units with itemized breakdown
      const purchaseUnits = [{
        reference_id: orderId,
        amount: {
          currency_code: currency,
          value: amount.toFixed(2),
          breakdown: {
            item_total: {
              currency_code: currency,
              value: itemTotal.toFixed(2)
            },
            shipping: {
              currency_code: currency,
              value: shipping.toFixed(2)
            },
            tax_total: {
              currency_code: currency,
              value: tax.toFixed(2)
            }
          }
        },
        items: items.map(item => ({
          name: item.name,
          description: item.description || '',
          unit_amount: {
            currency_code: currency,
            value: item.price.toFixed(2)
          },
          quantity: item.quantity.toString(),
          sku: item.sku || ''
        }))
      }];

      // Create order request
      const request = new checkoutNodeJssdk.orders.OrdersCreateRequest();
      request.prefer('return=representation');
      request.requestBody({
        intent: 'CAPTURE',
        purchase_units: purchaseUnits,
        application_context: {
          brand_name: 'Your Store Name',
          landing_page: 'BILLING',
          user_action: 'PAY_NOW',
          return_url: returnUrl,
          cancel_url: cancelUrl
        }
      });

      // Execute request
      const response = await this.client.execute(request);
      const paypalOrderId = response.result.id;

      // Find approval URL
      const approvalUrl = response.result.links.find(
        link => link.rel === 'approve'
      )?.href;

      // Save payment record
      const payment = await Payment.create({
        orderId,
        paypalOrderId,
        amount,
        currency,
        status: 'CREATED',
        provider: 'paypal',
        metadata: {
          items: items.map(item => ({
            name: item.name,
            quantity: item.quantity,
            price: item.price
          })),
          shipping,
          tax
        }
      });

      logger.info('PayPal order created successfully', {
        orderId,
        paypalOrderId,
        amount,
        currency
      });

      return {
        paypalOrderId,
        approvalUrl,
        payment
      };
    } catch (error) {
      logger.error('Failed to create PayPal order', {
        orderId: orderData?.orderId,
        error: error.message,
        details: error.statusCode ? JSON.stringify(error.message) : null
      });

      if (error.statusCode) {
        const errorMessage = error.message ? JSON.parse(error.message) : {};
        throw new Error(
          `PayPal Error: ${errorMessage.name || 'UNKNOWN'} - ${errorMessage.message || error.message}`
        );
      }

      throw new Error(`Failed to create PayPal order: ${error.message}`);
    }
  }

  /**
   * Capture payment for approved PayPal order
   * @param {string} paypalOrderId - PayPal order ID
   * @returns {Promise<Object>} Capture result with payment details
   */
  async capturePayment(paypalOrderId) {
    try {
      // Execute capture request
      const request = new checkoutNodeJssdk.orders.OrdersCaptureRequest(paypalOrderId);
      request.requestBody({});

      const response = await this.client.execute(request);
      const captureData = response.result;

      // Extract capture details
      const captureId = captureData.purchase_units[0].payments.captures[0].id;
      const captureStatus = captureData.purchase_units[0].payments.captures[0].status;
      const payerEmail = captureData.payer?.email_address;
      const payerId = captureData.payer?.payer_id;

      // Update payment record
      const payment = await Payment.findOneAndUpdate(
        { paypalOrderId },
        {
          status: captureStatus === 'COMPLETED' ? 'COMPLETED' : 'FAILED',
          captureId,
          payerEmail,
          payerId,
          capturedAt: new Date(),
          transactionDetails: {
            captureId,
            status: captureStatus,
            payerEmail,
            payerId,
            capturedAt: new Date()
          }
        },
        { new: true }
      );

      if (!payment) {
        logger.warn('Payment record not found for PayPal order', { paypalOrderId });
      }

      logger.info('PayPal payment captured successfully', {
        paypalOrderId,
        captureId,
        status: captureStatus
      });

      return {
        success: captureStatus === 'COMPLETED',
        captureId,
        status: captureStatus,
        payment
      };
    } catch (error) {
      logger.error('Failed to capture PayPal payment', {
        paypalOrderId,
        error: error.message,
        details: error.statusCode ? JSON.stringify(error.message) : null
      });

      // Update payment status to failed
      await Payment.findOneAndUpdate(
        { paypalOrderId },
        {
          status: 'FAILED',
          metadata: {
            error: error.message,
            failedAt: new Date()
          }
        }
      );

      if (error.statusCode) {
        const errorMessage = error.message ? JSON.parse(error.message) : {};
        throw new Error(
          `PayPal Error: ${errorMessage.name || 'UNKNOWN'} - ${errorMessage.message || error.message}`
        );
      }

      throw new Error(`Failed to capture PayPal payment: ${error.message}`);
    }
  }

  /**
   * Refund captured payment (full or partial)
   * @param {string} captureId - PayPal capture ID
   * @param {number} refundAmount - Amount to refund (optional, full refund if not provided)
   * @returns {Promise<Object>} Refund result
   */
  async refundPayment(captureId, refundAmount = null) {
    try {
      // Build refund request
      const request = new checkoutNodeJssdk.payments.CapturesRefundRequest(captureId);

      const requestBody = {};
      if (refundAmount) {
        // Find payment to get currency
        const payment = await Payment.findOne({ captureId });
        if (!payment) {
          throw new Error('Payment not found for capture ID');
        }

        requestBody.amount = {
          value: refundAmount.toFixed(2),
          currency_code: payment.currency
        };
      }

      request.requestBody(requestBody);

      // Execute refund
      const response = await this.client.execute(request);
      const refundData = response.result;
      const refundId = refundData.id;
      const refundStatus = refundData.status;

      // Update payment record
      const payment = await Payment.findOneAndUpdate(
        { captureId },
        {
          status: 'REFUNDED',
          refundId,
          refundedAmount: refundAmount || '$original',
          refundedAt: new Date(),
          metadata: {
            refundId,
            refundStatus,
            refundedAmount: refundAmount,
            refundedAt: new Date()
          }
        },
        { new: true }
      );

      logger.info('PayPal payment refunded successfully', {
        captureId,
        refundId,
        refundAmount,
        status: refundStatus
      });

      return {
        refundId,
        status: refundStatus,
        payment
      };
    } catch (error) {
      logger.error('Failed to refund PayPal payment', {
        captureId,
        refundAmount,
        error: error.message,
        details: error.statusCode ? JSON.stringify(error.message) : null
      });

      if (error.statusCode) {
        const errorMessage = error.message ? JSON.parse(error.message) : {};
        throw new Error(
          `PayPal Error: ${errorMessage.name || 'UNKNOWN'} - ${errorMessage.message || error.message}`
        );
      }

      throw new Error(`Failed to refund PayPal payment: ${error.message}`);
    }
  }

  /**
   * Get payment details from PayPal
   * @param {string} paypalOrderId - PayPal order ID
   * @returns {Promise<Object>} Order details
   */
  async getPaymentDetails(paypalOrderId) {
    try {
      const request = new checkoutNodeJssdk.orders.OrdersGetRequest(paypalOrderId);
      const response = await this.client.execute(request);

      logger.info('Retrieved PayPal order details', { paypalOrderId });

      return response.result;
    } catch (error) {
      logger.error('Failed to get PayPal order details', {
        paypalOrderId,
        error: error.message
      });

      if (error.statusCode) {
        const errorMessage = error.message ? JSON.parse(error.message) : {};
        throw new Error(
          `PayPal Error: ${errorMessage.name || 'UNKNOWN'} - ${errorMessage.message || error.message}`
        );
      }

      throw new Error(`Failed to get PayPal order details: ${error.message}`);
    }
  }

  /**
   * Verify PayPal webhook signature
   * @param {Object} headers - Request headers
   * @param {Object} body - Request body
   * @returns {Promise<boolean>} Verification result
   */
  async verifyWebhookSignature(headers, body) {
    try {
      const request = new checkoutNodeJssdk.notifications.VerifyWebhookSignatureRequest();

      request.requestBody({
        auth_algo: headers['paypal-auth-algo'],
        cert_url: headers['paypal-cert-url'],
        transmission_id: headers['paypal-transmission-id'],
        transmission_sig: headers['paypal-transmission-sig'],
        transmission_time: headers['paypal-transmission-time'],
        webhook_id: config.webhookId,
        webhook_event: body
      });

      const response = await this.client.execute(request);
      const verified = response.result.verification_status === 'SUCCESS';

      logger.info('PayPal webhook signature verification', {
        verified,
        transmissionId: headers['paypal-transmission-id']
      });

      return verified;
    } catch (error) {
      logger.error('Failed to verify PayPal webhook signature', {
        error: error.message
      });
      return false;
    }
  }

  /**
   * Handle PayPal webhook events
   * @param {Object} headers - Request headers
   * @param {Object} event - Webhook event data
   * @returns {Promise<void>}
   */
  async handleWebhook(headers, event) {
    try {
      // Verify webhook signature before processing
      const isValid = await this.verifyWebhookSignature(headers, event);

      if (!isValid) {
        logger.error('Invalid webhook signature - potential spoofing attack', {
          eventId: event.id,
          eventType: event.event_type
        });
        throw new Error('Invalid webhook signature');
      }

      const eventType = event.event_type;
      const resource = event.resource;

      logger.info('Processing PayPal webhook event', {
        eventType,
        eventId: event.id
      });

      switch (eventType) {
        case 'PAYMENT.CAPTURE.COMPLETED':
          await this.handleCaptureCompleted(resource);
          break;

        case 'PAYMENT.CAPTURE.DENIED':
          await this.handleCaptureDenied(resource);
          break;

        case 'PAYMENT.CAPTURE.REFUNDED':
          await this.handleCaptureRefunded(resource);
          break;

        default:
          logger.info('Unhandled PayPal webhook event type', { eventType });
      }
    } catch (error) {
      logger.error('Failed to handle PayPal webhook', {
        eventType: event.event_type,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Handle PAYMENT.CAPTURE.COMPLETED webhook
   * @param {Object} resource - Capture resource
   * @private
   */
  async handleCaptureCompleted(resource) {
    try {
      const captureId = resource.id;
      const status = resource.status;

      await Payment.findOneAndUpdate(
        { captureId },
        {
          status: 'COMPLETED',
          capturedAt: new Date(),
          transactionDetails: {
            captureId,
            status,
            completedAt: new Date()
          }
        }
      );

      logger.info('
