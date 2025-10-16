// File: src/config/stripe.js
// Generated: 2025-10-16 10:39:21 UTC
// Project ID: proj_c85cfd5b58f3
// Task ID: task_acdh97eny1up


const Stripe = require('stripe');


const logger = require('../utils/logger');

async * - STRIPE_CURRENCY: Default currency (optional, defaults to 'usd')
 * - STRIPE_API_VERSION: API version to use (optional, defaults to '2023-10-16')
 */

/**
 * Validate required environment variables
 */


const validateEnvironment = () => {
  const requiredEnvVars = [
    'STRIPE_SECRET_KEY',
    'STRIPE_PUBLISHABLE_KEY',
    'STRIPE_WEBHOOK_SECRET'
  ];

  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

  if (missingVars.length > 0) {
    const errorMsg = `Missing required Stripe environment variables: ${missingVars.join(', ')}`;
    logger.error(errorMsg);
    throw new Error(errorMsg);
  }

  // Validate key format
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY;

  if (!secretKey.startsWith('sk_')) {
    throw new Error('Invalid STRIPE_SECRET_KEY format. Must start with sk_test_ or sk_live_');
  }

  if (!publishableKey.startsWith('pk_')) {
    throw new Error('Invalid STRIPE_PUBLISHABLE_KEY format. Must start with pk_test_ or pk_live_');
  }

  // Validate key consistency (test vs production)
  const isTestSecret = secretKey.startsWith('sk_test_');
  const isTestPublishable = publishableKey.startsWith('pk_test_');

  if (isTestSecret !== isTestPublishable) {
    throw new Error('Stripe key mismatch: Secret and publishable keys must both be test or both be live');
  }

  logger.info('Stripe environment variables validated successfully', {
    mode: isTestSecret ? 'test' : 'live'
  });
};

/**
 * Initialize Stripe SDK
 */

let stripe;

try {
  validateEnvironment();

  const apiVersion = process.env.STRIPE_API_VERSION || '2023-10-16';

  stripe = Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: apiVersion,
    maxNetworkRetries: 3,
    timeout: 20000, // 20 seconds
    telemetry: false, // Disable telemetry in production
    appInfo: {
      name: 'E-commerce Backend',
      version: '1.0.0'
    }
  });

  logger.info('Stripe SDK initialized successfully', {
    apiVersion: apiVersion,
    mode: process.env.STRIPE_SECRET_KEY.startsWith('sk_test_') ? 'test' : 'live'
  });
} catch (error) {
  logger.error('Failed to initialize Stripe SDK', {
    error: error.message
  });
  throw error;
}

/**
 * Stripe configuration object
 */


const config = {
  // Main Stripe instance
  stripe: stripe,

  // Publishable key for client-side integration
  publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,

  // Webhook secret for signature verification
  webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,

  // Default currency for transactions
  currency: process.env.STRIPE_CURRENCY || 'usd',

  // Supported payment methods
  paymentMethods: [
    'card',
    'apple_pay',
    'google_pay'
  ],

  // Payment capture method
  captureMethod: 'automatic', // 'automatic' or 'manual'

  // Statement descriptor (max 22 characters)
  statementDescriptor: process.env.STRIPE_STATEMENT_DESCRIPTOR || 'E-COMMERCE STORE',

  // Automatic payment methods configuration
  automaticPaymentMethods: {
    enabled: true
  },

  // Shipping options
  shippingOptions: [
    {
      shipping_rate_data: {
        type: 'fixed_amount',
        fixed_amount: {
          amount: 0,
          currency: process.env.STRIPE_CURRENCY || 'usd'
        },
        display_name: 'Free shipping',
        delivery_estimate: {
          minimum: {
            unit: 'business_day',
            value: 5
          },
          maximum: {
            unit: 'business_day',
            value: 7
          }
        }
      }
    },
    {
      shipping_rate_data: {
        type: 'fixed_amount',
        fixed_amount: {
          amount: 1500,
          currency: process.env.STRIPE_CURRENCY || 'usd'
        },
        display_name: 'Express shipping',
        delivery_estimate: {
          minimum: {
            unit: 'business_day',
            value: 1
          },
          maximum: {
            unit: 'business_day',
            value: 3
          }
        }
      }
    }
  ],

  // Mode detection
  isTestMode: process.env.STRIPE_SECRET_KEY.startsWith('sk_test_'),

  // API version
  apiVersion: process.env.STRIPE_API_VERSION || '2023-10-16'
};

/**
 * Verify Stripe connection (optional health check)
 */


const verifyConnection = async () => {
  try {
    await stripe.paymentIntents.list({ limit: 1 });
    logger.info('Stripe connection verified successfully');
    return true;
  } catch (error) {
    logger.error('Stripe connection verification failed', {
      error: error.message
    });
    return false;
  }
};

/**
 * Construct webhook event from request
 *
 * @param {Object} payload - Raw request body
 * @param {string} signature - Stripe signature header
 * @returns {Object} Stripe event object
 */


const constructWebhookEvent = (payload, signature) => {
  try {
    const event = stripe.webhooks.constructEvent(
      payload,
      signature,
      config.webhookSecret
    );
    return event;
  } catch (error) {
    logger.error('Webhook signature verification failed', {
      error: error.message
    });
    throw new Error('Webhook signature verification failed');
  }
};

/**
 * Format amount for Stripe (convert to cents)
 *
 * @param {number} amount - Amount in dollars
 * @returns {number} Amount in cents
 */


const formatAmountForStripe = (amount) => {
  return Math.round(amount * 100);
};

/**
 * Format amount from Stripe (convert from cents)
 *
 * @param {number} amount - Amount in cents
 * @returns {number} Amount in dollars
 */


const formatAmountFromStripe = (amount) => {
  return amount / 100;
};

module.exports = {
  stripe,
  config,
  verifyConnection,
  constructWebhookEvent,
  formatAmountForStripe,
  formatAmountFromStripe
};
