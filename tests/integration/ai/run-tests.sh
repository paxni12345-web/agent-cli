#!/bin/bash

# AI Integration Test Runner
# Convenience script for running AI integration tests

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print colored output
print_color() {
    color=$1
    shift
    echo -e "${color}$@${NC}"
}

# Print header
print_header() {
    echo ""
    print_color "$BLUE" "=========================================="
    print_color "$BLUE" "$1"
    print_color "$BLUE" "=========================================="
    echo ""
}

# Print usage
usage() {
    cat << EOF
AI Integration Test Runner

Usage: $0 [command] [options]

Commands:
    all                 Run all integration tests (default)
    learning            Run LearningSystem tests
    orchestrator        Run MultiModelOrchestrator tests
    multimodal          Run MultiModalAI tests
    agents              Run AgentOrchestration tests
    dataset             Run DatasetManager tests
    e2e                 Run end-to-end tests
    coverage            Run all tests with coverage report
    watch               Run tests in watch mode
    quick               Run tests without coverage (faster)
    clean               Clean test artifacts and temp files

Options:
    --verbose           Verbose output
    --bail              Stop on first failure
    --help              Show this help message

Examples:
    $0 all              Run all integration tests
    $0 learning         Run only learning system tests
    $0 coverage         Run with coverage report
    $0 watch            Run in watch mode
    $0 clean            Clean up test artifacts
EOF
    exit 0
}

# Clean test artifacts
clean_tests() {
    print_header "Cleaning Test Artifacts"

    print_color "$YELLOW" "Removing coverage reports..."
    rm -rf coverage/integration/ai

    print_color "$YELLOW" "Removing test results..."
    rm -rf test-results/integration/ai

    print_color "$YELLOW" "Cleaning temporary test directories..."
    # Clean up any leftover temp directories
    find /tmp -maxdepth 1 -name "learning-test-*" -type d -exec rm -rf {} + 2>/dev/null || true
    find /tmp -maxdepth 1 -name "multimodal-test-*" -type d -exec rm -rf {} + 2>/dev/null || true
    find /tmp -maxdepth 1 -name "dataset-test-*" -type d -exec rm -rf {} + 2>/dev/null || true
    find /tmp -maxdepth 1 -name "e2e-ai-test-*" -type d -exec rm -rf {} + 2>/dev/null || true

    print_color "$GREEN" "✓ Cleanup complete!"
}

# Run specific test suite
run_test() {
    test_file=$1
    test_name=$2

    print_header "Running $test_name"

    if [ "$COVERAGE" = "true" ]; then
        npm run test:coverage -- "tests/integration/ai/$test_file" $EXTRA_ARGS
    else
        npm test -- "tests/integration/ai/$test_file" $EXTRA_ARGS
    fi
}

# Main execution
main() {
    # Default values
    COMMAND="all"
    COVERAGE="false"
    EXTRA_ARGS=""

    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --help|-h)
                usage
                ;;
            --verbose)
                EXTRA_ARGS="$EXTRA_ARGS --verbose"
                shift
                ;;
            --bail)
                EXTRA_ARGS="$EXTRA_ARGS --bail"
                shift
                ;;
            all|learning|orchestrator|multimodal|agents|dataset|e2e|coverage|watch|quick|clean)
                COMMAND=$1
                shift
                ;;
            *)
                print_color "$RED" "Unknown option: $1"
                usage
                ;;
        esac
    done

    # Execute command
    case $COMMAND in
        clean)
            clean_tests
            exit 0
            ;;

        coverage)
            COVERAGE="true"
            COMMAND="all"
            ;;

        watch)
            print_header "Running Tests in Watch Mode"
            npm run test:watch -- tests/integration/ai/
            exit 0
            ;;

        quick)
            COVERAGE="false"
            COMMAND="all"
            ;;
    esac

    # Check if running all tests or specific suite
    case $COMMAND in
        all)
            print_header "Running All AI Integration Tests"
            print_color "$YELLOW" "This will take approximately 2-3 minutes..."
            echo ""

            if [ "$COVERAGE" = "true" ]; then
                npm run test:coverage -- tests/integration/ai/
            else
                npm test -- tests/integration/ai/
            fi
            ;;

        learning)
            run_test "learning-system.integration.test.ts" "LearningSystem Tests"
            ;;

        orchestrator)
            run_test "multi-model-orchestrator.integration.test.ts" "MultiModelOrchestrator Tests"
            ;;

        multimodal)
            run_test "multi-modal-ai.integration.test.ts" "MultiModalAI Tests"
            ;;

        agents)
            run_test "agent-orchestration.integration.test.ts" "AgentOrchestration Tests"
            ;;

        dataset)
            run_test "dataset-manager.integration.test.ts" "DatasetManager Tests"
            ;;

        e2e)
            run_test "end-to-end.integration.test.ts" "End-to-End Tests"
            ;;
    esac

    # Print summary
    if [ $? -eq 0 ]; then
        echo ""
        print_color "$GREEN" "=========================================="
        print_color "$GREEN" "✓ All tests passed successfully!"
        print_color "$GREEN" "=========================================="
        echo ""

        if [ "$COVERAGE" = "true" ]; then
            print_color "$BLUE" "Coverage report: coverage/integration/ai/lcov-report/index.html"
        fi
    else
        echo ""
        print_color "$RED" "=========================================="
        print_color "$RED" "✗ Some tests failed"
        print_color "$RED" "=========================================="
        exit 1
    fi
}

# Run main function
main "$@"
