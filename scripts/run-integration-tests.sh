#!/usr/bin/env bash

# Integration Test Runner Script
# Runs security integration tests with proper setup

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}=====================================${NC}"
echo -e "${GREEN}Security Integration Test Runner${NC}"
echo -e "${GREEN}=====================================${NC}"
echo ""

# Check if Node modules are installed
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}Installing dependencies...${NC}"
    npm install
fi

# Parse command line arguments
TEST_FILE=""
COVERAGE=false
WATCH=false
VERBOSE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --coverage)
            COVERAGE=true
            shift
            ;;
        --watch)
            WATCH=true
            shift
            ;;
        --verbose)
            VERBOSE=true
            shift
            ;;
        --file=*)
            TEST_FILE="${1#*=}"
            shift
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            exit 1
            ;;
    esac
done

# Build command
CMD="NODE_OPTIONS=--experimental-vm-modules jest --config=tests/integration/jest.integration.config.js"

if [ "$COVERAGE" = true ]; then
    CMD="$CMD --coverage"
fi

if [ "$WATCH" = true ]; then
    CMD="$CMD --watch"
fi

if [ "$VERBOSE" = true ]; then
    CMD="$CMD --verbose"
fi

if [ -n "$TEST_FILE" ]; then
    CMD="$CMD $TEST_FILE"
else
    CMD="$CMD tests/integration/security"
fi

echo -e "${YELLOW}Running command:${NC} $CMD"
echo ""

# Run tests
eval $CMD

EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
    echo ""
    echo -e "${GREEN}=====================================${NC}"
    echo -e "${GREEN}✅ All tests passed!${NC}"
    echo -e "${GREEN}=====================================${NC}"
else
    echo ""
    echo -e "${RED}=====================================${NC}"
    echo -e "${RED}❌ Tests failed${NC}"
    echo -e "${RED}=====================================${NC}"
fi

exit $EXIT_CODE
