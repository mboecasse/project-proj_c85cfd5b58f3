// File: tests/setup.js
// Generated: 2025-10-16 10:50:35 UTC
// Project ID: proj_c85cfd5b58f3
// Task ID: task_urzts8o14f7d

    const Redis = require('ioredis');


const jwt = require('jsonwebtoken');


const mongoose = require('mongoose');

const { MongoMemoryServer } = require('mongodb-memory-server');

// Test database and Redis instances

let mongoServer;

let redisClient;

/**
 * Global Setup - Runs once before all tests
 */
beforeAll(async () => {
  try {
    // Set test environment variables
    process.env.NODE_ENV = 'test';
    process.env.JWT_ACCESS_SECRET = 'test_jwt_secret_key_for_testing_only';
    process.env.JWT_ACCESS_EXPIRY = '1h';
    process.env.PAYMENT_GATEWAY_MODE = 'test';

    // Create in-memory MongoDB instance
    mongoServer = await MongoMemoryServer.create({
      instance: {
        dbName: `ecommerce_test_${process.env.JEST_WORKER_ID || '1'}`
      }
    });

    const mongoUri = mongoServer.getUri();

    // Connect to test MongoDB
    await mongoose.connect(mongoUri, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 5000
    });

    // Create database indexes for performance
    const db = mongoose.connection.db;

    // User indexes
    await db.collection('users').createIndex({ email: 1 }, { unique: true });
    await db.collection('users').createIndex({ role: 1 });

    // Product indexes
    await db.collection('products').createIndex({ name: 1 });
    await db.collection('products').createIndex({ category: 1 });
    await db.collection('products').createIndex({ price: 1 });

    // Order indexes
    await db.collection('orders').createIndex({ userId: 1 });
    await db.collection('orders').createIndex({ status: 1 });
    await db.collection('orders').createIndex({ createdAt: -1 });

    // Cart indexes
    await db.collection('carts').createIndex({ userId: 1 }, { unique: true });

    // Initialize Redis client for testing (DB 1)
    redisClient = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      db: process.env.REDIS_TEST_DB || 15, // Use separate database for tests (15 is typically safe)
      retryStrategy: () => null, // Don't retry in tests
      maxRetriesPerRequest: 1,
      lazyConnect: true // Don't connect immediately
    });

    // Wait for Redis connection with proper error handling
    try {
      await redisClient.connect();
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Redis connection timeout')), 5000);
        redisClient.once('ready', () => {
          clearTimeout(timeout);
          resolve();
        });
        redisClient.once('error', (err) => {
          clearTimeout(timeout);
          reject(err);
        });
      });

      // Flush test Redis database
      await redisClient.flushdb();
    } catch (redisError) {
      console.warn('Redis connection failed, tests will run without Redis:', redisError.message);
      // Disconnect failed Redis client
      if (redisClient) {
        try {
          await redisClient.quit();
        } catch (quitError) {
          // Ignore quit errors
        }
        redisClient = null;
      }
    }

  } catch (error) {
    console.error('Global setup failed:', error.message);
    // Cleanup on failure
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
    if (mongoServer) {
      await mongoServer.stop();
    }
    if (redisClient) {
      try {
        await redisClient.quit();
      } catch (quitError) {
        // Ignore quit errors
      }
    }
    throw error;
  }
}, 30000);

/**
 * Test Isolation - Runs before each test
 */
beforeEach(async () => {
  try {
    // Clear all MongoDB collections
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany({});
    }

    // Flush Redis test database
    if (redisClient && redisClient.status === 'ready') {
      await redisClient.flushdb();
    }

    // Seed minimal test data
    const User = mongoose.model('User', new mongoose.Schema({
      name: String,
      email: { type: String, unique: true },
      password: String,
      role: { type: String, default: 'customer' }
    }));

    const Category = mongoose.model('Category', new mongoose.Schema({
      name: String,
      description: String
    }));

    // Create test users
    await User.create([
      {
        name: 'Test Customer',
        email: 'customer@test.com',
        password: '$2a$10$XQKvvZJvvZJvvZJvvZJvvO', // hashed 'password123'
        role: 'customer'
      },
      {
        name: 'Test Admin',
        email: 'admin@test.com',
        password: '$2a$10$XQKvvZJvvZJvvZJvvZJvvO', // hashed 'password123'
        role: 'admin'
      }
    ]);

    // Create test categories
    await Category.create([
      {
        name: 'Electronics',
        description: 'Electronic devices and accessories'
      },
      {
        name: 'Clothing',
        description: 'Apparel and fashion items'
      }
    ]);

  } catch (error) {
    console.error('Test isolation setup failed:', error.message);
    throw error;
  }
});

/**
 * Cleanup - Runs after each test
 */
afterEach(() => {
  // Clear all Jest mocks
  jest.clearAllMocks();
});

/**
 * Global Teardown - Runs once after all tests
 */
afterAll(async () => {
  try {
    // Drop test database
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.dropDatabase();
    }

    // Close MongoDB connection
    await mongoose.disconnect();

    // Close MongoDB memory server
    if (mongoServer) {
      await mongoServer.stop();
    }

    // Close Redis connection
    if (redisClient && redisClient.status === 'ready') {
      await redisClient.quit();
    }

    // Wait for graceful shutdown
    await new Promise(resolve => setTimeout(resolve, 500));

  } catch (error) {
    console.error('Global teardown failed:', error.message);
    throw error;
  }
}, 30000);

/**
 * Mock External Services
 */

// Mock payment gateway
jest.mock('../src/services/paymentGateway', () => ({
  processPayment: jest.fn().mockResolvedValue({
    success: true,
    transactionId: 'test_txn_123',
    amount: 0,
    currency: 'USD',
    status: 'completed'
  }),
  refundPayment: jest.fn().mockResolvedValue({
    success: true,
    refundId: 'test_refund_123',
    status: 'refunded'
  })
}));

// Mock email service
jest.mock('../src/services/emailService', () => ({
  sendOrderConfirmation: jest.fn().mockResolvedValue(true),
  sendPasswordReset: jest.fn().mockResolvedValue(true),
  sendWelcomeEmail: jest.fn().mockResolvedValue(true),
  sendOrderStatusUpdate: jest.fn().mockResolvedValue(true)
}));

/**
 * Global Test Helpers
 */

/**
 * Create a test user with optional overrides
 * @param {Object} overrides - Properties to override default user
 * @returns {Promise<Object>} Created user document
 */
global.createTestUser = async (overrides = {}) => {
  const User = mongoose.model('User');

  const timestamp = Date.now();
  const randomNum = Math.floor(Math.random() * 10000);

  const defaultUser = {
    name: `Test User ${timestamp}`,
    email: `user${timestamp}${randomNum}@test.com`,
    password: '$2a$10$XQKvvZJvvZJvvZJvvZJvvO', // hashed 'password123'
    role: 'customer',
    ...overrides
  };

  return await User.create(defaultUser);
};

/**
 * Create a test product with optional overrides
 * @param {Object} overrides - Properties to override default product
 * @returns {Promise<Object>} Created product document
 */
global.createTestProduct = async (overrides = {}) => {
  const Product = mongoose.model('Product', new mongoose.Schema({
    name: String,
    description: String,
    price: Number,
    category: String,
    stock: Number,
    images: [String],
    isActive: { type: Boolean, default: true }
  }));

  const timestamp = Date.now();
  const randomNum = Math.floor(Math.random() * 10000);

  const defaultProduct = {
    name: `Test Product ${timestamp}${randomNum}`,
    description: 'Test product description',
    price: 99.99,
    category: 'Electronics',
    stock: 100,
    images: ['https://example.com/image.jpg'],
    isActive: true,
    ...overrides
  };

  return await Product.create(defaultProduct);
};

/**
 * Generate JWT authentication token for testing
 * @param {string} userId - User ID to encode in token
 * @param {string} role - User role (default: 'customer')
 * @returns {string} JWT token
 */
global.generateAuthToken = (userId, role = 'customer') => {
  const payload = {
    userId: userId.toString(),
    role
  };

  return jwt.sign(
    payload,
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: process.env.JWT_ACCESS_EXPIRY || '1h' }
  );
};

/**
 * Get Redis client for test assertions
 * @returns {Object} Redis client instance
 */
global.getRedisClient = () => redisClient;

/**
 * Wait for a specified duration (useful for async operations)
 * @param {number} ms - Milliseconds to wait
 * @returns {Promise<void>}
 */
global.wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

module.exports = {};
