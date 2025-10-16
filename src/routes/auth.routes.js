// File: src/routes/auth.routes.js
// Generated: 2025-10-16 10:46:27 UTC
// Project ID: proj_c85cfd5b58f3
// Task ID: task_yeljm3jj9sax


const express = require('express');


const logger = require('../utils/logger');

const { auth } = require('../middleware/auth');

const { authLimiter, strictLimiter } = require('../middleware/rateLimiter');

const { csrfProtection } = require('../middleware/csrf');

const { register, login, logout, refreshToken } = require('../controllers/auth.controller');

const { validateUserRegistration, validateUserLogin, validateRefreshToken, handleValidationErrors } = require('../middleware/validation');


const router = express.Router();

/**
 * POST /register
 * Register a new user account
 * Public route with strict rate limiting
 */
router.post(
  '/register',
  csrfProtection,
  strictLimiter,
  validateUserRegistration,
  handleValidationErrors,
  async (req, res, next) => {
    try {
      await register(req, res, next);
    } catch (error) {
      logger.error('Error in POST /auth/register', {
        timestamp: new Date().toISOString(),
        path: req.path
      });
      next(error);
    }
  }
);

/**
 * POST /login
 * Authenticate user and return access/refresh tokens
 * Public route with rate limiting to prevent brute force
 */
router.post(
  '/login',
  csrfProtection,
  authLimiter,
  validateUserLogin,
  handleValidationErrors,
  async (req, res, next) => {
    try {
      await login(req, res, next);
    } catch (error) {
      logger.error('Error in POST /auth/login', {
        timestamp: new Date().toISOString(),
        path: req.path
      });
      next(error);
    }
  }
);

/**
 * POST /logout
 * Logout user and invalidate tokens
 * Protected route - requires authentication
 */
router.post('/logout', csrfProtection, auth, async (req, res, next) => {
  try {
    await logout(req, res, next);
  } catch (error) {
    logger.error('Error in POST /auth/logout', {
      userId: req.userId,
      timestamp: new Date().toISOString(),
      path: req.path
    });
    next(error);
  }
});

/**
 * POST /refresh
 * Refresh access token using refresh token
 * Public route with rate limiting
 */
router.post('/refresh', csrfProtection, authLimiter, validateRefreshToken, handleValidationErrors, async (req, res, next) => {
  try {
    await refreshToken(req, res, next);
  } catch (error) {
    logger.error('Error in POST /auth/refresh', {
      timestamp: new Date().toISOString(),
      path: req.path
    });
    next(error);
  }
});

module.exports = router;
