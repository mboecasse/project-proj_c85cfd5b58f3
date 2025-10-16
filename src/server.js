// File: src/server.js
// Generated: 2025-10-16 10:50:23 UTC
// Project ID: proj_c85cfd5b58f3
// Task ID: task_lu4xagajrwyk


const { app } = require('./app');

const { client: redisClient, isHealthy: isRedisHealthy } = require('./config/redis');

const { connectDB, disconnectDB, isConnected } = require('./config/database');

// Environment variables


const PORT = process.env.PORT || 3000;


const NODE_ENV = process.env.NODE_ENV || 'development';

// Server instance

let server = null;

let isShuttingDown = false;

let shutdownPromise = null;

/**
 * Start the server
 * Connects to MongoDB and Redis, then starts the Express server
 */
async function startServer() {
  try {
    // Connect to MongoDB
    console.log('🔄 Connecting to MongoDB...');
    await connectDB();
    console.log('✓ MongoDB connected successfully');

    // Initialize Redis connection (connection is automatic on first use)
    console.log('🔄 Initializing Redis...');
    await redisClient.ping();
    console.log('✓ Redis connected successfully');

    // Start Express server
    server = app.listen(PORT, () => {
      console.log('✓ Server started successfully');
      console.log(`  Port: ${PORT}`);
      console.log(`  Environment: ${NODE_ENV}`);
      console.log(`  Time: ${new Date().toISOString()}`);
      console.log(`  MongoDB: ${isConnected() ? 'Connected' : 'Disconnected'}`);
      console.log(`  Redis: ${isRedisHealthy() ? 'Connected' : 'Disconnected'}`);
    });

    // Handle server errors
    server.on('error', (error) => {
      console.error('✗ Server error:', error.message);
      process.exit(1);
    });

  } catch (error) {
    console.error('✗ Failed to start server:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

/**
 * Graceful shutdown handler
 * Closes all connections and exits cleanly
 */
async function gracefulShutdown(signal) {
  if (isShuttingDown) {
    console.log('⚠️  Shutdown already in progress...');
    return shutdownPromise;
  }

  isShuttingDown = true;
  console.log(`\n🔄 Received ${signal}, starting graceful shutdown...`);

  shutdownPromise = (async () => {
    // Set timeout for forced shutdown
    const shutdownTimeout = setTimeout(() => {
      console.error('✗ Graceful shutdown timeout, forcing exit');
      process.exit(1);
    }, 10000);

    try {
      // Stop accepting new connections
      if (server) {
        console.log('🔄 Closing HTTP server...');
        await new Promise((resolve, reject) => {
          server.close((err) => {
            if (err) {
              console.error('✗ Error closing HTTP server:', err.message);
              reject(err);
            } else {
              console.log('✓ HTTP server closed');
              resolve();
            }
          });
        });
      }

      // Close MongoDB connection
      if (isConnected()) {
        console.log('🔄 Closing MongoDB connection...');
        await disconnectDB();
        console.log('✓ MongoDB connection closed');
      }

      // Close Redis connection
      if (isRedisHealthy()) {
        console.log('🔄 Closing Redis connection...');
        await redisClient.quit();
        console.log('✓ Redis connection closed');
      }

      clearTimeout(shutdownTimeout);
      console.log('✓ Graceful shutdown completed');
      process.exit(0);

    } catch (error) {
      clearTimeout(shutdownTimeout);
      console.error('✗ Error during graceful shutdown:', error.message);
      process.exit(1);
    }
  })();

  return shutdownPromise;
}

/**
 * Handle uncaught exceptions
 */
process.on('uncaughtException', async (error) => {
  console.error('✗ Uncaught Exception:', error.message);
  console.error('Stack trace:', error.stack);
  await gracefulShutdown('uncaughtException');
});

/**
 * Handle unhandled promise rejections
 */
process.on('unhandledRejection', async (reason, promise) => {
  console.error('✗ Unhandled Rejection at:', promise);
  console.error('Reason:', reason);
  await gracefulShutdown('unhandledRejection');
});

/**
 * Handle SIGTERM signal
 */
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

/**
 * Handle SIGINT signal (Ctrl+C)
 */
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

/**
 * Start the server if this file is run directly
 */
if (require.main === module) {
  startServer();
}

module.exports = { startServer, gracefulShutdown };
