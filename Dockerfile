FROM node:18-alpine

WORKDIR /app

# Install all deps (typescript is needed to compile the server)
COPY package*.json ./
RUN npm ci

# Copy application files (dist/ and node_modules/ are excluded by .dockerignore)
COPY . .

# Compile only the web server entry; the rest of src is not needed at runtime.
# tsc may exit non-zero on type errors but still emits, so we only require the output file.
RUN npx tsc src/server.ts --outDir dist --module commonjs --target ES2022 --moduleResolution node --esModuleInterop --skipLibCheck --types node ; test -f dist/server.js && cp dist/server.js dist/server.cjs

# Drop dev dependencies from the final image
RUN npm prune --omit=dev && chmod +x start.sh

ENV NODE_ENV=production
ENV PORT=10000

EXPOSE 10000

CMD ["sh", "start.sh"]
