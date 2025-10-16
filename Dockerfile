// File: Dockerfile
// Generated: 2025-10-16 10:39:17 UTC
// Project ID: proj_c85cfd5b58f3
// Task ID: task_nmfx6nd6yuax

COPY package*.json ./

# Install production dependencies only
# Use npm ci for reproducible builds and clean cache to reduce image size
RUN npm ci --only=production && \
    npm cache clean --force

# =============================================================================
# STAGE 2: Production - Create minimal runtime image
# =============================================================================
FROM node:18-alpine AS production

# Set Node environment to production
ENV NODE_ENV=production

# Set working directory
WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy node_modules from builder stage
COPY --from=builder /app/node_modules ./node_modules

# Copy application source code
COPY --chown=nodejs:nodejs . .

# Switch to non-root user
USER nodejs

# Expose application port
EXPOSE 3000

# Health check endpoint
# Application must implement GET /health endpoint that returns 200 status
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start application using exec form for proper signal handling
CMD ["node", "src/server.js"]
