// File: src/controllers/user.controller.js
// Generated: 2025-10-16 10:49:59 UTC
// Project ID: proj_c85cfd5b58f3
// Task ID: task_l5f73v4zo7k7


const ApiResponse = require('../utils/response');


const logger = require('../utils/logger');


const userService = require('../services/user.service');

/**
 * Get all users with pagination
 * @route GET /api/users
 */


const getUsers = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, search, role, status } = req.query;

    const filters = {};
    if (search) {
      filters.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }
    if (role) filters.role = role;
    if (status) filters.status = status;

    const options = {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      sort: { createdAt: -1 }
    };

    const result = await userService.getAllUsers(filters, options);

    logger.info('Fetched users successfully', {
      page: result.pagination.page,
      total: result.pagination.total
    });

    res.status(200).json(
      ApiResponse.success(result.data, 'Users retrieved successfully', result.pagination)
    );
  } catch (error) {
    logger.error('Error fetching users', { error: error.message, stack: error.stack });
    next(error);
  }
};

/**
 * Get user by ID
 * @route GET /api/users/:id
 */


const getUserById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const user = await userService.getUserById(id);

    if (!user) {
      logger.warn('User not found', { userId: id });
      return res.status(404).json(
        ApiResponse.error('User not found', 404)
      );
    }

    logger.info('Fetched user by ID', { userId: id });

    res.status(200).json(
      ApiResponse.success(user, 'User retrieved successfully')
    );
  } catch (error) {
    logger.error('Error fetching user by ID', {
      userId: req.params.id,
      error: error.message,
      stack: error.stack
    });
    next(error);
  }
};

/**
 * Create new user
 * @route POST /api/users
 */


const createUser = async (req, res, next) => {
  try {
    const { name, email, password, role, phone, address } = req.body;

    const existingUser = await userService.getUserByEmail(email);
    if (existingUser) {
      logger.warn('Attempt to create user with existing email', { email });
      return res.status(400).json(
        ApiResponse.error('User with this email already exists', 400)
      );
    }

    const userData = {
      name,
      email,
      password,
      role: role || 'customer',
      phone,
      address
    };

    const newUser = await userService.createUser(userData);

    logger.info('User created successfully', {
      userId: newUser._id,
      email: newUser.email
    });

    res.status(201).json(
      ApiResponse.success(newUser, 'User created successfully')
    );
  } catch (error) {
    logger.error('Error creating user', {
      email: req.body.email,
      error: error.message,
      stack: error.stack
    });
    next(error);
  }
};

/**
 * Update user
 * @route PUT /api/users/:id
 */


const updateUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    delete updates.password;
    delete updates.email;

    const user = await userService.getUserById(id);
    if (!user) {
      logger.warn('User not found for update', { userId: id });
      return res.status(404).json(
        ApiResponse.error('User not found', 404)
      );
    }

    const updatedUser = await userService.updateUser(id, updates);

    logger.info('User updated successfully', {
      userId: id,
      updatedFields: Object.keys(updates)
    });

    res.status(200).json(
      ApiResponse.success(updatedUser, 'User updated successfully')
    );
  } catch (error) {
    logger.error('Error updating user', {
      userId: req.params.id,
      error: error.message,
      stack: error.stack
    });
    next(error);
  }
};

/**
 * Delete user
 * @route DELETE /api/users/:id
 */


const deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;

    const user = await userService.getUserById(id);
    if (!user) {
      logger.warn('User not found for deletion', { userId: id });
      return res.status(404).json(
        ApiResponse.error('User not found', 404)
      );
    }

    await userService.deleteUser(id);

    logger.info('User deleted successfully', { userId: id });

    res.status(200).json(
      ApiResponse.success(null, 'User deleted successfully')
    );
  } catch (error) {
    logger.error('Error deleting user', {
      userId: req.params.id,
      error: error.message,
      stack: error.stack
    });
    next(error);
  }
};

/**
 * Get user profile (authenticated user)
 * @route GET /api/users/profile
 */


const getUserProfile = async (req, res, next) => {
  try {
    const userId = req.userId;

    const user = await userService.getUserById(userId);

    if (!user) {
      logger.warn('User profile not found', { userId });
      return res.status(404).json(
        ApiResponse.error('User not found', 404)
      );
    }

    logger.info('Fetched user profile', { userId });

    res.status(200).json(
      ApiResponse.success(user, 'Profile retrieved successfully')
    );
  } catch (error) {
    logger.error('Error fetching user profile', {
      userId: req.userId,
      error: error.message,
      stack: error.stack
    });
    next(error);
  }
};

/**
 * Update user profile (authenticated user)
 * @route PUT /api/users/profile
 */


const updateUserProfile = async (req, res, next) => {
  try {
    const userId = req.userId;
    const updates = req.body;

    delete updates.password;
    delete updates.email;
    delete updates.role;

    const user = await userService.getUserById(userId);
    if (!user) {
      logger.warn('User not found for profile update', { userId });
      return res.status(404).json(
        ApiResponse.error('User not found', 404)
      );
    }

    const updatedUser = await userService.updateUser(userId, updates);

    logger.info('User profile updated successfully', {
      userId,
      updatedFields: Object.keys(updates)
    });

    res.status(200).json(
      ApiResponse.success(updatedUser, 'Profile updated successfully')
    );
  } catch (error) {
    logger.error('Error updating user profile', {
      userId: req.userId,
      error: error.message,
      stack: error.stack
    });
    next(error);
  }
};

/**
 * Change user password
 * @route PUT /api/users/change-password
 */


const changePassword = async (req, res, next) => {
  try {
    const userId = req.userId;
    const { currentPassword, newPassword } = req.body;

    const result = await userService.changePassword(userId, currentPassword, newPassword);

    if (!result.success) {
      logger.warn('Password change failed', { userId, reason: result.message });
      return res.status(400).json(
        ApiResponse.error(result.message, 400)
      );
    }

    logger.info('Password changed successfully', { userId });

    res.status(200).json(
      ApiResponse.success(null, 'Password changed successfully')
    );
  } catch (error) {
    logger.error('Error changing password', {
      userId: req.userId,
      error: error.message,
      stack: error.stack
    });
    next(error);
  }
};

/**
 * Update user status (admin only)
 * @route PATCH /api/users/:id/status
 */


const updateUserStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['active', 'inactive', 'suspended'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json(
        ApiResponse.error('Invalid status value', 400)
      );
    }

    const user = await userService.getUserById(id);
    if (!user) {
      logger.warn('User not found for status update', { userId: id });
      return res.status(404).json(
        ApiResponse.error('User not found', 404)
      );
    }

    const updatedUser = await userService.updateUser(id, { status });

    logger.info('User status updated', {
      userId: id,
      newStatus: status,
      updatedBy: req.userId
    });

    res.status(200).json(
      ApiResponse.success(updatedUser, 'User status updated successfully')
    );
  } catch (error) {
    logger.error('Error updating user status', {
      userId: req.params.id,
      error: error.message,
      stack: error.stack
    });
    next(error);
  }
};

module.exports = {
  'getUser.Controllers': getUsers,
  'getUser.ControllerById': getUserById,
  'createUser.Controller': createUser,
  'updateUser.Controller': updateUser,
  'deleteUser.Controller': deleteUser,
  getUserProfile,
  updateUserProfile,
  changePassword,
  updateUserStatus
};
