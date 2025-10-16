// File: src/config/logger.js
// Generated: 2025-10-16 10:40:04 UTC
// Project ID: proj_c85cfd5b58f3
// Task ID: task_t0uz07etrl7i


const path = require('path');


const winston = require('winston');

require('winston-daily-rotate-file');

// Define log levels hierarchy


const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4
};

// Define colors for each log level (for console output)


const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'blue'
};

// Tell winston about our custom colors
winston.addColors(colors);

// Determine environment


const environment = process.env.NODE_ENV || 'development';


const isDevelopment = environment === 'development';


const isProduction = environment === 'production';

// Get log level from environment or use defaults


const logLevel = process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info');

/**
 * Sanitize sensitive data from log metadata
 * Removes passwords, tokens, credit card info, etc.
 */


const sanitizeMetadata = (meta) => {
  if (!meta || typeof meta !== 'object') {
    return meta;
  }

  const sensitiveFields = [
    'password',
    'passwordHash',
    'passwordConfirm',
    'newPassword',
    'oldPassword',
    'currentPassword',
    'creditCard',
    'cardNumber',
    'cvv',
    'ccv',
    'cvc',
    'cardCvv',
    'apiKey',
    'secretKey',
    'token',
    'accessToken',
    'refreshToken',
    'authToken',
    'bearerToken',
    'ssn',
    'socialSecurity',
    'secret',
    'privateKey'
  ];

  const sanitized = { ...meta };

  const recursiveSanitize = (obj) => {
    if (!obj || typeof obj !== 'object') {
      return obj;
    }

    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const lowerKey = key.toLowerCase();

        // Check if field is sensitive
        if (sensitiveFields.some(field => lowerKey.includes(field.toLowerCase()))) {
          obj[key] = '[REDACTED]';
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
          // Recursively sanitize nested objects
          obj[key] = recursiveSanitize(obj[key]);
        }
      }
    }

    return obj;
  };

  return recursiveSanitize(sanitized);
};

/**
 * Custom format for log messages
 * Includes timestamp, level, message, and metadata
 */


const customFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf((info) => {
    const { timestamp, level, message, correlationId, userId, orderId, productId, cartId, ...meta } = info;

    // Build base log string
    let logString = `${timestamp} [${level.toUpperCase()}]: ${message}`;

    // Add correlation ID if present
    if (correlationId) {
      logString += ` | CorrelationId: ${correlationId}`;
    }

    // Add user context if present
    if (userId) {
      logString += ` | UserId: ${userId}`;
    }

    // Add order context if present
    if (orderId) {
      logString += ` | OrderId: ${orderId}`;
    }

    // Add product context if present
    if (productId) {
      logString += ` | ProductId: ${productId}`;
    }

    // Add cart context if present
    if (cartId) {
      logString += ` | CartId: ${cartId}`;
    }

    // Add remaining metadata
    const sanitizedMeta = sanitizeMetadata(meta);
    if (Object.keys(sanitizedMeta).length > 0) {
      logString += ` | ${JSON.stringify(sanitizedMeta)}`;
    }

    return logString;
  })
);

/**
 * JSON format for production logs
 * Structured logging for easier parsing and analysis
 */


const jsonFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format((info) => {
    // Sanitize metadata before logging
    const sanitized = sanitizeMetadata(info);
    return {
      ...sanitized,
      environment,
      service: 'ecommerce-api'
    };
  })(),
  winston.format.json()
);

/**
 * Console transport configuration
 * Colorized output for development, plain for production
 */


const consoleTransport = new winston.transports.Console({
  format: isDevelopment
    ? winston.format.combine(
        winston.format.colorize({ all: true }),
        customFormat
      )
    : jsonFormat
});

/**
 * File transport for all logs
 * Daily rotation with compression
 */


const combinedFileTransport = new winston.transports.DailyRotateFile({
  filename: path.join('logs', 'combined-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '14d',
  zippedArchive: true,
  format: jsonFormat
});

/**
 * File transport for error logs only
 * Separate file for easier error tracking
 */


const errorFileTransport = new winston.transports.DailyRotateFile({
  filename: path.join('logs', 'error-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  level: 'error',
  maxSize: '20m',
  maxFiles: '30d',
  zippedArchive: true,
  format: jsonFormat
});

/**
 * File transport for HTTP request logs
 * Optional transport for API request tracking
 */


const httpFileTransport = new winston.transports.DailyRotateFile({
  filename: path.join('logs', 'http-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  level: 'http',
  maxSize: '20m',
  maxFiles: '7d',
  zippedArchive: true,
  format: jsonFormat
});

/**
 * Create the winston logger instance
 */


const logger = winston.createLogger({
  level: logLevel,
  levels,
  format: jsonFormat,
  defaultMeta: {
    service: 'ecommerce-api',
    environment
  },
  transports: [
    consoleTransport,
    combinedFileTransport,
    errorFileTransport
  ],
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join('logs', 'exceptions.log'),
      format: jsonFormat
    })
  ],
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join('logs', 'rejections.log'),
      format: jsonFormat
    })
  ],
  exitOnError: false
});

// Add HTTP transport only in production or if explicitly enabled
if (isProduction || process.env.LOG_HTTP === 'true') {
  logger.add(httpFileTransport);
}

/**
 * Stream object for Morgan HTTP logger integration
 * Writes HTTP logs to winston with 'http' level
 */
logger.stream = {
  write: (message) => {
    logger.http(message.trim());
  }
};

/**
 * Helper method to log with correlation ID
 * Useful for tracing requests across the system
 */
logger.logWithCorrelation = (level, message, correlationId, meta = {}) => {
  logger.log(level, message, { correlationId, ...meta });
};

/**
 * Helper method to log business operations
 * Standardized logging for business events
 */
logger.logBusinessEvent = (event, details = {}) => {
  logger.info(`Business Event: ${event}`, {
    event,
    ...details,
    timestamp: new Date().toISOString()
  });
};

/**
 * Helper method to log payment operations
 * Special handling for sensitive payment data
 */
logger.logPayment = (operation, details = {}) => {
  // Ensure payment details are sanitized
  const sanitizedDetails = sanitizeMetadata(details);
  logger.info(`Payment: ${operation}`, {
    operation,
    ...sanitizedDetails,
    timestamp: new Date().toISOString()
  });
};

/**
 * Helper method to log security events
 * Track authentication, authorization, and security-related events
 */
logger.logSecurity = (event, details = {}) => {
  logger.warn(`Security Event: ${event}`, {
    event,
    ...details,
    timestamp: new Date().toISOString()
  });
};

/**
 * Create a child logger with additional default metadata
 * Useful for module-specific logging
 */


const originalChild = logger.child.bind(logger);
logger.child = (metadata) => {
  return originalChild(metadata);
};

// Log startup message
if (isDevelopment) {
  logger.info('Logger initialized', {
    level: logLevel,
    environment,
    transports: logger.transports.map(t => t.constructor.name)
  });
}

module.exports = logger;
