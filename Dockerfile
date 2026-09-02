FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application files
COPY . .

# Make start script executable
RUN chmod +x start.sh

ENV NODE_ENV=production
ENV PORT=10000

EXPOSE 10000

CMD ["sh", "start.sh"]
