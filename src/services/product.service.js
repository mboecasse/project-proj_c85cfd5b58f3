// File: src/services/product.service.js
// Generated: 2025-10-16 10:50:08 UTC
// Project ID: proj_c85cfd5b58f3
// Task ID: task_ugpc544twmgi


const CloudinaryService = require('./cloudinary.service');


const Product = require('../models/Product');


const logger = require('../utils/logger');

/**
 * ProductService - Handles all product-related business logic
 * Manages CRUD operations, stock management, search, and image handling
 */
class ProductService {
  constructor() {
    this.cloudinaryService = new CloudinaryService();
  }

  /**
   * Sanitize string for RegExp to prevent injection
   * @param {String} str - String to sanitize
   * @returns {String} Sanitized string
   */
  sanitizeRegexString(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Validate and parse numeric value
   * @param {*} value - Value to validate
   * @param {String} fieldName - Field name for error message
   * @returns {Number} Parsed number
   */
  validateNumericInput(value, fieldName) {
    if (value === undefined || value === null) {
      return undefined;
    }

    const parsed = parseFloat(value);

    if (isNaN(parsed) || !isFinite(parsed)) {
      throw new Error(`Invalid ${fieldName}: must be a valid number`);
    }

    if (parsed < 0) {
      throw new Error(`Invalid ${fieldName}: must be non-negative`);
    }

    return parsed;
  }

  /**
   * Validate product data
   * @param {Object} data - Product data to validate
   * @throws {Error} If validation fails
   */
  validateProductData(data) {
    const errors = [];

    if (!data.name || data.name.trim().length === 0) {
      errors.push('Product name is required');
    }

    if (!data.description || data.description.trim().length === 0) {
      errors.push('Product description is required');
    }

    if (data.price === undefined || data.price === null) {
      errors.push('Product price is required');
    }

    if (data.price !== undefined && data.price <= 0) {
      errors.push('Product price must be greater than 0');
    }

    if (data.inventory && data.inventory.quantity !== undefined && data.inventory.quantity < 0) {
      errors.push('Stock quantity cannot be negative');
    }

    if (!data.category) {
      errors.push('Product category is required');
    }

    if (errors.length > 0) {
      throw new Error(errors.join(', '));
    }
  }

  /**
   * Generate SKU for product
   * @param {String} category - Product category
   * @returns {String} Generated SKU
   */
  generateSKU(category) {
    const categoryPrefix = category.substring(0, 3).toUpperCase();
    const timestamp = Date.now().toString().slice(-8);
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${categoryPrefix}-${timestamp}-${random}`;
  }

  /**
   * Create new product
   * @param {Object} productData - Product information
   * @param {Array} imageFiles - Array of image file buffers
   * @returns {Promise<Object>} Created product
   */
  async createProduct(productData, imageFiles = []) {
    try {
      // Validate product data
      this.validateProductData(productData);

      // Generate SKU if not provided
      if (!productData.sku) {
        productData.sku = this.generateSKU(productData.category);
      }

      // Upload images to Cloudinary
      let uploadedImages = [];
      if (imageFiles && imageFiles.length > 0) {
        uploadedImages = await this.cloudinaryService.uploadMultipleImages(
          imageFiles,
          { folder: 'products' }
        );
      }

      // Prepare product data with images
      const productToCreate = {
        ...productData,
        images: uploadedImages.map(img => ({
          url: img.url,
          publicId: img.publicId,
          alt: productData.name
        })),
        isActive: productData.isActive !== undefined ? productData.isActive : true,
        createdAt: new Date()
      };

      // Create product
      const product = await Product.create(productToCreate);

      logger.info('Product created successfully', {
        productId: product._id,
        sku: product.sku,
        name: product.name
      });

      return product;
    } catch (error) {
      logger.error('Failed to create product', {
        error: error.message,
        productData: { name: productData.name, sku: productData.sku }
      });
      throw error;
    }
  }

  /**
   * Get product by ID
   * @param {String} productId - Product ID
   * @returns {Promise<Object>} Product document
   */
  async getProductById(productId) {
    try {
      const product = await Product.findById(productId)
        .populate('category', 'name slug')
        .populate({
          path: 'reviews',
          select: 'rating comment user createdAt',
          populate: { path: 'user', select: 'name' }
        });

      if (!product) {
        throw new Error('Product not found');
      }

      if (!product.isActive) {
        throw new Error('Product is not available');
      }

      logger.info('Product fetched by ID', { productId });

      return product;
    } catch (error) {
      logger.error('Failed to fetch product by ID', {
        productId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get products with filtering, sorting, and pagination
   * @param {Object} filters - Filter criteria
   * @param {Object} options - Pagination and sorting options
   * @returns {Promise<Object>} Products and pagination info
   */
  async getProducts(filters = {}, options = {}) {
    try {
      const {
        page = 1,
        limit = 10,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = options;

      // Build query
      const query = { isActive: true };

      // Category filter
      if (filters.category) {
        query.category = filters.category;
      }

      // Price range filter with validation
      if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
        query.price = {};
        if (filters.minPrice !== undefined) {
          const minPrice = this.validateNumericInput(filters.minPrice, 'minPrice');
          if (minPrice !== undefined) {
            query.price.$gte = minPrice;
          }
        }
        if (filters.maxPrice !== undefined) {
          const maxPrice = this.validateNumericInput(filters.maxPrice, 'maxPrice');
          if (maxPrice !== undefined) {
            query.price.$lte = maxPrice;
          }
        }
      }

      // In stock filter
      if (filters.inStock === true || filters.inStock === 'true') {
        query['inventory.quantity'] = { $gt: 0 };
      }

      // Search filter with sanitization
      if (filters.search) {
        const sanitizedSearch = this.sanitizeRegexString(filters.search);
        const searchRegex = new RegExp(sanitizedSearch, 'i');
        query.$or = [
          { name: searchRegex },
          { description: searchRegex },
          { tags: searchRegex }
        ];
      }

      // Calculate pagination
      const skip = (page - 1) * limit;
      const sortOptions = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

      // Execute query
      const [products, total] = await Promise.all([
        Product.find(query)
          .populate('category', 'name slug')
          .sort(sortOptions)
          .skip(skip)
          .limit(parseInt(limit))
          .lean(),
        Product.countDocuments(query)
      ]);

      const totalPages = Math.ceil(total / limit);

      logger.info('Products fetched with filters', {
        filters,
        page,
        limit,
        total
      });

      return {
        products,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: totalPages
        }
      };
    } catch (error) {
      logger.error('Failed to fetch products', {
        filters,
        options,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Update product
   * @param {String} productId - Product ID
   * @param {Object} updateData - Data to update
   * @param {Array} newImageFiles - New image files (optional)
   * @returns {Promise<Object>} Updated product
   */
  async updateProduct(productId, updateData, newImageFiles = []) {
    try {
      // Validate update data if price or stock is being updated
      if (updateData.price !== undefined && updateData.price <= 0) {
        throw new Error('Product price must be greater than 0');
      }

      if (updateData.inventory && updateData.inventory.quantity !== undefined && updateData.inventory.quantity < 0) {
        throw new Error('Stock quantity cannot be negative');
      }

      // Get existing product
      const existingProduct = await Product.findById(productId);
      if (!existingProduct) {
        throw new Error('Product not found');
      }

      // Handle image replacement
      if (newImageFiles && newImageFiles.length > 0) {
        // Delete old images from Cloudinary
        if (existingProduct.images && existingProduct.images.length > 0) {
          const publicIds = existingProduct.images.map(img => img.publicId).filter(Boolean);
          if (publicIds.length > 0) {
            await this.cloudinaryService.deleteMultipleImages(publicIds);
          }
        }

        // Upload new images
        const uploadedImages = await this.cloudinaryService.uploadMultipleImages(
          newImageFiles,
          { folder: 'products' }
        );

        updateData.images = uploadedImages.map(img => ({
          url: img.url,
          publicId: img.publicId,
          alt: updateData.name || existingProduct.name
        }));
      }

      // Update timestamp
      updateData.updatedAt = new Date();

      // Update product
      const product = await Product.findByIdAndUpdate(
        productId,
        { $set: updateData },
        { new: true, runValidators: true }
      ).populate('category', 'name slug');

      logger.info('Product updated successfully', {
        productId,
        updatedFields: Object.keys(updateData)
      });

      return product;
    } catch (error) {
      logger.error('Failed to update product', {
        productId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Delete product
   * @param {String} productId - Product ID
   * @param {Boolean} hardDelete - If true, permanently delete; otherwise soft delete
   * @returns {Promise<Object>} Deletion result
   */
  async deleteProduct(productId, hardDelete = false) {
    try {
      const product = await Product.findById(productId);

      if (!product) {
        throw new Error('Product not found');
      }

      if (hardDelete) {
        // Delete images from Cloudinary
        if (product.images && product.images.length > 0) {
          const publicIds = product.images.map(img => img.publicId).filter(Boolean);
          if (publicIds.length > 0) {
            await this.cloudinaryService.deleteMultipleImages(publicIds);
          }
        }

        // Permanently delete from database
        await Product.findByIdAndDelete(productId);

        logger.info('Product permanently deleted', { productId });

        return {
          success: true,
          message: 'Product permanently deleted',
          deletedProduct: product
        };
      } else {
        // Soft delete - set isActive to false
        product.isActive = false;
        product.updatedAt = new Date();
        await product.save();

        logger.info('Product soft deleted', { productId });

        return {
          success: true,
          message: 'Product deactivated',
          product
        };
      }
    } catch (error) {
      logger.error('Failed to delete product', {
        productId,
        hardDelete,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Decrease product stock
   * @param {String} productId - Product ID
   * @param {Number} quantity - Quantity to decrease
   * @returns {Promise<Object>} Updated product
   */
  async decreaseStock(productId, quantity) {
    try {
      if (quantity <= 0) {
        throw new Error('Quantity must be greater than 0');
      }

      // Get product to check stock
      const product = await Product.findById(productId);
      if (!product) {
        throw new Error('Product not found');
      }

      if (!product.isInStock()) {
        throw new Error('Product is out of stock');
      }

      if (!product.canPurchase(quantity)) {
        throw new Error(`Insufficient stock. Available: ${product.inventory.quantity}, Requested: ${quantity}`);
      }

      // Use atomic operation to prevent overselling
      const updatedProduct = await Product.findOneAndUpdate(
        {
          _id: productId,
          'inventory.quantity': { $gte: quantity }
        },
        {
          $inc: { 'inventory.quantity': -quantity },
          $set: { updatedAt: new Date() }
        },
        { new: true }
      );

      if (!updatedProduct) {
        throw new Error('Failed to decrease stock - insufficient quantity');
      }

      logger.info('Product stock decreased', {
        productId,
        quantity,
        newStock: updatedProduct.inventory.quantity
      });

      return updatedProduct;
    } catch (error) {
      logger.error('Failed to decrease stock', {
        productId,
        quantity,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Increase product stock
   * @param {String} productId - Product ID
   * @param {Number} quantity - Quantity to increase
   * @returns {Promise<Object>} Updated product
   */
  async increaseStock(productId, quantity) {
    try {
      if (quantity <= 0) {
        throw new Error('Quantity must be greater than 0');
      }

      // Use atomic operation
      const updatedProduct = await Product.findByIdAndUpdate(
        productId,
        {
          $inc: { 'inventory.quantity': quantity },
          $set: { updatedAt: new Date() }
        },
        { new: true }
      );

      if (!updatedProduct) {
        throw new Error('Product not found');
      }

      logger.info('Product stock increased', {
        productId,
        quantity,
        newStock: updatedProduct.inventory.quantity
      });

      return updatedProduct;
    } catch (error) {
      logger.error('Failed to increase stock', {
        productId,
        quantity,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Search products
   * @param {String} searchTerm - Search term
   * @param {Object} filters - Additional filters
   * @returns {Promise<Array>} Matching products
   */
  async searchProducts(searchTerm, filters = {}) {
    try {
      if (!searchTerm || searchTerm.trim().length === 0) {
        throw new Error('Search term is required');
      }

      const sanitizedSearchTerm = this.sanitizeRegexString(searchTerm.trim());
      const searchRegex = new RegExp(sanitizedSearchTerm, 'i');

      // Build query
      const query = {
        isActive: true,
        $or: [
          { name: searchRegex },
          { description:
