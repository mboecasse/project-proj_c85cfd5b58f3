// File: src/config/environment.js
// Generated: 2025-10-16 10:40:30 UTC
// Project ID: proj_c85cfd5b58f3
// Task ID: task_ckfhkk1ar304


const dotenv = require('dotenv');

* Validates and exports all environment variables with proper defaults
 * Ensures application fails fast if critical configuration is missing
 */

// Load environment variables from .env file
dotenv.config();

/**
 * Validates that a required environment variable exists
 * @param {string} key - Environment variable name
 * @param {string} description - Human-readable description for error messages
 * @throws {Error} If variable is missing
 */


const requireEnv = (key, description) => {
  const value = process.env[key];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${key}\n` +
      `Description: ${description}\n` +
      `Please check your .env file and ensure ${key} is set.`
    );
  }
  return value;
};

/**
 * Validates MongoDB URI format
 * @param {string} uri - MongoDB connection string
 * @throws {Error} If URI format is invalid
 */


const validateMongoUri = (uri) => {
  const mongoPattern = /^mongodb(\+srv)?:\/\/.+/;
  if (!mongoPattern.test(uri)) {
    throw new Error(
      'Invalid MongoDB URI format. Expected format: mongodb://... or mongodb+srv://...'
    );
  }
};

/**
 * Validates and parses port number
 * @param {string} port - Port number as string
 * @returns {number} Validated port number
 * @throws {Error} If port is invalid
 */


const validatePort = (port) => {
  const portNum = parseInt(port, 10);
  if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
    throw new Error(`Invalid port number: ${port}. Must be between 1 and 65535.`);
  }
  return portNum;
};

/**
 * Validates JWT secret strength
 * @param {string} secret - JWT secret
 * @throws {Error} If secret is too weak
 */


const validateJwtSecret = (secret) => {
  if (secret.length < 32) {
    throw new Error(
      'JWT_ACCESS_SECRET must be at least 32 characters long for security. ' +
      'Generate a strong random string for production use.'
    );
  }
};

/**
 * Validates refresh token secret strength
 * @param {string} secret - Refresh token secret
 * @throws {Error} If secret is too weak
 */


const validateRefreshSecret = (secret) => {
  if (secret.length < 32) {
    throw new Error(
      'JWT_REFRESH_SECRET must be at least 32 characters long for security. ' +
      'Generate a strong random string for production use.'
    );
  }
};

/**
 * Parses CORS origins from comma-separated string
 * @param {string} origins - Comma-separated list of origins
 * @returns {Array<string>} Array of origin URLs
 */


const parseCorsOrigins = (origins) => {
  if (!origins) return ['http://localhost:3000'];

  return origins.split(',').map(origin => origin.trim()).filter(origin => {
    try {
      new URL(origin);
      return true;
    } catch (error) {
      console.warn(`Invalid CORS origin ignored: ${origin}`);
      return false;
    }
  });
};

/**
 * Validates email configuration for production
 * @throws {Error} If email config is incomplete in production
 */


const validateEmailConfig = () => {
  if (process.env.NODE_ENV === 'production') {
    if (!process.env.EMAIL_HOST || !process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
      throw new Error(
        'Email configuration incomplete for production environment. ' +
        'EMAIL_HOST, EMAIL_USER, and EMAIL_PASSWORD are required.'
      );
    }
  }
};

/**
 * Validates payment gateway configuration for production
 * @throws {Error} If payment config is incomplete in production
 */


const validatePaymentConfig = () => {
  if (process.env.NODE_ENV === 'production') {
    if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_PUBLISHABLE_KEY) {
      throw new Error(
        'Payment gateway configuration incomplete for production environment. ' +
        'STRIPE_SECRET_KEY and STRIPE_PUBLISHABLE_KEY are required.'
      );
    }
  }
};

/**
 * Main validation function - runs all checks
 * @throws {Error} If any validation fails
 */


const validateEnvironment = () => {
  const nodeEnv = process.env.NODE_ENV || 'development';

  // Validate required variables
  const mongoUri = requireEnv('MONGODB_URI', 'MongoDB connection string');
  validateMongoUri(mongoUri);

  const port = requireEnv('PORT', 'Server port number');
  validatePort(port);

  const jwtSecret = requireEnv('JWT_ACCESS_SECRET', 'JWT access token secret');
  validateJwtSecret(jwtSecret);

  const jwtRefreshSecret = requireEnv('JWT_REFRESH_SECRET', 'JWT refresh token secret');
  validateRefreshSecret(jwtRefreshSecret);

  requireEnv('JWT_ACCESS_EXPIRY', 'JWT access token expiration time');
  requireEnv('JWT_REFRESH_EXPIRY', 'JWT refresh token expiration time');

  // Production-specific validations
  if (nodeEnv === 'production') {
    validateEmailConfig();
    validatePaymentConfig();

    if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
      throw new Error(
        'SESSION_SECRET must be set and at least 32 characters long in production.'
      );
    }
  }

  // Warn about missing optional variables
  if (!process.env.CORS_ORIGIN) {
    console.warn('CORS_ORIGIN not set, defaulting to http://localhost:3000');
  }

  if (!process.env.RATE_LIMIT_WINDOW) {
    console.warn('RATE_LIMIT_WINDOW not set, defaulting to 15 minutes');
  }

  if (!process.env.RATE_LIMIT_MAX) {
    console.warn('RATE_LIMIT_MAX not set, defaulting to 100 requests per window');
  }
};

// Run validation immediately on module load
try {
  validateEnvironment();
} catch (error) {
  console.error('Environment validation failed:', error.message);
  console.error('\nPlease check your .env file and ensure all required variables are set.');
  console.error('Refer to .env.example for the complete list of required variables.\n');
  process.exit(1);
}

// Validate MongoDB URI before export
validateMongoUri(process.env.MONGODB_URI);

// Validate JWT secrets before export
validateJwtSecret(process.env.JWT_ACCESS_SECRET);
validateRefreshSecret(process.env.JWT_REFRESH_SECRET);

/**
 * Export validated and typed configuration object
 */
module.exports = {
  // Node environment
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  isDevelopment: process.env.NODE_ENV === 'development',
  isTest: process.env.NODE_ENV === 'test',

  // Server configuration
  port: validatePort(process.env.PORT),
  host: process.env.HOST || '0.0.0.0',

  // Database configuration
  mongodb: {
    uri: process.env.MONGODB_URI,
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      maxPoolSize: parseInt(process.env.MONGODB_POOL_SIZE || '10', 10),
      serverSelectionTimeoutMS: parseInt(process.env.MONGODB_TIMEOUT || '5000', 10),
      socketTimeoutMS: parseInt(process.env.MONGODB_SOCKET_TIMEOUT || '45000', 10)
    }
  },

  // JWT configuration
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    accessExpiry: process.env.JWT_ACCESS_EXPIRY || '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    refreshExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',
    issuer: process.env.JWT_ISSUER || 'ecommerce-api',
    audience: process.env.JWT_AUDIENCE || 'ecommerce-client'
  },

  // Payment gateway configuration (Stripe)
  payment: {
    stripeSecretKey: process.env.STRIPE_SECRET_KEY || '',
    stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
    currency: process.env.PAYMENT_CURRENCY || 'usd',
    successUrl: process.env.PAYMENT_SUCCESS_URL || 'http://localhost:3000/payment/success',
    cancelUrl: process.env.PAYMENT_CANCEL_URL || 'http://localhost:3000/payment/cancel'
  },

  // Email service configuration
  email: {
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT || '587', 10),
    secure: process.env.EMAIL_SECURE === 'true',
    user: process.env.EMAIL_USER || '',
    password: process.env.EMAIL_PASSWORD || '',
    from: process.env.EMAIL_FROM || 'noreply@ecommerce.com',
    fromName: process.env.EMAIL_FROM_NAME || 'E-Commerce Store'
  },

  // CORS configuration
  cors: {
    origin: parseCorsOrigins(process.env.CORS_ORIGIN),
    credentials: process.env.CORS_CREDENTIALS !== 'false',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['X-Total-Count', 'X-Page-Count'],
    maxAge: parseInt(process.env.CORS_MAX_AGE || '86400', 10)
  },

  // File upload configuration
  upload: {
    maxFileSize: process.env.MAX_FILE_SIZE || '5mb',
    maxFileSizeBytes: parseInt(process.env.MAX_FILE_SIZE_BYTES || '5242880', 10),
    allowedImageTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'],
    uploadDir: process.env.UPLOAD_DIR || 'uploads',
    tempDir: process.env.TEMP_DIR || 'uploads/temp'
  },

  // Rate limiting configuration
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW || '15', 10) * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: process.env.RATE_LIMIT_SKIP_SUCCESS === 'true',
    skipFailedRequests: process.env.RATE_LIMIT_SKIP_FAILED === 'true'
  },

  // Session configuration
  session: {
    secret: process.env.SESSION_SECRET || 'dev-session-secret-change-in-production',
    name: process.env.SESSION_NAME || 'ecommerce.sid',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: parseInt(process.env.SESSION_MAX_AGE || '86400000', 10),
      sameSite: process.env.SESSION_SAME_SITE || 'lax'
    }
  },

  // Logging configuration
  logging: {
    level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
    format: process.env.LOG_FORMAT || 'json',
    directory: process.env.LOG_DIR || 'logs',
    maxFiles: parseInt(process.env.LOG_MAX_FILES || '14', 10),
    maxSize: process.env.LOG_MAX_SIZE || '20m'
  },

  // Pagination defaults
  pagination: {
    defaultLimit: parseInt(process.env.PAGINATION_LIMIT || '20', 10),
    maxLimit: parseInt(process.env.PAGINATION_MAX_LIMIT || '100', 10)
  },

  // Cache configuration
  cache: {
    ttl: parseInt(process.env.CACHE_TTL || '3600', 10),
    checkPeriod: parseInt(process.env.CACHE_CHECK_PERIOD || '600', 10)
  },

  // Redis configuration (if used)
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || '',
    db: parseInt(process.env.REDIS_DB || '0', 10),
    keyPrefix: process.env.REDIS_KEY_PREFIX || 'ecommerce:',
    enableOfflineQueue: process.env.REDIS_OFFLINE_QUEUE !== 'false'
  },

  // Client URL (for email links, redirects, etc.)
  clientUrl: process.env.CLIENT_URL || 'http://localhost:3000',

  // API configuration
  api: {
    prefix: process.env.API_PREFIX || '/api',
    version: process.env.API_VERSION || 'v1'
  },

  // Security configuration
  security: {
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '10', 10),
    passwordMinLength: parseInt(process.env.PASSWORD_MIN_LENGTH || '8', 10),
    passwordResetExpiry: parseInt(process.env.PASSWORD_RESET_EXPIRY || '3600000', 10),
    maxLoginAttempts: parseInt(process.env.MAX_LOGIN_ATTEMPTS || '5', 10),
    lockoutDuration: parseInt(process.env.LOCKOUT_DURATION || '900000', 10)
  },

  // Feature flags
  features: {
    enableRegistration: process.env.ENABLE_REGISTRATION !== 'false',
    enableEmailVerification: process.env.ENABLE_EMAIL_VERIFICATION === 'true',
    enableSocialAuth: process.env.ENABLE_SOCIAL_AUTH === 'true',
    enableGuestCheckout: process.env.ENABLE_GUEST_CHECKOUT !== 'false',
    enableReviews: process.env.ENABLE_REVIEWS !== 'false',
    enableWishlist: process.env.ENABLE_WISHLIST !== 'false'
  }
};
