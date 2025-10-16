// File: src/middleware/logger.js
// Generated: 2025-10-16 10:50:05 UTC
// Project ID: proj_c85cfd5b58f3
// Task ID: task_dr4h6xa5vndn


const logger = require('../config/logger');

const { v4: uuidv4 } = require('uuid');

/**
 * Sanitize request headers
 * Remove sensitive information from headers
 */


const sanitizeHeaders = (headers) => {
  const sanitized = JSON.parse(JSON.stringify(headers));
  const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key'];

  const redactRecursive = (obj) => {
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const lowerKey = key.toLowerCase();
        if (sensitiveHeaders.includes(lowerKey)) {
          obj[key] = '[REDACTED]';
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
          redactRecursive(obj[key]);
        }
      }
    }
  };

  redactRecursive(sanitized);
  return sanitized;
};

/**
 * Sanitize request body
 * Remove sensitive fields from body
 */


const sanitizeBody = (body, path) => {
  if (!body || typeof body !== 'object') {
    return body;
  }

  const sanitized = JSON.parse(JSON.stringify(body));
  const sensitiveFields = ['password', 'currentPassword', 'newPassword', 'confirmPassword', 'token', 'cardNumber', 'cvv', 'pin'];

  // Additional sensitive fields for payment routes
  if (path && path.includes('/payment')) {
    sensitiveFields.push('cardholderName', 'expiryDate', 'billingAddress');
  }

  const redactRecursive = (obj) => {
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        if (sensitiveFields.includes(key)) {
          obj[key] = '[REDACTED]';
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
          redactRecursive(obj[key]);
        }
      }
    }
  };

  redactRecursive(sanitized);
  return sanitized;
};

/**
 * Request logging middleware
 * Adds correlation ID and logs all incoming requests
 */


const requestLogger = (req, res, next) => {
  // Generate or use existing correlation ID
  const correlationId = req.headers['x-correlation-id'] || uuidv4();
  req.correlationId = correlationId;

  // Set correlation ID in response headers
  res.setHeader('X-Correlation-ID', correlationId);

  // Capture start time
  const startTime = Date.now();

  // Extract request details
  const { method, url, path, query } = req;

  // Log incoming request
  logger.info('Incoming request', {
    correlationId,
    type: 'REQUEST',
    method,
    url,
    path,
    query,
    headers: sanitizeHeaders(req.headers),
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('user-agent'),
    userId: req.user?.id,
    userEmail: req.user?.email,
    body: sanitizeBody(req.body, req.path)
  });

  // Capture original end function
  const originalEnd = res.end;
  let endCalled = false;

  // Override end function to log response
  res.end = function(chunk, encoding) {
    if (endCalled) {
      return originalEnd.call(this, chunk, encoding);
    }

    endCalled = true;

    // Calculate response time
    const responseTime = Date.now() - startTime;

    // Log outgoing response
    logger.info('Outgoing response', {
      correlationId,
      type: 'RESPONSE',
      method,
      url,
      path,
      statusCode: res.statusCode,
      responseTime: `${responseTime}ms`,
      userId: req.user?.id,
      userEmail: req.user?.email
    });

    // Restore original end function
    res.end = originalEnd;

    // Call original end function
    return originalEnd.call(this, chunk, encoding);
  };

  // Cleanup on response finish or error
  res.on('finish', () => {
    if (!endCalled) {
      res.end = originalEnd;
    }
  });

  res.on('close', () => {
    if (!endCalled) {
      res.end = originalEnd;
    }
  });

  next();
};

/**
 * Error logging middleware
 * Logs errors with correlation ID
 */


const errorLogger = (err, req, res, next) => {
  const correlationId = req.correlationId || 'unknown';

  logger.error('Request error', {
    correlationId,
    type: 'ERROR',
    method: req.method,
    url: req.url,
    path: req.path,
    statusCode: err.statusCode || 500,
    error: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    userId: req.user?.id,
    userEmail: req.user?.email
  });

  next(err);
};

module.exports = {
  requestLogger,
  errorLogger
};
