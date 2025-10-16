// File: src/utils/validators.js
// Generated: 2025-10-16 10:42:22 UTC
// Project ID: proj_c85cfd5b58f3
// Task ID: task_7i0mbrmc03b4


const mongoose = require('mongoose');


const validator = require('validator');

/**
 * Validate email format (RFC 5322 compliant)
 * @param {string} email - Email address to validate
 * @returns {boolean} True if valid email format
 */


const validateEmail = (email) => {
  if (!email || typeof email !== 'string') {
    return false;
  }
  return validator.isEmail(email);
};

/**
 * Validate password strength
 * @param {string} password - Password to validate
 * @returns {object} Object with isValid boolean and errors array
 */


const validatePassword = (password) => {
  const errors = [];

  if (!password || typeof password !== 'string') {
    return { isValid: false, errors: ['Password is required'] };
  }

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  return { isValid: errors.length === 0, errors };
};

/**
 * Validate MongoDB ObjectId format
 * @param {string} id - ID to validate
 * @returns {boolean} True if valid ObjectId
 */


const isValidObjectId = (id) => {
  if (!id) {
    return false;
  }
  return mongoose.Types.ObjectId.isValid(id);
};

/**
 * Validate price format (positive number with max 2 decimal places)
 * @param {number|string} price - Price to validate
 * @returns {boolean} True if valid price format
 */


const validatePrice = (price) => {
  if (price === null || price === undefined || price === '') {
    return false;
  }

  const priceNum = parseFloat(price);

  if (isNaN(priceNum) || priceNum < 0) {
    return false;
  }

  // Check for max 2 decimal places
  const priceStr = price.toString();
  const decimalMatch = priceStr.match(/\.(\d+)/);

  if (decimalMatch && decimalMatch[1].length > 2) {
    return false;
  }

  return true;
};

/**
 * Sanitize string input to prevent XSS attacks
 * @param {string} str - String to sanitize
 * @returns {string} Sanitized string
 */


const sanitizeString = (str) => {
  if (typeof str !== 'string') {
    return str;
  }

  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    .trim();
};

/**
 * Validate product data
 * @param {object} product - Product object to validate
 * @returns {object} Object with isValid boolean and errors object
 */


const validateProductData = (product) => {
  const errors = {};

  if (!product) {
    return { isValid: false, errors: { product: 'Product data is required' } };
  }

  // Validate name
  if (!product.name || typeof product.name !== 'string' || product.name.trim().length < 3) {
    errors.name = 'Product name must be at least 3 characters long';
  }

  // Validate price
  if (!validatePrice(product.price)) {
    errors.price = 'Invalid price format. Must be a positive number with max 2 decimal places';
  }

  // Validate stock
  if (product.stock === undefined || product.stock === null || !Number.isInteger(Number(product.stock)) || Number(product.stock) < 0) {
    errors.stock = 'Stock must be a non-negative integer';
  }

  // Validate SKU if provided
  if (product.sku && !/^[A-Z0-9-]{6,20}$/.test(product.sku)) {
    errors.sku = 'Invalid SKU format. Must be 6-20 characters (uppercase letters, numbers, hyphens only)';
  }

  // Validate description if provided
  if (product.description && product.description.length > 2000) {
    errors.description = 'Description must not exceed 2000 characters';
  }

  return { isValid: Object.keys(errors).length === 0, errors };
};

/**
 * Validate credit card number using Luhn algorithm
 * @param {string} cardNumber - Card number to validate
 * @returns {boolean} True if valid card number
 */


const validateCardNumber = (cardNumber) => {
  if (!cardNumber || typeof cardNumber !== 'string') {
    return false;
  }

  const cleaned = cardNumber.replace(/\s/g, '');

  if (!/^\d{13,19}$/.test(cleaned)) {
    return false;
  }

  // Luhn algorithm
  let sum = 0;
  let isEven = false;

  for (let i = cleaned.length - 1; i >= 0; i--) {
    let digit = parseInt(cleaned[i]);

    if (isEven) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }

    sum += digit;
    isEven = !isEven;
  }

  return sum % 10 === 0;
};

/**
 * Validate CVV/CVC code
 * @param {string} cvv - CVV code to validate
 * @returns {boolean} True if valid CVV
 */


const validateCVV = (cvv) => {
  if (!cvv) {
    return false;
  }
  return /^\d{3,4}$/.test(cvv.toString());
};

/**
 * Validate card expiry date
 * @param {number|string} month - Expiry month (1-12)
 * @param {number|string} year - Expiry year (full year or last 2 digits)
 * @returns {boolean} True if valid and not expired
 */


const validateExpiryDate = (month, year) => {
  if (!month || !year) {
    return false;
  }

  const monthNum = parseInt(month);
  let yearNum = parseInt(year);

  if (isNaN(monthNum) || isNaN(yearNum)) {
    return false;
  }

  if (monthNum < 1 || monthNum > 12) {
    return false;
  }

  // Convert 2-digit year to 4-digit
  if (yearNum < 100) {
    yearNum += 2000;
  }

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  if (yearNum < currentYear) {
    return false;
  }

  if (yearNum === currentYear && monthNum < currentMonth) {
    return false;
  }

  return true;
};

/**
 * Validate shipping address
 * @param {object} address - Address object to validate
 * @returns {object} Object with isValid boolean and errors object
 */


const validateAddress = (address) => {
  const errors = {};

  if (!address) {
    return { isValid: false, errors: { address: 'Address is required' } };
  }

  const requiredFields = ['street', 'city', 'state', 'postalCode', 'country'];

  requiredFields.forEach(field => {
    if (!address[field] || typeof address[field] !== 'string' || address[field].trim().length === 0) {
      errors[field] = `${field.charAt(0).toUpperCase() + field.slice(1)} is required`;
    }
  });

  // Validate postal code format (US format)
  if (address.postalCode && !/^\d{5}(-\d{4})?$/.test(address.postalCode)) {
    errors.postalCode = 'Invalid postal code format. Use format: 12345 or 12345-6789';
  }

  // Validate phone number if provided
  if (address.phone && !validatePhoneNumber(address.phone)) {
    errors.phone = 'Invalid phone number format';
  }

  return { isValid: Object.keys(errors).length === 0, errors };
};

/**
 * Validate and sanitize pagination parameters
 * @param {number|string} page - Page number
 * @param {number|string} limit - Items per page
 * @returns {object} Object with validated page and limit
 */


const validatePagination = (page, limit) => {
  const pageNum = parseInt(page) || 1;
  const limitNum = parseInt(limit) || 10;

  return {
    page: Math.max(1, pageNum),
    limit: Math.min(Math.max(1, limitNum), 100) // Max 100 items per page
  };
};

/**
 * Valid order status values
 */


const VALID_ORDER_STATUSES = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];

/**
 * Valid status transitions for order state machine
 */


const VALID_STATUS_TRANSITIONS = {
  pending: ['processing', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: []
};

/**
 * Validate order status transition
 * @param {string} currentStatus - Current order status
 * @param {string} newStatus - New order status
 * @returns {object} Object with isValid boolean and optional error message
 */


const validateOrderStatus = (currentStatus, newStatus) => {
  if (!VALID_ORDER_STATUSES.includes(newStatus)) {
    return { isValid: false, error: 'Invalid order status' };
  }

  if (!currentStatus) {
    return { isValid: true };
  }

  if (!VALID_STATUS_TRANSITIONS[currentStatus]) {
    return { isValid: false, error: 'Invalid current status' };
  }

  if (!VALID_STATUS_TRANSITIONS[currentStatus].includes(newStatus)) {
    return {
      isValid: false,
      error: `Cannot transition from ${currentStatus} to ${newStatus}`
    };
  }

  return { isValid: true };
};

/**
 * Validate quantity (positive integer)
 * @param {number|string} quantity - Quantity to validate
 * @returns {boolean} True if valid quantity
 */


const validateQuantity = (quantity) => {
  if (quantity === null || quantity === undefined) {
    return false;
  }

  const qty = parseInt(quantity);
  return Number.isInteger(qty) && qty > 0;
};

/**
 * Validate phone number format (international format support)
 * @param {string} phone - Phone number to validate
 * @returns {boolean} True if valid phone number
 */


const validatePhoneNumber = (phone) => {
  if (!phone || typeof phone !== 'string') {
    return false;
  }

  // Remove all non-digit characters for validation
  const cleaned = phone.replace(/\D/g, '');

  // Must be between 10 and 15 digits
  if (cleaned.length < 10 || cleaned.length > 15) {
    return false;
  }

  // Check format with optional country code and formatting
  return /^\+?[\d\s\-()]{10,}$/.test(phone);
};

/**
 * Validate discount code format
 * @param {string} code - Discount code to validate
 * @returns {boolean} True if valid discount code format
 */


const validateDiscountCode = (code) => {
  if (!code || typeof code !== 'string') {
    return false;
  }
  return /^[A-Z0-9]{6,12}$/.test(code);
};

/**
 * Validate stock availability
 * @param {number} requestedQuantity - Requested quantity
 * @param {number} availableStock - Available stock
 * @returns {object} Object with isValid boolean and optional error message
 */


const validateStockAvailability = (requestedQuantity, availableStock) => {
  if (!validateQuantity(requestedQuantity)) {
    return { isValid: false, error: 'Invalid quantity' };
  }

  if (!Number.isInteger(availableStock) || availableStock < 0) {
    return { isValid: false, error: 'Invalid stock value' };
  }

  if (requestedQuantity > availableStock) {
    return {
      isValid: false,
      error: `Insufficient stock. Only ${availableStock} items available`
    };
  }

  return { isValid: true };
};

/**
 * Validate date range
 * @param {Date|string} startDate - Start date
 * @param {Date|string} endDate - End date
 * @returns {object} Object with isValid boolean and optional error message
 */


const validateDateRange = (startDate, endDate) => {
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (isNaN(start.getTime())) {
    return { isValid: false, error: 'Invalid start date' };
  }

  if (isNaN(end.getTime())) {
    return { isValid: false, error: 'Invalid end date' };
  }

  if (start > end) {
    return { isValid: false, error: 'Start date must be before end date' };
  }

  return { isValid: true };
};

/**
 * Validate search query
 * @param {string} query - Search query string
 * @returns {object} Object with isValid boolean and sanitized query
 */


const validateSearchQuery = (query) => {
  if (!query || typeof query !== 'string') {
    return { isValid: false, sanitized: '' };
  }

  const sanitized = sanitizeString(query.trim());

  if (sanitized.length < 2) {
    return { isValid: false, error: 'Search query must be at least 2 characters', sanitized };
  }

  if (sanitized.length > 100) {
    return { isValid: false, error: 'Search query must not exceed 100 characters', sanitized };
  }

  return { isValid: true, sanitized };
};

/**
 * Validate URL format
 * @param {string} url - URL to validate
 * @returns {boolean} True if valid URL
 */


const validateURL = (url) => {
  if (!url || typeof url !== 'string') {
    return false;
  }
  return validator.isURL(url, { protocols: ['http', 'https'], require_protocol: true });
};

/**
 * Validate rating value (1-5)
 * @param {number|string} rating - Rating value
 * @returns {boolean} True if valid rating
 */


const validateRating = (rating) => {
  const ratingNum = parseFloat(rating);
  return !isNaN(ratingNum) && ratingNum >= 1 && ratingNum <=
