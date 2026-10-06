#!/bin/sh
set -e

echo "=== Starting Agent Server ==="
echo "Node version: $(node --version)"
echo "  PORT=$PORT"
echo "  NODE_ENV=$NODE_ENV"
echo ""

exec node dist/agent-server.js
