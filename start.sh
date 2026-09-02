#!/bin/sh
set -e

echo "=== Starting Agent CLI Server ==="
echo "Node version: $(node --version)"
echo "NPM version: $(npm --version)"
echo "Current directory: $(pwd)"
echo "Files in dist/:"
ls -la dist/ | grep server || echo "No server files found"
echo "Environment:"
echo "  PORT=$PORT"
echo "  NODE_ENV=$NODE_ENV"
echo ""

echo "Attempting to start server..."
exec node dist/server.cjs 2>&1
