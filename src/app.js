// File: src/app.js
// Generated: 2025-10-16 10:47:14 UTC
// Project ID: proj_c85cfd5b58f3
// Task ID: task_54cvjky7pk7m


const MongoStore = require('connect-mongo');


const cors = require('cors');


const express = require('express');


const helmet = require('helmet');


const logger = require('./utils/logger');


const mongoose = require('mongoose');


const rateLimit = require('express-rate-limit');


const router = require('./routes/index');


const session = require('express-session');

const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

const { requestLogger } = require('./middleware/logger');

/**
 * Validate required environment variables
 */


const validateEnvironment = () => {
  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction && !process.env.SESSION_SECRET) {
    throw new Error('SESSION_SECRET environment variable is required in production');
  }

  if (isProduction && !process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI environment variable is required in production');
  }
};

validateEnvironment();

/**
 * Initialize Express application
 */


const app = express();

// Trust proxy for deployment behind reverse proxies (Nginx, load balancers)
app.set('trust proxy', 1);

/**
 * Security Middleware
 */
app.use(helmet());

/**
 * CORS Configuration
 */
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

/**
 * Rate Limiting - 100 requests per 15 minutes on /api routes
 */


const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Rate Limiting for health check - 60 requests per 15 minutes
 */


const healthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 60,
  message: 'Too many health check requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false
});

app.use('/api', apiLimiter);

/**
 * Body Parser Middleware
 */
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

/**
 * Get MongoDB URI with validation
 */


const getMongoDBUri = () => {
  if (process.env.MONGODB_URI) {
    return process.env.MONGODB_URI;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('MONGODB_URI must be set in production environment');
  }

  return 'mongodb://localhost:27017/ecommerce';
};

/**
 * Get session secret with validation
 */


const getSessionSecret = () => {
  if (process.env.SESSION_SECRET) {
    return process.env.SESSION_SECRET;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('SESSION_SECRET must be set in production environment');
  }

  logger.warn('Using default session secret - NOT SUITABLE FOR PRODUCTION');
  return 'dev-secret-key-not-for-production-use';
};

/**
 * Session Configuration with MongoStore
 */
app.use(session({
  secret: getSessionSecret(),
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: getMongoDBUri(),
    touchAfter: 24 * 3600 // Lazy session update - 24 hours
  }),
  cookie: {
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax'
  }
}));

/**
 * Custom Request Logger
 */
app.use(requestLogger);

/**
 * Health Check Route with rate limiting
 */
app.get('/health', healthLimiter, (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

/**
 * API Routes
 */
app.use('/api', router);

/**
 * 404 Handler - Must be after all routes
 */
app.use(notFoundHandler);

/**
 * Global Error Handler - Must be last middleware
 */
app.use(errorHandler);

/**
 * MongoDB Connection Function
 */


const connectDB = async () => {
  try {
    const conn = await mongoose.connect(getMongoDBUri(), {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    logger.info('MongoDB connected successfully', {
      host: conn.connection.host,
      name: conn.connection.name
    });

    // Connection event listeners
    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
    });

    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB connection error', { error: err.message });
    });

    mongoose.connection.on('reconnected', () => {
      logger.info('MongoDB reconnected');
    });

  } catch (error) {
    logger.error('MongoDB connection failed', { error: error.message });
    process.exit(1);
  }
};

/**
 * Graceful Shutdown Handler
 */


const gracefulShutdown = async (signal) => {
  logger.info(`${signal} received, starting graceful shutdown`);

  try {
    await mongoose.connection.close();
    logger.info('MongoDB connection closed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during graceful shutdown', { error: error.message });
    process.exit(1);
  }
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

module.exports = { app, connectDB };
