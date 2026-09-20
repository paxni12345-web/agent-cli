FROM node:20-alpine

WORKDIR /app

# Install all deps (typescript is needed to compile)
COPY package*.json ./
RUN npm ci

# Copy application files
COPY . .

# Compile the TypeScript project (src -> dist, ESM)
RUN npm run build

# Drop dev dependencies from the final image
RUN npm prune --omit=dev && chmod +x start.sh

ENV NODE_ENV=production
ENV PORT=10000

EXPOSE 10000

CMD ["sh", "start.sh"]
