### Payment Gateway Setup

#### Stripe (Recommended)

1. Create account at [stripe.com](https://stripe.com)
2. Navigate to Developers > API keys
3. Copy "Publishable key" and "Secret key" (use test keys for development)
4. For webhooks:
   - Go to Developers > Webhooks
   - Add endpoint: `http://localhost:3000/api/payments/webhook`
   - Select events: `payment_intent.succeeded`, `payment_intent.payment_failed`
   - Copy webhook signing secret

#### PayPal (Alternative)

1. Create developer account at [developer.paypal.com](https://developer.paypal.com)
2. Create a sandbox application
3. Copy Client ID and Secret
4. Set `PAYPAL_MODE=sandbox` in .env

### Email Service Setup

#### SendGrid (Recommended)

1. Create account at [sendgrid.com](https://sendgrid.com)
2. Navigate to Settings > API Keys
3. Create new API key with "Full Access"
4. Verify sender email address in Settings > Sender Authentication

#### SMTP (Alternative)

For Gmail:
1. Enable 2-factor authentication
2. Generate app-specific password
3. Use `smtp.gmail.com` as host, port `587`

## Development Tools

### Recommended VS Code Extensions

- **ESLint**: Code linting and formatting
- **Prettier**: Code formatting
- **REST Client**: Test API endpoints directly in VS Code
- **MongoDB for VS Code**: Browse and query MongoDB
- **GitLens**: Enhanced Git integration
- **Thunder Client**: API testing (alternative to Postman)

### Postman Collection

Import the API collection for testing:

1. Open Postman
2. Click Import > Link
3. Enter: `http://localhost:3000/api-docs/postman`
4. Collection includes all endpoints with example requests

### Database GUI Tools

**MongoDB Compass** (Recommended):
- Download from [mongodb.com/products/compass](https://www.mongodb.com/products/compass)
- Connect using your MONGODB_URI
- Browse collections, run queries, analyze performance

**Studio 3T** (Alternative):
- More advanced features
- Free trial available
- Great for complex queries and aggregations

## Project Structure
