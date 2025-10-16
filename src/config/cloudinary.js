// File: src/config/cloudinary.js
// Generated: 2025-10-16 10:39:44 UTC
// Project ID: proj_c85cfd5b58f3
// Task ID: task_p5ifpdyl7ace


const cloudinary = require('cloudinary').v2;


const logger = require('../utils/logger');

* Provides upload presets, helper functions, and validation constants for image handling.
 *
 * @module config/cloudinary
 */

/**
 * Validate Cloudinary credentials
 * Throws error if required environment variables are missing
 */


const validateCredentials = () => {
  const requiredVars = [
    'CLOUDINARY_CLOUD_NAME',
    'CLOUDINARY_API_KEY',
    'CLOUDINARY_API_SECRET'
  ];

  const missingVars = requiredVars.filter(varName => !process.env[varName]);

  if (missingVars.length > 0) {
    const error = `Missing Cloudinary credentials: ${missingVars.join(', ')}`;
    logger.error('Cloudinary configuration failed', { missingVars });
    throw new Error(error);
  }
};

// Validate credentials before configuration
try {
  validateCredentials();
} catch (error) {
  logger.error('Cloudinary initialization failed', { error: error.message });
  throw error;
}

/**
 * Configure Cloudinary with environment credentials
 */
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

logger.info('Cloudinary configured successfully');

/**
 * Upload preset configurations for different resource types
 * Each preset defines folder structure, transformations, and allowed formats
 */


const uploadPresets = {
  /**
   * Product image upload preset
   * Full-size product images with optimization
   */
  product: {
    folder: 'ecommerce/products',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [
      { width: 1000, height: 1000, crop: 'limit' },
      { quality: 'auto:good', fetch_format: 'auto' }
    ],
    resource_type: 'image',
    use_filename: true,
    unique_filename: true,
    overwrite: false
  },

  /**
   * Product thumbnail preset
   * Small, optimized thumbnails for product listings
   */
  productThumbnail: {
    folder: 'ecommerce/products/thumbnails',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [
      { width: 300, height: 300, crop: 'fill', gravity: 'auto' },
      { quality: 'auto:low', fetch_format: 'auto' }
    ],
    resource_type: 'image',
    use_filename: true,
    unique_filename: true
  },

  /**
   * Product medium size preset
   * Medium-sized images for product detail views
   */
  productMedium: {
    folder: 'ecommerce/products/medium',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [
      { width: 600, height: 600, crop: 'limit' },
      { quality: 'auto:good', fetch_format: 'auto' }
    ],
    resource_type: 'image',
    use_filename: true,
    unique_filename: true
  },

  /**
   * Category image upload preset
   */
  category: {
    folder: 'ecommerce/categories',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [
      { width: 500, height: 500, crop: 'fill', gravity: 'center' },
      { quality: 'auto:good', fetch_format: 'auto' }
    ],
    resource_type: 'image',
    use_filename: true,
    unique_filename: true
  },

  /**
   * User avatar upload preset
   */
  avatar: {
    folder: 'ecommerce/users/avatars',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [
      { width: 200, height: 200, crop: 'fill', gravity: 'face' },
      { quality: 'auto:good', fetch_format: 'auto' }
    ],
    resource_type: 'image',
    use_filename: false,
    unique_filename: true
  },

  /**
   * Temporary upload preset
   * For temporary uploads that will be moved or deleted
   */
  temp: {
    folder: 'ecommerce/temp',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    resource_type: 'image',
    use_filename: true,
    unique_filename: true
  }
};

/**
 * Helper functions for Cloudinary operations
 */


const cloudinaryHelpers = {
  /**
   * Generate optimized URL from public_id
   * @param {string} publicId - Cloudinary public ID
   * @param {Object} options - Additional transformation options
   * @returns {string} Optimized image URL
   */
  getOptimizedUrl: (publicId, options = {}) => {
    try {
      return cloudinary.url(publicId, {
        secure: true,
        quality: 'auto:good',
        fetch_format: 'auto',
        ...options
      });
    } catch (error) {
      logger.error('Failed to generate optimized URL', {
        publicId,
        error: error.message
      });
      throw error;
    }
  },

  /**
   * Generate thumbnail URL from public_id
   * @param {string} publicId - Cloudinary public ID
   * @returns {string} Thumbnail URL
   */
  getThumbnailUrl: (publicId) => {
    try {
      return cloudinary.url(publicId, {
        secure: true,
        transformation: [
          { width: 300, height: 300, crop: 'fill', gravity: 'auto' },
          { quality: 'auto:low', fetch_format: 'auto' }
        ]
      });
    } catch (error) {
      logger.error('Failed to generate thumbnail URL', {
        publicId,
        error: error.message
      });
      throw error;
    }
  },

  /**
   * Generate responsive breakpoint URLs
   * @param {string} publicId - Cloudinary public ID
   * @param {Array<number>} breakpoints - Array of width breakpoints
   * @returns {Object} Object with breakpoint URLs
   */
  getResponsiveUrls: (publicId, breakpoints = [300, 600, 1000]) => {
    try {
      const urls = {};
      breakpoints.forEach(width => {
        urls[`w${width}`] = cloudinary.url(publicId, {
          secure: true,
          transformation: [
            { width, crop: 'limit' },
            { quality: 'auto:good', fetch_format: 'auto' }
          ]
        });
      });
      return urls;
    } catch (error) {
      logger.error('Failed to generate responsive URLs', {
        publicId,
        error: error.message
      });
      throw error;
    }
  },

  /**
   * Extract public_id from Cloudinary URL
   * @param {string} url - Cloudinary URL
   * @returns {string|null} Public ID or null if invalid
   */
  extractPublicId: (url) => {
    try {
      if (!url || typeof url !== 'string') {
        return null;
      }

      // Match Cloudinary URL pattern
      const match = url.match(/\/v\d+\/(.+?)(?:\.[a-z]+)?$/i);
      if (match && match[1]) {
        return match[1];
      }

      // Try alternative pattern (without version)
      const altMatch = url.match(/\/upload\/(.+?)(?:\.[a-z]+)?$/i);
      if (altMatch && altMatch[1]) {
        return altMatch[1];
      }

      return null;
    } catch (error) {
      logger.error('Failed to extract public ID', { url, error: error.message });
      return null;
    }
  },

  /**
   * Delete image by public_id
   * @param {string} publicId - Cloudinary public ID
   * @returns {Promise<Object>} Deletion result
   */
  deleteImage: async (publicId) => {
    try {
      if (!publicId) {
        throw new Error('Public ID is required for deletion');
      }

      const result = await cloudinary.uploader.destroy(publicId);

      logger.info('Image deleted from Cloudinary', {
        publicId,
        result: result.result
      });

      return result;
    } catch (error) {
      logger.error('Failed to delete image from Cloudinary', {
        publicId,
        error: error.message
      });
      throw error;
    }
  },

  /**
   * Delete multiple images by public_ids
   * @param {Array<string>} publicIds - Array of Cloudinary public IDs
   * @returns {Promise<Object>} Deletion results
   */
  deleteImages: async (publicIds) => {
    try {
      if (!Array.isArray(publicIds) || publicIds.length === 0) {
        throw new Error('Valid array of public IDs is required');
      }

      const result = await cloudinary.api.delete_resources(publicIds);

      logger.info('Multiple images deleted from Cloudinary', {
        count: publicIds.length,
        deleted: Object.keys(result.deleted).length
      });

      return result;
    } catch (error) {
      logger.error('Failed to delete multiple images', {
        count: publicIds.length,
        error: error.message
      });
      throw error;
    }
  },

  /**
   * Upload image from buffer or file path
   * @param {string|Buffer} source - File path or buffer
   * @param {Object} options - Upload options
   * @returns {Promise<Object>} Upload result
   */
  uploadImage: async (source, options = {}) => {
    try {
      const result = await cloudinary.uploader.upload(source, {
        ...uploadPresets.product,
        ...options
      });

      logger.info('Image uploaded to Cloudinary', {
        publicId: result.public_id,
        format: result.format,
        bytes: result.bytes
      });

      return result;
    } catch (error) {
      logger.error('Failed to upload image to Cloudinary', {
        error: error.message
      });
      throw error;
    }
  },

  /**
   * Get image metadata
   * @param {string} publicId - Cloudinary public ID
   * @returns {Promise<Object>} Image metadata
   */
  getImageMetadata: async (publicId) => {
    try {
      const result = await cloudinary.api.resource(publicId);

      logger.info('Retrieved image metadata', { publicId });

      return result;
    } catch (error) {
      logger.error('Failed to get image metadata', {
        publicId,
        error: error.message
      });
      throw error;
    }
  }
};

/**
 * Configuration constants for validation and limits
 */


const cloudinaryConfig = {
  // File size limits
  MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
  MAX_FILE_SIZE_MB: 5,

  // Format restrictions
  ALLOWED_FORMATS: ['jpg', 'jpeg', 'png', 'webp'],
  ALLOWED_MIME_TYPES: ['image/jpeg', 'image/png', 'image/webp'],

  // Upload limits
  MAX_IMAGES_PER_PRODUCT: 5,
  MAX_IMAGES_PER_CATEGORY: 1,
  MAX_BATCH_UPLOAD: 10,

  // Quality settings
  DEFAULT_QUALITY: 'auto:good',
  THUMBNAIL_QUALITY: 'auto:low',
  DEFAULT_FETCH_FORMAT: 'auto',

  // Transformation defaults
  DEFAULT_PRODUCT_WIDTH: 1000,
  DEFAULT_PRODUCT_HEIGHT: 1000,
  DEFAULT_THUMBNAIL_SIZE: 300,
  DEFAULT_MEDIUM_SIZE: 600,

  // Folder structure
  FOLDERS: {
    PRODUCTS: 'ecommerce/products',
    PRODUCTS_THUMBNAILS: 'ecommerce/products/thumbnails',
    PRODUCTS_MEDIUM: 'ecommerce/products/medium',
    CATEGORIES: 'ecommerce/categories',
    AVATARS: 'ecommerce/users/avatars',
    TEMP: 'ecommerce/temp'
  },

  // Error messages
  ERRORS: {
    INVALID_FORMAT: 'Invalid image format. Allowed formats: jpg, jpeg, png, webp',
    FILE_TOO_LARGE: 'File size exceeds maximum limit of 5MB',
    UPLOAD_FAILED: 'Failed to upload image to Cloudinary',
    DELETE_FAILED: 'Failed to delete image from Cloudinary',
    INVALID_PUBLIC_ID: 'Invalid or missing public ID'
  }
};

/**
 * Validation helper functions
 */


const validators = {
  /**
   * Validate file format
   * @param {string} mimetype - File MIME type
   * @returns {boolean} True if valid
   */
  isValidFormat: (mimetype) => {
    return cloudinaryConfig.ALLOWED_MIME_TYPES.includes(mimetype);
  },

  /**
   * Validate file size
   * @param {number} size - File size in bytes
   * @returns {boolean} True if valid
   */
  isValidSize: (size) => {
    return size <= cloudinaryConfig.MAX_FILE_SIZE;
  },

  /**
   * Validate public ID format
   * @param {string} publicId - Cloudinary public ID
   * @returns {boolean} True if valid
   */
  isValidPublicId: (publicId) => {
    return typeof publicId === 'string' && publicId.length > 0;
  }
};

module.exports = {
  cloudinary,
  uploadPresets,
  cloudinaryHelpers,
  cloudinaryConfig,
  validators
};
