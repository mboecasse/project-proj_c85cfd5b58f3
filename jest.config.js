// File: jest.config.js
// Generated: 2025-10-16 10:39:30 UTC
// Project ID: proj_c85cfd5b58f3
// Task ID: task_9g4l5bfahwse

module.exports = {
  // Use Node environment for backend testing
  testEnvironment: 'node',

  // Coverage output directory
  coverageDirectory: 'coverage',

  // Collect coverage from these files
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/server.js',
    '!src/config/**',
    '!src/migrations/**',
    '!src/seeds/**',
    '!src/**/*.test.js',
    '!src/**/*.spec.js'
  ],

  // Coverage thresholds - fail if not met
  // Higher thresholds for critical business logic (payments, orders)
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 75,
      lines: 75,
      statements: 75
    },
    './src/services/payment/**/*.js': {
      branches: 90,
      functions: 95,
      lines: 95,
      statements: 95
    },
    './src/services/order/**/*.js': {
      branches: 85,
      functions: 90,
      lines: 90,
      statements: 90
    },
    './src/controllers/cart/**/*.js': {
      branches: 80,
      functions: 85,
      lines: 85,
      statements: 85
    },
    './src/controllers/order/**/*.js': {
      branches: 80,
      functions: 85,
      lines: 85,
      statements: 85
    }
  },

  // Test file patterns
  testMatch: [
    '**/__tests__/**/*.js',
    '**/?(*.)+(spec|test).js'
  ],

  // Ignore these patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/coverage/',
    '/dist/',
    '/build/'
  ],

  // Module path aliases - must match application structure
  moduleNameMapper: {
    '^@models/(.*)$': '<rootDir>/src/models/$1',
    '^@controllers/(.*)$': '<rootDir>/src/controllers/$1',
    '^@services/(.*)$': '<rootDir>/src/services/$1',
    '^@middleware/(.*)$': '<rootDir>/src/middleware/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1',
    '^@config/(.*)$': '<rootDir>/src/config/$1',
    '^@validators/(.*)$': '<rootDir>/src/validators/$1',
    '^@routes/(.*)$': '<rootDir>/src/routes/$1'
  },

  // Setup files to run after environment is set up
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],

  // Global setup - runs once before all tests
  globalSetup: '<rootDir>/tests/globalSetup.js',

  // Global teardown - runs once after all tests
  globalTeardown: '<rootDir>/tests/globalTeardown.js',

  // Timeout for tests (30 seconds for database operations)
  testTimeout: 30000,

  // Clear mocks between tests
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,

  // Verbose output for better debugging
  verbose: true,

  // Force exit after tests complete
  forceExit: true,

  // Detect open handles (useful for finding async issues)
  detectOpenHandles: true,

  // Maximum number of workers
  // Use 1 for tests with shared database state to avoid conflicts
  // Use '50%' for parallel execution where safe
  maxWorkers: 1,

  // Coverage reporters
  coverageReporters: [
    'text',
    'text-summary',
    'lcov',
    'html',
    'json'
  ],

  // Transform files with babel-jest if needed
  // Uncomment if using ES6+ features not supported by Node version
  // transform: {
  //   '^.+\\.js$': 'babel-jest'
  // },

  // Projects configuration for different test types
  projects: [
    {
      displayName: 'unit',
      testMatch: ['<rootDir>/tests/unit/**/*.test.js'],
      testEnvironment: 'node',
      testTimeout: 10000
    },
    {
      displayName: 'integration',
      testMatch: ['<rootDir>/tests/integration/**/*.test.js'],
      testEnvironment: 'node',
      testTimeout: 30000,
      maxWorkers: 1 // Serial execution for database tests
    },
    {
      displayName: 'e2e',
      testMatch: ['<rootDir>/tests/e2e/**/*.test.js'],
      testEnvironment: 'node',
      testTimeout: 60000,
      maxWorkers: 1 // Serial execution for full API tests
    }
  ],

  // Slow test threshold (in seconds)
  slowTestThreshold: 5,

  // Notify on completion
  notify: false,

  // Bail after first test failure (useful in CI)
  // bail: 1,

  // Watch plugins for interactive mode
  watchPlugins: [
    'jest-watch-typeahead/filename',
    'jest-watch-typeahead/testname'
  ],

  // Module file extensions
  moduleFileExtensions: [
    'js',
    'json',
    'node'
  ],

  // Roots - where to look for tests
  roots: [
    '<rootDir>/src',
    '<rootDir>/tests'
  ]
};
