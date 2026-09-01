# Ultra-simple Dockerfile for Render
FROM node:18-alpine

WORKDIR /app

# Copy everything
COPY . .

# Install and build in one step
RUN npm install && npm run build || npm install typescript && npx tsc

# Remove devDependencies
RUN npm prune --production

ENV NODE_ENV=production
ENV PORT=10000

EXPOSE 10000

# Try multiple start commands
CMD npm start || node dist/server.js || node dist/cli.js
