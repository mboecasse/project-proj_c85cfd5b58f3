// File: src/controllers/product.controller.js
// Generated: 2025-10-16 10:50:23 UTC
// Project ID: proj_c85cfd5b58f3
// Task ID: task_c2kdezna037x


const ApiResponse = require('../utils/response');


const Product = require('../models/Product');


const logger = require('../utils/logger');


const mongoose = require('mongoose');

/**
 * Create new product
 * POST /api/products
 */


const createProductController = async (req, res, next) => {
  try {
    const { name, price, SKU, category, description, stock, images } = req.body;

    // Validate required fields
    if (!name || !price || !SKU || !category) {
      return res.status(400).json(
        ApiResponse.error('Missing required fields: name, price, SKU, category')
      );
    }

    // Validate positive price
    if (price <= 0) {
      return res.status(400).json(
        ApiResponse.error('Price must be a positive number')
      );
    }

    // Check SKU uniqueness
    const existingProduct = await Product.findOne({ SKU });
    if (existingProduct) {
      return res.status(400).json(
        ApiResponse.error('Product with this SKU already exists')
      );
    }

    // Create product with defaults
    const product = await Product.create({
      name,
      price,
      SKU,
      category,
      description: description || '',
      stock: stock || 0,
      images: images || [],
      status: 'active',
      createdAt: new Date()
    });

    logger.info('Product created successfully', {
      productId: product._id,
      SKU: product.SKU
    });

    res.status(201).json(
      ApiResponse.success(product, 'Product created successfully')
    );
  } catch (error) {
    logger.error('Failed to create product', {
      error: error.message,
      stack: error.stack
    });
    next(error);
  }
};

/**
 * Get all products with filtering and pagination
 * GET /api/products
 */


const getAllProductsControllers = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      category,
      minPrice,
      maxPrice,
      search
    } = req.query;

    // Validate and sanitize pagination
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    // Build query
    const query = { status: { $ne: 'deleted' } };

    if (category) {
      // Sanitize category to prevent NoSQL injection
      if (typeof category === 'string') {
        query.category = category;
      }
    }

    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) {
        query.price.$gte = parseFloat(minPrice);
      }
      if (maxPrice) {
        query.price.$lte = parseFloat(maxPrice);
      }
    }

    if (search) {
      // Sanitize search input to prevent ReDoS
      if (typeof search === 'string' && search.length <= 100) {
        const sanitizedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        query.$or = [
          { name: { $regex: sanitizedSearch, $options: 'i' } },
          { description: { $regex: sanitizedSearch, $options: 'i' } }
        ];
      }
    }

    // Execute query with pagination
    const [products, total] = await Promise.all([
      Product.find(query)
        .skip(skip)
        .limit(limitNum)
        .sort({ createdAt: -1 }),
      Product.countDocuments(query)
    ]);

    const totalPages = Math.ceil(total / limitNum);

    logger.info('Fetched products', {
      count: products.length,
      total,
      page: pageNum
    });

    res.json(
      ApiResponse.success({
        products,
        pagination: {
          total,
          pages: totalPages,
          currentPage: pageNum,
          limit: limitNum
        }
      }, 'Products fetched successfully')
    );
  } catch (error) {
    logger.error('Failed to fetch products', {
      error: error.message,
      query: req.query
    });
    next(error);
  }
};

/**
 * Get product by ID
 * GET /api/products/:id
 */


const getProductControllerById = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Validate MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json(
        ApiResponse.error('Invalid product ID format')
      );
    }

    const product = await Product.findOne({
      _id: id,
      status: { $ne: 'deleted' }
    });

    if (!product) {
      return res.status(404).json(
        ApiResponse.error('Product not found')
      );
    }

    logger.info('Fetched product by ID', { productId: id });

    res.json(
      ApiResponse.success(product, 'Product fetched successfully')
    );
  } catch (error) {
    logger.error('Failed to fetch product', {
      productId: req.params.id,
      error: error.message
    });
    next(error);
  }
};

/**
 * Update product
 * PUT /api/products/:id
 */


const updateProductController = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Validate MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json(
        ApiResponse.error('Invalid product ID format')
      );
    }

    // Prevent updating protected fields
    delete updates._id;
    delete updates.createdAt;

    // Check SKU uniqueness if SKU is being updated
    if (updates.SKU) {
      const existingProduct = await Product.findOne({
        SKU: updates.SKU,
        _id: { $ne: id }
      });

      if (existingProduct) {
        return res.status(400).json(
          ApiResponse.error('Product with this SKU already exists')
        );
      }
    }

    // Validate price if provided
    if (updates.price !== undefined && updates.price <= 0) {
      return res.status(400).json(
        ApiResponse.error('Price must be a positive number')
      );
    }

    const product = await Product.findOneAndUpdate(
      { _id: id, status: { $ne: 'deleted' } },
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!product) {
      return res.status(404).json(
        ApiResponse.error('Product not found')
      );
    }

    logger.info('Product updated successfully', {
      productId: id,
      updatedFields: Object.keys(updates)
    });

    res.json(
      ApiResponse.success(product, 'Product updated successfully')
    );
  } catch (error) {
    logger.error('Failed to update product', {
      productId: req.params.id,
      error: error.message
    });
    next(error);
  }
};

/**
 * Delete product (soft delete)
 * DELETE /api/products/:id
 */


const deleteProductController = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Validate MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json(
        ApiResponse.error('Invalid product ID format')
      );
    }

    // Soft delete to preserve order history
    const product = await Product.findOneAndUpdate(
      { _id: id, status: { $ne: 'deleted' } },
      { $set: { status: 'deleted', deletedAt: new Date() } },
      { new: true }
    );

    if (!product) {
      return res.status(404).json(
        ApiResponse.error('Product not found')
      );
    }

    logger.info('Product deleted successfully', {
      productId: id,
      SKU: product.SKU
    });

    res.json(
      ApiResponse.success(null, 'Product deleted successfully')
    );
  } catch (error) {
    logger.error('Failed to delete product', {
      productId: req.params.id,
      error: error.message
    });
    next(error);
  }
};

/**
 * Search products
 * GET /api/products/search
 */


const searchProducts = async (req, res, next) => {
  try {
    const { q } = req.query;

    if (!q || q.trim().length === 0) {
      return res.status(400).json(
        ApiResponse.error('Search query is required')
      );
    }

    // Validate search term length to prevent ReDoS
    if (q.length > 100) {
      return res.status(400).json(
        ApiResponse.error('Search query is too long (max 100 characters)')
      );
    }

    const searchTerm = q.trim();

    // Escape special regex characters to prevent ReDoS
    const sanitizedSearchTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Use regex for partial matching
    const products = await Product.find({
      status: { $ne: 'deleted' },
      $or: [
        { name: { $regex: sanitizedSearchTerm, $options: 'i' } },
        { description: { $regex: sanitizedSearchTerm, $options: 'i' } },
        { SKU: { $regex: sanitizedSearchTerm, $options: 'i' } },
        { category: { $regex: sanitizedSearchTerm, $options: 'i' } }
      ]
    })
    .limit(50)
    .sort({ createdAt: -1 });

    logger.info('Product search completed', {
      searchTerm,
      resultsCount: products.length
    });

    res.json(
      ApiResponse.success(products, 'Search completed successfully')
    );
  } catch (error) {
    logger.error('Failed to search products', {
      searchTerm: req.query.q,
      error: error.message
    });
    next(error);
  }
};

module.exports = {
  'getProduct.Controllers': getAllProductsControllers,
  'getProduct.ControllerById': getProductControllerById,
  'createProduct.Controller': createProductController,
  'updateProduct.Controller': updateProductController,
  'deleteProduct.Controller': deleteProductController,
  searchProducts: searchProducts
};
