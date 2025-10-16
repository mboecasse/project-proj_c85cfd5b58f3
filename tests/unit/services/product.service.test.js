// File: tests/unit/services/product.service.test.js
// Generated: 2025-10-16 10:54:14 UTC
// Project ID: proj_c85cfd5b58f3
// Task ID: task_wkbwzh749uyi


const Product = require('../../../src/models/Product');


const ProductService = require('../../../src/services/product.service');


const cloudinaryService = require('../../../src/services/cloudinary.service');


const logger = require('../../../src/utils/logger');

// Mock dependencies
jest.mock('../../../src/models/Product');
jest.mock('../../../src/services/cloudinary.service');
jest.mock('../../../src/utils/logger');

describe('ProductService', () => {
  let productService;

  beforeEach(() => {
    productService = new ProductService();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('createProduct', () => {
    const validProductData = {
      name: 'Test Product',
      description: 'Test Description',
      price: 99.99,
      category: 'Electronics',
      stock: 10,
      brand: 'TestBrand'
    };

    const mockImageFiles = [
      { path: '/tmp/image1.jpg', mimetype: 'image/jpeg' },
      { path: '/tmp/image2.jpg', mimetype: 'image/jpeg' }
    ];

    it('should create a product successfully without images', async () => {
      const mockProduct = {
        _id: 'product123',
        ...validProductData,
        sku: 'TEST-PROD-123',
        images: [],
        save: jest.fn().mockResolvedValue(true)
      };

      Product.mockImplementation(() => mockProduct);

      const result = await productService.createProduct(validProductData);

      expect(result).toEqual(mockProduct);
      expect(mockProduct.save).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('Product created successfully', expect.any(Object));
    });

    it('should create a product with images', async () => {
      const mockUploadedImages = [
        { url: 'https://cloudinary.com/image1.jpg', publicId: 'image1' },
        { url: 'https://cloudinary.com/image2.jpg', publicId: 'image2' }
      ];

      cloudinaryService.uploadImages.mockResolvedValue(mockUploadedImages);

      const mockProduct = {
        _id: 'product123',
        ...validProductData,
        sku: 'TEST-PROD-123',
        images: mockUploadedImages,
        save: jest.fn().mockResolvedValue(true)
      };

      Product.mockImplementation(() => mockProduct);

      const result = await productService.createProduct(validProductData, mockImageFiles);

      expect(cloudinaryService.uploadImages).toHaveBeenCalledWith(mockImageFiles);
      expect(result.images).toEqual(mockUploadedImages);
      expect(mockProduct.save).toHaveBeenCalled();
    });

    it('should throw error if required fields are missing', async () => {
      const invalidData = { name: 'Test' };

      await expect(productService.createProduct(invalidData)).rejects.toThrow();
      expect(logger.error).toHaveBeenCalled();
    });

    it('should throw error if price is invalid', async () => {
      const invalidData = { ...validProductData, price: -10 };

      await expect(productService.createProduct(invalidData)).rejects.toThrow();
      expect(logger.error).toHaveBeenCalled();
    });

    it('should handle image upload failure gracefully', async () => {
      cloudinaryService.uploadImages.mockRejectedValue(new Error('Upload failed'));

      await expect(productService.createProduct(validProductData, mockImageFiles)).rejects.toThrow('Upload failed');
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('getProductById', () => {
    it('should return product by id', async () => {
      const mockProduct = {
        _id: 'product123',
        name: 'Test Product',
        price: 99.99,
        stock: 10
      };

      Product.findById = jest.fn().mockResolvedValue(mockProduct);

      const result = await productService.getProductById('product123');

      expect(Product.findById).toHaveBeenCalledWith('product123');
      expect(result).toEqual(mockProduct);
      expect(logger.info).toHaveBeenCalledWith('Product fetched by ID', expect.any(Object));
    });

    it('should return null if product not found', async () => {
      Product.findById = jest.fn().mockResolvedValue(null);

      const result = await productService.getProductById('nonexistent');

      expect(result).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith('Product not found', expect.any(Object));
    });

    it('should throw error if id is invalid', async () => {
      await expect(productService.getProductById('')).rejects.toThrow();
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('getProducts', () => {
    it('should return paginated products', async () => {
      const mockProducts = [
        { _id: '1', name: 'Product 1', price: 10 },
        { _id: '2', name: 'Product 2', price: 20 }
      ];

      const mockQuery = {
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        sort: jest.fn().mockResolvedValue(mockProducts)
      };

      Product.find = jest.fn().mockReturnValue(mockQuery);
      Product.countDocuments = jest.fn().mockResolvedValue(2);

      const filters = { page: 1, limit: 10 };
      const result = await productService.getProducts(filters);

      expect(result.products).toEqual(mockProducts);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.totalPages).toBe(1);
      expect(logger.info).toHaveBeenCalledWith('Products fetched', expect.any(Object));
    });

    it('should filter products by category', async () => {
      const mockProducts = [{ _id: '1', name: 'Product 1', category: 'Electronics' }];

      const mockQuery = {
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        sort: jest.fn().mockResolvedValue(mockProducts)
      };

      Product.find = jest.fn().mockReturnValue(mockQuery);
      Product.countDocuments = jest.fn().mockResolvedValue(1);

      const filters = { category: 'Electronics', page: 1, limit: 10 };
      const result = await productService.getProducts(filters);

      expect(Product.find).toHaveBeenCalledWith({ category: 'Electronics' });
      expect(result.products).toEqual(mockProducts);
    });

    it('should filter products by price range', async () => {
      const mockProducts = [{ _id: '1', name: 'Product 1', price: 50 }];

      const mockQuery = {
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        sort: jest.fn().mockResolvedValue(mockProducts)
      };

      Product.find = jest.fn().mockReturnValue(mockQuery);
      Product.countDocuments = jest.fn().mockResolvedValue(1);

      const filters = { minPrice: 10, maxPrice: 100, page: 1, limit: 10 };
      const result = await productService.getProducts(filters);

      expect(Product.find).toHaveBeenCalledWith({ price: { $gte: 10, $lte: 100 } });
      expect(result.products).toEqual(mockProducts);
    });

    it('should sort products correctly', async () => {
      const mockProducts = [{ _id: '1', name: 'Product 1' }];

      const mockQuery = {
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        sort: jest.fn().mockResolvedValue(mockProducts)
      };

      Product.find = jest.fn().mockReturnValue(mockQuery);
      Product.countDocuments = jest.fn().mockResolvedValue(1);

      const filters = { sortBy: 'price', order: 'desc', page: 1, limit: 10 };
      await productService.getProducts(filters);

      expect(mockQuery.sort).toHaveBeenCalledWith({ price: -1 });
    });

    it('should handle empty results', async () => {
      const mockQuery = {
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        sort: jest.fn().mockResolvedValue([])
      };

      Product.find = jest.fn().mockReturnValue(mockQuery);
      Product.countDocuments = jest.fn().mockResolvedValue(0);

      const result = await productService.getProducts({ page: 1, limit: 10 });

      expect(result.products).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  describe('updateProduct', () => {
    const updateData = {
      name: 'Updated Product',
      price: 149.99,
      stock: 20
    };

    it('should update product successfully', async () => {
      const mockProduct = {
        _id: 'product123',
        name: 'Old Product',
        price: 99.99,
        save: jest.fn().mockResolvedValue(true)
      };

      Product.findById = jest.fn().mockResolvedValue(mockProduct);

      const result = await productService.updateProduct('product123', updateData);

      expect(Product.findById).toHaveBeenCalledWith('product123');
      expect(mockProduct.name).toBe(updateData.name);
      expect(mockProduct.price).toBe(updateData.price);
      expect(mockProduct.save).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('Product updated successfully', expect.any(Object));
    });

    it('should update product images', async () => {
      const mockProduct = {
        _id: 'product123',
        images: [{ publicId: 'old1' }],
        save: jest.fn().mockResolvedValue(true)
      };

      const newImages = [{ path: '/tmp/new1.jpg' }];
      const uploadedImages = [{ url: 'https://cloudinary.com/new1.jpg', publicId: 'new1' }];

      Product.findById = jest.fn().mockResolvedValue(mockProduct);
      cloudinaryService.deleteImages.mockResolvedValue(true);
      cloudinaryService.uploadImages.mockResolvedValue(uploadedImages);

      const result = await productService.updateProduct('product123', {}, newImages);

      expect(cloudinaryService.deleteImages).toHaveBeenCalledWith(['old1']);
      expect(cloudinaryService.uploadImages).toHaveBeenCalledWith(newImages);
      expect(mockProduct.images).toEqual(uploadedImages);
    });

    it('should throw error if product not found', async () => {
      Product.findById = jest.fn().mockResolvedValue(null);

      await expect(productService.updateProduct('nonexistent', updateData)).rejects.toThrow('Product not found');
      expect(logger.error).toHaveBeenCalled();
    });

    it('should validate update data', async () => {
      const invalidData = { price: -50 };

      await expect(productService.updateProduct('product123', invalidData)).rejects.toThrow();
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('deleteProduct', () => {
    it('should delete product successfully', async () => {
      const mockProduct = {
        _id: 'product123',
        images: [{ publicId: 'img1' }, { publicId: 'img2' }]
      };

      Product.findById = jest.fn().mockResolvedValue(mockProduct);
      Product.findByIdAndDelete = jest.fn().mockResolvedValue(mockProduct);
      cloudinaryService.deleteImages.mockResolvedValue(true);

      const result = await productService.deleteProduct('product123');

      expect(Product.findById).toHaveBeenCalledWith('product123');
      expect(cloudinaryService.deleteImages).toHaveBeenCalledWith(['img1', 'img2']);
      expect(Product.findByIdAndDelete).toHaveBeenCalledWith('product123');
      expect(result).toBe(true);
      expect(logger.info).toHaveBeenCalledWith('Product deleted successfully', expect.any(Object));
    });

    it('should delete product without images', async () => {
      const mockProduct = {
        _id: 'product123',
        images: []
      };

      Product.findById = jest.fn().mockResolvedValue(mockProduct);
      Product.findByIdAndDelete = jest.fn().mockResolvedValue(mockProduct);

      const result = await productService.deleteProduct('product123');

      expect(cloudinaryService.deleteImages).not.toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should return false if product not found', async () => {
      Product.findById = jest.fn().mockResolvedValue(null);

      const result = await productService.deleteProduct('nonexistent');

      expect(result).toBe(false);
      expect(logger.warn).toHaveBeenCalledWith('Product not found for deletion', expect.any(Object));
    });

    it('should handle image deletion failure gracefully', async () => {
      const mockProduct = {
        _id: 'product123',
        images: [{ publicId: 'img1' }]
      };

      Product.findById = jest.fn().mockResolvedValue(mockProduct);
      cloudinaryService.deleteImages.mockRejectedValue(new Error('Delete failed'));
      Product.findByIdAndDelete = jest.fn().mockResolvedValue(mockProduct);

      const result = await productService.deleteProduct('product123');

      expect(result).toBe(true);
      expect(logger.warn).toHaveBeenCalledWith('Failed to delete product images', expect.any(Object));
    });
  });

  describe('updateStock', () => {
    it('should update stock successfully', async () => {
      const mockProduct = {
        _id: 'product123',
        stock: 10,
        save: jest.fn().mockResolvedValue(true)
      };

      Product.findById = jest.fn().mockResolvedValue(mockProduct);

      const result = await productService.updateStock('product123', 5);

      expect(Product.findById).toHaveBeenCalledWith('product123');
      expect(mockProduct.stock).toBe(15);
      expect(mockProduct.save).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('Product stock updated', expect.any(Object));
    });

    it('should decrease stock', async () => {
      const mockProduct = {
        _id: 'product123',
        stock: 10,
        save: jest.fn().mockResolvedValue(true)
      };

      Product.findById = jest.fn().mockResolvedValue(mockProduct);

      const result = await productService.updateStock('product123', -3);

      expect(mockProduct.stock).toBe(7);
    });

    it('should throw error if stock would be negative', async () => {
      const mockProduct = {
        _id: 'product123',
        stock: 5
      };

      Product.findById = jest.fn().mockResolvedValue(mockProduct);

      await expect(productService.updateStock('product123', -10)).rejects.toThrow('Insufficient stock');
      expect(logger.error).toHaveBeenCalled();

}}})))