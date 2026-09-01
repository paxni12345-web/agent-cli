# Pre-built Dockerfile (no TypeScript compilation needed)
FROM node:18-alpine

WORKDIR /app

# Copy package files and pre-built dist
COPY package*.json ./
COPY dist ./dist
COPY public ./public

# Install production dependencies only (no build needed!)
RUN npm ci --production --omit=dev && \
    npm cache clean --force

ENV NODE_ENV=production
ENV PORT=10000

EXPOSE 10000

# Run pre-built server
CMD ["node", "dist/server.js"]
