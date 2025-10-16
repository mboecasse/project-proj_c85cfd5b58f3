// File: src/config/sendgrid.js
// Generated: 2025-10-16 10:39:53 UTC
// Project ID: proj_c85cfd5b58f3
// Task ID: task_kpj8vqhre8db


const config = require('./environment');


const logger = require('../utils/logger');


const sgMail = require('@sendgrid/mail');

/**
 * Email template IDs from SendGrid dashboard
 * @constant {Object}
 */


const EMAIL_TEMPLATES = {
  ORDER_CONFIRMATION: process.env.SENDGRID_TEMPLATE_ORDER_CONFIRMATION || 'd-order-confirmation',
  ORDER_SHIPPED: process.env.SENDGRID_TEMPLATE_ORDER_SHIPPED || 'd-order-shipped',
  ORDER_DELIVERED: process.env.SENDGRID_TEMPLATE_ORDER_DELIVERED || 'd-order-delivered',
  ORDER_CANCELLED: process.env.SENDGRID_TEMPLATE_ORDER_CANCELLED || 'd-order-cancelled',
  PASSWORD_RESET: process.env.SENDGRID_TEMPLATE_PASSWORD_RESET || 'd-password-reset',
  WELCOME_EMAIL: process.env.SENDGRID_TEMPLATE_WELCOME || 'd-welcome',
  PAYMENT_FAILED: process.env.SENDGRID_TEMPLATE_PAYMENT_FAILED || 'd-payment-failed',
  PAYMENT_SUCCESS: process.env.SENDGRID_TEMPLATE_PAYMENT_SUCCESS || 'd-payment-success',
  CART_ABANDONMENT: process.env.SENDGRID_TEMPLATE_CART_ABANDONMENT || 'd-cart-abandonment',
  ACCOUNT_VERIFICATION: process.env.SENDGRID_TEMPLATE_ACCOUNT_VERIFICATION || 'd-account-verification',
  SHIPPING_UPDATE: process.env.SENDGRID_TEMPLATE_SHIPPING_UPDATE || 'd-shipping-update'
};

/**
 * Email categories for tracking and analytics
 * @constant {Object}
 */


const EMAIL_CATEGORIES = {
  TRANSACTIONAL: 'transactional',
  MARKETING: 'marketing',
  NOTIFICATION: 'notification',
  ORDER_UPDATE: 'order_update',
  AUTHENTICATION: 'authentication',
  PAYMENT: 'payment'
};

/**
 * Tracking settings for email analytics
 * @constant {Object}
 */


const TRACKING_SETTINGS = {
  clickTracking: {
    enable: true,
    enableText: false
  },
  openTracking: {
    enable: true
  },
  subscriptionTracking: {
    enable: false
  }
};

/**
 * Mail settings configuration
 * @constant {Object}
 */


const MAIL_SETTINGS = {
  sandboxMode: {
    enable: process.env.NODE_ENV !== 'production'
  },
  bypassListManagement: {
    enable: false
  }
};

/**
 * Get sender email configuration
 * @returns {Object} Sender email and name
 */


const getSenderEmail = () => {
  return {
    email: process.env.SENDGRID_FROM_EMAIL,
    name: process.env.SENDGRID_FROM_NAME || process.env.SENDGRID_FROM_EMAIL
  };
};

/**
 * Get reply-to email if configured
 * @returns {string|null} Reply-to email or null
 */


const getReplyToEmail = () => {
  return process.env.SENDGRID_REPLY_TO_EMAIL || null;
};

/**
 * Check if SendGrid is properly configured
 * @returns {boolean} True if configured, false otherwise
 */


const isConfigured = () => {
  return !!(
    process.env.SENDGRID_API_KEY &&
    process.env.SENDGRID_FROM_EMAIL
  );
};

/**
 * Get webhook verification key
 * @returns {string|null} Webhook verification key or null
 */


const getWebhookVerificationKey = () => {
  return process.env.SENDGRID_WEBHOOK_VERIFICATION_KEY || null;
};

/**
 * Get template ID by template name
 * @param {string} templateName - Name of the template
 * @returns {string|null} Template ID or null if not found
 */


const getTemplateId = (templateName) => {
  const templateId = EMAIL_TEMPLATES[templateName];
  if (!templateId) {
    logger.warn('Template ID not found', { templateName });
    return null;
  }
  return templateId;
};

/**
 * Build email message object
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.templateId - SendGrid template ID
 * @param {Object} options.dynamicTemplateData - Template data
 * @param {string} [options.category] - Email category
 * @param {Array} [options.categories] - Multiple categories
 * @returns {Object} SendGrid message object
 */


const buildEmailMessage = (options) => {
  const { to, subject, templateId, dynamicTemplateData, category, categories } = options;

  const sender = getSenderEmail();
  const replyTo = getReplyToEmail();

  const message = {
    to,
    from: sender,
    subject,
    templateId,
    dynamicTemplateData,
    trackingSettings: TRACKING_SETTINGS,
    mailSettings: MAIL_SETTINGS
  };

  // Add reply-to if configured
  if (replyTo) {
    message.replyTo = replyTo;
  }

  // Add categories for tracking
  if (categories && Array.isArray(categories)) {
    message.categories = categories;
  } else if (category) {
    message.categories = [category];
  }

  return message;
};

/**
 * Sleep utility for retry delays
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise} Promise that resolves after delay
 */


const sleep = (ms) => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * Validate SendGrid configuration
 * @throws {Error} If required configuration is missing or invalid
 */


const validateConfig = () => {
  // Check API key
  if (!process.env.SENDGRID_API_KEY) {
    throw new Error('SENDGRID_API_KEY is required in environment variables');
  }

  if (!process.env.SENDGRID_API_KEY.startsWith('SG.')) {
    logger.warn('SENDGRID_API_KEY does not start with "SG." - this may be invalid');
  }

  // Check from email
  if (!process.env.SENDGRID_FROM_EMAIL) {
    throw new Error('SENDGRID_FROM_EMAIL is required in environment variables');
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(process.env.SENDGRID_FROM_EMAIL)) {
    throw new Error('SENDGRID_FROM_EMAIL must be a valid email address');
  }

  // Check from name
  if (!process.env.SENDGRID_FROM_NAME) {
    logger.warn('SENDGRID_FROM_NAME is not set - using email address as sender name');
  }

  logger.info('SendGrid configuration validated successfully', {
    fromEmail: process.env.SENDGRID_FROM_EMAIL,
    fromName: process.env.SENDGRID_FROM_NAME || process.env.SENDGRID_FROM_EMAIL,
    sandboxMode: MAIL_SETTINGS.sandboxMode.enable
  });
};

/**
 * Initialize SendGrid client with API key
 */


const initializeSendGrid = () => {
  try {
    validateConfig();

    sgMail.setApiKey(process.env.SENDGRID_API_KEY);

    logger.info('SendGrid client initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize SendGrid client', {
      error: 'Configuration error - check environment variables'
    });
    throw error;
  }
};

// Initialize SendGrid on module load
initializeSendGrid();

/**
 * Retry configuration for failed sends
 * @constant {Object}
 */


const RETRY_CONFIG = {
  maxRetries: 3,
  retryDelay: 1000, // milliseconds
  backoffMultiplier: 2
};

/**
 * Send email with retry logic
 * @param {Object} message - SendGrid message object
 * @param {number} [attempt=1] - Current attempt number
 * @returns {Promise<Object>} SendGrid response
 */


const sendWithRetry = async (message, attempt = 1) => {
  try {
    const response = await sgMail.send(message);
    logger.info('Email sent successfully', {
      to: message.to,
      subject: message.subject,
      attempt
    });
    return response;
  } catch (error) {
    const statusCode = error.code || error.statusCode || 'unknown';
    logger.error('Failed to send email', {
      to: message.to,
      subject: message.subject,
      attempt,
      statusCode
    });

    // Retry logic
    if (attempt < RETRY_CONFIG.maxRetries) {
      const delay = RETRY_CONFIG.retryDelay * Math.pow(RETRY_CONFIG.backoffMultiplier, attempt - 1);
      logger.info('Retrying email send', {
        to: message.to,
        attempt: attempt + 1,
        delayMs: delay
      });
      await sleep(delay);
      return sendWithRetry(message, attempt + 1);
    }

    // Max retries reached
    throw error;
  }
};

/**
 * SendGrid configuration object
 * @type {Object}
 */


const sendGridConfig = {
  client: sgMail,
  config: {
    from: getSenderEmail(),
    replyTo: getReplyToEmail(),
    categories: EMAIL_CATEGORIES,
    templates: EMAIL_TEMPLATES,
    tracking: TRACKING_SETTINGS,
    mailSettings: MAIL_SETTINGS,
    retry: RETRY_CONFIG
  },
  helpers: {
    isConfigured,
    getTemplateId,
    getSenderEmail,
    getReplyToEmail,
    getWebhookVerificationKey,
    buildEmailMessage,
    sendWithRetry
  }
};

/**
 * Test configuration for development/testing
 * @type {Object}
 */
sendGridConfig.testConfig = {
  useMockClient: process.env.NODE_ENV === 'test',
  testRecipient: process.env.TEST_EMAIL_RECIPIENT || 'test@example.com',
  sandboxMode: MAIL_SETTINGS.sandboxMode.enable
};

module.exports = sendGridConfig;
