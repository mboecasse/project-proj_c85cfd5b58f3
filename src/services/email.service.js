// File: src/services/email.service.js
// Generated: 2025-10-16 10:51:21 UTC
// Project ID: proj_c85cfd5b58f3
// Task ID: task_cpy6nwi33y3r


const EmailTemplates = require('../utils/emailTemplates');


const fs = require('fs').promises;


const logger = require('../utils/logger');


const path = require('path');


const sendGridConfig = require('../config/sendgrid');

/**
 * Email Service with Queue Management
 * Handles email sending with retry logic, queue persistence, and failure handling
 */
class EmailService {
  constructor() {
    this.queue = [];
    this.processing = false;
    this.sendGridClient = sendGridConfig;
    this.templates = EmailTemplates;
    this.processingInterval = null;
    this.queueFilePath = path.join(__dirname, '../data/email-queue.json');
    this.processingLock = false;
  }

  /**
   * Initialize the email service and start queue processor
   */
  async initialize() {
    try {
      // Load persisted queue
      await this.loadQueue();

      // Start processing queue every 30 seconds
      this.processingInterval = setInterval(() => {
        this.processQueue();
      }, 30000);

      logger.info('Email service initialized', {
        queueCheckInterval: '30s',
        queueLength: this.queue.length
      });
    } catch (error) {
      logger.error('Failed to initialize email service', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Stop the email service
   */
  async shutdown() {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }

    // Save queue before shutdown
    await this.saveQueue();

    logger.info('Email service shut down');
  }

  /**
   * Load queue from persistent storage
   */
  async loadQueue() {
    try {
      const data = await fs.readFile(this.queueFilePath, 'utf8');
      this.queue = JSON.parse(data).map(item => ({
        ...item,
        createdAt: new Date(item.createdAt),
        lastAttemptAt: item.lastAttemptAt ? new Date(item.lastAttemptAt) : null
      }));
      logger.info('Email queue loaded from disk', {
        queueLength: this.queue.length
      });
    } catch (error) {
      if (error.code === 'ENOENT') {
        // File doesn't exist yet, start with empty queue
        this.queue = [];
        logger.info('No existing queue file found, starting fresh');
      } else {
        logger.error('Failed to load email queue', {
          error: error.message
        });
        this.queue = [];
      }
    }
  }

  /**
   * Save queue to persistent storage
   */
  async saveQueue() {
    try {
      const dir = path.dirname(this.queueFilePath);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(this.queueFilePath, JSON.stringify(this.queue, null, 2));
      logger.debug('Email queue saved to disk', {
        queueLength: this.queue.length
      });
    } catch (error) {
      logger.error('Failed to save email queue', {
        error: error.message
      });
    }
  }

  /**
   * Add email to queue
   * @param {string} type - Email type (order_confirmation, password_reset, etc.)
   * @param {string} recipient - Recipient email address
   * @param {Object} data - Email data for template
   * @returns {Object} Queue item
   */
  async queueEmail(type, recipient, data) {
    try {
      const queueItem = {
        id: this.generateId(),
        type,
        recipient,
        data,
        attempts: 0,
        maxAttempts: 3,
        status: 'queued',
        createdAt: new Date(),
        lastAttemptAt: null,
        error: null
      };

      this.queue.push(queueItem);
      await this.saveQueue();

      logger.info('Email queued', {
        id: queueItem.id,
        type,
        recipient,
        queueLength: this.queue.length
      });

      // Try to process immediately if not already processing
      if (!this.processingLock) {
        setImmediate(() => this.processQueue());
      }

      return queueItem;
    } catch (error) {
      logger.error('Failed to queue email', {
        type,
        recipient,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Process email queue
   */
  async processQueue() {
    // Use atomic lock to prevent race conditions
    if (this.processingLock || this.queue.length === 0) {
      return;
    }

    this.processingLock = true;

    try {
      const queuedItems = this.queue.filter(
        item => item.status === 'queued' || item.status === 'failed'
      );

      logger.info('Processing email queue', {
        totalItems: this.queue.length,
        queuedItems: queuedItems.length
      });

      for (const item of queuedItems) {
        if (item.attempts >= item.maxAttempts) {
          item.status = 'failed';
          logger.error('Email max attempts reached', {
            id: item.id,
            type: item.type,
            recipient: item.recipient,
            attempts: item.attempts
          });
          continue;
        }

        await this.processQueueItem(item);
      }

      // Clean up old sent/failed items (older than 24 hours)
      this.cleanupQueue();

      // Persist queue after processing
      await this.saveQueue();
    } catch (error) {
      logger.error('Error processing email queue', {
        error: error.message
      });
    } finally {
      this.processingLock = false;
    }
  }

  /**
   * Process a single queue item
   * @param {Object} item - Queue item
   */
  async processQueueItem(item) {
    try {
      item.status = 'processing';
      item.attempts += 1;
      item.lastAttemptAt = new Date();

      const emailContent = this.generateEmailContent(item.type, item.data);

      await this.sendEmail(item.recipient, emailContent.subject, emailContent.html);

      item.status = 'sent';
      item.error = null;

      logger.info('Email sent successfully', {
        id: item.id,
        type: item.type,
        recipient: item.recipient,
        attempts: item.attempts
      });
    } catch (error) {
      item.status = 'failed';
      item.error = error.message;

      logger.error('Failed to send email', {
        id: item.id,
        type: item.type,
        recipient: item.recipient,
        attempts: item.attempts,
        error: error.message
      });

      // If not max attempts, set back to queued for retry
      if (item.attempts < item.maxAttempts) {
        item.status = 'queued';
      }
    }
  }

  /**
   * Generate email content based on type
   * @param {string} type - Email type
   * @param {Object} data - Email data
   * @returns {Object} Email content with subject and html
   */
  generateEmailContent(type, data) {
    try {
      switch (type) {
        case 'order_confirmation':
          return {
            subject: `Order Confirmation - #${data.orderNumber}`,
            html: this.templates.orderConfirmation(data)
          };

        case 'order_shipped':
          return {
            subject: `Your Order Has Shipped - #${data.orderNumber}`,
            html: this.templates.orderShipped(data)
          };

        case 'order_delivered':
          return {
            subject: `Your Order Has Been Delivered - #${data.orderNumber}`,
            html: this.templates.orderDelivered(data)
          };

        case 'password_reset':
          return {
            subject: 'Password Reset Request',
            html: this.templates.passwordReset(data)
          };

        case 'welcome':
          return {
            subject: 'Welcome to Our Store!',
            html: this.templates.welcome(data)
          };

        case 'payment_failed':
          return {
            subject: 'Payment Failed - Action Required',
            html: this.templates.paymentFailed(data)
          };

        default:
          throw new Error(`Unknown email type: ${type}`);
      }
    } catch (error) {
      logger.error('Failed to generate email content', {
        type,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Send email via SendGrid
   * @param {string} to - Recipient email
   * @param {string} subject - Email subject
   * @param {string} html - Email HTML content
   */
  async sendEmail(to, subject, html) {
    try {
      const msg = {
        to,
        from: this.sendGridClient.from,
        subject,
        html
      };

      await this.sendGridClient.client.send(msg);

      logger.info('Email sent via SendGrid', {
        to,
        subject
      });
    } catch (error) {
      logger.error('SendGrid send failed', {
        to,
        subject,
        error: error.message,
        statusCode: error.code
      });
      throw error;
    }
  }

  /**
   * Send order confirmation email
   * @param {string} recipient - Recipient email
   * @param {Object} orderData - Order data
   */
  async sendOrderConfirmation(recipient, orderData) {
    return this.queueEmail('order_confirmation', recipient, orderData);
  }

  /**
   * Send order shipped email
   * @param {string} recipient - Recipient email
   * @param {Object} orderData - Order data with tracking info
   */
  async sendOrderShipped(recipient, orderData) {
    return this.queueEmail('order_shipped', recipient, orderData);
  }

  /**
   * Send order delivered email
   * @param {string} recipient - Recipient email
   * @param {Object} orderData - Order data
   */
  async sendOrderDelivered(recipient, orderData) {
    return this.queueEmail('order_delivered', recipient, orderData);
  }

  /**
   * Send password reset email
   * @param {string} recipient - Recipient email
   * @param {Object} resetData - Reset token and user data
   */
  async sendPasswordReset(recipient, resetData) {
    return this.queueEmail('password_reset', recipient, resetData);
  }

  /**
   * Send welcome email
   * @param {string} recipient - Recipient email
   * @param {Object} userData - User data
   */
  async sendWelcome(recipient, userData) {
    return this.queueEmail('welcome', recipient, userData);
  }

  /**
   * Send payment failed email
   * @param {string} recipient - Recipient email
   * @param {Object} paymentData - Payment and order data
   */
  async sendPaymentFailed(recipient, paymentData) {
    return this.queueEmail('payment_failed', recipient, paymentData);
  }

  /**
   * Get queue status
   * @returns {Object} Queue statistics
   */
  getQueueStatus() {
    const stats = {
      total: this.queue.length,
      queued: 0,
      processing: 0,
      sent: 0,
      failed: 0
    };

    this.queue.forEach(item => {
      if (stats[item.status] !== undefined) {
        stats[item.status] += 1;
      }
    });

    return stats;
  }

  /**
   * Clean up old queue items
   */
  cleanupQueue() {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const beforeCount = this.queue.length;

    this.queue = this.queue.filter(item => {
      if (item.status === 'sent' || item.status === 'failed') {
        return item.createdAt > oneDayAgo;
      }
      return true;
    });

    const removedCount = beforeCount - this.queue.length;

    if (removedCount > 0) {
      logger.info('Cleaned up email queue', {
        removedItems: removedCount,
        remainingItems: this.queue.length
      });
    }
  }

  /**
   * Generate unique ID for queue items
   * @returns {string} Unique ID
   */
  generateId() {
    return `email_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Retry failed email by ID
   * @param {string} id - Queue item ID
   */
  async retryEmail(id) {
    try {
      const item = this.queue.find(i => i.id === id);

      if (!item) {
        throw new Error('Email not found in queue');
      }

      if (item.status !== 'failed') {
        throw new Error('Email is not in failed status');
      }

      item.status = 'queued';
      item.attempts = 0;
      item.error = null;

      await this.saveQueue();

      logger.info('Email queued for retry', {
        id,
        type: item.type,
        recipient: item.recipient
      });

      // Process immediately
      if (!this.processingLock) {
        setImmediate(() => this.processQueue());
      }

      return item;
    } catch (error) {
      logger.error('Failed to retry email', {
        id,
        error: error.message
      });
      throw error;
    }
  }
}

// Export singleton instance


const emailService = new EmailService();
module.exports = emailService;
