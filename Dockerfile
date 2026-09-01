# Simplified Dockerfile for Render Free Tier
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies (production only, no tests)
RUN npm ci --production --ignore-scripts && \
    npm cache clean --force

# Copy source
COPY src ./src
COPY public ./public

# Build TypeScript (simple build, no tests)
RUN npm install typescript && \
    npx tsc && \
    npm uninstall typescript

# Remove dev dependencies after build
RUN npm prune --production

# Expose port
EXPOSE 10000

ENV NODE_ENV=production
ENV PORT=10000

# Start server
CMD ["node", "dist/server.js"]
