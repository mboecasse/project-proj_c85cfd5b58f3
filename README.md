# 🛒 E-Commerce Backend API

A production-ready e-commerce backend built with Node.js, Express, and MongoDB. Features a complete product catalog, shopping cart management, order processing, and integrated payment gateway (Stripe) with comprehensive authentication and authorization.

## ✨ Key Features

- 🔐 **JWT Authentication** - Secure user authentication with access and refresh tokens
- 🛍️ **Product Management** - Full CRUD operations with categories, search, and filtering
- 🛒 **Shopping Cart** - Persistent cart with real-time inventory validation
- 📦 **Order Processing** - Complete order lifecycle with status tracking
- 💳 **Payment Integration** - Stripe payment processing with webhook support
- 👥 **User Management** - Role-based access control (Admin, Seller, Customer)
- 🔒 **Security** - Helmet, rate limiting, input sanitization, CORS protection
- 📧 **Email Notifications** - SendGrid integration for transactional emails
- 📊 **Logging** - Winston logger with daily rotation and multiple transports
- 🐳 **Docker Ready** - Complete Docker and Docker Compose configuration
- ⚡ **Redis Caching** - Optional Redis support for sessions and rate limiting
- 🧪 **Testing** - Jest configuration with unit and integration test support

## 📋 Prerequisites

- **Node.js**: >= 18.0.0
- **npm**: >= 9.0.0
- **MongoDB**: >= 6.0 (local or Atlas)
- **Redis**: >= 7.0 (optional, for caching)
- **Stripe Account**: For payment processing
- **SendGrid Account**: For email notifications (optional)

## 🚀 Installation

### 1. Clone the Repository

```bash
git clone <repository-url>
cd ecommerce-backend
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Configuration

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` with your configuration (see Environment Variables section below).

### 4. Database Setup

**Option A: Local MongoDB**

```bash
# Start MongoDB service
sudo systemctl start mongodb

# Or using Docker
docker run -d -p 27017:27017 --name mongodb mongo:6.0
```

**Option B: MongoDB Atlas**

1. Create a free cluster at [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas)
2. Get your connection string
3. Update `MONGODB_URI` in `.env`

### 5. Generate JWT Secrets

```bash
# Generate secure random strings for JWT secrets
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Copy the output and use it for `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` in `.env`.

## ⚙️ Environment Variables

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `development` or `production` |
| `PORT` | Server port | `3000` |
| `MONGODB_URI` | MongoDB connection string | `mongodb://localhost:27017/ecommerce` |
| `JWT_ACCESS_SECRET` | JWT access token secret (min 32 chars) | Generated using crypto |
| `JWT_ACCESS_EXPIRY` | Access token expiration | `15m` |
| `JWT_REFRESH_SECRET` | JWT refresh token secret (min 32 chars) | Generated using crypto |
| `JWT_REFRESH_EXPIRY` | Refresh token expiration | `7d` |
| `SESSION_SECRET` | Express session secret (min 32 chars) | Generated using crypto |
| `STRIPE_SECRET_KEY` | Stripe secret key | `sk_test_...` or `sk_live_...` |
| `STRIPE_PUBLISHABLE_KEY` | Stripe publishable key | `pk_test_...` or `pk_live_...` |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret | `whsec_...` |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `HOST` | Server host | `localhost` |
| `API_VERSION` | API version prefix | `v1` |
| `MONGODB_MAX_POOL_SIZE` | MongoDB connection pool size | `10` |
| `BCRYPT_ROUNDS` | Password hashing rounds | `10` |
| `PAYMENT_CURRENCY` | Default payment currency | `USD` |
| `CLIENT_URL` | Frontend application URL | `http://localhost:3000` |
| `CORS_ORIGIN` | Allowed CORS origins (comma-separated) | `http://localhost:3000` |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window in ms | `900000` (15 min) |
| `RATE_LIMIT_MAX_REQUESTS` | Max requests per window | `100` |
| `LOG_LEVEL` | Logging level | `info` |
| `LOG_FILE_PATH` | Log directory path | `./logs` |

### Email Configuration (Optional)

| Variable | Description | Example |
|----------|-------------|---------|
| `EMAIL_SERVICE` | Email service provider | `smtp` or `sendgrid` |
| `EMAIL_HOST` | SMTP host | `smtp.gmail.com` |
| `EMAIL_PORT` | SMTP port | `587` |
| `EMAIL_SECURE` | Use TLS | `false` |
| `EMAIL_USER` | Email username | `your-email@example.com` |
| `EMAIL_PASSWORD` | Email password/app password | Your password |
| `EMAIL_FROM` | Sender email address | `noreply@ecommerce.com` |
| `EMAIL_FROM_NAME` | Sender name | `E-Commerce Store` |
| `SENDGRID_API_KEY` | SendGrid API key (if using SendGrid) | `SG.xxx` |

### Redis Configuration (Optional)

| Variable | Description | Default |
|----------|-------------|---------|
| `REDIS_HOST` | Redis server host | `localhost` |
| `REDIS_PORT` | Redis server port | `6379` |
| `REDIS_PASSWORD` | Redis password | (empty) |
| `REDIS_DB` | Redis database number | `0` |
| `CACHE_TTL` | Cache TTL in seconds | `3600` |

### File Upload Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `MAX_FILE_SIZE` | Max file size in bytes | `5242880` (5MB) |
| `UPLOAD_PATH` | Upload directory | `./uploads` |
| `ALLOWED_FILE_TYPES` | Allowed MIME types | `image/jpeg,image/png,image/webp,image/gif` |

## 🏃 How to Run

### Development Mode

```bash
npm run dev
```

Starts the server with nodemon for auto-reloading on file changes.

### Production Mode

```bash
npm start
```

Starts the server without auto-reloading.

### Run Tests

```bash
# Run all tests with coverage
npm test

# Run tests in watch mode
npm run test:watch
```

### Linting

```bash
# Check for linting errors
npm run lint

# Fix linting errors automatically
npm run lint:fix
```

### Code Formatting

```bash
npm run format
```

### Database Seeding

```bash
npm run seed
```

### Using Docker

```bash
# Start all services (API, MongoDB, Redis, Admin UIs)
docker-compose up -d

# View logs
docker-compose logs -f api

# Stop all services
docker-compose down

# Stop and remove volumes
docker-compose down -v
```

**Docker Services:**
- API: `http://localhost:3000`
- MongoDB: `localhost:27017`
- Redis: `localhost:6379`
- Mongo Express (DB UI): `http://localhost:8081` (admin/admin123)
- Redis Commander: `http://localhost:8082` (admin/admin123)

## 📡 API Endpoints

### Authentication

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/auth/register` | Register new user | ❌ |
| POST | `/api/auth/login` | Login user | ❌ |
| POST | `/api/auth/refresh` | Refresh access token | ❌ |
| POST | `/api/auth/logout` | Logout current session | ✅ |
| POST | `/api/auth/logout-all` | Logout all sessions | ✅ |
| POST | `/api/auth/forgot-password` | Request password reset | ❌ |
| POST | `/api/auth/reset-password` | Reset password with token | ❌ |

### Products

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/products` | Get all products (paginated) | ❌ |
| GET | `/api/products/:id` | Get product by ID | ❌ |
| GET | `/api/products/search` | Search products | ❌ |
| POST | `/api/products` | Create new product | ✅ Admin |
| PUT | `/api/products/:id` | Update product | ✅ Admin |
| DELETE | `/api/products/:id` | Delete product (soft delete) | ✅ Admin |

### Categories

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/categories` | Get all categories | ❌ |
| GET | `/api/categories/:id` | Get category by ID | ❌ |
| GET | `/api/categories/:id/subcategories` | Get subcategories | ❌ |
| GET | `/api/categories/tree` | Get category tree | ❌ |
| POST | `/api/categories` | Create category | ✅ Admin |
| PUT | `/api/categories/:id` | Update category | ✅ Admin |
| DELETE | `/api/categories/:id` | Delete category | ✅ Admin |

### Shopping Cart

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/cart` | Get user's cart | ✅ |
| POST | `/api/cart/items` | Add item to cart | ✅ |
| PUT | `/api/cart/items/:productId` | Update cart item quantity | ✅ |
| DELETE | `/api/cart/items/:productId` | Remove item from cart | ✅ |
| DELETE | `/api/cart` | Clear entire cart | ✅ |

### Orders

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/orders` | Get user's orders | ✅ |
| GET | `/api/orders/:id` | Get order by ID | ✅ |
| POST | `/api/orders` | Create new order | ✅ |
| POST | `/api/orders/:id/cancel` | Cancel order | ✅ |
| PATCH | `/api/orders/:id/status` | Update order status | ✅ Admin |
| POST | `/api/orders/:id/refund` | Refund order | ✅ Admin |

### Payments

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/payments/intent` | Create payment intent | ✅ |
| POST | `/api/payments/webhook` | Stripe webhook handler | ❌ |
| POST | `/api/payments/refund` | Process refund | ✅ |
| GET | `/api/payments/status/:orderId` | Get payment status | ✅ |
| GET | `/api/payments/methods` | Get user payment methods | ✅ |
| POST | `/api/payments/methods` | Add payment method | ✅ |
| DELETE | `/api/payments/methods/:methodId` | Delete payment method | ✅ |

### Users

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/users` | Get all users | ✅ Admin |
| GET | `/api/users/:id` | Get user by ID | ✅ Admin |
| GET | `/api/users/profile` | Get own profile | ✅ |
| PUT | `/api/users/profile` | Update own profile | ✅ |
| PUT | `/api/users/change-password` | Change password | ✅ |
| POST | `/api/users` | Create user | ✅ Admin |
| PUT | `/api/users/:id` | Update user | ✅ Admin |
| DELETE | `/api/users/:id` | Delete user | ✅ Admin |
| PATCH | `/api/users/:id/status` | Update user status | ✅ Admin |

### Health Check

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/health` | API health status | ❌ |

## 🏗️ Architecture Overview

### Project Structure

```
src/
├── config/              # Configuration files
│   ├── database.js      # MongoDB connection with retry logic
│   ├── environment.js   # Environment variable validation
│   ├── logger.js        # Winston logger configuration
│   ├── stripe.js        # Stripe payment gateway setup
│   ├── sendgrid.js      # SendGrid email service
│   ├── redis.js         # Redis client configuration
│   ├── cloudinary.js    # Cloudinary image storage
│   └── paypal.js        # PayPal SDK configuration
├── controllers/         # Request handlers
│   ├── auth.controller.js
│   ├── cart.controller.js
│   ├── category.controller.js
│   ├── order.controller.js
│   ├── payment.controller.js
│   ├── product.controller.js
│   └── user.controller.js
├── middleware/          # Express middleware
│   ├── auth.js          # JWT authentication
│   ├── authorization.js # Role-based access control
│   ├── cors.js          # CORS configuration
│   ├── errorHandler.js  # Global error handling
│   ├── logger.js        # Request logging
│   ├── rateLimiter.js   # Rate limiting
│   └── validation.js    # Request validation
├── models/              # Mongoose schemas
│   ├── User.js          # User account schema
│   ├── Product.js       # Product catalog schema
│   ├── Category.js      # Product category schema
│   ├── Cart.js          # Shopping cart schema
│   ├── Order.js         # Order schema
│   ├── OrderItem.js     # Order line item schema
│   └── Payment.js       # Payment transaction schema
├── routes/              # API route definitions
│   ├── auth.routes.js
│   ├── cart.routes.js
│   ├── category.routes.js
│   ├── order.routes.js
│   ├── payment.routes.js
│   ├── product.routes.js
│   ├── user.routes.js
│   └── index.js         # Route aggregator
├── services/            # Business logic layer
│   ├── auth.service.js
│   ├── cart.service.js
│   ├── category.service.js
│   ├── email.service.js
│   ├── order.service.js
│   ├── payment.service.js
│   ├── product.service.js
│   └── user.service.js
├── utils/               # Utility functions
│   ├── validators.js    # Input validation helpers
│   ├── helpers.js       # General helper functions
│   ├── logger.js        # Logger utility
│   ├── response.js      # API response formatter
│   └── jwt.js           # JWT token utilities
├── app.js               # Express application setup
└── server.js            # Server entry point
```

### Technology Stack

- **Runtime**: Node.js 