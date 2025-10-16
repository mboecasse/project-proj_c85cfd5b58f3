// File: tests/unit/services/order.service.test.js
// Generated: 2025-10-16 11:00:07 UTC
// Project ID: proj_c85cfd5b58f3
// Task ID: task_pu5ewd82ookf


const CartService = require('../../../src/services/cart.service');


const InventoryService = require('../../../src/services/inventory.service');


const Order = require('../../../src/models/Order');


const OrderItem = require('../../../src/models/OrderItem');


const OrderService = require('../../../src/services/order.service');


const Product = require('../../../src/models/Product');


const mongoose = require('mongoose');

// Mock dependencies
jest.mock('../../../src/models/Order');
jest.mock('../../../src/models/OrderItem');
jest.mock('../../../src/models/Product');
jest.mock('../../../src/services/cart.service');
jest.mock('../../../src/services/inventory.service');
jest.mock('mongoose');

describe('OrderService', () => {
  let orderService;
  let mockOrderRepository;
  let mockCartService;
  let mockProductService;
  let mockInventoryService;
  let mockSession;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Initialize service
    orderService = new OrderService();

    // Mock session
    mockSession = {
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      abortTransaction: jest.fn(),
      endSession: jest.fn()
    };

    mongoose.startSession = jest.fn().mockResolvedValue(mockSession);

    // Mock CartService with default return values
    CartService.prototype.getCart = jest.fn().mockResolvedValue({
      items: [],
      total: 0
    });
    CartService.prototype.clearCart = jest.fn().mockResolvedValue(true);

    // Mock InventoryService with default return values
    InventoryService.prototype.reserveStock = jest.fn().mockResolvedValue(true);
    InventoryService.prototype.releaseStock = jest.fn().mockResolvedValue(true);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createOrder', () => {
    const userId = new mongoose.Types.ObjectId();
    const orderData = {
      shippingAddress: {
        street: '123 Main St',
        city: 'New York',
        state: 'NY',
        zipCode: '10001',
        country: 'USA'
      },
      paymentMethod: 'credit_card'
    };

    const mockCartItems = [
      {
        product: {
          _id: new mongoose.Types.ObjectId(),
          name: 'Product 1',
          price: 100,
          stock: 10
        },
        quantity: 2
      },
      {
        product: {
          _id: new mongoose.Types.ObjectId(),
          name: 'Product 2',
          price: 50,
          stock: 5
        },
        quantity: 1
      }
    ];

    it('should create order successfully', async () => {
      const mockOrder = {
        _id: new mongoose.Types.ObjectId(),
        orderNumber: 'ORD-1234567890',
        user: userId,
        items: mockCartItems,
        subtotal: 250,
        shipping: 10,
        tax: 25,
        total: 285,
        status: 'pending',
        shippingAddress: orderData.shippingAddress,
        paymentMethod: orderData.paymentMethod,
        save: jest.fn().mockResolvedValue(this)
      };

      CartService.prototype.getCart.mockResolvedValue({
        items: mockCartItems,
        total: 250
      });

      InventoryService.prototype.reserveStock.mockResolvedValue(true);
      CartService.prototype.clearCart.mockResolvedValue(true);

      Order.prototype.save = jest.fn().mockResolvedValue(mockOrder);
      Order.mockImplementation(() => mockOrder);

      const result = await orderService.createOrder(userId, orderData);

      expect(mongoose.startSession).toHaveBeenCalled();
      expect(mockSession.startTransaction).toHaveBeenCalled();
      expect(CartService.prototype.getCart).toHaveBeenCalledWith(userId);
      expect(InventoryService.prototype.reserveStock).toHaveBeenCalled();
      expect(CartService.prototype.clearCart).toHaveBeenCalledWith(userId);
      expect(mockSession.commitTransaction).toHaveBeenCalled();
      expect(mockSession.endSession).toHaveBeenCalled();
      expect(result).toHaveProperty('orderNumber');
      expect(result.status).toBe('pending');
    });

    it('should throw error if cart is empty', async () => {
      CartService.prototype.getCart.mockResolvedValue({
        items: [],
        total: 0
      });

      await expect(orderService.createOrder(userId, orderData)).rejects.toThrow('Cart is empty');

      expect(mockSession.abortTransaction).toHaveBeenCalled();
      expect(mockSession.endSession).toHaveBeenCalled();
    });

    it('should throw error if product is out of stock', async () => {
      const outOfStockCart = [
        {
          product: {
            _id: new mongoose.Types.ObjectId(),
            name: 'Product 1',
            price: 100,
            stock: 0
          },
          quantity: 2
        }
      ];

      CartService.prototype.getCart.mockResolvedValue({
        items: outOfStockCart,
        total: 200
      });

      await expect(orderService.createOrder(userId, orderData)).rejects.toThrow();

      expect(mockSession.abortTransaction).toHaveBeenCalled();
      expect(mockSession.endSession).toHaveBeenCalled();
    });

    it('should rollback transaction on error', async () => {
      CartService.prototype.getCart.mockResolvedValue({
        items: mockCartItems,
        total: 250
      });

      InventoryService.prototype.reserveStock.mockRejectedValue(new Error('Stock reservation failed'));

      await expect(orderService.createOrder(userId, orderData)).rejects.toThrow('Stock reservation failed');

      expect(mockSession.abortTransaction).toHaveBeenCalled();
      expect(mockSession.endSession).toHaveBeenCalled();
    });

    it('should validate shipping address', async () => {
      const invalidOrderData = {
        shippingAddress: {
          street: '123 Main St'
        },
        paymentMethod: 'credit_card'
      };

      await expect(orderService.createOrder(userId, invalidOrderData)).rejects.toThrow();
    });
  });

  describe('validateAndCalculateOrder', () => {
    const mockCartItems = [
      {
        product: {
          _id: new mongoose.Types.ObjectId(),
          name: 'Product 1',
          price: 100,
          stock: 10
        },
        quantity: 2
      },
      {
        product: {
          _id: new mongoose.Types.ObjectId(),
          name: 'Product 2',
          price: 50,
          stock: 5
        },
        quantity: 1
      }
    ];

    it('should calculate order totals correctly', async () => {
      const result = await orderService.validateAndCalculateOrder(mockCartItems);

      expect(result).toHaveProperty('subtotal');
      expect(result).toHaveProperty('shipping');
      expect(result).toHaveProperty('tax');
      expect(result).toHaveProperty('total');
      expect(result.subtotal).toBe(250);
      expect(result.total).toBeGreaterThan(result.subtotal);
    });

    it('should validate product availability', async () => {
      const unavailableItems = [
        {
          product: {
            _id: new mongoose.Types.ObjectId(),
            name: 'Product 1',
            price: 100,
            stock: 1
          },
          quantity: 5
        }
      ];

      await expect(orderService.validateAndCalculateOrder(unavailableItems)).rejects.toThrow();
    });

    it('should handle empty cart items', async () => {
      await expect(orderService.validateAndCalculateOrder([])).rejects.toThrow();
    });
  });

  describe('updateOrderStatus', () => {
    const orderId = new mongoose.Types.ObjectId();

    it('should update order status successfully', async () => {
      const mockOrder = {
        _id: orderId,
        status: 'pending',
        save: jest.fn().mockResolvedValue(this)
      };

      Order.findById = jest.fn().mockResolvedValue(mockOrder);

      const result = await orderService.updateOrderStatus(orderId, 'processing');

      expect(Order.findById).toHaveBeenCalledWith(orderId);
      expect(mockOrder.status).toBe('processing');
      expect(mockOrder.save).toHaveBeenCalled();
    });

    it('should throw error if order not found', async () => {
      Order.findById = jest.fn().mockResolvedValue(null);

      await expect(orderService.updateOrderStatus(orderId, 'processing')).rejects.toThrow('Order not found');
    });

    it('should validate status transition', async () => {
      const mockOrder = {
        _id: orderId,
        status: 'delivered',
        save: jest.fn()
      };

      Order.findById = jest.fn().mockResolvedValue(mockOrder);

      await expect(orderService.updateOrderStatus(orderId, 'pending')).rejects.toThrow();
    });
  });

  describe('cancelOrder', () => {
    const orderId = new mongoose.Types.ObjectId();
    const userId = new mongoose.Types.ObjectId();

    it('should cancel order successfully', async () => {
      const mockOrder = {
        _id: orderId,
        user: userId,
        status: 'pending',
        items: [
          {
            product: new mongoose.Types.ObjectId(),
            quantity: 2
          }
        ],
        save: jest.fn().mockResolvedValue(this)
      };

      Order.findById = jest.fn().mockResolvedValue(mockOrder);
      InventoryService.prototype.releaseStock.mockResolvedValue(true);

      const result = await orderService.cancelOrder(orderId, userId);

      expect(Order.findById).toHaveBeenCalledWith(orderId);
      expect(mockOrder.status).toBe('cancelled');
      expect(InventoryService.prototype.releaseStock).toHaveBeenCalled();
      expect(mockOrder.save).toHaveBeenCalled();
    });

    it('should throw error if order not found', async () => {
      Order.findById = jest.fn().mockResolvedValue(null);

      await expect(orderService.cancelOrder(orderId, userId)).rejects.toThrow('Order not found');
    });

    it('should throw error if user is not order owner', async () => {
      const mockOrder = {
        _id: orderId,
        user: new mongoose.Types.ObjectId(),
        status: 'pending'
      };

      Order.findById = jest.fn().mockResolvedValue(mockOrder);

      await expect(orderService.cancelOrder(orderId, userId)).rejects.toThrow();
    });

    it('should throw error if order cannot be cancelled', async () => {
      const mockOrder = {
        _id: orderId,
        user: userId,
        status: 'delivered'
      };

      Order.findById = jest.fn().mockResolvedValue(mockOrder);

      await expect(orderService.cancelOrder(orderId, userId)).rejects.toThrow();
    });
  });

  describe('getOrderById', () => {
    const orderId = new mongoose.Types.ObjectId();
    const userId = new mongoose.Types.ObjectId();

    it('should get order by id successfully', async () => {
      const mockOrder = {
        _id: orderId,
        user: userId,
        orderNumber: 'ORD-1234567890',
        status: 'pending',
        total: 285
      };

      Order.findById = jest.fn().mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockOrder)
      });

      const result = await orderService.getOrderById(orderId, userId);

      expect(Order.findById).toHaveBeenCalledWith(orderId);
      expect(result).toEqual(mockOrder);
    });

    it('should throw error if order not found', async () => {
      Order.findById = jest.fn().mockReturnValue({
        populate: jest.fn().mockResolvedValue(null)
      });

      await expect(orderService.getOrderById(orderId, userId)).rejects.toThrow('Order not found');
    });

    it('should throw error if user is not order owner', async () => {
      const mockOrder = {
        _id: orderId,
        user: new mongoose.Types.ObjectId(),
        status: 'pending'
      };

      Order.findById = jest.fn().mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockOrder)
      });

      await expect(orderService.getOrderById(orderId, userId)).rejects.toThrow();
    });
  });

  describe('getUserOrders', () => {
    const userId = new mongoose.Types.ObjectId();

    it('should get user orders successfully', async () => {
      const mockOrders = [
        {
          _id: new mongoose.Types.ObjectId(),
          user: userId,
          orderNumber: 'ORD-1234567890',
          status: 'pending',
          total: 285
        },
        {
          _id: new mongoose.Types.ObjectId(),
          user: userId,
          orderNumber: 'ORD-0987654321',
          status: 'delivered',
          total: 150
        }
      ];

      Order.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue(mockOrders)
        })
      });

      const result = await orderService.getUserOrders(userId);

      expect(Order.find).toHaveBeenCalledWith({ user: userId });
      expect(result).toEqual(mockOrders);
      expect(result.length).toBe(2);
    });

    it('should return empty array if no orders found', async () => {
      Order.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue([])
        })
      });

      const result = await orderService.getUserOrders(userId);

      expect(result).toEqual([]);
    });

    it('should filter orders by status', async () => {
      const mockOrders = [
        {
          _id: new mongoose.Types.ObjectId(),
          user: userId,
          status: 'pending',
          total: 285
        }
      ];

      Order.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue(mockOrders)
        })
      });

      const result = await orderService.getUserOrders(userId, { status: 'pending' });

      expect(Order.find).toHaveBeenCalledWith({ user: userId, status: 'pending' });
      expect(result).toEqual(mockOrders);
    });
  });

  describe('generateOrderNumber', () => {
    it('should generate unique order number', () => {
      const orderNumber1 = orderService.generateOrderNumber();
      const orderNumber2 = orderService.generateOrderNumber();

      expect(orderNumber1).toMatch(/^ORD-\d+$/);
      expect(orderNumber2).toMatch(/^ORD-\d+$/);
      expect(orderNumber1).not.toBe(orderNumber2);
    });

    it('should generate order number with correct prefix', () => {
      const orderNumber = orderService.generateOrderNumber();

      expect(orderNumber).toMatch(/^ORD-/);
    });
  });

  describe('calculateShipping',
