// File: src/utils/emailTemplates.js
// Generated: 2025-10-16 10:45:59 UTC
// Project ID: proj_c85cfd5b58f3
// Task ID: task_4g28nfhl1xho


const logger = require('./logger');

* Provides reusable HTML email templates for various e-commerce transactional emails
 */

/**
 * Escape HTML to prevent XSS attacks
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */


const escapeHtml = (text) => {
  if (text === null || text === undefined) return '';
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return String(text).replace(/[&<>"']/g, (m) => map[m]);
};

/**
 * Strip HTML tags from text
 * @param {string} html - HTML string
 * @returns {string} Plain text
 */


const stripHtmlTags = (html) => {
  if (!html) return '';
  return html
    .replace(/<style[^>]*>.*<\/style>/gmi, '')
    .replace(/<script[^>]*>.*<\/script>/gmi, '')
    .replace(/<[^>]+>/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * Get email footer
 * @returns {string} HTML footer
 */


const getEmailFooter = () => {
  const currentYear = new Date().getFullYear();
  return `
    <div class="footer">
      <p>&copy; ${currentYear} ${process.env.APP_NAME || 'E-Commerce Store'}. All rights reserved.</p>
      <p>
        <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}" style="color: #007bff; text-decoration: none;">Visit our store</a> |
        <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/support" style="color: #007bff; text-decoration: none;">Contact Support</a>
      </p>
      <p style="margin-top: 10px; font-size: 11px; color: #999;">
        This is an automated email. Please do not reply to this message.
      </p>
    </div>
  `;
};

/**
 * Base email template with common header and footer
 * @param {string} content - HTML content for the email body
 * @param {string} subject - Email subject line
 * @returns {Object} Email template with html and text versions
 */


const emailBaseTemplate = (content, subject) => {
  const html = `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="X-UA-Compatible" content="IE=edge">
        <title>${escapeHtml(subject)}</title>
        <style>
          body { margin: 0; padding: 0; font-family: 'Arial', 'Helvetica', sans-serif; background-color: #f4f4f4; }
          .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
          .header { background-color: #007bff; padding: 20px; text-align: center; }
          .header h1 { color: #ffffff; margin: 0; font-size: 24px; }
          .content { padding: 30px; }
          .footer { background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #666; }
          .button { background-color: #007bff; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; margin: 10px 0; }
          .table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          .table th { background-color: #f8f9fa; padding: 12px; text-align: left; border-bottom: 2px solid #dee2e6; }
          .table td { padding: 12px; border-bottom: 1px solid #dee2e6; }
          .price-row { font-weight: bold; }
          .total-row { font-size: 18px; font-weight: bold; background-color: #f8f9fa; }
          @media only screen and (max-width: 600px) {
            .content { padding: 15px; }
            .table { font-size: 14px; }
          }
        </style>
      </head>
      <body>
        <div class="container">
          ${getEmailHeader()}
          <div class="content">
            ${content}
          </div>
          ${getEmailFooter()}
        </div>
      </body>
    </html>
  `;

  return {
    html,
    text: stripHtmlTags(content),
    subject
  };
};

/**
 * Get email header
 * @returns {string} HTML header
 */


const getEmailHeader = () => {
  return `
    <div class="header">
      <h1>${process.env.APP_NAME || 'E-Commerce Store'}</h1>
    </div>
  `;
};

/**
 * Format currency
 * @param {number} amount - Amount to format
 * @returns {string} Formatted currency
 */


const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount);
};

/**
 * Format date
 * @param {string|Date} date - Date to format
 * @returns {string} Formatted date
 */


const formatDate = (date) => {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

/**
 * Generate items table HTML
 * @param {Array} items - Array of order items
 * @returns {string} HTML table
 */


const generateItemsTable = (items) => {
  if (!items || items.length === 0) {
    return '<p>No items to display.</p>';
  }

  const rows = items.map(item => `
    <tr>
      <td style="padding: 12px;">
        ${item.imageUrl ? `<img src="${item.imageUrl}" alt="${escapeHtml(item.name)}" style="width: 60px; height: 60px; object-fit: cover; border-radius: 4px;">` : ''}
      </td>
      <td style="padding: 12px;">
        <strong>${escapeHtml(item.name)}</strong><br>
        ${item.sku ? `<small style="color: #666;">SKU: ${escapeHtml(item.sku)}</small>` : ''}
      </td>
      <td style="padding: 12px; text-align: center;">
        ${item.quantity}
      </td>
      <td style="padding: 12px; text-align: right;">
        ${formatCurrency(item.price)}
      </td>
      <td style="padding: 12px; text-align: right;">
        <strong>${formatCurrency(item.price * item.quantity)}</strong>
      </td>
    </tr>
  `).join('');

  return `
    <table class="table">
      <thead>
        <tr>
          <th>Image</th>
          <th>Product</th>
          <th style="text-align: center;">Qty</th>
          <th style="text-align: right;">Price</th>
          <th style="text-align: right;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
};

/**
 * Generate pricing summary HTML
 * @param {number} subtotal - Subtotal amount
 * @param {number} tax - Tax amount
 * @param {number} shipping - Shipping amount
 * @param {number} total - Total amount
 * @returns {string} HTML pricing summary
 */


const generatePricingSummary = (subtotal, tax, shipping, total) => {
  return `
    <table class="table">
      <tbody>
        <tr class="price-row">
          <td style="padding: 12px; text-align: right;">Subtotal:</td>
          <td style="padding: 12px; text-align: right;">${formatCurrency(subtotal)}</td>
        </tr>
        <tr class="price-row">
          <td style="padding: 12px; text-align: right;">Tax:</td>
          <td style="padding: 12px; text-align: right;">${formatCurrency(tax)}</td>
        </tr>
        <tr class="price-row">
          <td style="padding: 12px; text-align: right;">Shipping:</td>
          <td style="padding: 12px; text-align: right;">${formatCurrency(shipping)}</td>
        </tr>
        <tr class="total-row">
          <td style="padding: 12px; text-align: right;">Total:</td>
          <td style="padding: 12px; text-align: right;">${formatCurrency(total)}</td>
        </tr>
      </tbody>
    </table>
  `;
};

/**
 * Generate shipping info HTML
 * @param {Object} shippingAddress - Shipping address
 * @param {string} estimatedDelivery - Estimated delivery date
 * @returns {string} HTML shipping info
 */


const generateShippingInfo = (shippingAddress, estimatedDelivery) => {
  return `
    <p>
      ${escapeHtml(shippingAddress.street)}<br>
      ${shippingAddress.apartment ? escapeHtml(shippingAddress.apartment) + '<br>' : ''}
      ${escapeHtml(shippingAddress.city)}, ${escapeHtml(shippingAddress.state)} ${escapeHtml(shippingAddress.zipCode)}<br>
      ${escapeHtml(shippingAddress.country)}
    </p>
    <p><strong>Estimated Delivery:</strong> ${formatDate(estimatedDelivery)}</p>
  `;
};

/**
 * Generate payment info HTML
 * @param {string} paymentMethod - Payment method
 * @returns {string} HTML payment info
 */


const generatePaymentInfo = (paymentMethod) => {
  return `<p>${escapeHtml(paymentMethod)}</p>`;
};

/**
 * Generate order confirmation email
 * @param {Object} orderData - Order details
 * @returns {Object} Email template
 */


const generateOrderConfirmationEmail = (orderData) => {
  try {
    const {
      orderNumber,
      customerName,
      items,
      subtotal,
      tax,
      shipping,
      total,
      shippingAddress,
      estimatedDelivery,
      paymentMethod
    } = orderData;

    const content = `
      <h2>Order Confirmation</h2>
      <p>Hi ${escapeHtml(customerName)},</p>
      <p>Thank you for your order! Your order <strong>#${escapeHtml(orderNumber)}</strong> has been confirmed and is being processed.</p>

      <h3>Order Details</h3>
      ${generateItemsTable(items)}

      ${generatePricingSummary(subtotal, tax, shipping, total)}

      <h3>Shipping Information</h3>
      ${generateShippingInfo(shippingAddress, estimatedDelivery)}

      <h3>Payment Method</h3>
      ${generatePaymentInfo(paymentMethod)}

      <div style="text-align: center; margin-top: 30px;">
        <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/orders/${orderNumber}" class="button">
          Track Your Order
        </a>
      </div>

      <p style="margin-top: 30px; color: #666;">
        If you have any questions about your order, please contact our customer support team.
      </p>
    `;

    return emailBaseTemplate(content, `Order Confirmation - #${orderNumber}`);
  } catch (error) {
    logger.error('Error generating order confirmation email', { error: error.message });
    throw error;
  }
};

/**
 * Generate order shipped email
 * @param {Object} shipmentData - Shipment details
 * @returns {Object} Email template
 */


const generateOrderShippedEmail = (shipmentData) => {
  try {
    const {
      orderNumber,
      customerName,
      trackingNumber,
      carrier,
      carrierUrl,
      shippedDate,
      estimatedDelivery,
      shippingAddress,
      items
    } = shipmentData;

    const trackingLink = carrierUrl ? `${carrierUrl}${trackingNumber}` : '#';

    const content = `
      <h2>Your Order Has Shipped!</h2>
      <p>Hi ${escapeHtml(customerName)},</p>
      <p>Great news! Your order <strong>#${escapeHtml(orderNumber)}</strong> has been shipped and is on its way to you.</p>

      <div style="background-color: #f8f9fa; padding: 20px; border-radius: 4px; margin: 20px 0;">
        <h3 style="margin-top: 0;">Tracking Information</h3>
        <p><strong>Tracking Number:</strong> ${escapeHtml(trackingNumber)}</p>
        <p><strong>Carrier:</strong> ${escapeHtml(carrier)}</p>
        <p><strong>Shipped Date:</strong> ${formatDate(shippedDate)}</p>
        <p><strong>Estimated Delivery:</strong> ${formatDate(estimatedDelivery)}</p>
        ${trackingLink !== '#' ? `
          <div style="margin-top: 15px;">
            <a href="${trackingLink}" class="button">Track Your Package</a>
          </div>
        ` : ''}
      </div>

      <h3>Shipping Address</h3>
      <p>
        ${escapeHtml(shippingAddress.street)}<br>
        ${shippingAddress.apartment ? escapeHtml(shippingAddress.apartment) + '<br>' : ''}
        ${escapeHtml(shippingAddress.city)}, ${escapeHtml(shippingAddress.state)} ${escapeHtml(shippingAddress.zipCode)}<br>
        ${escapeHtml(shippingAddress.country)}
      </p>

      ${items && items.length > 0 ? `
        <h3>Items in This Shipment</h3>
        ${generateItemsTable(items)}
      ` : ''}

      <p style="margin-top: 30px; color: #666;">
        You will receive another email once your order has been delivered.
      </p>
    `;

    return emailBaseTemplate(content, `Order Shipped - #${orderNumber}`);
  } catch (error) {
    logger.error('Error generating order shipped email', { error: error.message });
    throw error;
  }
};

/**
 * Generate order delivered email
 * @param {Object} orderData - Order details
 * @returns {Object} Email template
 */


const generateOrderDeliveredEmail = (orderData) => {
  try {
    const {
      orderNumber,
      customerName,
      deliveryDate,
      items
    } = orderData;

    const content = `
      <h2>Your Order Has Been Delivered!</h2>
      <p>Hi ${escapeHtml(customerName)},</p>
      <p>Your order <strong>#${escapeHtml(orderNumber)}</strong> was successfully delivered on ${formatDate(deliveryDate)}.</p>

      <p>We hope you love your purchase! Your satisfaction is important to us.</p>

      ${items && items.length > 0 ? `
        <h3>Delivered Items</h3>
        ${generateItemsTable(items)}
      ` : ''}

      <div style="background-color: #f8f9fa; padding: 20px; border-radius: 4px; margin: 30px 0; text-align: center;">
        <h3 style="margin-top: 0;">How was your experience?</h3>
        <p>We'd love to hear your feedback about your purchase.</p>
        <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/orders/${orderNumber}/review" class="button">
          Leave a Review
        </a>
      </div>

      <p style="color: #666;">
        If you have any issues with your order, please don't hesitate to contact our support team.
      </p>
    `;

    return emailBaseTemplate(content, `Order Delivered - #${orderNumber}`);
  } catch (error) {
    logger.error('Error generating order delivered email', { error: error.message });
    throw error;
  }
};

/**
 * Generate order cancelled email
 * @param {Object} orderData - Order details
 * @returns {Object} Email template
 */


const generateOrderCancelledEmail = (orderData) => {
  try {
    const {
      orderNumber,
      customerName,
      cancellationDate,
      cancellationReason,
      refundAmount,
      refundMethod,
      refundTimeline,
      items
    } = orderData;

    const content = `
      <h2>Order Cancellation Confirmation</h2>
      <p>Hi ${escapeHtml(customerName)},</p>
      <p>Your order <strong>#${escapeHtml(orderNumber)}</strong> has been cancelled as of ${formatDate(cancellationDate)}.</p>

      ${cancellationReason ? `
        <div style="background-color: #fff3cd; padding: 15px; border-radius: 4px; border-left: 4px solid #ffc107; margin: 20px 0;">
          <strong>Cancellation Reason:</strong> ${escapeHtml(cancellationReason)}
        </div>
      ` : ''}

      ${items && items.length > 0 ? `
        <h3>Cancelled Items</h3>
        ${generateItemsTable(items)}
      ` : ''}

      <h3>Refund Information</h3>
      <div style="background-color: #f8f9fa; padding: 20px; border-radius: 4px; margin: 20px 0;">
        <p><strong>Refund Amount:</strong> ${formatCurrency(refundAmount)}</p>
        <p><strong>Refund Method:</strong> ${escapeHtml(refundMethod)}</p>
        <p><strong>Expected Timeline:</strong> ${escapeHtml(refundTimeline || '5-10 business days')}</p>
      </div>

      <p>The refund will be processed to your original payment method. You will receive a confirmation email once the refund has been processed.</p>

      <div style="text-align: center; margin-top: 30px;">
        <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/products" class="button">
          Continue Shopping
        </a>
      </div>

      <p style="margin-top: 30px; color: #666;">
        If you have any questions about this cancellation, please contact our support team.
      </p>
    `;

    return emailBaseTemplate(content, `Order Cancelled - #${orderNumber}`);
  } catch (error) {
    logger.error('Error generating order cancelled email', { error: error.message });
    throw error;
  }
};

/**
 * Generate payment failed email
 * @param {Object} paymentData - Payment details
 * @returns {Object} Email template
 */


const generatePaymentFailedEmail = (paymentData) => {
  try {
    const {
      orderNumber,
      customerName,
      failureDate,
      failureReason,
      amount,
      holdTimeline
    } = paymentData;

    const content = `
      <h2>Payment Failed</h2>
      <p>Hi ${escapeHtml(customerName)},</p>
      <p>We were unable to process the payment for your order <strong>#${escapeHtml(orderNumber)}</strong>.</p>

      <div style="background-color: #f8d7da; padding: 15px; border-radius: 4px; border-left: 4px solid #dc3545; margin: 20px 0;">
        <p style="margin: 0;"><strong>Payment Amount:</strong> ${formatCurrency(amount)}</p>
        <p style="margin: 10px 0 0 0;"><strong>Failure Date:</strong> ${formatDate(failureDate)}</p>
        ${failureReason ? `<p style="margin: 10px 0 0 0;"><strong>Reason:</strong> ${escapeHtml(failureReason)}</p>` : ''}
      </div>

      <h3>What happens next?</h3>
      <p>Your order is currently on hold. Please update your payment method within ${escapeHtml(holdTimeline || '48 hours')} to complete your purchase. If we don't receive payment by then, your order will be automatically cancelled.</p>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/orders/${orderNumber}/payment" class="button">
          Update Payment Method
        </a>
      </div>

      <h3>Common reasons for payment failure:</h3>
      <ul>
        <li>Insufficient funds in your account</li>
        <li>Incorrect card details</li>
        <li>Card expired or cancelled</li>
        <li>Payment declined by your bank</li>
      </ul>

      <p style="color: #666;">
        If you continue to experience issues, please contact your bank or our support team for assistance.
      </p>
    `;

    return emailBaseTemplate(content, `Payment Failed - Order #${orderNumber}`);
  } catch (error) {
    logger.error('Error generating payment failed email', { error: error.message });
    throw error;
  }
};

/**
 * Generate password reset email
 * @param {Object} resetData - Reset details
 * @returns {Object} Email template
 */


const generatePasswordResetEmail = (resetData) => {
  try {
    const {
      userName,
      resetToken,
      expirationTime
    } = resetData;

    const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;

    const content = `
      <h2>Password Reset Request</h2>
      <p>Hi ${escapeHtml(userName)},</p>
      <p>We received a request to reset your password. Click the button below to create a new password:</p>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${resetLink}" class="button">
          Reset Password
        </a>
      </div>

      <p>Or copy and paste this link into your browser:</p>
      <p style="background-color: #f8f9fa; padding: 10px; border-radius: 4px; word-break: break-all;">
        ${resetLink}
      </p>

      <div style="background-color: #fff3cd; padding: 15px; border-radius: 4px; border-left: 4px solid #ffc107; margin: 20px 0;">
        <p style="margin: 0;"><strong>Important:</strong> This link will expire in ${escapeHtml(expirationTime || '1 hour')}.</p>
      </div>

      <div style="background-color: #f8d7da; padding: 15px; border-radius: 4px; border-left: 4px solid #dc3545; margin: 20px 0;">
        <p style="margin: 0;"><strong>Security Notice:</strong></p>
        <ul style="margin: 10px 0 0 0; padding-left: 20px;">
          <li>Never share this link with anyone</li>
          <li>Our team will never ask for your password</li>
          <li>If you didn't request this reset, please ignore this email and contact support immediately</li>
        </ul>
      </div>

      <p style="color: #666;">
        If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.
      </p>
    `;

    return emailBaseTemplate(content, 'Password Reset Request');
  } catch (error) {
    logger.error('Error generating password reset email', { error: error.message });
    throw error;
  }
};

/**
 * Generate welcome email
 * @param {Object} userData - User details
 * @returns {Object} Email template
 */


const generateWelcomeEmail = (userData) => {
  try {
    const {
      userName,
      userEmail
    } = userData;

    const content = `
      <h2>Welcome to ${process.env.APP_NAME || 'Our Store'}!</h2>
      <p>Hi ${escapeHtml(userName)},</p>
      <p>Thank you for creating an account with us! We're excited to have you as part of our community.</p>

      <div style="background-color: #d1ecf1; padding: 20px; border-radius: 4px; border-left: 4px solid #17a2b8; margin: 20px 0;">
        <h3 style="margin-top: 0;">Your Account Details</h3>
        <p style="margin: 0;"><strong>Email:</strong> ${escapeHtml(userEmail)}</p>
      </div>

      <h3>Get Started</h3>
      <p>Here are some things you can do:</p>
      <ul>
        <li>Browse our latest products and collections</li>
        <li>Add items to your wishlist</li>
        <li>Track your orders and view order history</li>
        <li>Manage your account settings</li>
      </ul>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/products" class="button">
          Start Shopping
        </a>
      </div>

      <h3>Need Help?</h3>
      <p>Our customer support team is here to help you with any questions or concerns. Feel free to reach out anytime!</p>

      <p style="margin-top: 30px;">
        Happy shopping!<br>
        <strong>The ${process.env.APP_NAME || 'E-Commerce Store'} Team</strong>
      </p>
    `;

    return emailBaseTemplate(content, `Welcome to ${process.env.APP_NAME || 'Our Store'}!`);
  } catch (error) {
    logger.error('Error generating welcome email', { error: error.message });
    throw error;
  }
};

/**
 * Generate account verification email
 * @param {Object} verificationData - Verification details
 * @returns {Object} Email template
 */


const generateAccountVerificationEmail = (verificationData) => {
  try {
    const {
      userName,
      verificationToken,
      expirationTime
    } = verificationData;

    const verificationLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email?token=${verificationToken}`;

    const content = `
      <h2>Verify Your Email Address</h2>
      <p>Hi ${escapeHtml(userName)},</p>
      <p>Thank you for signing up! Please verify your email address to complete your registration and start shopping.</p>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${verificationLink}" class="button">
          Verify Email Address
        </a>
      </div>

      <p>Or copy and paste this link into your browser:</p>
      <p style="background-color: #f8f9fa; padding: 10px; border-radius: 4px; word-break: break-all;">
        ${verificationLink}
      </p>

      <div style="background-color: #fff3cd; padding: 15px; border-radius: 4px; border-left: 4px solid #ffc107; margin: 20px 0;">
        <p style="margin: 0;"><strong>Note:</strong> This verification link will expire in ${escapeHtml(expirationTime || '24 hours')}.</p>
      </div>

      <p>If you didn't create an account with us, you can safely ignore this email.</p>

      <p style="color: #666;">
        Need help? Contact our support team if you have any questions.
      </p>
    `;

    return emailBaseTemplate(content, 'Verify Your Email Address');
  } catch (error) {
    logger.error('Error generating account verification email', { error: error.message });
    throw error;
  }
};

/**
 * Generate refund processed email
 * @param {Object} refundData - Refund details
 * @returns {Object} Email template
 */


const generateRefundProcessedEmail = (refundData) => {
  try {
    const {
      orderNumber,
      customerName,
      refundAmount,
      refundMethod,
      refundDate,
      refundTimeline,
      refundReason,
      items
    } = refundData;

    const content = `
      <h2>Refund Processed</h2>
      <p>Hi ${escapeHtml(customerName)},</p>
      <p>Your refund for order <strong>#${escapeHtml(orderNumber)}</strong> has been processed.</p>

      <div style="background-color: #d4edda; padding: 20px; border-radius: 4px; border-left: 4px solid #28a745; margin: 20px 0;">
        <h3 style="margin-top: 0;">Refund Details</h3>
        <p><strong>Refund Amount:</strong> ${formatCurrency(refundAmount)}</p>
        <p><strong>Refund Method:</strong> ${escapeHtml(refundMethod)}</p>
        <p><strong>Processed Date:</strong> ${formatDate(refundDate)}</p>
        <p><strong>Expected in Account:</strong> ${escapeHtml(refundTimeline || '5-10 business days')}</p>
        ${refundReason ? `<p><strong>Reason:</strong> ${escapeHtml(refundReason)}</p>` : ''}
      </div>

      ${items && items.length > 0 ? `
        <h3>Refunded Items</h3>
        ${generateItemsTable(items)}
      ` : ''}

      <p>The refund will appear in your account within the specified timeline. The exact timing depends on your bank or payment provider.</p>

      <div style="background-color: #d1ecf1; padding: 15px; border-radius: 4px; border-left: 4px solid #17a2b8; margin: 20px 0;">
        <p style="margin: 0;"><strong>Note:</strong> If you don't see the refund after ${escapeHtml(refundTimeline || '10 business days')}, please contact your bank or our support team.</p>
      </div>

      <div style="text-align: center; margin-top: 30px;">
        <a href="${process
