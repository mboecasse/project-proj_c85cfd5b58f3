// File: tests/integration/payment.test.js
// Generated: 2025-10-16 10:52:40 UTC
// Project ID: proj_c85cfd5b58f3
// Task ID: task_psjwsn2t2icg


const Order = require('../../src/models/Order');


const Payment = require('../../src/models/Payment');


const Product = require('../../src/models/Product');


const User = require('../../src/models/User');


const bcrypt = require('bcrypt');


const logger = require('../../src/utils/logger');


const mongoose = require('mongoose');


const request = require('supertest');

const { app } = require('../../src/app');

/**
 * Payment Integration Tests
 * Tests payment processing, refunds, webhooks, and payment security
 */
describe('Payment Integration Tests', () => {
  let authToken;
  let testUser;
  let testOrder;
  let testProduct;

  beforeAll(async () => {
    // Connect to test database with authentication
    const testDbUri = process.env.MONGODB_TEST_URI || 'mongodb://testuser:testpass@localhost:27017/ecommerce_test?authSource=admin';
    await mongoose.connect(testDbUri);
    logger.info('Connected to test database for payment integration tests');
  });

  beforeEach(async () => {
    // Clean up test data
    await User.deleteMany({});
    await Order.deleteMany({});
    await Payment.deleteMany({});
    await Product.deleteMany({});

    // Create test product
    testProduct = await Product.create({
      name: 'Test Product',
      description: 'Test product for payment tests',
      price: 50,
      stock: 100,
      category: 'test'
    });

    // Create test user with properly hashed password
    const hashedPassword = await bcrypt.hash('password123', 10);
    testUser = await User.create({
      name: 'Test User',
      email: 'testpayment@example.com',
      password: hashedPassword,
      role: 'user'
    });

    // Login to get auth token
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'testpayment@example.com',
        password: 'password123'
      });

    authToken = loginRes.body.token;

    // Create test order
    testOrder = await Order.create({
      userId: testUser._id,
      items: [
        {
          productId: testProduct._id,
          quantity: 2,
          price: 50
        }
      ],
      totalAmount: 100,
      status: 'pending',
      shippingAddress: {
        street: '123 Test St',
        city: 'Test City',
        state: 'TS',
        zipCode: '12345',
        country: 'US'
      }
    });
  });

  afterEach(async () => {
    // Clean up test data
    await User.deleteMany({});
    await Order.deleteMany({});
    await Payment.deleteMany({});
    await Product.deleteMany({});
  });

  afterAll(async () => {
    await mongoose.connection.close();
    logger.info('Closed test database connection');
  });

  describe('POST /api/payments/process', () => {
    it('should successfully process a valid payment', async () => {
      const paymentData = {
        orderId: testOrder._id.toString(),
        paymentMethod: 'credit_card',
        cardDetails: {
          number: '4242424242424242',
          expMonth: 12,
          expYear: 2025,
          cvc: '123',
          cardholderName: 'Test User'
        },
        amount: 100,
        currency: 'USD'
      };

      const response = await request(app)
        .post('/api/payments/process')
        .set('Authorization', `Bearer ${authToken}`)
        .send(paymentData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('paymentId');
      expect(response.body.data.status).toBe('completed');
      expect(response.body.data.amount).toBe(100);
      expect(response.body.data.currency).toBe('USD');

      // Verify payment record created
      const payment = await Payment.findById(response.body.data.paymentId);
      expect(payment).toBeTruthy();
      expect(payment.orderId.toString()).toBe(testOrder._id.toString());
      expect(payment.userId.toString()).toBe(testUser._id.toString());
      expect(payment.status).toBe('completed');

      // Verify order status updated
      const updatedOrder = await Order.findById(testOrder._id);
      expect(updatedOrder.status).toBe('paid');
      expect(updatedOrder.paymentId.toString()).toBe(payment._id.toString());
    });

    it('should reject payment with invalid card details', async () => {
      const paymentData = {
        orderId: testOrder._id.toString(),
        paymentMethod: 'credit_card',
        cardDetails: {
          number: '4000000000000002',
          expMonth: 12,
          expYear: 2025,
          cvc: '123',
          cardholderName: 'Test User'
        },
        amount: 100,
        currency: 'USD'
      };

      const response = await request(app)
        .post('/api/payments/process')
        .set('Authorization', `Bearer ${authToken}`)
        .send(paymentData)
        .expect(402);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('declined');

      // Verify order status remains pending
      const order = await Order.findById(testOrder._id);
      expect(order.status).toBe('pending');
    });

    it('should reject payment with expired card', async () => {
      const paymentData = {
        orderId: testOrder._id.toString(),
        paymentMethod: 'credit_card',
        cardDetails: {
          number: '4242424242424242',
          expMonth: 12,
          expYear: 2020,
          cvc: '123',
          cardholderName: 'Test User'
        },
        amount: 100,
        currency: 'USD'
      };

      const response = await request(app)
        .post('/api/payments/process')
        .set('Authorization', `Bearer ${authToken}`)
        .send(paymentData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('expired');
    });

    it('should prevent duplicate payments for same order', async () => {
      // Create existing completed payment
      await Payment.create({
        orderId: testOrder._id,
        userId: testUser._id,
        amount: 100,
        currency: 'USD',
        status: 'completed',
        transactionId: 'txn_123456',
        paymentMethod: 'credit_card'
      });

      await Order.findByIdAndUpdate(testOrder._id, { status: 'paid' });

      const paymentData = {
        orderId: testOrder._id.toString(),
        paymentMethod: 'credit_card',
        cardDetails: {
          number: '4242424242424242',
          expMonth: 12,
          expYear: 2025,
          cvc: '123',
          cardholderName: 'Test User'
        },
        amount: 100,
        currency: 'USD'
      };

      const response = await request(app)
        .post('/api/payments/process')
        .set('Authorization', `Bearer ${authToken}`)
        .send(paymentData)
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('already paid');
    });

    it('should validate payment amount matches order total', async () => {
      const paymentData = {
        orderId: testOrder._id.toString(),
        paymentMethod: 'credit_card',
        cardDetails: {
          number: '4242424242424242',
          expMonth: 12,
          expYear: 2025,
          cvc: '123',
          cardholderName: 'Test User'
        },
        amount: 50,
        currency: 'USD'
      };

      const response = await request(app)
        .post('/api/payments/process')
        .set('Authorization', `Bearer ${authToken}`)
        .send(paymentData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('amount mismatch');
    });

    it('should reject payment for non-existent order', async () => {
      const fakeOrderId = new mongoose.Types.ObjectId();
      const paymentData = {
        orderId: fakeOrderId.toString(),
        paymentMethod: 'credit_card',
        cardDetails: {
          number: '4242424242424242',
          expMonth: 12,
          expYear: 2025,
          cvc: '123',
          cardholderName: 'Test User'
        },
        amount: 100,
        currency: 'USD'
      };

      const response = await request(app)
        .post('/api/payments/process')
        .set('Authorization', `Bearer ${authToken}`)
        .send(paymentData)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Order not found');
    });

    it('should reject payment without authentication', async () => {
      const paymentData = {
        orderId: testOrder._id.toString(),
        paymentMethod: 'credit_card',
        amount: 100,
        currency: 'USD'
      };

      const response = await request(app)
        .post('/api/payments/process')
        .send(paymentData)
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should validate required payment fields', async () => {
      const paymentData = {
        orderId: testOrder._id.toString()
      };

      const response = await request(app)
        .post('/api/payments/process')
        .set('Authorization', `Bearer ${authToken}`)
        .send(paymentData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeTruthy();
    });

    it('should handle insufficient funds scenario', async () => {
      const paymentData = {
        orderId: testOrder._id.toString(),
        paymentMethod: 'credit_card',
        cardDetails: {
          number: '4000000000009995',
          expMonth: 12,
          expYear: 2025,
          cvc: '123',
          cardholderName: 'Test User'
        },
        amount: 100,
        currency: 'USD'
      };

      const response = await request(app)
        .post('/api/payments/process')
        .set('Authorization', `Bearer ${authToken}`)
        .send(paymentData)
        .expect(402);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('insufficient funds');
    });

    it('should support multiple payment methods', async () => {
      const paymentMethods = ['credit_card', 'debit_card', 'digital_wallet'];

      for (const method of paymentMethods) {
        const order = await Order.create({
          userId: testUser._id,
          items: [{ productId: testProduct._id, quantity: 1, price: 50 }],
          totalAmount: 50,
          status: 'pending',
          shippingAddress: {
            street: '123 Test St',
            city: 'Test City',
            state: 'TS',
            zipCode: '12345',
            country: 'US'
          }
        });

        const paymentData = {
          orderId: order._id.toString(),
          paymentMethod: method,
          cardDetails: {
            number: '4242424242424242',
            expMonth: 12,
            expYear: 2025,
            cvc: '123',
            cardholderName: 'Test User'
          },
          amount: 50,
          currency: 'USD'
        };

        const response = await request(app)
          .post('/api/payments/process')
          .set('Authorization', `Bearer ${authToken}`)
          .send(paymentData)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.paymentMethod).toBe(method);
      }
    });

    it('should validate currency format', async () => {
      const paymentData = {
        orderId: testOrder._id.toString(),
        paymentMethod: 'credit_card',
        cardDetails: {
          number: '4242424242424242',
          expMonth: 12,
          expYear: 2025,
          cvc: '123',
          cardholderName: 'Test User'
        },
        amount: 100,
        currency: 'INVALID'
      };

      const response = await request(app)
        .post('/api/payments/process')
        .set('Authorization', `Bearer ${authToken}`)
        .send(paymentData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('currency');
    });
  });

  describe('POST /api/payments/:paymentId/refund', () => {
    let completedPayment;

    beforeEach(async () => {
      // Create completed payment
      completedPayment = await Payment.create({
        orderId: testOrder._id,
        userId: testUser._id,
        amount: 100,
        currency: 'USD',
        status: 'completed',
        transactionId: 'txn_123456',
        paymentMethod: 'credit_card'
      });

      await Order.findByIdAndUpdate(testOrder._id, {
        status: 'paid',
        paymentId: completedPayment._id
      });
    });

    it('should process full refund successfully', async () => {
      const refundData = {
        amount: 100,
        reason: 'Customer request'
      };

      const response = await request(app)
        .post(`/api/payments/${completedPayment._id}/refund`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(refundData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('refunded');
      expect(response.body.data.refundAmount).toBe(100);

      // Verify payment updated
      const payment = await Payment.findById(completedPayment._id);
      expect(payment.status).toBe('refunded');
      expect(payment.refundAmount).toBe(100);

      // Verify order status updated
      const order = await Order.findById(testOrder._id);
      expect(order.status).toBe('refunded');
    });

    it('should process partial refund successfully', async () => {
      const refundData = {
        amount: 50,
        reason: 'Partial return'
      };

      const response = await request(app)
        .post(`/api/payments/${completedPayment._id}/refund`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(refundData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('partially_refunded');
      expect(response.body.data.refundAmount).toBe(50);

      // Verify payment updated
      const payment = await Payment.findById(completedPayment._id);
      expect(payment.status).toBe('partially_refunded');
      expect(payment.refundAmount).toBe(50);
    });

    it('should reject refund exceeding payment amount', async () => {
      const refundData = {
