# Simplest Dockerfile - No npm ci
FROM node:18-alpine

WORKDIR /app

# Copy everything
COPY . .

ENV NODE_ENV=production
ENV PORT=10000

EXPOSE 10000

# Run directly (all deps already in node_modules if any)
CMD ["node", "dist/server.js"]
