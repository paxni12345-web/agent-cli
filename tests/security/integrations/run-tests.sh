#!/bin/bash

# Security Test Runner Script
# Executes integration security tests with various configurations

set -e

echo "=================================="
echo "Integration Security Test Suite"
echo "=================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test configuration
TEST_DIR="tests/security/integrations"
COVERAGE_DIR="coverage/security/integrations"

# Parse command line arguments
VERBOSE=false
COVERAGE=false
SPECIFIC_TEST=""

while [[ $# -gt 0 ]]; do
  case $1 in
    -v|--verbose)
      VERBOSE=true
      shift
      ;;
    -c|--coverage)
      COVERAGE=true
      shift
      ;;
    -t|--test)
      SPECIFIC_TEST="$2"
      shift 2
      ;;
    -h|--help)
      echo "Usage: $0 [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  -v, --verbose     Enable verbose output"
      echo "  -c, --coverage    Generate coverage report"
      echo "  -t, --test NAME   Run specific test file"
      echo "  -h, --help        Show this help message"
      echo ""
      echo "Examples:"
      echo "  $0                              # Run all tests"
      echo "  $0 -c                           # Run with coverage"
      echo "  $0 -t aws-integration           # Run AWS tests only"
      echo "  $0 -v -c                        # Verbose with coverage"
      exit 0
      ;;
    *)
      echo -e "${RED}Unknown option: $1${NC}"
      exit 1
      ;;
  esac
done

# Function to run tests
run_tests() {
  local test_pattern=$1
  local description=$2

  echo -e "${YELLOW}Running: ${description}${NC}"

  if [ "$COVERAGE" = true ]; then
    npm test -- --coverage --coverageDirectory="$COVERAGE_DIR" "$test_pattern"
  else
    npm test -- "$test_pattern"
  fi

  if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ ${description} passed${NC}"
    return 0
  else
    echo -e "${RED}✗ ${description} failed${NC}"
    return 1
  fi
}

# Main test execution
echo "Test Directory: $TEST_DIR"
echo "Coverage: $([ "$COVERAGE" = true ] && echo "Enabled" || echo "Disabled")"
echo "Verbose: $([ "$VERBOSE" = true ] && echo "Enabled" || echo "Disabled")"
echo ""

FAILED_TESTS=0

if [ -n "$SPECIFIC_TEST" ]; then
  # Run specific test
  echo -e "${YELLOW}Running specific test: ${SPECIFIC_TEST}${NC}"
  run_tests "${TEST_DIR}/${SPECIFIC_TEST}*.test.ts" "${SPECIFIC_TEST}" || ((FAILED_TESTS++))
else
  # Run all security tests
  echo -e "${YELLOW}Running all integration security tests...${NC}"
  echo ""

  # AWS Integration Tests
  run_tests "${TEST_DIR}/aws-integration.security.test.ts" "AWS Integration Security" || ((FAILED_TESTS++))
  echo ""

  # Azure Integration Tests
  run_tests "${TEST_DIR}/azure-integration.security.test.ts" "Azure Integration Security" || ((FAILED_TESTS++))
  echo ""

  # GCP Integration Tests
  run_tests "${TEST_DIR}/gcp-integration.security.test.ts" "GCP Integration Security" || ((FAILED_TESTS++))
  echo ""

  # General Integration Tests
  run_tests "${TEST_DIR}/general-integration.security.test.ts" "General Integration Security" || ((FAILED_TESTS++))
  echo ""
fi

# Summary
echo "=================================="
echo "Test Summary"
echo "=================================="

if [ $FAILED_TESTS -eq 0 ]; then
  echo -e "${GREEN}All tests passed!${NC}"

  if [ "$COVERAGE" = true ]; then
    echo ""
    echo "Coverage report generated in: $COVERAGE_DIR"
    echo "Open $COVERAGE_DIR/lcov-report/index.html to view detailed coverage"
  fi

  exit 0
else
  echo -e "${RED}$FAILED_TESTS test suite(s) failed${NC}"
  exit 1
fi
