// File: src/config/paypal.js
// Generated: 2025-10-16 10:40:05 UTC
// Project ID: proj_c85cfd5b58f3
// Task ID: task_8l2ejjnuc090


const logger = require('../utils/logger');


const paypal = require('@paypal/checkout-server-sdk');

/**
 * Validates required PayPal environment variables
 * @throws {Error} If required environment variables are missing
 */


const validateEnvironmentVariables = () => {
  const requiredVars = ['PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET'];
  const missingVars = requiredVars.filter(varName => !process.env[varName]);

  if (missingVars.length > 0) {
    const errorMessage = `Missing required PayPal environment variables: ${missingVars.join(', ')}`;
    logger.error('PayPal configuration error', { missingVars });
    throw new Error(errorMessage);
  }
};

/**
 * Determines the PayPal environment based on configuration
 * @returns {Object} PayPal environment instance (Sandbox or Live)
 */


const getPayPalEnvironment = () => {
  const mode = process.env.PAYPAL_MODE || 'sandbox';
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

  if (mode === 'live' || mode === 'production') {
    logger.info('Initializing PayPal in LIVE mode');
    return new paypal.core.LiveEnvironment(clientId, clientSecret);
  }

  logger.info('Initializing PayPal in SANDBOX mode');
  return new paypal.core.SandboxEnvironment(clientId, clientSecret);
};

/**
 * Initialize PayPal configuration
 */

let paypalClient;

let paypalEnvironment;

try {
  // Validate environment variables
  validateEnvironmentVariables();

  // Create PayPal environment
  paypalEnvironment = getPayPalEnvironment();

  // Create PayPal HTTP client
  paypalClient = new paypal.core.PayPalHttpClient(paypalEnvironment);

  logger.info('PayPal SDK initialized successfully', {
    mode: process.env.PAYPAL_MODE || 'sandbox',
    currency: process.env.PAYPAL_CURRENCY || 'USD'
  });
} catch (error) {
  logger.error('Failed to initialize PayPal SDK', {
    error: error.message,
    stack: error.stack
  });
  // For payment functionality, fail fast if configuration is invalid
  process.exit(1);
}

/**
 * PayPal configuration object
 */


const paypalConfig = {
  mode: process.env.PAYPAL_MODE || 'sandbox',
  currency: process.env.PAYPAL_CURRENCY || 'USD',
  returnUrl: process.env.PAYPAL_RETURN_URL || `${process.env.BASE_URL || 'http://localhost:3000'}/api/payments/success`,
  cancelUrl: process.env.PAYPAL_CANCEL_URL || `${process.env.BASE_URL || 'http://localhost:3000'}/api/payments/cancel`,
  webhookId: process.env.PAYPAL_WEBHOOK_ID || '',
  timeout: parseInt(process.env.PAYPAL_TIMEOUT || '30000', 10),
  maxRetries: parseInt(process.env.PAYPAL_MAX_RETRIES || '3', 10),
  brandName: process.env.PAYPAL_BRAND_NAME || 'E-Commerce Store',
  landingPage: process.env.PAYPAL_LANDING_PAGE || 'BILLING',
  shippingPreference: process.env.PAYPAL_SHIPPING_PREFERENCE || 'GET_FROM_FILE'
};

/**
 * Get configured PayPal client instance
 * @returns {Object} PayPal HTTP client
 */


const getPayPalClient = () => {
  if (!paypalClient) {
    logger.error('PayPal client not initialized');
    throw new Error('PayPal client is not initialized');
  }
  return paypalClient;
};

/**
 * Format amount for PayPal API
 * @param {number|string} amount - Amount to format
 * @param {string} currency - Currency code (default: USD)
 * @returns {Object} Formatted amount object
 */


const formatAmount = (amount, currency = paypalConfig.currency) => {
  try {
    const numericAmount = parseFloat(amount);

    if (isNaN(numericAmount) || numericAmount < 0) {
      throw new Error('Invalid amount provided');
    }

    return {
      currency_code: currency.toUpperCase(),
      value: numericAmount.toFixed(2)
    };
  } catch (error) {
    logger.error('Failed to format amount for PayPal', {
      amount,
      currency,
      error: error.message
    });
    throw error;
  }
};

/**
 * Format item for PayPal API
 * @param {Object} item - Item object with name, quantity, price
 * @returns {Object} Formatted item object
 */


const formatItem = (item) => {
  try {
    return {
      name: item.name || 'Product',
      description: item.description || '',
      sku: item.sku || item._id.toString() || '',
      unit_amount: formatAmount(item.price || item.unitPrice),
      quantity: item.quantity?.toString() || '1',
      category: item.category || 'PHYSICAL_GOODS'
    };
  } catch (error) {
    logger.error('Failed to format item for PayPal', {
      item,
      error: error.message
    });
    throw error;
  }
};

/**
 * Verify PayPal webhook signature
 * @param {Object} headers - Request headers
 * @param {Object} body - Request body
 * @returns {Promise<boolean>} True if signature is valid
 */


const verifyWebhookSignature = async (headers, body) => {
  try {
    if (!paypalConfig.webhookId) {
      logger.warn('PayPal webhook ID not configured, skipping signature verification');
      return true;
    }

    const transmissionId = headers['paypal-transmission-id'];
    const transmissionTime = headers['paypal-transmission-time'];
    const certUrl = headers['paypal-cert-url'];
    const authAlgo = headers['paypal-auth-algo'];
    const transmissionSig = headers['paypal-transmission-sig'];

    if (!transmissionId || !transmissionTime || !certUrl || !authAlgo || !transmissionSig) {
      logger.error('Missing required webhook headers');
      return false;
    }

    const webhookEvent = {
      auth_algo: authAlgo,
      cert_url: certUrl,
      transmission_id: transmissionId,
      transmission_sig: transmissionSig,
      transmission_time: transmissionTime,
      webhook_id: paypalConfig.webhookId,
      webhook_event: body
    };

    const request = new paypal.notifications.WebhookVerifySignature(webhookEvent);
    const response = await paypalClient.execute(request);

    const isValid = response.result.verification_status === 'SUCCESS';

    if (!isValid) {
      logger.warn('PayPal webhook signature verification failed', {
        transmissionId,
        verificationStatus: response.result.verification_status
      });
    }

    return isValid;
  } catch (error) {
    logger.error('Error verifying PayPal webhook signature', {
      error: error.message,
      stack: error.stack
    });
    return false;
  }
};

/**
 * Create purchase units for PayPal order
 * @param {Object} orderData - Order data with items and amounts
 * @returns {Array} Purchase units array
 */


const createPurchaseUnits = (orderData) => {
  try {
    const items = orderData.items?.map(item => formatItem(item)) || [];

    const itemTotal = items.reduce((sum, item) => {
      return sum + (parseFloat(item.unit_amount.value) * parseInt(item.quantity));
    }, 0);

    const shippingAmount = parseFloat(orderData.shippingAmount || 0);
    const taxAmount = parseFloat(orderData.taxAmount || 0);
    const totalAmount = itemTotal + shippingAmount + taxAmount;

    const purchaseUnit = {
      reference_id: orderData.referenceId || orderData.orderId || 'default',
      description: orderData.description || 'Order from E-Commerce Store',
      amount: {
        currency_code: paypalConfig.currency,
        value: totalAmount.toFixed(2),
        breakdown: {
          item_total: formatAmount(itemTotal),
          shipping: formatAmount(shippingAmount),
          tax_total: formatAmount(taxAmount)
        }
      }
    };

    if (items.length > 0) {
      purchaseUnit.items = items;
    }

    if (orderData.shippingAddress) {
      purchaseUnit.shipping = {
        name: {
          full_name: orderData.shippingAddress.fullName || orderData.shippingAddress.name
        },
        address: {
          address_line_1: orderData.shippingAddress.addressLine1 || orderData.shippingAddress.street,
          address_line_2: orderData.shippingAddress.addressLine2 || '',
          admin_area_2: orderData.shippingAddress.city,
          admin_area_1: orderData.shippingAddress.state,
          postal_code: orderData.shippingAddress.postalCode || orderData.shippingAddress.zipCode,
          country_code: orderData.shippingAddress.countryCode || 'US'
        }
      };
    }

    return [purchaseUnit];
  } catch (error) {
    logger.error('Failed to create purchase units', {
      orderData,
      error: error.message
    });
    throw error;
  }
};

/**
 * Get PayPal order status from response
 * @param {Object} order - PayPal order object
 * @returns {string} Order status
 */


const getOrderStatus = (order) => {
  return order?.status || 'UNKNOWN';
};

/**
 * Check if PayPal order is approved
 * @param {Object} order - PayPal order object
 * @returns {boolean} True if order is approved
 */


const isOrderApproved = (order) => {
  return getOrderStatus(order) === 'APPROVED';
};

/**
 * Check if PayPal order is completed
 * @param {Object} order - PayPal order object
 * @returns {boolean} True if order is completed
 */


const isOrderCompleted = (order) => {
  return getOrderStatus(order) === 'COMPLETED';
};

/**
 * Extract capture ID from PayPal order
 * @param {Object} order - PayPal order object
 * @returns {string|null} Capture ID or null
 */


const getCaptureId = (order) => {
  try {
    const purchaseUnit = order?.purchase_units?.[0];
    const capture = purchaseUnit?.payments?.captures?.[0];
    return capture?.id || null;
  } catch (error) {
    logger.error('Failed to extract capture ID', {
      error: error.message
    });
    return null;
  }
};

module.exports = {
  paypalClient,
  paypalConfig,
  paypalEnvironment,
  getPayPalClient,
  formatAmount,
  formatItem,
  verifyWebhookSignature,
  createPurchaseUnits,
  getOrderStatus,
  isOrderApproved,
  isOrderCompleted,
  getCaptureId
};
