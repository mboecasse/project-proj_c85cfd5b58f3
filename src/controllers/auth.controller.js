// File: src/controllers/auth.controller.js
// Generated: 2025-10-16 10:51:24 UTC
// Project ID: proj_c85cfd5b58f3
// Task ID: task_0m7w6776scao


const ApiResponse = require('../utils/response');


const authService = require('../services/auth.service');


const logger = require('../utils/logger');

/**
 * Register new user
 * POST /auth/register
 */


const register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    logger.info('Registration attempt', { email });

    const result = await authService.register({ name, email, password });

    logger.info('User registered successfully', { userId: result.user._id, email });

    res.status(201).json(
      ApiResponse.success(result, 'User registered successfully')
    );
  } catch (error) {
    logger.error('Registration failed', {
      email: req.body.email,
      error: error.message
    });
    next(error);
  }
};

/**
 * Login user
 * POST /auth/login
 */


const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    logger.info('Login attempt', { email });

    const result = await authService.login({ email, password });

    logger.info('User logged in successfully', { userId: result.user._id, email });

    res.json(
      ApiResponse.success(result, 'Login successful')
    );
  } catch (error) {
    logger.error('Login failed', {
      email: req.body.email,
      error: error.message
    });
    next(error);
  }
};

/**
 * Refresh access token
 * POST /auth/refresh
 */


const refreshToken = async (req, res, next) => {
  try {
    const { refreshToken: token } = req.body;

    if (!token) {
      logger.warn('Refresh token missing in request');
      return res.status(400).json(
        ApiResponse.error('Refresh token is required')
      );
    }

    logger.info('Token refresh attempt');

    const result = await authService.refreshToken(token);

    logger.info('Token refreshed successfully', { userId: result.user._id });

    res.json(
      ApiResponse.success(result, 'Token refreshed successfully')
    );
  } catch (error) {
    logger.error('Token refresh failed', { error: error.message });
    next(error);
  }
};

/**
 * Logout user (invalidate current token)
 * POST /auth/logout
 */


const logout = async (req, res, next) => {
  try {
    const userId = req.userId;
    const token = req.token;

    if (!userId || !token) {
      logger.warn('Logout attempt without valid authentication');
      return res.status(401).json(
        ApiResponse.error('Authentication required')
      );
    }

    logger.info('Logout attempt', { userId });

    await authService.logout(userId, token);

    logger.info('User logged out successfully', { userId });

    res.json(
      ApiResponse.success(null, 'Logged out successfully')
    );
  } catch (error) {
    logger.error('Logout failed', {
      userId: req.userId,
      error: error.message
    });
    next(error);
  }
};

/**
 * Logout from all devices (invalidate all user tokens)
 * POST /auth/logout-all
 */


const logoutAll = async (req, res, next) => {
  try {
    const userId = req.userId;

    if (!userId) {
      logger.warn('Logout all attempt without valid authentication');
      return res.status(401).json(
        ApiResponse.error('Authentication required')
      );
    }

    logger.info('Logout all devices attempt', { userId });

    await authService.logoutAll(userId);

    logger.info('User logged out from all devices', { userId });

    res.json(
      ApiResponse.success(null, 'Logged out from all devices successfully')
    );
  } catch (error) {
    logger.error('Logout all failed', {
      userId: req.userId,
      error: error.message
    });
    next(error);
  }
};

/**
 * Request password reset
 * POST /auth/forgot-password
 */


const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    logger.info('Password reset requested', { email });

    await authService.forgotPassword(email);

    logger.info('Password reset email sent', { email });

    res.json(
      ApiResponse.success(
        null,
        'If an account with that email exists, a password reset link has been sent'
      )
    );
  } catch (error) {
    logger.error('Forgot password failed', {
      email: req.body.email,
      error: error.message
    });
    next(error);
  }
};

/**
 * Reset password with token
 * POST /auth/reset-password
 */


const resetPassword = async (req, res, next) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      logger.warn('Reset password attempt with missing fields');
      return res.status(400).json(
        ApiResponse.error('Token and password are required')
      );
    }

    logger.info('Password reset attempt');

    await authService.resetPassword(token, password);

    logger.info('Password reset successful');

    res.json(
      ApiResponse.success(null, 'Password reset successfully')
    );
  } catch (error) {
    logger.error('Password reset failed', { error: error.message });
    next(error);
  }
};

module.exports = {
  register,
  login,
  refreshToken,
  logout,
  logoutAll,
  forgotPassword,
  resetPassword
};
