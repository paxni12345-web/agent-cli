#!/bin/bash

##############################################################################
# APIGateway Unit Tests Runner
#
# Runs comprehensive unit tests for all APIGateway implementations
# with coverage reporting and validation
##############################################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}   APIGateway Unit Tests Suite${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""

# Change to test directory
cd "$(dirname "$0")"
TEST_DIR=$(pwd)
ROOT_DIR="$TEST_DIR/../../.."

echo -e "${YELLOW}Test Directory:${NC} $TEST_DIR"
echo -e "${YELLOW}Root Directory:${NC} $ROOT_DIR"
echo ""

# Function to run tests for a specific implementation
run_test() {
    local test_file=$1
    local name=$2

    echo -e "${BLUE}Running ${name} tests...${NC}"

    if [ -f "$test_file" ]; then
        if npm test "$test_file" --silent 2>&1 | tee /tmp/test_output.txt; then
            local passed=$(grep -o "Tests:.*passed" /tmp/test_output.txt || echo "0 passed")
            echo -e "${GREEN}✓ ${name}: ${passed}${NC}"
            return 0
        else
            echo -e "${RED}✗ ${name}: FAILED${NC}"
            return 1
        fi
    else
        echo -e "${YELLOW}⚠ ${name}: Test file not found${NC}"
        return 1
    fi
}

# Function to run coverage
run_coverage() {
    echo ""
    echo -e "${BLUE}================================================${NC}"
    echo -e "${BLUE}   Running Coverage Analysis${NC}"
    echo -e "${BLUE}================================================${NC}"
    echo ""

    npm test "$TEST_DIR" -- --coverage --coverageReporters=text --coverageReporters=json-summary 2>&1 | tee /tmp/coverage_output.txt

    if [ -f "$ROOT_DIR/coverage/coverage-summary.json" ]; then
        echo ""
        echo -e "${GREEN}Coverage report generated successfully${NC}"
        echo -e "${YELLOW}Location:${NC} $ROOT_DIR/coverage/"

        # Extract coverage percentages
        if command -v jq &> /dev/null; then
            echo ""
            echo -e "${BLUE}Coverage Summary:${NC}"
            jq -r '.total | "Lines: \(.lines.pct)%\nStatements: \(.statements.pct)%\nFunctions: \(.functions.pct)%\nBranches: \(.branches.pct)%"' \
                "$ROOT_DIR/coverage/coverage-summary.json"
        fi

        return 0
    else
        echo -e "${YELLOW}⚠ Coverage report not found${NC}"
        return 1
    fi
}

# Function to check coverage thresholds
check_coverage() {
    echo ""
    echo -e "${BLUE}================================================${NC}"
    echo -e "${BLUE}   Validating Coverage Thresholds (>90%)${NC}"
    echo -e "${BLUE}================================================${NC}"
    echo ""

    if [ -f "$ROOT_DIR/coverage/coverage-summary.json" ] && command -v jq &> /dev/null; then
        local lines=$(jq -r '.total.lines.pct' "$ROOT_DIR/coverage/coverage-summary.json")
        local statements=$(jq -r '.total.statements.pct' "$ROOT_DIR/coverage/coverage-summary.json")
        local functions=$(jq -r '.total.functions.pct' "$ROOT_DIR/coverage/coverage-summary.json")
        local branches=$(jq -r '.total.branches.pct' "$ROOT_DIR/coverage/coverage-summary.json")

        local threshold=90
        local all_passed=true

        # Check lines
        if (( $(echo "$lines >= $threshold" | bc -l) )); then
            echo -e "${GREEN}✓ Lines coverage: ${lines}%${NC}"
        else
            echo -e "${RED}✗ Lines coverage: ${lines}% (threshold: ${threshold}%)${NC}"
            all_passed=false
        fi

        # Check statements
        if (( $(echo "$statements >= $threshold" | bc -l) )); then
            echo -e "${GREEN}✓ Statements coverage: ${statements}%${NC}"
        else
            echo -e "${RED}✗ Statements coverage: ${statements}% (threshold: ${threshold}%)${NC}"
            all_passed=false
        fi

        # Check functions
        if (( $(echo "$functions >= $threshold" | bc -l) )); then
            echo -e "${GREEN}✓ Functions coverage: ${functions}%${NC}"
        else
            echo -e "${RED}✗ Functions coverage: ${functions}% (threshold: ${threshold}%)${NC}"
            all_passed=false
        fi

        # Check branches
        if (( $(echo "$branches >= $threshold" | bc -l) )); then
            echo -e "${GREEN}✓ Branches coverage: ${branches}%${NC}"
        else
            echo -e "${RED}✗ Branches coverage: ${branches}% (threshold: ${threshold}%)${NC}"
            all_passed=false
        fi

        if [ "$all_passed" = true ]; then
            echo ""
            echo -e "${GREEN}All coverage thresholds met!${NC}"
            return 0
        else
            echo ""
            echo -e "${RED}Some coverage thresholds not met${NC}"
            return 1
        fi
    else
        echo -e "${YELLOW}⚠ Cannot validate coverage (missing coverage-summary.json or jq)${NC}"
        return 1
    fi
}

# Main execution
main() {
    local start_time=$(date +%s)
    local failed_tests=0

    echo -e "${YELLOW}Starting test suite...${NC}"
    echo ""

    # Run individual test files
    echo -e "${BLUE}================================================${NC}"
    echo -e "${BLUE}   Running Individual Test Suites${NC}"
    echo -e "${BLUE}================================================${NC}"
    echo ""

    run_test "$TEST_DIR/APIGateway.network.test.ts" "Network APIGateway" || ((failed_tests++))
    echo ""

    run_test "$TEST_DIR/APIGateway.api.test.ts" "API APIGateway" || ((failed_tests++))
    echo ""

    run_test "$TEST_DIR/APIGateway.gateway.test.ts" "Gateway APIGatewayManager" || ((failed_tests++))
    echo ""

    # Run coverage analysis
    if [ $failed_tests -eq 0 ]; then
        run_coverage
        check_coverage || true  # Don't fail on coverage check
    else
        echo -e "${RED}Skipping coverage due to test failures${NC}"
    fi

    # Summary
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))

    echo ""
    echo -e "${BLUE}================================================${NC}"
    echo -e "${BLUE}   Test Suite Summary${NC}"
    echo -e "${BLUE}================================================${NC}"
    echo ""
    echo -e "${YELLOW}Duration:${NC} ${duration}s"

    if [ $failed_tests -eq 0 ]; then
        echo -e "${GREEN}✓ All test suites passed!${NC}"
        echo ""
        echo -e "${YELLOW}View detailed coverage report:${NC}"
        echo -e "  open $ROOT_DIR/coverage/lcov-report/index.html"
        echo ""
        exit 0
    else
        echo -e "${RED}✗ ${failed_tests} test suite(s) failed${NC}"
        echo ""
        exit 1
    fi
}

# Run main function
main
