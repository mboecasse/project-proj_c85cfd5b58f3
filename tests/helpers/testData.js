// File: tests/helpers/testData.js
// Generated: 2025-10-16 10:42:23 UTC
// Project ID: proj_c85cfd5b58f3
// Task ID: task_unv2lk28v1tg


const { ObjectId } = require('mongodb');

/**
 * Test Data Factories and Fixtures
 * Provides realistic test data for e-commerce backend testing
 */

/**
 * Generate a valid MongoDB ObjectId
 * @returns {ObjectId} MongoDB ObjectId
 */


const generateObjectId = () => new ObjectId();

/**
 * Create a product fixture
 * @param {Object} overrides - Properties to override defaults
 * @returns {Object} Product object
 */


const createProduct = (overrides = {}) => {
  const id = overrides._id || generateObjectId();
  const name = overrides.name || 'Test Product';

  return {
    _id: id,
    name,
    slug: overrides.slug || name.toLowerCase().replace(/\s+/g, '-'),
    description: overrides.description || 'High-quality test product with excellent features',
    price: overrides.price !== undefined ? overrides.price : 29.99,
    compareAtPrice: overrides.compareAtPrice || null,
    category: overrides.category || 'electronics',
    subcategory: overrides.subcategory || 'accessories',
    brand: overrides.brand || 'TestBrand',
    sku: overrides.sku || `SKU-${Date.now()}`,
    stock: overrides.stock !== undefined ? overrides.stock : 100,
    lowStockThreshold: overrides.lowStockThreshold || 10,
    images: overrides.images || [
      { url: 'https://example.com/image1.jpg', alt: 'Product image', isPrimary: true }
    ],
    specifications: overrides.specifications || {
      color: 'Black',
      weight: '200g',
      dimensions: '10x10x5 cm'
    },
    isActive: overrides.isActive !== undefined ? overrides.isActive : true,
    isFeatured: overrides.isFeatured || false,
    tags: overrides.tags || ['test', 'product'],
    rating: overrides.rating || { average: 4.5, count: 100 },
    createdAt: overrides.createdAt || new Date(),
    updatedAt: overrides.updatedAt || new Date(),
    ...overrides
  };
};

/**
 * Create multiple product fixtures
 * @param {number} count - Number of products to create
 * @param {Object} overrides - Properties to override defaults
 * @returns {Array} Array of product objects
 */


const createProducts = (count = 3, overrides = {}) => {
  return Array.from({ length: count }, (_, i) =>
    createProduct({
      name: `Product ${i + 1}`,
      sku: `SKU-${Date.now()}-${i}`,
      ...overrides
    })
  );
};

/**
 * Create a user fixture
 * @param {Object} overrides - Properties to override defaults
 * @returns {Object} User object
 */


const createUser = (overrides = {}) => {
  const email = overrides.email || 'test@example.com';

  return {
    _id: overrides._id || generateObjectId(),
    name: overrides.name || 'Test User',
    email,
    password: overrides.password || '$2a$10$abcdefghijklmnopqrstuvwxyz123456789', // Hashed password
    role: overrides.role || 'customer',
    isVerified: overrides.isVerified !== undefined ? overrides.isVerified : true,
    phone: overrides.phone || '+1234567890',
    addresses: overrides.addresses || [],
    permissions: overrides.permissions || [],
    createdAt: overrides.createdAt || new Date(),
    updatedAt: overrides.updatedAt || new Date(),
    lastLogin: overrides.lastLogin || new Date(),
    ...overrides
  };
};

/**
 * Create multiple user fixtures
 * @param {number} count - Number of users to create
 * @param {Object} overrides - Properties to override defaults
 * @returns {Array} Array of user objects
 */


const createUsers = (count = 3, overrides = {}) => {
  return Array.from({ length: count }, (_, i) =>
    createUser({
      name: `User ${i + 1}`,
      email: `user${i + 1}@example.com`,
      ...overrides
    })
  );
};

/**
 * Create a cart fixture
 * @param {Object} overrides - Properties to override defaults
 * @returns {Object} Cart object
 */


const createCart = (overrides = {}) => {
  const items = overrides.items || [];
  const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const tax = subtotal * 0.1;
  const total = subtotal + tax;

  return {
    _id: overrides._id || generateObjectId(),
    userId: overrides.userId || generateObjectId(),
    items,
    subtotal: overrides.subtotal !== undefined ? overrides.subtotal : subtotal,
    tax: overrides.tax !== undefined ? overrides.tax : tax,
    total: overrides.total !== undefined ? overrides.total : total,
    discount: overrides.discount || 0,
    couponCode: overrides.couponCode || null,
    createdAt: overrides.createdAt || new Date(),
    updatedAt: overrides.updatedAt || new Date(),
    expiresAt: overrides.expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    ...overrides
  };
};

/**
 * Create an order fixture
 * @param {Object} overrides - Properties to override defaults
 * @returns {Object} Order object
 */


const createOrder = (overrides = {}) => {
  const items = overrides.items || [
    {
      productId: generateObjectId(),
      name: 'Test Product',
      quantity: 1,
      price: 29.99,
      total: 29.99
    }
  ];
  const subtotal = items.reduce((sum, item) => sum + item.total, 0);
  const tax = subtotal * 0.1;
  const shipping = 5.99;
  const total = subtotal + tax + shipping;

  return {
    _id: overrides._id || generateObjectId(),
    orderNumber: overrides.orderNumber || `ORD-${Date.now()}`,
    userId: overrides.userId || generateObjectId(),
    items,
    subtotal: overrides.subtotal !== undefined ? overrides.subtotal : subtotal,
    tax: overrides.tax !== undefined ? overrides.tax : tax,
    shipping: overrides.shipping !== undefined ? overrides.shipping : shipping,
    discount: overrides.discount || 0,
    total: overrides.total !== undefined ? overrides.total : total,
    status: overrides.status || 'pending',
    paymentStatus: overrides.paymentStatus || 'pending',
    paymentMethod: overrides.paymentMethod || 'credit_card',
    shippingAddress: overrides.shippingAddress || createAddress(),
    billingAddress: overrides.billingAddress || createAddress(),
    trackingNumber: overrides.trackingNumber || null,
    notes: overrides.notes || '',
    createdAt: overrides.createdAt || new Date(),
    updatedAt: overrides.updatedAt || new Date(),
    paidAt: overrides.paidAt || null,
    shippedAt: overrides.shippedAt || null,
    deliveredAt: overrides.deliveredAt || null,
    cancelledAt: overrides.cancelledAt || null,
    cancellationReason: overrides.cancellationReason || null,
    ...overrides
  };
};

/**
 * Create a payment fixture
 * @param {Object} overrides - Properties to override defaults
 * @returns {Object} Payment object
 */


const createPayment = (overrides = {}) => {
  return {
    _id: overrides._id || generateObjectId(),
    orderId: overrides.orderId || generateObjectId(),
    userId: overrides.userId || generateObjectId(),
    transactionId: overrides.transactionId || `txn_${Date.now()}`,
    amount: overrides.amount !== undefined ? overrides.amount : 99.99,
    currency: overrides.currency || 'USD',
    method: overrides.method || 'credit_card',
    status: overrides.status || 'succeeded',
    provider: overrides.provider || 'stripe',
    cardLast4: overrides.cardLast4 || '4242',
    cardBrand: overrides.cardBrand || 'visa',
    errorCode: overrides.errorCode || null,
    errorMessage: overrides.errorMessage || null,
    metadata: overrides.metadata || {},
    createdAt: overrides.createdAt || new Date(),
    updatedAt: overrides.updatedAt || new Date(),
    ...overrides
  };
};

/**
 * Create an address fixture
 * @param {Object} overrides - Properties to override defaults
 * @returns {Object} Address object
 */


const createAddress = (overrides = {}) => {
  return {
    _id: overrides._id || generateObjectId(),
    firstName: overrides.firstName || 'John',
    lastName: overrides.lastName || 'Doe',
    company: overrides.company || null,
    address1: overrides.address1 || '123 Main Street',
    address2: overrides.address2 || null,
    city: overrides.city || 'New York',
    state: overrides.state || 'NY',
    postalCode: overrides.postalCode || '10001',
    country: overrides.country || 'US',
    phone: overrides.phone || '+1234567890',
    isDefault: overrides.isDefault || false,
    type: overrides.type || 'shipping',
    ...overrides
  };
};

/**
 * Pre-built product fixtures for common scenarios
 */


const productFixtures = {
  validProduct: createProduct({
    name: 'Wireless Headphones',
    description: 'High-quality wireless headphones with noise cancellation',
    price: 149.99,
    compareAtPrice: 199.99,
    category: 'electronics',
    subcategory: 'audio',
    brand: 'TechBrand',
    sku: 'WH-1000XM4',
    stock: 50
  }),

  outOfStockProduct: createProduct({
    name: 'Out of Stock Product',
    stock: 0,
    isActive: false
  }),

  lowStockProduct: createProduct({
    name: 'Low Stock Product',
    stock: 5,
    lowStockThreshold: 10
  }),

  expensiveProduct: createProduct({
    name: 'Premium Product',
    price: 999.99,
    category: 'luxury'
  }),

  freeProduct: createProduct({
    name: 'Free Sample',
    price: 0
  }),

  featuredProduct: createProduct({
    name: 'Featured Product',
    isFeatured: true,
    rating: { average: 4.8, count: 500 }
  }),

  inactiveProduct: createProduct({
    name: 'Inactive Product',
    isActive: false
  })
};

/**
 * Pre-built user fixtures for different roles
 */


const userFixtures = {
  customer: createUser({
    name: 'Customer User',
    email: 'customer@test.com',
    role: 'customer',
    isVerified: true
  }),

  admin: createUser({
    name: 'Admin User',
    email: 'admin@test.com',
    role: 'admin',
    permissions: ['manage_products', 'manage_orders', 'manage_users'],
    isVerified: true
  }),

  vendor: createUser({
    name: 'Vendor User',
    email: 'vendor@test.com',
    role: 'vendor',
    permissions: ['manage_own_products', 'view_own_orders'],
    isVerified: true
  }),

  guest: createUser({
    name: 'Guest User',
    email: 'guest@test.com',
    role: 'guest',
    isVerified: false
  }),

  unverifiedCustomer: createUser({
    name: 'Unverified Customer',
    email: 'unverified@test.com',
    role: 'customer',
    isVerified: false
  })
};

/**
 * Pre-built cart scenarios
 */


const cartScenarios = {
  emptyCart: createCart({
    items: [],
    subtotal: 0,
    tax: 0,
    total: 0
  }),

  singleItemCart: createCart({
    items: [
      {
        productId: generateObjectId(),
        name: 'Test Product',
        quantity: 1,
        price: 29.99,
        total: 29.99
      }
    ]
  }),

  multipleItemsCart: createCart({
    items: [
      {
        productId: generateObjectId(),
        name: 'Product 1',
        quantity: 2,
        price: 29.99,
        total: 59.98
      },
      {
        productId: generateObjectId(),
        name: 'Product 2',
        quantity: 1,
        price: 49.99,
        total: 49.99
      }
    ]
  }),

  cartWithDiscount: createCart({
    items: [
      {
        productId: generateObjectId(),
        name: 'Product',
        quantity: 1,
        price: 100.00,
        total: 100.00
      }
    ],
    discount: 10.00,
    couponCode: 'SAVE10'
  }),

  expiredCart: createCart({
    items: [
      {
        productId: generateObjectId(),
        name: 'Product',
        quantity: 1,
        price: 29.99,
        total: 29.99
      }
    ],
    expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000)
  })
};

/**
 * Pre-built order fixtures for different states
 */


const orderFixtures = {
  pendingOrder: createOrder({
    status: 'pending',
    paymentStatus: 'pending'
  }),

  paidOrder: createOrder({
    status: 'processing',
    paymentStatus: 'paid',
    paidAt: new Date()
  }),

  shippedOrder: createOrder({
    status: 'shipped',
    paymentStatus: 'paid',
    trackingNumber: 'TRACK123456',
    paidAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    shippedAt: new Date()
  }),

  deliveredOrder: createOrder({
    status: 'delivered',
    paymentStatus: 'paid',
    trackingNumber: 'TRACK123456',
    paidAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    shippedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    deliveredAt: new Date()
  }),

  cancelledOrder: createOrder({
    status: 'cancelled',
    paymentStatus: 'refunded',
    cancelledAt: new Date(),
    cancellationReason: 'Customer request'
  }),

  failedPaymentOrder: createOrder({
    status: 'pending',
    paymentStatus: 'failed'
  })
};

/**
 * Pre-built payment fixtures for different scenarios
 */


const paymentFixtures = {
  successfulPay
