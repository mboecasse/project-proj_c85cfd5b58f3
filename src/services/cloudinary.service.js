// File: src/services/cloudinary.service.js
// Generated: 2025-10-16 10:51:17 UTC
// Project ID: proj_c85cfd5b58f3
// Task ID: task_52begb9gtvhg


const fs = require('fs').promises;


const logger = require('../utils/logger');


const path = require('path');

const { cloudinary, uploadPresets, cloudinaryHelpers, cloudinaryConfig, validators } = require('../config/cloudinary');

/**
 * Cloudinary Service
 * Handles all image upload, management, and transformation operations
 */
class CloudinaryService {
  /**
   * Sanitize folder path to prevent directory traversal
   * @param {String} folder - Folder path to sanitize
   * @returns {String} Sanitized folder path
   */
  sanitizeFolderPath(folder) {
    if (!folder || typeof folder !== 'string') {
      return 'general';
    }

    // Remove any path traversal attempts
    const sanitized = folder
      .replace(/\.\./g, '')
      .replace(/^\/+/, '')
      .replace(/\/+$/, '')
      .replace(/\/+/g, '/')
      .replace(/[^a-zA-Z0-9/_-]/g, '_');

    return sanitized || 'general';
  }

  /**
   * Validate and sanitize file path
   * @param {String} filePath - File path to validate
   * @returns {String} Validated file path
   */
  validateFilePath(filePath) {
    if (!filePath || typeof filePath !== 'string') {
      throw new Error('Invalid file path');
    }

    // Resolve to absolute path and check if it's within allowed directory
    const resolvedPath = path.resolve(filePath);
    const normalizedPath = path.normalize(resolvedPath);

    // Check for path traversal attempts
    if (normalizedPath.includes('..')) {
      throw new Error('Path traversal detected');
    }

    // Verify file path exists and is a file
    return normalizedPath;
  }

  /**
   * Upload single image to Cloudinary
   * @param {Object} file - File object from multer
   * @param {Object} options - Upload options
   * @returns {Promise<Object>} Upload result
   */
  async uploadImage(file, options = {}) {
    try {
      const {
        folder = 'general',
        preset = 'default',
        transformation = null,
        tags = [],
        context = {}
      } = options;

      // Validate file
      if (!file) {
        throw new Error('No file provided for upload');
      }

      // Validate file size
      if (file.size > cloudinaryConfig.maxFileSize) {
        throw new Error(`File size exceeds maximum allowed size of ${cloudinaryConfig.maxFileSize / (1024 * 1024)}MB`);
      }

      // Validate file type
      if (!validators.isValidImageType(file.mimetype)) {
        throw new Error('Invalid file type. Only images are allowed');
      }

      // Get upload preset configuration
      const presetConfig = uploadPresets[preset] || uploadPresets.default;

      // Sanitize folder path
      const sanitizedFolder = this.sanitizeFolderPath(folder);

      // Prepare upload options
      const uploadOptions = {
        folder: `${cloudinaryConfig.folders.base}/${sanitizedFolder}`,
        resource_type: 'image',
        allowed_formats: cloudinaryConfig.allowedFormats,
        tags: [...tags, preset],
        context: {
          ...context,
          uploaded_at: new Date().toISOString()
        },
        ...presetConfig
      };

      // Add transformation if provided
      if (transformation) {
        uploadOptions.transformation = transformation;
      }

      // Upload to Cloudinary
      let result;
      if (file.path) {
        // Validate file path
        const validatedPath = this.validateFilePath(file.path);

        // File from disk
        result = await cloudinary.uploader.upload(validatedPath, uploadOptions);

        // Clean up local file
        try {
          await fs.unlink(validatedPath);
        } catch (unlinkError) {
          logger.warn('Failed to delete local file after upload', {
            path: validatedPath,
            error: unlinkError.message
          });
        }
      } else if (file.buffer) {
        // File from memory
        result = await new Promise((resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            uploadOptions,
            (error, result) => {
              if (error) reject(error);
              else resolve(result);
            }
          );
          uploadStream.end(file.buffer);
        });
      } else {
        throw new Error('Invalid file object: no path or buffer found');
      }

      logger.info('Image uploaded successfully', {
        publicId: result.public_id,
        folder: sanitizedFolder,
        preset,
        size: result.bytes
      });

      return {
        success: true,
        data: {
          publicId: result.public_id,
          url: result.secure_url,
          width: result.width,
          height: result.height,
          format: result.format,
          size: result.bytes,
          createdAt: result.created_at,
          resourceType: result.resource_type,
          folder: result.folder,
          tags: result.tags
        }
      };
    } catch (error) {
      logger.error('Failed to upload image', {
        error: error.message,
        fileName: file?.originalname,
        folder: options.folder
      });
      throw error;
    }
  }

  /**
   * Upload multiple images to Cloudinary
   * @param {Array} files - Array of file objects
   * @param {Object} options - Upload options
   * @returns {Promise<Object>} Upload results
   */
  async uploadMultipleImages(files, options = {}) {
    try {
      if (!files || files.length === 0) {
        throw new Error('No files provided for upload');
      }

      const uploadPromises = files.map(file =>
        this.uploadImage(file, options).catch(error => ({
          success: false,
          error: error.message,
          fileName: file.originalname
        }))
      );

      const results = await Promise.all(uploadPromises);

      const successful = results.filter(r => r.success);
      const failed = results.filter(r => !r.success);

      logger.info('Multiple images upload completed', {
        total: files.length,
        successful: successful.length,
        failed: failed.length
      });

      return {
        success: true,
        data: {
          successful: successful.map(r => r.data),
          failed,
          summary: {
            total: files.length,
            uploaded: successful.length,
            failed: failed.length
          }
        }
      };
    } catch (error) {
      logger.error('Failed to upload multiple images', {
        error: error.message,
        fileCount: files?.length
      });
      throw error;
    }
  }

  /**
   * Delete image from Cloudinary
   * @param {String} publicId - Public ID of the image
   * @returns {Promise<Object>} Deletion result
   */
  async deleteImage(publicId) {
    try {
      if (!publicId) {
        throw new Error('Public ID is required for deletion');
      }

      const result = await cloudinary.uploader.destroy(publicId);

      if (result.result !== 'ok') {
        throw new Error(`Failed to delete image: ${result.result}`);
      }

      logger.info('Image deleted successfully', { publicId });

      return {
        success: true,
        message: 'Image deleted successfully',
        data: { publicId, result: result.result }
      };
    } catch (error) {
      logger.error('Failed to delete image', {
        error: error.message,
        publicId
      });
      throw error;
    }
  }

  /**
   * Delete multiple images from Cloudinary
   * @param {Array} publicIds - Array of public IDs
   * @returns {Promise<Object>} Deletion results
   */
  async deleteMultipleImages(publicIds) {
    try {
      if (!publicIds || publicIds.length === 0) {
        throw new Error('No public IDs provided for deletion');
      }

      const result = await cloudinary.api.delete_resources(publicIds);

      const deleted = Object.entries(result.deleted).filter(([_, status]) => status === 'deleted');
      const failed = Object.entries(result.deleted).filter(([_, status]) => status !== 'deleted');

      logger.info('Multiple images deletion completed', {
        total: publicIds.length,
        deleted: deleted.length,
        failed: failed.length
      });

      return {
        success: true,
        data: {
          deleted: deleted.map(([id]) => id),
          failed: failed.map(([id, status]) => ({ publicId: id, status })),
          summary: {
            total: publicIds.length,
            deleted: deleted.length,
            failed: failed.length
          }
        }
      };
    } catch (error) {
      logger.error('Failed to delete multiple images', {
        error: error.message,
        count: publicIds?.length
      });
      throw error;
    }
  }

  /**
   * Get image details from Cloudinary
   * @param {String} publicId - Public ID of the image
   * @returns {Promise<Object>} Image details
   */
  async getImageDetails(publicId) {
    try {
      if (!publicId) {
        throw new Error('Public ID is required');
      }

      const result = await cloudinary.api.resource(publicId);

      logger.info('Retrieved image details', { publicId });

      return {
        success: true,
        data: {
          publicId: result.public_id,
          url: result.secure_url,
          width: result.width,
          height: result.height,
          format: result.format,
          size: result.bytes,
          createdAt: result.created_at,
          resourceType: result.resource_type,
          folder: result.folder,
          tags: result.tags,
          context: result.context
        }
      };
    } catch (error) {
      logger.error('Failed to get image details', {
        error: error.message,
        publicId
      });
      throw error;
    }
  }

  /**
   * Get transformed image URL
   * @param {String} publicId - Public ID of the image
   * @param {Object} transformation - Transformation options
   * @returns {String} Transformed image URL
   */
  getTransformedUrl(publicId, transformation = {}) {
    try {
      if (!publicId) {
        throw new Error('Public ID is required');
      }

      const url = cloudinary.url(publicId, {
        secure: true,
        transformation
      });

      logger.debug('Generated transformed URL', { publicId, transformation });

      return url;
    } catch (error) {
      logger.error('Failed to generate transformed URL', {
        error: error.message,
        publicId
      });
      throw error;
    }
  }

  /**
   * Get optimized image URL
   * @param {String} publicId - Public ID of the image
   * @param {Object} options - Optimization options
   * @returns {String} Optimized image URL
   */
  getOptimizedUrl(publicId, options = {}) {
    try {
      const {
        width,
        height,
        quality = 'auto',
        format = 'auto',
        crop = 'fill'
      } = options;

      const transformation = {
        quality,
        fetch_format: format,
        crop
      };

      if (width) transformation.width = width;
      if (height) transformation.height = height;

      return this.getTransformedUrl(publicId, transformation);
    } catch (error) {
      logger.error('Failed to generate optimized URL', {
        error: error.message,
        publicId
      });
      throw error;
    }
  }

  /**
   * Get thumbnail URL
   * @param {String} publicId - Public ID of the image
   * @param {Number} size - Thumbnail size (default: 200)
   * @returns {String} Thumbnail URL
   */
  getThumbnailUrl(publicId, size = 200) {
    try {
      return this.getTransformedUrl(publicId, {
        width: size,
        height: size,
        crop: 'thumb',
        gravity: 'face'
      });
    } catch (error) {
      logger.error('Failed to generate thumbnail URL', {
        error: error.message,
        publicId
      });
      throw error;
    }
  }

  /**
   * Search images by tag
   * @param {String} tag - Tag to search for
   * @param {Object} options - Search options
   * @returns {Promise<Object>} Search results
   */
  async searchByTag(tag, options = {}) {
    try {
      const {
        maxResults = 100,
        nextCursor = null
      } = options;

      const searchOptions = {
        expression: `tags:${tag}`,
        max_results: maxResults
      };

      if (nextCursor) {
        searchOptions.next_cursor = nextCursor;
      }

      const result = await cloudinary.search.execute();

      logger.info('Search by tag completed', {
        tag,
        resultsCount: result.resources.length
      });

      return {
        success: true,
        data: {
          resources: result.resources.map(r => ({
            publicId: r.public_id,
            url: r.secure_url,
            width: r.width,
            height: r.height,
            format: r.format,
            createdAt: r.created_at
          })),
          totalCount: result.total_count,
          nextCursor: result.next_cursor
        }
      };
    } catch (error) {
      logger.error('Failed to search by tag', {
        error: error.message,
        tag
      });
      throw error;
    }
  }

  /**
   * List images in folder
   * @param {String} folder - Folder path
   * @param {Object} options - List options
   * @returns {Promise<Object>} List results
   */
  async listImagesInFolder(folder, options = {}) {
    try {
      const {
        maxResults = 100,
        nextCursor = null
      } = options;

      const sanitizedFolder = this.sanitizeFolderPath(folder);

      const listOptions = {
        type: 'upload',
        prefix: sanitizedFolder,
        max_results: maxResults
      };

      if (nextCursor) {
        listOptions.next_cursor = nextCursor;
      }

      const result = await cloudinary.api.resources(listOptions);

      logger.info('Listed images in folder', {
        folder: sanitizedFolder,
        count: result.resources.length
      });

      return {
        success: true,
        data: {
          resources: result.resources.map(r => ({
            publicId: r.public_id,
            url: r.secure_url,
            width: r.width,
            height: r.height,
            format: r.format,
            size: r.bytes,
            createdAt: r.created_at
          })),
          nextCursor: result.next_cursor
        }
      };
    } catch (error) {
      logger.error('Failed to list images in folder', {
        error: error.message,
        folder
      });
      throw error;
    }
  }

  /**
   * Update image tags
   * @param {String} publicId - Public ID of the image
   * @param {Array} tags - New tags
   * @returns {Promise<Object>} Update result
   */
  async updateTags(publicId, tags) {
    try {
      if (!publicId) {
        throw new Error('Public ID is required');
      }

      if (!Array.isArray(tags)) {
        throw new Error('Tags must be an array');
      }

      const result = await cloudinary.uploader.add_tag(tags.join(','), [publicId]);

      logger.info('Updated image tags', { publicId, tags });

      return {
        success: true,
        message
