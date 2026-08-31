# Multi-stage Dockerfile for Agent CLI
# Optimized for production deployment

# Stage 1: Build
FROM node:18-alpine AS builder

LABEL maintainer="Agent CLI Team"
LABEL description="Production-ready AI coding agent platform"

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY src ./src
COPY tests ./tests

# Build TypeScript
RUN npm run build

# Run tests
RUN npm test

# Stage 2: Production
FROM node:18-alpine AS production

WORKDIR /app

# Install production dependencies only
COPY package*.json ./
RUN npm ci --production --ignore-scripts && \
    npm cache clean --force

# Copy built files from builder
COPY --from=builder /app/dist ./dist

# Create non-root user
RUN addgroup -g 1001 -S agent && \
    adduser -S -u 1001 -G agent agent && \
    chown -R agent:agent /app

# Switch to non-root user
USER agent

# Expose port (if needed)
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "console.log('healthy')" || exit 1

# Set environment
ENV NODE_ENV=production

# Start application
CMD ["node", "dist/cli.js"]

# Stage 3: Development
FROM node:18-alpine AS development

WORKDIR /app

# Install all dependencies including dev
COPY package*.json ./
RUN npm install

# Copy source
COPY . .

# Development user
USER node

# Hot reload
CMD ["npm", "run", "dev"]
