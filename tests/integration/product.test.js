// File: tests/integration/product.test.js
// Generated: 2025-10-16 10:52:59 UTC
// Project ID: proj_c85cfd5b58f3
// Task ID: task_1r6lada3ldzy


const Product = require('../../src/models/Product');


const User = require('../../src/models/User');


const jwt = require('jsonwebtoken');


const mongoose = require('mongoose');


const request = require('supertest');

const { app, connectDB } = require('../../src/app');


let adminToken;

let adminUser;

let testProduct;

// Helper function to create admin token


const createAdminToken = (userId) => {
  return jwt.sign(
    { userId, role: 'admin' },
    process.env.JWT_ACCESS_SECRET || 'test-secret',
    { expiresIn: '1h' }
  );
};

describe('Product Integration Tests', () => {
  beforeAll(async () => {
    // Connect to test database
    process.env.NODE_ENV = 'test';
    process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ecommerce-test';
    await connectDB();

    // Create admin user
    adminUser = await User.create({
      name: 'Admin User',
      email: 'admin@test.com',
      password: 'Admin123!@#',
      role: 'admin'
    });

    adminToken = createAdminToken(adminUser._id);
  });

  beforeEach(async () => {
    // Use session to ensure atomic cleanup
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        await Product.deleteMany({}, { session });
      });
    } finally {
      await session.endSession();
    }

    // Create a test product for tests that need it
    testProduct = await Product.create({
      name: 'Test Product',
      description: 'Test Description',
      price: 99.99,
      category: 'Electronics',
      stock: 50
    });
  });

  afterAll(async () => {
    // Clean up and close connection safely
    try {
      if (mongoose.connection.readyState === 1) {
        await Product.deleteMany({});
        await User.deleteMany({});
        await mongoose.connection.close();
      }
    } catch (error) {
      console.error('Error during cleanup:', error);
      // Force close if normal close fails
      if (mongoose.connection.readyState !== 0) {
        await mongoose.connection.close(true);
      }
    }
  });

  describe('POST /api/products', () => {
    it('should create product with valid data', async () => {
      const productData = {
        name: 'New Product',
        description: 'New Description',
        price: 149.99,
        category: 'Electronics',
        stock: 100
      };

      const response = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(productData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('_id');
      expect(response.body.data.name).toBe(productData.name);
      expect(response.body.data.price).toBe(productData.price);
      expect(response.body.data.stock).toBe(productData.stock);
    });

    it('should reject invalid price (negative)', async () => {
      const productData = {
        name: 'Invalid Product',
        description: 'Test Description',
        price: -50,
        category: 'Electronics',
        stock: 100
      };

      const response = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(productData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });

    it('should reject invalid price (zero)', async () => {
      const productData = {
        name: 'Invalid Product',
        description: 'Test Description',
        price: 0,
        category: 'Electronics',
        stock: 100
      };

      const response = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(productData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });

    it('should reject negative stock', async () => {
      const productData = {
        name: 'Invalid Product',
        description: 'Test Description',
        price: 99.99,
        category: 'Electronics',
        stock: -10
      };

      const response = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(productData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });

    it('should reject missing required fields', async () => {
      const productData = {
        name: 'Incomplete Product',
        price: 99.99
        // Missing description, category, stock
      };

      const response = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(productData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });

    it('should require admin authentication', async () => {
      const productData = {
        name: 'New Product',
        description: 'New Description',
        price: 149.99,
        category: 'Electronics',
        stock: 100
      };

      const response = await request(app)
        .post('/api/products')
        .send(productData)
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/products', () => {
    beforeEach(async () => {
      // Create multiple products for pagination tests
      await Product.create([
        { name: 'Product 1', description: 'Desc 1', price: 10, category: 'Electronics', stock: 10 },
        { name: 'Product 2', description: 'Desc 2', price: 20, category: 'Clothing', stock: 20 },
        { name: 'Product 3', description: 'Desc 3', price: 30, category: 'Electronics', stock: 30 },
        { name: 'Product 4', description: 'Desc 4', price: 40, category: 'Books', stock: 40 },
        { name: 'Product 5', description: 'Desc 5', price: 50, category: 'Electronics', stock: 50 }
      ]);
    });

    it('should return paginated products', async () => {
      const response = await request(app)
        .get('/api/products?page=1&limit=3')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(3);
      expect(response.body.totalPages).toBeDefined();
      expect(response.body.currentPage).toBe(1);
    });

    it('should filter by category', async () => {
      const response = await request(app)
        .get('/api/products?category=Electronics')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
      response.body.data.forEach(product => {
        expect(product.category).toBe('Electronics');
      });
    });

    it('should filter by price range', async () => {
      const response = await request(app)
        .get('/api/products?minPrice=20&maxPrice=40')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
      response.body.data.forEach(product => {
        expect(product.price).toBeGreaterThanOrEqual(20);
        expect(product.price).toBeLessThanOrEqual(40);
      });
    });

    it('should return empty array when no products exist', async () => {
      await Product.deleteMany({});

      const response = await request(app)
        .get('/api/products')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual([]);
      expect(response.body.totalPages).toBe(0);
    });

    it('should include totalPages and currentPage in response', async () => {
      const response = await request(app)
        .get('/api/products?page=2&limit=2')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body).toHaveProperty('totalPages');
      expect(response.body).toHaveProperty('currentPage');
      expect(response.body.currentPage).toBe(2);
    });
  });

  describe('GET /api/products/:id', () => {
    it('should return single product by valid ID', async () => {
      const response = await request(app)
        .get(`/api/products/${testProduct._id}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data._id).toBe(testProduct._id.toString());
      expect(response.body.data.name).toBe(testProduct.name);
      expect(response.body.data.price).toBe(testProduct.price);
    });

    it('should return 404 for non-existent ID', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();

      const response = await request(app)
        .get(`/api/products/${nonExistentId}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });

    it('should return 400 for invalid MongoDB ObjectId', async () => {
      const response = await request(app)
        .get('/api/products/invalid-id')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });
  });

  describe('PATCH /api/products/:id', () => {
    it('should update product fields (partial update)', async () => {
      const updates = {
        name: 'Updated Product Name',
        price: 199.99
      };

      const response = await request(app)
        .patch(`/api/products/${testProduct._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updates)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(updates.name);
      expect(response.body.data.price).toBe(updates.price);
      expect(response.body.data.description).toBe(testProduct.description);
    });

    it('should validate updated data', async () => {
      const invalidUpdates = {
        price: -100
      };

      const response = await request(app)
        .patch(`/api/products/${testProduct._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(invalidUpdates)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });

    it('should return 404 for non-existent product', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      const updates = { name: 'Updated Name' };

      const response = await request(app)
        .patch(`/api/products/${nonExistentId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updates)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });

    it('should require admin authentication', async () => {
      const updates = { name: 'Updated Name' };

      const response = await request(app)
        .patch(`/api/products/${testProduct._id}`)
        .send(updates)
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /api/products/:id', () => {
    it('should delete product successfully', async () => {
      const response = await request(app)
        .delete(`/api/products/${testProduct._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBeDefined();

      // Verify product is deleted
      const deletedProduct = await Product.findById(testProduct._id);
      expect(deletedProduct).toBeNull();
    });

    it('should return 404 for non-existent product', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();

      const response = await request(app)
        .delete(`/api/products/${nonExistentId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });

    it('should require admin authentication', async () => {
      const response = await request(app)
        .delete(`/api/products/${testProduct._id}`)
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('PATCH /api/products/:id/stock', () => {
    it('should handle concurrent stock updates atomically', async () => {
      const initialStock = testProduct.stock;
      const decrementAmount = 5;
      const concurrentRequests = 10;

      // Create multiple concurrent requests to decrement stock
      const requests = Array(concurrentRequests).fill(null).map(() =>
        request(app)
          .patch(`/api/products/${testProduct._id}/stock`)
          .send({ quantity: -decrementAmount })
      );

      const results = await Promise.allSettled(requests);

      // Count successful requests
      const successfulRequests = results.filter(r => r.status === 'fulfilled' && r.value.status === 200).length;

      // Verify final stock reflects only successful operations
      const updatedProduct = await Product.findById(testProduct._id);
      const expectedStock = initialStock - (decrementAmount * successfulRequests);
      expect(updatedProduct.stock).toBe(expectedStock);

      // Verify stock is non-negative
      expect(updatedProduct.stock).toBeGreaterThanOrEqual(0);
    });

    it('should prevent negative stock after decrement', async () => {
      // Set product stock to 10
      await Product.findByIdAndUpdate(testProduct._id, { stock: 10 });

      // Try to decrement by more than available
      const response = await request(app)
        .patch(`/api/products/${testProduct._id}/stock`)
        .send({ quantity: -15 })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toMatch(/insufficient stock|not enough stock/i);

      // Verify stock hasn't changed
      const product = await Product.findById(testProduct._id);
      expect(product.stock).toBe(10);
    });

    it('should test race conditions with Promise.allSettled', async () => {
      // Set initial stock
      await Product.findByIdAndUpdate(testProduct._id, { stock: 100 });

      // Create race condition with multiple simultaneous updates
      const updates = [
        request(app).patch(`/api/products/${testProduct._id}/stock`).send({ quantity: -10 }),
        request(app).patch(`/api/products/${testProduct
