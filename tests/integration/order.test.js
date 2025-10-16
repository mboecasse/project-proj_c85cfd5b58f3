// File: tests/integration/order.test.js
// Generated: 2025-10-16 10:52:03 UTC
// Project ID: proj_c85cfd5b58f3
// Task ID: task_rwa9s85akfxd


const Cart = require('../../src/models/Cart');


const Order = require('../../src/models/Order');


const Product = require('../../src/models/Product');


const TestData = require('../helpers/testData');


const User = require('../../src/models/User');


const logger = require('../../src/utils/logger');


const mongoose = require('mongoose');


const request = require('supertest');

const { app } = require('../../src/app');

// Test credentials - DO NOT use in production


const TEST_PASSWORD = 'Test123!@#';


const TEST_EMAIL = 'testuser@example.com';

describe('Order Integration Tests', () => {
  let authToken;
  let testUser;
  let testProducts;
  let testCart;

  beforeAll(async () => {
    // Ensure database connection
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ecommerce_test');
    }
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    try {
      // Clear collections
      await Order.deleteMany({});
      await Cart.deleteMany({});
      await Product.deleteMany({});
      await User.deleteMany({});

      // Create test user
      const userData = TestData.createUser({ email: TEST_EMAIL, password: TEST_PASSWORD });
      testUser = await User.create(userData);

      // Login to get auth token
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({ email: TEST_EMAIL, password: TEST_PASSWORD });

      authToken = loginResponse.body.token;

      // Create test products with stock
      const product1 = TestData.createProduct({
        name: 'Test Product 1',
        price: 29.99,
        stock: 100,
        category: 'Electronics'
      });

      const product2 = TestData.createProduct({
        name: 'Test Product 2',
        price: 49.99,
        stock: 50,
        category: 'Electronics'
      });

      const product3 = TestData.createProduct({
        name: 'Test Product 3',
        price: 19.99,
        stock: 5,
        category: 'Accessories'
      });

      testProducts = await Product.insertMany([product1, product2, product3]);

      // Create test cart with items
      testCart = await Cart.create({
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
    } catch (error) {
      logger.error('Error in beforeEach setup:', error);
      throw error;
    }
  });

  afterEach(async () => {
    await Order.deleteMany({});
    await Cart.deleteMany({});
    await Product.deleteMany({});
    await User.deleteMany({});
  });

  describe('POST /api/orders', () => {
    it('should create an order from cart items', async () => {
      const orderData = {
        shippingAddress: {
          street: '123 Test Street',
          city: 'Test City',
          state: 'TS',
          zipCode: '12345',
          country: 'Test Country'
        },
        paymentMethod: 'credit_card'
      };

      const response = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send(orderData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('_id');
      expect(response.body.data.user.toString()).toBe(testUser._id.toString());
      expect(response.body.data.items).toHaveLength(2);
      expect(response.body.data.totalAmount).toBe(109.97);
      expect(response.body.data.status).toBe('pending');
      expect(response.body.data.shippingAddress.street).toBe('123 Test Street');

      // Verify cart is cleared
      const cart = await Cart.findOne({ user: testUser._id });
      expect(cart.items).toHaveLength(0);

      // Verify product stock is reduced
      const product1 = await Product.findById(testProducts[0]._id);
      const product2 = await Product.findById(testProducts[1]._id);
      expect(product1.stock).toBe(98);
      expect(product2.stock).toBe(49);
    });

    it('should fail when cart is empty', async () => {
      await Cart.findOneAndUpdate(
        { user: testUser._id },
        { items: [] }
      );

      const orderData = {
        shippingAddress: {
          street: '123 Test Street',
          city: 'Test City',
          state: 'TS',
          zipCode: '12345',
          country: 'Test Country'
        },
        paymentMethod: 'credit_card'
      };

      const response = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send(orderData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('empty');
    });

    it('should fail when product is out of stock', async () => {
      await Product.findByIdAndUpdate(testProducts[0]._id, { stock: 1 });

      const orderData = {
        shippingAddress: {
          street: '123 Test Street',
          city: 'Test City',
          state: 'TS',
          zipCode: '12345',
          country: 'Test Country'
        },
        paymentMethod: 'credit_card'
      };

      const response = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send(orderData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('stock');
    });

    it('should fail without authentication', async () => {
      const orderData = {
        shippingAddress: {
          street: '123 Test Street',
          city: 'Test City',
          state: 'TS',
          zipCode: '12345',
          country: 'Test Country'
        },
        paymentMethod: 'credit_card'
      };

      const response = await request(app)
        .post('/api/orders')
        .send(orderData)
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should fail with invalid shipping address', async () => {
      const orderData = {
        shippingAddress: {
          street: '123 Test Street'
        },
        paymentMethod: 'credit_card'
      };

      const response = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send(orderData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should calculate correct totals with tax and shipping', async () => {
      const orderData = {
        shippingAddress: {
          street: '123 Test Street',
          city: 'Test City',
          state: 'TS',
          zipCode: '12345',
          country: 'Test Country'
        },
        paymentMethod: 'credit_card'
      };

      const response = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send(orderData)
        .expect(201);

      expect(response.body.data.subtotal).toBe(109.97);
      expect(response.body.data).toHaveProperty('tax');
      expect(response.body.data).toHaveProperty('shippingCost');
      expect(response.body.data.totalAmount).toBeGreaterThan(109.97);
    });
  });

  describe('GET /api/orders', () => {
    beforeEach(async () => {
      try {
        const order1 = await Order.create({
          user: testUser._id,
          items: [
            {
              product: testProducts[0]._id,
              quantity: 2,
              price: testProducts[0].price
            }
          ],
          totalAmount: 59.98,
          status: 'pending',
          shippingAddress: {
            street: '123 Test Street',
            city: 'Test City',
            state: 'TS',
            zipCode: '12345',
            country: 'Test Country'
          }
        });

        const order2 = await Order.create({
          user: testUser._id,
          items: [
            {
              product: testProducts[1]._id,
              quantity: 1,
              price: testProducts[1].price
            }
          ],
          totalAmount: 49.99,
          status: 'shipped',
          shippingAddress: {
            street: '456 Test Avenue',
            city: 'Test City',
            state: 'TS',
            zipCode: '12345',
            country: 'Test Country'
          }
        });
      } catch (error) {
        logger.error('Error creating test orders:', error);
        throw error;
      }
    });

    it('should get all orders for authenticated user', async () => {
      const response = await request(app)
        .get('/api/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0]).toHaveProperty('_id');
      expect(response.body.data[0]).toHaveProperty('items');
      expect(response.body.data[0]).toHaveProperty('totalAmount');
    });

    it('should filter orders by status', async () => {
      const response = await request(app)
        .get('/api/orders?status=shipped')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].status).toBe('shipped');
    });

    it('should paginate orders', async () => {
      const response = await request(app)
        .get('/api/orders?page=1&limit=1')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.pagination).toHaveProperty('total');
      expect(response.body.pagination.total).toBe(2);
    });

    it('should fail without authentication', async () => {
      const response = await request(app)
        .get('/api/orders')
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should return empty array when user has no orders', async () => {
      await Order.deleteMany({ user: testUser._id });

      const response = await request(app)
        .get('/api/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(0);
    });
  });

  describe('GET /api/orders/:id', () => {
    let testOrder;

    beforeEach(async () => {
      try {
        testOrder = await Order.create({
          user: testUser._id,
          items: [
            {
              product: testProducts[0]._id,
              quantity: 2,
              price: testProducts[0].price
            }
          ],
          totalAmount: 59.98,
          status: 'pending',
          shippingAddress: {
            street: '123 Test Street',
            city: 'Test City',
            state: 'TS',
            zipCode: '12345',
            country: 'Test Country'
          }
        });
      } catch (error) {
        logger.error('Error creating test order:', error);
        throw error;
      }
    });

    it('should get order by ID', async () => {
      const response = await request(app)
        .get(`/api/orders/${testOrder._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data._id).toBe(testOrder._id.toString());
      expect(response.body.data.items).toHaveLength(1);
      expect(response.body.data.totalAmount).toBe(59.98);
    });

    it('should populate product details', async () => {
      const response = await request(app)
        .get(`/api/orders/${testOrder._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.items[0].product).toHaveProperty('name');
      expect(response.body.data.items[0].product.name).toBe('Test Product 1');
    });

    it('should fail with invalid order ID', async () => {
      const invalidId = new mongoose.Types.ObjectId();

      const response = await request(app)
        .get(`/api/orders/${invalidId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('not found');
    });

    it('should fail when accessing another user order', async () => {
      const otherUser = await User.create(TestData.createUser({ email: 'other@example.com' }));
      const otherOrder = await Order.create({
        user: otherUser._id,
        items: [
          {
            product: testProducts[0]._id,
            quantity: 1,
            price: testProducts[0].price
          }
        ],
        totalAmount: 29.99,
        status: 'pending',
        shippingAddress: {
          street: '789 Test Road',
          city: 'Test City',
          state: 'TS',
          zipCode: '12345',
          country: 'Test Country'
        }
      });

      const response = await request(app)
        .get(`/api/orders/${otherOrder._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
    });

    it('should fail without authentication', async () => {
      const response = await request(app)
        .get(`/api/orders/${testOrder._id}`)
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/orders/:id/cancel', () => {
    let testOrder;

    beforeEach(async () => {
      try {
        testOrder = await Order.create({
          user: testUser._id,
          items: [
            {
              product: testProducts[0]._id,
              quantity: 2,
              price: testProducts[0].price
            }
          ],
          totalAmount: 59.98,
          status: 'pending',
          shippingAddress: {
            street: '123 Test Street',
            city: 'Test City',
            state: 'TS',
            zipCode: '12345',
            country: 'Test Country'
          }
