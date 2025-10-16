// File: tests/unit/services/cart.service.test.js
// Generated: 2025-10-16 10:54:05 UTC
// Project ID: proj_c85cfd5b58f3
// Task ID: task_cudfuf6yhp8x


const Cart = require('../../../src/models/Cart');


const CartService = require('../../../src/services/cart.service');


const Product = require('../../../src/models/Product');


const logger = require('../../../src/utils/logger');


const redisService = require('../../../src/services/redis.service');

// Mock dependencies
jest.mock('../../../src/models/Cart');
jest.mock('../../../src/models/Product');
jest.mock('../../../src/services/redis.service');
jest.mock('../../../src/utils/logger');

describe('CartService', () => {
  let cartService;
  const mockUserId = '507f1f77bcf86cd799439011';
  const mockSessionId = 'session123';
  const mockProductId = '507f1f77bcf86cd799439012';

  beforeEach(() => {
    cartService = new CartService();
    jest.clearAllMocks();
  });

  describe('getCart', () => {
    it('should return cart from cache if available', async () => {
      const mockCart = {
        _id: 'cart123',
        userId: mockUserId,
        items: [],
        totalAmount: 0
      };

      redisService.get.mockResolvedValue(JSON.stringify(mockCart));

      const result = await cartService.getCart(mockUserId);

      expect(redisService.get).toHaveBeenCalledWith(`cart:${mockUserId}`);
      expect(result).toEqual(mockCart);
      expect(Cart.findOne).not.toHaveBeenCalled();
    });

    it('should fetch cart from database if not in cache', async () => {
      const mockCart = {
        _id: 'cart123',
        userId: mockUserId,
        items: [],
        totalAmount: 0,
        toObject: jest.fn().mockReturnThis()
      };

      redisService.get.mockResolvedValue(null);
      Cart.findOne.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockCart)
      });

      const result = await cartService.getCart(mockUserId);

      expect(Cart.findOne).toHaveBeenCalledWith({ userId: mockUserId });
      expect(redisService.set).toHaveBeenCalledWith(
        `cart:${mockUserId}`,
        JSON.stringify(mockCart),
        3600
      );
      expect(result).toEqual(mockCart);
    });

    it('should create new cart if none exists', async () => {
      const mockNewCart = {
        _id: 'cart123',
        userId: mockUserId,
        items: [],
        totalAmount: 0,
        toObject: jest.fn().mockReturnThis()
      };

      redisService.get.mockResolvedValue(null);
      Cart.findOne.mockReturnValue({
        populate: jest.fn().mockResolvedValue(null)
      });
      Cart.create.mockResolvedValue(mockNewCart);

      const result = await cartService.getCart(mockUserId);

      expect(Cart.create).toHaveBeenCalledWith({
        userId: mockUserId,
        items: [],
        totalAmount: 0
      });
      expect(redisService.set).toHaveBeenCalled();
      expect(result).toEqual(mockNewCart);
    });

    it('should handle session-based cart when userId is not provided', async () => {
      const mockCart = {
        _id: 'cart123',
        sessionId: mockSessionId,
        items: [],
        totalAmount: 0,
        toObject: jest.fn().mockReturnThis()
      };

      redisService.get.mockResolvedValue(null);
      Cart.findOne.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockCart)
      });

      const result = await cartService.getCart(null, mockSessionId);

      expect(Cart.findOne).toHaveBeenCalledWith({ sessionId: mockSessionId });
      expect(result).toEqual(mockCart);
    });

    it('should log error and throw when database operation fails', async () => {
      const error = new Error('Database error');

      redisService.get.mockResolvedValue(null);
      Cart.findOne.mockReturnValue({
        populate: jest.fn().mockRejectedValue(error)
      });

      await expect(cartService.getCart(mockUserId)).rejects.toThrow('Database error');
      expect(logger.error).toHaveBeenCalledWith(
        'Error fetching cart',
        expect.objectContaining({ error: error.message })
      );
    });
  });

  describe('addItem', () => {
    it('should add new item to cart', async () => {
      const mockProduct = {
        _id: mockProductId,
        name: 'Test Product',
        price: 100,
        stock: 10
      };

      const mockCart = {
        _id: 'cart123',
        userId: mockUserId,
        items: [],
        totalAmount: 0,
        save: jest.fn().mockResolvedValue(true),
        toObject: jest.fn().mockReturnThis()
      };

      Product.findById.mockResolvedValue(mockProduct);
      Cart.findOne.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockCart)
      });

      const result = await cartService.addItem(mockUserId, mockProductId, 2);

      expect(Product.findById).toHaveBeenCalledWith(mockProductId);
      expect(mockCart.items).toHaveLength(1);
      expect(mockCart.items[0]).toEqual({
        product: mockProductId,
        quantity: 2,
        price: 100
      });
      expect(mockCart.totalAmount).toBe(200);
      expect(mockCart.save).toHaveBeenCalled();
      expect(redisService.del).toHaveBeenCalledWith(`cart:${mockUserId}`);
    });

    it('should update quantity if item already exists in cart', async () => {
      const mockProduct = {
        _id: mockProductId,
        name: 'Test Product',
        price: 100,
        stock: 10
      };

      const mockCart = {
        _id: 'cart123',
        userId: mockUserId,
        items: [
          {
            product: mockProductId,
            quantity: 1,
            price: 100
          }
        ],
        totalAmount: 100,
        save: jest.fn().mockResolvedValue(true),
        toObject: jest.fn().mockReturnThis()
      };

      Product.findById.mockResolvedValue(mockProduct);
      Cart.findOne.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockCart)
      });

      const result = await cartService.addItem(mockUserId, mockProductId, 2);

      expect(mockCart.items[0].quantity).toBe(3);
      expect(mockCart.totalAmount).toBe(300);
      expect(mockCart.save).toHaveBeenCalled();
    });

    it('should throw error if product not found', async () => {
      Product.findById.mockResolvedValue(null);

      await expect(
        cartService.addItem(mockUserId, mockProductId, 1)
      ).rejects.toThrow('Product not found');
    });

    it('should throw error if insufficient stock', async () => {
      const mockProduct = {
        _id: mockProductId,
        name: 'Test Product',
        price: 100,
        stock: 5
      };

      Product.findById.mockResolvedValue(mockProduct);

      await expect(
        cartService.addItem(mockUserId, mockProductId, 10)
      ).rejects.toThrow('Insufficient stock');
    });

    it('should throw error if quantity is invalid', async () => {
      await expect(
        cartService.addItem(mockUserId, mockProductId, 0)
      ).rejects.toThrow('Invalid quantity');

      await expect(
        cartService.addItem(mockUserId, mockProductId, -1)
      ).rejects.toThrow('Invalid quantity');
    });
  });

  describe('updateItemQuantity', () => {
    it('should update item quantity in cart', async () => {
      const mockProduct = {
        _id: mockProductId,
        name: 'Test Product',
        price: 100,
        stock: 10
      };

      const mockCart = {
        _id: 'cart123',
        userId: mockUserId,
        items: [
          {
            product: mockProductId,
            quantity: 2,
            price: 100
          }
        ],
        totalAmount: 200,
        save: jest.fn().mockResolvedValue(true),
        toObject: jest.fn().mockReturnThis()
      };

      Product.findById.mockResolvedValue(mockProduct);
      Cart.findOne.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockCart)
      });

      const result = await cartService.updateItemQuantity(mockUserId, mockProductId, 5);

      expect(mockCart.items[0].quantity).toBe(5);
      expect(mockCart.totalAmount).toBe(500);
      expect(mockCart.save).toHaveBeenCalled();
      expect(redisService.del).toHaveBeenCalledWith(`cart:${mockUserId}`);
    });

    it('should throw error if item not in cart', async () => {
      const mockCart = {
        _id: 'cart123',
        userId: mockUserId,
        items: [],
        totalAmount: 0
      };

      Cart.findOne.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockCart)
      });

      await expect(
        cartService.updateItemQuantity(mockUserId, mockProductId, 5)
      ).rejects.toThrow('Item not found in cart');
    });

    it('should throw error if insufficient stock for update', async () => {
      const mockProduct = {
        _id: mockProductId,
        name: 'Test Product',
        price: 100,
        stock: 3
      };

      const mockCart = {
        _id: 'cart123',
        userId: mockUserId,
        items: [
          {
            product: mockProductId,
            quantity: 2,
            price: 100
          }
        ],
        totalAmount: 200
      };

      Product.findById.mockResolvedValue(mockProduct);
      Cart.findOne.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockCart)
      });

      await expect(
        cartService.updateItemQuantity(mockUserId, mockProductId, 5)
      ).rejects.toThrow('Insufficient stock');
    });
  });

  describe('removeItem', () => {
    it('should remove item from cart', async () => {
      const mockCart = {
        _id: 'cart123',
        userId: mockUserId,
        items: [
          {
            product: mockProductId,
            quantity: 2,
            price: 100
          }
        ],
        totalAmount: 200,
        save: jest.fn().mockResolvedValue(true),
        toObject: jest.fn().mockReturnThis()
      };

      Cart.findOne.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockCart)
      });

      const result = await cartService.removeItem(mockUserId, mockProductId);

      expect(mockCart.items).toHaveLength(0);
      expect(mockCart.totalAmount).toBe(0);
      expect(mockCart.save).toHaveBeenCalled();
      expect(redisService.del).toHaveBeenCalledWith(`cart:${mockUserId}`);
    });

    it('should throw error if item not in cart', async () => {
      const mockCart = {
        _id: 'cart123',
        userId: mockUserId,
        items: [],
        totalAmount: 0
      };

      Cart.findOne.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockCart)
      });

      await expect(
        cartService.removeItem(mockUserId, mockProductId)
      ).rejects.toThrow('Item not found in cart');
    });

    it('should recalculate total after removing item', async () => {
      const mockCart = {
        _id: 'cart123',
        userId: mockUserId,
        items: [
          {
            product: mockProductId,
            quantity: 2,
            price: 100
          },
          {
            product: '507f1f77bcf86cd799439013',
            quantity: 1,
            price: 50
          }
        ],
        totalAmount: 250,
        save: jest.fn().mockResolvedValue(true),
        toObject: jest.fn().mockReturnThis()
      };

      Cart.findOne.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockCart)
      });

      await cartService.removeItem(mockUserId, mockProductId);

      expect(mockCart.items).toHaveLength(1);
      expect(mockCart.totalAmount).toBe(50);
    });
  });

  describe('clearCart', () => {
    it('should clear all items from cart', async () => {
      const mockCart = {
        _id: 'cart123',
        userId: mockUserId,
        items: [
          {
            product: mockProductId,
            quantity: 2,
            price: 100
          }
        ],
        totalAmount: 200,
        save: jest.fn().mockResolvedValue(true),
        toObject: jest.fn().mockReturnThis()
      };

      Cart.findOne.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockCart)
      });

      await cartService.clearCart(mockUserId);

      expect(mockCart.items).toHaveLength(0);
      expect(mockCart.totalAmount).toBe(0);
      expect(mockCart.save).toHaveBeenCalled();
      expect(redisService.del).toHaveBeenCalledWith(`cart:${mockUserId}`);
    });

    it('should handle empty cart gracefully', async () => {
      const mockCart = {
        _id: 'cart123',
        userId: mockUserId,
        items: [],
        totalAmount: 0,
        save: jest.fn().mockResolvedValue(true),
        toObject: jest.fn().mockReturnThis()
      };

      Cart.findOne.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockCart)
      });

      await cartService.clearCart(mockUserId);

      expect(mockCart.items).toHaveLength(0);
      expect(mockCart.save).toHaveBeenCalled();
    });
  });

  describe('applyPromoCode', () => {
    it('should apply valid promo code to cart', async () => {
      const mockCart = {
        _id: 'cart123',
        userId: mockUserId,
        items: [
          {
            product: mockProductId,
            quantity: 2,
            price: 100
          }
        ],
        totalAmount: 200,
        promoCode: null,
        discount: 0,
        save: jest.fn().mockResolvedValue(true),
        toObject: jest.fn().mockReturnThis()
      };

      Cart.findOne.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockCart)
      });

      const result = await cartService.applyPromoCode(mockUserId, 'SAVE10', 10);

      expect(mockCart.promoCode).toBe('SAVE10');
      expect(mockCart.discount).toBe(20);
      expect(mockCart.totalAmount).toBe(180);
      expect(mockCart.save).toHaveBeenCalled();
      expect(redisService.del).toHaveBeenCalledWith(`cart:${mockUs
