// File: tests/integration/cart.test.js
// Generated: 2025-10-16 10:52:00 UTC
// Project ID: proj_c85cfd5b58f3
// Task ID: task_xgvryokxfo96


const Cart = require('../../src/models/Cart');


const Product = require('../../src/models/Product');


const User = require('../../src/models/User');


const bcrypt = require('bcrypt');


const jwt = require('jsonwebtoken');


const mongoose = require('mongoose');


const request = require('supertest');

const { app } = require('../../src/app');

describe('Cart Integration Tests', () => {
  let authToken;
  let testUser;
  let testProducts;

  beforeAll(async () => {
    // Connect to test database
    const testDbUri = process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/ecommerce_test';
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(testDbUri);
    }
  });

  beforeEach(async () => {
    // Clear collections
    await Cart.deleteMany({});
    await Product.deleteMany({});
    await User.deleteMany({});

    // Create test user with hashed password
    const hashedPassword = await bcrypt.hash('password123', 10);
    testUser = await User.create({
      name: 'Test User',
      email: 'testuser@example.com',
      password: hashedPassword
    });

    // Generate auth token with required JWT secret
    const jwtSecret = process.env.JWT_ACCESS_SECRET;
    if (!jwtSecret) {
      throw new Error('JWT_ACCESS_SECRET environment variable is required');
    }
    authToken = jwt.sign(
      { userId: testUser._id },
      jwtSecret,
      { expiresIn: '1h' }
    );

    // Create test products
    testProducts = await Product.insertMany([
      {
        name: 'Product 1',
        description: 'Test product 1',
        price: 29.99,
        stock: 100,
        category: 'Electronics'
      },
      {
        name: 'Product 2',
        description: 'Test product 2',
        price: 49.99,
        stock: 50,
        category: 'Electronics'
      },
      {
        name: 'Product 3',
        description: 'Test product 3',
        price: 19.99,
        stock: 75,
        category: 'Books'
      }
    ]);
  });

  afterEach(async () => {
    await Cart.deleteMany({});
    await Product.deleteMany({});
    await User.deleteMany({});
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  describe('GET /api/cart', () => {
    it('should return empty cart for new user', async () => {
      const response = await request(app)
        .get('/api/cart')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.items).toEqual([]);
      expect(response.body.data.totalPrice).toBe(0);
    });

    it('should return cart with items', async () => {
      // Create cart with items
      await Cart.create({
        user: testUser._id,
        items: [
          {
            product: testProducts[0]._id,
            quantity: 2,
            price: testProducts[0].price
          },
          {
            product: testProducts[1]._id,
            quantity: 1,
            price: testProducts[1].price
          }
        ]
      });

      const response = await request(app)
        .get('/api/cart')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.items).toHaveLength(2);
      expect(response.body.data.totalPrice).toBe(109.97);
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .get('/api/cart')
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/cart/items', () => {
    it('should add item to cart', async () => {
      const response = await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productId: testProducts[0]._id.toString(),
          quantity: 2
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.items).toHaveLength(1);
      expect(response.body.data.items[0].quantity).toBe(2);
      expect(response.body.data.totalPrice).toBe(59.98);
    });

    it('should update quantity if item already in cart', async () => {
      // Add item first time
      await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productId: testProducts[0]._id.toString(),
          quantity: 2
        });

      // Add same item again
      const response = await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productId: testProducts[0]._id.toString(),
          quantity: 3
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.items).toHaveLength(1);
      expect(response.body.data.items[0].quantity).toBe(5);
      expect(response.body.data.totalPrice).toBe(149.95);
    });

    it('should return 400 for invalid product ID', async () => {
      const response = await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productId: 'invalid_id',
          quantity: 2
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should return 404 for non-existent product', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productId: fakeId.toString(),
          quantity: 2
        })
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it('should return 400 for quantity exceeding stock', async () => {
      const response = await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productId: testProducts[0]._id.toString(),
          quantity: 200
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('stock');
    });

    it('should return 400 for invalid quantity', async () => {
      const response = await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productId: testProducts[0]._id.toString(),
          quantity: 0
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .post('/api/cart/items')
        .send({
          productId: testProducts[0]._id.toString(),
          quantity: 2
        })
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/cart/items/:productId', () => {
    beforeEach(async () => {
      // Add item to cart
      await Cart.create({
        user: testUser._id,
        items: [
          {
            product: testProducts[0]._id,
            quantity: 2,
            price: testProducts[0].price
          }
        ]
      });
    });

    it('should update item quantity', async () => {
      const response = await request(app)
        .put(`/api/cart/items/${testProducts[0]._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ quantity: 5 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.items[0].quantity).toBe(5);
      expect(response.body.data.totalPrice).toBe(149.95);
    });

    it('should return 404 for item not in cart', async () => {
      const response = await request(app)
        .put(`/api/cart/items/${testProducts[1]._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ quantity: 3 })
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it('should return 400 for quantity exceeding stock', async () => {
      const response = await request(app)
        .put(`/api/cart/items/${testProducts[0]._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ quantity: 200 })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should return 400 for invalid quantity', async () => {
      const response = await request(app)
        .put(`/api/cart/items/${testProducts[0]._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ quantity: -1 })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .put(`/api/cart/items/${testProducts[0]._id}`)
        .send({ quantity: 5 })
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /api/cart/items/:productId', () => {
    beforeEach(async () => {
      // Add items to cart
      await Cart.create({
        user: testUser._id,
        items: [
          {
            product: testProducts[0]._id,
            quantity: 2,
            price: testProducts[0].price
          },
          {
            product: testProducts[1]._id,
            quantity: 1,
            price: testProducts[1].price
          }
        ]
      });
    });

    it('should remove item from cart', async () => {
      const response = await request(app)
        .delete(`/api/cart/items/${testProducts[0]._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.items).toHaveLength(1);
      expect(response.body.data.items[0].product.toString()).toBe(testProducts[1]._id.toString());
    });

    it('should return 404 for item not in cart', async () => {
      const response = await request(app)
        .delete(`/api/cart/items/${testProducts[2]._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .delete(`/api/cart/items/${testProducts[0]._id}`)
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /api/cart', () => {
    beforeEach(async () => {
      // Add items to cart
      await Cart.create({
        user: testUser._id,
        items: [
          {
            product: testProducts[0]._id,
            quantity: 2,
            price: testProducts[0].price
          },
          {
            product: testProducts[1]._id,
            quantity: 1,
            price: testProducts[1].price
          }
        ]
      });
    });

    it('should clear all items from cart', async () => {
      const response = await request(app)
        .delete('/api/cart')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.items).toHaveLength(0);
      expect(response.body.data.totalPrice).toBe(0);
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .delete('/api/cart')
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Cart calculations', () => {
    it('should calculate correct total price with multiple items', async () => {
      await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productId: testProducts[0]._id.toString(),
          quantity: 2
        });

      await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productId: testProducts[1]._id.toString(),
          quantity: 3
        });

      const response = await request(app)
        .get('/api/cart')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const expectedTotal = (testProducts[0].price * 2) + (testProducts[1].price * 3);
      expect(response.body.data.totalPrice).toBeCloseTo(expectedTotal, 2);
    });

    it('should update total price when item quantity changes', async () => {
      await Cart.create({
        user: testUser._id,
        items: [
          {
            product: testProducts[0]._id,
            quantity: 2,
            price: testProducts[0].price
          }
        ]
      });

      const response = await request(app)
        .put(`/api/cart/items/${testProducts[0]._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ quantity: 5 })
        .expect(200);

      const expectedTotal = testProducts[0].price * 5;
      expect(response.body.data.totalPrice).toBeCloseTo(expectedTotal, 2);
    });

    it('should update total price when item is removed', async () => {
      await Cart.create({
        user: testUser._id,
        items: [
          {
            product: testProducts[0]._id,
            quantity: 2,
            price: testProducts[0].price
          },
          {
            product: testProducts[1]._id,
            quantity: 1,
            price: testProducts[1].price
          }
        ]
      });

      const response = await request(app)
        .delete(`/api/cart/items/${testProducts[0]._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.totalPrice).toBeCloseTo(testProducts[1].price, 2);
    });
  });

  describe('Cart isolation', () => {
    it('should not show other users cart items', async () => {
      // Create another user with hashed password
      const hashedPassword = await bcrypt.hash('password123', 10);
      const otherUser = await User.create({
        name: 'Other User',
        email: 'other@example.com',
        password: hashedPassword
      });

}}})))