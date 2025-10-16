// File: src/config/database.js
// Generated: 2025-10-16 10:39:23 UTC
// Project ID: proj_c85cfd5b58f3
// Task ID: task_php88vtrb4ft

    const { MongoMemoryServer } = require('mongodb-memory-server');


const logger = require('../utils/logger');


const mongoose = require('mongoose');

/**
 * MongoDB connection configuration with retry logic
 * Handles connection lifecycle, retries, and graceful shutdown
 */

// Connection options optimized for e-commerce workload


const connectionOptions = {
  maxPoolSize: parseInt(process.env.MONGODB_MAX_POOL_SIZE) || 10,
  minPoolSize: parseInt(process.env.MONGODB_MIN_POOL_SIZE) || 2,
  serverSelectionTimeoutMS: parseInt(process.env.MONGODB_SERVER_TIMEOUT) || 5000,
  socketTimeoutMS: parseInt(process.env.MONGODB_SOCKET_TIMEOUT) || 45000,
  family: 4, // Use IPv4
  retryWrites: true,
  w: 'majority',
  wtimeoutMS: 5000,
  maxIdleTimeMS: 60000,
  compressors: ['zlib']
};

// Retry configuration


const MAX_RETRY_ATTEMPTS = parseInt(process.env.MONGODB_RETRY_ATTEMPTS) || 5;


const INITIAL_RETRY_DELAY = parseInt(process.env.MONGODB_RETRY_DELAY) || 5000;


const MAX_RETRY_DELAY = 30000;

// Connection state

let isConnecting = false;

let connectionAttempts = 0;

/**
 * Calculate exponential backoff delay
 * @param {number} attempt - Current attempt number
 * @returns {number} Delay in milliseconds
 */


const calculateBackoffDelay = (attempt) => {
  const delay = INITIAL_RETRY_DELAY * Math.pow(2, attempt - 1);
  return Math.min(delay, MAX_RETRY_DELAY);
};

/**
 * Validate MongoDB connection string
 * @param {string} uri - MongoDB connection URI
 * @returns {boolean} True if valid
 */


const validateConnectionString = (uri) => {
  if (!uri) {
    logger.error('MongoDB URI is not defined in environment variables');
    return false;
  }

  if (!uri.startsWith('mongodb://') && !uri.startsWith('mongodb+srv://')) {
    logger.error('Invalid MongoDB URI format', { uri: uri.substring(0, 20) + '...' });
    return false;
  }

  return true;
};

/**
 * Connect to MongoDB with retry logic
 * Implements exponential backoff for failed connections
 * @returns {Promise<mongoose.Connection>} Mongoose connection instance
 */


const connectDB = async () => {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB_NAME;

  // Validate connection string
  if (!validateConnectionString(uri)) {
    throw new Error('Invalid MongoDB connection configuration');
  }

  // Prevent multiple simultaneous connection attempts
  if (isConnecting) {
    logger.warn('Connection attempt already in progress');
    return mongoose.connection;
  }

  isConnecting = true;

  // Add database name to options if specified
  const options = { ...connectionOptions };
  if (dbName) {
    options.dbName = dbName;
  }

  let lastError;

  for (let attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt++) {
    try {
      connectionAttempts = attempt;

      logger.info('Attempting MongoDB connection', {
        attempt,
        maxAttempts: MAX_RETRY_ATTEMPTS,
        database: dbName || 'default'
      });

      await mongoose.connect(uri, options);

      logger.info('MongoDB connected successfully', {
        host: mongoose.connection.host,
        database: mongoose.connection.name,
        readyState: mongoose.connection.readyState
      });

      isConnecting = false;
      connectionAttempts = 0;
      return mongoose.connection;

    } catch (error) {
      lastError = error;

      logger.error('MongoDB connection failed', {
        attempt,
        maxAttempts: MAX_RETRY_ATTEMPTS,
        error: error.message,
        code: error.code,
        name: error.name
      });

      // If this was the last attempt, throw the error
      if (attempt >= MAX_RETRY_ATTEMPTS) {
        isConnecting = false;
        throw new Error(
          `Failed to connect to MongoDB after ${MAX_RETRY_ATTEMPTS} attempts: ${error.message}`
        );
      }

      // Calculate delay and wait before retry
      const delay = calculateBackoffDelay(attempt);
      logger.info('Retrying MongoDB connection', {
        nextAttempt: attempt + 1,
        delayMs: delay
      });

      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  isConnecting = false;
  throw lastError;
};

/**
 * Gracefully disconnect from MongoDB
 * @returns {Promise<void>}
 */


const disconnectDB = async () => {
  try {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
      logger.info('MongoDB connection closed successfully');
    }
  } catch (error) {
    logger.error('Error closing MongoDB connection', { error: error.message });
    throw error;
  }
};

/**
 * Check if database is connected
 * @returns {boolean} True if connected
 */


const isConnected = () => {
  return mongoose.connection.readyState === 1;
};

/**
 * Get database instance
 * @returns {mongoose.mongo.Db} Database instance
 */


const getDB = () => {
  if (!isConnected()) {
    throw new Error('Database not connected');
  }
  return mongoose.connection.db;
};

/**
 * Get connection health status
 * @returns {Object} Health status object
 */


const getHealthStatus = () => {
  const states = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };

  return {
    connected: isConnected(),
    readyState: mongoose.connection.readyState,
    status: states[mongoose.connection.readyState] || 'unknown',
    host: mongoose.connection.host || null,
    database: mongoose.connection.name || null
  };
};

// Connection event handlers
mongoose.connection.on('connected', () => {
  logger.info('Mongoose connected to MongoDB', {
    host: mongoose.connection.host,
    database: mongoose.connection.name
  });
});

mongoose.connection.on('error', (error) => {
  logger.error('Mongoose connection error', {
    error: error.message,
    code: error.code,
    name: error.name
  });
});

mongoose.connection.on('disconnected', () => {
  logger.warn('Mongoose disconnected from MongoDB');
});

mongoose.connection.on('reconnected', () => {
  logger.info('Mongoose reconnected to MongoDB');
});

mongoose.connection.on('reconnectFailed', () => {
  logger.error('Mongoose reconnection failed - all retries exhausted');
});

// Handle application termination


const handleShutdown = async (signal) => {
  logger.info(`${signal} received - closing MongoDB connection`);
  try {
    await disconnectDB();
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown', { error: error.message });
    process.exit(1);
  }
};

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', { error: error.message, stack: error.stack });
  handleShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled promise rejection', {
    reason: reason instanceof Error ? reason.message : reason,
    promise: promise
  });
});

/**
 * Connect to test database (in-memory MongoDB for testing)
 * @returns {Promise<Object>} MongoMemoryServer instance
 */


const connectTestDB = async () => {
  try {

    const mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();

    await mongoose.connect(uri, {
      maxPoolSize: 5,
      serverSelectionTimeoutMS: 5000
    });

    logger.info('Connected to in-memory test database');

    return mongod;
  } catch (error) {
    logger.error('Failed to connect to test database', { error: error.message });
    throw error;
  }
};

/**
 * Close test database and cleanup
 * @param {Object} mongod - MongoMemoryServer instance
 * @returns {Promise<void>}
 */


const closeTestDB = async (mongod) => {
  try {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
    if (mongod) {
      await mongod.stop();
    }
    logger.info('Test database closed and cleaned up');
  } catch (error) {
    logger.error('Error closing test database', { error: error.message });
    throw error;
  }
};

module.exports = {
  connectDB,
  disconnectDB,
  isConnected,
  getDB,
  getHealthStatus,
  connectTestDB,
  closeTestDB
};
