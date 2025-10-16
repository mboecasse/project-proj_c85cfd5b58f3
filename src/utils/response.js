// File: src/utils/response.js
// Generated: 2025-10-16 10:39:42 UTC
// Project ID: proj_c85cfd5b58f3
// Task ID: task_usnr8qpfthdm


const logger = require('./logger');

/**
 * Standard error codes used across the application
 * @constant {Object}
 */


const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  PRODUCT_NOT_FOUND: 'PRODUCT_NOT_FOUND',
  CART_NOT_FOUND: 'CART_NOT_FOUND',
  ORDER_NOT_FOUND: 'ORDER_NOT_FOUND',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  INSUFFICIENT_STOCK: 'INSUFFICIENT_STOCK',
  PAYMENT_FAILED: 'PAYMENT_FAILED',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  DUPLICATE_RESOURCE: 'DUPLICATE_RESOURCE',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  CART_EMPTY: 'CART_EMPTY',
  INVALID_PAYMENT_METHOD: 'INVALID_PAYMENT_METHOD'
};

/**
 * Sanitize data before sending in response
 * Removes sensitive fields and MongoDB internal fields
 *
 * @param {Object|Array} data - Data to sanitize
 * @returns {Object|Array} Sanitized data
 */


const sanitizeData = (data) => {
  if (!data) return data;

  // Handle arrays
  if (Array.isArray(data)) {
    return data.map(item => sanitizeData(item));
  }

  // Handle objects
  if (typeof data === 'object') {
    // Convert Mongoose document to plain object if needed
    const plainData = data.toObject ? data.toObject() : { ...data };

    // Remove sensitive and internal fields
    delete plainData.password;
    delete plainData.__v;
    delete plainData.passwordResetToken;
    delete plainData.passwordResetExpires;
    delete plainData.refreshToken;

    // Convert _id to id if present
    if (plainData._id) {
      plainData.id = plainData._id.toString();
      delete plainData._id;
    }

    // Recursively sanitize nested objects
    Object.keys(plainData).forEach(key => {
      if (plainData[key] && typeof plainData[key] === 'object') {
        plainData[key] = sanitizeData(plainData[key]);
      }
    });

    return plainData;
  }

  return data;
};

/**
 * Calculate pagination metadata
 *
 * @param {number} page - Current page number
 * @param {number} limit - Items per page
 * @param {number} total - Total number of items
 * @returns {Object} Pagination metadata
 */


const calculatePagination = (page, limit, total) => {
  const currentPage = parseInt(page) || 1;
  const itemsPerPage = parseInt(limit) || 20;
  const totalItems = parseInt(total) || 0;
  const totalPages = Math.ceil(totalItems / itemsPerPage);

  return {
    page: currentPage,
    limit: itemsPerPage,
    total: totalItems,
    totalPages,
    hasNext: currentPage < totalPages,
    hasPrev: currentPage > 1,
    nextPage: currentPage < totalPages ? currentPage + 1 : null,
    prevPage: currentPage > 1 ? currentPage - 1 : null
  };
};

/**
 * ApiResponse class for standardized API responses
 */
class ApiResponse {
  /**
   * Send successful response
   *
   * @param {string} message - Success message
   * @param {*} data - Response data payload
   * @returns {Object} Success response object
   */
  static success(message, data) {
    const sanitizedData = sanitizeData(data);

    const response = {
      success: true,
      message,
      data: sanitizedData,
      timestamp: new Date().toISOString()
    };

    logger.info('Success response created', {
      hasData: !!data,
      message
    });

    return response;
  }

  /**
   * Send error response
   *
   * @param {string} message - Error message
   * @param {number} statusCode - HTTP status code
   * @returns {Object} Error response object
   */
  static error(message, statusCode) {
    const response = {
      success: false,
      error: {
        code: ERROR_CODES.INTERNAL_ERROR,
        message,
        statusCode
      },
      timestamp: new Date().toISOString()
    };

    logger.error('Error response created', {
      statusCode,
      message
    });

    return response;
  }

  /**
   * Send successful response with pagination
   *
   * @param {Array} data - Array of items
   * @param {Object} paginationInfo - Pagination information (page, limit, total)
   * @param {string} message - Optional success message
   * @returns {Object} Paginated success response object
   */
  static successWithPagination(data, paginationInfo, message = null) {
    const sanitizedData = sanitizeData(data);
    const pagination = calculatePagination(
      paginationInfo.page,
      paginationInfo.limit,
      paginationInfo.total
    );

    const response = {
      success: true,
      data: sanitizedData,
      pagination,
      timestamp: new Date().toISOString()
    };

    if (message) {
      response.message = message;
    }

    logger.info('Paginated success response created', {
      itemCount: data.length,
      page: pagination.page,
      totalPages: pagination.totalPages
    });

    return response;
  }

  /**
   * Send validation error response
   *
   * @param {Array} errors - Array of validation error objects
   * @returns {Object} Validation error response object
   */
  static validationError(errors) {
    const formattedErrors = Array.isArray(errors)
      ? errors.map(err => ({
          field: err.field || err.param || 'unknown',
          message: err.message || err.msg || 'Validation failed'
        }))
      : [{ field: 'unknown', message: 'Validation failed' }];

    const response = {
      success: false,
      error: {
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'Validation failed',
        statusCode: 400,
        details: formattedErrors
      },
      timestamp: new Date().toISOString()
    };

    logger.warn('Validation error response created', {
      errorCount: formattedErrors.length,
      fields: formattedErrors.map(e => e.field)
    });

    return response;
  }

  /**
   * Send not found error response
   *
   * @param {string} resource - Name of the resource not found
   * @returns {Object} Not found error response object
   */
  static notFound(resource = 'Resource') {
    const response = {
      success: false,
      error: {
        code: `${resource.toUpperCase().replace(/\s+/g, '_')}_NOT_FOUND`,
        message: `${resource} not found`,
        statusCode: 404
      },
      timestamp: new Date().toISOString()
    };

    logger.warn('Not found response created', { resource });

    return response;
  }

  /**
   * Send unauthorized error response
   *
   * @param {string} message - Custom error message
   * @returns {Object} Unauthorized error response object
   */
  static unauthorized(message = 'Unauthorized access') {
    const response = {
      success: false,
      error: {
        code: ERROR_CODES.UNAUTHORIZED,
        message,
        statusCode: 401
      },
      timestamp: new Date().toISOString()
    };

    logger.warn('Unauthorized response created', { message });

    return response;
  }

  /**
   * Send forbidden error response
   *
   * @param {string} message - Custom error message
   * @returns {Object} Forbidden error response object
   */
  static forbidden(message = 'Access forbidden') {
    const response = {
      success: false,
      error: {
        code: ERROR_CODES.FORBIDDEN,
        message,
        statusCode: 403
      },
      timestamp: new Date().toISOString()
    };

    logger.warn('Forbidden response created', { message });

    return response;
  }

  /**
   * Send created response (for POST requests)
   *
   * @param {*} data - Created resource data
   * @param {string} message - Success message
   * @returns {Object} Created response object
   */
  static created(data, message = 'Resource created successfully') {
    const sanitizedData = sanitizeData(data);

    const response = {
      success: true,
      data: sanitizedData,
      message,
      timestamp: new Date().toISOString()
    };

    logger.info('Created response created', { message });

    return response;
  }

  /**
   * Send conflict error response
   *
   * @param {string} message - Conflict error message
   * @returns {Object} Conflict error response object
   */
  static conflict(message = 'Resource already exists') {
    const response = {
      success: false,
      error: {
        code: ERROR_CODES.DUPLICATE_RESOURCE,
        message,
        statusCode: 409
      },
      timestamp: new Date().toISOString()
    };

    logger.warn('Conflict response created', { message });

    return response;
  }

  /**
   * Send unprocessable entity error response
   *
   * @param {string} message - Error message
   * @returns {Object} Unprocessable entity error response object
   */
  static unprocessableEntity(message = 'Unable to process request') {
    const response = {
      success: false,
      error: {
        code: ERROR_CODES.INTERNAL_ERROR,
        message,
        statusCode: 422
      },
      timestamp: new Date().toISOString()
    };

    logger.warn('Unprocessable entity response created', { message });

    return response;
  }
}

module.exports = ApiResponse;
