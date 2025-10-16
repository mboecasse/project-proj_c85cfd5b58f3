// File: src/middleware/webhookVerification.js
// Generated: 2025-10-16 10:50:39 UTC
// Project ID: proj_c85cfd5b58f3
// Task ID: task_sj9ls8kth76m


const crypto = require('crypto');


const logger = require('../utils/logger');


const paypalConfig = require('../config/paypal');


const stripeConfig = require('../config/stripe');

* Verifies webhook signatures from payment providers (Stripe, PayPal)
 * Prevents unauthorized webhook requests and replay attacks
 */

// Import payment provider configurations

/**
 * Raw Body Parser Middleware
 * Preserves raw request body for signature verification
 * Must be applied before JSON body parser
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */


const rawBodyParser = (req, res, next) => {
  let data = '';

  req.on('data', (chunk) => {
    data += chunk;
  });

  req.on('end', () => {
    req.rawBody = data;
    next();
  });

  req.on('error', (error) => {
    logger.error('Raw body parser error', { error: error.message });
    return res.status(500).json({
      success: false,
      error: 'Failed to parse request body'
    });
  });
};

/**
 * Stripe Webhook Verification Middleware
 * Verifies Stripe webhook signature using stripe-signature header
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */


const verifyStripeWebhook = async (req, res, next) => {
  try {
    const signature = req.headers['stripe-signature'];

    if (!signature) {
      logger.warn('Missing Stripe signature header');
      return res.status(400).json({
        success: false,
        error: 'Missing webhook signature'
      });
    }

    if (!req.rawBody) {
      logger.error('Raw body not available for Stripe webhook verification');
      return res.status(400).json({
        success: false,
        error: 'Invalid request body'
      });
    }

    // Verify webhook signature using Stripe SDK
    let event;
    try {
      event = stripeConfig.stripe.webhooks.constructEvent(
        req.rawBody,
        signature,
        stripeConfig.webhookSecret
      );
    } catch (err) {
      logger.warn('Stripe webhook signature verification failed', {
        error: err.message
      });
      return res.status(400).json({
        success: false,
        error: 'Invalid webhook signature'
      });
    }

    // Validate timestamp to prevent replay attacks (5 minute tolerance)
    const timestamp = event.created;
    const currentTime = Math.floor(Date.now() / 1000);
    const timeDifference = Math.abs(currentTime - timestamp);

    if (timeDifference > 300) {
      logger.warn('Stripe webhook timestamp too old', {
        timestamp,
        currentTime,
        difference: timeDifference
      });
      return res.status(400).json({
        success: false,
        error: 'Webhook timestamp too old'
      });
    }

    // Attach verified event to request
    req.webhookEvent = event;
    req.webhookProvider = 'stripe';

    logger.info('Stripe webhook verified successfully', {
      eventType: event.type,
      eventId: event.id
    });

    next();
  } catch (error) {
    logger.error('Stripe webhook verification error', {
      error: error.message,
      stack: error.stack
    });
    return res.status(500).json({
      success: false,
      error: 'Webhook verification failed'
    });
  }
};

/**
 * PayPal Webhook Verification Middleware
 * Verifies PayPal webhook signature using transmission headers
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */


const verifyPayPalWebhook = async (req, res, next) => {
  try {
    // Extract required PayPal headers
    const transmissionId = req.headers['paypal-transmission-id'];
    const transmissionTime = req.headers['paypal-transmission-time'];
    const transmissionSig = req.headers['paypal-transmission-sig'];
    const certUrl = req.headers['paypal-cert-url'];
    const authAlgo = req.headers['paypal-auth-algo'];

    // Validate all required headers are present
    if (!transmissionId || !transmissionTime || !transmissionSig || !certUrl || !authAlgo) {
      logger.warn('Missing required PayPal webhook headers', {
        hasTransmissionId: !!transmissionId,
        hasTransmissionTime: !!transmissionTime,
        hasTransmissionSig: !!transmissionSig,
        hasCertUrl: !!certUrl,
        hasAuthAlgo: !!authAlgo
      });
      return res.status(400).json({
        success: false,
        error: 'Missing required webhook headers'
      });
    }

    if (!req.rawBody) {
      logger.error('Raw body not available for PayPal webhook verification');
      return res.status(400).json({
        success: false,
        error: 'Invalid request body'
      });
    }

    // Validate timestamp to prevent replay attacks (5 minute tolerance)
    const webhookTime = new Date(transmissionTime).getTime();
    const currentTime = Date.now();
    const timeDifference = Math.abs(currentTime - webhookTime) / 1000;

    if (timeDifference > 300) {
      logger.warn('PayPal webhook timestamp too old', {
        transmissionTime,
        currentTime: new Date(currentTime).toISOString(),
        difference: timeDifference
      });
      return res.status(400).json({
        success: false,
        error: 'Webhook timestamp too old'
      });
    }

    // Prepare verification data
    const webhookEvent = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

    const verificationData = {
      transmission_id: transmissionId,
      transmission_time: transmissionTime,
      cert_url: certUrl,
      auth_algo: authAlgo,
      transmission_sig: transmissionSig,
      webhook_id: paypalConfig.webhookId,
      webhook_event: webhookEvent
    };

    // Verify webhook signature using PayPal SDK
    let verificationResult;
    try {
      verificationResult = await paypalConfig.verifyWebhookSignature(verificationData);
    } catch (err) {
      logger.warn('PayPal webhook signature verification failed', {
        error: err.message
      });
      return res.status(400).json({
        success: false,
        error: 'Invalid webhook signature'
      });
    }

    // Check verification status
    if (verificationResult.verification_status !== 'SUCCESS') {
      logger.warn('PayPal webhook verification status not SUCCESS', {
        status: verificationResult.verification_status
      });
      return res.status(400).json({
        success: false,
        error: 'Webhook verification failed'
      });
    }

    // Attach verified event to request
    req.webhookEvent = webhookEvent;
    req.webhookProvider = 'paypal';

    logger.info('PayPal webhook verified successfully', {
      eventType: webhookEvent.event_type,
      eventId: webhookEvent.id
    });

    next();
  } catch (error) {
    logger.error('PayPal webhook verification error', {
      error: error.message,
      stack: error.stack
    });
    return res.status(500).json({
      success: false,
      error: 'Webhook verification failed'
    });
  }
};

/**
 * Generic Webhook Verification Middleware
 * Routes to appropriate provider verification based on path or header
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */


const verifyWebhook = async (req, res, next) => {
  try {
    // Determine provider from path or headers
    const path = req.path.toLowerCase();

    if (path.includes('stripe') || req.headers['stripe-signature']) {
      return verifyStripeWebhook(req, res, next);
    } else if (path.includes('paypal') || req.headers['paypal-transmission-id']) {
      return verifyPayPalWebhook(req, res, next);
    } else {
      logger.warn('Unable to determine webhook provider', {
        path: req.path,
        headers: Object.keys(req.headers)
      });
      return res.status(400).json({
        success: false,
        error: 'Unable to determine webhook provider'
      });
    }
  } catch (error) {
    logger.error('Webhook verification routing error', {
      error: error.message,
      stack: error.stack
    });
    return res.status(500).json({
      success: false,
      error: 'Webhook verification failed'
    });
  }
};


const WebhookVerification = {
  verifyStripeWebhook,
  verifyPayPalWebhook,
  verifyWebhook,
  rawBodyParser
};

module.exports = { WebhookVerification };
